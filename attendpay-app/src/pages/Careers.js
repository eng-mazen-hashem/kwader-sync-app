import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { useLocale } from '../context/LocaleContext';
import { ArrowLeft, ArrowRight, MapPin, Clock, Zap, Users, Globe, TrendingUp, ChevronRight, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const JOBS = [
  {
    titleAr: 'مطور خلفية أول (Backend)',
    titleEn: 'Senior Backend Engineer',
    teamAr: 'الهندسة',
    teamEn: 'Engineering',
    typeAr: 'دوام كامل',
    typeEn: 'Full-time',
    locationAr: 'الرياض أو عن بُعد',
    locationEn: 'Riyadh or Remote',
    tag: 'hot',
    color: '#6366f1',
  },
  {
    titleAr: 'مصمم منتج UX/UI',
    titleEn: 'Product Designer (UX/UI)',
    teamAr: 'التصميم',
    teamEn: 'Design',
    typeAr: 'دوام كامل',
    typeEn: 'Full-time',
    locationAr: 'دبي أو عن بُعد',
    locationEn: 'Dubai or Remote',
    tag: '',
    color: '#8b5cf6',
  },
  {
    titleAr: 'مدير حسابات (Account Executive)',
    titleEn: 'Account Executive',
    teamAr: 'المبيعات',
    teamEn: 'Sales',
    typeAr: 'دوام كامل',
    typeEn: 'Full-time',
    locationAr: 'الرياض',
    locationEn: 'Riyadh',
    tag: '',
    color: '#10b981',
  },
  {
    titleAr: 'متخصص دعم عملاء',
    titleEn: 'Customer Support Specialist',
    teamAr: 'نجاح العملاء',
    teamEn: 'Customer Success',
    typeAr: 'دوام كامل',
    typeEn: 'Full-time',
    locationAr: 'عن بُعد',
    locationEn: 'Remote',
    tag: '',
    color: '#06b6d4',
  },
  {
    titleAr: 'مهندس بيانات (Data Engineer)',
    titleEn: 'Data Engineer',
    teamAr: 'الهندسة',
    teamEn: 'Engineering',
    typeAr: 'دوام كامل',
    typeEn: 'Full-time',
    locationAr: 'الرياض أو عن بُعد',
    locationEn: 'Riyadh or Remote',
    tag: 'new',
    color: '#f59e0b',
  },
  {
    titleAr: 'مدير شراكات الموزعين',
    titleEn: 'Reseller Partnerships Manager',
    teamAr: 'الشراكات',
    teamEn: 'Partnerships',
    typeAr: 'دوام كامل',
    typeEn: 'Full-time',
    locationAr: 'الرياض أو دبي',
    locationEn: 'Riyadh or Dubai',
    tag: '',
    color: '#ec4899',
  },
];

const PERKS = [
  { emoji: '🏖️', titleAr: 'إجازة مرنة', titleEn: 'Flexible PTO', descAr: 'استراحات مدفوعة عند الحاجة', descEn: 'Paid time off when you need it' },
  { emoji: '💻', titleAr: 'معدات احترافية', titleEn: 'Premium gear', descAr: 'MacBook Pro وأدوات العمل الكاملة', descEn: 'MacBook Pro & full work setup' },
  { emoji: '🌍', titleAr: 'عمل عن بُعد', titleEn: 'Remote-first', descAr: 'اعمل من أي مكان في العالم', descEn: 'Work from anywhere in the world' },
  { emoji: '📈', titleAr: 'خيارات أسهم', titleEn: 'Stock options', descAr: 'شارك في نمو الشركة', descEn: 'Share in the company\'s growth' },
  { emoji: '🎓', titleAr: 'تطوير مهني', titleEn: 'Learning budget', descAr: 'ميزانية سنوية للتدريب والمؤتمرات', descEn: 'Annual budget for training & conferences' },
  { emoji: '🏥', titleAr: 'تأمين صحي', titleEn: 'Health coverage', descAr: 'تغطية طبية شاملة للموظف والعائلة', descEn: 'Full medical coverage for you & family' },
];

function NavBar({ isRtl, navigate }) {
  return (
    <div style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(6,8,15,0.85)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '60px' }}>
      <button onClick={() => navigate(-1)} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#94a3b8', cursor: 'pointer', padding: '7px 16px', borderRadius: '8px', fontSize: '13px', fontFamily: 'inherit' }}
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
      <a href="mailto:careers@kwader.io" style={{ fontSize: '13px', color: '#64748b', textDecoration: 'none' }}
        onMouseEnter={e => e.currentTarget.style.color = '#c7d2fe'}
        onMouseLeave={e => e.currentTarget.style.color = '#64748b'}
      >careers@kwader.io</a>
    </div>
  );
}

const Careers = () => {
  const { language } = useLocale();
  const isRtl = language === 'ar';
  const navigate = useNavigate();
  const [filter, setFilter] = useState('all');
  useEffect(() => { window.scrollTo(0, 0); }, []);

  const teams = ['all', ...new Set(JOBS.map(j => isRtl ? j.teamAr : j.teamEn))];
  const filtered = filter === 'all' ? JOBS : JOBS.filter(j => (isRtl ? j.teamAr : j.teamEn) === filter);

  return (
    <div dir={isRtl ? 'rtl' : 'ltr'} style={{ minHeight: '100vh', background: 'linear-gradient(180deg,#06080f 0%,#0a0d18 100%)', color: '#94a3b8', fontFamily: "'Inter','Cairo',system-ui,sans-serif", overflowX: 'hidden' }}>
      <NavBar isRtl={isRtl} navigate={navigate} />

      {/* Hero */}
      <div style={{ position: 'relative', padding: '100px 24px 80px', textAlign: 'center', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 70% 50% at 50% 0%,rgba(139,92,246,0.1) 0%,transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: '600px', height: '1px', background: 'linear-gradient(90deg,transparent,rgba(139,92,246,0.6),transparent)' }} />

        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} style={{ maxWidth: '680px', margin: '0 auto' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 16px', borderRadius: '20px', background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)', marginBottom: '24px' }}>
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 8px #10b981', animation: 'pulse 2s infinite' }} />
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#a78bfa' }}>{isRtl ? `${JOBS.length} وظائف متاحة` : `${JOBS.length} Open Positions`}</span>
          </div>
          <h1 style={{ margin: '0 0 20px', color: '#f1f5f9', fontSize: 'clamp(2rem,5vw,3.2rem)', fontWeight: 800, letterSpacing: '-0.5px', lineHeight: 1.1 }}>
            {isRtl ? 'ابنِ مستقبل الموارد البشرية معنا' : 'Build the future of HR with us'}
          </h1>
          <p style={{ fontSize: '17px', lineHeight: '1.7', color: '#64748b', margin: '0 0 12px' }}>
            {isRtl
              ? 'نحن فريق صغير يبني منتجاً كبير الأثر. إذا كنت تؤمن بقوة الأتمتة والتصميم الرائع، فأنت في المكان الصحيح.'
              : 'We\'re a small team building a big impact product. If you believe in automation and great design, you\'re in the right place.'}
          </p>
        </motion.div>
      </div>

      {/* Perks */}
      <div style={{ background: 'rgba(255,255,255,0.01)', borderTop: '1px solid rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.05)', padding: '60px 24px' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <h2 style={{ textAlign: 'center', margin: '0 0 40px', color: '#f1f5f9', fontSize: '22px', fontWeight: 700 }}>
            {isRtl ? '💼 ما نقدمه لك' : '💼 What we offer'}
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '16px' }}>
            {PERKS.map((p, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.07 }}
                style={{ padding: '20px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '14px', display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '22px', flexShrink: 0 }}>{p.emoji}</span>
                <div>
                  <p style={{ margin: '0 0 4px', fontSize: '14px', fontWeight: 700, color: '#e2e8f0' }}>{isRtl ? p.titleAr : p.titleEn}</p>
                  <p style={{ margin: 0, fontSize: '12.5px', color: '#475569' }}>{isRtl ? p.descAr : p.descEn}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Jobs */}
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '60px 24px 80px' }}>
        <h2 style={{ margin: '0 0 28px', color: '#f1f5f9', fontSize: '22px', fontWeight: 700 }}>
          {isRtl ? '🔍 الوظائف المتاحة' : '🔍 Open Positions'}
        </h2>

        {/* Filter chips */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '28px' }}>
          {teams.map(t => (
            <button key={t} onClick={() => setFilter(t)} style={{
              padding: '6px 16px', borderRadius: '20px', border: '1px solid',
              borderColor: filter === t ? '#6366f1' : 'rgba(255,255,255,0.08)',
              background: filter === t ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.03)',
              color: filter === t ? '#a5b4fc' : '#475569', cursor: 'pointer', fontSize: '13px',
              fontFamily: 'inherit', transition: 'all 0.15s',
            }}>
              {t === 'all' ? (isRtl ? 'الكل' : 'All') : t}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {filtered.map((job, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              style={{ padding: '24px 28px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', cursor: 'pointer', transition: 'border-color 0.2s, background 0.2s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = `${job.color}30`; e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: job.color, flexShrink: 0 }} />
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ fontSize: '15px', fontWeight: 700, color: '#f1f5f9' }}>{isRtl ? job.titleAr : job.titleEn}</span>
                    {job.tag === 'hot' && <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', background: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>🔥 HOT</span>}
                    {job.tag === 'new' && <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', background: 'rgba(16,185,129,0.15)', color: '#34d399', border: '1px solid rgba(16,185,129,0.2)' }}>NEW</span>}
                  </div>
                  <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '12.5px', color: '#475569' }}>{isRtl ? job.teamAr : job.teamEn}</span>
                    <span style={{ fontSize: '12.5px', color: '#334155' }}>·</span>
                    <span style={{ fontSize: '12.5px', color: '#475569', display: 'flex', alignItems: 'center', gap: '4px' }}><MapPin size={11} />{isRtl ? job.locationAr : job.locationEn}</span>
                    <span style={{ fontSize: '12.5px', color: '#334155' }}>·</span>
                    <span style={{ fontSize: '12.5px', color: '#475569', display: 'flex', alignItems: 'center', gap: '4px' }}><Clock size={11} />{isRtl ? job.typeAr : job.typeEn}</span>
                  </div>
                </div>
              </div>
              <a href={`mailto:careers@kwader.io?subject=Application: ${job.titleEn}`}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 18px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#94a3b8', textDecoration: 'none', fontSize: '13px', fontWeight: 600, flexShrink: 0, transition: 'all 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.15)'; e.currentTarget.style.color = '#a5b4fc'; e.currentTarget.style.borderColor = 'rgba(99,102,241,0.3)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}
              >
                {isRtl ? 'تقدم الآن' : 'Apply'} <ChevronRight size={14} />
              </a>
            </motion.div>
          ))}
        </div>

        {/* Open application */}
        <div style={{ marginTop: '32px', padding: '28px', background: 'rgba(139,92,246,0.04)', border: '1px dashed rgba(139,92,246,0.2)', borderRadius: '14px', textAlign: 'center' }}>
          <p style={{ margin: '0 0 8px', fontSize: '15px', fontWeight: 600, color: '#e2e8f0' }}>
            {isRtl ? '💌 لم تجد الوظيفة المناسبة؟' : '💌 Don\'t see the right role?'}
          </p>
          <p style={{ margin: '0 0 16px', fontSize: '13.5px', color: '#64748b' }}>
            {isRtl ? 'أرسل لنا طلباً مفتوحاً وسنتواصل معك عند توفر فرصة مناسبة.' : 'Send us an open application and we\'ll reach out when the right opportunity comes up.'}
          </p>
          <a href="mailto:careers@kwader.io?subject=Open Application" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '10px 22px', borderRadius: '8px', background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)', color: '#a78bfa', textDecoration: 'none', fontSize: '13.5px', fontWeight: 600 }}>
            careers@kwader.io <ExternalLink size={13} />
          </a>
        </div>
      </div>

      <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', padding: '24px', textAlign: 'center', fontSize: '13px', color: '#334155' }}>
        © {new Date().getFullYear()} Kwader, Inc. {isRtl ? 'جميع الحقوق محفوظة.' : 'All rights reserved.'}
      </div>

      <style>{`@keyframes pulse { 0%,100%{opacity:1;box-shadow:0 0 8px #10b981} 50%{opacity:0.6;box-shadow:0 0 16px #10b981} }`}</style>
    </div>
  );
};

export default Careers;
