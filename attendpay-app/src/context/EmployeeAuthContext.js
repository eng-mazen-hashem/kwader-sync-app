import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { toast } from 'sonner';

const EmployeeAuthContext = createContext();

export function useEmployeeAuth() {
    return useContext(EmployeeAuthContext);
}

export const EmployeeAuthProvider = ({ children }) => {
    const [employee, setEmployee] = useState(null);
    const [loading, setLoading] = useState(true);

    const checkSession = useCallback(async () => {
        setLoading(true);
        try {
            const savedSession = localStorage.getItem('attendpay_employee_session');
            if (savedSession) {
                const sessionData = JSON.parse(savedSession);
                // Validate session with the backend using the RPC
                const { data, error } = await supabase.rpc('get_employee_portal_data', {
                    p_employee_id: sessionData.id,
                    p_pin: sessionData.pin
                });

                if (error || !data) {
                    console.error('Invalid employee session', error);
                    localStorage.removeItem('attendpay_employee_session');
                    setEmployee(null);
                } else {
                    // Inject the PIN so we can use it for subsequent RPC calls
                    setEmployee({ ...data, company_id: sessionData.company_id, pin: sessionData.pin });
                }
            }
        } catch (err) {
            console.error('Error checking employee session:', err);
            setEmployee(null);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        checkSession();
    }, [checkSession]);

    const login = async (phone, pin) => {
        try {
            const { data, error } = await supabase.rpc('employee_login', {
                p_phone: phone,
                p_pin: pin
            });

            if (error) {
                toast.error(error.message || 'بيانات الدخول غير صحيحة');
                return false;
            }

            if (data && data.success) {
                const sessionData = {
                    id: data.employee_id,
                    company_id: data.company_id,
                    name: data.name,
                    pin: pin // Storing the PIN locally as a basic token
                };
                
                localStorage.setItem('attendpay_employee_session', JSON.stringify(sessionData));
                
                // Fetch full data
                await checkSession();
                return true;
            }
        } catch (err) {
            console.error('Employee Login Error:', err);
            toast.error('حدث خطأ أثناء تسجيل الدخول');
            return false;
        }
    };

    const logout = () => {
        localStorage.removeItem('attendpay_employee_session');
        setEmployee(null);
    };

    const value = {
        employee,
        loading,
        login,
        logout,
        checkSession
    };

    return (
        <EmployeeAuthContext.Provider value={value}>
            {children}
        </EmployeeAuthContext.Provider>
    );
};
