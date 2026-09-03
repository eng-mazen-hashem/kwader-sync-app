import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Star, CheckCircle2, Loader2, Sparkles, Building2, User, MessageCircle, Heart } from "lucide-react";
import { supabase } from "../../supabaseClient";
import { useLanguage } from "../context/LanguageContext";
import { toast } from "sonner";

export function ReviewModal({ isOpen, onClose, onReviewAdded }) {
  const { language } = useLanguage();
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [formData, setFormData] = useState({ name: "", company: "", review: "" });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    // constitution §9: no alert() — use toast
    if (rating === 0) {
      toast.warning(language === 'ar' ? "يرجى اختيار عدد النجوم" : "Please select a star rating");
      return;
    }
    
    setLoading(true);
    const { error } = await supabase
      .from('landing_reviews')
      .insert([
        { ...formData, rating, approved: true }
      ]);

    if (!error) {
      setSuccess(true);
      setTimeout(() => {
        onReviewAdded();
        onClose();
        setSuccess(false);
        setRating(0);
        setFormData({ name: "", company: "", review: "" });
      }, 2500);
    }
    setLoading(false);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-[8px]">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 40 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 40 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="relative w-full max-w-lg bg-white rounded-[2.5rem] shadow-[0_20px_60px_-15px_rgba(79,70,229,0.25)] overflow-hidden border border-white/40 flex flex-col max-h-[90vh]"
        >
          {/* Top Design Element */}
          <div className="absolute top-0 left-0 right-0 h-48 bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-800 -z-0 pointer-events-none">
            <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '24px 24px' }} />
            <motion.div 
               animate={{ rotate: 360 }} 
               transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
               className="absolute top-[-50%] right-[-10%] w-64 h-64 bg-white/10 rounded-full blur-3xl pointer-events-none" 
            />
          </div>

          {/* Close Button */}
          <button 
            onClick={onClose} 
            className="absolute top-5 transition-transform hover:scale-110 active:scale-95 z-20"
            style={{ [language === 'ar' ? 'left' : 'right']: '1.25rem' }}
          >
            <div className="p-2 bg-white/20 backdrop-blur-md rounded-xl text-white hover:bg-white/30 transition-colors">
              <X className="w-5 h-5" />
            </div>
          </button>

          {/* Scrollable Content Container */}
          <div className="relative z-10 flex flex-col flex-1 overflow-hidden pt-10">
            {/* Header Text */}
            <div className="px-8 pb-6 text-center">
               <motion.div 
                 initial={{ opacity: 0, y: -10 }}
                 animate={{ opacity: 1, y: 0 }}
                 transition={{ delay: 0.2 }}
                 className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-white/90 text-[10px] uppercase font-bold tracking-[0.2em] border border-white/10 mb-4"
               >
                 <Heart className="w-3 h-3 fill-rose-500 text-rose-500" />
                 {language === 'ar' ? "تغذية راجعة حقيقية" : "Genuine Feedback"}
               </motion.div>
               <h2 className="text-3xl text-white tracking-tight" style={{ fontWeight: 800, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                  {language === 'ar' ? "شارك تجربتك" : "Share Your Story"}
               </h2>
               <p className="text-indigo-100/70 text-sm mt-2 font-medium max-w-[280px] mx-auto">
                 {language === 'ar' ? "رأيك يساعدنا في بناء مستقبل أفضل لإدارة الموارد البشرية" : "Help us build the next generation of modern HR tools"}
               </p>
            </div>

            {/* Form Area - Scrollable */}
            <div className="flex-1 overflow-y-auto px-8 pb-8 custom-scrollbar">
              <form onSubmit={handleSubmit} className="space-y-6 pt-2">
                {success ? (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.8 }} 
                    animate={{ opacity: 1, scale: 1 }} 
                    className="py-16 text-center bg-emerald-50/50 rounded-[2rem] border border-emerald-100"
                  >
                     <div className="relative inline-block mb-6">
                        <CheckCircle2 className="w-20 h-20 text-emerald-500 relative z-10" />
                        <motion.div 
                          animate={{ scale: [1, 1.5, 1], opacity: [0.3, 0, 0.3] }}
                          transition={{ repeat: Infinity, duration: 2 }}
                          className="absolute inset-0 bg-emerald-500/20 rounded-full blur-xl"
                        />
                     </div>
                     <h3 className="text-2xl text-gray-900" style={{ fontWeight: 800 }}>{language === 'ar' ? "تم الإرسال بنجاح!" : "You're Awesome!"}</h3>
                     <p className="text-gray-500 mt-2 px-8">{language === 'ar' ? "شكراً لمساهمتك في تطوير كوادر" : "Your review has been successfully submitted to our wall of love."}</p>
                  </motion.div>
                ) : (
                  <>
                    {/* Creative Star Interaction */}
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 }}
                      className="p-6 bg-gray-50 rounded-[2rem] border border-gray-100 shadow-inner group"
                    >
                      <label className="block text-center text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">
                        {language === 'ar' ? "تقييمك لمستوى الخدمة" : "Rate your experience"}
                      </label>
                      <div className="flex justify-center gap-1.5">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <motion.button
                            key={s}
                            type="button"
                            whileHover={{ scale: 1.25, rotate: s % 2 === 0 ? 10 : -10 }}
                            whileTap={{ scale: 0.9 }}
                            onMouseEnter={() => setHoveredRating(s)}
                            onMouseLeave={() => setHoveredRating(0)}
                            onClick={() => setRating(s)}
                            className="relative"
                          >
                            <Star 
                              className={`w-10 h-10 transition-all duration-500 ${
                                (hoveredRating || rating) >= s 
                                ? "text-amber-400 fill-amber-400 drop-shadow-[0_0_12px_rgba(251,191,36,0.5)]" 
                                : "text-gray-200 fill-transparent"
                              }`} 
                              strokeWidth={1.5}
                            />
                            {rating === s && (
                              <motion.div layoutId="spark" className="absolute -inset-1 border-2 border-amber-400/30 rounded-full" />
                            )}
                          </motion.button>
                        ))}
                      </div>
                    </motion.div>

                    {/* Inputs */}
                    <div className="grid grid-cols-2 gap-4">
                       <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 }} className="space-y-2">
                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1 flex items-center gap-2">
                            <User className="w-3 h-3 text-indigo-500" /> {language === 'ar' ? "اسمك الكامل" : "Full Name"}
                          </label>
                          <input 
                            required
                            className="w-full px-5 py-4 rounded-2xl bg-gray-50/50 border border-gray-100 focus:border-indigo-500 focus:bg-white focus:shadow-lg focus:shadow-indigo-500/5 transition-all outline-none text-gray-900 font-medium"
                            placeholder={language === 'ar' ? "مازن هاشم" : "John Doe"}
                            value={formData.name}
                            onChange={(e) => setFormData({...formData, name: e.target.value})}
                          />
                       </motion.div>
                       <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 }} className="space-y-2">
                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1 flex items-center gap-2">
                            <Building2 className="w-3 h-3 text-indigo-500" /> {language === 'ar' ? "اسم المنشأة" : "Company Name"}
                          </label>
                          <input 
                            required
                            className="w-full px-5 py-4 rounded-2xl bg-gray-50/50 border border-gray-100 focus:border-indigo-500 focus:bg-white focus:shadow-lg focus:shadow-indigo-500/5 transition-all outline-none text-gray-900 font-medium"
                            placeholder={language === 'ar' ? "اسم شركتك" : "Acmex"}
                            value={formData.company}
                            onChange={(e) => setFormData({...formData, company: e.target.value})}
                          />
                       </motion.div>
                    </div>

                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} className="space-y-2">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1 flex items-center gap-2">
                        <MessageCircle className="w-3 h-3 text-indigo-500" /> {language === 'ar' ? "حدثنا عن تجربتك" : "Share your story"}
                      </label>
                      <textarea 
                        required
                        rows={4}
                        className="w-full px-5 py-4 rounded-[2rem] bg-gray-50/50 border border-gray-100 focus:border-indigo-500 focus:bg-white focus:shadow-lg focus:shadow-indigo-500/5 transition-all outline-none text-gray-900 font-medium resize-none"
                        placeholder={language === 'ar' ? "كيف ساعدك كوادر؟" : "How was your transition to Kwader?"}
                        value={formData.review}
                        onChange={(e) => setFormData({...formData, review: e.target.value})}
                      />
                    </motion.div>

                    <motion.button
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.7 }}
                      type="submit"
                      disabled={loading}
                      className="w-full py-5 rounded-[2rem] bg-gradient-to-r from-indigo-600 via-indigo-700 to-violet-700 text-white shadow-xl shadow-indigo-500/30 hover:shadow-indigo-500/50 hover:-translate-y-1 active:translate-y-0 transition-all font-bold tracking-wide disabled:opacity-50"
                    >
                      {loading ? (
                        <div className="flex items-center justify-center gap-2">
                           <Loader2 className="w-5 h-5 animate-spin" />
                           <span>{language === 'ar' ? "جاري الإرسال..." : "Sending..."}</span>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-2">
                           <span>{language === 'ar' ? "نشر المراجعة الآن" : "Post My Success Story"}</span>
                           <Sparkles className="w-4 h-4" />
                        </div>
                      )}
                    </motion.button>
                  </>
                )}
              </form>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
