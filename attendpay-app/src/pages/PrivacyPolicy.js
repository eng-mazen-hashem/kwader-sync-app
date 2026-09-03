import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { useLocale } from '../context/LocaleContext';
import {
    Shield, Lock, Eye, FileText, ArrowLeft, ArrowRight,
    Server, Users, Bell, CheckCircle2, ExternalLink, ChevronRight
} from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';

/* ─── Data ─────────────────────────────────────────────────────────────────── */
const SECTIONS = {
    ar: [
        {
            id: 'collection', icon: Users,
            title: 'البيانات التي نجمعها',
            content: [
                'نجمع فقط البيانات الضرورية لتشغيل منصة الموارد البشرية بكفاءة عالية:',
                '• أسماء الموظفين وبيانات التواصل (بريد إلكتروني، رقم هاتف)',
                '• سجلات الحضور والانصراف عبر أجهزة البيومترية أو الجوال',
                '• بيانات الموقع الجغرافي (فقط عند تفعيل ميزة التوقيع الذكي صراحةً)',
                '• الهيكل التنظيمي للشركة وتفاصيل الرواتب الأساسية',
                '• سجلات الاستخدام لتحسين أداء المنصة وتجربة المستخدم',
            ],
        },
        {
            id: 'usage', icon: Server,
            title: 'كيفية استخدامنا للبيانات',
            content: [
                'تُستخدم بياناتك وبيانات موظفيك حصرياً للأغراض التالية:',
                '• أتمتة كشوف الرواتب وحساب الاستحقاقات والخصومات',
                '• متابعة الانضباط الوظيفي وتقارير الحضور والغياب',
                '• توليد التقارير الإدارية والتحليلات الخاصة بمنشأتك',
                '• إرسال الإشعارات والتنبيهات المرتبطة بعمليات الموارد البشرية',
                'نحن لا نقوم ببيع أو مشاركة أو تأجير هذه البيانات لأي أطراف ثالثة لأغراض إعلانية أو تسويقية تحت أي ظرف كان.',
            ],
        },
        {
            id: 'security', icon: Lock,
            title: 'أمن البيانات والتشفير',
            content: [
                'نطبّق أعلى معايير الأمان الصناعية لحماية بياناتك:',
                '• تشفير AES-256 لجميع البيانات في وضع السكون (at rest)',
                '• بروتوكول TLS 1.3 لتشفير جميع البيانات أثناء النقل (in transit)',
                '• فصل كامل لبيانات كل مؤسسة في بيئة معزولة تمنع أي تداخل',
                '• مصادقة ثنائية العوامل (2FA) لحسابات المدراء',
                '• مراجعات أمنية دورية وتقييمات المخاطر كل ربع سنة',
                'نحن حاصلون على شهادات SOC 2 Type II و ISO 27001 ومتوافقون مع معيار GDPR الأوروبي.',
            ],
        },
        {
            id: 'access', icon: Eye,
            title: 'من يمكنه الوصول لبياناتك؟',
            content: [
                'الوصول إلى البيانات مبني على مبدأ الحاجة الفعلية للمعرفة (Need-to-Know):',
                '• الأشخاص المصرح لهم من داخل منشأتك (المدراء والمشرفون المعيّنون)',
                '• فريق الدعم الفني في كوادر لا يمتلك صلاحية عرض بياناتك إلا بعد طلب دعم موثق',
                '• جميع عمليات الوصول من فريقنا تُسجَّل في سجل تدقيق شامل (Audit Log)',
                '• لا يمكن للموظفين الاطلاع على بيانات زملائهم إلا ضمن صلاحياتهم المحددة',
            ],
        },
        {
            id: 'retention', icon: FileText,
            title: 'الاحتفاظ بالبيانات وحذفها',
            content: [
                'تتحكم أنت بشكل كامل في بياناتك:',
                '• يحق لك تصدير جميع بياناتك في أي وقت بصيغ CSV أو PDF أو Excel',
                '• عند إلغاء الاشتراك، يتم الاحتفاظ بالبيانات لمدة 30 يوماً كفترة سماح للتراجع',
                '• بعد انتهاء فترة السماح، يتم المسح النهائي الآمن (Secure Wipe) من جميع الخوادم',
                '• بعض البيانات قد تُحتفظ بها لفترة أطول إذا اقتضى القانون المحلي ذلك',
            ],
        },
        {
            id: 'updates', icon: Bell,
            title: 'تحديثات سياسة الخصوصية',
            content: [
                'نلتزم بإشعارك مسبقاً بأي تغييرات:',
                '• إرسال بريد إلكتروني لجميع مدراء الحسابات قبل 30 يوماً من أي تغيير جوهري',
                '• إظهار إشعار واضح داخل المنصة عند تحديث سياسة الخصوصية',
                '• الاحتفاظ بأرشيف لجميع الإصدارات السابقة من السياسة للرجوع إليها',
                'آخر تحديث: يونيو 2026',
            ],
        },
    ],
    en: [
        {
            id: 'collection', icon: Users,
            title: 'Data We Collect',
            content: [
                'We collect only the data strictly necessary to operate our HR platform efficiently:',
                '• Employee names and contact information (email, phone number)',
                '• Attendance logs via biometric devices or mobile check-ins',
                '• GPS location data (only when Smart Clock-In feature is explicitly enabled)',
                '• Organizational structure and basic payroll details',
                '• Usage logs to improve platform performance and user experience',
            ],
        },
        {
            id: 'usage', icon: Server,
            title: 'How We Use Your Data',
            content: [
                'Your data and your employees\' data is used exclusively for:',
                '• Automating payroll sheets and calculating entitlements and deductions',
                '• Monitoring attendance discipline and generating presence/absence reports',
                '• Generating administrative reports and analytics for your organization',
                '• Sending HR-related notifications and operational alerts',
                'We do not sell, share, or rent this data to any third parties for advertising or marketing under any circumstances.',
            ],
        },
        {
            id: 'security', icon: Lock,
            title: 'Data Security & Encryption',
            content: [
                'We apply the highest industry security standards to protect your data:',
                '• AES-256 encryption for all data at rest',
                '• TLS 1.3 protocol for all data in transit',
                '• Complete data isolation per organization in a sandboxed environment',
                '• Two-Factor Authentication (2FA) for admin accounts',
                '• Quarterly security reviews and risk assessments',
                'We are SOC 2 Type II and ISO 27001 certified, and GDPR compliant.',
            ],
        },
        {
            id: 'access', icon: Eye,
            title: 'Who Has Access to Your Data?',
            content: [
                'Data access is built on a strict Need-to-Know basis:',
                '• Authorized personnel within your organization (designated managers & supervisors)',
                '• Kwader support team cannot view your data without a documented support request',
                '• All support team access actions are logged in a comprehensive Audit Log',
                '• Employees cannot view colleagues\' data beyond their defined role permissions',
            ],
        },
        {
            id: 'retention', icon: FileText,
            title: 'Data Retention & Deletion',
            content: [
                'You are in full control of your data at all times:',
                '• Export all your data at any time in CSV, PDF, or Excel formats',
                '• Upon subscription cancellation, data is retained for a 30-day grace period',
                '• After the grace period, data undergoes Secure Wipe from all servers',
                '• Some data may be retained longer if required by local applicable laws',
            ],
        },
        {
            id: 'updates', icon: Bell,
            title: 'Privacy Policy Updates',
            content: [
                'We are committed to notifying you before any changes:',
                '• Email notification to all account administrators at least 30 days before material changes',
                '• Clear in-app notice upon any Privacy Policy update',
                '• An archive of all previous policy versions is maintained for reference',
                'Last updated: June 2026',
            ],
        },
    ],
};

/* ─── Shared Layout Component ────────────────────────────────────────────────── */
function LegalPageLayout({ isRtl, accentColor, accentBg, icon: HeroIcon, title, subtitle, children }) {
    const navigate = useNavigate();
    const containerRef = useRef(null);

    useEffect(() => {
        window.scrollTo(0, 0);
        if (containerRef.current) containerRef.current.scrollTop = 0;
    }, []);

    return (
        <div
            ref={containerRef}
            dir={isRtl ? 'rtl' : 'ltr'}
            style={{
                minHeight: '100vh',
                background: 'linear-gradient(180deg, #06080f 0%, #0a0d18 100%)',
                color: '#94a3b8',
                fontFamily: "'Inter', 'IBM Plex Sans', 'Cairo', system-ui, sans-serif",
                overflowX: 'hidden',
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

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
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

            {/* ── Hero Section ── */}
            <div style={{
                position: 'relative',
                padding: '80px 24px 64px',
                textAlign: 'center',
                overflow: 'hidden',
            }}>
                {/* glow bg */}
                <div style={{
                    position: 'absolute', inset: 0,
                    background: `radial-gradient(ellipse 60% 50% at 50% 0%, ${accentBg} 0%, transparent 70%)`,
                    pointerEvents: 'none',
                }} />
                <div style={{
                    position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
                    width: '600px', height: '1px',
                    background: `linear-gradient(90deg, transparent, ${accentColor}80, transparent)`,
                }} />

                <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5 }}
                    style={{
                        display: 'inline-flex', padding: '18px', borderRadius: '20px',
                        background: `${accentColor}15`,
                        border: `1px solid ${accentColor}25`,
                        color: accentColor, marginBottom: '28px',
                    }}
                >
                    <HeroIcon size={40} strokeWidth={1.5} />
                </motion.div>

                <motion.h1
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.1 }}
                    style={{
                        margin: '0 0 16px',
                        color: '#f1f5f9',
                        fontSize: 'clamp(2rem, 5vw, 3rem)',
                        fontWeight: 800,
                        letterSpacing: '-0.5px',
                        lineHeight: 1.15,
                    }}
                >
                    {title}
                </motion.h1>

                <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                    style={{
                        maxWidth: '560px', margin: '0 auto 32px',
                        fontSize: '17px', lineHeight: '1.7', color: '#64748b',
                    }}
                >
                    {subtitle}
                </motion.p>

                {/* Meta Badges */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.35 }}
                    style={{ display: 'flex', justifyContent: 'center', gap: '12px', flexWrap: 'wrap' }}
                >
                    {[
                        isRtl ? 'آخر تحديث: يونيو 2026' : 'Last Updated: June 2026',
                        isRtl ? 'سريان مباشر' : 'Effective Immediately',
                        'GDPR · SOC 2',
                    ].map(b => (
                        <span key={b} style={{
                            fontSize: '12px', padding: '4px 12px', borderRadius: '20px',
                            background: 'rgba(255,255,255,0.04)',
                            border: '1px solid rgba(255,255,255,0.08)',
                            color: '#475569',
                        }}>{b}</span>
                    ))}
                </motion.div>
            </div>

            {/* ── Page Body ── */}
            {children}

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
                        { label: isRtl ? 'الخصوصية' : 'Privacy Policy', href: '/privacy' },
                        { label: isRtl ? 'شروط الخدمة' : 'Terms of Service', href: '/terms' },
                        { label: isRtl ? 'تواصل معنا' : 'Contact Us', href: 'mailto:hello@kwader.io' },
                    ].map(({ label, href }) => (
                        <a key={label} href={href}
                            style={{ color: '#334155', textDecoration: 'none', transition: 'color 0.15s' }}
                            onMouseEnter={e => e.currentTarget.style.color = '#94a3b8'}
                            onMouseLeave={e => e.currentTarget.style.color = '#334155'}
                        >{label}</a>
                    ))}
                </div>
            </div>
        </div>
    );
}

/* ─── Privacy Policy Page ────────────────────────────────────────────────────── */
const PrivacyPolicy = () => {
    const { language } = useLocale();
    const isRtl = language === 'ar';
    const sections = SECTIONS[isRtl ? 'ar' : 'en'];
    const [activeSection, setActiveSection] = useState(sections[0].id);

    // Scroll spy
    useEffect(() => {
        const handler = () => {
            const scrollY = window.scrollY + 200;
            for (const s of sections) {
                const el = document.getElementById(`section-${s.id}`);
                if (el && el.offsetTop <= scrollY) setActiveSection(s.id);
            }
        };
        window.addEventListener('scroll', handler);
        return () => window.removeEventListener('scroll', handler);
    }, [sections]);

    return (
        <LegalPageLayout
            isRtl={isRtl}
            accentColor="#10b981"
            accentBg="rgba(16,185,129,0.08)"
            icon={Shield}
            title={isRtl ? 'سياسة الخصوصية' : 'Privacy Policy'}
            subtitle={isRtl
                ? 'الخصوصية ليست مجرد ميزة — إنها حق أساسي. نلتزم بحماية بيانات منشأتك وموظفيك بأعلى المعايير العالمية.'
                : 'Privacy is not just a feature — it\'s a fundamental right. We are committed to protecting your organization\'s data with the highest global standards.'}
        >
            <div style={{
                maxWidth: '1100px', margin: '0 auto',
                padding: '0 24px 80px',
                display: 'grid',
                gridTemplateColumns: '240px 1fr',
                gap: '48px',
                alignItems: 'start',
            }}
                className="legal-grid"
            >
                {/* ── Sidebar TOC ── */}
                <aside style={{
                    position: 'sticky', top: '80px',
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: '16px', padding: '20px',
                }}>
                    <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: '#334155', margin: '0 0 16px' }}>
                        {isRtl ? 'المحتويات' : 'Contents'}
                    </p>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {sections.map((s, i) => (
                            <li key={s.id}>
                                <a
                                    href={`#section-${s.id}`}
                                    onClick={e => { e.preventDefault(); document.getElementById(`section-${s.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '8px',
                                        padding: '8px 10px', borderRadius: '8px',
                                        fontSize: '13px', textDecoration: 'none',
                                        color: activeSection === s.id ? '#10b981' : '#475569',
                                        background: activeSection === s.id ? 'rgba(16,185,129,0.08)' : 'transparent',
                                        transition: 'all 0.15s',
                                        fontWeight: activeSection === s.id ? 600 : 400,
                                    }}
                                    onMouseEnter={e => { if (activeSection !== s.id) e.currentTarget.style.color = '#94a3b8'; }}
                                    onMouseLeave={e => { if (activeSection !== s.id) e.currentTarget.style.color = '#475569'; }}
                                >
                                    <span style={{ fontSize: '11px', color: '#334155', minWidth: '16px' }}>{i + 1}.</span>
                                    {s.title}
                                </a>
                            </li>
                        ))}
                    </ul>

                    {/* Quick contact */}
                    <div style={{ marginTop: '24px', padding: '16px', background: 'rgba(16,185,129,0.05)', borderRadius: '10px', border: '1px solid rgba(16,185,129,0.12)' }}>
                        <p style={{ margin: '0 0 8px', fontSize: '12px', fontWeight: 700, color: '#10b981' }}>
                            {isRtl ? 'لديك سؤال؟' : 'Have a question?'}
                        </p>
                        <a href="mailto:privacy@kwader.io" style={{ fontSize: '12px', color: '#64748b', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '5px' }}
                            onMouseEnter={e => e.currentTarget.style.color = '#10b981'}
                            onMouseLeave={e => e.currentTarget.style.color = '#64748b'}
                        >
                            privacy@kwader.io <ExternalLink size={10} />
                        </a>
                    </div>
                </aside>

                {/* ── Main Content ── */}
                <main>
                    {sections.map((sec, i) => {
                        const Icon = sec.icon;
                        return (
                            <motion.div
                                key={sec.id}
                                id={`section-${sec.id}`}
                                initial={{ opacity: 0, y: 24 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true, margin: '-80px' }}
                                transition={{ duration: 0.45, delay: i * 0.05 }}
                                style={{
                                    marginBottom: '32px',
                                    background: 'rgba(255,255,255,0.02)',
                                    border: '1px solid rgba(255,255,255,0.06)',
                                    borderRadius: '20px', padding: '36px',
                                    transition: 'border-color 0.2s',
                                }}
                                onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(16,185,129,0.15)'}
                                onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
                                    <div style={{
                                        width: '44px', height: '44px', borderRadius: '12px', flexShrink: 0,
                                        background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981',
                                    }}>
                                        <Icon size={20} strokeWidth={1.8} />
                                    </div>
                                    <div>
                                        <p style={{ margin: 0, fontSize: '12px', color: '#334155', marginBottom: '2px' }}>
                                            {isRtl ? `البند ${i + 1}` : `Section ${i + 1}`}
                                        </p>
                                        <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#f1f5f9', letterSpacing: '-0.2px' }}>
                                            {sec.title}
                                        </h2>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    {sec.content.map((line, j) => (
                                        <p key={j} style={{
                                            margin: 0, lineHeight: '1.8', fontSize: '14.5px',
                                            color: line.startsWith('•') ? '#64748b' : '#94a3b8',
                                            paddingRight: isRtl && line.startsWith('•') ? '4px' : '0',
                                            paddingLeft: !isRtl && line.startsWith('•') ? '4px' : '0',
                                        }}>
                                            {line}
                                        </p>
                                    ))}
                                </div>
                            </motion.div>
                        );
                    })}

                    {/* Security Guarantee Box */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        style={{
                            padding: '32px 36px',
                            background: 'linear-gradient(135deg, rgba(16,185,129,0.06) 0%, rgba(5,150,105,0.03) 100%)',
                            border: '1px solid rgba(16,185,129,0.2)',
                            borderRadius: '20px',
                            display: 'flex', gap: '20px', alignItems: 'flex-start',
                        }}
                    >
                        <div style={{
                            width: '48px', height: '48px', borderRadius: '12px', flexShrink: 0,
                            background: 'rgba(16,185,129,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                            <CheckCircle2 size={24} style={{ color: '#10b981' }} />
                        </div>
                        <div>
                            <h3 style={{ margin: '0 0 8px', fontSize: '17px', fontWeight: 700, color: '#f1f5f9' }}>
                                {isRtl ? 'التزامنا بحماية خصوصيتك' : 'Our Commitment to Your Privacy'}
                            </h3>
                            <p style={{ margin: 0, fontSize: '14px', lineHeight: '1.75', color: '#64748b' }}>
                                {isRtl
                                    ? 'نلتزم بتطبيق أعلى المعايير الدولية لحماية بياناتك. هذه الوثيقة تعكس التزاماً حقيقياً، وليست مجرد نص قانوني. إذا كان لديك أي استفسار حول خصوصيتك، فريقنا متاح على مدار الساعة عبر privacy@kwader.io'
                                    : 'We are committed to applying the highest international standards to protect your data. This document reflects a genuine commitment, not just legal text. If you have any privacy questions, our team is available 24/7 at privacy@kwader.io'}
                            </p>
                        </div>
                    </motion.div>
                </main>
            </div>
            <style>{`
                @media (max-width: 768px) {
                    .legal-grid {
                        grid-template-columns: 1fr !important;
                    }
                    .legal-grid aside {
                        display: none;
                    }
                }
            `}</style>
        </LegalPageLayout>
    );
};

export default PrivacyPolicy;
