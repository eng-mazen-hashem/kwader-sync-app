import { motion } from "motion/react";
import { UserPlus, Settings2, Rocket, ArrowRight } from "lucide-react";
import { useLanguage } from "../context/LanguageContext";

const stepIcons = [UserPlus, Settings2, Rocket];
const stepThemes = [
  {
    iconGradient: "linear-gradient(135deg, #4f46e5, #6d28d9)",
    number: "01",
    numberColor: "#4f46e5",
    numberBg: "#eef2ff",
    lineBg: "linear-gradient(90deg, #4f46e5, #7c3aed)",
  },
  {
    iconGradient: "linear-gradient(135deg, #7c3aed, #a855f7)",
    number: "02",
    numberColor: "#7c3aed",
    numberBg: "#f5f3ff",
    lineBg: "linear-gradient(90deg, #7c3aed, #059669)",
  },
  {
    iconGradient: "linear-gradient(135deg, #059669, #10b981)",
    number: "03",
    numberColor: "#059669",
    numberBg: "#ecfdf5",
    lineBg: null,
  },
];

export function HowItWorks() {
  const { t } = useLanguage();
  const h = t.howItWorks;

  return (
    <section
      id="how-it-works"
      className="py-24 lg:py-32 overflow-hidden"
      style={{ background: "#ffffff" }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Section Header */}
        <div className="text-center mb-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 mb-4 border"
            style={{ background: "linear-gradient(135deg, #f5f3ff, #eef2ff)", borderColor: "#ddd6fe" }}
          >
            <span className="text-violet-700 text-sm font-semibold">{h.badge}</span>
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-gray-950 mb-4 tracking-tight"
            style={{
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              fontWeight: 800,
              fontSize: "clamp(2rem, 4vw, 3rem)",
              lineHeight: 1.15,
              letterSpacing: "-0.025em",
            }}
          >
            {h.headline1}{" "}
            <span
              style={{
                backgroundImage: "linear-gradient(135deg, #7c3aed, #4f46e5)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              {h.headline2}
            </span>
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-gray-500 max-w-xl mx-auto"
            style={{ fontSize: "1.1rem", lineHeight: 1.75 }}
          >
            {h.subtext}
          </motion.p>
        </div>

        {/* Steps */}
        <div className="relative">
          {/* Connector Line (desktop) */}
          <div className="hidden lg:block absolute top-10 left-1/2 -translate-x-1/2 w-2/3 h-px"
            style={{ background: "linear-gradient(90deg, #c7d2fe, #ddd6fe, #a7f3d0)" }}
          />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 lg:gap-8">
            {h.steps.map((step, index) => {
              const theme = stepThemes[index];
              const Icon = stepIcons[index];
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 40 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.7, delay: index * 0.2 }}
                  className="relative text-center group"
                >
                  {/* Step number badge */}
                  <div className="relative inline-block mb-6">
                    {/* Icon circle */}
                    <div
                      className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto shadow-lg transition-transform duration-300 group-hover:scale-110 group-hover:-translate-y-1"
                      style={{
                        background: theme.iconGradient,
                        boxShadow: `0 16px 40px ${index === 0 ? "rgba(79,70,229,0.3)" : index === 1 ? "rgba(124,58,237,0.3)" : "rgba(5,150,105,0.3)"}`,
                      }}
                    >
                      <Icon className="w-9 h-9 text-white" />
                    </div>

                    {/* Number badge */}
                    <div
                      className="absolute -top-2.5 -end-2.5 w-7 h-7 rounded-full flex items-center justify-center text-xs font-black border-2 border-white shadow-md"
                      style={{ background: theme.numberBg, color: theme.numberColor }}
                    >
                      {index + 1}
                    </div>
                  </div>

                  {/* Text */}
                  <h3
                    className="text-gray-900 mb-3"
                    style={{
                      fontFamily: "'Plus Jakarta Sans', sans-serif",
                      fontWeight: 700,
                      fontSize: "1.15rem",
                    }}
                  >
                    {step.title}
                  </h3>
                  <p
                    className="text-gray-500 max-w-xs mx-auto"
                    style={{ fontSize: "0.95rem", lineHeight: 1.75 }}
                  >
                    {step.description}
                  </p>

                  {/* Arrow connector on desktop (LTR) */}
                  {index < h.steps.length - 1 && (
                    <div className="hidden lg:flex absolute top-10 -end-5 z-10 items-center justify-center">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center"
                        style={{ background: "#f5f3ff", border: "1px solid #ddd6fe" }}
                      >
                        <ArrowRight className="w-4 h-4 text-violet-400" />
                      </div>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Bottom CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.5 }}
          className="text-center mt-16"
        >
          <button
            className="group inline-flex items-center gap-2.5 text-white px-9 py-4 rounded-2xl transition-all duration-300 hover:-translate-y-1"
            style={{
              background: "linear-gradient(135deg, #4f46e5, #7c3aed)",
              boxShadow: "0 8px 30px rgba(79,70,229,0.35)",
              fontWeight: 700,
              fontSize: "1rem",
            }}
          >
            {h.cta}
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
          <p className="text-gray-400 mt-3 text-sm font-medium">{h.noCard}</p>
        </motion.div>
      </div>
    </section>
  );
}
