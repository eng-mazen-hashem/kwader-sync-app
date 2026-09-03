import { motion } from "motion/react";
import { ArrowRight, Clock, CheckCircle2, TrendingUp, Users, Calendar, DollarSign, Shield } from "lucide-react";
import { useLanguage } from "../context/LanguageContext";

// Trust + Stats fallback translations
const trustFallback = {
  en: ["100% Secure Data", "35-day Free Trial", "No Credit Card"],
  ar: ["بيانات آمنة 100%", "تجربة مجانية 35 يوم", "بدون بطاقة ائتمان"],
  de: ["100% sichere Daten", "35-Tage-Testversion", "Keine Kreditkarte"],
  es: ["Datos 100% seguros", "Prueba gratuita de 35 días", "Sin tarjeta de crédito"],
};

const statsFallback = {
  en: ["Companies Trust Us", "Customer Satisfaction", "Active Employees", "Day Free Trial"],
  ar: ["شركة تثق بنا", "رضا العملاء", "موظف نشط تحت الإدارة", "يوم تجربة مجانية"],
  de: ["Unternehmen vertrauen uns", "Kundenzufriedenheit", "Aktive Mitarbeiter", "Tage kostenloser Test"],
  es: ["Empresas confían en nosotros", "Satisfacción del cliente", "Empleados activos", "Días de prueba gratuita"],
};

const floatAnim = {
  animate: { y: [0, -8, 0] },
  transition: { repeat: Infinity, duration: 4, ease: "easeInOut" },
};

export function Hero({ onStartTrial }) {
  const { t, isRTL, language } = useLanguage();
  const h = t.hero;

  return (
    <section
      className="relative pt-28 pb-16 lg:pt-40 lg:pb-32 overflow-hidden"
      style={{ background: "linear-gradient(180deg, #f8faff 0%, #ffffff 100%)" }}
    >
      {/* Animated glowing blobs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden flex justify-center items-center">
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3],
            rotate: [0, 90, 0]
          }}
          transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
          className="absolute w-[800px] h-[800px] rounded-full blur-[100px]"
          style={{ background: "radial-gradient(circle, rgba(99,102,241,0.15) 0%, rgba(255,255,255,0) 70%)", top: "-20%", right: "-10%" }}
        />
        <motion.div
          animate={{
            scale: [1, 1.3, 1],
            opacity: [0.2, 0.4, 0.2],
            rotate: [0, -90, 0]
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute w-[600px] h-[600px] rounded-full blur-[80px]"
          style={{ background: "radial-gradient(circle, rgba(14,165,233,0.15) 0%, rgba(255,255,255,0) 70%)", bottom: "-10%", left: "-10%" }}
        />
        {/* Grid lines */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(#4f46e5 1px, transparent 1px), linear-gradient(90deg, #4f46e5 1px, transparent 1px)`,
            backgroundSize: "60px 60px",
          }}
        />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-12 items-center">

          {/* LEFT: Content */}
          <motion.div
            initial={{ opacity: 0, x: isRTL ? 30 : -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.5 }}
              className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 mb-7 border"
              style={{
                background: "linear-gradient(135deg, #eef2ff, #f5f3ff)",
                borderColor: "#c7d2fe",
              }}
            >
              <span className="flex h-2 w-2 rounded-full bg-indigo-500 animate-pulse" />
              <span className="text-indigo-700 text-sm font-semibold">{h.badge}</span>
            </motion.div>

            {/* Headline */}
            <h1
              className="text-gray-950 mb-6 tracking-tight"
              style={{
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                fontWeight: 800,
                fontSize: "clamp(2.6rem, 5.5vw, 4.8rem)",
                lineHeight: 1.05,
                letterSpacing: "-0.03em",
              }}
            >
              {h.headline1}{" "}
              <span
                style={{
                  backgroundImage: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #2563eb 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                {h.headline2}
              </span>
              <br />
              {h.headline3}
            </h1>

            <p
              className="text-gray-500 mb-8 leading-relaxed max-w-lg"
              style={{ fontSize: "1.1rem", lineHeight: 1.75 }}
            >
              {h.subtext}
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 mb-10">
              <button
                onClick={onStartTrial}
                className="group inline-flex items-center justify-center gap-2 text-white px-8 py-4 rounded-2xl transition-all duration-300 hover:-translate-y-1"
                style={{
                  background: "linear-gradient(135deg, #4f46e5 0%, #6d28d9 100%)",
                  boxShadow: "0 8px 30px rgba(79,70,229,0.4)",
                  fontWeight: 700,
                  fontSize: "1rem",
                }}
              >
                {h.cta1}
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
              <button
                onClick={onStartTrial}
                className="inline-flex items-center justify-center gap-2 text-gray-700 px-8 py-4 rounded-2xl border-2 border-gray-200 hover:border-indigo-200 hover:bg-indigo-50/40 transition-all duration-300"
                style={{ fontWeight: 600, fontSize: "1rem" }}
              >
                {h.cta2}
              </button>
            </div>

            {/* Trust Signals */}
            <div className="flex flex-wrap items-center gap-6">
              {[
              { icon: Shield, text: (h.trustItems || trustFallback[language] || trustFallback.en)[0], color: "#059669" },
              { icon: Clock, text: (h.trustItems || trustFallback[language] || trustFallback.en)[1], color: "#7c3aed" },
              { icon: CheckCircle2, text: (h.trustItems || trustFallback[language] || trustFallback.en)[2], color: "#2563eb" },
            ].map(({ icon: Icon, text, color }) => (
                <div key={text} className="flex items-center gap-2">
                  <Icon className="w-4 h-4 flex-shrink-0" style={{ color }} />
                  <span className="text-gray-600 text-sm font-medium">{text}</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* RIGHT: Dashboard Visualization */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
            className="relative"
          >
            {/* Main Dashboard Card (Glassmorphism) */}
            <div
              className="relative rounded-3xl overflow-hidden backdrop-blur-2xl"
              style={{
                background: "rgba(255, 255, 255, 0.7)",
                boxShadow: "0 40px 100px -20px rgba(79,70,229,0.25), inset 0 0 0 1px rgba(255,255,255,0.8)",
                border: "1px solid rgba(255,255,255,0.4)"
              }}
            >
              {/* Mac-style top bar */}
              <div
                className="flex items-center justify-between px-5 py-3.5 border-b"
                style={{ background: "#f8faff", borderColor: "#e8ecff" }}
              >
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-400" />
                  <div className="w-3 h-3 rounded-full bg-yellow-400" />
                  <div className="w-3 h-3 rounded-full bg-green-400" />
                </div>
                <div
                  className="px-4 py-1 rounded-lg text-xs font-medium text-gray-500 border"
                  style={{ background: "#fff", borderColor: "#e5e7eb" }}
                >
                  kwader.web.app/dashboard
                </div>
                <div className="w-16" />
              </div>

              {/* Dashboard Content */}
              <div className="p-5">
                {/* Header row */}
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <div className="text-gray-900 font-bold text-base">{h.dashboardLabels?.recentActivity || "لوحة التحكم"}</div>
                    <div className="text-gray-400 text-xs mt-0.5">يونيو 2026</div>
                  </div>
                  <div
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                    style={{ background: "#ecfdf5", color: "#059669" }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    {h.dashboardLabels?.attendanceRate || "معدل الحضور"}: 98.2%
                  </div>
                </div>

                {/* Stat Cards Row */}
                <div className="grid grid-cols-3 gap-3 mb-5">
                  {[
                    { label: h.dashboardLabels?.totalEmployees || "الموظفون", val: "128", icon: Users, color: "#4f46e5", bg: "#eef2ff" },
                    { label: h.dashboardLabels?.openPositions || "الحضور اليوم", val: "121", icon: Calendar, color: "#0284c7", bg: "#e0f2fe" },
                    { label: "الرواتب المعلقة", val: "3", icon: DollarSign, color: "#d97706", bg: "#fef3c7" },
                  ].map((stat, i) => (
                    <div
                      key={i}
                      className="rounded-2xl p-3"
                      style={{ background: stat.bg }}
                    >
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center mb-2"
                        style={{ background: stat.color }}
                      >
                        <stat.icon className="w-3.5 h-3.5 text-white" />
                      </div>
                      <div className="text-gray-900 font-extrabold text-xl leading-none">{stat.val}</div>
                      <div className="text-gray-500 text-[10px] mt-1 font-medium">{stat.label}</div>
                    </div>
                  ))}
                </div>

                {/* Employee List */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-700 text-sm font-bold">{h.dashboardLabels?.recentActivity || "آخر التحركات"}</span>
                    <span className="text-indigo-600 text-xs font-semibold cursor-pointer">{h.dashboardLabels?.viewAll || "عرض الكل"}</span>
                  </div>
                  {[
                    { name: "أحمد السيد", role: "مدير المبيعات", status: h.dashboardLabels?.checkedIn || "حاضر", statusColor: "#059669", statusBg: "#ecfdf5" },
                    { name: "سارة محمد", role: "محاسبة", status: h.dashboardLabels?.submittedLeave || "طلب إجازة", statusColor: "#7c3aed", statusBg: "#f5f3ff" },
                    { name: "خالد العمر", role: "مهندس تقنية", status: h.dashboardLabels?.reviewCompleted || "مراجعة مكتملة", statusColor: "#0284c7", statusBg: "#e0f2fe" },
                  ].map((emp, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors"
                    >
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                        style={{
                          background: ["#4f46e5", "#0284c7", "#059669"][i],
                        }}
                      >
                        {emp.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-gray-900 text-sm font-semibold truncate">{emp.name}</div>
                        <div className="text-gray-400 text-xs">{emp.role}</div>
                      </div>
                      <span
                        className="text-[10px] px-2.5 py-1 rounded-full font-bold flex-shrink-0"
                        style={{ color: emp.statusColor, background: emp.statusBg }}
                      >
                        {emp.status}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Payroll Progress Bar */}
                <div
                  className="mt-4 p-3 rounded-2xl"
                  style={{ background: "linear-gradient(135deg, #f5f3ff, #eef2ff)" }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-700 text-xs font-bold">مسير الرواتب - يونيو 2026</span>
                    <span className="text-indigo-600 text-xs font-bold">87%</span>
                  </div>
                  <div className="w-full bg-white/70 rounded-full h-2 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: "87%" }}
                      transition={{ duration: 1.5, ease: "easeOut", delay: 0.8 }}
                      className="h-full rounded-full"
                      style={{ background: "linear-gradient(90deg, #4f46e5, #7c3aed)" }}
                    />
                  </div>
                  <div className="text-gray-400 text-[10px] mt-1.5">112 من 128 موظف تمت معالجة رواتبهم</div>
                </div>
              </div>
            </div>

            <motion.div
              {...floatAnim}
              transition={{ ...floatAnim.transition, delay: 0 }}
              className="absolute -top-5 -right-5 md:-right-8 rounded-2xl px-4 py-3 z-20 backdrop-blur-xl"
              style={{
                background: "rgba(255, 255, 255, 0.85)",
                boxShadow: "0 15px 35px rgba(0,0,0,0.05), inset 0 0 0 1px rgba(255,255,255,0.5)",
                border: "1px solid rgba(229,231,235,0.5)",
              }}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: "#ecfdf5" }}
                >
                  <TrendingUp className="w-4.5 h-4.5 text-emerald-600" />
                </div>
                <div>
                  <div className="text-gray-900 text-xs font-bold">+18% كفاءة</div>
                  <div className="text-gray-400 text-[10px]">مقارنة بالشهر الماضي</div>
                </div>
              </div>
            </motion.div>

            <motion.div
              animate={{ y: [0, 8, 0] }}
              transition={{ repeat: Infinity, duration: 4.5, ease: "easeInOut", delay: 1.5 }}
              className="absolute -bottom-5 -left-5 md:-left-8 rounded-2xl px-4 py-3 z-20 backdrop-blur-xl"
              style={{
                background: "rgba(255, 255, 255, 0.85)",
                boxShadow: "0 15px 35px rgba(0,0,0,0.05), inset 0 0 0 1px rgba(255,255,255,0.5)",
                border: "1px solid rgba(229,231,235,0.5)",
              }}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: "#ede9fe" }}
                >
                  <DollarSign className="w-4.5 h-4.5 text-violet-600" />
                </div>
                <div>
                  <div className="text-gray-900 text-xs font-bold">مسير الرواتب جاهز ✓</div>
                  <div className="text-gray-400 text-[10px]">تمت المعالجة في 3 دقائق</div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>

        {/* Stats Bar */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="mt-16 lg:mt-20 grid grid-cols-2 md:grid-cols-4 gap-6"
        >
          {[
            { value: "150+", label: h.stats?.employees || (statsFallback[language] || statsFallback.en)[0], icon: "🏢", accent: "#4f46e5" },
            { value: "98%", label: h.stats?.satisfaction || (statsFallback[language] || statsFallback.en)[1], icon: "⭐", accent: "#f59e0b" },
            { value: "5,000+", label: (statsFallback[language] || statsFallback.en)[2], icon: "👤", accent: "#0284c7" },
            { value: "35", label: (statsFallback[language] || statsFallback.en)[3], icon: "🎁", accent: "#059669" },
          ].map((stat, i) => (
            <div
              key={i}
              className="text-center p-5 rounded-2xl bg-white border"
              style={{ borderColor: "#e8ecff", boxShadow: "0 2px 12px rgba(79,70,229,0.06)" }}
            >
              <div className="text-2xl mb-2">{stat.icon}</div>
              <div
                className="font-extrabold mb-1"
                style={{
                  fontSize: "1.8rem",
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  letterSpacing: "-0.02em",
                  color: stat.accent,
                }}
              >
                {stat.value}
              </div>
              <div className="text-gray-500 text-sm font-medium leading-snug">{stat.label}</div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
