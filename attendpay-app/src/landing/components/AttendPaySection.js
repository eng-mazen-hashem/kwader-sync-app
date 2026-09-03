import { motion } from "motion/react";
import { Clock, CheckCircle2, XCircle, AlertCircle, DollarSign, Calendar, ArrowRight } from "lucide-react";
import { useLanguage } from "../context/LanguageContext";

const attendanceData = {
  ar: [
    { name: "محمد أحمد", dept: "التسويق", status: "present", time: "08:02" },
    { name: "سارة خالد", dept: "المحاسبة", status: "late", time: "09:45" },
    { name: "علي حسن", dept: "المبيعات", status: "present", time: "07:58" },
    { name: "نورة فهد", dept: "الموارد البشرية", status: "absent", time: "—" },
    { name: "أحمد ناصر", dept: "التقنية", status: "present", time: "08:15" },
  ],
  en: [
    { name: "Mohammed Ahmed", dept: "Marketing", status: "present", time: "08:02" },
    { name: "Sarah Khalid", dept: "Accounting", status: "late", time: "09:45" },
    { name: "Ali Hassan", dept: "Sales", status: "present", time: "07:58" },
    { name: "Noura Fahad", dept: "HR", status: "absent", time: "—" },
    { name: "Ahmed Nasser", dept: "Engineering", status: "present", time: "08:15" },
  ]
};

const statusConfig = {
  ar: {
    present: { label: "حاضر", Icon: CheckCircle2, color: "#059669", bg: "#ecfdf5" },
    late: { label: "متأخر", Icon: AlertCircle, color: "#d97706", bg: "#fef3c7" },
    absent: { label: "غائب", Icon: XCircle, color: "#dc2626", bg: "#fef2f2" },
  },
  en: {
    present: { label: "Present", Icon: CheckCircle2, color: "#059669", bg: "#ecfdf5" },
    late: { label: "Late", Icon: AlertCircle, color: "#d97706", bg: "#fef3c7" },
    absent: { label: "Absent", Icon: XCircle, color: "#dc2626", bg: "#fef2f2" },
  }
};

const payrollSteps = {
  ar: [
    { step: "01", title: "جمع بيانات الحضور", desc: "يسحب النظام تلقائياً سجلات الدوام لكل الموظفين", done: true },
    { step: "02", title: "حساب الاستحقاقات", desc: "يحسب الراتب الأساسي والإضافي والخصومات تلقائياً", done: true },
    { step: "03", title: "مراجعة المدير", desc: "مراجعة بنقرة واحدة لاعتماد مسير الرواتب", done: false },
    { step: "04", title: "صرف الرواتب", desc: "تحويل فوري لحسابات الموظفين بخطوة واحدة", done: false },
  ],
  en: [
    { step: "01", title: "Collect Attendance", desc: "System auto-syncs timesheets for all employees", done: true },
    { step: "02", title: "Calculate Payroll", desc: "Auto-calculates base, overtime, and deductions", done: true },
    { step: "03", title: "Manager Review", desc: "One-click review and approval process", done: false },
    { step: "04", title: "Disburse Salaries", desc: "Instant direct deposits to employee accounts", done: false },
  ]
};

const contentTranslations = {
  ar: {
    badge: "🔗 الحضور + الرواتب = نظام واحد",
    headlineFrom: "من",
    headlineAttendance: "سجل الحضور",
    headlineTo: "إلى",
    headlinePayroll: "مسير الرواتب",
    headlineAuto: "تلقائياً",
    subtext: "لا حاجة لإدخال البيانات يدوياً. كوادر يربط الحضور بالرواتب تلقائياً ويولّد مسير الرواتب في دقائق معدودة، لتوفير وقتك وجهدك.",
    dailyLog: "سجل الحضور اليومي",
    date: "الأحد، 15 يونيو 2026",
    today: "اليوم",
    presentCnt: "حاضرون",
    lateCnt: "متأخرون",
    absentCnt: "غائبون",
    payrollTitle: "مسير رواتب يونيو 2026",
    employeesCount: "128 موظف",
    completedStatus: "مكتمل",
    processed: "112 تمت معالجتهم",
    pending: "16 معلقون",
    stepsTitle: "خطوات معالجة الراتب",
    completedBadge: "مكتمل",
    issueBtn: "اعتماد وإصدار المسير"
  },
  en: {
    badge: "🔗 Attendance + Payroll = One System",
    headlineFrom: "From",
    headlineAttendance: "Timesheets",
    headlineTo: "to",
    headlinePayroll: "Payroll",
    headlineAuto: "Automatically",
    subtext: "No manual data entry required. Kwader automatically links attendance to payroll and generates your payroll in minutes, saving you time and effort.",
    dailyLog: "Daily Attendance Log",
    date: "Sunday, June 15, 2026",
    today: "Today",
    presentCnt: "Present",
    lateCnt: "Late",
    absentCnt: "Absent",
    payrollTitle: "June 2026 Payroll",
    employeesCount: "128 Employees",
    completedStatus: "Complete",
    processed: "112 Processed",
    pending: "16 Pending",
    stepsTitle: "Processing Steps",
    completedBadge: "Done",
    issueBtn: "Approve & Issue Payroll"
  }
};

export function AttendPaySection() {
  const { isRTL, language } = useLanguage();
  const lang = language === "en" ? "en" : "ar";
  const t = contentTranslations[lang];

  return (
    <section
      className="py-24 lg:py-32 relative overflow-hidden"
      style={{ background: "linear-gradient(180deg, #ffffff 0%, #f8f9ff 100%)" }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Section Header */}
        <div className="text-center mb-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 mb-6 border"
            style={{ background: "linear-gradient(135deg, #ecfdf5, #d1fae5)", borderColor: "#6ee7b7" }}
          >
            <span className="text-emerald-700 text-sm font-bold">{t.badge}</span>
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-gray-950 mb-6 tracking-tight"
            style={{
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              fontWeight: 800,
              fontSize: "clamp(2rem, 4vw, 3.5rem)",
              lineHeight: 1.15,
              letterSpacing: "-0.025em",
            }}
          >
            {t.headlineFrom}{" "}
            <span style={{
              backgroundImage: "linear-gradient(135deg, #0284c7, #0ea5e9)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}>
              {t.headlineAttendance}
            </span>{" "}
            {t.headlineTo}{" "}
            <span style={{
              backgroundImage: "linear-gradient(135deg, #059669, #10b981)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}>
              {t.headlinePayroll}
            </span>{" "}
            {t.headlineAuto}
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-gray-500 max-w-2xl mx-auto"
            style={{ fontSize: "1.15rem", lineHeight: 1.8 }}
          >
            {t.subtext}
          </motion.p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* LEFT: Attendance Table Preview */}
          <motion.div
            initial={{ opacity: 0, x: isRTL ? 40 : -40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            <div
              className="rounded-3xl overflow-hidden bg-white relative group"
              style={{
                boxShadow: "0 25px 50px -12px rgba(2, 132, 199, 0.15), 0 0 0 1px rgba(2, 132, 199, 0.05)",
              }}
            >
              {/* Header */}
              <div
                className="px-6 py-5 flex items-center justify-between border-b"
                style={{ background: "linear-gradient(135deg, #f0f9ff, #e0f2fe)", borderColor: "#bae6fd" }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shadow-sm"
                    style={{ background: "linear-gradient(135deg, #0284c7, #0369a1)" }}
                  >
                    <Clock className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <div className="text-slate-900 font-bold text-[15px]">{t.dailyLog}</div>
                    <div className="text-slate-500 text-xs mt-0.5">{t.date}</div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-xs font-bold text-sky-700 bg-white px-3 py-1.5 rounded-lg border border-sky-100 shadow-sm">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{t.today}</span>
                </div>
              </div>

              {/* Summary Row */}
              <div className="grid grid-cols-3 gap-0 border-b" style={{ borderColor: "#f1f5f9" }}>
                {[
                  { label: t.presentCnt, value: "3", color: "#059669", bg: "#ecfdf5" },
                  { label: t.lateCnt, value: "1", color: "#d97706", bg: "#fef3c7" },
                  { label: t.absentCnt, value: "1", color: "#dc2626", bg: "#fef2f2" },
                ].map((s, i) => (
                  <div
                    key={i}
                    className="py-4 text-center"
                    style={{ background: s.bg, borderRight: i < 2 ? "1px solid #f1f5f9" : undefined }}
                  >
                    <div className="font-black text-2xl" style={{ color: s.color }}>{s.value}</div>
                    <div className="text-[11px] font-bold text-slate-500 mt-1 uppercase tracking-wider">{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Employee Rows */}
              <div className="divide-y" style={{ borderColor: "#f8fafc" }}>
                {attendanceData[lang].map((emp, i) => {
                  const cfg = statusConfig[lang][emp.status];
                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: isRTL ? -10 : 10 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: i * 0.08 + 0.3 }}
                      className="flex items-center px-6 py-3.5 hover:bg-slate-50/80 transition-colors"
                    >
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0 me-3.5 shadow-sm"
                        style={{ background: ["#4f46e5", "#7c3aed", "#0284c7", "#d97706", "#059669"][i] }}
                      >
                        {emp.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-slate-900 text-sm font-bold truncate">{emp.name}</div>
                        <div className="text-slate-500 text-xs mt-0.5">{emp.dept}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-slate-600 text-[11px] font-mono bg-slate-100 px-2 py-1 rounded-md font-medium border border-slate-200">
                          {emp.time}
                        </span>
                        <span
                          className="inline-flex items-center gap-1.5 text-[10px] px-2.5 py-1.5 rounded-full font-bold uppercase tracking-wide"
                          style={{ color: cfg.color, background: cfg.bg }}
                        >
                          <cfg.Icon className="w-3 h-3" strokeWidth={2.5} />
                          {cfg.label}
                        </span>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </motion.div>

          {/* RIGHT: Payroll Pipeline */}
          <motion.div
            initial={{ opacity: 0, x: isRTL ? -40 : 40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="space-y-5"
          >
            {/* Payroll Card Header */}
            <div
              className="rounded-3xl p-6 relative overflow-hidden"
              style={{
                background: "linear-gradient(135deg, #1e1b4b, #311e69)",
                boxShadow: "0 20px 40px rgba(79,70,229,0.2)",
              }}
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-5 rounded-full blur-2xl transform translate-x-1/2 -translate-y-1/2"></div>
              
              <div className="flex items-center justify-between mb-6 relative z-10">
                <div className="flex items-center gap-3.5">
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center backdrop-blur-md"
                    style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)" }}
                  >
                    <DollarSign className="w-6 h-6 text-emerald-400" />
                  </div>
                  <div>
                    <div className="text-white font-bold text-[15px]">{t.payrollTitle}</div>
                    <div className="text-indigo-200 text-xs mt-0.5">{t.employeesCount}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-emerald-400 font-black text-2xl tracking-tight">87%</div>
                  <div className="text-indigo-200 text-xs uppercase tracking-wider font-bold mt-0.5">{t.completedStatus}</div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-indigo-900/50 rounded-full h-3 overflow-hidden relative z-10 border border-white/5">
                <motion.div
                  initial={{ width: 0 }}
                  whileInView={{ width: "87%" }}
                  viewport={{ once: true }}
                  transition={{ duration: 1.5, ease: "easeOut", delay: 0.6 }}
                  className="h-full rounded-full relative"
                  style={{ background: "linear-gradient(90deg, #34d399, #059669)" }}
                >
                  <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9InN0cmlwZXMiIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdHRlcm5UcmFuc2Zvcm0+cm90YXRlKDQ1KTwvcGF0dGVyblRyYW5zZm9ybT48cmVjdCB3aWR0aD0iMjAiIGhlaWdodD0iNDAiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4xNSkiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjc3RyaXBlcykiLz48L3N2Zz4=')] opacity-30"></div>
                </motion.div>
              </div>
              <div className="flex justify-between mt-3 relative z-10">
                <span className="text-indigo-200 text-xs font-medium">{t.processed}</span>
                <span className="text-indigo-200 text-xs font-medium">{t.pending}</span>
              </div>
            </div>

            {/* Pipeline Steps */}
            <div
              className="rounded-3xl p-6 space-y-4 bg-white"
              style={{ border: "1px solid #e2e8f0", boxShadow: "0 10px 30px rgba(0,0,0,0.02)" }}
            >
              <div className="text-slate-900 font-extrabold text-sm mb-5 uppercase tracking-wide">{t.stepsTitle}</div>
              {payrollSteps[lang].map((s, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: isRTL ? -15 : 15 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.12 + 0.3 }}
                  className="flex items-start gap-4 p-3.5 rounded-2xl transition-colors"
                  style={{ background: s.done ? "#f0fdf4" : "#f8fafc", border: `1px solid ${s.done ? '#dcfce7' : 'transparent'}` }}
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black flex-shrink-0 shadow-sm"
                    style={{
                      background: s.done ? "linear-gradient(135deg, #10b981, #059669)" : "#e2e8f0",
                      color: s.done ? "#ffffff" : "#64748b",
                    }}
                  >
                    {s.done ? <CheckCircle2 className="w-5 h-5" /> : s.step}
                  </div>
                  <div className="pt-0.5">
                    <div
                      className="font-bold text-[14px]"
                      style={{ color: s.done ? "#065f46" : "#334155" }}
                    >
                      {s.title}
                      {s.done && (
                        <span className="mx-2 inline-block text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-extrabold tracking-wide uppercase align-middle">
                          {t.completedBadge}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 mt-1 leading-relaxed">{s.desc}</div>
                  </div>
                </motion.div>
              ))}

              <button
                className="w-full flex items-center justify-center gap-2.5 py-4 rounded-2xl text-sm font-bold transition-all duration-300 hover:-translate-y-1 mt-3 group"
                style={{
                  background: "linear-gradient(135deg, #4f46e5, #7c3aed)",
                  color: "#ffffff",
                  boxShadow: "0 8px 25px rgba(79,70,229,0.35)",
                }}
              >
                {t.issueBtn}
                <ArrowRight className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
