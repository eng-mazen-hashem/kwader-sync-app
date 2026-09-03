import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Check, Zap } from "lucide-react";
import { useLanguage } from "../context/LanguageContext";
import { supabase } from "../../supabaseClient";

const ctaStyles = [
  "border-2 border-indigo-600 text-indigo-600 hover:bg-indigo-600 hover:text-white",
  "bg-gradient-to-r from-indigo-600 to-violet-600 text-white hover:from-indigo-500 hover:to-violet-500",
  "border-2 border-gray-900 text-gray-900 hover:bg-gray-900 hover:text-white",
];

export function Pricing() {
  const [isYearly, setIsYearly] = useState(false);
  const [monthlyPrices, setMonthlyPrices] = useState([29, 79, 199]);
  const [yearlyPrices, setYearlyPrices] = useState([23, 63, 159]);
  const [plansDetails, setPlansDetails] = useState([]);
  const { t } = useLanguage();
  const p = t.pricing;

  useEffect(() => {
    async function loadSettings() {
      try {
        const { data, error } = await supabase
          .from('system_settings')
          .select('key, value');
        if (!error && data) {
          const monthly = data.find(item => item.key === 'pricing_monthly');
          const yearly = data.find(item => item.key === 'pricing_yearly');
          const details = data.find(item => item.key === 'pricing_plans_details');
          if (monthly && Array.isArray(monthly.value)) {
            setMonthlyPrices(monthly.value);
          }
          if (yearly && Array.isArray(yearly.value)) {
            setYearlyPrices(yearly.value);
          }
          if (details && Array.isArray(details.value)) {
            setPlansDetails(details.value);
          }
        }
      } catch (err) {
        console.error("Failed to load pricing settings:", err);
      }
    }
    loadSettings();
  }, []);

  return (
    <section id="pricing" className="py-24 lg:py-32 bg-gray-50/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-full px-4 py-1.5 mb-4"
          >
            <span className="text-emerald-600 text-sm" style={{ fontWeight: 600 }}>{p.badge}</span>
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
            {p.headline1}{" "}
            <span className="bg-gradient-to-r from-emerald-600 to-indigo-600 bg-clip-text text-transparent">
              {p.headline2}
            </span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-gray-500 max-w-xl mx-auto mb-8"
            style={{ fontSize: "1.125rem", lineHeight: 1.7 }}
          >
            {p.subtext}
          </motion.p>

          {/* Billing Toggle */}
          <div className="inline-flex items-center gap-3 bg-white border border-gray-200 rounded-xl p-1 shadow-sm">
            <button
              onClick={() => setIsYearly(false)}
              className={`px-5 py-2 rounded-lg text-sm transition-all duration-200 ${
                !isYearly ? "bg-gray-900 text-white shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
              style={{ fontWeight: 600 }}
            >
              {p.monthly}
            </button>
            <button
              onClick={() => setIsYearly(true)}
              className={`px-5 py-2 rounded-lg text-sm transition-all duration-200 flex items-center gap-2 ${
                isYearly ? "bg-gray-900 text-white shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
              style={{ fontWeight: 600 }}
            >
              {p.yearly}
              <span className="bg-emerald-500 text-white text-xs px-1.5 py-0.5 rounded-md" style={{ fontWeight: 700 }}>-20%</span>
            </button>
          </div>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
          {p.plans.map((plan, index) => {
            const highlight = index === 1;
            const monthly = monthlyPrices[index];
            const yearly = yearlyPrices[index];
            const savings = (monthly - yearly) * 12;

            const dynamicDetail = plansDetails[index];
            const badge = dynamicDetail && dynamicDetail.badge ? dynamicDetail.badge : plan.badge;
            const features = dynamicDetail && dynamicDetail.features ? dynamicDetail.features : plan.features;
            const name = dynamicDetail && dynamicDetail.name ? dynamicDetail.name : plan.name;

            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className={`relative bg-white rounded-3xl border-2 ${
                  highlight
                    ? "border-indigo-500 shadow-2xl shadow-indigo-200/50 scale-105 z-10"
                    : "border-gray-200 hover:shadow-xl hover:border-gray-300"
                } transition-all duration-300 overflow-visible`}
              >
                {highlight && (
                  <>
                    {/* Animated glowing backdrop */}
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 rounded-3xl blur opacity-30 animate-pulse -z-10" />
                    {/* Top gradient border accent */}
                    <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-t-3xl" />
                  </>
                )}
                {badge && (
                  <div className="absolute top-4 end-4">
                    <span className="flex items-center gap-1 bg-indigo-50 text-indigo-600 text-xs px-2.5 py-1 rounded-full border border-indigo-100" style={{ fontWeight: 700 }}>
                      <Zap className="w-3 h-3" fill="currentColor" />
                      {badge}
                    </span>
                  </div>
                )}

                <div className="p-7">
                  <h3 className="text-gray-900 mb-1" style={{ fontWeight: 800, fontSize: "1.2rem" }}>{name}</h3>
                  <p className="text-gray-500 text-sm mb-6" style={{ lineHeight: 1.6 }}>{plan.description}</p>

                  <div className="flex items-end gap-1 mb-1">
                    <span
                      className="text-gray-900"
                      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, fontSize: "2.8rem", lineHeight: 1 }}
                    >
                      ${isYearly ? yearly : monthly}
                    </span>
                    <span className="text-gray-400 text-sm mb-1">{p.perMonth}</span>
                  </div>
                  {isYearly ? (
                    <p className="text-emerald-600 text-xs mb-6" style={{ fontWeight: 600 }}>
                      {p.saveYear.replace("{amount}", String(savings))}
                    </p>
                  ) : (
                    <div className="mb-6" />
                  )}

                  <button
                    className={`w-full py-3.5 rounded-xl text-sm transition-all duration-200 hover:-translate-y-0.5 ${ctaStyles[index]}`}
                    style={{ fontWeight: 700 }}
                  >
                    {plan.cta}
                  </button>

                  <div className="mt-7 space-y-3">
                    {features.map((feature, fi) => (
                      <div key={fi} className="flex items-start gap-3">
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${highlight ? "bg-indigo-100" : "bg-gray-100"}`}>
                          <Check className={`w-3 h-3 ${highlight ? "text-indigo-600" : "text-gray-600"}`} />
                        </div>
                        <span className="text-gray-600 text-sm" style={{ lineHeight: 1.5 }}>{feature}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center mt-12"
        >
          <p className="text-gray-400 text-sm">
            {p.footer}{" "}
            <span className="text-indigo-600 cursor-pointer hover:underline" style={{ fontWeight: 600 }}>
              {p.compareFeatures}
            </span>
          </p>
        </motion.div>
      </div>
    </section>
  );
}
