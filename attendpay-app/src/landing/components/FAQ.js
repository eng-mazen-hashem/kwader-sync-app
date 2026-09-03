import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Plus, Minus } from "lucide-react";
import { useLanguage } from "../context/LanguageContext";

export function FAQ() {
  const [openIndex, setOpenIndex] = useState(0);
  const { t } = useLanguage();
  const f = t.faq;

  return (
    <section id="faq" className="py-24 lg:py-32 bg-gray-50/50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 bg-indigo-50 border border-indigo-100 rounded-full px-4 py-1.5 mb-4"
          >
            <span className="text-indigo-600 text-sm" style={{ fontWeight: 600 }}>{f.badge}</span>
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
            {f.headline1}{" "}
            <span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
              {f.headline2}
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
            {f.subtext}{" "}
            <span className="text-indigo-600 cursor-pointer hover:underline" style={{ fontWeight: 600 }}>
              {f.chatLink}
            </span>
          </motion.p>
        </div>

        <div className="space-y-3">
          {f.items.map((item, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-30px" }}
              transition={{ duration: 0.4, delay: index * 0.06 }}
              className={`bg-white rounded-2xl border transition-all duration-300 overflow-hidden ${
                openIndex === index ? "border-indigo-200 shadow-md shadow-indigo-50" : "border-gray-100 hover:border-gray-200"
              }`}
            >
              <button
                className="w-full flex items-center justify-between gap-4 px-6 py-5 text-start"
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
              >
                <span
                  className={`${openIndex === index ? "text-indigo-600" : "text-gray-900"} transition-colors`}
                  style={{ fontWeight: 600, fontSize: "0.975rem" }}
                >
                  {item.q}
                </span>
                <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-all duration-300 ${
                  openIndex === index ? "bg-indigo-600" : "bg-gray-100"
                }`}>
                  {openIndex === index ? (
                    <Minus className="w-3.5 h-3.5 text-white" />
                  ) : (
                    <Plus className="w-3.5 h-3.5 text-gray-500" />
                  )}
                </div>
              </button>

              <AnimatePresence>
                {openIndex === index && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                  >
                    <div className="px-6 pb-5 border-t border-gray-50">
                      <p className="text-gray-500 pt-4" style={{ fontSize: "0.925rem", lineHeight: 1.75 }}>
                        {item.a}
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
