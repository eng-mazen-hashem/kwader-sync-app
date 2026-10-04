import React from "react";
import { motion } from "motion/react";
import { ShieldCheck, FileCheck, Lock, Landmark, Cpu, Award, CheckCircle } from "lucide-react";
import { useLanguage } from "../context/LanguageContext";

export function ComplianceSecurity() {
  const { language } = useLanguage();

  const content = {
    ar: {
      badge: "🛡️ المعايير والاعتمادات العالمية",
      title: "أمان بنكي وتوافق معتمد 100%",
      titleHighlight: "مع الأنظمة الحكومية والخليجية",
      subtext: "صُمم نظام كوادر ليلتزم بأعلى المعايير التنظيمية والأمنية لحماية بيانات منشأتك وموظفيك في كافة دول المنطقة.",
      pillars: [
        {
          icon: Landmark,
          title: "نظام حماية الأجور (WPS)",
          description: "توليد ملفات الرواتب المتوافقة مع متطلبات البنك المركزي ووزارة الموارد البشرية والتأمينات الاجتماعية (GOSI) تلقائياً.",
          badge: "معتمد 100%",
          color: "from-emerald-500 to-teal-600"
        },
        {
          icon: Lock,
          title: "تشفير بيانات بمستوى عسكري",
          description: "تشفير شامل AES-256 للبيانات المحفوظة وTLS 1.3 أثناء النقل مع عزل كامل لقواعد بيانات كل شركة.",
          badge: "SOC 2 & ISO 27001",
          color: "from-indigo-500 to-blue-600"
        },
        {
          icon: Cpu,
          title: "ربط بيومتري معتمد وفوري",
          description: "مزامنة لحظية مباشرة مع أجهزة ZKTeco وبصمة الوجه، دون الحاجة لـ IP ثابت مع وكيل المزامنة الذكي.",
          badge: "مزامنة مشفرة",
          color: "from-violet-500 to-purple-600"
        },
        {
          icon: FileCheck,
          title: "لوائح العمل الخليجية والمحلية",
          description: "قواعد حساب ساعات العمل الإضافي، فترات التجربة، مكافأة نهاية الخدمة، والإجازات السنوية وفق قوانين العمل الرسمية.",
          badge: "محدث لعام 2026",
          color: "from-amber-500 to-orange-600"
        }
      ],
      trustBadgesTitle: "موثوق به وممتثل لأعلى المعايير:",
      certifications: [
        "ISO 27001 Certified Infrastructure",
        "WPS Ministry of Human Resources",
        "GDPR & Local Data Privacy Compliant",
        "99.9% Uptime SLA Guaranteed",
      ]
    },
    en: {
      badge: "🛡️ Global Compliance & Enterprise Security",
      title: "Bank-Grade Security & 100% Compliant",
      titleHighlight: "With GCC & Regional Labor Laws",
      subtext: "Engineered from the ground up to meet rigorous regulatory standards, safeguarding your company and employee records with zero compromises.",
      pillars: [
        {
          icon: Landmark,
          title: "Wage Protection System (WPS)",
          description: "Auto-generate official salary files compliant with Central Bank, GOSI, and Ministry of Human Resources regulations.",
          badge: "100% Compliant",
          color: "from-emerald-500 to-teal-600"
        },
        {
          icon: Lock,
          title: "Military-Grade Data Encryption",
          description: "AES-256 at rest, TLS 1.3 in transit, with multi-tenant data isolation and continuous encrypted backups.",
          badge: "SOC 2 & ISO 27001",
          color: "from-indigo-500 to-blue-600"
        },
        {
          icon: Cpu,
          title: "Certified Biometric Device Sync",
          description: "Instant real-time sync with ZKTeco, Suprema, and mobile geofenced punching without public static IP requirements.",
          badge: "Encrypted Agent",
          color: "from-violet-500 to-purple-600"
        },
        {
          icon: FileCheck,
          title: "Localized GCC Labor Legislation",
          description: "Pre-configured formulas for overtime, probationary periods, end-of-service gratuity, and statutory leave laws.",
          badge: "Updated for 2026",
          color: "from-amber-500 to-orange-600"
        }
      ],
      trustBadgesTitle: "Trusted by enterprise security teams:",
      certifications: [
        "ISO 27001 Certified Infrastructure",
        "WPS Ministry of Human Resources",
        "GDPR & Local Data Privacy Compliant",
        "99.9% Uptime SLA Guaranteed",
      ]
    }
  };

  const t = content[language] || content.ar;

  return (
    <section className="py-20 lg:py-28 bg-slate-950 text-white relative overflow-hidden">
      {/* Background Decorative Gradients */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-emerald-600/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 rounded-full px-4 py-1.5 mb-4"
          >
            <ShieldCheck className="w-4 h-4 text-indigo-400" />
            <span className="text-indigo-300 text-sm font-semibold">{t.badge}</span>
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-white font-extrabold text-3xl sm:text-4xl lg:text-5xl tracking-tight mb-4"
          >
            {t.title}{" "}
            <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-emerald-400 bg-clip-text text-transparent">
              {t.titleHighlight}
            </span>
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-slate-400 text-base sm:text-lg leading-relaxed"
          >
            {t.subtext}
          </motion.p>
        </div>

        {/* Pillars Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {t.pillars.map((pillar, index) => {
            const Icon = pillar.icon;
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="bg-slate-900/80 hover:bg-slate-800/80 border border-slate-800 hover:border-slate-700 rounded-3xl p-6 sm:p-7 flex flex-col justify-between transition-all duration-300 group"
              >
                <div>
                  <div className="flex items-center justify-between mb-5">
                    <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${pillar.color} flex items-center justify-center shadow-lg`}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <span className="text-[11px] font-bold text-slate-300 bg-slate-800/90 border border-slate-700/80 px-2.5 py-1 rounded-full">
                      {pillar.badge}
                    </span>
                  </div>

                  <h3 className="text-white font-bold text-lg mb-2 group-hover:text-indigo-300 transition-colors">
                    {pillar.title}
                  </h3>

                  <p className="text-slate-400 text-sm leading-relaxed">
                    {pillar.description}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Certifications Bar */}
        <div className="pt-8 border-t border-slate-800/80 flex flex-col md:flex-row items-center justify-between gap-6 text-xs sm:text-sm text-slate-400">
          <span className="font-semibold text-slate-300 flex items-center gap-2">
            <Award className="w-4 h-4 text-amber-400" />
            {t.trustBadgesTitle}
          </span>
          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6">
            {t.certifications.map((cert, i) => (
              <span key={i} className="inline-flex items-center gap-1.5 text-slate-300">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                {cert}
              </span>
            ))}
          </div>
        </div>

      </div>
    </section>
  );
}

export default ComplianceSecurity;
