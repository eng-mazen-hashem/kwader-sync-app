import { motion } from "motion/react";
import { ArrowRight, CheckCircle2, Sparkles, Clock, Shield, Users } from "lucide-react";
import { useLanguage } from "../context/LanguageContext";

export function CTASection({ onStartTrial }) {
  const { t } = useLanguage();
  const c = t.cta;

  const highlights = [
    { icon: Clock, text: c.perks?.[0] || "✓ 35 يوم تجربة مجانية", color: "#a5f3fc" },
    { icon: Shield, text: c.perks?.[1] || "✓ بدون بطاقة ائتمان", color: "#c4b5fd" },
    { icon: Users, text: c.perks?.[2] || "✓ إلغاء في أي وقت", color: "#6ee7b7" },
    { icon: CheckCircle2, text: c.perks?.[3] || "✓ دعم مجاني للهجرة", color: "#fcd34d" },
  ];

  return (
    <section className="py-24 lg:py-32 overflow-hidden" style={{ background: "#f8f9ff" }}>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="relative rounded-3xl overflow-hidden text-center"
          style={{
            background: "linear-gradient(135deg, #1e1b4b 0%, #2d1b69 30%, #0f172a 70%, #1e3a5f 100%)",
            boxShadow: "0 40px 100px rgba(79,70,229,0.3), 0 0 0 1px rgba(99,102,241,0.2)",
          }}
        >
          {/* Decorative orbs */}
          <div
            className="absolute -top-24 -right-24 w-72 h-72 rounded-full pointer-events-none"
            style={{ background: "radial-gradient(circle, rgba(99,102,241,0.3), transparent 70%)" }}
          />
          <div
            className="absolute -bottom-20 -left-20 w-64 h-64 rounded-full pointer-events-none"
            style={{ background: "radial-gradient(circle, rgba(124,58,237,0.25), transparent 70%)" }}
          />
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full pointer-events-none opacity-5"
            style={{ background: "radial-gradient(circle, #fff, transparent 70%)" }}
          />

          {/* Subtle grid */}
          <div
            className="absolute inset-0 opacity-[0.03] pointer-events-none"
            style={{
              backgroundImage: `linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)`,
              backgroundSize: "48px 48px",
            }}
          />

          {/* Content */}
          <div className="relative px-8 py-16 lg:py-20">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 backdrop-blur-sm rounded-full px-5 py-2 mb-8">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <span className="text-indigo-300 text-sm font-semibold">{c.badge}</span>
            </div>

            {/* Headline */}
            <h2
              className="text-white mb-5"
              style={{
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                fontWeight: 800,
                fontSize: "clamp(2rem, 5vw, 3.5rem)",
                lineHeight: 1.1,
                letterSpacing: "-0.025em",
              }}
            >
              {c.headline1}{" "}
              <span
                style={{
                  backgroundImage: "linear-gradient(135deg, #818cf8, #c084fc, #f472b6)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                {c.headline2}
              </span>
            </h2>

            <p
              className="mb-10 max-w-xl mx-auto"
              style={{ color: "rgba(148,163,184,1)", fontSize: "1.1rem", lineHeight: 1.75 }}
            >
              {c.subtext}
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-10">
              <div className="relative group/cta">
                <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-fuchsia-500 rounded-2xl blur opacity-40 group-hover/cta:opacity-75 transition duration-500 animate-pulse" />
                <button
                  onClick={onStartTrial}
                  className="relative flex items-center justify-center gap-2.5 px-9 py-4 rounded-2xl transition-all duration-300 hover:-translate-y-1 w-full sm:w-auto"
                  style={{
                    background: "linear-gradient(135deg, #ffffff, #f0f0ff)",
                    color: "#1e1b4b",
                    fontWeight: 800,
                    fontSize: "1.1rem",
                  }}
                >
                  {c.cta1}
                  <ArrowRight className="w-5 h-5 group-hover/cta:translate-x-1.5 transition-transform" />
                </button>
              </div>

              <button
                onClick={onStartTrial}
                className="inline-flex items-center justify-center px-9 py-4 rounded-2xl border border-white/15 backdrop-blur-sm transition-all duration-300 hover:bg-white/10 hover:-translate-y-1"
                style={{ color: "rgba(255,255,255,0.85)", fontWeight: 600, fontSize: "1rem" }}
              >
                {c.cta2}
              </button>
            </div>

            {/* Perks Row */}
            <div className="flex flex-wrap items-center justify-center gap-5">
              {highlights.map(({ icon: Icon, text, color }, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: `${color}20` }}
                  >
                    <Icon className="w-3 h-3" style={{ color }} />
                  </div>
                  <span className="text-sm font-medium" style={{ color: "rgba(148,163,184,1)" }}>
                    {text.replace("✓ ", "")}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
