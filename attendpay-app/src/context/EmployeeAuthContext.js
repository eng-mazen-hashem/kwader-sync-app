import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { toast } from 'sonner';

const EmployeeAuthContext = createContext();

export function useEmployeeAuth() {
    return useContext(EmployeeAuthContext);
}

export function getOrCreateDeviceId() {
    let id = localStorage.getItem('attendpay_device_id');
    if (!id) {
        id = 'dev_' + (window.crypto?.randomUUID ? window.crypto.randomUUID() : Math.random().toString(36).substring(2) + Date.now().toString(36));
        localStorage.setItem('attendpay_device_id', id);
    }
    return id;
}

export function getDeviceName() {
    const ua = navigator.userAgent || '';
    let os = 'جهاز';
    let browser = 'متصفح';

    if (/iPhone/i.test(ua)) os = 'iPhone';
    else if (/iPad/i.test(ua)) os = 'iPad';
    else if (/Android/i.test(ua)) os = 'Android';
    else if (/Windows/i.test(ua)) os = 'Windows';
    else if (/Macintosh|Mac OS/i.test(ua)) os = 'Mac';

    if (/Chrome/i.test(ua) && !/Edg/i.test(ua)) browser = 'Chrome';
    else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) browser = 'Safari';
    else if (/Firefox/i.test(ua)) browser = 'Firefox';
    else if (/Edg/i.test(ua)) browser = 'Edge';

    return `${os} (${browser})`;
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
                const deviceId = getOrCreateDeviceId();
                // Validate session and device authorization with backend RPC
                let { data, error } = await supabase.rpc('get_employee_portal_data', {
                    p_employee_id: sessionData.id,
                    p_pin: sessionData.pin,
                    p_device_id: deviceId
                });

                // Defensive fallback if function signature cache mismatch
                if (error && error.code === 'PGRST202') {
                    const fallback = await supabase.rpc('get_employee_portal_data', {
                        p_employee_id: sessionData.id,
                        p_pin: sessionData.pin
                    });
                    data = fallback.data;
                    error = fallback.error;
                }

                if (error || !data) {
                    console.error('Invalid employee session', error);
                    localStorage.removeItem('attendpay_employee_session');
                    setEmployee(null);
                    return false;
                } else {
                    // Inject the PIN so we can use it for subsequent RPC calls
                    setEmployee({ ...data, company_id: sessionData.company_id, pin: sessionData.pin });
                    return true;
                }
            }
            return false;
        } catch (err) {
            console.error('Error checking employee session:', err);
            setEmployee(null);
            return false;
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        checkSession();
    }, [checkSession]);

    const login = async (phone, pin) => {
        try {
            const deviceId = getOrCreateDeviceId();
            const deviceName = getDeviceName();

            const { data, error } = await supabase.rpc('employee_login', {
                p_phone: phone,
                p_pin: pin,
                p_device_id: deviceId,
                p_device_name: deviceName
            });

            if (error) {
                toast.error(error.message || 'بيانات الدخول غير صحيحة');
                return { success: false, error: error.message };
            }

            if (data?.requires_otp) {
                toast.info(data.message || 'تم إرسال رمز التحقق إلى واتساب الخاص بك');
                return {
                    success: false,
                    requires_otp: true,
                    masked_phone: data.masked_phone,
                    message: data.message,
                    is_first_login: data.is_first_login
                };
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
                const sessionOk = await checkSession();
                if (!sessionOk) {
                    toast.error('تعذر جلب بيانات الحساب بعد تسجيل الدخول');
                    return { success: false, error: 'Failed to verify employee session' };
                }
                return { success: true };
            }
            return { success: false };
        } catch (err) {
            console.error('Employee Login Error:', err);
            toast.error(err.message || 'حدث خطأ أثناء تسجيل الدخول');
            return { success: false, error: err.message };
        }
    };

    const verifyOtp = async (phone, pin, otp) => {
        try {
            const deviceId = getOrCreateDeviceId();
            const deviceName = getDeviceName();

            const { data, error } = await supabase.rpc('verify_employee_login_otp', {
                p_phone: phone,
                p_pin: pin,
                p_otp: otp,
                p_device_id: deviceId,
                p_device_name: deviceName
            });

            if (error) {
                toast.error(error.message || 'رمز التحقق غير صحيح');
                return { success: false, error: error.message };
            }

            if (data && data.success) {
                const sessionData = {
                    id: data.employee_id,
                    company_id: data.company_id,
                    name: data.name,
                    pin: pin
                };
                localStorage.setItem('attendpay_employee_session', JSON.stringify(sessionData));
                const sessionOk = await checkSession();
                if (!sessionOk) {
                    toast.error('تعذر جلب بيانات الحساب بعد التوثيق');
                    return { success: false, error: 'Failed to verify employee session' };
                }
                toast.success(data.message || 'تم توثيق الجهاز وتسجيل الدخول بنجاح');
                return { success: true };
            }
            return { success: false };
        } catch (err) {
            console.error('Verify OTP Error:', err);
            toast.error(err.message || 'حدث خطأ أثناء التحقق من الرمز');
            return { success: false, error: err.message };
        }
    };

    const resendOtp = async (phone, pin) => {
        return await login(phone, pin);
    };

    const logout = () => {
        localStorage.removeItem('attendpay_employee_session');
        setEmployee(null);
    };

    const value = {
        employee,
        loading,
        login,
        verifyOtp,
        resendOtp,
        logout,
        checkSession
    };

    return (
        <EmployeeAuthContext.Provider value={value}>
            {children}
        </EmployeeAuthContext.Provider>
    );
};
