import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
    Mail, Lock, Building2, Globe, Search, Check,
    ArrowRight, ArrowLeft, Eye, EyeOff,
    Users, ClockIcon, CreditCard, ShieldCheck
} from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import { useLocale } from '../context/LocaleContext';
import { COUNTRIES } from '../utils/countries';
import { toast } from 'sonner';
import './Login.css';

const Login = () => {
    const navigate = useNavigate();
    const { signIn, signUp } = useAuth();
    const { t, language, toggleLanguage } = useLocale();

// -------------------------------------------------------------------------
    const [isLogin, setIsLogin] = useState(true);
    const [resetMode, setResetMode] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [companyName, setCompanyName] = useState('');
    const [selectedCountry, setSelectedCountry] = useState(COUNTRIES.find(c => c.code === 'SA'));

    const [loading, setLoading] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    const [showCountryList, setShowCountryList] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // OTP and Reset State
    const [verificationPending, setVerificationPending] = useState(false);
    const [verificationType, setVerificationType] = useState('signup'); // 'signup' | 'recovery' | 'set_password'
    const [otpCode, setOtpCode] = useState('');
    const [otpError, setOtpError] = useState(null);
    const [otpLoading, setOtpLoading] = useState(false);
    const [countdown, setCountdown] = useState(0);
    const [isInputFocused, setIsInputFocused] = useState(false);
    const [newPassword, setNewPassword] = useState('');
    const [confirmNewPassword, setConfirmNewPassword] = useState('');
    const [showNewPassword, setShowNewPassword] = useState(false);

    const countryRef = useRef(null);
    const otpInputRef = useRef(null);

    const isRtl = language === 'ar';

    useEffect(() => {
        if (countdown > 0) {
            const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [countdown]);

// -------------------------------------------------------------------------
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (countryRef.current && !countryRef.current.contains(event.target)) {
                setShowCountryList(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleOtpVerify = async (e) => {
        e.preventDefault();
        if (otpCode.length !== 6) {
            setOtpError(isRtl ? 'الرجاء إدخال الرمز المكون من 6 أرقام.' : 'Please enter the 6-digit code.');
            return;
        }

        setOtpLoading(true);
        setOtpError(null);

        try {
            if (verificationType === 'signup') {
                const { error } = await supabase.auth.verifyOtp({
                    email: email.trim(),
                    token: otpCode,
                    type: 'signup'
                });
                if (error) throw error;
                
                setSuccess(isRtl ? 'تم تفعيل حسابك بنجاح! جاري التوجيه...' : 'Account activated successfully! Redirecting...');
                setTimeout(() => {
                    navigate('/');
                }, 2000);
            } else if (verificationType === 'recovery') {
                const { error } = await supabase.auth.verifyOtp({
                    email: email.trim(),
                    token: otpCode,
                    type: 'recovery'
                });
                if (error) throw error;
                
                setVerificationType('set_password');
                setOtpCode('');
                setOtpError(null);
                setSuccess(null);
            }
        } catch (err) {
            setOtpError(err.message || (isRtl ? 'كود التحقق غير صحيح أو منتهي الصلاحية.' : 'Incorrect or expired verification code.'));
        } finally {
            setOtpLoading(false);
        }
    };

    const handlePasswordUpdate = async (e) => {
        e.preventDefault();
        if (newPassword.length < 6) {
            setOtpError(isRtl ? 'كلمة المرور يجب أن تكون 6 أحرف على الأقل.' : 'Password must be at least 6 characters.');
            return;
        }
        if (newPassword !== confirmNewPassword) {
            setOtpError(isRtl ? 'كلمتا المرور غير متطابقتين.' : 'Passwords do not match.');
            return;
        }

        setOtpLoading(true);
        setOtpError(null);

        try {
            const { error } = await supabase.auth.updateUser({ password: newPassword });
            if (error) throw error;

            setSuccess(isRtl ? 'تم تحديث كلمة المرور بنجاح! جاري الدخول...' : 'Password updated successfully! Logging in...');
            setTimeout(() => {
                navigate('/');
            }, 2000);
        } catch (err) {
            setOtpError(err.message || (isRtl ? 'حدث خطأ أثناء تحديث كلمة المرور.' : 'An error occurred while updating the password.'));
        } finally {
            setOtpLoading(false);
        }
    };

    const handleResendOtp = async () => {
        if (countdown > 0) return;
        setOtpLoading(true);
        setOtpError(null);
        try {
            if (verificationType === 'signup') {
                const { error } = await supabase.auth.resend({
                    type: 'signup',
                    email: email.trim()
                });
                if (error) throw error;
                toast.success(isRtl ? 'تم إعادة إرسال رمز التحقق إلى بريدك الإلكتروني.' : 'Verification code resent to your email.');
            } else if (verificationType === 'recovery') {
                const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
                    redirectTo: window.location.origin + '/reset-password',
                });
                if (error) throw error;
                toast.success(isRtl ? 'تم إعادة إرسال رمز استعادة كلمة المرور.' : 'Password recovery code resent.');
            }
            setCountdown(60);
        } catch (err) {
            let msg = err.message || '';
            if (msg.toLowerCase().includes('security') || msg.toLowerCase().includes('rate limit') || msg.toLowerCase().includes('too many') || msg.toLowerCase().includes('seconds')) {
                msg = isRtl 
                    ? 'لحماية حسابك، يرجى الانتظار دقيقة واحدة على الأقل قبل طلب إعادة إرسال رمز جديد.'
                    : 'For security purposes, please wait at least 1 minute before requesting a new code.';
            } else {
                msg = msg || (isRtl ? 'فشل في إعادة إرسال الرمز.' : 'Failed to resend the code.');
            }
            setOtpError(msg);
        } finally {
            setOtpLoading(false);
        }
    };

    const handleAuth = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setSuccess(null);

        try {
            if (resetMode) {
                if (!email.trim()) throw new Error(isRtl ? 'الرجاء إدخال البريد الإلكتروني' : 'Please enter your email');
                const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
                    redirectTo: window.location.origin + '/reset-password',
                });
                if (error) throw error;
                
                // Transition to OTP recovery screen!
                setVerificationType('recovery');
                setVerificationPending(true);
                setOtpCode('');
                setCountdown(60);
                setSuccess(isRtl ? 'تم إرسال رمز استعادة كلمة المرور إلى بريدك الإلكتروني.' : 'Password recovery code has been sent to your email.');
            } else if (isLogin) {
                await signIn(email, password, rememberMe);
                navigate('/');
            } else {
                if (!companyName.trim()) throw new Error(t.errorEmptyCompany);
                if (!selectedCountry) throw new Error(t.errorEmptyCountry);

                const data = await signUp(email, password, companyName, selectedCountry.code, rememberMe);
                if (!data.session) {
                    // Transition to OTP signup screen!
                    setVerificationType('signup');
                    setVerificationPending(true);
                    setOtpCode('');
                    setCountdown(60);
                    setSuccess(isRtl 
                        ? 'تم إنشاء الحساب بنجاح! يرجى إدخال رمز التحقق لتنشيط حسابك.' 
                        : 'Account created successfully! Please enter the verification code.');
                } else {
                    setSuccess(t.successAccountCreated);
                    setTimeout(() => navigate('/'), 2000);
                }
            }
        } catch (err) {
            setError(err.message === 'Invalid login credentials' ? t.errorInvalidLogin : err.message);
        } finally {
            setLoading(false);
        }
    };

    const filteredCountries = COUNTRIES.filter(c =>
        c.nameAr.includes(searchQuery) ||
        c.nameEn.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.code.toLowerCase().includes(searchQuery.toLowerCase())
    );

// -------------------------------------------------------------------------
    const featureCards = isRtl
        ? [
            {
                icon: <Users size={22} />,
                iconClass: 'primary-icon',
                borderClass: 'primary-border',
                title: 'إدارة شؤون الموظفين',
                desc: 'منصة متكاملة لإدارة الكادر الوظيفي، الرواتب، والامتثال للقوانين المحلية.',
                wide: false,
            },
            {
                icon: <ClockIcon size={22} />,
                iconClass: 'secondary-icon',
                borderClass: 'secondary-border',
                title: 'تتبع الحضور المباشر',
                desc: 'بيانات الحضور فورية عبر الأجهزة البيومترية والموبايل.',
                wide: false,
            },
            {
                icon: <CreditCard size={22} />,
                iconClass: 'tertiary-icon',
                borderClass: 'tertiary-border',
                title: 'نظام رواتب ذكي',
                desc: 'أتمتة الرواتب، السلف، والاستحقاقات مع دعم الضرائب المحلية لكل دولة.',
                wide: true,
                suffix: '💳',
            },
        ]
        : [
            {
                icon: <Users size={22} />,
                iconClass: 'primary-icon',
                borderClass: 'primary-border',
                title: 'Human Capital Engine',
                desc: 'Enterprise-grade platform for workforce, payroll, and local compliance.',
                wide: false,
            },
            {
                icon: <ClockIcon size={22} />,
                iconClass: 'secondary-icon',
                borderClass: 'secondary-border',
                title: 'Real-Time Attendance',
                desc: 'Live data via biometric devices and mobile check-ins.',
                wide: false,
            },
            {
                icon: <CreditCard size={22} />,
                iconClass: 'tertiary-icon',
                borderClass: 'tertiary-border',
                title: 'Smart Payroll',
                desc: 'Automate salaries, advances & benefits with local tax compliance.',
                wide: true,
                suffix: '💳',
            },
        ];

// -------------------------------------------------------------------------
    return (
        <div className={`login-page ${language}`} dir={isRtl ? 'rtl' : 'ltr'}>
            <div className="login-topnav">
                <span className="login-topnav-brand">KWADER</span>
                <div className="login-topnav-actions">
                    <button className="login-topnav-btn" onClick={toggleLanguage}>
                        {isRtl ? 'English' : 'العربية'}
                    </button>
                </div>
            </div>

            <div className="login-wrapper">
                <div className="login-form-panel">
                    <div className="login-form-inner">
                        {/* Auth Mode Toggle */}
                        {!verificationPending && (
                            <div className="auth-toggle-container">
                                <div className="auth-toggle">
                                    <button
                                        className={`auth-toggle-btn ${isLogin ? 'active' : ''}`}
                                        onClick={() => { setIsLogin(true); setError(null); setSuccess(null); }}
                                    >
                                        {isRtl ? 'تسجيل الدخول' : 'Sign In'}
                                    </button>
                                    <button
                                        className={`auth-toggle-btn ${!isLogin ? 'active' : ''}`}
                                        onClick={() => { setIsLogin(false); setError(null); setSuccess(null); }}
                                    >
                                        {isRtl ? 'إنشاء حساب' : 'Sign Up'}
                                    </button>
                                </div>
                            </div>
                        )}

                    <div className="form-container">
                        <div className="form-header">
                            <motion.h2 layoutId="auth-title" key={verificationPending ? `title-ver-${verificationType}` : (resetMode ? 'title-reset' : (isLogin ? 'title-login' : 'title-signup'))}>
                                {verificationPending ? (
                                    verificationType === 'signup' 
                                        ? (isRtl ? 'تأكيد حسابك' : 'Verify Your Account')
                                        : verificationType === 'recovery'
                                            ? (isRtl ? 'استعادة الحساب' : 'Account Recovery')
                                            : (isRtl ? 'تعيين كلمة المرور' : 'Set New Password')
                                ) : (
                                    resetMode ? (isRtl ? 'استعادة كلمة المرور' : 'Reset Password') : (isLogin ? t.welcomeBack : t.getStarted)
                                )}
                            </motion.h2>
                            <p>
                                {verificationPending ? (
                                    verificationType === 'signup'
                                        ? (isRtl ? 'أدخل رمز التحقق المكون من 6 أرقام لتنشيط حسابك' : 'Enter the 6-digit verification code to activate your account')
                                        : verificationType === 'recovery'
                                            ? (isRtl ? 'أدخل رمز التحقق المكون من 6 أرقام لتأمين جلسة استعادة كلمة المرور' : 'Enter the 6-digit code to secure your password recovery session')
                                            : (isRtl ? 'أنشئ كلمة مرور قوية وجديدة لحماية حسابك والوصول إليه' : 'Create a strong new password to protect and access your account')
                                ) : (
                                    resetMode ? (isRtl ? 'أدخل بريدك الإلكتروني وسنرسل لك رابطاً لإعادة التعيين' : 'Enter your email and we will send you a reset link') : (isLogin ? t.signInToManage : t.createNewAccount)
                                )}
                            </p>
                        </div>

                        <AnimatePresence mode="wait">
                            {verificationPending ? (
                                <motion.form
                                    key={verificationType}
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -8 }}
                                    transition={{ duration: 0.2 }}
                                    className="auth-form"
                                    onSubmit={verificationType === 'set_password' ? handlePasswordUpdate : handleOtpVerify}
                                >
                                    {otpError && (
                                        <motion.div
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto' }}
                                            className="alert alert-error"
                                        >
                                            {otpError}
                                        </motion.div>
                                    )}
                                    {success && (
                                        <motion.div
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto' }}
                                            className="alert alert-success"
                                        >
                                            {success}
                                        </motion.div>
                                    )}

                                    {verificationType === 'set_password' ? (
                                        // Set New Password Form
                                        <>
                                            <div className="form-field">
                                                <span className="form-field-label">
                                                    {isRtl ? 'كلمة المرور الجديدة' : 'New Password'}
                                                </span>
                                                <div className="input-group">
                                                    <Lock className="input-icon" />
                                                    <input
                                                        type={showNewPassword ? 'text' : 'password'}
                                                        placeholder="••••••••"
                                                        value={newPassword}
                                                        onChange={(e) => setNewPassword(e.target.value)}
                                                        required
                                                    />
                                                    <button
                                                        type="button"
                                                        className="password-toggle"
                                                        onClick={() => setShowNewPassword(!showNewPassword)}
                                                    >
                                                        {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="form-field">
                                                <span className="form-field-label">
                                                    {isRtl ? 'تأكيد كلمة المرور الجديدة' : 'Confirm New Password'}
                                                </span>
                                                <div className="input-group">
                                                    <Lock className="input-icon" />
                                                    <input
                                                        type={showNewPassword ? 'text' : 'password'}
                                                        placeholder="••••••••"
                                                        value={confirmNewPassword}
                                                        onChange={(e) => setConfirmNewPassword(e.target.value)}
                                                        required
                                                    />
                                                </div>
                                            </div>

                                            <button className="submit-btn" type="submit" disabled={otpLoading}>
                                                {otpLoading ? <div className="loader" /> : (
                                                    <>
                                                        <span>{isRtl ? 'حفظ وتحديث كلمة المرور' : 'Save & Update Password'}</span>
                                                        {isRtl ? <ArrowLeft size={16} /> : <ArrowRight size={16} />}
                                                    </>
                                                )}
                                            </button>
                                        </>
                                    ) : (
                                        // OTP Verification Form
                                        <>
                                            <div className="otp-instructions">
                                                <p>
                                                    {isRtl 
                                                        ? 'لقد أرسلنا رمز تحقق مكون من 6 أرقام إلى:'
                                                        : 'We sent a 6-digit verification code to:'}
                                                </p>
                                                <strong className="otp-email">{email}</strong>
                                                <p className="otp-tip">
                                                    {isRtl 
                                                        ? 'يرجى كتابة الرمز هنا لتأكيد الحساب.' 
                                                        : 'Please enter the code here to confirm your account.'}
                                                </p>
                                            </div>

                                            <div className="otp-container">
                                                <input
                                                    ref={otpInputRef}
                                                    type="text"
                                                    pattern="\d*"
                                                    maxLength="6"
                                                    value={otpCode}
                                                    onChange={(e) => {
                                                        const val = e.target.value.replace(/\D/g, '');
                                                        setOtpCode(val);
                                                    }}
                                                    onFocus={() => setIsInputFocused(true)}
                                                    onBlur={() => setIsInputFocused(false)}
                                                    className="otp-hidden-input"
                                                    autoFocus
                                                />
                                                <div 
                                                    className="otp-boxes-grid" 
                                                    onClick={() => otpInputRef.current?.focus()}
                                                >
                                                    {Array(6).fill('').map((_, index) => {
                                                        const char = otpCode[index] || '';
                                                        const isFocused = otpCode.length === index && isInputFocused;
                                                        return (
                                                            <div 
                                                                key={index} 
                                                                className={`otp-digit-box ${char ? 'has-char' : ''} ${isFocused ? 'focused' : ''}`}
                                                            >
                                                                {char}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>

                                            <button className="submit-btn" type="submit" disabled={otpLoading || otpCode.length !== 6}>
                                                {otpLoading ? <div className="loader" /> : (
                                                    <>
                                                        <span>{isRtl ? 'تحقق وتأكيد الرمز' : 'Verify & Confirm Code'}</span>
                                                        {isRtl ? <ArrowLeft size={16} /> : <ArrowRight size={16} />}
                                                    </>
                                                )}
                                            </button>

                                            <div className="otp-resend-wrapper">
                                                <span>{isRtl ? 'لم يصلك الرمز؟ ' : "Didn't get the code? "}</span>
                                                <button
                                                    type="button"
                                                    onClick={handleResendOtp}
                                                    disabled={countdown > 0 || otpLoading}
                                                    className="otp-resend-btn"
                                                >
                                                    {countdown > 0 
                                                        ? (isRtl ? `إعادة الإرسال خلال (${countdown}ث)` : `Resend in (${countdown}s)`)
                                                        : (isRtl ? 'إعادة إرسال الرمز' : 'Resend Code')
                                                    }
                                                </button>
                                            </div>

                                            <button 
                                                type="button" 
                                                className="otp-back-btn"
                                                onClick={() => {
                                                    setVerificationPending(false);
                                                    setOtpCode('');
                                                    setOtpError(null);
                                                    setSuccess(null);
                                                }}
                                            >
                                                {isRtl ? 'العودة للخلف' : 'Go Back'}
                                            </button>
                                        </>
                                    )}

                                    {/* Security Indicator */}
                                    <div className="security-badge">
                                        <ShieldCheck size={14} className="security-icon" strokeWidth={2.5} />
                                        <span>{isRtl ? 'تشفير AES-256 للبيانات البنكية' : 'Bank-grade AES-256 encryption'}</span>
                                    </div>
                                </motion.form>
                            ) : (
                                <motion.form
                                    key={resetMode ? 'reset' : (isLogin ? 'login' : 'register')}
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -8 }}
                                    transition={{ duration: 0.2 }}
                                    className="auth-form"
                                    onSubmit={handleAuth}
                                >
                                    {error && (
                                        <motion.div
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto' }}
                                            className="alert alert-error"
                                        >
                                            {error}
                                        </motion.div>
                                    )}
                                    {success && (
                                        <motion.div
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto' }}
                                            className="alert alert-success"
                                        >
                                            {success}
                                        </motion.div>
                                    )}

                                    {/* Company Name (signup only) */}
                                    {!isLogin && !resetMode && (
                                        <div className="form-field">
                                            <span className="form-field-label">
                                                {isRtl ? 'اسم الشركة' : 'Company Name'}
                                            </span>
                                            <div className="input-group">
                                                <Building2 className="input-icon" />
                                                <input
                                                    type="text"
                                                    placeholder={t.companyNamePlaceholder}
                                                    value={companyName}
                                                    onChange={(e) => setCompanyName(e.target.value)}
                                                    required={!isLogin && !resetMode}
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {/* Email */}
                                    <div className="form-field">
                                        <span className="form-field-label">
                                            {isRtl ? 'البريد الإلكتروني' : 'Email Address'}
                                        </span>
                                        <div className="input-group">
                                            <Mail className="input-icon" />
                                            <input
                                                type="email"
                                                placeholder={isRtl ? 'name@company.com' : 'name@company.com'}
                                                value={email}
                                                onChange={(e) => setEmail(e.target.value)}
                                                required
                                            />
                                        </div>
                                    </div>

                                    {/* Password */}
                                    {!resetMode && (
                                        <div className="form-field">
                                            <div className="form-field-header">
                                                <span className="form-field-label">
                                                    {isRtl ? 'كلمة المرور' : 'Password'}
                                                </span>
                                                {isLogin && (
                                                    <button type="button" className="forgot-link" onClick={() => { setResetMode(true); setError(null); setSuccess(null); }}>
                                                        {t.forgotPassword}
                                                    </button>
                                                )}
                                            </div>
                                            <div className="input-group">
                                                <Lock className="input-icon" />
                                                <input
                                                    type={showPassword ? 'text' : 'password'}
                                                    placeholder="••••••••"
                                                    value={password}
                                                    onChange={(e) => setPassword(e.target.value)}
                                                    required={!resetMode}
                                                />
                                                <button
                                                    type="button"
                                                    className="password-toggle"
                                                    onClick={() => setShowPassword(!showPassword)}
                                                >
                                                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {/* Country Selector (signup only) */}
                                    {!isLogin && !resetMode && (
                                        <div className="form-field" ref={countryRef}>
                                            <span className="form-field-label">
                                                {isRtl ? 'الدولة' : 'Country'}
                                            </span>
                                            <div
                                                className={`country-trigger ${showCountryList ? 'open' : ''}`}
                                                onClick={() => setShowCountryList(!showCountryList)}
                                            >
                                                <Globe className="input-icon" style={{ position: 'absolute' }} />
                                                <div className="country-label">
                                                    {selectedCountry ? (
                                                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                            <span>{selectedCountry.flag}</span>
                                                            <span>{isRtl ? selectedCountry.nameAr : selectedCountry.nameEn}</span>
                                                        </span>
                                                    ) : t.selectCountry}
                                                </div>
                                            </div>

                                            <AnimatePresence>
                                                {showCountryList && (
                                                    <motion.div
                                                        initial={{ opacity: 0, y: -8 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        exit={{ opacity: 0, y: -8 }}
                                                        className="country-dropdown"
                                                    >
                                                        <div className="search-bar">
                                                            <Search size={14} color="#777575" />
                                                            <input
                                                                placeholder={t.searching}
                                                                value={searchQuery}
                                                                onChange={(e) => setSearchQuery(e.target.value)}
                                                                autoFocus
                                                            />
                                                        </div>
                                                        <div className="options-list">
                                                            {filteredCountries.map(c => (
                                                                <div
                                                                    key={c.code}
                                                                    className={`option ${selectedCountry?.code === c.code ? 'active' : ''}`}
                                                                    onClick={() => { setSelectedCountry(c); setShowCountryList(false); }}
                                                                >
                                                                    <span>{c.flag}</span>
                                                                    <span>{isRtl ? c.nameAr : c.nameEn}</span>
                                                                    <Check className={`check-icon ${selectedCountry?.code === c.code ? 'show' : ''}`} />
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                    )}

                                    {/* Remember Me (hidden in reset mode) */}
                                    {!resetMode && (
                                        <div className="remember-me-container">
                                            <label className="checkbox-wrapper">
                                                <input
                                                    type="checkbox"
                                                    checked={rememberMe}
                                                    onChange={(e) => setRememberMe(e.target.checked)}
                                                />
                                                <span className="checkbox-custom"></span>
                                                <span className="checkbox-label">
                                                    {isRtl ? 'حفظ تسجيل الدخول' : 'Remember Me'}
                                                </span>
                                            </label>
                                        </div>
                                    )}

                                    {/* Submit */}
                                    <button className="submit-btn" type="submit" disabled={loading}>
                                        {loading ? <div className="loader" /> : (
                                            <>
                                                <span>
                                                    {resetMode
                                                        ? (isRtl ? 'إرسال رابط الاستعادة' : 'Send Reset Link')
                                                        : (isLogin ? t.signInBtn : t.createAccountBtn)
                                                    }
                                                </span>
                                                {isRtl ? <ArrowLeft size={16} /> : <ArrowRight size={16} />}
                                            </>
                                        )}
                                    </button>
                                    
                                    {/* Security Indicator */}
                                    <div className="security-badge">
                                        <ShieldCheck size={14} className="security-icon" strokeWidth={2.5} />
                                        <span>{isRtl ? 'تشفير AES-256 للبيانات البنكية' : 'Bank-grade AES-256 encryption'}</span>
                                    </div>
                                </motion.form>
                            )}
                        </AnimatePresence>

                        {!verificationPending && (
                            <div className="form-footer">
                                {resetMode ? (
                                    <p>
                                        {isRtl ? 'تذكرت كلمة المرور؟' : 'Remember your password?'}
                                        <button onClick={() => { setResetMode(false); setError(null); setSuccess(null); }}>
                                            {isRtl ? 'العودة لتسجيل الدخول' : 'Back to Sign In'}
                                        </button>
                                    </p>
                                ) : (
                                    <p>
                                        {isLogin ? t.noAccount : t.alreadyHaveAccount}
                                        <button onClick={() => { setIsLogin(!isLogin); setError(null); setSuccess(null); }}>
                                            {isLogin ? t.joinFree : t.logInLink}
                                        </button>
                                    </p>
                                )}
                            </div>
                        )}

                        <div className="legal-links-footer" style={{ marginTop: '24px', textAlign: 'center', fontSize: '12px', color: 'var(--text-muted)', display: 'flex', justifyContent: 'center', gap: '16px' }}>
                            <Link to="/privacy" style={{ color: 'inherit', textDecoration: 'none' }}>
                                {isRtl ? 'سياسة الخصوصية' : 'Privacy Policy'}
                            </Link>
                            <span style={{ opacity: 0.3 }}>|</span>
                            <Link to="/terms" style={{ color: 'inherit', textDecoration: 'none' }}>
                                {isRtl ? 'شروط الخدمة' : 'Terms of Service'}
                            </Link>
                        </div>
                    </div>
                </div>
                </div>

                <div className="login-visual-panel">
                    {/* Ambient orbs */}
                    <div className="visual-orb visual-orb-1" />
                    <div className="visual-orb visual-orb-2" />

                    <motion.div
                        className="visual-content"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.6 }}
                    >
                        {/* Logo */}
                        <div className="visual-logo-wrap">
                            <div className="visual-logo-glow" />
                            <div className="visual-logo">
                                <img src="/logo.png" alt="KWADER" />
                            </div>
                        </div>

                        {/* Feature Cards */}
                        <div className="visual-cards-grid">
                            {featureCards.map((card, i) => (
                                <motion.div
                                    key={i}
                                    className={`visual-card ${card.borderClass} ${card.wide ? 'wide' : ''}`}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.2 + i * 0.12 }}
                                >
                                    {card.wide ? (
                                        <div className="card-inner">
                                            <div>
                                                <div className={`visual-card-icon ${card.iconClass}`}>
                                                    {card.icon}
                                                </div>
                                                <h3>{card.title}</h3>
                                                <p>{card.desc}</p>
                                            </div>
                                            {card.suffix && (
                                                <div className="visual-card-suffix-icon">{card.suffix}</div>
                                            )}
                                        </div>
                                    ) : (
                                        <>
                                            <div className={`visual-card-icon ${card.iconClass}`}>
                                                {card.icon}
                                            </div>
                                            <h3>{card.title}</h3>
                                            <p>{card.desc}</p>
                                        </>
                                    )}
                                </motion.div>
                            ))}
                        </div>

                        {/* Trusted banner */}
                        <motion.div
                            className="visual-trusted"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 0.4 }}
                            transition={{ delay: 0.8 }}
                        >
                            <div className="visual-trusted-line" />
                            <span className="visual-trusted-text">
                                {isRtl ? 'موثوق من آلاف الشركات في المنطقة' : 'Trusted by thousands of companies'}
                            </span>
                            <div className="visual-trusted-line" />
                        </motion.div>
                    </motion.div>

                    <div className="login-footer">
                        <span>© 2025 KWADER. All rights reserved.</span>
                        <div className="login-footer-links">
                            <a href="/privacy">{isRtl ? 'الخصوصية' : 'Privacy'}</a>
                            <a href="/terms">{isRtl ? 'الشروط' : 'Terms'}</a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;