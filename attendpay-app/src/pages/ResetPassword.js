import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Lock, Eye, EyeOff, ShieldCheck, Check, ArrowRight, ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLocale } from '../context/LocaleContext';
import './ResetPassword.css';

const ResetPassword = () => {
    const { updatePassword, user, loading: authLoading } = useAuth();
    const { language, toggleLanguage } = useLocale();
    const navigate = useNavigate();

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);

    const isRtl = language === 'ar';

    // Password strength evaluation
    const getPasswordStrength = () => {
        if (!password) return { score: 0, text: '', color: 'transparent' };
        let score = 0;
        if (password.length >= 6) score += 1;
        if (password.length >= 10) score += 1;
        if (/[A-Z]/.test(password)) score += 1;
        if (/[0-9]/.test(password)) score += 1;
        if (/[^A-Za-z0-9]/.test(password)) score += 1;

        if (score <= 1) return { score, text: isRtl ? 'ضعيفة' : 'Weak', color: '#ef4444' };
        if (score <= 3) return { score, text: isRtl ? 'متوسطة' : 'Medium', color: '#eab308' };
        return { score, text: isRtl ? 'قوية جداً' : 'Very Strong', color: '#22c55e' };
    };

    const strength = getPasswordStrength();

    useEffect(() => {
        // If auth loading is done and there's absolutely no user, and no hash token
        // we might want to redirect them to login after a short delay to allow hash processing.
        if (!authLoading && !user && !window.location.hash) {
            const timer = setTimeout(() => {
                setError(isRtl 
                    ? 'رابط إعادة تعيين كلمة المرور غير صالح أو منتهي الصلاحية.' 
                    : 'The password reset link is invalid or expired.');
            }, 1500);
            return () => clearTimeout(timer);
        }
    }, [authLoading, user, isRtl]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);

        if (password.length < 6) {
            setError(isRtl ? 'يجب أن تتكون كلمة المرور من 6 أحرف على الأقل.' : 'Password must be at least 6 characters.');
            return;
        }

        if (password !== confirmPassword) {
            setError(isRtl ? 'كلمتا المرور غير متطابقتين.' : 'Passwords do not match.');
            return;
        }

        setLoading(true);
        try {
            await updatePassword(password);
            setSuccess(true);
            
            // Redirect after 3 seconds
            setTimeout(() => {
                navigate('/');
            }, 3000);
        } catch (err) {
            setError(err.message || (isRtl ? 'حدث خطأ أثناء تحديث كلمة المرور.' : 'An error occurred while updating the password.'));
        } finally {
            setLoading(false);
        }
    };

    if (authLoading && !user) {
        return (
            <div className="reset-loading-screen">
                <div className="spinner" />
                <p>{isRtl ? 'جاري التحقق من الجلسة الآمنة...' : 'Verifying secure session...'}</p>
            </div>
        );
    }

    return (
        <div className={`reset-page ${language}`} dir={isRtl ? 'rtl' : 'ltr'}>
            {/* Top Navigation */}
            <div className="reset-topnav">
                <span className="reset-topnav-brand">KWADER</span>
                <button className="reset-topnav-btn" onClick={toggleLanguage}>
                    {isRtl ? 'English' : 'العربية'}
                </button>
            </div>

            <div className="reset-wrapper">
                {/* Background ambient lights */}
                <div className="reset-orb reset-orb-1" />
                <div className="reset-orb reset-orb-2" />

                <motion.div 
                    className="reset-card shadow-2xl"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                >
                    <div className="reset-logo-wrap">
                        <img src="/logo.png" alt="KWADER" className="reset-logo" />
                    </div>

                    <AnimatePresence mode="wait">
                        {!success ? (
                            <motion.div
                                key="form"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                            >
                                <div className="reset-header">
                                    <h2>{isRtl ? 'تعيين كلمة المرور الجديدة' : 'Set New Password'}</h2>
                                    <p>
                                        {isRtl 
                                            ? 'الرجاء إدخال كلمة المرور الجديدة الخاصة بك لتأمين حسابك والوصول إليه.' 
                                            : 'Please enter your new password to secure and access your account.'}
                                    </p>
                                </div>

                                <form onSubmit={handleSubmit} className="reset-form">
                                    {error && (
                                        <div className="alert alert-error">
                                            {error}
                                        </div>
                                    )}

                                    {/* Password */}
                                    <div className="form-field">
                                        <span className="form-field-label">
                                            {isRtl ? 'كلمة المرور الجديدة' : 'New Password'}
                                        </span>
                                        <div className="input-group">
                                            <Lock className="input-icon" />
                                            <input
                                                type={showPassword ? 'text' : 'password'}
                                                placeholder="••••••••"
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value)}
                                                required
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

                                    {/* Password Strength Indicator */}
                                    {password && (
                                        <div className="strength-container">
                                            <div className="strength-bar-bg">
                                                <div 
                                                    className="strength-bar-fill" 
                                                    style={{ 
                                                        width: `${(strength.score / 5) * 100}%`,
                                                        backgroundColor: strength.color 
                                                    }}
                                                />
                                            </div>
                                            <span className="strength-text" style={{ color: strength.color }}>
                                                {isRtl ? 'قوة كلمة المرور: ' : 'Strength: '}
                                                <strong>{strength.text}</strong>
                                            </span>
                                        </div>
                                    )}

                                    {/* Confirm Password */}
                                    <div className="form-field">
                                        <span className="form-field-label">
                                            {isRtl ? 'تأكيد كلمة المرور الجديدة' : 'Confirm New Password'}
                                        </span>
                                        <div className="input-group">
                                            <Lock className="input-icon" />
                                            <input
                                                type={showConfirmPassword ? 'text' : 'password'}
                                                placeholder="••••••••"
                                                value={confirmPassword}
                                                onChange={(e) => setConfirmPassword(e.target.value)}
                                                required
                                            />
                                            <button
                                                type="button"
                                                className="password-toggle"
                                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                            >
                                                {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Submit Button */}
                                    <button className="submit-btn" type="submit" disabled={loading || (!user && !window.location.hash)}>
                                        {loading ? <div className="loader" /> : (
                                            <>
                                                <span>{isRtl ? 'تحديث وفتح لوحة التحكم' : 'Update & Open Dashboard'}</span>
                                                {isRtl ? <ArrowLeft size={16} /> : <ArrowRight size={16} />}
                                            </>
                                        )}
                                    </button>
                                </form>
                            </motion.div>
                        ) : (
                            <motion.div
                                key="success"
                                className="reset-success-view"
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ type: 'spring', damping: 15 }}
                            >
                                <div className="success-icon-wrapper">
                                    <Check size={40} className="success-icon" />
                                </div>
                                <h2>{isRtl ? 'تم تغيير كلمة المرور بنجاح!' : 'Password Changed Successfully!'}</h2>
                                <p>
                                    {isRtl 
                                        ? 'تم تأمين حسابك بكلمة المرور الجديدة. جاري توجيهك إلى لوحة التحكم الآن...' 
                                        : 'Your account has been secured. Redirecting you to the dashboard now...'}
                                </p>
                                <div className="progress-bar-redirect">
                                    <div className="progress-fill" />
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Security Badge */}
                    <div className="security-badge" style={{ marginTop: '24px' }}>
                        <ShieldCheck size={14} className="security-icon" strokeWidth={2.5} />
                        <span>{isRtl ? 'تشفير AES-256 للبيانات البنكية' : 'Bank-grade AES-256 encryption'}</span>
                    </div>
                </motion.div>
            </div>
        </div>
    );
};

export default ResetPassword;
