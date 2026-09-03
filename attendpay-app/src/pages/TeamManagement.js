import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import { useLocale } from '../context/LocaleContext';
import { supabase } from '../supabaseClient';
import { logAudit } from '../utils/auditLogger';
import InviteSubUserModal from '../components/admin/InviteSubUserModal';

// ─── Inline Confirmation Modal (replaces window.confirm — constitution §9) ───
function ConfirmModal({ isOpen, message, onConfirm, onCancel, danger = true }) {
    const { t, language } = useLocale();
    if (!isOpen) return null;
    return (
        <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 9999, backdropFilter: 'blur(4px)'
        }}>
            <div style={{
                background: 'var(--bg-card, #1A1A24)', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 16, padding: 28, maxWidth: 380, width: '90%',
                boxShadow: '0 24px 64px rgba(0,0,0,0.5)'
            }}>
                <p style={{
                    color: 'var(--text-primary, #fff)',
                    fontSize: '1rem',
                    marginBottom: 24,
                    lineHeight: 1.6,
                    textAlign: language === 'en' ? 'left' : 'right',
                    direction: language === 'en' ? 'ltr' : 'rtl'
                }}>
                    {message}
                </p>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', direction: language === 'en' ? 'ltr' : 'rtl' }}>
                    <button
                        onClick={onCancel}
                        style={{ padding: '8px 20px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: 'var(--text-muted, #94a3b8)', cursor: 'pointer' }}
                    >
                        {t.cancelBtn || 'إلغاء'}
                    </button>
                    <button
                        onClick={onConfirm}
                        style={{
                            padding: '8px 20px', borderRadius: 8, border: 'none', cursor: 'pointer',
                            background: danger ? 'linear-gradient(135deg, #ef4444, #dc2626)' : 'linear-gradient(135deg, #3b82f6, #2563eb)',
                            color: '#fff', fontWeight: 600
                        }}
                    >
                        {t.confirmBtn || 'تأكيد'}
                    </button>
                </div>
            </div>
        </div>
    );
}

const TeamManagement = () => {
    const { company, activeRole, user } = useAuth();
    const { t, language } = useLocale();
    const [users, setUsers]   = useState([]);
    const [invites, setInvites] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Confirmation modal state (replaces window.confirm)
    const [confirmState, setConfirmState] = useState({ open: false, message: '', onConfirm: null });

    // ── fetchTeamData wrapped in useCallback to fix react-hooks/exhaustive-deps ──
    const fetchTeamData = useCallback(async () => {
        if (!company) return;
        setLoading(true);
        try {
            // Fetch users via RPC
            const { data: usersData, error: usersError } = await supabase
                .rpc('get_company_team', { c_id: company.id });

            if (!usersError && usersData) {
                const formattedUsers = usersData.map(u => ({
                    id: u.id,
                    role: u.role,
                    permissions: u.permissions,
                    created_at: u.created_at,
                    users: {
                        email: u.email,
                        raw_user_meta_data: { full_name: u.full_name }
                    }
                }));
                setUsers(formattedUsers);
            } else if (usersError) {
                console.error('[TeamManagement] fetchTeamData users:', usersError.message);
            }

            // Fetch invites — explicit columns only (constitution §7.2)
            const { data: invitesData, error: invitesError } = await supabase
                .from('company_invites')
                .select('id, email, token, created_at, company_id')
                .eq('company_id', company.id);

            if (!invitesError && invitesData) {
                setInvites(invitesData);
            } else if (invitesError) {
                console.error('[TeamManagement] fetchTeamData invites:', invitesError.message);
            }
        } catch (err) {
            console.error('[TeamManagement] fetchTeamData:', err.message);
            toast.error(t.errFetchTeamFailed || 'فشل تحميل بيانات الفريق');
        } finally {
            setLoading(false);
        }
    }, [company, t]);

    // Fix: include fetchTeamData in dependency array — now safe because it's memoized
    useEffect(() => {
        fetchTeamData();
    }, [fetchTeamData]);

    // ── Delete Invite ────────────────────────────────────────────────────────
    const handleDeleteInvite = useCallback((id) => {
        setConfirmState({
            open: true,
            message: t.confirmCancelInvite || 'هل تريد إلغاء هذه الدعوة؟',
            onConfirm: async () => {
                setConfirmState(s => ({ ...s, open: false }));
                try {
                    const { error } = await supabase.from('company_invites').delete().eq('id', id);
                    if (error) throw error;
                    setInvites(prev => prev.filter(inv => inv.id !== id));
                    toast.success(t.msgInviteCancelled || 'تم إلغاء الدعوة بنجاح');
                    await logAudit({ company_id: company.id, user_id: user?.id, action: 'DELETE_INVITE', table_name: 'company_invites', record_id: id });
                } catch (err) {
                    console.error('[TeamManagement] handleDeleteInvite:', err.message);
                    toast.error(t.errCancelInvite || 'فشل إلغاء الدعوة');
                }
            }
        });
    }, [t, company, user]);

    // ── Delete User ──────────────────────────────────────────────────────────
    const handleDeleteUser = useCallback((id) => {
        setConfirmState({
            open: true,
            message: t.confirmRemoveUser || 'هل تريد إزالة هذا المستخدم من الفريق؟',
            onConfirm: async () => {
                setConfirmState(s => ({ ...s, open: false }));
                try {
                    const { error } = await supabase.from('company_users').delete().eq('id', id);
                    if (error) throw error;
                    setUsers(prev => prev.filter(u => u.id !== id));
                    toast.success(t.msgUserRemoved || 'تم إزالة المستخدم بنجاح');
                    await logAudit({ company_id: company.id, user_id: user?.id, action: 'REMOVE_TEAM_USER', table_name: 'company_users', record_id: id });
                } catch (err) {
                    console.error('[TeamManagement] handleDeleteUser:', err.message);
                    toast.error(t.errRemoveUser || 'فشل إزالة المستخدم');
                }
            }
        });
    }, [t, company, user]);

    // ── Copy Invite Link ─────────────────────────────────────────────────────
    const handleCopyLink = useCallback((token) => {
        navigator.clipboard.writeText(`${window.location.origin}/invite?token=${token}`);
        // constitution §9: use toast, not alert()
        toast.success(t.linkCopied || 'تم نسخ الرابط');
    }, [t]);

    // ── Access Guard ─────────────────────────────────────────────────────────
    if (activeRole !== 'org_admin') {
        return (
            <div className="flex h-full items-center justify-center p-8">
                <div className="text-center bg-red-500/10 text-red-500 p-8 rounded-2xl border border-red-500/20 backdrop-blur-md">
                    <h2 className="text-2xl font-bold mb-2">{t.unauthorizedAccess}</h2>
                    <p>{t.unauthorizedDesc}</p>
                </div>
            </div>
        );
    }

    return (
        <div className={`p-6 md:p-10 space-y-8 animate-fadeIn ${language === 'en' ? 'en' : 'ar'}`} dir={language === 'en' ? 'ltr' : 'rtl'}>

            {/* ── Confirmation Modal (replaces window.confirm) ── */}
            <ConfirmModal
                isOpen={confirmState.open}
                message={confirmState.message}
                onConfirm={confirmState.onConfirm}
                onCancel={() => setConfirmState(s => ({ ...s, open: false }))}
            />

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-emerald-400 drop-shadow-sm">
                        {t.teamMgmtTitle}
                    </h1>
                    <p className="text-slate-400 mt-1">{t.teamMgmtSubtitle}</p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-6 py-3 rounded-xl shadow-lg shadow-blue-500/25 transition-all duration-300 transform hover:-translate-y-1"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    {t.addNewMember}
                </button>
            </div>

            {loading ? (
                <div className="flex justify-center py-20">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                    {/* Active Users */}
                    <div className="bg-[#1A1A24] border border-slate-700/50 rounded-2xl p-6 shadow-xl backdrop-blur-sm">
                        <div className="flex items-center gap-3 mb-6 border-b border-slate-700 pb-4">
                            <div className="p-3 bg-emerald-500/10 rounded-lg text-emerald-400">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                            </div>
                            <h2 className="text-xl font-bold text-white">{t.currentHrTeam}</h2>
                        </div>

                        <div className="space-y-4">
                            {users.length === 0 ? (
                                <p className="text-slate-500 text-center py-8">{t.noTeamMembers}</p>
                            ) : (
                                users.map(userItem => (
                                    <div key={userItem.id} className="flex flex-col sm:flex-row items-center justify-between p-4 bg-slate-800/40 rounded-xl border border-slate-700/50 hover:border-slate-600 transition-colors gap-4">
                                        <div className="flex items-center gap-4 w-full sm:w-auto">
                                            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-lg">
                                                {userItem.users?.email?.charAt(0).toUpperCase() || 'U'}
                                            </div>
                                            <div>
                                                <h3 className="text-white font-medium">{userItem.users?.email}</h3>
                                                <p className="text-xs text-slate-400 capitalize">{userItem.role}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between w-full sm:w-auto gap-4">
                                            <div className="flex gap-1 flex-wrap justify-end">
                                                {Object.entries(userItem.permissions || {}).filter(([, v]) => v).map(([k]) => (
                                                    <span key={k} className="text-[10px] px-2 py-1 bg-blue-500/20 text-blue-300 rounded-md border border-blue-500/30">
                                                        {k.replace('manage_', '')}
                                                    </span>
                                                ))}
                                            </div>
                                            <button
                                                onClick={() => handleDeleteUser(userItem.id)}
                                                className="text-red-400 hover:text-red-300 hover:bg-red-400/10 p-2 rounded-lg transition-colors"
                                                aria-label={t.deleteBtn || 'إزالة المستخدم'}
                                            >
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Pending Invites */}
                    <div className="bg-[#1A1A24] border border-slate-700/50 rounded-2xl p-6 shadow-xl backdrop-blur-sm">
                        <div className="flex items-center gap-3 mb-6 border-b border-slate-700 pb-4">
                            <div className="p-3 bg-amber-500/10 rounded-lg text-amber-400">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                            </div>
                            <h2 className="text-xl font-bold text-white">{t.pendingInvites}</h2>
                        </div>

                        <div className="space-y-4">
                            {invites.length === 0 ? (
                                <p className="text-slate-500 text-center py-8">{t.noPendingInvites}</p>
                            ) : (
                                invites.map(invite => (
                                    <div key={invite.id} className="p-4 bg-slate-800/40 rounded-xl border border-slate-700/50 flex flex-col gap-3">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-slate-300">
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                </div>
                                                <span className="text-white font-medium">{invite.email}</span>
                                            </div>
                                            <button
                                                onClick={() => handleDeleteInvite(invite.id)}
                                                className="text-red-400 hover:text-red-300"
                                                aria-label={t.cancelBtn || 'إلغاء الدعوة'}
                                            >
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                            </button>
                                        </div>
                                        <div className="flex justify-between items-center bg-slate-900/50 p-2 rounded-lg border border-slate-700/50">
                                            <span className="text-xs text-slate-400 break-all truncate pl-2">
                                                {window.location.origin}/invite?token={invite.token}
                                            </span>
                                            <button
                                                onClick={() => handleCopyLink(invite.token)}
                                                className="text-xs bg-indigo-500/20 text-indigo-300 px-3 py-1.5 rounded-md hover:bg-indigo-500/30 transition-colors whitespace-nowrap"
                                            >
                                                {t.copyLink}
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                </div>
            )}

            {isModalOpen && (
                <InviteSubUserModal
                    onClose={() => setIsModalOpen(false)}
                    onInviteSent={() => {
                        setIsModalOpen(false);
                        fetchTeamData();
                    }}
                />
            )}
        </div>
    );
};

export default TeamManagement;
