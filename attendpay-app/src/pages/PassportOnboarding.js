import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, CheckCircle, Briefcase, MapPin, DollarSign, Star, Award } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSEO } from '../utils/useSEO';

const skillsList = [
  'CNC Laser Operator',
  'Arc Welding',
  'Industrial Maintenance',
  'PLC Programming',
  'Heavy Machinery Operation',
  'Quality Control (ISO)',
  'Electrical Wiring',
];

export default function PassportOnboarding() {
  useSEO({
    title: 'أنشئ جواز مهاراتك الرقمي مجاناً | منصة كوادر KWADER',
    description: 'وثّق مهاراتك الفنية وخبراتك العملية بجواز كفاءة رقمي معتمد يربطك بأفضل فرص العمل في المصانع والشركات الكبرى.',
    canonical: 'https://kwader.app/passport-onboarding',
    lang: 'ar',
  });

  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    profession: '',
    location: '',
    salary: '',
    selectedSkills: [],
    skillRatings: {}
  });
  
  const navigate = useNavigate();

  const handleNext = () => {
    if (step < 4) setStep(step + 1);
    if (step === 4) {
      // Simulate saving and redirecting to the generated passport
      setTimeout(() => {
        navigate('/demo-passport');
      }, 1500);
    }
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const toggleSkill = (skill) => {
    setFormData(prev => {
      const isSelected = prev.selectedSkills.includes(skill);
      return {
        ...prev,
        selectedSkills: isSelected 
          ? prev.selectedSkills.filter(s => s !== skill)
          : [...prev.selectedSkills, skill]
      };
    });
  };

  const updateRating = (skill, rating) => {
    setFormData(prev => ({
      ...prev,
      skillRatings: { ...prev.skillRatings, [skill]: rating }
    }));
  };

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex justify-center items-center p-4 font-sans ar" dir="rtl">
      <div className="w-full max-w-[500px] bg-[var(--bg-card)] rounded-[32px] shadow-2xl border border-[var(--border-color)] overflow-hidden relative">
        
        {/* Header Progress */}
        <div className="bg-[var(--bg-secondary)] p-6 pb-8 border-b border-[var(--border-color)]">
          <div className="flex justify-between items-center mb-6">
            <button onClick={handleBack} disabled={step === 1 || step === 4} className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${step === 1 || step === 4 ? 'opacity-0 cursor-default' : 'bg-[var(--bg-tertiary)] hover:bg-[var(--bg-glass)] text-[var(--text-secondary)]'}`}>
              <ChevronRight className="w-5 h-5" />
            </button>
            <h1 className="text-lg font-bold text-[var(--text-primary)]">إنشاء جواز المهارات</h1>
            <div className="w-10"></div>
          </div>
          
          <div className="flex justify-between items-center px-4 relative">
            <div className="absolute top-1/2 left-8 right-8 h-1 bg-[var(--bg-tertiary)] -translate-y-1/2 z-0 rounded-full"></div>
            <div 
              className="absolute top-1/2 right-8 h-1 bg-[#2DCE89] -translate-y-1/2 z-0 rounded-full transition-all duration-500"
              style={{ width: `${((step - 1) / 2) * 100}%`, maxWidth: 'calc(100% - 4rem)' }}
            ></div>
            
            {[1, 2, 3].map(i => (
              <div key={i} className={`w-8 h-8 rounded-full flex items-center justify-center z-10 transition-colors duration-500 border-2 ${step >= i ? 'bg-[#2DCE89] border-[#2DCE89] text-white shadow-[0_0_15px_rgba(45,206,137,0.4)]' : 'bg-[var(--bg-card)] border-[var(--bg-tertiary)] text-[var(--text-muted)]'}`}>
                {step > i ? <CheckCircle className="w-4 h-4" /> : <span className="text-xs font-bold">{i}</span>}
              </div>
            ))}
          </div>
        </div>

        {/* Content Area */}
        <div className="p-8 min-h-[400px] relative">
          <AnimatePresence mode="wait">
            
            {step === 1 && (
              <motion.div key="step1" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-6">
                <div className="text-center mb-8">
                  <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-2">البيانات الأساسية</h2>
                  <p className="text-[var(--text-secondary)] text-sm">أدخل معلوماتك المهنية للبدء في إنشاء الجواز</p>
                </div>
                
                <div className="space-y-4">
                  <div className="relative">
                    <Briefcase className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] w-5 h-5" />
                    <input 
                      type="text" 
                      placeholder="المسمى الوظيفي (مثال: فني لحام)" 
                      className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-xl py-4 pr-12 pl-4 text-[var(--text-primary)] focus:outline-none focus:border-[#6c63ff] transition-colors font-sans"
                      value={formData.profession}
                      onChange={e => setFormData({...formData, profession: e.target.value})}
                    />
                  </div>
                  <div className="relative">
                    <MapPin className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] w-5 h-5" />
                    <input 
                      type="text" 
                      placeholder="المدينة / المحافظة" 
                      className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-xl py-4 pr-12 pl-4 text-[var(--text-primary)] focus:outline-none focus:border-[#6c63ff] transition-colors font-sans"
                      value={formData.location}
                      onChange={e => setFormData({...formData, location: e.target.value})}
                    />
                  </div>
                  <div className="relative">
                    <DollarSign className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] w-5 h-5" />
                    <input 
                      type="number" 
                      placeholder="الراتب المتوقع (اختياري)" 
                      className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-xl py-4 pr-12 pl-4 text-[var(--text-primary)] focus:outline-none focus:border-[#6c63ff] transition-colors font-sans"
                      value={formData.salary}
                      onChange={e => setFormData({...formData, salary: e.target.value})}
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div key="step2" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-6">
                <div className="text-center mb-6">
                  <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-2">المهارات الفنية</h2>
                  <p className="text-[var(--text-secondary)] text-sm">اختر المهارات التي تتقنها من القائمة</p>
                </div>
                
                <div className="flex flex-wrap gap-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                  {skillsList.map(skill => (
                    <button
                      key={skill}
                      onClick={() => toggleSkill(skill)}
                      className={`px-4 py-3 rounded-xl text-sm font-bold transition-all flex items-center gap-2 border ${
                        formData.selectedSkills.includes(skill)
                          ? 'bg-[#6c63ff]/10 border-[#6c63ff] text-[#6c63ff]'
                          : 'bg-[var(--bg-tertiary)] border-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-glass)]'
                      }`}
                    >
                      {formData.selectedSkills.includes(skill) && <CheckCircle className="w-4 h-4" />}
                      {skill}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div key="step3" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-6">
                <div className="text-center mb-6">
                  <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-2">التقييم الذاتي</h2>
                  <p className="text-[var(--text-secondary)] text-sm">قيّم مستوى إتقانك لكل مهارة اخترتها (إعلان ذاتي 🟡)</p>
                </div>
                
                <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                  {formData.selectedSkills.length === 0 ? (
                    <p className="text-center text-[var(--text-muted)] py-8">لم تقم باختيار أي مهارات</p>
                  ) : (
                    formData.selectedSkills.map(skill => (
                      <div key={skill} className="bg-[var(--bg-tertiary)] p-4 rounded-2xl border border-[var(--border-color)]">
                        <h4 className="font-bold text-[var(--text-primary)] mb-3 text-sm">{skill}</h4>
                        <div className="flex justify-between gap-2">
                          {['مبتدئ', 'متوسط', 'متقدم', 'خبير'].map((level, idx) => (
                            <button
                              key={level}
                              onClick={() => updateRating(skill, idx + 1)}
                              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors ${
                                formData.skillRatings[skill] === idx + 1
                                  ? 'bg-[#FDB813] text-white shadow-md'
                                  : 'bg-[var(--bg-card)] text-[var(--text-secondary)] hover:bg-[var(--bg-glass)] border border-[var(--border-color)]'
                              }`}
                            >
                              {level}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </motion.div>
            )}

            {step === 4 && (
              <motion.div key="step4" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center justify-center text-center py-12 space-y-6">
                <motion.div 
                  initial={{ rotate: -90, scale: 0 }}
                  animate={{ rotate: 0, scale: 1 }}
                  transition={{ type: 'spring', bounce: 0.5, duration: 0.8 }}
                  className="w-24 h-24 bg-[#FDB813]/20 rounded-full flex items-center justify-center mb-4"
                >
                  <Award className="w-12 h-12 text-[#FDB813]" />
                </motion.div>
                <h2 className="text-3xl font-black text-[var(--text-primary)]">تم الإصدار!</h2>
                <p className="text-[var(--text-secondary)] max-w-[300px] leading-relaxed">
                  تم إصدار جواز المهارات الخاص بك كـ <span className="font-bold text-[#FDB813]">إعلان ذاتي</span>. جاري تحويلك لعرض الجواز...
                </p>
              </motion.div>
            )}

          </AnimatePresence>
        </div>

        {/* Footer Actions */}
        {step < 4 && (
          <div className="p-6 bg-[var(--bg-secondary)] border-t border-[var(--border-color)]">
            <button 
              onClick={handleNext}
              disabled={
                (step === 1 && !formData.profession) || 
                (step === 2 && formData.selectedSkills.length === 0) ||
                (step === 3 && Object.keys(formData.skillRatings).length !== formData.selectedSkills.length)
              }
              className="w-full py-4 bg-gradient-to-r from-[#6c63ff] to-[#8b5cf6] text-white rounded-xl font-bold text-lg shadow-[0_10px_20px_rgba(108,99,255,0.3)] hover:shadow-[0_15px_30px_rgba(108,99,255,0.4)] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {step === 3 ? 'إصدار الجواز' : 'التالي'}
              {step !== 3 && <ChevronLeft className="w-5 h-5" />}
            </button>
          </div>
        )}

      </div>
      
      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: var(--text-muted);
          border-radius: 10px;
          opacity: 0.5;
        }
      `}</style>
    </div>
  );
}
