import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Fingerprint, Smartphone, ArrowRight } from 'lucide-react';
import { useEmployeeAuth } from '../context/EmployeeAuthContext';
import { useLocale } from '../context/LocaleContext';
import './MobileLogin.css';

const MobileLogin = () => {
    const { login, employee, loading } = useEmployeeAuth();
    const { language } = useLocale();
    const navigate = useNavigate();

    const [phone, setPhone] = useState('');
    const [pin, setPin] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (!loading && employee) {
            navigate('/me');
        }
    }, [employee, loading, navigate]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!phone || !pin) return;
        
        setIsSubmitting(true);
        const success = await login(phone, pin);
        setIsSubmitting(false);

        if (success) {
            navigate('/me');
        }
    };

    if (loading) return null;

    return (
        <div className="emp-login-container" dir={language === 'ar' ? 'rtl' : 'ltr'}>
            <div className="emp-login-glow" />
            
            <motion.div 
                className="emp-login-card"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
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

                <form className="emp-login-form" onSubmit={handleSubmit}>
                    <div>
                        <label>رقم الهاتف</label>
                        <div style={{ position: 'relative', marginTop: '0.5rem' }}>
                            <Smartphone size={18} style={{ position: 'absolute', top: '14px', left: '14px', color: '#64748b' }} />
                            <input 
                                type="tel" 
                                className="emp-login-input" 
                                placeholder="05XXXXXXXX"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                style={{ paddingLeft: '40px' }}
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <label>رقم البصمة (PIN)</label>
                        <div style={{ position: 'relative', marginTop: '0.5rem' }}>
                            <Fingerprint size={18} style={{ position: 'absolute', top: '14px', left: '14px', color: '#64748b' }} />
                            <input 
                                type="password" 
                                inputMode="numeric"
                                pattern="[0-9]*"
                                className="emp-login-input" 
                                placeholder="****"
                                value={pin}
                                onChange={(e) => {
                                    const val = e.target.value.replace(/[^0-9]/g, '');
                                    setPin(val);
                                }}
                                style={{ paddingLeft: '40px' }}
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
                        {!isSubmitting && <ArrowRight size={18} />}
                    </button>
                </form>
            </motion.div>
        </div>
    );
};

export default MobileLogin;
