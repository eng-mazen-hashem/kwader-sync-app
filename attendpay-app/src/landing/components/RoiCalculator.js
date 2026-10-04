import React, { useState } from "react";
import { motion } from "motion/react";
import { Calculator, Clock, DollarSign, ShieldCheck, Zap, ArrowRight, TrendingUp } from "lucide-react";
import { useLanguage } from "../context/LanguageContext";

export function RoiCalculator({ onStartTrial }) {
  const { language, isRTL } = useLanguage();
  const [employeeCount, setEmployeeCount] = useState(30);

  // Dynamic calculations
  // Average HR manager spends ~1.5 hours per employee per month on attendance, leaves, deductions, and payroll
  const hoursSavedPerMonth = Math.round(employeeCount * 1.4);
  // Average hourly HR & administrative cost (~$25 or ~95 SAR)
  const currencySymbol = language === 'ar' ? 'ر.س' : '$';
  const multiplier = language === 'ar' ? 95 : 25;
  const monthlyCostSaved = Math.round(hoursSavedPerMonth * multiplier);
  const annualSavings = monthlyCostSaved * 12;

  const content = {
    ar: {
      badge: "⚡ حاسبة العائد على الاستثمار الذكية",
      title: "احسب كم ستوفر شركتك",
      titleHighlight: "مع نظام كوادر",
      subtext: "اكتشف حجم الساعات المهدرة والأموال التي ستستردها شهرياً عند التحول من الطرق التقليدية إلى الأتمتة السحابية المتكاملة.",
      sliderLabel: "عدد الموظفين في منشأتك:",
      hoursSavedLabel: "ساعات عمل إدارية موفرة شهرياً",
      annualSavingsLabel: "إجمالي التوفير المالي السنوي التقديري",
      errorRate: "0% أخطاء حسابية",
      errorRateSub: "دقة متناهية في مسير الرواتب",
      complianceGuarantee: "100% متوافق مع نظام حماية الأجور (WPS)",
      ctaText: "ابدأ استرداد هذه الساعات الآن مجاناً",
      ctaSub: "تجربة مجانية 35 يوماً بدون بطاقة ائتمان · تفعيل فوري",
      breakdownTitle: "ماذا يعني هذا لفريقك؟",
      points: [
        "إلغاء الإدخال اليدوي لسجلات البصمة وحساب التأخير والغياب",
        "توليد مسير الرواتب المعتمد للبنوك بنقرة زر واحدة",
        "تفريغ مسؤولي الموارد البشرية لتطوير الأداء وزيادة الإنتاجية",
      ]
    },
    en: {
      badge: "⚡ Smart ROI & Savings Calculator",
      title: "Calculate How Much You Save",
      titleHighlight: "With Kwader",
      subtext: "See exactly how many hours and administrative costs you recover every month by switching to full HR & payroll automation.",
      sliderLabel: "Number of employees in your company:",
      hoursSavedLabel: "Admin Hours Saved Monthly",
      annualSavingsLabel: "Estimated Annual Cost Savings",
      errorRate: "0% Payroll Errors",
      errorRateSub: "Flawless automated salary calculations",
      complianceGuarantee: "100% Compliant with WPS & Labor Laws",
      ctaText: "Start Saving These Hours Today",
      ctaSub: "35-day full free trial · No credit card required · Instant setup",
      breakdownTitle: "What this means for your team:",
      points: [
        "Eliminate manual entry of biometric logs and punch corrections",
        "Generate bank-ready Wage Protection System (WPS) files in 1 click",
        "Free your HR team to focus on talent retention and business growth",
      ]
    }
  };

  const t = content[language] || content.ar;

  return (
    <section id="calculator" className="py-20 lg:py-28 bg-gradient-to-b from-white via-indigo-50/30 to-white relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 bg-indigo-50 border border-indigo-100 rounded-full px-4 py-1.5 mb-4"
          >
            <Calculator className="w-4 h-4 text-indigo-600" />
            <span className="text-indigo-700 text-sm font-semibold">{t.badge}</span>
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-gray-950 font-black text-3xl sm:text-4xl lg:text-5xl tracking-tight mb-4"
          >
            {t.title}{" "}
            <span className="bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-600 bg-clip-text text-transparent">
              {t.titleHighlight}
            </span>
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-gray-600 text-base sm:text-lg leading-relaxed"
          >
            {t.subtext}
          </motion.p>
        </div>

        {/* Calculator Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="bg-white rounded-3xl border border-gray-200/80 shadow-2xl shadow-indigo-100/50 p-6 sm:p-10 lg:p-12"
        >
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            
            {/* Left Column: Sliders & Controls */}
            <div className="lg:col-span-7 space-y-8">
              <div>
                <div className="flex justify-between items-center mb-4">
                  <label htmlFor="roi-employee-slider" className="text-gray-900 font-bold text-lg sm:text-xl flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-indigo-600" />
                    {t.sliderLabel}
                  </label>
                  <span className="inline-flex items-center justify-center px-4 py-1.5 bg-indigo-600 text-white font-extrabold text-xl rounded-2xl shadow-md shadow-indigo-200 min-w-[70px]">
                    {employeeCount}
                  </span>
                </div>

                <input
                  id="roi-employee-slider"
                  type="range"
                  min="5"
                  max="300"
                  step="5"
                  value={employeeCount}
                  onChange={(e) => setEmployeeCount(Number(e.target.value))}
                  className="w-full h-3 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />

                <div className="flex justify-between text-xs text-gray-400 mt-2 font-medium">
                  <span>5 {language === 'ar' ? 'موظفين' : 'employees'}</span>
                  <span>100</span>
                  <span>200</span>
                  <span>300+</span>
                </div>
              </div>

              {/* Bullet Features */}
              <div className="bg-gray-50/80 rounded-2xl p-5 border border-gray-100">
                <h4 className="text-gray-900 font-bold text-sm mb-3">{t.breakdownTitle}</h4>
                <ul className="space-y-2.5">
                  {t.points.map((pt, idx) => (
                    <li key={idx} className="flex items-start gap-2.5 text-xs sm:text-sm text-gray-600">
                      <Zap className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                      <span>{pt}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Guarantees */}
              <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-emerald-700 bg-emerald-50/80 border border-emerald-200/60 rounded-xl px-4 py-3">
                <ShieldCheck className="w-4 h-4 flex-shrink-0 text-emerald-600" />
                <span>{t.complianceGuarantee}</span>
              </div>
            </div>

            {/* Right Column: Output Metrics Display */}
            <div className="lg:col-span-5 bg-gradient-to-br from-indigo-900 via-indigo-950 to-slate-950 text-white rounded-3xl p-6 sm:p-8 flex flex-col justify-between shadow-xl relative overflow-hidden">
              {/* Subtle background decoration */}
              <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/20 rounded-full blur-2xl pointer-events-none" />

              <div className="space-y-6 relative z-10">
                {/* Metric 1: Hours */}
                <div className="border-b border-indigo-800/60 pb-5">
                  <div className="flex items-center gap-2 text-indigo-300 text-sm font-medium mb-1">
                    <Clock className="w-4 h-4 text-indigo-400" />
                    <span>{t.hoursSavedLabel}</span>
                  </div>
                  <div className="text-4xl sm:text-5xl font-black text-white tracking-tight">
                    {hoursSavedPerMonth}{" "}
                    <span className="text-lg font-medium text-indigo-300">{language === 'ar' ? 'ساعة' : 'hrs'}</span>
                  </div>
                </div>

                {/* Metric 2: Financial Savings */}
                <div>
                  <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium mb-1">
                    <DollarSign className="w-4 h-4 text-emerald-400" />
                    <span>{t.annualSavingsLabel}</span>
                  </div>
                  <div className="text-3xl sm:text-4xl font-black text-emerald-400 tracking-tight">
                    {annualSavings.toLocaleString()}{" "}
                    <span className="text-lg font-semibold text-emerald-300">{currencySymbol}</span>
                  </div>
                  <p className="text-xs text-indigo-200/70 mt-1">
                    {t.errorRate} · {t.errorRateSub}
                  </p>
                </div>
              </div>

              {/* Action Button */}
              <div className="mt-8 pt-6 border-t border-indigo-800/60 relative z-10">
                <button
                  onClick={onStartTrial}
                  className="w-full group inline-flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white font-bold py-4 px-6 rounded-2xl shadow-lg shadow-indigo-500/30 transition-all duration-200 transform hover:-translate-y-0.5"
                >
                  <span>{t.ctaText}</span>
                  <ArrowRight className={`w-4 h-4 group-hover:translate-x-1 transition-transform ${isRTL ? 'rotate-180' : ''}`} />
                </button>
                <p className="text-[11px] text-center text-indigo-300/80 mt-2.5">
                  {t.ctaSub}
                </p>
              </div>

            </div>

          </div>
        </motion.div>
      </div>
    </section>
  );
}

export default RoiCalculator;
