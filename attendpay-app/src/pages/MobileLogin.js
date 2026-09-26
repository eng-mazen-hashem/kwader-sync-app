import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Fingerprint, Smartphone, ArrowRight, ArrowLeft, ShieldCheck, KeyRound, RotateCcw, Lock } from 'lucide-react';
import { FaWhatsapp } from 'react-icons/fa';
import { useEmployeeAuth } from '../context/EmployeeAuthContext';
import { useLocale } from '../context/LocaleContext';
import './MobileLogin.css';

const normalizeDigits = (str) => {
    if (!str) return '';
    return String(str)
        .replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
        .replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
};

const MobileLogin = () => {
    const { login, verifyOtp, resendOtp, employee, loading } = useEmployeeAuth();
    const { language } = useLocale();
    const navigate = useNavigate();

    const [step, setStep] = useState('credentials'); // 'credentials' | 'otp'
    const [phone, setPhone] = useState('');
    const [pin, setPin] = useState('');
    const [otp, setOtp] = useState('');
    const [otpInfo, setOtpInfo] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [countdown, setCountdown] = useState(60);
    const [canResend, setCanResend] = useState(false);

    const otpInputRef = useRef(null);

    useEffect(() => {
        if (!loading && employee) {
            navigate('/me');
        }
    }, [employee, loading, navigate]);

    // Timer effect for OTP countdown
    useEffect(() => {
        let timer;
        if (step === 'otp' && countdown > 0) {
            timer = setInterval(() => {
                setCountdown((prev) => {
                    if (prev <= 1) {
                        setCanResend(true);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }
        return () => clearInterval(timer);
    }, [step, countdown]);

    // Focus OTP input when transitioning to OTP step
    useEffect(() => {
        if (step === 'otp' && otpInputRef.current) {
            setTimeout(() => otpInputRef.current?.focus(), 150);
        }
    }, [step]);

    // Submit credentials (Step 1)
    const handleCredentialsSubmit = async (e) => {
        e.preventDefault();
        if (!phone || !pin) return;

        setIsSubmitting(true);
        const result = await login(phone, pin);
        setIsSubmitting(false);

        if (result?.requires_otp) {
            setOtpInfo(result);
            setStep('otp');
            setCountdown(60);
            setCanResend(false);
            setOtp('');
        } else if (result?.success) {
            navigate('/me');
        }
    };

    // Submit OTP verification (Step 2)
    const handleOtpSubmit = async (e) => {
        e.preventDefault();
        if (!otp || otp.length < 6) return;

        setIsSubmitting(true);
        const result = await verifyOtp(phone, pin, otp);
        setIsSubmitting(false);

        if (result?.success) {
            navigate('/me');
        }
    };

    // Resend OTP
    const handleResendOtp = async () => {
        if (!canResend || isSubmitting) return;

        setIsSubmitting(true);
        const result = await resendOtp(phone, pin);
        setIsSubmitting(false);

        if (result?.requires_otp) {
            setCountdown(60);
            setCanResend(false);
            setOtp('');
            if (otpInputRef.current) otpInputRef.current.focus();
        }
    };

    if (loading) return null;

    const isRtl = language === 'ar';

    return (
        <div className="emp-login-container" dir={isRtl ? 'rtl' : 'ltr'}>
            <div className="emp-login-glow" />

            <motion.div 
                className="emp-login-card"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35 }}
            >
                <AnimatePresence mode="wait">
                    {step === 'credentials' ? (
                        <motion.div
                            key="credentials-step"
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            transition={{ duration: 0.25 }}
                        >
                            <div className="emp-login-logo">
                                <div className="icon-wrapper">
                                    <Fingerprint size={32} />
                                </div>
                                <div>
                                    <h1>بوابة الموظف</h1>
                                    <p>تسجيل الدخول للخدمة الذاتية</p>
                                </div>
                            </div>

                            <form className="emp-login-form" onSubmit={handleCredentialsSubmit}>
                                <div>
                                    <label>رقم الهاتف</label>
                                    <div style={{ position: 'relative', marginTop: '0.5rem' }}>
                                        <Smartphone size={18} style={{ position: 'absolute', top: '14px', [isRtl ? 'right' : 'left']: '14px', color: '#64748b' }} />
                                        <input 
                                            type="tel" 
                                            className="emp-login-input" 
                                            placeholder="01XXXXXXXXX"
                                            value={phone}
                                            onChange={(e) => setPhone(normalizeDigits(e.target.value.trim()))}
                                            style={{ [isRtl ? 'paddingRight' : 'paddingLeft']: '40px' }}
                                            required
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label>رقم البصمة (PIN)</label>
                                    <div style={{ position: 'relative', marginTop: '0.5rem' }}>
                                        <KeyRound size={18} style={{ position: 'absolute', top: '14px', [isRtl ? 'right' : 'left']: '14px', color: '#64748b' }} />
                                        <input 
                                            type="password" 
                                            inputMode="numeric"
                                            pattern="[0-9]*"
                                            className="emp-login-input" 
                                            placeholder="****"
                                            value={pin}
                                            onChange={(e) => {
                                                const val = normalizeDigits(e.target.value).replace(/[^0-9]/g, '');
                                                setPin(val);
                                            }}
                                            style={{ [isRtl ? 'paddingRight' : 'paddingLeft']: '40px' }}
                                            required
                                        />
                                    </div>
                                </div>

                                <button 
                                    type="submit" 
                                    className="emp-login-btn"
                                    disabled={isSubmitting || !phone || !pin}
                                >
                                    {isSubmitting ? 'جاري التحقق...' : 'دخول'}
                                    {!isSubmitting && (isRtl ? <ArrowLeft size={18} /> : <ArrowRight size={18} />)}
                                </button>
                            </form>

                            <div className="emp-security-badge">
                                <Lock size={20} style={{ flexShrink: 0, color: '#818cf8' }} />
                                <span>نظام حماية الحسابات: يتم توثيق جهازك لأول مرة عبر رمز واتساب لمنع مشاركة الحسابات.</span>
                            </div>

                            <div style={{ textAlign: 'center', marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
                                <a 
                                    href="/login" 
                                    style={{ 
                                        color: '#94a3b8', 
                                        fontSize: '0.82rem', 
                                        textDecoration: 'none', 
                                        display: 'inline-flex', 
                                        alignItems: 'center', 
                                        gap: '6px',
                                        transition: 'color 0.2s'
                                    }}
                                >
                                    <span>{isRtl ? '← الدخول إلى لوحة إدارة النظام (HR / Admin)' : '← Go to HR / Admin Portal'}</span>
                                </a>
                            </div>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="otp-step"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.25 }}
                        >
                            <div className="emp-login-logo">
                                <div className="emp-otp-icon-wrapper">
                                    <FaWhatsapp size={36} />
                                </div>
                                <div>
                                    <h1>توثيق الدخول عبر واتساب</h1>
                                    <p>
                                        {otpInfo?.is_first_login 
                                            ? 'تسجيل دخول لأول مرة — يرجى تأكيد ملكية الحساب' 
                                            : 'تم رصد جهاز جديد — يرجى إدخال رمز التحقق'}
                                    </p>
                                </div>
                                {otpInfo?.masked_phone && (
                                    <div className="emp-otp-phone-badge">
                                        <FaWhatsapp size={14} />
                                        <span>تم الإرسال إلى {otpInfo.masked_phone}</span>
                                    </div>
                                )}
                            </div>

                            <form className="emp-login-form" onSubmit={handleOtpSubmit}>
                                <div>
                                    <label style={{ textAlign: 'center', display: 'block' }}>
                                        أدخل رمز التحقق (OTP) المكون من 6 أرقام
                                    </label>
                                    <div style={{ marginTop: '0.75rem' }}>
                                        <input 
                                            ref={otpInputRef}
                                            type="text" 
                                            inputMode="numeric"
                                            maxLength={6}
                                            pattern="[0-9]*"
                                            className="emp-otp-input" 
                                            placeholder="------"
                                            value={otp}
                                            onChange={(e) => {
                                                const val = normalizeDigits(e.target.value).replace(/[^0-9]/g, '').slice(0, 6);
                                                setOtp(val);
                                            }}
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="emp-otp-timer-box">
                                    <span>
                                        {countdown > 0 ? (
                                            <>إعادة الإرسال خلال: <strong>{countdown} ثانية</strong></>
                                        ) : (
                                            'لم يصلك الرمز؟'
                                        )}
                                    </span>
                                    <button 
                                        type="button" 
                                        className="emp-resend-btn"
                                        onClick={handleResendOtp}
                                        disabled={!canResend || isSubmitting}
                                    >
                                        <RotateCcw size={12} style={{ display: 'inline', marginInlineEnd: '4px' }} />
                                        إعادة إرسال الرمز
                                    </button>
                                </div>

                                <button 
                                    type="submit" 
                                    className="emp-login-btn"
                                    disabled={isSubmitting || otp.length < 6}
                                    style={{ background: 'linear-gradient(135deg, #25D366, #128C7E)' }}
                                >
                                    <ShieldCheck size={18} />
                                    {isSubmitting ? 'جاري التوثيق...' : 'تأكيد الدخول وتوثيق الجهاز'}
                                </button>

                                <button
                                    type="button"
                                    className="emp-back-btn"
                                    onClick={() => setStep('credentials')}
                                    disabled={isSubmitting}
                                >
                                    {isRtl ? <ArrowRight size={16} /> : <ArrowLeft size={16} />}
                                    تغيير رقم الهاتف أو رقم البصمة
                                </button>
                            </form>

                            <div className="emp-security-badge" style={{ borderColor: 'rgba(37, 211, 102, 0.3)', background: 'rgba(37, 211, 102, 0.06)' }}>
                                <ShieldCheck size={20} style={{ flexShrink: 0, color: '#25D366' }} />
                                <span style={{ color: '#86efac' }}>
                                    سيتم ربط هذا الجهاز بحسابك حصراً لمنع استخدام هاتفك لتسجيل الحضور لموظف آخر.
                                </span>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </div>
    );
};

export default MobileLogin;

