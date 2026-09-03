import { motion } from "motion/react";
import { Clock, Users, DollarSign, BarChart2, FileText, Workflow, Shield, CalendarDays, Bell } from "lucide-react";
import { useLanguage } from "../context/LanguageContext";

// Badge labels per language
const badgeLabels = {
  en: { core: "Core", popular: "Popular", analytics: "Analytics", featured: "Featured", new: "New", security: "Security" },
  ar: { core: "أساسي", popular: "شائع", analytics: "تحليلات", featured: "متميز", new: "جديد", security: "أمان" },
  de: { core: "Kern", popular: "Beliebt", analytics: "Analytik", featured: "Hervorgehoben", new: "Neu", security: "Sicherheit" },
  es: { core: "Principal", popular: "Popular", analytics: "Análisis", featured: "Destacado", new: "Nuevo", security: "Seguridad" },
};

const featureData = [
  {
    Icon: Users,
    gradient: "linear-gradient(135deg, #4f46e5, #6d28d9)",
    lightBg: "#eef2ff",
    lightColor: "#4f46e5",
    tagKey: "core",
    tagBg: "#eef2ff",
    tagColor: "#4f46e5",
  },
  {
    Icon: Clock,
    gradient: "linear-gradient(135deg, #0284c7, #0ea5e9)",
    lightBg: "#e0f2fe",
    lightColor: "#0284c7",
    tagKey: "popular",
    tagBg: "#e0f2fe",
    tagColor: "#0284c7",
  },
  {
    Icon: DollarSign,
    gradient: "linear-gradient(135deg, #059669, #10b981)",
    lightBg: "#ecfdf5",
    lightColor: "#059669",
    tagKey: "core",
    tagBg: "#ecfdf5",
    tagColor: "#059669",
  },
  {
    Icon: BarChart2,
    gradient: "linear-gradient(135deg, #d97706, #f59e0b)",
    lightBg: "#fef3c7",
    lightColor: "#b45309",
    tagKey: "analytics",
    tagBg: "#fef3c7",
    tagColor: "#b45309",
  },
  {
    Icon: CalendarDays,
    gradient: "linear-gradient(135deg, #7c3aed, #a855f7)",
    lightBg: "#f5f3ff",
    lightColor: "#7c3aed",
    tagKey: "popular",
    tagBg: "#f5f3ff",
    tagColor: "#7c3aed",
  },
  {
    Icon: FileText,
    gradient: "linear-gradient(135deg, #0f766e, #14b8a6)",
    lightBg: "#f0fdfa",
    lightColor: "#0f766e",
    tagKey: "core",
    tagBg: "#f0fdfa",
    tagColor: "#0f766e",
  },
  {
    Icon: Workflow,
    gradient: "linear-gradient(135deg, #dc2626, #ef4444)",
    lightBg: "#fef2f2",
    lightColor: "#dc2626",
    tagKey: "featured",
    tagBg: "#fef2f2",
    tagColor: "#dc2626",
  },
  {
    Icon: Bell,
    gradient: "linear-gradient(135deg, #2563eb, #3b82f6)",
    lightBg: "#eff6ff",
    lightColor: "#2563eb",
    tagKey: "new",
    tagBg: "#eff6ff",
    tagColor: "#2563eb",
  },
  {
    Icon: Shield,
    gradient: "linear-gradient(135deg, #374151, #6b7280)",
    lightBg: "#f9fafb",
    lightColor: "#374151",
    tagKey: "security",
    tagBg: "#f9fafb",
    tagColor: "#374151",
  },
];

export function Features() {
  const { t, language } = useLanguage();
  const f = t.features;
  const badges = badgeLabels[language] || badgeLabels.en;

  return (
    <section
      id="features"
      className="py-24 lg:py-32 relative overflow-hidden"
      style={{ background: "linear-gradient(180deg, #f8f9ff 0%, #ffffff 100%)" }}
    >
      {/* Background decoration */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-1"
          style={{ background: "linear-gradient(90deg, transparent, #c7d2fe, transparent)" }}
        />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 mb-4 border"
            style={{ background: "linear-gradient(135deg, #eef2ff, #f5f3ff)", borderColor: "#c7d2fe" }}
          >
            <span className="text-indigo-700 text-sm font-semibold">{f.badge}</span>
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
            {f.headline1}{" "}
            <span
              style={{
                backgroundImage: "linear-gradient(135deg, #4f46e5, #7c3aed)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              {f.headline2}
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
            {f.subtext}
          </motion.p>
        </div>

        {/* Bento Grid Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-6 lg:grid-cols-12 gap-5 auto-rows-[minmax(180px,auto)]">
          {f.items.map((item, index) => {
            const fd = featureData[index] || featureData[0];
            
            // Bento Grid spanning logic
            let spanClass = "col-span-1 md:col-span-3 lg:col-span-4";
            if (index === 0) spanClass = "col-span-1 md:col-span-6 lg:col-span-8"; // Large hero feature
            else if (index === 3) spanClass = "col-span-1 md:col-span-6 lg:col-span-6"; // Medium feature
            else if (index === 4) spanClass = "col-span-1 md:col-span-6 lg:col-span-6"; // Medium feature
            else if (index === 7) spanClass = "col-span-1 md:col-span-6 lg:col-span-8"; // Large bottom feature
            
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.55, delay: index * 0.05 }}
                className={`group relative rounded-3xl p-7 border transition-all duration-300 hover:-translate-y-1.5 cursor-default overflow-hidden backdrop-blur-md ${spanClass}`}
                style={{
                  background: "rgba(255, 255, 255, 0.6)",
                  borderColor: "rgba(229,231,235,0.7)",
                  boxShadow: "0 4px 20px rgba(79,70,229,0.03)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = "0 20px 40px rgba(79,70,229,0.12)";
                  e.currentTarget.style.borderColor = "#c7d2fe";
                  e.currentTarget.style.background = "rgba(255, 255, 255, 0.9)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = "0 4px 20px rgba(79,70,229,0.03)";
                  e.currentTarget.style.borderColor = "rgba(229,231,235,0.7)";
                  e.currentTarget.style.background = "rgba(255, 255, 255, 0.6)";
                }}
              >
                {/* Decorative Background Blob */}
                <div 
                  className="absolute -right-8 -top-8 w-32 h-32 rounded-full opacity-0 group-hover:opacity-10 transition-opacity duration-500 blur-2xl"
                  style={{ background: fd.gradient }}
                />

                <div className="relative z-10 flex flex-col h-full">
                  <div className="flex justify-between items-start mb-6">
                    <div
                      className="w-14 h-14 rounded-2xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110 shadow-lg"
                      style={{ background: fd.gradient }}
                    >
                      <fd.Icon className="w-6 h-6 text-white" />
                    </div>
                  </div>

                  <div className="mt-auto">
                    <h3
                      className="text-gray-900 mb-3"
                      style={{ fontWeight: 800, fontSize: "1.2rem", fontFamily: "'Plus Jakarta Sans', sans-serif", letterSpacing: "-0.02em" }}
                    >
                      {item.title}
                    </h3>
                    <p className="text-gray-500 font-medium" style={{ fontSize: "0.95rem", lineHeight: 1.6 }}>
                      {item.description}
                    </p>
                  </div>
                </div>

                {/* Bottom accent line */}
                <div
                  className="absolute bottom-0 left-0 right-0 h-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  style={{ background: fd.gradient }}
                />
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
