import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { useLocale } from '../context/LocaleContext';
import { ArrowLeft, ArrowRight, Mail, Phone, MessageCircle, MapPin, CheckCircle2, Send, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '../supabaseClient';



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
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#10b981' }}>
        <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 6px #10b981', flexShrink: 0 }} />
        {isRtl ? 'متاح الآن' : 'Online now'}
      </div>
    </div>
  );
}

const ContactUs = () => {
  const { language } = useLocale();
  const isRtl = language === 'ar';
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', company: '', type: 'general', message: '' });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  // Dynamic Contact Info states
  const [supportEmail, setSupportEmail] = useState("support@kwader.io");
  const [contactPhone, setContactPhone] = useState("+201098869806");
  const [contactWhatsapp, setContactWhatsapp] = useState("201098869806");
  const [offices, setOffices] = useState([
    { cityAr: 'القاهرة', cityEn: 'Cairo', flag: '🇪🇬', addressAr: 'القرية الذكية، الجيزة، مصر', addressEn: 'Smart Village, Giza, Egypt' },
    { cityAr: 'الرياض', cityEn: 'Riyadh', flag: '🇸🇦', addressAr: 'طريق الملك فهد، حي العليا، الرياض', addressEn: 'King Fahd Road, Al Olaya District, Riyadh' },
    { cityAr: 'دبي', cityEn: 'Dubai', flag: '🇦🇪', addressAr: 'مركز دبي المالي العالمي، دبي', addressEn: 'Dubai International Financial Centre, Dubai' },
  ]);

  useEffect(() => {
    window.scrollTo(0, 0);
    
    // Fetch contact details from system_settings
    const fetchSettings = async () => {
      try {
        const { data, error } = await supabase
          .from('system_settings')
          .select('key, value');
        if (!error && data) {
          data.forEach(item => {
            if (item.key === 'support_email' && item.value) setSupportEmail(item.value);
            if (item.key === 'contact_phone' && item.value) setContactPhone(item.value);
            if (item.key === 'contact_whatsapp' && item.value) setContactWhatsapp(item.value);
            if (item.key === 'contact_offices') {
              if (Array.isArray(item.value) && item.value.length > 0) {
                setOffices(item.value);
              }
            }
          });
        }
      } catch (err) {
        console.error("Failed to fetch contact settings:", err);
      }
    };
    
    fetchSettings();
  }, []);

  const dynamicChannels = [
    {
      icon: MessageCircle,
      color: '#6366f1',
      titleAr: 'دردشة مباشرة',
      titleEn: 'Live Chat',
      descAr: 'تحدث معنا مباشرة على الواتساب للحصول على دعم فوري',
      descEn: 'Chat with us directly on WhatsApp for instant support',
      actionAr: 'ابدأ المحادثة',
      actionEn: 'Start Chat',
      href: contactWhatsapp.startsWith('http') ? contactWhatsapp : (contactWhatsapp ? `https://wa.me/${contactWhatsapp.replace(/[^0-9]/g, '')}` : '#'),
      badge: 'FAST',
      badgeColor: '#10b981',
    },
    {
      icon: Mail,
      color: '#8b5cf6',
      titleAr: 'البريد الإلكتروني',
      titleEn: 'Email Support',
      descAr: 'ردود مفصلة خلال 24 ساعة كحد أقصى',
      descEn: 'Detailed responses within 24 hours maximum',
      actionAr: 'أرسل رسالة',
      actionEn: 'Send Email',
      href: `mailto:${supportEmail}`,
      badge: '',
      badgeColor: '',
    },
    {
      icon: Phone,
      color: '#06b6d4',
      titleAr: 'اتصال مباشر',
      titleEn: 'Phone Support',
      descAr: 'اتصل بنا مباشرة للتحدث مع ممثلي الخدمة',
      descEn: 'Call us directly to speak with our support team',
      actionAr: 'اتصل بنا',
      actionEn: 'Call Us',
      href: `tel:${contactPhone}`,
      badge: 'PRO',
      badgeColor: '#f59e0b',
    },
  ];

  const handleSubmit = (e) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setSubmitted(true);
    }, 1500);
  };

  const types = [
    { value: 'general', labelAr: 'استفسار عام', labelEn: 'General Inquiry' },
    { value: 'sales', labelAr: 'طلب عرض سعر', labelEn: 'Sales / Pricing' },
    { value: 'support', labelAr: 'دعم تقني', labelEn: 'Technical Support' },
    { value: 'partnership', labelAr: 'شراكة أو موزع', labelEn: 'Partnership / Reseller' },
  ];

  return (
    <div dir={isRtl ? 'rtl' : 'ltr'} style={{ minHeight: '100vh', background: 'linear-gradient(180deg,#06080f 0%,#0a0d18 100%)', color: '#94a3b8', fontFamily: "'Inter','Cairo',system-ui,sans-serif", overflowX: 'hidden' }}>
      <NavBar isRtl={isRtl} navigate={navigate} />

      {/* Hero */}
      <div style={{ position: 'relative', padding: '80px 24px 60px', textAlign: 'center', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 70% 50% at 50% 0%,rgba(6,182,212,0.08) 0%,transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: '600px', height: '1px', background: 'linear-gradient(90deg,transparent,rgba(6,182,212,0.5),transparent)' }} />
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <h1 style={{ margin: '0 0 16px', color: '#f1f5f9', fontSize: 'clamp(2rem,5vw,3rem)', fontWeight: 800, letterSpacing: '-0.5px' }}>
            {isRtl ? 'نسعد بمساعدتك 👋' : 'We\'re here to help 👋'}
          </h1>
          <p style={{ fontSize: '17px', lineHeight: '1.7', color: '#64748b', maxWidth: '500px', margin: '0 auto' }}>
            {isRtl ? 'فريقنا متاح للرد على استفساراتك في أسرع وقت ممكن.' : 'Our team is ready to answer your questions as quickly as possible.'}
          </p>
        </motion.div>
      </div>

      {/* Channels */}
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '0 24px 60px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '16px', marginBottom: '60px' }}>
          {dynamicChannels.map((ch, i) => {
            const Icon = ch.icon;
            const isPlaceholder = ch.href === '#';
            return (
              <motion.a 
                key={i} 
                href={ch.href} 
                onClick={(e) => {
                  if (isPlaceholder) {
                    e.preventDefault();
                    toast.info(
                      isRtl
                        ? 'الدردشة المباشرة متوفرة داخل لوحة التحكم بعد تسجيل الدخول.'
                        : 'Live chat is available inside the dashboard after logging in.'
                    );
                  }
                }}
                initial={{ opacity: 0, y: 20 }} 
                animate={{ opacity: 1, y: 0 }} 
                transition={{ delay: i * 0.1 }}
                style={{ padding: '28px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', textDecoration: 'none', display: 'block', transition: 'all 0.2s', cursor: 'pointer' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = `${ch.color}30`; e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                  <div style={{ width: '42px', height: '42px', borderRadius: '11px', background: `${ch.color}15`, border: `1px solid ${ch.color}25`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: ch.color }}>
                    <Icon size={18} strokeWidth={1.8} />
                  </div>
                  {ch.badge && (
                    <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', background: `${ch.badgeColor}15`, color: ch.badgeColor, border: `1px solid ${ch.badgeColor}25` }}>{ch.badge}</span>
                  )}
                </div>
                <h3 style={{ margin: '0 0 8px', fontSize: '15px', fontWeight: 700, color: '#f1f5f9' }}>{isRtl ? ch.titleAr : ch.titleEn}</h3>
                <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#64748b', lineHeight: '1.6' }}>{isRtl ? ch.descAr : ch.descEn}</p>
                <span style={{ fontSize: '13px', fontWeight: 600, color: ch.color }}>
                  {isRtl ? ch.actionAr : ch.actionEn} →
                </span>
              </motion.a>
            );
          })}
        </div>

        {/* Form + Info grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '32px', alignItems: 'start' }}>
          {/* Contact Form */}
          <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '20px', padding: '36px' }}>
            <h2 style={{ margin: '0 0 24px', color: '#f1f5f9', fontSize: '20px', fontWeight: 700 }}>
              {isRtl ? '📬 أرسل لنا رسالة' : '📬 Send us a message'}
            </h2>

            {submitted ? (
              <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                <CheckCircle2 size={48} style={{ color: '#10b981', marginBottom: '16px' }} />
                <h3 style={{ color: '#f1f5f9', margin: '0 0 8px' }}>{isRtl ? 'تم الإرسال بنجاح!' : 'Message sent!'}</h3>
                <p style={{ color: '#64748b', margin: 0 }}>{isRtl ? 'سيتواصل معك فريقنا خلال 24 ساعة.' : 'Our team will get back to you within 24 hours.'}</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  {[
                    { key: 'name', typeEn: 'text', labelAr: 'الاسم الكامل', labelEn: 'Full Name', required: true },
                    { key: 'email', typeEn: 'email', labelAr: 'البريد الإلكتروني', labelEn: 'Email Address', required: true },
                  ].map(f => (
                    <div key={f.key}>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        {isRtl ? f.labelAr : f.labelEn}
                      </label>
                      <input type={f.typeEn} value={form[f.key]} onChange={e => setForm({ ...form, [f.key]: e.target.value })} required={f.required}
                        style={{ width: '100%', padding: '11px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', color: '#f1f5f9', fontSize: '14px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
                        onFocus={e => e.target.style.borderColor = 'rgba(99,102,241,0.5)'}
                        onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
                      />
                    </div>
                  ))}
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    {isRtl ? 'الشركة' : 'Company'}
                  </label>
                  <input type="text" value={form.company} onChange={e => setForm({ ...form, company: e.target.value })}
                    style={{ width: '100%', padding: '11px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', color: '#f1f5f9', fontSize: '14px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
                    onFocus={e => e.target.style.borderColor = 'rgba(99,102,241,0.5)'}
                    onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    {isRtl ? 'نوع الاستفسار' : 'Inquiry Type'}
                  </label>
                  <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}
                    style={{ width: '100%', padding: '11px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', color: '#94a3b8', fontSize: '14px', fontFamily: 'inherit', outline: 'none', cursor: 'pointer' }}>
                    {types.map(t => <option key={t.value} value={t.value} style={{ background: '#1e293b' }}>{isRtl ? t.labelAr : t.labelEn}</option>)}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    {isRtl ? 'رسالتك' : 'Your Message'}
                  </label>
                  <textarea value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} required rows={4}
                    style={{ width: '100%', padding: '11px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', color: '#f1f5f9', fontSize: '14px', fontFamily: 'inherit', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}
                    onFocus={e => e.target.style.borderColor = 'rgba(99,102,241,0.5)'}
                    onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
                  />
                </div>

                <button type="submit" disabled={loading}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '13px', background: loading ? 'rgba(99,102,241,0.5)' : 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', transition: 'opacity 0.2s' }}>
                  {loading ? (isRtl ? 'جارٍ الإرسال...' : 'Sending...') : (<>{isRtl ? 'أرسل الرسالة' : 'Send Message'} <Send size={15} /></>)}
                </button>
              </form>
            )}
          </motion.div>

          {/* Side Info */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Hours */}
            <motion.div initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
              style={{ padding: '24px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                <Clock size={16} style={{ color: '#6366f1' }} />
                <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#f1f5f9' }}>{isRtl ? 'ساعات الدعم' : 'Support Hours'}</h3>
              </div>
              {[
                { dayAr: 'الأحد - الخميس', dayEn: 'Sun – Thu', hours: '9:00 AM – 6:00 PM GST' },
                { dayAr: 'الجمعة - السبت', dayEn: 'Fri – Sat', hoursAr: 'بريد إلكتروني فقط', hoursEn: 'Email only' },
              ].map((h, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: i < 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                  <span style={{ fontSize: '13px', color: '#64748b' }}>{isRtl ? h.dayAr : h.dayEn}</span>
                  <span style={{ fontSize: '13px', color: '#94a3b8', fontWeight: 500 }}>{h.hours || (isRtl ? h.hoursAr : h.hoursEn)}</span>
                </div>
              ))}
            </motion.div>

            {/* Offices */}
            {offices.map((o, i) => (
              <motion.div key={i} initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 + i * 0.05 }}
                style={{ padding: '20px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <span style={{ fontSize: '20px' }}>{o.flag}</span>
                  <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#f1f5f9' }}>{isRtl ? (o.cityAr || o.city) : (o.cityEn || o.city)}</h4>
                </div>
                <p style={{ margin: 0, fontSize: '12.5px', color: '#475569', display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                  <MapPin size={12} style={{ color: '#6366f1', marginTop: '2px', flexShrink: 0 }} />
                  {isRtl ? o.addressAr : o.addressEn}
                </p>
              </motion.div>
            ))}

            {/* Direct email */}
            <motion.a href={`mailto:${supportEmail}`} initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
              style={{ padding: '20px', background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: '14px', textDecoration: 'none', display: 'block', textAlign: 'center' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(99,102,241,0.08)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(99,102,241,0.05)'}
            >
              <Mail size={20} style={{ color: '#818cf8', marginBottom: '8px' }} />
              <p style={{ margin: '0 0 2px', fontSize: '13px', fontWeight: 600, color: '#f1f5f9' }}>{supportEmail}</p>
              <p style={{ margin: 0, fontSize: '12px', color: '#475569' }}>{isRtl ? 'للاستفسارات العامة' : 'For general inquiries'}</p>
            </motion.a>
          </div>
        </div>
      </div>

      <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', padding: '24px', textAlign: 'center', fontSize: '13px', color: '#334155' }}>
        © {new Date().getFullYear()} Kwader, Inc. {isRtl ? 'جميع الحقوق محفوظة.' : 'All rights reserved.'}
      </div>
    </div>
  );
};

export default ContactUs;
