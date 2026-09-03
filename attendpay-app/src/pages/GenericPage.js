import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { useLocale } from '../context/LocaleContext';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Sparkles, Mail, CheckCircle2, ChevronRight, Zap } from 'lucide-react';

// Maps English routes to Arabic titles
const arTitles = {
    'cookie-policy': 'سياسة الكوكيز',
    'gdpr': 'الامتثال لقوانين GDPR',
    'security': 'الأمان',
    'integrations': 'التكاملات',
    'changelog': 'سجل التغييرات',
    'roadmap': 'خارطة الطريق',
    'startups': 'الشركات الناشئة',
    'smbs': 'الشركات الصغيرة',
    'enterprise': 'المؤسسات',
    'agencies': 'الوكالات',
    'remote-teams': 'الفرق عن بُعد',
    'multi-country': 'متعدد الدول',
    'documentation': 'التوثيق',
    'blog': 'المدونة',
    'hr-templates': 'قوالب HR',
    'webinars': 'ندوات الويب',
    'case-studies': 'دراسات الحالة',
    'api-reference': 'مرجع API',
    'press-kit': 'مجموعة الصحافة',
    'partners': 'الشركاء',
    'legal': 'القانونية'
};

const enTitles = {
    'cookie-policy': 'Cookie Policy',
    'gdpr': 'GDPR Compliance',
    'security': 'Security',
    'integrations': 'Integrations',
    'changelog': 'Changelog',
    'roadmap': 'Roadmap',
    'startups': 'Startups',
    'smbs': 'SMBs',
    'enterprise': 'Enterprise',
    'agencies': 'Agencies',
    'remote-teams': 'Remote Teams',
    'multi-country': 'Multi-country',
    'documentation': 'Documentation',
    'blog': 'Blog',
    'hr-templates': 'HR Templates',
    'webinars': 'Webinars',
    'case-studies': 'Case Studies',
    'api-reference': 'API Reference',
    'press-kit': 'Press Kit',
    'partners': 'Partners',
    'legal': 'Legal'
};

export default function GenericPage() {
    const { language } = useLocale();
    const isRtl = language === 'ar';
    const navigate = useNavigate();
    const location = useLocation();
    
    // Extract key from path e.g. "/cookie-policy" -> "cookie-policy"
    const pathKey = location.pathname.replace('/', '').toLowerCase();
    
    // Format titles
    const fallbackTitleEn = pathKey.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    const titleEn = enTitles[pathKey] || fallbackTitleEn;
    const titleAr = arTitles[pathKey] || fallbackTitleEn;
    
    const displayTitle = isRtl ? titleAr : titleEn;

    const [email, setEmail] = useState('');
    const [subscribed, setSubscribed] = useState(false);
    const containerRef = useRef(null);

    useEffect(() => {
        window.scrollTo(0, 0);
        if (containerRef.current) containerRef.current.scrollTop = 0;
    }, [location.pathname]);

    const handleSubscribe = (e) => {
        e.preventDefault();
        if(!email.trim()) return;
        setSubscribed(true);
        setTimeout(() => setSubscribed(false), 5000);
        setEmail('');
    }

    const isLegal = ['cookie-policy', 'gdpr', 'security', 'legal'].includes(pathKey);

    return (
        <div
            ref={containerRef}
            dir={isRtl ? 'rtl' : 'ltr'}
            style={{
                minHeight: '100vh',
                background: 'linear-gradient(180deg, #06080f 0%, #0a0d18 100%)',
                color: '#94a3b8',
                fontFamily: "'Inter', 'IBM Plex Sans', 'Cairo', system-ui, sans-serif",
                display: 'flex',
                flexDirection: 'column'
            }}
        >
            {/* ── Top Nav Bar ── */}
            <div style={{
                position: 'sticky', top: 0, zIndex: 50,
                background: 'rgba(6,8,15,0.85)',
                backdropFilter: 'blur(20px)',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
                padding: '0 24px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                height: '60px',
            }}>
                <button
                    onClick={() => navigate(-1)}
                    style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        color: '#94a3b8', cursor: 'pointer',
                        padding: '7px 16px', borderRadius: '8px',
                        fontSize: '13px', fontFamily: 'inherit',
                        transition: 'all 0.2s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.09)'; e.currentTarget.style.color = '#e2e8f0'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#94a3b8'; }}
                >
                    {isRtl ? <ArrowRight size={15} /> : <ArrowLeft size={15} />}
                    {isRtl ? 'رجوع' : 'Back'}
                </button>

                <div 
                    onClick={() => navigate('/')}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
                >
                    <div style={{
                        width: '24px', height: '24px', borderRadius: '6px',
                        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                        <span style={{ color: '#fff', fontSize: '10px', fontWeight: 800 }}>K</span>
                    </div>
                    <span style={{ color: '#f1f5f9', fontWeight: 700, fontSize: '14px' }}>KWADER</span>
                </div>

                <div style={{ display: 'flex', gap: '16px', fontSize: '12px' }}>
                    <Link to="/privacy" style={{ color: '#64748b', textDecoration: 'none', transition: 'color 0.2s' }}
                        onMouseEnter={e => e.currentTarget.style.color = '#c7d2fe'}
                        onMouseLeave={e => e.currentTarget.style.color = '#64748b'}
                    >{isRtl ? 'الخصوصية' : 'Privacy'}</Link>
                    <Link to="/terms" style={{ color: '#64748b', textDecoration: 'none', transition: 'color 0.2s' }}
                        onMouseEnter={e => e.currentTarget.style.color = '#c7d2fe'}
                        onMouseLeave={e => e.currentTarget.style.color = '#64748b'}
                    >{isRtl ? 'الشروط' : 'Terms'}</Link>
                </div>
            </div>

            {/* ── Main Content Area ── */}
            <main style={{
                flex: 1, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                padding: '60px 24px', textAlign: 'center',
                position: 'relative'
            }}>
                
                {/* Background effects */}
                <div style={{
                    position: 'absolute', top: '20%', left: '50%', transform: 'translate(-50%, -50%)',
                    width: '600px', height: '600px',
                    background: 'radial-gradient(circle, rgba(99,102,241,0.05) 0%, transparent 60%)',
                    pointerEvents: 'none',
                }} />

                <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    style={{
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px solid rgba(255,255,255,0.05)',
                        borderRadius: '24px',
                        padding: '48px 32px',
                        maxWidth: '560px',
                        width: '100%',
                        position: 'relative',
                        backdropFilter: 'blur(10px)',
                        boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
                    }}
                >
                    <div style={{
                        width: '56px', height: '56px', borderRadius: '16px',
                        background: 'linear-gradient(135deg, rgba(99,102,241,0.1), rgba(139,92,246,0.1))',
                        border: '1px solid rgba(99,102,241,0.2)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#a5b4fc', margin: '0 auto 24px',
                    }}>
                        <Sparkles size={28} />
                    </div>

                    <h1 style={{
                        fontSize: '32px', fontWeight: 800, color: '#f1f5f9',
                        margin: '0 0 16px', letterSpacing: '-0.5px'
                    }}>
                        {displayTitle}
                    </h1>

                    <p style={{
                        fontSize: '15px', lineHeight: '1.6', color: '#94a3b8',
                        margin: '0 0 32px', padding: '0 10px'
                    }}>
                        {isLegal 
                          ? (isRtl 
                              ? 'نقوم حالياً بتحديث وثائقنا القانونية وسياسات التوافق لتلبية أحدث المعايير العالمية. سننشر النسخة المحدثة قريباً جداً.' 
                              : 'We are currently updating our legal documentation and compliance policies to meet the latest global standards. The updated version will be published shortly.')
                          : (isRtl 
                              ? `نعمل بشغف على بناء صفحة "${displayTitle}". اشترك الآن لتكون أول من يعلم عند الإطلاق الحصري لهذا القسم!` 
                              : `We're passionately building the "${displayTitle}" experience. Subscribe now to be the first to know when it exclusively launches!`)
                        }
                    </p>

                    {/* Email Capture */}
                    <div style={{
                        background: 'rgba(0,0,0,0.2)',
                        padding: '24px', borderRadius: '16px',
                        border: '1px solid rgba(255,255,255,0.04)'
                    }}>
                        <h3 style={{ margin: '0 0 16px', fontSize: '14px', color: '#e2e8f0', fontWeight: 600 }}>
                            {isRtl ? 'انضم لقائمة الانتظار 🚀' : 'Join the waitlist 🚀'}
                        </h3>
                        
                        <form onSubmit={handleSubscribe} style={{ display: 'flex', gap: '8px', flexDirection: 'column', sm: {flexDirection: 'row'} }}>
                            {subscribed ? (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                        padding: '12px', borderRadius: '10px',
                                        background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)',
                                        color: '#10b981', fontSize: '14px', fontWeight: 600
                                    }}
                                >
                                    <CheckCircle2 size={18} />
                                    {isRtl ? 'تم تسجيلك بنجاح! شكراً لاهتمامك.' : 'You\'re on the list! Thank you for your interest.'}
                                </motion.div>
                            ) : (
                                <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                                    <div style={{ position: 'relative', flex: 1 }}>
                                        <Mail size={16} style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', left: isRtl ? 'auto' : '14px', right: isRtl ? '14px' : 'auto', color: '#64748b' }} />
                                        <input
                                            type="email"
                                            required
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            placeholder={isRtl ? 'بريدك الإلكتروني...' : 'Your email address...'}
                                            style={{
                                                width: '100%', padding: '12px 14px',
                                                paddingLeft: !isRtl ? '38px' : '14px',
                                                paddingRight: isRtl ? '38px' : '14px',
                                                background: 'rgba(255,255,255,0.04)',
                                                border: '1px solid rgba(255,255,255,0.1)',
                                                borderRadius: '10px', color: '#f1f5f9',
                                                fontSize: '14px', outline: 'none',
                                                transition: 'all 0.2s', fontFamily: 'inherit'
                                            }}
                                            onFocus={e => e.target.style.borderColor = 'rgba(99,102,241,0.5)'}
                                            onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                                        />
                                    </div>
                                    <button
                                        type="submit"
                                        style={{
                                            background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                                            color: '#fff', border: 'none', borderRadius: '10px',
                                            padding: '0 20px', fontSize: '14px', fontWeight: 600,
                                            cursor: 'pointer', transition: 'opacity 0.2s',
                                            display: 'flex', alignItems: 'center', gap: '6px',
                                            whiteSpace: 'nowrap', fontFamily: 'inherit'
                                        }}
                                        onMouseEnter={e => e.currentTarget.style.opacity = '0.9'}
                                        onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                                    >
                                        {isRtl ? 'إرسال' : 'Notify Me'}
                                        <Zap size={14} />
                                    </button>
                                </div>
                            )}
                        </form>
                        <p style={{ margin: '12px 0 0', fontSize: '12px', color: '#475569' }}>
                            {isRtl ? 'لا نرسل رسائل مزعجة (سبام) مطلقاً.' : 'We never send spam. Unsubscribe at any time.'}
                        </p>
                    </div>

                </motion.div>
            </main>

            {/* ── Footer ── */}
            <div style={{
                borderTop: '1px solid rgba(255,255,255,0.05)',
                padding: '32px 24px',
                textAlign: 'center',
                fontSize: '13px', color: '#334155',
            }}>
                <p style={{ margin: '0 0 12px' }}>
                    © {new Date().getFullYear()} Kwader, Inc. {isRtl ? 'جميع الحقوق محفوظة.' : 'All rights reserved.'}
                </p>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', flexWrap: 'wrap' }}>
                    {[
                        { label: isRtl ? 'الرئيسية' : 'Home', href: '/' },
                        { label: isRtl ? 'الخصوصية' : 'Privacy', href: '/privacy' },
                        { label: isRtl ? 'تواصل معنا' : 'Contact Us', href: '/contact' },
                    ].map(({ label, href }) => (
                        <Link key={label} to={href}
                            style={{ color: '#334155', textDecoration: 'none', transition: 'color 0.15s' }}
                            onMouseEnter={e => e.currentTarget.style.color = '#94a3b8'}
                            onMouseLeave={e => e.currentTarget.style.color = '#334155'}
                        >{label}</Link>
                    ))}
                </div>
            </div>
        </div>
    );
}
