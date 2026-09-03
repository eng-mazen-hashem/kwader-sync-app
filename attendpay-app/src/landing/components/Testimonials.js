import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Star, Quote, PlusCircle } from "lucide-react";
import { useLanguage } from "../context/LanguageContext";
import { ReviewModal } from "./ReviewModal";
import { supabase } from "../../supabaseClient";

const staticTestimonials = [
  {
    name: "Eng. Tareq Al-Ghamdi",
    role: "Operations Director, Gulf Retail Group",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&h=80&fit=crop&crop=face",
    text_en: "Managing attendance across 5 retail branches used to be incredibly manual. Kwader's integration with biometric devices and automated rule builder cut our attendance processing time from 3 days to under an hour.",
    text_ar: "كانت إدارة حضور الموظفين عبر 5 فروع تجزئة مختلفة تتم يدوياً وتستغرق أياماً. أتمتة ربط أجهزة البصمة مع منشئ القوانين الذكي في كوادر قلصت وقت معالجة الحضور من 3 أيام إلى أقل من ساعة واحدة.",
  },
  {
    name: "Fatima Al-Marzooqi",
    role: "HR Manager, Tamkeen Solutions",
    avatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=80&h=80&fit=crop&crop=face",
    text_en: "Our previous system was too complicated for employees. Kwader's clean, multilingual interface has seen 100% adoption, and our HR team can now process payroll and allowances with a single click.",
    text_ar: "كان نظامنا السابق معقداً جداً للموظفين. واجهة كوادر النظيفة وثنائية اللغة حققت اعتماداً بنسبة 100٪ من فريقنا، وأصبح بإمكان فريق الموارد البشرية الآن معالجة كشوف المرتبات والبدلات بضغطة زر واحدة.",
  },
  {
    name: "Khalid Al-Otaibi",
    role: "CEO, Al-Riyadah Logistics",
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=80&h=80&fit=crop&crop=face",
    text_en: "As we scaled from 30 to 120 employees, keeping track of shifts and compliance was a major bottleneck. Kwader provided the exact structure we needed, keeping us 100% compliant with Saudi labor law.",
    text_ar: "مع توسعنا من 30 إلى 120 موظفاً، كان تتبع الورديات والامتثال يمثل عقبة كبيرة. وفرت لنا منصة كوادر الهيكل الدقيق الذي نحتاجه، مع الحفاظ على امتثالنا التام لنظام العمل السعودي.",
  },
];

export function Testimonials() {
  const { t, language } = useLanguage();
  const ts = t.testimonials;
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [dynamicReviews, setDynamicReviews] = useState([]);

  const fetchReviews = async () => {
    try {
      const { data, error } = await supabase
        .from('landing_reviews')
        .select('*')
        .eq('approved', true)
        .order('created_at', { ascending: false });
      
      if (!error && data) {
        setDynamicReviews(data);
      }
    } catch (err) {
      console.error("Error fetching reviews:", err);
    }
  };

  useEffect(() => {
    fetchReviews();
  }, []);

  // Merge static and dynamic reviews
  const allReviews = [...dynamicReviews.map(r => ({
    name: r.name,
    role: r.company,
    avatar: r.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(r.name)}&background=random`,
    text_en: r.review,
    text_ar: r.review,
    rating: r.rating
  })), ...staticTestimonials];

  return (
    <section id="testimonials" className="py-24 lg:py-32 overflow-hidden" style={{ background: "linear-gradient(180deg, #ffffff 0%, #f8faff 100%)" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 bg-amber-50 border border-amber-100 rounded-full px-4 py-1.5 mb-4"
          >
            <Star className="w-3.5 h-3.5 text-amber-500" fill="currentColor" />
            <span className="text-amber-600 text-sm" style={{ fontWeight: 600 }}>{ts.badge}</span>
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-gray-900 mb-4"
            style={{
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              fontWeight: 800,
              fontSize: "clamp(2rem, 4vw, 3rem)",
              lineHeight: 1.15,
              letterSpacing: "-0.02em",
            }}
          >
            {ts.headline1}{" "}
            <span className="bg-gradient-to-r from-amber-500 to-orange-500 bg-clip-text text-transparent">
              {ts.headline2}
            </span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-gray-500 max-w-xl mx-auto"
            style={{ fontSize: "1.125rem", lineHeight: 1.7 }}
          >
            {ts.subtext}
          </motion.p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {allReviews.map((tItem, index) => {
            const textKey = `text_${language}`;
            const text = tItem[textKey] || tItem.text_en;

            return (
              <motion.div
                key={`${tItem.name}-${index}`}
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.5, delay: index * 0.05 }}
                className="group relative backdrop-blur-xl border rounded-3xl p-8 hover:-translate-y-2 transition-all duration-500 overflow-hidden"
                style={{
                  background: "rgba(255, 255, 255, 0.7)",
                  borderColor: "rgba(229,231,235,0.7)",
                  boxShadow: "0 10px 40px -10px rgba(79,70,229,0.08)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = "0 25px 50px -12px rgba(79,70,229,0.25)";
                  e.currentTarget.style.borderColor = "#c7d2fe";
                  e.currentTarget.style.background = "rgba(255, 255, 255, 0.95)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = "0 10px 40px -10px rgba(79,70,229,0.08)";
                  e.currentTarget.style.borderColor = "rgba(229,231,235,0.7)";
                  e.currentTarget.style.background = "rgba(255, 255, 255, 0.7)";
                }}
              >
                <div className="absolute top-8 end-8 opacity-[0.03] group-hover:opacity-10 group-hover:scale-110 transition-all duration-500">
                  <Quote className="w-16 h-16 text-indigo-600" fill="currentColor" />
                </div>
                <div className="flex gap-1 mb-6">
                  {[...Array(tItem.rating || 5)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 text-amber-400" fill="currentColor" />
                  ))}
                </div>
                <p className="text-gray-700 mb-8 italic" style={{ fontSize: "1rem", lineHeight: 1.8 }}>
                  "{text}"
                </p>
                <div className="flex items-center gap-4 pt-6 border-t border-gray-50">
                  <img
                    src={tItem.avatar}
                    alt={tItem.name}
                    className="w-12 h-12 rounded-2xl object-cover ring-4 ring-gray-50 group-hover:ring-indigo-50 transition-all"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-gray-900 truncate" style={{ fontWeight: 800, fontSize: "0.95rem" }}>{tItem.name}</div>
                    <div className="text-indigo-600 truncate" style={{ fontSize: "0.85rem", fontWeight: 700 }}>{tItem.role}</div>
                  </div>
                </div>
              </motion.div>
            );
          })}

          {/* Creative Review Submission Card */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="relative overflow-hidden bg-gradient-to-br from-indigo-600 to-violet-700 rounded-3xl p-8 flex flex-col items-center justify-center text-center group cursor-pointer shadow-xl shadow-indigo-200"
            onClick={() => setIsModalOpen(true)}
          >
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:rotate-12 transition-transform">
               <PlusCircle size={120} className="text-white" />
            </div>
            <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-white/20 transition-all duration-300">
              <PlusCircle className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-white mb-3 text-xl" style={{ fontWeight: 800 }}>{ts.shareStory}</h3>
            <p className="text-indigo-100/80 text-sm mb-8 px-4" style={{ lineHeight: 1.6 }}>{ts.shareSub}</p>
            <button className="bg-white text-indigo-600 px-8 py-3 rounded-2xl text-sm hover:bg-indigo-50 transition-colors shadow-xl" style={{ fontWeight: 800 }}>
              {ts.submitReview}
            </button>
          </motion.div>
        </div>

        {/* Stats bar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
          className="mt-20 bg-gray-50 border border-gray-100 rounded-3xl p-8 lg:p-12 grid grid-cols-2 lg:grid-cols-4 gap-12"
        >
          {ts.stats.map((stat) => (
            <div key={stat.label} className="text-center">
              <div
                className="text-gray-900 mb-2"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, fontSize: "2.5rem", letterSpacing: '-0.02em' }}
              >
                {stat.value}
              </div>
              <div className="text-indigo-600 mb-1" style={{ fontWeight: 700, fontSize: "0.95rem" }}>{stat.label}</div>
              <div className="text-gray-400" style={{ fontSize: "0.85rem" }}>{stat.sub}</div>
            </div>
          ))}
        </motion.div>
      </div>

      <ReviewModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onReviewAdded={fetchReviews}
      />
    </section>
  );
}
