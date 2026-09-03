import { motion } from "motion/react";
import { useLanguage } from "../context/LanguageContext";

// Arabic/Gulf companies that would realistically use payroll software
const companies = [
  "مجموعة علي بن علي", "مجموعة دلة", "شركة الاتصالات", "مجموعة MBC",
  "أكاديميا", "مجموعة سبأ", "شركة ألماس", "مجموعة بن لادن",
  "Aramco Digital", "STC Solutions", "مجموعة الزبارة", "شركة الريف",
];

export function TrustedBy() {
  const { t, isRTL } = useLanguage();

  return (
    <section
      className="py-12 overflow-hidden border-y"
      style={{ background: "#f8f9ff", borderColor: "#e8ecff" }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-8">
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center text-gray-400 text-xs uppercase tracking-widest font-semibold"
        >
          {t.trustedBy}
        </motion.p>
      </div>

      <div className="relative">
        {/* Fade edges */}
        <div className="absolute start-0 top-0 bottom-0 w-20 z-10 pointer-events-none"
          style={{ background: "linear-gradient(to end, #f8f9ff, transparent)" }}
        />
        <div className="absolute end-0 top-0 bottom-0 w-20 z-10 pointer-events-none"
          style={{ background: "linear-gradient(to start, #f8f9ff, transparent)" }}
        />

        <div className="flex overflow-hidden">
          <motion.div
            className="flex gap-10 items-center"
            animate={{ x: isRTL ? ["0%", "50%"] : ["0%", "-50%"] }}
            transition={{ repeat: Infinity, duration: 40, ease: "linear" }}
          >
            {[...companies, ...companies, ...companies, ...companies].map((name, i) => (
              <div key={i} className="flex-shrink-0">
                <div
                  className="px-6 py-3 rounded-2xl border font-bold text-sm whitespace-nowrap transition-colors backdrop-blur-sm"
                  style={{
                    background: "rgba(255, 255, 255, 0.7)",
                    borderColor: "rgba(229, 231, 235, 0.8)",
                    color: "#6b7280",
                    boxShadow: "0 4px 15px rgba(79,70,229,0.03)",
                  }}
                >
                  {name}
                </div>
              </div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
