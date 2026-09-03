// -------------------------------------------------------------------------
// Changes from previous version:
//   • signUp() accepts an optional `country` (ISO 3166-1 alpha-2, e.g. "SA")
//     and stores it inside company.settings immediately after RPC creation.
//   • Added "Remember Me" support via setAuthPersistence.
// -------------------------------------------------------------------------

import React, {
    createContext, useContext, useState,
    useEffect, useCallback, useRef
} from 'react';
import { supabase } from '../supabaseClient';

const AuthContext = createContext({});

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used within an AuthProvider');
    return context;
};

// -------------------------------------------------------------------------
const INITIAL_STATE = {
    user: null,
    company: null,
    isSuperAdmin: false,
    isReseller: false,
    resellerData: null,   // { id, name, status, ... }
    activeRole: null,     // 'super_admin', 'reseller', 'org_admin', or 'hr'
    userPermissions: null, // { can_manage_employees: true, ... }
    companies: [],        // Array of { company, role, permissions }
    loading: true,
    error: null,
    requiresPasswordUpdate: false,
};

export function AuthProvider({ children }) {
    const [authState, setAuthState] = useState(INITIAL_STATE);

    const isMounted = useRef(true);
    const syncGenRef = useRef(0);
    const currentUserIdRef = useRef(null);
    const isFullySyncedRef = useRef(false);

    const fetchCompanyData = useCallback(async (userId) => {
        if (!userId) return null;
        try {
            // 1. Fetch ALL companies owned by user
            const { data: ownerData, error: ownerError } = await supabase
                .from('companies')
                .select(`
                    id, name, owner_id, created_at,
                    subscription_end_date, license_key, settings,
                    plan, status, subscription_expires_at,
                    reseller_id, restriction_level, subscription_amount
                `)
                .eq('owner_id', userId)
                .order('created_at', { ascending: true });

            if (ownerError) {
                console.error('[fetchCompanyData] owner query error:', ownerError);
            }

            // 2. Fetch ALL companies user is HR sub-user of
            const { data: subUserData, error: subUserError } = await supabase
                .from('company_users')
                .select(`
                    role,
                    permissions,
                    companies (
                        id, name, owner_id, created_at,
                        subscription_end_date, license_key, settings,
                        plan, status, subscription_expires_at,
                        reseller_id, restriction_level, subscription_amount
                    )
                `)
                .eq('user_id', userId);

            if (subUserError) {
                console.error('[fetchCompanyData] sub-user query error:', subUserError);
            }

            let allCompanies = [];

            if (ownerData && ownerData.length > 0) {
                ownerData.forEach(ownerDataRow => {
                    const mappedCompany = {
                        ...ownerDataRow,
                        subscription_end_date: ownerDataRow.settings?.subscription_end_date || ownerDataRow.subscription_end_date,
                        subscription_expires_at: ownerDataRow.settings?.subscription_end_date || ownerDataRow.subscription_expires_at,
                        subscription_status: ownerDataRow.status,
                        trial_ends_at: ownerDataRow.settings?.subscription_end_date || ownerDataRow.settings?.trial_end_date || ownerDataRow.subscription_expires_at,
                        max_employees: ownerDataRow.settings?.max_employees || 100,
                        full_name: ownerDataRow.name,
                        timezone: ownerDataRow.settings?.timezone || 'Asia/Riyadh'
                    };
                    allCompanies.push({ company: mappedCompany, role: 'org_admin', permissions: null });
                });
            }

            if (subUserData && subUserData.length > 0) {
                subUserData.forEach(subUserRow => {
                    if (subUserRow.companies) {
                        const comp = Array.isArray(subUserRow.companies) ? subUserRow.companies[0] : subUserRow.companies;
                        const mappedCompany = {
                            ...comp,
                            subscription_end_date: comp.settings?.subscription_end_date || comp.subscription_end_date,
                            subscription_expires_at: comp.settings?.subscription_end_date || comp.subscription_expires_at,
                            subscription_status: comp.status,
                            trial_ends_at: comp.settings?.subscription_end_date || comp.settings?.trial_end_date || comp.subscription_expires_at,
                            max_employees: comp.settings?.max_employees || 100,
                            full_name: comp.name,
                            timezone: comp.settings?.timezone || 'Asia/Riyadh'
                        };
                        allCompanies.push({
                            company: mappedCompany,
                            role: subUserRow.role || 'hr',
                            permissions: subUserRow.permissions || {}
                        });
                    }
                });
            }

            // Remove duplicates (e.g. if a user is accidentally both owner and sub-user)
            const uniqueCompaniesMap = new Map();
            allCompanies.forEach(item => {
                if (!uniqueCompaniesMap.has(item.company.id)) {
                    uniqueCompaniesMap.set(item.company.id, item);
                }
            });
            const uniqueCompanies = Array.from(uniqueCompaniesMap.values());

            if (uniqueCompanies.length > 0) {
                return uniqueCompanies;
            }

            return null;
        } catch (err) {
            return null;
        }
    }, []);

// -------------------------------------------------------------------------
    const checkSuperAdmin = useCallback(async (userId) => {
        if (!userId) return false;
        try {
            const { data, error } = await supabase
                .from('super_admins')
                .select('user_id')
                .eq('user_id', userId)
                .maybeSingle();
            if (error) return false;
            return !!data;
        } catch (err) {
            return false;
        }
    }, []);

// -------------------------------------------------------------------------
    const checkReseller = useCallback(async (userId) => {
        if (!userId) return null;
        try {
            const { data, error } = await supabase
                .from('resellers')
                .select('id, name, email, status, settings')
                .eq('user_id', userId)
                .maybeSingle();
            if (error || !data) return null;
            return data;
        } catch (err) {
            return null;
        }
    }, []);

// -------------------------------------------------------------------------
    const syncAuthState = useCallback(async (session, force = false) => {
        const myGen = ++syncGenRef.current;

        if (!session?.user) {
            currentUserIdRef.current = null;
            isFullySyncedRef.current = false;
            if (isMounted.current && myGen === syncGenRef.current) {
                setAuthState({
                    user: null, company: null, companies: [], isSuperAdmin: false,
                    isReseller: false, resellerData: null, loading: false, error: null,
                });
            }
            return;
        }

        // If not forced, and we are already fully synced with the database for this user,
        // we can just update the user session in state without refetching from the database.
        // This avoids unnecessary global re-renders/flickering and preserves impersonation status!
        if (!force && isFullySyncedRef.current && currentUserIdRef.current === session.user.id) {
            setAuthState(prev => {
                if (prev.user && prev.user.id === session.user.id) {
                    return {
                        ...prev,
                        user: session.user,
                        loading: false
                    };
                }
                return prev;
            });
            return;
        }

        currentUserIdRef.current = session.user.id;
        // Reset the fully synced flag until this fetch successfully finishes.
        isFullySyncedRef.current = false;

        // Set loading to true immediately if transitioning from logged out state
        if (isMounted.current) {
            setAuthState(prev => {
                if (!prev.user) {
                    return { ...prev, loading: true };
                }
                return prev;
            });
        }

        try {
            const [isSuperAdmin, resellerData] = await Promise.all([
                checkSuperAdmin(session.user.id),
                checkReseller(session.user.id),
            ]);
            const isReseller = !!resellerData;

            let company = null;
            let companies = [];
            let fetchedRole = null;
            let permissions = null;
            // Super admins don't own a company directly, but resellers might also be clients
            if (!isSuperAdmin) {
                // If there is a pending invite token in sessionStorage, accept it automatically!
                const pendingToken = sessionStorage.getItem('pending_invite_token');
                if (pendingToken) {
                    try {
                        await supabase.rpc('accept_invite', { invite_token: pendingToken });
                        sessionStorage.removeItem('pending_invite_token');
                    } catch (e) {
                        console.error('[AuthContext] auto-accept pending invite error:', e);
                    }
                }

                const result = await fetchCompanyData(session.user.id);
                if (result && result.length > 0) {
                    companies = result;
                    // Default to the first company, but respect saved preference if exists
                    const savedActiveCompanyId = localStorage.getItem('active_company_id');
                    const savedCompany = savedActiveCompanyId ? result.find(c => c.company.id === savedActiveCompanyId) : null;
                    
                    if (savedCompany) {
                        company = savedCompany.company;
                        fetchedRole = savedCompany.role;
                        permissions = savedCompany.permissions;
                    } else {
                        company = result[0].company;
                        fetchedRole = result[0].role;
                        permissions = result[0].permissions;
                    }
                }

// -------------------------------------------------------------------------
                if (!company && isMounted.current) {
                    for (let i = 0; i < 2; i++) {
                        await new Promise(res => setTimeout(res, 1500));
                        if (!isMounted.current || myGen !== syncGenRef.current) return;
                        const retryResult = await fetchCompanyData(session.user.id);
                        if (retryResult && retryResult.length > 0) {
                            companies = retryResult;
                            company = retryResult[0].company;
                            fetchedRole = retryResult[0].role;
                            permissions = retryResult[0].permissions;
                            break;
                        }
                    }
                }
            }

            if (!isMounted.current || myGen !== syncGenRef.current) return;

// -------------------------------------------------------------------------
            // Determine initial active role
            let activeRole = fetchedRole || 'org_admin';
            if (isSuperAdmin) {
                activeRole = 'super_admin';
            } else if (isReseller) {
                // If they have switched role previously and saved it, respect it.
                // Otherwise, default to reseller if they don't have a client company, or org_admin if they do.
                const savedRole = localStorage.getItem('active_role');
                if (savedRole && ['reseller', 'org_admin', 'hr'].includes(savedRole)) {
                    // Make sure they can actually be that role
                    if (savedRole === 'reseller' || (savedRole === 'org_admin' && company)) {
                        activeRole = savedRole;
                    }
                } else if (!company) {
                    activeRole = 'reseller';
                }
            }

            setAuthState({
                user: session.user,
                company,
                companies,
                isSuperAdmin,
                isReseller,
                resellerData,
                activeRole,
                userPermissions: permissions,
                loading: false,
                error: null,
            });
            isFullySyncedRef.current = true;
        } catch (err) {
            if (isMounted.current && myGen === syncGenRef.current) {
                setAuthState(prev => ({
                    ...prev,
                    loading: false,
                    error: 'حدث خطأ غير متوقع أثناء تحميل بيانات الحساب.',
                }));
            }
        }
    }, [checkSuperAdmin, fetchCompanyData, checkReseller]);

// -------------------------------------------------------------------------
    useEffect(() => {
        isMounted.current = true;

        const safetyTimer = setTimeout(() => {
            if (isMounted.current) {
                setAuthState(prev => prev.loading ? { ...prev, loading: false } : prev);
            }
        }, 10_000);

        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (event, session) => {
                switch (event) {
                    case 'SIGNED_OUT':
                        syncGenRef.current++;
                        currentUserIdRef.current = null;
                        isFullySyncedRef.current = false;
                        if (isMounted.current) {
                            setAuthState({ ...INITIAL_STATE, loading: false });
                        }
                        break;
                    case 'PASSWORD_RECOVERY':
                        setAuthState(prev => ({ ...prev, requiresPasswordUpdate: true }));
                        syncAuthState(session, true);
                        break;
                    case 'INITIAL_SESSION':
                    case 'SIGNED_IN':
                    case 'TOKEN_REFRESHED':
                    case 'USER_UPDATED':
                        // If it's a token refresh or active session, we don't force a database reload.
                        // But for USER_UPDATED (profile updates), we might want to force fetch.
                        syncAuthState(session, event === 'USER_UPDATED');
                        break;
                    default:
                        break;
                }
            }
        );

        return () => {
            isMounted.current = false;
            // eslint-disable-next-line react-hooks/exhaustive-deps
            syncGenRef.current++;
            subscription.unsubscribe();
            clearTimeout(safetyTimer);
        };
    }, [syncAuthState]);

// -------------------------------------------------------------------------

    const signIn = async (email, password, remember = false) => {
        const { setAuthPersistence } = await import('../supabaseClient');
        setAuthPersistence(remember);

        const { data, error } = await supabase.auth.signInWithPassword({
            email: email.trim(),
            password,
        });
        
        if (error) {
            if (error.message.includes('Email not confirmed')) {
                throw new Error('يرجى تأكيد بريدك الإلكتروني قبل تسجيل الدخول. تفقد صندوق الوارد.');
            }
            throw error;
        }
        
        if (!data?.session) {
            throw new Error('يرجى تأكيد بريدك الإلكتروني.');
        }
        return data;
    };

    const signUp = async (email, password, companyName, country = null, remember = false) => {
        const { setAuthPersistence } = await import('../supabaseClient');
        setAuthPersistence(remember);

        const { data, error: signUpError } = await supabase.auth.signUp({
            email: email.trim(),
            password,
            options: { 
                data: { 
                    full_name: companyName,
                    company_name: companyName,
                    name: companyName,
                    country: country 
                },
                emailRedirectTo: window.location.origin + '/login'
            },
        });
        
        if (signUpError) throw signUpError;
        return data;
    };

    const signOut = async () => {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
    };

    const resetPassword = async (email) => {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
            redirectTo: window.location.origin + '/reset-password',
        });
        if (error) throw error;
    };

    const updatePassword = async (newPassword) => {
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        if (error) throw error;
        setAuthState(prev => ({ ...prev, requiresPasswordUpdate: false }));
    };

    const clearPasswordUpdate = () => {
        setAuthState(prev => ({ ...prev, requiresPasswordUpdate: false }));
    };

    const refreshAuth = async () => {
        syncGenRef.current++;
        setAuthState(prev => ({ ...prev, loading: true }));
        try {
            const { data: { session } } = await supabase.auth.getSession();
            await syncAuthState(session, true);
        } catch (err) {
            if (isMounted.current) {
                setAuthState(prev => ({ ...prev, loading: false, isSuperAdmin: false }));
            }
        }
    };

    const updateCompanySettings = async (settings) => {
        if (!authState.company) return;
        const { data, error } = await supabase
            .from('companies')
            .update({ settings })
            .eq('id', authState.company.id)
            .select()
            .single();
        if (error) throw error;
        const mappedCompany = {
            ...data,
            subscription_end_date: data.settings?.subscription_end_date || data.subscription_end_date,
            subscription_expires_at: data.settings?.subscription_end_date || data.subscription_expires_at,
            subscription_status: data.status,
            trial_ends_at: data.settings?.subscription_end_date || data.settings?.trial_end_date || data.subscription_expires_at,
            max_employees: data.settings?.max_employees || 100,
            full_name: data.name,
            timezone: data.settings?.timezone || 'Asia/Riyadh'
        };
        setAuthState(prev => ({ ...prev, company: mappedCompany }));
        return mappedCompany;
    };

    const switchRole = (role) => {
        if (!['super_admin', 'reseller', 'org_admin', 'hr'].includes(role)) return;
        localStorage.setItem('active_role', role);
        setAuthState(prev => ({
            ...prev,
            activeRole: role,
            company: role === 'super_admin' ? null : prev.company
        }));
    };

    const switchCompany = (companyId) => {
        if (!authState.companies || authState.companies.length === 0) return;
        const selected = authState.companies.find(c => c.company.id === companyId);
        if (selected) {
            localStorage.setItem('active_company_id', companyId);
            setAuthState(prev => ({
                ...prev,
                company: selected.company,
                activeRole: selected.role,
                userPermissions: selected.permissions
            }));
            // Optionally, force a reload of the page or just let the state cascade
            // window.location.reload(); 
        }
    };

    const impersonateCompany = useCallback((companyData) => {
        if (!authState.isSuperAdmin) return;
        const mappedCompany = {
            ...companyData,
            subscription_end_date: companyData.settings?.subscription_end_date || companyData.subscription_end_date,
            subscription_expires_at: companyData.settings?.subscription_end_date || companyData.subscription_expires_at,
            subscription_status: companyData.status,
            trial_ends_at: companyData.settings?.subscription_end_date || companyData.settings?.trial_end_date || companyData.subscription_expires_at,
            max_employees: companyData.settings?.max_employees || 100,
            full_name: companyData.name,
            timezone: companyData.settings?.timezone || 'Asia/Riyadh'
        };
        setAuthState(prev => ({
            ...prev,
            company: mappedCompany,
            activeRole: 'org_admin'
        }));
    }, [authState.isSuperAdmin]);

    const hasPermission = useCallback((permission) => {
        if (authState.activeRole === 'org_admin' || authState.activeRole === 'super_admin') return true;
        if (authState.activeRole === 'hr' && authState.userPermissions) {
            return !!authState.userPermissions[permission];
        }
        return false;
    }, [authState.activeRole, authState.userPermissions]);

    const value = {
        ...authState,
        signIn,
        signUp,
        signOut,
        resetPassword,
        updatePassword,
        clearPasswordUpdate,
        refreshAuth,
        updateCompanySettings,
        switchRole,
        switchCompany,
        impersonateCompany,
        hasPermission,
        // Derived helpers
        userRole: authState.activeRole || (authState.isSuperAdmin ? 'super_admin' : authState.isReseller ? 'reseller' : 'org_admin'),
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}
