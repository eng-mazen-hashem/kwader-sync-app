import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { useLocale } from '../context/LocaleContext';
import {
    Shield, Lock, AlertTriangle, ArrowLeft, ArrowRight,
    Gavel, Scale, FileText, Globe, CheckCircle2, ExternalLink, CreditCard, RefreshCw
} from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';

/* ─── Data ─────────────────────────────────────────────────────────────────── */
const SECTIONS = {
    ar: [
        {
            id: 'intro', icon: Scale,
            title: 'مقدمة وقبول الشروط',
            content: [
                'مرحباً بك في منصة كوادر ("المنصة" أو "الخدمة"). هذه الشروط والأحكام تُلزم أي شخص أو مؤسسة تصل إلى خدمات كوادر أو تستخدمها.',
                '• باستخدامك للمنصة، فإنك تُقرّ بقراءتك وفهمك وقبولك الكامل لهذه الشروط',
                '• إذا كنت تمثل مؤسسة، فإنك تُقرّ بامتلاكك الصلاحية القانونية للالتزام بهذه الشروط نيابة عن مؤسستك',
                '• يحق لنا تعديل هذه الشروط في أي وقت مع إشعار مسبق لا يقل عن 30 يوماً للتغييرات الجوهرية',
                'تاريخ السريان: يونيو 2026',
            ],
        },
        {
            id: 'account', icon: Shield,
            title: 'الحساب والأمان',
            content: [
                'أنت مسؤول كلياً عن الحفاظ على أمان حسابك:',
                '• الحفاظ على سرية كلمة المرور ومفاتيح الترخيص (License Keys) وعدم مشاركتها',
                '• إشعارنا فوراً على security@kwader.io في حال الاشتباه بأي وصول غير مصرح به',
                '• أي نشاط يتم تحت حسابك يُعدّ مسؤوليتك القانونية الكاملة سواء أذنت به أم لا',
                '• نحتفظ بالحق في تعليق الحسابات المشتبه في تعرضها للاختراق فوراً لحماية بياناتك',
                '• يُشترط تفعيل المصادقة الثنائية (2FA) لجميع الحسابات الإدارية في الخطط المتقدمة',
            ],
        },
        {
            id: 'billing', icon: CreditCard,
            title: 'الاشتراكات والفوترة والتراخيص',
            content: [
                'تُقدَّم الخدمة على أساس خطط اشتراك دورية (شهرية أو سنوية):',
                '• يتم تفعيل الصلاحيات وحدود الاستخدام بناءً على الخطة المختارة فور السداد',
                '• الرسوم المدفوعة غير قابلة للاسترداد إلا وفقاً لسياسة الاسترداد المنصوص عليها أدناه',
                '• تجديد الاشتراك يتم تلقائياً قبل 3 أيام من انتهاء الفترة ما لم يتم إلغاؤه صراحةً',
                '• التأخر في السداد قد يؤدي إلى تعليق الوصول مع إشعار مسبق بـ 7 أيام',
                '• أسعارنا قابلة للتعديل مع إشعار مسبق لا يقل عن 60 يوماً للعملاء الحاليين',
                'سياسة الاسترداد: يمكنك طلب استرداد كامل خلال 14 يوماً من بدء الاشتراك الجديد.',
            ],
        },
        {
            id: 'ownership', icon: Lock,
            title: 'ملكية البيانات والمحتوى',
            content: [
                'تبقى جميع البيانات التي تُدخلها في المنصة مملوكة لك بالكامل:',
                '• نحن لا نطالب بأي حق ملكية على بيانات موظفيك أو سجلات رواتبك',
                '• يحق لك تصدير بياناتك كاملةً في أي وقت بصيغ CSV أو Excel أو PDF',
                '• عند إنهاء الخدمة، نلتزم بتسليمك نسخة كاملة من بياناتك خلال 5 أيام عمل',
                '• الكوادر تمتلك حق الملكية الفكرية الكاملة للمنصة وخوارزمياتها وواجهتها',
                '• لا يُمنح للمستخدم سوى ترخيص استخدام محدود وغير حصري وغير قابل للنقل',
            ],
        },
        {
            id: 'availability', icon: Globe,
            title: 'توفر الخدمة والمستوى المتفق عليه (SLA)',
            content: [
                'نلتزم بضمان توفر المنصة بنسبة 99.5% على مدار السنة:',
                '• أعمال الصيانة المجدولة تُنفَّذ خارج أوقات الذروة مع إشعار مسبق بـ 48 ساعة',
                '• في حال الانقطاع غير المخطط له لأكثر من 4 ساعات متواصلة، يحق لك الحصول على ائتمان خدمة',
                '• حالات القوة القاهرة (كوارث طبيعية، هجمات إلكترونية واسعة) مستثناة من ضمان الـ SLA',
                '• نوفر لوحة حالة مباشرة على status.kwader.io لمتابعة أداء المنصة في الوقت الفعلي',
            ],
        },
        {
            id: 'liability', icon: Gavel,
            title: 'حدود المسؤولية والإخلاء',
            content: [
                'تُقدَّم الخدمة "كما هي" مع بذل أقصى جهد ممكن لضمان دقتها واستمراريتها:',
                '• يجب مراجعة كشوف الرواتب والنتائج النهائية قبل الصرف والاعتماد المالي',
                '• لا تتحمل كوادر المسؤولية عن خسائر ناجمة عن أخطاء إدخال البيانات أو سوء الاستخدام',
                '• الحد الأقصى للمسؤولية القانونية لكوادر لا يتجاوز قيمة اشتراك 3 أشهر',
                '• هذه الشروط تخضع لأحكام نظام التجارة الإلكترونية والمعاملات الرقمية المعمول به',
                '• يُفضَّل حل النزاعات ودياً، وفي حال الإخفاق يتم اللجوء للتحكيم التجاري',
            ],
        },
        {
            id: 'termination', icon: RefreshCw,
            title: 'إنهاء الخدمة والشروط العامة',
            content: [
                'يحق لأي من الطرفين إنهاء العقد:',
                '• يمكنك إلغاء اشتراكك في أي وقت من لوحة الإعدادات دون رسوم إضافية',
                '• عند الإلغاء، تبقى الخدمة متاحة حتى نهاية الفترة المدفوعة',
                '• نحتفظ بالحق في إنهاء الخدمة عند انتهاك هذه الشروط مع إشعار مسبق بـ 14 يوماً',
                '• الانتهاك الجسيم للشروط (كالاحتيال أو الاختراق) قد يؤدي لإنهاء فوري',
                '• في جميع الأحوال، يحق لك الحصول على نسخة كاملة من بياناتك قبل الإنهاء',
                'إذا كان لديك أي استفسار قانوني، تواصل معنا على legal@kwader.io',
            ],
        },
    ],
    en: [
        {
            id: 'intro', icon: Scale,
            title: 'Introduction & Acceptance of Terms',
            content: [
                'Welcome to the Kwader platform ("Platform" or "Service"). These Terms & Conditions are binding on any person or entity that accesses or uses Kwader services.',
                '• By using the Platform, you acknowledge reading, understanding, and fully accepting these terms',
                '• If you represent an organization, you confirm you have legal authority to bind them to these terms',
                '• We may modify these terms at any time with at least 30 days\' advance notice for material changes',
                'Effective Date: June 2026',
            ],
        },
        {
            id: 'account', icon: Shield,
            title: 'Account & Security',
            content: [
                'You are solely responsible for maintaining the security of your account:',
                '• Keep your password and License Keys confidential and do not share them',
                '• Immediately notify us at security@kwader.io if you suspect any unauthorized access',
                '• Any activity under your account is your full legal responsibility, authorized or not',
                '• We reserve the right to immediately suspend accounts suspected of compromise to protect your data',
                '• Two-Factor Authentication (2FA) is required for all admin accounts on advanced plans',
            ],
        },
        {
            id: 'billing', icon: CreditCard,
            title: 'Subscriptions, Billing & Licensing',
            content: [
                'The service is offered on periodic subscription plans (monthly or annual):',
                '• Permissions and usage limits are activated based on the selected plan upon payment',
                '• Paid fees are non-refundable except as outlined in our Refund Policy below',
                '• Subscriptions auto-renew 3 days before the period end unless explicitly cancelled',
                '• Late payment may result in access suspension with 7 days prior notice',
                '• Prices may be adjusted with at least 60 days advance notice for existing customers',
                'Refund Policy: You may request a full refund within 14 days of starting a new subscription.',
            ],
        },
        {
            id: 'ownership', icon: Lock,
            title: 'Data Ownership & Content',
            content: [
                'All data you enter into the Platform remains fully owned by you:',
                '• We claim no ownership rights over your employee data or payroll records',
                '• You may export your complete data at any time in CSV, Excel, or PDF formats',
                '• Upon service termination, we commit to delivering a full copy of your data within 5 business days',
                '• Kwader holds full intellectual property rights to the Platform, its algorithms and interfaces',
                '• Users are granted only a limited, non-exclusive, non-transferable license to use the Platform',
            ],
        },
        {
            id: 'availability', icon: Globe,
            title: 'Service Availability & SLA',
            content: [
                'We commit to maintaining 99.5% platform uptime annually:',
                '• Scheduled maintenance is performed during off-peak hours with 48 hours advance notice',
                '• Unplanned outages exceeding 4 consecutive hours entitle you to a service credit',
                '• Force majeure events (natural disasters, large-scale cyberattacks) are excluded from SLA guarantees',
                '• A live status dashboard is available at status.kwader.io for real-time platform monitoring',
            ],
        },
        {
            id: 'liability', icon: Gavel,
            title: 'Limitation of Liability & Disclaimer',
            content: [
                'The service is provided "as-is" with maximum effort to ensure accuracy and continuity:',
                '• Payroll sheets and final results must be reviewed before financial disbursement',
                '• Kwader is not liable for losses resulting from data entry errors or system misuse',
                '• Kwader\'s maximum legal liability shall not exceed 3 months\' subscription value',
                '• These terms are governed by applicable e-commerce and digital transaction regulations',
                '• Disputes are preferably resolved amicably; otherwise through commercial arbitration',
            ],
        },
        {
            id: 'termination', icon: RefreshCw,
            title: 'Termination & General Provisions',
            content: [
                'Either party may terminate the agreement:',
                '• You may cancel your subscription at any time from the Settings panel without additional fees',
                '• Upon cancellation, service remains active until the end of the paid period',
                '• We reserve the right to terminate service upon terms violation with 14 days prior notice',
                '• Serious violations (fraud, unauthorized access) may result in immediate termination',
                '• In all cases, you are entitled to a full copy of your data before termination',
                'For any legal inquiries, contact us at legal@kwader.io',
            ],
        },
    ],
};

/* ─── Shared Layout imported from PrivacyPolicy — replicated here inline ──── */
function LegalPageLayout({ isRtl, accentColor, accentBg, icon: HeroIcon, title, subtitle, children }) {
    const navigate = useNavigate();
    useEffect(() => { window.scrollTo(0, 0); }, []);

    return (
        <div
            dir={isRtl ? 'rtl' : 'ltr'}
            style={{
                minHeight: '100vh',
                background: 'linear-gradient(180deg, #06080f 0%, #0a0d18 100%)',
                color: '#94a3b8',
                fontFamily: "'Inter', 'IBM Plex Sans', 'Cairo', system-ui, sans-serif",
                overflowX: 'hidden',
            }}
        >
            {/* Nav */}
            <div style={{
                position: 'sticky', top: 0, zIndex: 50,
                background: 'rgba(6,8,15,0.85)', backdropFilter: 'blur(20px)',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
                padding: '0 24px', display: 'flex', alignItems: 'center',
                justifyContent: 'space-between', height: '60px',
            }}>
                <button onClick={() => navigate(-1)}
                    style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
                        color: '#94a3b8', cursor: 'pointer', padding: '7px 16px', borderRadius: '8px',
                        fontSize: '13px', fontFamily: 'inherit', transition: 'all 0.2s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.09)'; e.currentTarget.style.color = '#e2e8f0'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#94a3b8'; }}
                >
                    {isRtl ? <ArrowRight size={15} /> : <ArrowLeft size={15} />}
                    {isRtl ? 'رجوع' : 'Back'}
                </button>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ width: '24px', height: '24px', borderRadius: '6px', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ color: '#fff', fontSize: '10px', fontWeight: 800 }}>K</span>
                    </div>
                    <span style={{ color: '#f1f5f9', fontWeight: 700, fontSize: '14px' }}>KWADER</span>
                </div>
                <div style={{ display: 'flex', gap: '16px', fontSize: '12px' }}>
                    <Link to="/privacy" style={{ color: '#64748b', textDecoration: 'none' }}
                        onMouseEnter={e => e.currentTarget.style.color = '#c7d2fe'}
                        onMouseLeave={e => e.currentTarget.style.color = '#64748b'}
                    >{isRtl ? 'الخصوصية' : 'Privacy'}</Link>
                    <Link to="/terms" style={{ color: '#64748b', textDecoration: 'none' }}
                        onMouseEnter={e => e.currentTarget.style.color = '#c7d2fe'}
                        onMouseLeave={e => e.currentTarget.style.color = '#64748b'}
                    >{isRtl ? 'الشروط' : 'Terms'}</Link>
                </div>
            </div>

            {/* Hero */}
            <div style={{ position: 'relative', padding: '80px 24px 64px', textAlign: 'center', overflow: 'hidden' }}>
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

                <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5 }}
                    style={{ display: 'inline-flex', padding: '18px', borderRadius: '20px', background: `${accentColor}15`, border: `1px solid ${accentColor}25`, color: accentColor, marginBottom: '28px' }}>
                    <HeroIcon size={40} strokeWidth={1.5} />
                </motion.div>

                <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}
                    style={{ margin: '0 0 16px', color: '#f1f5f9', fontSize: 'clamp(2rem, 5vw, 3rem)', fontWeight: 800, letterSpacing: '-0.5px', lineHeight: 1.15 }}>
                    {title}
                </motion.h1>

                <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}
                    style={{ maxWidth: '560px', margin: '0 auto 32px', fontSize: '17px', lineHeight: '1.7', color: '#64748b' }}>
                    {subtitle}
                </motion.p>

                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }}
                    style={{ display: 'flex', justifyContent: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    {[
                        isRtl ? 'آخر تحديث: يونيو 2026' : 'Last Updated: June 2026',
                        isRtl ? 'يسري فوراً' : 'Effective Immediately',
                        isRtl ? 'الإصدار 3.1' : 'Version 3.1',
                    ].map(b => (
                        <span key={b} style={{ fontSize: '12px', padding: '4px 12px', borderRadius: '20px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#475569' }}>{b}</span>
                    ))}
                </motion.div>
            </div>

            {children}

            {/* Footer */}
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', padding: '32px 24px', textAlign: 'center', fontSize: '13px', color: '#334155' }}>
                <p style={{ margin: '0 0 12px' }}>© {new Date().getFullYear()} Kwader, Inc. {isRtl ? 'جميع الحقوق محفوظة.' : 'All rights reserved.'}</p>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', flexWrap: 'wrap' }}>
                    {[
                        { label: isRtl ? 'الخصوصية' : 'Privacy Policy', href: '/privacy' },
                        { label: isRtl ? 'شروط الخدمة' : 'Terms of Service', href: '/terms' },
                        { label: isRtl ? 'تواصل معنا' : 'Contact Us', href: 'mailto:hello@kwader.io' },
                    ].map(({ label, href }) => (
                        <a key={label} href={href} style={{ color: '#334155', textDecoration: 'none', transition: 'color 0.15s' }}
                            onMouseEnter={e => e.currentTarget.style.color = '#94a3b8'}
                            onMouseLeave={e => e.currentTarget.style.color = '#334155'}
                        >{label}</a>
                    ))}
                </div>
            </div>
        </div>
    );
}

/* ─── Terms of Service Page ─────────────────────────────────────────────────── */
const TermsOfService = () => {
    const { language } = useLocale();
    const isRtl = language === 'ar';
    const sections = SECTIONS[isRtl ? 'ar' : 'en'];
    const [activeSection, setActiveSection] = useState(sections[0].id);

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
            accentColor="#6366f1"
            accentBg="rgba(99,102,241,0.08)"
            icon={Gavel}
            title={isRtl ? 'شروط الخدمة' : 'Terms of Service'}
            subtitle={isRtl
                ? 'نؤمن بالشفافية والوضوح. يرجى قراءة هذه الشروط بعناية لمعرفة حقوقك ومسؤولياتك أثناء استخدام كوادر.'
                : 'We believe in transparency and clarity. Please read these terms carefully to understand your rights and responsibilities while using Kwader.'}
        >
            <div style={{
                maxWidth: '1100px', margin: '0 auto',
                padding: '0 24px 80px',
                display: 'grid',
                gridTemplateColumns: '240px 1fr',
                gap: '48px',
                alignItems: 'start',
            }} className="legal-grid">
                {/* Sidebar */}
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
                                <a href={`#section-${s.id}`}
                                    onClick={e => { e.preventDefault(); document.getElementById(`section-${s.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '8px',
                                        padding: '8px 10px', borderRadius: '8px', fontSize: '12.5px',
                                        textDecoration: 'none',
                                        color: activeSection === s.id ? '#818cf8' : '#475569',
                                        background: activeSection === s.id ? 'rgba(99,102,241,0.08)' : 'transparent',
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

                    <div style={{ marginTop: '24px', padding: '16px', background: 'rgba(99,102,241,0.05)', borderRadius: '10px', border: '1px solid rgba(99,102,241,0.12)' }}>
                        <p style={{ margin: '0 0 8px', fontSize: '12px', fontWeight: 700, color: '#818cf8' }}>
                            {isRtl ? 'استفسار قانوني؟' : 'Legal inquiry?'}
                        </p>
                        <a href="mailto:legal@kwader.io" style={{ fontSize: '12px', color: '#64748b', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '5px' }}
                            onMouseEnter={e => e.currentTarget.style.color = '#818cf8'}
                            onMouseLeave={e => e.currentTarget.style.color = '#64748b'}
                        >
                            legal@kwader.io <ExternalLink size={10} />
                        </a>
                    </div>
                </aside>

                {/* Main */}
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
                                    marginBottom: '28px',
                                    background: 'rgba(255,255,255,0.02)',
                                    border: '1px solid rgba(255,255,255,0.06)',
                                    borderRadius: '20px', padding: '36px',
                                    transition: 'border-color 0.2s',
                                }}
                                onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(99,102,241,0.2)'}
                                onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
                                    <div style={{
                                        width: '44px', height: '44px', borderRadius: '12px', flexShrink: 0,
                                        background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#818cf8',
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
                                        }}>{line}</p>
                                    ))}
                                </div>
                            </motion.div>
                        );
                    })}

                    {/* Agreement Box */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        style={{
                            padding: '32px 36px',
                            background: 'linear-gradient(135deg, rgba(245,158,11,0.06) 0%, rgba(234,88,12,0.03) 100%)',
                            border: '1px solid rgba(245,158,11,0.2)',
                            borderRadius: '20px',
                            display: 'flex', gap: '20px', alignItems: 'flex-start',
                        }}
                    >
                        <div style={{ width: '48px', height: '48px', borderRadius: '12px', flexShrink: 0, background: 'rgba(245,158,11,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <AlertTriangle size={24} style={{ color: '#f59e0b' }} />
                        </div>
                        <div>
                            <h3 style={{ margin: '0 0 8px', fontSize: '17px', fontWeight: 700, color: '#f1f5f9' }}>
                                {isRtl ? 'إقرار بالموافقة' : 'Acknowledgment of Agreement'}
                            </h3>
                            <p style={{ margin: 0, fontSize: '14px', lineHeight: '1.75', color: '#64748b' }}>
                                {isRtl
                                    ? 'استمرارك في استخدام منصة كوادر يُعدّ إقراراً رقمياً صريحاً بموافقتك الكاملة على كافة الشروط والأحكام الواردة في هذه الوثيقة، وأنك تمتلك الصلاحية القانونية لتمثيل منشأتك في هذا الاتفاق.'
                                    : 'Your continued use of the Kwader platform constitutes an explicit digital acknowledgment of your full agreement to all terms and conditions in this document, and that you have the legal authority to represent your organization in this agreement.'}
                            </p>
                        </div>
                    </motion.div>
                </main>
            </div>

            <style>{`
                @media (max-width: 768px) {
                    .legal-grid { grid-template-columns: 1fr !important; }
                    .legal-grid aside { display: none; }
                }
            `}</style>
        </LegalPageLayout>
    );
};

export default TermsOfService;
