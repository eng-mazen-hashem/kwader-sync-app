import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { useLocale } from '../context/LocaleContext';
import { ArrowLeft, ArrowRight, ExternalLink, Users, Target, Globe, Zap, Heart, TrendingUp, Award, MapPin, ChevronRight } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';

const STATS = [
  { value: '150+', labelAr: 'شركة تثق بنا', labelEn: 'Companies trust us' },
  { value: '5,000+', labelAr: 'موظف تحت الإدارة', labelEn: 'Employees managed' },
  { value: '4.8★', labelAr: 'متوسط التقييم', labelEn: 'Average rating' },
  { value: '99.5%', labelAr: 'ضمان التشغيل', labelEn: 'Uptime guarantee' },
];

const VALUES = [
  { icon: Target, color: '#6366f1', titleAr: 'الدقة أولاً', titleEn: 'Accuracy First', descAr: 'نؤمن بأن كل ريال يصل للموظف يجب أن يكون صحيحاً. دقة الرواتب ليست خياراً، بل التزام.', descEn: 'Every payroll must be accurate. We treat financial precision as a non-negotiable commitment.' },
  { icon: Heart, color: '#ec4899', titleAr: 'الإنسان في المركز', titleEn: 'People-Centered', descAr: 'نصمم لإنسان حقيقي يعمل كل يوم. سهولة الاستخدام والتعاطف مع المستخدم تقود كل قرار تصميمي.', descEn: 'We design for real people. Empathy and usability guide every design decision we make.' },
  { icon: Globe, color: '#10b981', titleAr: 'بناء للمنطقة', titleEn: 'Built for the Region', descAr: 'أنظمة محلية أولاً — نفهم قوانين العمل السعودية والإماراتية والخليجية من الداخل.', descEn: 'Local-first systems — we understand GCC labor laws and payroll regulations from the inside.' },
  { icon: Zap, color: '#f59e0b', titleAr: 'السرعة تُحدث فرقاً', titleEn: 'Speed Matters', descAr: 'نبني سريعاً، نختبر بذكاء، ونطرح بثقة. الأتمتة تحرر وقتك لما هو مهم حقاً.', descEn: 'Build fast, test smart, ship confidently. Automation frees your time for what truly matters.' },
];

const TEAM = [
  { nameAr: 'المهندس مازن هاشم', nameEn: 'Eng. Mazen Hashem', roleAr: 'رئيس مجلس الإدارة والمؤسس', roleEn: 'Chairman & Founder', locationAr: 'مصر 🇪🇬', locationEn: 'Egypt 🇪🇬', color: '#6366f1' },
  { nameAr: 'سارة المنصوري', nameEn: 'Sara Al-Mansouri', roleAr: 'مديرة المنتج', roleEn: 'Head of Product', locationAr: 'دبي 🇦🇪', locationEn: 'Dubai 🇦🇪', color: '#8b5cf6' },
  { nameAr: 'عمر خليل', nameEn: 'Omar Khalil', roleAr: 'رئيس التقنية', roleEn: 'CTO', locationAr: 'القاهرة 🇪🇬', locationEn: 'Cairo 🇪🇬', color: '#06b6d4' },
  { nameAr: 'نورة الدوسري', nameEn: 'Nora Al-Dossari', roleAr: 'مديرة العمليات', roleEn: 'Head of Operations', locationAr: 'الرياض 🇸🇦', locationEn: 'Riyadh 🇸🇦', color: '#10b981' },
  { nameAr: 'خالد حسن', nameEn: 'Khaled Hassan', roleAr: 'مدير المبيعات', roleEn: 'Head of Sales', locationAr: 'جدة 🇸🇦', locationEn: 'Jeddah 🇸🇦', color: '#f59e0b' },
  { nameAr: 'لينا ناصر', nameEn: 'Lina Nasser', roleAr: 'مديرة نجاح العملاء', roleEn: 'Customer Success Lead', locationAr: 'دبي 🇦🇪', locationEn: 'Dubai 🇦🇪', color: '#ec4899' },
];

function LegalNav({ isRtl, navigate }) {
  return (
    <div style={{
      position: 'sticky', top: 0, zIndex: 50,
      background: 'rgba(6,8,15,0.85)', backdropFilter: 'blur(20px)',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      padding: '0 24px', display: 'flex', alignItems: 'center',
      justifyContent: 'space-between', height: '60px',
    }}>
      <button onClick={() => navigate(-1)} style={{
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
        <div style={{ width: '24px', height: '24px', borderRadius: '6px', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ color: '#fff', fontSize: '10px', fontWeight: 800 }}>K</span>
        </div>
        <span style={{ color: '#f1f5f9', fontWeight: 700, fontSize: '14px' }}>KWADER</span>
      </div>
      <Link to="/login" style={{ fontSize: '13px', textDecoration: 'none', padding: '7px 14px', borderRadius: '8px', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', fontWeight: 600 }}>
        {isRtl ? 'ابدأ مجاناً' : 'Get Started'}
      </Link>
    </div>
  );
}

const AboutUs = () => {
  const { language } = useLocale();
  const isRtl = language === 'ar';
  const navigate = useNavigate();
  useEffect(() => { window.scrollTo(0, 0); }, []);

  return (
    <div dir={isRtl ? 'rtl' : 'ltr'} style={{ minHeight: '100vh', background: 'linear-gradient(180deg,#06080f 0%,#0a0d18 100%)', color: '#94a3b8', fontFamily: "'Inter','Cairo',system-ui,sans-serif", overflowX: 'hidden' }}>
      <LegalNav isRtl={isRtl} navigate={navigate} />

      {/* Hero */}
      <div style={{ position: 'relative', padding: '100px 24px 80px', textAlign: 'center', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 70% 50% at 50% 0%,rgba(99,102,241,0.1) 0%,transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: '700px', height: '1px', background: 'linear-gradient(90deg,transparent,rgba(99,102,241,0.6),transparent)' }} />

        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} style={{ maxWidth: '720px', margin: '0 auto' }}>
          <span style={{ display: 'inline-block', fontSize: '13px', fontWeight: 600, color: '#818cf8', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', padding: '4px 14px', borderRadius: '20px', marginBottom: '24px' }}>
            {isRtl ? '🇸🇦 صُنع في المنطقة، للمنطقة' : '🇸🇦 Made in the region, for the region'}
          </span>
          <h1 style={{ margin: '0 0 20px', color: '#f1f5f9', fontSize: 'clamp(2.2rem,5vw,3.5rem)', fontWeight: 800, letterSpacing: '-0.5px', lineHeight: 1.1 }}>
            {isRtl ? 'نُعيد تعريف إدارة الموارد البشرية\nللفرق العربية' : 'Redefining HR management\nfor Arabic-speaking teams'}
          </h1>
          <p style={{ fontSize: '18px', lineHeight: '1.7', color: '#64748b', maxWidth: '600px', margin: '0 auto 40px' }}>
            {isRtl
              ? 'تأسست كوادر في أواخر عام 2024 في مصر لتكون منصة عربية رائدة لفرق العمل، تهدف لإعادة تعريف الموارد البشرية وإدارة الرواتب بدقة فائقة.'
              : 'Founded in late 2024 in Egypt, Kwader is a leading Arabic platform for teams, redefining HR and payroll management with absolute precision.'}
          </p>
        </motion.div>
      </div>

      {/* Stats */}
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '0 24px 80px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '16px' }}>
          {STATS.map((s, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}
              style={{ textAlign: 'center', padding: '28px 16px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px' }}>
              <div style={{ fontSize: '28px', fontWeight: 800, color: '#f1f5f9', letterSpacing: '-0.5px', marginBottom: '6px' }}>{s.value}</div>
              <div style={{ fontSize: '13px', color: '#475569' }}>{isRtl ? s.labelAr : s.labelEn}</div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Mission */}
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '0 24px 80px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px', alignItems: 'center' }}>
          <motion.div initial={{ opacity: 0, x: isRtl ? 30 : -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }}>
            <span style={{ display: 'inline-block', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', color: '#6366f1', marginBottom: '16px' }}>
              {isRtl ? 'رسالتنا' : 'Our Mission'}
            </span>
            <h2 style={{ margin: '0 0 20px', color: '#f1f5f9', fontSize: '26px', fontWeight: 700, letterSpacing: '-0.3px', lineHeight: 1.3 }}>
              {isRtl ? 'أتمتة المهام المتكررة حتى يتفرغ فريقك لما يهم' : 'Automate the repetitive so your team can focus on what matters'}
            </h2>
            <p style={{ fontSize: '15px', lineHeight: '1.8', color: '#64748b', margin: 0 }}>
              {isRtl
                ? 'بدأنا كوادر لأننا رأينا فرق الموارد البشرية تضيع ساعات في جداول Excel وحسابات يدوية. قررنا أن نبني الحل الذي كنا نريده بأنفسنا.'
                : 'We started Kwader because we saw HR teams wasting hours in Excel sheets and manual calculations. We decided to build the solution we always wanted ourselves.'}
            </p>
          </motion.div>
          <motion.div initial={{ opacity: 0, x: isRtl ? -30 : 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }}>
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '20px', padding: '32px' }}>
              {[
                { yearAr: 'أواخر 2024', yearEn: 'Late 2024', titleAr: 'التأسيس والبداية', titleEn: 'The Founding', descAr: 'تأسيس شركة كوادر في مصر بقيادة المهندس مازن هاشم كشريك تقني متكامل.', descEn: 'Founded Kwader in Egypt by Eng. Mazen Hashem as an integrated HR solution.' },
                { yearAr: '2025', yearEn: '2025', titleAr: 'النمو والتوسع', titleEn: 'Growth & Expansion', descAr: 'توسيع نطاق المنصة وضم كبرى الكوادر الإدارية والفنية وبناء قاعدة عملاء متينة.', descEn: 'Scaling the platform, building expert technical teams, and growing the client base.' },
                { yearAr: '2026', yearEn: '2026', titleAr: 'الريادة والربط الذكي', titleEn: 'Leadership & AI', descAr: 'الربط الذكي مع أجهزة الحضور والانصراف، والتوسع الإقليمي في الخليج العربي.', descEn: 'Smart integration with attendance devices and regional expansion in the GCC.' }
              ].map((item, i) => (
                <div key={i} style={{ display: 'flex', gap: '16px', marginBottom: i < 2 ? '20px' : 0 }}>
                  <div style={{ flexShrink: 0, width: '75px', textAlign: 'center' }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#6366f1' }}>{isRtl ? item.yearAr : item.yearEn}</span>
                    {i < 2 && <div style={{ width: '1px', height: '28px', background: 'rgba(99,102,241,0.2)', margin: '6px auto 0' }} />}
                  </div>
                  <div>
                    <p style={{ margin: '0 0 2px', fontSize: '14px', fontWeight: 600, color: '#e2e8f0' }}>{isRtl ? item.titleAr : item.titleEn}</p>
                    <p style={{ margin: 0, fontSize: '13px', color: '#475569' }}>{isRtl ? item.descAr : item.descEn}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      {/* Values */}
      <div style={{ background: 'rgba(255,255,255,0.01)', borderTop: '1px solid rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.05)', padding: '80px 24px' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '56px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', color: '#6366f1' }}>{isRtl ? 'قيمنا' : 'Our Values'}</span>
            <h2 style={{ margin: '12px 0 0', color: '#f1f5f9', fontSize: '28px', fontWeight: 700 }}>{isRtl ? 'ما الذي يُحركنا كل يوم' : 'What drives us every day'}</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            {VALUES.map((v, i) => {
              const Icon = v.icon;
              return (
                <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}
                  style={{ padding: '28px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', transition: 'border-color 0.2s' }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = `${v.color}30`}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'}
                >
                  <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: `${v.color}15`, border: `1px solid ${v.color}25`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: v.color, marginBottom: '16px' }}>
                    <Icon size={18} strokeWidth={1.8} />
                  </div>
                  <h3 style={{ margin: '0 0 8px', fontSize: '16px', fontWeight: 700, color: '#f1f5f9' }}>{isRtl ? v.titleAr : v.titleEn}</h3>
                  <p style={{ margin: 0, fontSize: '13.5px', lineHeight: '1.7', color: '#64748b' }}>{isRtl ? v.descAr : v.descEn}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Team */}
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '80px 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: '56px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', color: '#6366f1' }}>{isRtl ? 'الفريق' : 'The Team'}</span>
          <h2 style={{ margin: '12px 0 0', color: '#f1f5f9', fontSize: '28px', fontWeight: 700 }}>{isRtl ? 'الأشخاص الذين يبنون كوادر' : 'The people building Kwader'}</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '16px' }}>
          {TEAM.map((m, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.07 }}
              style={{ padding: '24px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', textAlign: 'center' }}>
              <div style={{ width: '52px', height: '52px', borderRadius: '14px', background: `${m.color}20`, border: `2px solid ${m.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', fontSize: '20px', fontWeight: 800, color: m.color }}>
                {isRtl ? m.nameAr.charAt(0) : m.nameEn.charAt(0)}
              </div>
              <p style={{ margin: '0 0 4px', fontSize: '14px', fontWeight: 700, color: '#f1f5f9' }}>{isRtl ? m.nameAr : m.nameEn}</p>
              <p style={{ margin: '0 0 8px', fontSize: '12px', color: '#475569' }}>{isRtl ? m.roleAr : m.roleEn}</p>
              <span style={{ fontSize: '11px', color: '#334155' }}>{isRtl ? m.locationAr : m.locationEn}</span>
            </motion.div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div style={{ textAlign: 'center', padding: '0 24px 100px' }}>
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          style={{ maxWidth: '560px', margin: '0 auto', padding: '56px 40px', background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: '24px' }}>
          <h2 style={{ margin: '0 0 12px', color: '#f1f5f9', fontSize: '24px', fontWeight: 700 }}>
            {isRtl ? 'انضم إلى 150+ شركة تثق بكوادر' : 'Join 150+ companies trusting Kwader'}
          </h2>
          <p style={{ margin: '0 0 28px', color: '#64748b', fontSize: '15px' }}>
            {isRtl ? 'تجربة مجانية 35 يوماً. لا حاجة لبطاقة ائتمان.' : '35-day free trial. No credit card required.'}
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/login" style={{ padding: '12px 28px', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', borderRadius: '10px', textDecoration: 'none', fontWeight: 700, fontSize: '14px' }}>
              {isRtl ? 'ابدأ مجاناً' : 'Start Free'}
            </Link>
            <Link to="/contact" style={{ padding: '12px 28px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', borderRadius: '10px', textDecoration: 'none', fontWeight: 600, fontSize: '14px' }}>
              {isRtl ? 'تحدث مع الفريق' : 'Talk to the team'}
            </Link>
          </div>
        </motion.div>
      </div>

      <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', padding: '24px', textAlign: 'center', fontSize: '13px', color: '#334155' }}>
        © {new Date().getFullYear()} Kwader, Inc. {isRtl ? 'جميع الحقوق محفوظة.' : 'All rights reserved.'}
      </div>
    </div>
  );
};

export default AboutUs;
