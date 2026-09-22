import { useState, useEffect, useRef, Fragment } from "react";
import {
  CreditCard, Check, Users,
  Search, Globe, Bell, Lock, Database, ChevronDown,
  Wifi, WifiOff, RefreshCw, Send, AlertTriangle, Server,
  CheckCircle, Loader2, X, MessageSquare, Clock, User, BookOpen, Activity, UploadCloud,
  Megaphone, Building2, Plus, Edit, Trash2, Eye, EyeOff
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { supabase } from "../../supabaseClient";
import { useLocale } from "../../context/LocaleContext";
import QRCode from "react-qr-code";


// -------------------------------------------------------------------------
// SUBSCRIPTION PLANS VIEW
// -------------------------------------------------------------------------
export function SubscriptionPlansView({ planStats, loading: statsLoading = false }) {
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState([]);
  const [editingPlan, setEditingPlan] = useState(null);

  // Modal Edit states
  const [editMonthly, setEditMonthly] = useState(0);
  const [editYearly, setEditYearly] = useState(0);
  const [editDeviceQuota, setEditDeviceQuota] = useState(1);
  const [editEmployeeQuota, setEditEmployeeQuota] = useState(25);
  const [editBadge, setEditBadge] = useState("");
  const [editFeatures, setEditFeatures] = useState([]);
  const [newFeatureText, setNewFeatureText] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const fetchPlanSettings = async () => {
    setLoading(true);
    try {
      const { data: settings, error } = await supabase
        .from("system_settings")
        .select("key, value");

      if (error) throw error;

      let monthlyPrices = [690, 1690, 3290];
      let yearlyPrices = [550, 1350, 2650];
      let plansDetails = null;

      if (settings) {
        settings.forEach((s) => {
          if (s.key === "pricing_monthly") monthlyPrices = s.value;
          if (s.key === "pricing_yearly") yearlyPrices = s.value;
          if (s.key === "pricing_plans_details") plansDetails = s.value;
        });
      }

      if (!plansDetails) {
        plansDetails = [
          {
            name: "Starter",
            color: "border-gray-200",
            headerColor: "bg-gray-50",
            badge: null,
            deviceQuota: 1,
            employeeQuota: 25,
            features: [
              "حتى 25 موظفاً (1 فرع / 1 جهاز بصمة ZK)",
              "ربط ومزامنة أجهزة ZKTeco تلقائياً بدون IP ثابت",
              "تطبيق الموظفين بالموبايل (حضور GPS وبصمة ورصيد)",
              "إدارة الإجازات والأذونات ومسير رواتب أساسي",
              "دعم فني سريع عبر المنصة والواتساب",
            ],
          },
          {
            name: "Pro",
            color: "border-blue-300",
            headerColor: "bg-blue-600",
            badge: "الأكثر طلباً",
            deviceQuota: 3,
            employeeQuota: 60,
            features: [
              "حتى 60 موظفاً (حتى 3 فروع / 3 أجهزة ZK)",
              "تطبيق موظفين متكامل (قسائم رواتب + سلف + طلبات)",
              "المساعد الذكي (وتين AI) للتحليلات الإدارية الفورية",
              "بوابة إشعارات الواتساب الآلية التفاعلية للشركة",
              "محرك الرواتب والضرائب والتأمينات المصرية (قانون 148)",
              "دعم فني ذو أولوية فائقة عبر الواتساب",
            ],
          },
          {
            name: "Enterprise",
            color: "border-violet-300",
            headerColor: "bg-violet-600",
            badge: "المؤسسات الكبرى",
            deviceQuota: 999,
            employeeQuota: 150,
            features: [
              "حتى 150 موظفاً (فروع وأجهزة غير محدودة)",
              "كل مميزات باقة Pro بلا أي قيود أو حدود",
              "بوابة واتساب مخصصة برقم الشركة (QR مستقل)",
              "ذكاء اصطناعي غير محدود وأتمتة التقارير التنفيذية",
              "محرك قواعد الورديات المعقد والجزاءات التراكمية",
              "مدير حساب مخصص وعقود خاصة وتدريب شامل",
            ],
          },
        ];
      }

      const combined = plansDetails.map((plan, idx) => ({
        ...plan,
        monthlyPrice: monthlyPrices[idx] ?? 0,
        yearlyPrice: yearlyPrices[idx] ?? 0,
        price: monthlyPrices[idx] ?? 0,
      }));

      setPlans(combined);
    } catch (err) {
      console.error("Error fetching plan settings:", err);
      toast.error("فشل في تحميل تفاصيل وأسعار الباقات.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlanSettings();
  }, []);

  const startEditing = (plan) => {
    setEditingPlan(plan);
    setEditMonthly(plan.monthlyPrice);
    setEditYearly(plan.yearlyPrice);
    setEditDeviceQuota(plan.deviceQuota ?? (plan.name === 'Enterprise' ? 999 : plan.name === 'Pro' ? 3 : 1));
    setEditEmployeeQuota(plan.employeeQuota ?? (plan.name === 'Enterprise' ? 150 : plan.name === 'Pro' ? 60 : 25));
    setEditBadge(plan.badge || "");
    setEditFeatures([...plan.features]);
    setNewFeatureText("");
  };

  const addFeature = () => {
    if (newFeatureText.trim() && !editFeatures.includes(newFeatureText.trim())) {
      setEditFeatures([...editFeatures, newFeatureText.trim()]);
      setNewFeatureText("");
    }
  };

  const removeFeature = (featureToRemove) => {
    setEditFeatures(editFeatures.filter((f) => f !== featureToRemove));
  };

  const savePlanChanges = async () => {
    setIsSaving(true);
    try {
      const planIdx = plans.findIndex((p) => p.name === editingPlan.name);
      if (planIdx === -1) return;

      const updatedPlans = [...plans];
      updatedPlans[planIdx] = {
        ...editingPlan,
        monthlyPrice: parseFloat(editMonthly) || 0,
        yearlyPrice: parseFloat(editYearly) || 0,
        deviceQuota: parseInt(editDeviceQuota) || 1,
        employeeQuota: parseInt(editEmployeeQuota) || 25,
        badge: editBadge.trim() || null,
        features: editFeatures
      };

      const monthlyPrices = updatedPlans.map((p) => p.monthlyPrice || 0);
      const yearlyPrices = updatedPlans.map((p) => p.yearlyPrice || 0);
      const plansDetails = updatedPlans.map(({ name, badge, color, headerColor, features, deviceQuota, employeeQuota }) => ({
        name: name || "",
        badge: badge || "",
        color: color || "",
        headerColor: headerColor || "",
        features: features || [],
        deviceQuota: deviceQuota ?? (name === 'Enterprise' ? 999 : name === 'Pro' ? 3 : 1),
        employeeQuota: employeeQuota ?? (name === 'Enterprise' ? 150 : name === 'Pro' ? 60 : 25)
      }));

      const { error } = await supabase
        .from("system_settings")
        .upsert([
          { key: "pricing_monthly", value: monthlyPrices },
          { key: "pricing_yearly", value: yearlyPrices },
          { key: "pricing_plans_details", value: plansDetails }
        ], { onConflict: 'key' });

      if (error) throw error;

      setPlans(updatedPlans);
      setEditingPlan(null);
      toast.success(`تم تحديث باقة "${editingPlan.name}" وحفظ الأسعار بنجاح! ✅`);
    } catch (err) {
      console.error("Save plan error:", err);
      toast.error("فشل في حفظ تعديلات الباقة: " + (err.message || "حدث خطأ غير متوقع"));
    } finally {
      setIsSaving(false);
    }
  };

  const stats = planStats || {};
  const planCards = plans.map((plan) => {
    const metrics = stats[plan.name] || { users: 0, revenue: 0 };
    return { ...plan, users: metrics.users, revenue: metrics.revenue };
  });

  const revenueValues = planCards.map((plan) => plan.revenue || 0);
  const maxRevenue = Math.max(1, ...revenueValues);

  if (loading) {
    return (
      <div className="py-12 flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        <span className="text-sm text-gray-500 font-semibold">جاري تحميل باقات الاشتراكات...</span>
      </div>
    );
  }

  const totalPlanRevenue = planCards.reduce((acc, p) => acc + (p.revenue || 0), 0);
  const totalPayingUsers = planCards.filter(p => (p.revenue > 0 || p.name === "Starter" || p.name === "Pro" || p.name === "Enterprise")).reduce((acc, p) => acc + (p.users || 0), 0);

  return (
    <div className="space-y-6" style={{ textAlign: "right", direction: "rtl" }}>
      {/* Revenue & Profit Banner in Plans View */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 rounded-2xl p-6 text-white shadow-xl flex flex-col md:flex-row items-center justify-between gap-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-amber-300 font-bold text-xs uppercase tracking-wider">
            <span>✨</span> لوحة إيرادات وأرباح الباقات
          </div>
          <h2 className="text-xl font-extrabold text-white">تحليل دخل الاشتراكات الفعلي</h2>
          <p className="text-xs text-slate-300">يتم تجميع الإيرادات شهرياً وسنوياً بناءً على المبالغ الحقيقية المدفوعة من عملائك</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 w-full md:w-auto">
          <div className="bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-center">
            <div className="text-[10px] text-slate-300 font-bold">الدخل الشهري الفعلي</div>
            <div className="text-emerald-400 font-black text-base mt-1">{totalPlanRevenue.toLocaleString()} ج.م</div>
          </div>
          <div className="bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-center">
            <div className="text-[10px] text-slate-300 font-bold">الدخل السنوي المتوقع</div>
            <div className="text-amber-300 font-black text-base mt-1">{(totalPlanRevenue * 12).toLocaleString()} ج.م</div>
          </div>
          <div className="bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-center col-span-2 sm:col-span-1">
            <div className="text-[10px] text-slate-300 font-bold">العملاء المشتركون</div>
            <div className="text-sky-300 font-black text-base mt-1">{totalPayingUsers} منشأة</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {planCards.map((plan, i) => (
          <motion.div
            key={plan.name}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className={`bg-white rounded-2xl border-2 ${plan.color || 'border-gray-200'} overflow-hidden shadow-sm hover:shadow-lg transition-shadow`}
          >
            <div className={`${plan.headerColor || 'bg-slate-800'} px-6 py-5`}>
              <div className="flex items-start justify-between mb-2">
                <h3 className="text-white" style={{ fontWeight: 800, fontSize: "1.2rem" }}>
                  {plan.name}
                </h3>
                {plan.badge && (
                  <span className="text-xs px-2.5 py-1 rounded-full bg-white/20 text-white" style={{ fontWeight: 700 }}>
                    {plan.badge}
                  </span>
                )}
              </div>
              <div className="text-white" style={{ fontWeight: 800, fontSize: "1.6rem" }}>
                {plan.monthlyPrice} ج.م<span style={{ fontWeight: 400, fontSize: "0.85rem" }}>/شهرياً</span>
              </div>
              <div className="text-white/80 text-xs mt-1 font-semibold">
                الدفع السنوي: {plan.yearlyPrice} ج.م/شهرياً
              </div>
            </div>
            <div className="px-6 py-5">
              <div className="grid grid-cols-2 gap-3 mb-5">
                <div className="bg-gray-50 rounded-xl p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Users className="w-3.5 h-3.5 text-gray-450" />
                    <span className="text-gray-400 text-[0.65rem] font-bold">المشتركون</span>
                  </div>
                  <div className="text-gray-900" style={{ fontWeight: 800, fontSize: "1.3rem" }}>
                    {statsLoading ? "—" : plan.users.toLocaleString()}
                  </div>
                </div>
                <div className="bg-gray-50 rounded-xl p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <CreditCard className="w-3.5 h-3.5 text-gray-450" />
                    <span className="text-gray-400 text-[0.65rem] font-bold">الإيرادات</span>
                  </div>
                  <div className="text-gray-900" style={{ fontWeight: 700, fontSize: "0.8rem" }}>
                    {statsLoading ? "—" : `${plan.revenue.toLocaleString()} ج.م`}
                  </div>
                </div>
              </div>
              <ul className="space-y-2.5 mb-5">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                    <span className="text-gray-600" style={{ fontSize: "0.82rem" }}>{f}</span>
                  </li>
                ))}
              </ul>
              <button
                onClick={() => startEditing(plan)}
                className="w-full py-2.5 rounded-xl border-2 border-gray-200 text-slate-700 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50/50 transition-all text-xs font-bold"
              >
                تعديل الخطة والأسعار
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Revenue summary */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h3 className="text-gray-900 mb-4" style={{ fontWeight: 700, fontSize: "1rem" }}>تحليل الإيرادات الشهرية للباقات (MRR)</h3>
        <div className="flex items-end gap-4 h-24 mb-3">
          {planCards.map((plan) => {
            const height = plan.revenue === 0 ? 8 : Math.round((plan.revenue / maxRevenue) * 100);
            return (
              <div key={plan.name} className="flex-1 flex flex-col items-center gap-2">
                <div
                  className={`w-full rounded-t-lg ${plan.name === "Starter" || plan.name === "Free" ? "bg-emerald-500" : plan.name === "Pro" ? "bg-blue-500" : "bg-violet-500"}`}
                  style={{ height: `${height}%` }}
                />
              </div>
            );
          })}
        </div>
        <div className="grid grid-cols-3 gap-4">
          {planCards.map((plan) => (
            <div key={plan.name} className="text-center">
              <div className={plan.name === "Starter" || plan.name === "Free" ? "text-emerald-600" : plan.name === "Pro" ? "text-blue-600" : "text-violet-600"} style={{ fontWeight: 800, fontSize: "1.1rem" }}>
                {statsLoading ? "—" : `${plan.revenue.toLocaleString()} ج.م`}
              </div>
              <div className="text-gray-400 text-xs mt-1">{plan.name} MRR</div>
            </div>
          ))}
        </div>
      </div>

      {/* Edit Plan Modal */}
      <AnimatePresence>
        {editingPlan && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingPlan(null)}
              className="absolute inset-0 bg-black/50 backdrop-blur-xs"
            />

            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-white w-full max-w-lg rounded-2xl shadow-xl overflow-hidden z-10 border border-slate-100 flex flex-col"
              style={{ direction: "rtl", textAlign: "right" }}
            >
              {/* Header */}
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                    <CreditCard className="w-4.5 h-4.5" />
                  </div>
                  <h3 className="text-gray-900 font-bold text-sm">تعديل باقة: {editingPlan.name}</h3>
                </div>
                <button
                  onClick={() => setEditingPlan(null)}
                  className="w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-655 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">

                {/* Prices row */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5">السعر الشهري (ج.م / شهرياً)</label>
                    <input
                      type="number"
                      value={editMonthly}
                      onChange={(e) => setEditMonthly(parseFloat(e.target.value) || 0)}
                      className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition-all outline-none font-semibold"
                      style={{ direction: "ltr" }}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5">الدفع السنوي (ج.م / شهرياً)</label>
                    <input
                      type="number"
                      value={editYearly}
                      onChange={(e) => setEditYearly(parseFloat(e.target.value) || 0)}
                      className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition-all outline-none font-semibold"
                      style={{ direction: "ltr" }}
                    />
                  </div>
                </div>

                {/* Quotas row */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5">سعة الأجهزة (جهاز/فرع)</label>
                    <input
                      type="number"
                      value={editDeviceQuota}
                      onChange={(e) => setEditDeviceQuota(parseInt(e.target.value) || 0)}
                      className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition-all outline-none font-semibold"
                      style={{ direction: "ltr" }}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5">سعة الموظفين (الحد الأقصى)</label>
                    <input
                      type="number"
                      value={editEmployeeQuota}
                      onChange={(e) => setEditEmployeeQuota(parseInt(e.target.value) || 0)}
                      className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition-all outline-none font-semibold"
                      style={{ direction: "ltr" }}
                    />
                  </div>
                </div>

                {/* Badge info */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1.5">الشارة المميزة للباقة (Badge)</label>
                  <input
                    type="text"
                    value={editBadge}
                    onChange={(e) => setEditBadge(e.target.value)}
                    placeholder="مثال: الأكثر شعبية، العرض الأفضل، الخ..."
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition-all outline-none"
                  />
                </div>

                {/* Features List Customizer */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1.5">مميزات وخصائص الباقة</label>

                  {/* Add feature input */}
                  <div className="flex gap-2 mb-3">
                    <input
                      type="text"
                      value={newFeatureText}
                      onChange={(e) => setNewFeatureText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addFeature();
                        }
                      }}
                      placeholder="أضف ميزة جديدة لهذه الباقة..."
                      className="flex-1 text-xs px-3.5 py-2 rounded-xl border border-slate-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition-all outline-none"
                    />
                    <button
                      onClick={addFeature}
                      type="button"
                      className="text-xs px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold transition-all shadow-sm active:scale-95"
                    >
                      إضافة
                    </button>
                  </div>

                  {/* Features Tag/Pill Container */}
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 min-h-[100px] flex flex-wrap gap-2 content-start">
                    {editFeatures.length === 0 && (
                      <span className="text-[0.7rem] text-slate-400 font-semibold m-auto">لا توجد مميزات مضافة بعد. اكتب ميزة أعلاه وأضفها.</span>
                    )}
                    {editFeatures.map((feat, fIdx) => (
                      <div
                        key={fIdx}
                        className="flex items-center gap-1.5 px-2.5 py-1 bg-white border border-slate-200 rounded-lg shadow-xs text-[0.7rem] font-medium text-slate-700 hover:border-red-200 hover:bg-red-50/20 group transition-all"
                      >
                        <span>{feat}</span>
                        <button
                          type="button"
                          onClick={() => removeFeature(feat)}
                          className="text-slate-450 hover:text-red-650 font-bold ml-0.5"
                          title="حذف الميزة"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-2 bg-slate-50">
                <button
                  onClick={() => setEditingPlan(null)}
                  disabled={isSaving}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  إلغاء
                </button>
                <button
                  onClick={savePlanChanges}
                  disabled={isSaving || editFeatures.length === 0}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-colors flex items-center gap-1.5 shadow-md shadow-blue-150 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSaving ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : null}
                  حفظ التغييرات
                </button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

const priorityStyle = {
  Low: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  Medium: "bg-amber-50 text-amber-700 border border-amber-200",
  High: "bg-red-50 text-red-700 border border-red-200",
  Critical: "bg-red-100 text-red-800 border border-red-300",
};

const statusStyle = {
  Open: "bg-blue-50 text-blue-700 border border-blue-200",
  "In Progress": "bg-orange-50 text-orange-700 border border-orange-200",
  Resolved: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  Closed: "bg-gray-100 text-gray-600 border border-gray-200",
};

// -------------------------------------------------------------------------
export function SupportTicketsView({ tickets = [], stats, totalCount, loading = false, onQueryChange, onRefresh }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [priorityFilter, setPriorityFilter] = useState("All");
  const [page, setPage] = useState(1);
  const pageSize = 7;
  const serverMode = typeof onQueryChange === "function";

  // Support Drawer States
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [replies, setReplies] = useState([]);
  const [loadingReplies, setLoadingReplies] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [assigneeInput, setAssigneeInput] = useState("");
  const [statusValue, setStatusValue] = useState("Open");
  const [priorityValue, setPriorityValue] = useState("Medium");
  const [isSendingReply, setIsSendingReply] = useState(false);

  // Supabase Resource Optimization States
  const [hasMoreReplies, setHasMoreReplies] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [typingUsers, setTypingUsers] = useState([]);
  const [localTyping, setLocalTyping] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  const chatEndRef = useRef(null);
  const presenceChannelRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Fetch current user for presence synchronization
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);
    };
    getUser();
  }, []);

  // Scroll to chat bottom when a new reply arrives, except when loading older replies
  useEffect(() => {
    if (chatEndRef.current && !loadingOlder) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [replies, loadingOlder]);

  /**
   * Supabase Optimization: Range-based initial load of replies (last 30 messages).
   * Prevents full table dump and saves initial bandwidth.
   */
  const fetchReplies = async (ticketId, isLoadMore = false) => {
    if (isLoadMore) {
      setLoadingOlder(true);
    } else {
      setLoadingReplies(true);
    }
    try {
      const fromRange = isLoadMore ? replies.length : 0;
      const toRange = fromRange + 29;

      const { data, error } = await supabase
        .from("support_ticket_replies")
        .select("*")
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: false }) // Get newest first to isolate correct range
        .range(fromRange, toRange);

      if (error) throw error;

      // Reverse the batch back to chronological order for visual display
      const newReplies = data ? [...data].reverse() : [];

      // If we got exactly 30 replies, there might be more on the server
      setHasMoreReplies(newReplies.length === 30);

      if (isLoadMore) {
        setReplies((prev) => [...newReplies, ...prev]);
      } else {
        setReplies(newReplies);
      }
    } catch (err) {
      console.error("Error fetching replies:", err);
      toast.error("فشل في تحميل ردود التذكرة.");
    } finally {
      setLoadingReplies(false);
      setLoadingOlder(false);
    }
  };

  /**
   * Realtime Connection Management Optimization (Critical):
   * 1. Subscribes specifically to replies belonging to the active ticket (filtered by ticket_id).
   *    Never listens to the entire messages/replies table globally.
   * 2. Absolute Cleanup: removes the channel on unmount/dependency change to prevent memory leaks and zombie sockets.
   */
  useEffect(() => {
    if (!selectedTicket?.id) return;

    const channelName = `admin-replies-${selectedTicket.id}`;
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "support_ticket_replies",
          filter: `ticket_id=eq.${selectedTicket.id}`,
        },
        (payload) => {
          // Guard against duplicate insertions in the UI state
          setReplies((prev) => {
            if (prev.some((r) => r.id === payload.new.id)) return prev;
            return [...prev, payload.new];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedTicket?.id]);

  /**
   * Minimalist Presence Optimization:
   * Uses highly compressed payloads (single letter keys: 'u' for user ID, 't' for typing status)
   * to sync real-time typing indicators without consuming excess bandwidth or limits.
   */
  useEffect(() => {
    if (!selectedTicket?.id || !currentUser?.id) return;

    const presenceChannel = supabase.channel(`admin-presence-${selectedTicket.id}`);
    presenceChannelRef.current = presenceChannel;

    presenceChannel
      .on("presence", { event: "sync" }, () => {
        const state = presenceChannel.presenceState();
        const typingList = [];
        Object.keys(state).forEach((key) => {
          const presences = state[key];
          presences.forEach((p) => {
            if (p.t && p.u !== currentUser.id) {
              typingList.push(p.name || "العميل");
            }
          });
        });
        setTypingUsers(typingList);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(presenceChannel);
      presenceChannelRef.current = null;
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [selectedTicket?.id, currentUser?.id]);

  const handleTextareaChange = (e) => {
    setReplyText(e.target.value);

    // Sync typing status if channel is active
    if (presenceChannelRef.current && currentUser?.id) {
      if (!localTyping) {
        setLocalTyping(true);
        presenceChannelRef.current.track({
          u: currentUser.id,
          t: true,
          name: "الدعم الفني (Super Admin)",
        });
      }

      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        setLocalTyping(false);
        if (presenceChannelRef.current) {
          presenceChannelRef.current.track({
            u: currentUser.id,
            t: false,
            name: "الدعم الفني (Super Admin)",
          });
        }
      }, 3000);
    }
  };

  const handleStatusChange = async (nextStatus) => {
    if (!selectedTicket) return;
    setStatusValue(nextStatus);
    try {
      const { error } = await supabase
        .from("support_tickets")
        .update({ status: nextStatus })
        .eq("id", selectedTicket.id);
      if (error) throw error;
      toast.success(`تم تحديث حالة التذكرة إلى: ${nextStatus}`);
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error(err);
      toast.error("فشل في تحديث حالة التذكرة.");
    }
  };

  const handlePriorityChange = async (nextPriority) => {
    if (!selectedTicket) return;
    setPriorityValue(nextPriority);
    try {
      const { error } = await supabase
        .from("support_tickets")
        .update({ priority: nextPriority })
        .eq("id", selectedTicket.id);
      if (error) throw error;
      toast.success(`تم تحديث أولوية التذكرة إلى: ${nextPriority}`);
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error(err);
      toast.error("فشل في تحديث الأولوية.");
    }
  };

  const handleAssigneeChange = async () => {
    if (!selectedTicket) return;
    try {
      const { error } = await supabase
        .from("support_tickets")
        .update({ assignee: assigneeInput })
        .eq("id", selectedTicket.id);
      if (error) throw error;
      toast.success(`تم تعيين المسؤول: ${assigneeInput || "غير معين"}`);
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error(err);
      toast.error("فشل في تعيين المسؤول.");
    }
  };

  /**
   * Optimistic UI Refactoring:
   * Appends the message to state immediately before making the API request.
   * If the insert fails, it gracefully rolls back state and restores draft input.
   */
  const sendReply = async () => {
    if (!replyText.trim() || !selectedTicket) return;

    const originalText = replyText;
    const tempId = `temp-${Date.now()}`;
    const newReplyOptimistic = {
      id: tempId,
      ticket_id: selectedTicket.id,
      sender_type: "admin",
      sender_name: "Super Admin",
      message: originalText.trim(),
      created_at: new Date().toISOString(),
      isOptimistic: true, // Used to render in lighter style during transit
    };

    // Optimistically update replies state and clear text area immediately
    setReplies((prev) => [...prev, newReplyOptimistic]);
    setReplyText("");
    setIsSendingReply(true);

    try {
      const { data, error } = await supabase
        .from("support_ticket_replies")
        .insert([{
          ticket_id: selectedTicket.id,
          sender_type: "admin",
          sender_name: "Super Admin",
          message: originalText.trim(),
        }])
        .select();

      if (error) throw error;

      // Update state with verified database record (giving it the permanent UUID)
      if (data && data.length > 0) {
        setReplies((prev) =>
          prev.map((r) => (r.id === tempId ? data[0] : r))
        );
      } else {
        setReplies((prev) =>
          prev.map((r) => (r.id === tempId ? { ...newReplyOptimistic, isOptimistic: false } : r))
        );
      }

      toast.success("تم إرسال الرد بنجاح.");

      // Auto transition state to "In Progress" if it is currently "Open"
      if (statusValue === "Open") {
        await handleStatusChange("In Progress");
      }
    } catch (err) {
      console.error(err);
      toast.error("فشل في إرسال الرد: " + err.message);

      // Rollback: Remove the optimistic reply and restore draft input
      setReplies((prev) => prev.filter((r) => r.id !== tempId));
      setReplyText(originalText);
    } finally {
      setIsSendingReply(false);
    }
  };

  useEffect(() => {
    if (!serverMode) return;
    onQueryChange({
      search,
      status: statusFilter,
      priority: priorityFilter,
      page,
      pageSize,
    });
  }, [onQueryChange, page, pageSize, priorityFilter, search, serverMode, statusFilter]);

  const filtered = serverMode
    ? tickets
    : tickets.filter((t) => {
      const q = search.toLowerCase();
      const companyName = t.companies?.name || "";
      const matchSearch = t.subject.toLowerCase().includes(q) || companyName.toLowerCase().includes(q) || t.id.toString().toLowerCase().includes(q);
      const matchStatus = statusFilter === "All" || t.status === statusFilter;
      const matchPriority = priorityFilter === "All" || t.priority === priorityFilter;
      return matchSearch && matchStatus && matchPriority;
    });

  const effectiveTotal = serverMode ? (totalCount ?? tickets.length) : filtered.length;
  const totalPages = Math.max(1, Math.ceil(effectiveTotal / pageSize));
  const paged = serverMode ? tickets : filtered.slice((page - 1) * pageSize, page * pageSize);
  const pageWindow = 5;
  const startPage = Math.max(1, Math.min(page - 2, totalPages - pageWindow + 1));
  const endPage = Math.min(totalPages, startPage + pageWindow - 1);
  const pageNumbers = Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i);

  const ticketStats = stats || {
    total: tickets.length,
    open: tickets.filter((t) => t.status === "Open").length,
    inProgress: tickets.filter((t) => t.status === "In Progress").length,
    critical: tickets.filter((t) => t.priority === "Critical").length,
  };

  return (
    <div className="space-y-5" style={{ textAlign: "right", direction: "rtl" }}>
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "إجمالي التذاكر", value: ticketStats.total, color: "text-slate-700", bg: "bg-slate-50", border: "border-slate-200" },
          { label: "مفتوحة", value: ticketStats.open, color: "text-blue-700", bg: "bg-blue-50", border: "border-blue-200" },
          { label: "قيد المتابعة", value: ticketStats.inProgress, color: "text-orange-700", bg: "bg-orange-50", border: "border-orange-200" },
          { label: "حرجة للغاية", value: ticketStats.critical, color: "text-red-700", bg: "bg-red-50", border: "border-red-200" },
        ].map((s) => (
          <div key={s.label} className={`${s.bg} border ${s.border} rounded-xl p-4`}>
            <div className={s.color} style={{ fontWeight: 800, fontSize: "1.8rem" }}>{loading ? "—" : s.value}</div>
            <div className="text-gray-500" style={{ fontSize: "0.78rem", fontWeight: 600 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex flex-wrap items-center gap-3">
          <h2 className="text-gray-900" style={{ fontWeight: 700, fontSize: "1rem" }}>تذاكر دعم العملاء</h2>
          <div className="flex-1" />
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="البحث عن تذكرة..."
              className="pr-8 pl-3 py-2 rounded-xl border border-gray-200 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all w-44"
              style={{ direction: "rtl" }}
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 rounded-xl border border-gray-200 text-sm outline-none bg-white text-gray-600"
            style={{ fontWeight: 500 }}
          >
            {["All", "Open", "In Progress", "Resolved", "Closed"].map((s) => (
              <option key={s} value={s}>{s === "All" ? "كل الحالات" : s}</option>
            ))}
          </select>
          <select
            value={priorityFilter}
            onChange={(e) => { setPriorityFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 rounded-xl border border-gray-200 text-sm outline-none bg-white text-gray-600"
            style={{ fontWeight: 500 }}
          >
            {["All", "Low", "Medium", "High", "Critical"].map((p) => (
              <option key={p} value={p}>{p === "All" ? "كل الأولويات" : p}</option>
            ))}
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50/80 border-b border-gray-100">
                {["رقم التذكرة", "العميل / الشركة", "الموضوع", "الأولوية", "الحالة", "المسؤول", "التاريخ"].map((h) => (
                  <th key={h} className="px-5 py-3.5 text-right" style={{ fontWeight: 600, fontSize: "0.75rem", color: "#64748b" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading && (
                <tr>
                  <td colSpan={7} className="px-6 py-10">
                    <div className="space-y-3">
                      {[0, 1, 2].map((idx) => (
                        <div key={idx} className="h-10 bg-gray-100 rounded-lg animate-pulse" />
                      ))}
                    </div>
                  </td>
                </tr>
              )}
              {!loading && paged.map((t, idx) => {
                const companyName = t.companies?.name || "Unknown";
                const initials = companyName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
                return (
                  <motion.tr
                    key={t.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: idx * 0.05 }}
                    className="hover:bg-blue-50/20 transition-colors cursor-pointer"
                    onClick={() => {
                      setSelectedTicket(t);
                      setStatusValue(t.status || "Open");
                      setPriorityValue(t.priority || "Medium");
                      setAssigneeInput(t.assignee || "");
                      fetchReplies(t.id, false);
                    }}
                  >
                    <td className="px-5 py-4">
                      <span className="text-blue-600 hover:underline" style={{ fontWeight: 700, fontSize: "0.82rem" }}>#{t.id.toString().slice(0, 8)}</span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-slate-500 flex items-center justify-center flex-shrink-0">
                          <span className="text-white" style={{ fontWeight: 700, fontSize: "0.6rem" }}>{initials}</span>
                        </div>
                        <span className="text-gray-700" style={{ fontSize: "0.825rem", fontWeight: 500 }}>{companyName}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 max-w-xs">
                      <span className="text-gray-800 truncate block" style={{ fontSize: "0.85rem", fontWeight: 500 }}>{t.subject}</span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`text-xs px-2.5 py-1 rounded-full ${priorityStyle[t.priority] || priorityStyle.Medium}`} style={{ fontWeight: 700 }}>
                        {t.priority}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`text-xs px-2.5 py-1 rounded-full ${statusStyle[t.status] || statusStyle.Open}`} style={{ fontWeight: 700 }}>
                        {t.status}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-gray-500" style={{ fontSize: "0.8rem" }}>{t.assignee || "غير معين"}</span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-gray-400" style={{ fontSize: "0.8rem" }}>{t.created_at ? new Date(t.created_at).toLocaleDateString() : ""}</span>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
          {!loading && paged.length === 0 && (
            <div className="p-12 text-center text-gray-400">لا توجد تذاكر دعم تطابق معايير التصفية.</div>
          )}
        </div>

        {/* Pagination */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
          <span className="text-gray-400" style={{ fontSize: "0.8rem" }}>
            عرض {effectiveTotal === 0 ? 0 : Math.min((page - 1) * pageSize + 1, effectiveTotal)}–{Math.min(page * pageSize, effectiveTotal)} من {effectiveTotal} تذاكر
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronDown className="w-4 h-4" style={{ transform: "rotate(90deg)" }} />
            </button>
            {pageNumbers.map((p) => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={`w-8 h-8 rounded-lg border text-sm transition-colors ${p === page ? "bg-blue-600 border-blue-600 text-white" : "border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}
                style={{ fontWeight: 600 }}
              >
                {p}
              </button>
            ))}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronDown className="w-4 h-4" style={{ transform: "rotate(-90deg)" }} />
            </button>
          </div>
        </div>
      </div>

      {/* Support Chat Sliding Drawer */}
      <AnimatePresence>
        {selectedTicket && (
          <div className="fixed inset-0 z-50 flex justify-end" style={{ direction: "rtl" }}>
            {/* Backdrop overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setSelectedTicket(null); setReplies([]); }}
              className="absolute inset-0 bg-black/40 backdrop-blur-xs"
            />
            {/* Slide drawer container */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 32, stiffness: 320 }}
              className="relative w-full max-w-lg bg-white h-screen shadow-2xl flex flex-col z-10 overflow-hidden border-r border-gray-100"
            >
              {/* Header */}
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-l from-slate-50 to-white">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shadow-sm">
                    <MessageSquare className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-gray-900 font-bold text-[0.95rem] leading-tight">#{selectedTicket.id.toString().slice(0, 8)}</h3>
                    <p className="text-gray-400 text-xs mt-0.5">{selectedTicket.companies?.name || "شركة غير معروفة"}</p>
                  </div>
                </div>
                <button
                  onClick={() => { setSelectedTicket(null); setReplies([]); }}
                  className="w-8 h-8 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-all"
                >
                  <X className="w-4.5 h-4.5" />
                </button>
              </div>

              {/* Drawer Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Meta details & status controls */}
                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4.5 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[0.7rem] font-bold text-gray-400 uppercase tracking-wider mb-1">الحالة</label>
                      <select
                        value={statusValue}
                        onChange={(e) => handleStatusChange(e.target.value)}
                        className={`w-full text-xs px-2.5 py-1.5 rounded-xl border border-gray-200 font-bold bg-white text-gray-700 transition-all`}
                      >
                        {["Open", "In Progress", "Resolved", "Closed"].map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[0.7rem] font-bold text-gray-400 uppercase tracking-wider mb-1">الأولوية</label>
                      <select
                        value={priorityValue}
                        onChange={(e) => handlePriorityChange(e.target.value)}
                        className="w-full text-xs px-2.5 py-1.5 rounded-xl border border-gray-200 font-bold bg-white text-gray-700 transition-all"
                      >
                        {["Low", "Medium", "High", "Critical"].map((p) => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[0.7rem] font-bold text-gray-400 uppercase tracking-wider mb-1">المسؤول عن التذكرة</label>
                    <div className="flex gap-2">
                      <input
                        value={assigneeInput}
                        onChange={(e) => setAssigneeInput(e.target.value)}
                        placeholder="اسم الأدمن المسؤول..."
                        className="flex-1 text-xs px-3 py-1.5 rounded-xl border border-gray-200 bg-white text-gray-700 outline-none"
                      />
                      <button
                        onClick={handleAssigneeChange}
                        className="text-xs px-3.5 py-1.5 rounded-xl bg-slate-800 text-white font-bold hover:bg-slate-700 transition-colors shadow-sm"
                      >
                        حفظ
                      </button>
                    </div>
                  </div>
                </div>

                {/* Ticket Details Description */}
                <div>
                  <h4 className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-2">موضوع وتفاصيل التذكرة</h4>
                  <div className="bg-blue-50/20 border border-blue-50 rounded-2xl p-4">
                    <h5 className="text-gray-900 font-bold text-sm mb-2">{selectedTicket.subject}</h5>
                    <p className="text-gray-700 text-xs leading-relaxed whitespace-pre-wrap">
                      {selectedTicket.description || "لا يوجد وصف إضافي مرفق بالتذكرة."}
                    </p>
                  </div>
                </div>

                {/* Live replies chat history */}
                <div>
                  <h4 className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-3">تحديثات وسجل الردود الحية</h4>

                  {loadingReplies && (
                    <div className="py-12 flex flex-col items-center justify-center gap-3">
                      <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
                      <span className="text-xs text-gray-400 font-semibold">جاري تحميل سجل المحادثة...</span>
                    </div>
                  )}

                  {!loadingReplies && replies.length === 0 && (
                    <div className="text-center py-10 bg-gray-50 border border-dashed border-gray-200 rounded-2xl p-4">
                      <MessageSquare className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                      <p className="text-xs text-gray-500 font-bold">لا توجد ردود بعد على هذه التذكرة.</p>
                      <p className="text-[0.68rem] text-gray-400 mt-1">اكتب رداً في الصندوق أدناه لمساعدة العميل فوراً.</p>
                    </div>
                  )}

                  {!loadingReplies && replies.length > 0 && (
                    <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1">
                      {/* Supabase Pagination Optimization: Load Older Button */}
                      {hasMoreReplies && (
                        <div className="flex justify-center mb-4">
                          <button
                            onClick={() => fetchReplies(selectedTicket.id, true)}
                            disabled={loadingOlder}
                            className="text-xs px-3 py-1.5 bg-blue-50 border border-blue-100 hover:bg-blue-100/80 text-blue-600 font-bold rounded-xl transition-all disabled:opacity-50 flex items-center gap-1.5 shadow-sm font-semibold"
                          >
                            {loadingOlder ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : null}
                            تحميل الرسائل السابقة
                          </button>
                        </div>
                      )}

                      {replies.map((r) => {
                        const isAdmin = r.sender_type === "admin";
                        return (
                          <div
                            key={r.id}
                            className={`flex ${isAdmin ? "justify-start" : "justify-end"}`}
                          >
                            <div
                              className={`max-w-[85%] rounded-2xl px-4 py-2.5 shadow-xs text-xs leading-relaxed transition-opacity duration-200 ${isAdmin
                                ? "bg-slate-800 text-white rounded-tr-none"
                                : "bg-blue-600 text-white rounded-tl-none"
                                }`}
                              style={{ opacity: r.isOptimistic ? 0.7 : 1 }}
                            >
                              <div className="flex items-center gap-2 mb-1.5 opacity-80" style={{ fontSize: "0.65rem" }}>
                                <span className="font-bold">{isAdmin ? "الدعم الفني" : r.sender_name}</span>
                                <span>•</span>
                                {r.isOptimistic ? (
                                  <span>جاري الإرسال...</span>
                                ) : (
                                  <span>{r.created_at ? new Date(r.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ""}</span>
                                )}
                              </div>
                              <p className="font-medium whitespace-pre-wrap">{r.message}</p>
                            </div>
                          </div>
                        );
                      })}
                      <div ref={chatEndRef} />
                    </div>
                  )}

                  {/* Typing Indicator Bar */}
                  {typingUsers.length > 0 && (
                    <div className="mt-4 px-4 py-1.5 text-xs text-gray-400 font-semibold bg-slate-50 border border-slate-100 rounded-xl flex items-center gap-1.5 italic animate-pulse">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500" />
                      {typingUsers.join(", ")} يكتب الآن...
                    </div>
                  )}
                </div>
              </div>

              {/* Footer Reply Form */}
              <div className="p-4 border-t border-gray-100 bg-white">
                <div className="flex items-center gap-2">
                  <textarea
                    value={replyText}
                    onChange={handleTextareaChange}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        sendReply();
                      }
                    }}
                    placeholder="اكتب ردك هنا لمساعدة العميل..."
                    rows={2}
                    className="flex-1 text-xs px-3.5 py-2.5 rounded-xl border border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all outline-none resize-none bg-slate-50/50"
                  />
                  <button
                    onClick={sendReply}
                    disabled={isSendingReply || !replyText.trim()}
                    className="w-10 h-10 rounded-xl bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center transition-all shadow-md shadow-blue-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                  >
                    {isSendingReply ? (
                      <Loader2 className="w-4.5 h-4.5 animate-spin" />
                    ) : (
                      <Send className="w-4.5 h-4.5 transform rotate-180" />
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// -------------------------------------------------------------------------
// SYSTEM SETTINGS VIEW
// -------------------------------------------------------------------------
const settingSections = [
  {
    icon: Globe, label: "General", color: "text-blue-600", bg: "bg-blue-50",
    items: [
      { label: "Platform Name", type: "text", value: "Kwader", desc: "Displayed across all user interfaces" },
      { label: "Support Email", type: "email", value: "support@kwader.io", desc: "Used for system notifications" },
      { label: "Default Timezone", type: "select", value: "UTC", desc: "Server-side timezone for jobs & logs" },
    ],
  },
  {
    icon: Bell, label: "Subscription Alerts", color: "text-amber-600", bg: "bg-amber-50",
    items: [
      { label: "Internal Alerts", type: "toggle", value: true, desc: "Show alerts in client dashboard (7, 3, 1 days)" },
      { label: "External Alerts (TG/WA)", type: "toggle", value: true, desc: "Send automated messages to company owners" },
      { label: "Admin Digest", type: "toggle", value: true, desc: "Send daily summary of expiring accounts to Super Admin" },
    ],
  },
  {
    icon: Lock, label: "Security", color: "text-red-600", bg: "bg-red-50",
    items: [
      { label: "2FA Enforcement", type: "toggle", value: true, desc: "Require 2FA for all admin accounts" },
      { label: "Session Timeout", type: "select", value: "30 min", desc: "Auto-logout idle sessions" },
      { label: "IP Whitelist", type: "toggle", value: false, desc: "Restrict access to specific IPs" },
    ],
  },
  {
    icon: Database, label: "Maintenance", color: "text-violet-600", bg: "bg-violet-50",
    items: [
      { label: "Auto Backups", type: "toggle", value: true, desc: "Daily automated database backups" },
      { label: "Backup Retention", type: "select", value: "30 days", desc: "How long to retain backup files" },
      { label: "Maintenance Mode", type: "toggle", value: false, desc: "Puts platform into read-only mode" },
    ],
  },
];

const DEFAULT_OFFICES = [
  { cityAr: 'القاهرة', cityEn: 'Cairo', flag: '🇪🇬', addressAr: 'القرية الذكية، الجيزة، مصر', addressEn: 'Smart Village, Giza, Egypt' },
  { cityAr: 'الرياض', cityEn: 'Riyadh', flag: '🇸🇦', addressAr: 'طريق الملك فهد، حي العليا، الرياض', addressEn: 'King Fahd Road, Al Olaya District, Riyadh' },
  { cityAr: 'دبي', cityEn: 'Dubai', flag: '🇦🇪', addressAr: 'مركز دبي المالي العالمي، دبي', addressEn: 'Dubai International Financial Centre, Dubai' },
];

export function SystemSettingsView() {
  const [loading, setLoading] = useState(true);
  const [platformName, setPlatformName] = useState("Kwader");
  const [supportEmail, setSupportEmail] = useState("support@kwader.io");
  const [trialDays, setTrialDays] = useState(35);

  // Sync Agent dynamic settings
  const [syncAgentVersion, setSyncAgentVersion] = useState("v1.3.2");
  const [syncAgentDownloadUrl, setSyncAgentDownloadUrl] = useState("https://github.com/eng-mazen-hashem/kwader-sync-app/releases/download/v1.3.2/KWADER_Sync_Setup_v1.3.2.exe");
  const [selectedAgentFile, setSelectedAgentFile] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  // WhatsApp settings
  const [whatsappNotificationsEnabled, setWhatsappNotificationsEnabled] = useState(false);
  const [whatsappRecipientPhone, setWhatsappRecipientPhone] = useState("");

  // Contact settings
  const [contactPhone, setContactPhone] = useState("+201098869806");
  const [contactWhatsapp, setContactWhatsapp] = useState("201098869806");
  const [contactOffices, setContactOffices] = useState(DEFAULT_OFFICES);

  // Desktop Ads settings
  const [desktopAds, setDesktopAds] = useState([]);
  const [editingAd, setEditingAd] = useState(null);
  const [isAdModalOpen, setIsAdModalOpen] = useState(false);

  // Platform WhatsApp Status (Leader node QR scanner)
  const [waStatus, setWaStatus] = useState("checking"); // checking, disconnected, qr_pending, connected
  const [waQr, setWaQr] = useState(null);
  const [activeNode, setActiveNode] = useState(null);
  const [lastBeat, setLastBeat] = useState(null);
  const [waQueueStats, setWaQueueStats] = useState({ pending: 0, sent: 0 });
  const [clusterNodeCount, setClusterNodeCount] = useState(1);
  const [centralChannelPhone, setCentralChannelPhone] = useState(null);
  // Realtime-driven WA status — zero polling egress
  // waStatusDataRef holds latest fetched snapshot for derive logic
  const waStatusDataRef = useRef({ defaultCh: null, lockData: null, qrData: null });

  // ─── One-time initial fetch (replaces the old 7-request polling cycle) ───
  const fetchWaStatusSnapshot = async () => {
    try {
      const [{ data: defaultCh }, { data: lockData }, { data: qrData }] = await Promise.all([
        supabase.from('whatsapp_channels').select('id,status,phone_number,qr_code,last_heartbeat,active_node_id,is_default').eq('is_default', true).maybeSingle(),
        supabase.from('system_settings').select('value').eq('key', 'whatsapp_lock').maybeSingle(),
        supabase.from('system_settings').select('value,updated_at').eq('key', 'whatsapp_qr_pending').maybeSingle(),
      ]);
      waStatusDataRef.current = { defaultCh, lockData, qrData };
      _deriveWaStatus({ defaultCh, lockData, qrData });

      // Lightweight count-only queries (no row data)
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const [{ count: pendingCount }, { count: sentCount }, { count: nodesCount }] = await Promise.all([
        supabase.from('whatsapp_queue').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('whatsapp_queue').select('id', { count: 'exact', head: true }).eq('status', 'sent'),
        supabase.from('whatsapp_nodes').select('id', { count: 'exact', head: true }).gte('last_seen', fiveMinAgo),
      ]);
      setWaQueueStats({ pending: pendingCount || 0, sent: sentCount || 0 });
      if (nodesCount && nodesCount > 0) setClusterNodeCount(nodesCount);
    } catch (e) {
      console.error('Error fetching WA status snapshot:', e);
    }
  };

  // ─── Pure derive function — no network calls ───
  const _deriveWaStatus = ({ defaultCh, lockData, qrData }) => {
    if (defaultCh?.phone_number) setCentralChannelPhone(defaultCh.phone_number);
    const now = Date.now();
    let isAlive = false;
    let activeNodeName = null;
    let heartbeatTime = null;

    if (lockData?.value?.node_id && lockData.value.last_heartbeat) {
      const beatMs = new Date(lockData.value.last_heartbeat).getTime();
      const ageMs = now - beatMs;
      if (!isNaN(beatMs) && ageMs >= -5000 && ageMs < 120000) {
        isAlive = true;
        activeNodeName = lockData.value.node_id;
        heartbeatTime = lockData.value.last_heartbeat;
      }
    }
    if (!isAlive && defaultCh?.last_heartbeat) {
      const beatMs = new Date(defaultCh.last_heartbeat).getTime();
      const ageMs = now - beatMs;
      if (!isNaN(beatMs) && ageMs >= -5000 && ageMs < 120000) {
        isAlive = true;
        activeNodeName = defaultCh.active_node_id || 'سيرفر ويندوز';
        heartbeatTime = defaultCh.last_heartbeat;
      }
    }

    const qrTimestamp = qrData?.value?.timestamp || qrData?.updated_at;
    const qrAgeMs = qrTimestamp ? now - new Date(qrTimestamp).getTime() : Infinity;
    const isQrFresh = Boolean(qrData?.value?.qr && qrAgeMs < 90000);
    const activeChannelQr = defaultCh?.qr_code;
    const isChannelConnected = Boolean(isAlive && defaultCh?.status === 'connected' && defaultCh?.phone_number);

    if (isChannelConnected) {
      setWaStatus('connected');
      setActiveNode(activeNodeName || defaultCh?.active_node_id || 'سيرفر ويندوز');
      setLastBeat(heartbeatTime || defaultCh?.last_heartbeat);
      setWaQr(null);
    } else if (isAlive && (isQrFresh || activeChannelQr || defaultCh?.status === 'qr_pending')) {
      setWaStatus('qr_pending');
      setWaQr(activeChannelQr || (isQrFresh ? qrData?.value?.qr : null));
    } else {
      setWaStatus('disconnected');
      setWaQr(null);
    }
  };

  // ─── Realtime subscription — fires only on actual DB changes (zero polling) ───
  useEffect(() => {
    fetchWaStatusSnapshot();

    const rtChannel = supabase
      .channel('wa-status-realtime-v2')
      // whatsapp_channels changes → re-derive immediately
      .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_channels', filter: 'is_default=eq.true' }, (payload) => {
        const updated = { ...waStatusDataRef.current, defaultCh: payload.new || waStatusDataRef.current.defaultCh };
        waStatusDataRef.current = updated;
        _deriveWaStatus(updated);
        if (payload.new?.phone_number) setCentralChannelPhone(payload.new.phone_number);
      })
      // whatsapp_lock changes → re-derive
      .on('postgres_changes', { event: '*', schema: 'public', table: 'system_settings', filter: 'key=eq.whatsapp_lock' }, (payload) => {
        const updated = { ...waStatusDataRef.current, lockData: payload.new };
        waStatusDataRef.current = updated;
        _deriveWaStatus(updated);
      })
      // QR pending changes → re-derive
      .on('postgres_changes', { event: '*', schema: 'public', table: 'system_settings', filter: 'key=eq.whatsapp_qr_pending' }, (payload) => {
        const updated = { ...waStatusDataRef.current, qrData: payload.new };
        waStatusDataRef.current = updated;
        _deriveWaStatus(updated);
      })
      // Queue count changes → lightweight count only
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'whatsapp_queue' }, (payload) => {
        if (payload.new?.status === 'pending') {
          setWaQueueStats(prev => ({ ...prev, pending: prev.pending + 1 }));
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'whatsapp_queue' }, (payload) => {
        if (payload.old?.status === 'pending' && payload.new?.status === 'sent') {
          setWaQueueStats(prev => ({ pending: Math.max(0, prev.pending - 1), sent: prev.sent + 1 }));
        }
      })
      // Nodes count changes
      .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_nodes' }, () => {
        const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
        supabase.from('whatsapp_nodes').select('id', { count: 'exact', head: true }).gte('last_seen', fiveMinAgo)
          .then(({ count }) => { if (count && count > 0) setClusterNodeCount(count); });
      })
      .subscribe();

    return () => { supabase.removeChannel(rtChannel); };
  }, []);

  const handleWaDisconnect = async () => {
    if (!window.confirm("هل أنت متأكد من تسجيل الخروج وفصل حساب الواتساب الخاص بالمنصة؟")) return;
    try {
      // 1. إرسال أمر فوري عبر Realtime للعقدة النشطة لمسح الجلسة
      await supabase.from('system_settings').upsert({
        key: 'whatsapp_control_master',
        value: { action: 'force_disconnect', requested_at: new Date().toISOString(), requested_by: 'admin' },
        updated_at: new Date().toISOString()
      }, { onConflict: 'key' });

      // 2. تحديث القناة الافتراضية
      await supabase.from('whatsapp_channels').update({
        status: 'qr_pending',
        phone_number: null,
        qr_code: null,
        updated_at: new Date().toISOString()
      }).eq('is_default', true);

      await supabase.from('system_settings').delete().eq('key', 'whatsapp_session_zip');
      await supabase.from('system_settings').delete().eq('key', 'whatsapp_qr_pending');

      toast.success("تم إرسال أمر فصل الواتساب بنجاح. جاري طلب رمز QR جديد...");
      setWaStatus("qr_pending");
      setWaQr(null);
      fetchWaStatusSnapshot(); // Realtime will auto-update from here
    } catch (e) {
      toast.error("فشل في قطع الاتصال: " + e.message);
    }
  };

  const [toggles, setToggles] = useState({
    "Internal Alerts": true, "External Alerts (TG/WA)": true, "Admin Digest": true,
    "2FA Enforcement": true, "IP Whitelist": false, "Auto Backups": true, "Maintenance Mode": false,
  });

  const loadSettings = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('key, value');
      if (!error && data) {
        data.forEach(item => {
          if (item.key === 'platform_name') setPlatformName(item.value);
          if (item.key === 'support_email') setSupportEmail(item.value);
          if (item.key === 'trial_days') setTrialDays(item.value);
          if (item.key === 'sync_agent_version') setSyncAgentVersion(item.value);
          if (item.key === 'sync_agent_download_url') setSyncAgentDownloadUrl(item.value);
          if (item.key === 'whatsapp_notifications_enabled') setWhatsappNotificationsEnabled(item.value);
          if (item.key === 'whatsapp_recipient_phone') setWhatsappRecipientPhone(item.value || "");
          if (item.key === 'contact_phone') setContactPhone(item.value || "");
          if (item.key === 'contact_whatsapp') setContactWhatsapp(item.value || "");
          if (item.key === 'contact_offices') {
            if (Array.isArray(item.value) && item.value.length > 0) {
              setContactOffices(item.value);
            } else {
              setContactOffices(DEFAULT_OFFICES);
            }
          }
          if (item.key === 'desktop_ads') {
            setDesktopAds(Array.isArray(item.value) ? item.value : []);
          }
        });
      }
    } catch (err) {
      console.error("Failed to load settings:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      let finalDownloadUrl = syncAgentDownloadUrl;

      if (selectedAgentFile) {
        const fileExt = selectedAgentFile.name.split('.').pop();
        const sanitizedVersion = syncAgentVersion.trim().replace(/[^a-zA-Z0-9_.-]/g, "_");
        const fileName = `KWADER.Sync.Setup_${sanitizedVersion || 'latest'}.${fileExt}`;
        const filePath = `agent/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('downloads')
          .upload(filePath, selectedAgentFile, { cacheControl: '3600', upsert: true });

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage
          .from('downloads')
          .getPublicUrl(filePath);

        if (publicUrlData?.publicUrl) {
          finalDownloadUrl = publicUrlData.publicUrl;
          setSyncAgentDownloadUrl(finalDownloadUrl);
        }
      }

      const nowIso = new Date().toISOString();
      const { error } = await supabase
        .from('system_settings')
        .upsert([
          { key: 'platform_name', value: platformName, updated_at: nowIso },
          { key: 'support_email', value: supportEmail, updated_at: nowIso },
          { key: 'trial_days', value: parseInt(trialDays) || 35, updated_at: nowIso },
          { key: 'sync_agent_version', value: syncAgentVersion, updated_at: nowIso },
          { key: 'sync_agent_download_url', value: finalDownloadUrl, updated_at: nowIso },
          { key: 'whatsapp_notifications_enabled', value: whatsappNotificationsEnabled, updated_at: nowIso },
          { key: 'whatsapp_recipient_phone', value: whatsappRecipientPhone, updated_at: nowIso },
          { key: 'contact_phone', value: contactPhone, updated_at: nowIso },
          { key: 'contact_whatsapp', value: contactWhatsapp, updated_at: nowIso },
          { key: 'contact_offices', value: contactOffices, updated_at: nowIso },
          { key: 'desktop_ads', value: desktopAds, updated_at: nowIso }
        ], { onConflict: 'key' });

      if (error) throw error;
      setSelectedAgentFile(null);
      toast.success("تم حفظ إعدادات النظام وتحديث برنامج المزامنة بنجاح! ✅");
    } catch (err) {
      console.error("Save error:", err);
      toast.error("فشل في حفظ إعدادات النظام: " + (err.message || "حدث خطأ غير متوقع"));
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="py-12 flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        <span className="text-sm text-gray-500 font-semibold">جاري تحميل إعدادات النظام...</span>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-4xl" style={{ textAlign: "right", direction: "rtl" }}>
      {/* 1. General Info & Trial Days */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
      >
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100">
          <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
            <Globe className="w-4.5 h-4.5 text-blue-600" />
          </div>
          <h3 className="text-gray-900" style={{ fontWeight: 700, fontSize: "0.95rem" }}>إعدادات المنصة العامة وفترة التجربة</h3>
        </div>
        <div className="px-6 py-4 space-y-4">
          <div className="flex items-center justify-between gap-6">
            <div className="flex-1 min-w-0">
              <div className="text-gray-800" style={{ fontWeight: 600, fontSize: "0.875rem" }}>اسم المنصة الأساسي</div>
              <div className="text-gray-400" style={{ fontSize: "0.75rem" }}>يظهر في الترويسة وعناوين جميع الصفحات البرمجية والبريد</div>
            </div>
            <input
              type="text"
              value={platformName}
              onChange={(e) => setPlatformName(e.target.value)}
              className="px-3 py-2 rounded-xl border border-gray-200 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all w-52"
              style={{ direction: "ltr" }}
            />
          </div>

          <div className="flex items-center justify-between gap-6">
            <div className="flex-1 min-w-0">
              <div className="text-gray-800" style={{ fontWeight: 600, fontSize: "0.875rem" }}>البريد الإلكتروني للدعم الفني</div>
              <div className="text-gray-400" style={{ fontSize: "0.75rem" }}>تُرسل من خلاله إشعارات النظام وتنبيهات الأجهزة والاشتراكات للعملاء</div>
            </div>
            <input
              type="email"
              value={supportEmail}
              onChange={(e) => setSupportEmail(e.target.value)}
              className="px-3 py-2 rounded-xl border border-gray-200 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all w-52"
              style={{ direction: "ltr" }}
            />
          </div>

          <div className="flex items-center justify-between gap-6">
            <div className="flex-1 min-w-0">
              <div className="text-gray-800" style={{ fontWeight: 600, fontSize: "0.875rem" }}>فترة التجربة الافتراضية للشركات الجديدة (أيام)</div>
              <div className="text-gray-400" style={{ fontSize: "0.75rem" }}>عدد الأيام التجريبية الممنوحة للشركة تلقائياً عند التسجيل لأول مرة</div>
            </div>
            <input
              type="number"
              value={trialDays}
              onChange={(e) => setTrialDays(e.target.value)}
              className="px-3 py-2 rounded-xl border border-gray-200 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all w-52"
              style={{ direction: "ltr" }}
            />
          </div>
        </div>
      </motion.div>

      {/* 3. Sync Agent Version & Download Update */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
      >
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100">
          <div className="w-9 h-9 rounded-xl bg-purple-50 flex items-center justify-center">
            <UploadCloud className="w-4.5 h-4.5 text-purple-600" />
          </div>
          <h3 className="text-gray-900" style={{ fontWeight: 700, fontSize: "0.95rem" }}>إدارة وتحديث برنامج المزامنة (Sync Agent)</h3>
        </div>
        <div className="px-6 py-4 space-y-4">

          <div className="flex items-center justify-between gap-6">
            <div className="flex-1 min-w-0">
              <div className="text-gray-800" style={{ fontWeight: 600, fontSize: "0.875rem" }}>رقم إصدار البرنامج النشط</div>
              <div className="text-gray-400" style={{ fontSize: "0.75rem" }}>يظهر للعملاء في لوحة التحكم عند تنزيل برنامج المزامنة (مثل: v1.1.0)</div>
            </div>
            <input
              type="text"
              value={syncAgentVersion}
              onChange={(e) => setSyncAgentVersion(e.target.value)}
              className="px-3 py-2 rounded-xl border border-gray-200 text-sm outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all w-52"
              style={{ direction: "ltr" }}
            />
          </div>

          <div className="flex items-center justify-between gap-6">
            <div className="flex-1 min-w-0">
              <div className="text-gray-800" style={{ fontWeight: 600, fontSize: "0.875rem" }}>رابط تنزيل البرنامج المباشر</div>
              <div className="text-gray-400" style={{ fontSize: "0.75rem" }}>الرابط الفعلي لتنزيل الملف. سيتم تحديثه تلقائياً عند رفع ملف أدناه، أو يمكن كتابة رابط خارجي مباشرة</div>
            </div>
            <input
              type="text"
              value={syncAgentDownloadUrl}
              onChange={(e) => setSyncAgentDownloadUrl(e.target.value)}
              className="px-3 py-2 rounded-xl border border-gray-200 text-sm outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all w-80 text-ellipsis"
              style={{ direction: "ltr" }}
            />
          </div>

          <div className="pt-2 border-t border-dashed border-gray-100 flex flex-col gap-2">
            <div className="text-gray-800" style={{ fontWeight: 600, fontSize: "0.875rem" }}>رفع ملف برنامج المزامنة الجديد (.exe / .zip)</div>
            <div className="text-gray-400" style={{ fontSize: "0.75rem" }}>سيتم رفع الملف مباشرة إلى خوادم تخزين المنصة (Supabase Storage) وربط رابط التحميل به عند الحفظ</div>

            <div className="mt-2 flex items-center gap-4">
              <label className="px-4 py-2 rounded-xl border border-purple-200 text-purple-600 hover:bg-purple-50 transition-colors text-xs font-semibold cursor-pointer flex items-center gap-2">
                <UploadCloud className="w-4 h-4" />
                <span>اختر الملف...</span>
                <input
                  type="file"
                  accept=".exe,.zip,.rar"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setSelectedAgentFile(file);
                    }
                  }}
                  className="hidden"
                />
              </label>

              {selectedAgentFile && (
                <div className="flex items-center gap-2 bg-purple-50 px-3 py-1.5 rounded-xl border border-purple-100">
                  <span className="text-xs text-purple-700 font-semibold max-w-xs truncate">{selectedAgentFile.name}</span>
                  <span className="text-[10px] text-purple-400">({(selectedAgentFile.size / 1024 / 1024).toFixed(2)} MB)</span>
                  <button
                    type="button"
                    onClick={() => setSelectedAgentFile(null)}
                    className="text-purple-600 hover:text-red-500 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>

        </div>
      </motion.div>

      {/* 4. Automated Alerts & Digests */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
      >
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100">
          <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center">
            <Bell className="w-4.5 h-4.5 text-amber-600" />
          </div>
          <h3 className="text-gray-900" style={{ fontWeight: 700, fontSize: "0.95rem" }}>تنبيهات المزامنة والاشتراكات</h3>
        </div>
        <div className="px-6 py-4 space-y-4">
          {[
            { label: "Internal Alerts", desc: "تفعيل إشعارات وتنبيهات انتهاء الباقة التلقائية في لوحة العميل (7 و 3 و 1 يوم)" },
            { label: "External Alerts (TG/WA)", desc: "إرسال رسائل آلية فورية لمديري الشركات عن طريق تليغرام/واتساب عند انقطاع الأجهزة أو قرب انتهاء الدورة" },
            { label: "Admin Digest", desc: "إرسال ملخص إحصائي يومي لبريد السوبر أدمن عن الحسابات المنتهية والأجهزة النشطة" },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between gap-6">
              <div className="flex-1 min-w-0">
                <div className="text-gray-800" style={{ fontWeight: 600, fontSize: "0.875rem" }}>{item.label}</div>
                <div className="text-gray-400" style={{ fontSize: "0.75rem" }}>{item.desc}</div>
              </div>
              <button
                onClick={() => setToggles((t) => ({ ...t, [item.label]: !t[item.label] }))}
                className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${toggles[item.label] ? "bg-blue-600" : "bg-gray-200"
                  }`}
              >
                <div className={`absolute top-0.5 right-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${toggles[item.label] ? "translate-x-[-20px]" : "translate-x-0"
                  }`} />
              </button>
            </div>
          ))}
        </div>
      </motion.div>

      {/* 5. WhatsApp Notification Settings */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
      >
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center">
            <MessageSquare className="w-4.5 h-4.5 text-emerald-600" />
          </div>
          <h3 className="text-gray-900" style={{ fontWeight: 700, fontSize: "0.95rem" }}>إعدادات إشعارات الواتساب للطلبات</h3>
        </div>
        <div className="px-6 py-4 space-y-4">

          {/* Unified server info badge */}
          <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-100">
            <div className="mt-0.5 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5l2 2 4-4" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: "0.8rem", color: "#065f46" }}>خادم الواتساب اللامركزي (Kwader Sync)</div>
              <div style={{ fontSize: "0.72rem", color: "#047857", marginTop: 2 }}>
                الإشعارات تُرسل عبر تطبيق المزامنة اللامركزي. تأكد من تشغيل تطبيق Kwader Sync لضمان إرسال الإشعارات التلقائية للعملاء بدون الحاجة لمفاتيح API.
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-6">
            <div className="flex-1 min-w-0">
              <div className="text-gray-800" style={{ fontWeight: 600, fontSize: "0.875rem" }}>تفعيل تنبيهات واتساب لطلبات التجديد</div>
              <div className="text-gray-400" style={{ fontSize: "0.75rem" }}>إرسال رسالة فورية إلى رقم المستلم أدناه عند قيام العميل بالضغط على زر طلب التجديد</div>
            </div>
            <button
              onClick={() => setWhatsappNotificationsEnabled(v => !v)}
              className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${whatsappNotificationsEnabled ? "bg-emerald-600" : "bg-gray-200"
                }`}
            >
              <div className={`absolute top-0.5 right-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${whatsappNotificationsEnabled ? "translate-x-[-20px]" : "translate-x-0"
                }`} />
            </button>
          </div>

          {whatsappNotificationsEnabled && (
            <div className="space-y-4 pt-4 border-t border-dashed border-gray-100">
              <div className="flex items-center justify-between gap-6">
                <div className="flex-1 min-w-0">
                  <div className="text-gray-800" style={{ fontWeight: 600, fontSize: "0.875rem" }}>رقم واتساب المستلم (السوبر أدمن)</div>
                  <div className="text-gray-400" style={{ fontSize: "0.75rem" }}>الرقم الذي ستصل إليه إشعارات طلبات التجديد (بمفتاح الدولة بدون + أو أصفار، مثل: 201012345678)</div>
                </div>
                <input
                  type="text"
                  placeholder="201012345678"
                  value={whatsappRecipientPhone}
                  onChange={(e) => setWhatsappRecipientPhone(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-gray-200 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition-all w-64 text-left font-semibold"
                  style={{ direction: "ltr" }}
                />
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {/* 5.5 Platform Central WhatsApp Link (Super Admin) */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.38 }}
        className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
      >
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center">
            <span style={{ fontSize: '1.2rem' }}>📲</span>
          </div>
          <h3 className="text-gray-900" style={{ fontWeight: 700, fontSize: "0.95rem" }}>ربط وتفعيل واتساب المنصة المركزي</h3>
        </div>
        <div className="px-6 py-4 space-y-4">
          <p className="text-gray-400" style={{ fontSize: '0.75rem' }}>
            هذا هو الرقم الرسمي الذي يرسل رسائل الـ OTP والتقارير لجميع عملاء المنصة. يعمل النظام بالبنية اللامركزية التلقائية.
          </p>

          {waStatus === "checking" && (
            <div className="py-4 flex items-center justify-center gap-2 text-gray-500 text-xs">
              <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
              <span>جاري التحقق من حالة الاتصال بالواتساب...</span>
            </div>
          )}

          {waStatus === "connected" && (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-100 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-emerald-800" style={{ fontWeight: 700, fontSize: "0.85rem" }}>
                  <span>🟢 متصل بالكامل وشغال بنجاح</span>
                  {centralChannelPhone && (
                    <span className="font-mono text-xs bg-white text-emerald-900 px-2 py-0.5 rounded-lg border border-emerald-200 font-bold">
                      +{centralChannelPhone}
                    </span>
                  )}
                  <span className="bg-emerald-100 text-emerald-800 text-[10px] px-2 py-0.5 rounded-full font-bold">
                    نظام عنقودي لا مركزي (Cluster v2.0)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleWaDisconnect}
                  className="px-3 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold transition-all border border-red-100"
                >
                  تسجيل الخروج وقطع الربط
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-emerald-100/60 text-xs text-emerald-700">
                <div className="bg-white/80 p-2.5 rounded-xl border border-emerald-100 shadow-sm">
                  <div className="text-[10px] text-emerald-500 font-semibold">العقدة النشطة (Leader Node)</div>
                  <div className="font-mono text-[11px] font-bold truncate mt-0.5" title={activeNode}>{activeNode}</div>
                </div>
                <div className="bg-white/80 p-2.5 rounded-xl border border-emerald-100 shadow-sm">
                  <div className="text-[10px] text-emerald-500 font-semibold">طابور الرسائل الفوري</div>
                  <div className="font-bold text-[11px] mt-0.5 flex items-center gap-3">
                    <span className="text-emerald-700">✅ تم الإرسال: {waQueueStats.sent}</span>
                    <span className="text-amber-600">⏳ انتظار: {waQueueStats.pending}</span>
                  </div>
                </div>
                <div className="bg-white/80 p-2.5 rounded-xl border border-emerald-100 shadow-sm">
                  <div className="text-[10px] text-emerald-500 font-semibold">آخر نبضة حياة (Heartbeat)</div>
                  <div className="font-bold text-[11px] mt-0.5 text-emerald-700">
                    {lastBeat ? new Date(lastBeat).toLocaleTimeString('ar-SA') : 'الآن'}
                  </div>
                </div>
              </div>
            </div>
          )}

          {waStatus === "qr_pending" && (
            <div className="p-5 rounded-xl bg-amber-50 border border-amber-100 flex flex-col items-center gap-4">
              <div className="text-amber-800 text-center" style={{ fontWeight: 700, fontSize: "0.85rem" }}>
                ⚠️ السيرفر اللامركزي نشط ولكنه بانتظار مسح كود الـ QR!
              </div>
              <p className="text-xs text-amber-600 text-center max-w-sm">
                افتح الواتساب على هاتف المنصة الرئيسي ← الأجهزة المرتبطة ← ربط جهاز، وامسح الكود أدناه لتفعيل الخدمة للجميع.
              </p>
              <div className="bg-white p-3 rounded-xl border border-amber-200 shadow-sm">

                {waQr ? (
                  <QRCode value={waQr} size={192} style={{ height: "auto", maxWidth: "100%", width: "100%" }} />
                ) : (
                  <div className="flex flex-col items-center justify-center w-48 h-48 text-gray-400">
                    <Loader2 className="w-8 h-8 animate-spin mb-2" />
                    <span className="text-xs">جاري انتظار الـ QR...</span>
                  </div>
                )}

              </div>
              <span className="text-[10px] text-amber-500 animate-pulse font-semibold">🔄 يتحدث الكود تلقائياً عند التغيير...</span>
            </div>
          )}

          {waStatus === "disconnected" && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-100 space-y-2">
              <div className="flex items-center gap-2 text-rose-800" style={{ fontWeight: 700, fontSize: "0.85rem" }}>
                <span>🔴 غير متصل حالياً (برنامج KWADER Sync متوقف)</span>
              </div>
              <p className="text-xs text-rose-700">
                لا توجد أي عقدة نشطة ترسل نبضات حياة حالياً. يرجى تشغيل برنامج <strong>KWADER Sync</strong> على جهازك لبدء إرسال رسائل الواتساب والـ OTP فوراً.
              </p>
              {lastBeat && (
                <div className="text-[11px] text-rose-500 font-semibold">
                  آخر نبضة حياة مسجلة: {new Date(lastBeat).toLocaleString('ar-SA')}
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>

      {/* 6. Contact Us Page Settings */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
      >
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100">
          <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center">
            <Building2 className="w-4.5 h-4.5 text-indigo-600" />
          </div>
          <h3 className="text-gray-900" style={{ fontWeight: 700, fontSize: "0.95rem" }}>إعدادات صفحة اتصل بنا (تواصل معنا)</h3>
        </div>
        <div className="px-6 py-4 space-y-4">
          <div className="flex items-center justify-between gap-6">
            <div className="flex-1 min-w-0">
              <div className="text-gray-800" style={{ fontWeight: 600, fontSize: "0.875rem" }}>رقم هاتف الدعم الفني</div>
              <div className="text-gray-400" style={{ fontSize: "0.75rem" }}>الرقم الذي يظهر للعملاء في خيار الاتصال الهاتفي بصفحة التواصل</div>
            </div>
            <input
              type="text"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              className="px-3 py-2 rounded-xl border border-gray-200 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all w-64 text-left font-semibold"
              style={{ direction: "ltr" }}
            />
          </div>

          <div className="flex items-center justify-between gap-6">
            <div className="flex-1 min-w-0">
              <div className="text-gray-800" style={{ fontWeight: 600, fontSize: "0.875rem" }}>رقم أو رابط الواتساب للدعم المباشر</div>
              <div className="text-gray-400" style={{ fontSize: "0.75rem" }}>الرقم الذي يُحول العميل لدردشة واتساب مباشرة (اكتبه مع كود الدولة وبدون رمز + مثل: 201098869806)</div>
            </div>
            <input
              type="text"
              value={contactWhatsapp}
              onChange={(e) => setContactWhatsapp(e.target.value)}
              className="px-3 py-2 rounded-xl border border-gray-200 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all w-64 text-left font-semibold"
              style={{ direction: "ltr" }}
            />
          </div>

          <div className="pt-4 border-t border-dashed border-gray-150">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-gray-800 font-bold text-xs">إدارة فروع ومكاتب الشركة المعتمدة</h4>
              <button
                type="button"
                onClick={() => setContactOffices([...contactOffices, { cityAr: "", cityEn: "", flag: "🇪🇬", addressAr: "", addressEn: "" }])}
                className="px-3 py-1.5 rounded-lg bg-indigo-650 hover:bg-indigo-755 text-white font-bold text-xs transition-all flex items-center gap-1.5"
              >
                + إضافة فرع جديد
              </button>
            </div>

            <div className="space-y-3">
              {contactOffices.map((office, idx) => (
                <div key={idx} className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex flex-col gap-2 relative">
                  <button
                    type="button"
                    onClick={() => setContactOffices(contactOffices.filter((_, i) => i !== idx))}
                    className="absolute top-2 left-2 text-gray-400 hover:text-red-500 transition-colors"
                    title="حذف الفرع"
                  >
                    <X className="w-4 h-4" />
                  </button>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">اسم المدينة (عربي)</label>
                      <input
                        type="text"
                        value={office.cityAr || ""}
                        onChange={(e) => {
                          const updated = [...contactOffices];
                          updated[idx].cityAr = e.target.value;
                          setContactOffices(updated);
                        }}
                        placeholder="القاهرة / الرياض"
                        className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 outline-none focus:border-indigo-400 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">اسم المدينة (إنجليزي)</label>
                      <input
                        type="text"
                        value={office.cityEn || office.city || ""}
                        onChange={(e) => {
                          const updated = [...contactOffices];
                          updated[idx].cityEn = e.target.value;
                          updated[idx].city = e.target.value;
                          setContactOffices(updated);
                        }}
                        placeholder="Cairo / Riyadh"
                        className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 outline-none focus:border-indigo-400 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">علم الدولة (Flag)</label>
                      <input
                        type="text"
                        value={office.flag}
                        onChange={(e) => {
                          const updated = [...contactOffices];
                          updated[idx].flag = e.target.value;
                          setContactOffices(updated);
                        }}
                        placeholder="🇪🇬 / 🇸🇦"
                        className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 outline-none focus:border-indigo-400 bg-white text-center"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">العنوان بالتفصيل (عربي)</label>
                      <input
                        type="text"
                        value={office.addressAr}
                        onChange={(e) => {
                          const updated = [...contactOffices];
                          updated[idx].addressAr = e.target.value;
                          setContactOffices(updated);
                        }}
                        placeholder="العنوان بالعربية..."
                        className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 outline-none focus:border-indigo-400 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">العنوان بالتفصيل (إنجليزي)</label>
                      <input
                        type="text"
                        value={office.addressEn}
                        onChange={(e) => {
                          const updated = [...contactOffices];
                          updated[idx].addressEn = e.target.value;
                          setContactOffices(updated);
                        }}
                        placeholder="Address in English..."
                        className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 outline-none focus:border-indigo-400 bg-white"
                      />
                    </div>
                  </div>
                </div>
              ))}
              {contactOffices.length === 0 && (
                <div className="text-center py-6 text-slate-400 text-xs font-semibold bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  لا توجد فروع مضافة حالياً. اضغط على "إضافة فرع جديد" لإدراج فروع الشركة.
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>

      {/* 7. Desktop App Ads Management */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45 }}
        className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
      >
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100">
          <div className="w-9 h-9 rounded-xl bg-sky-50 flex items-center justify-center">
            <Megaphone className="w-4.5 h-4.5 text-sky-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-gray-900" style={{ fontWeight: 700, fontSize: "0.95rem" }}>إدارة إعلانات تطبيق الديسكتوب (Desktop Ads)</h3>
            <p className="text-gray-400 text-[11px] mt-0.5">تظهر هذه الإعلانات في الشريط الجانبي لتطبيق KWADER Desktop Pro للترويج للخطط الأعلى أو الميزات الجديدة</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setEditingAd({ id: `ad_${Date.now()}`, title: "", description: "", cta_url: "", cta_text: "اعرف أكثر", active: true });
              setIsAdModalOpen(true);
            }}
            className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs transition-all flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>إضافة إعلان جديد</span>
          </button>
        </div>
        <div className="px-6 py-4">
          <div className="space-y-3">
            {desktopAds.map((ad, idx) => (
              <div key={ad.id || idx} className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-gray-800">{ad.title || "بدون عنوان"}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold flex items-center gap-1 ${ad.active ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : "bg-gray-200 text-gray-500 border border-gray-355"
                      }`}>
                      {ad.active ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                      <span>{ad.active ? "نشط" : "معطل"}</span>
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1 truncate">{ad.description || "لا يوجد وصف"}</p>
                  {ad.cta_url && (
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-[10px] text-gray-400">زر الإجراء:</span>
                      <a href={ad.cta_url} target="_blank" rel="noopener noreferrer" className="text-[11px] text-sky-600 hover:underline font-medium">
                        {ad.cta_text || "اعرف أكثر"}
                      </a>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const updated = [...desktopAds];
                      updated[idx] = { ...updated[idx], active: !updated[idx].active };
                      setDesktopAds(updated);
                    }}
                    className={`relative w-9 h-5 rounded-full transition-colors duration-200 ${ad.active ? "bg-emerald-600" : "bg-gray-200"
                      }`}
                  >
                    <div className={`absolute top-0.5 right-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${ad.active ? "translate-x-[-16px]" : "translate-x-0"
                      }`} />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setEditingAd({ ...ad });
                      setIsAdModalOpen(true);
                    }}
                    className="w-8 h-8 rounded-lg hover:bg-slate-200 flex items-center justify-center text-gray-500 hover:text-sky-600 transition-colors"
                    title="تعديل الإعلان"
                  >
                    <Edit className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm("هل أنت متأكد من حذف هذا الإعلان؟")) {
                        setDesktopAds(desktopAds.filter((_, i) => i !== idx));
                      }
                    }}
                    className="w-8 h-8 rounded-lg hover:bg-red-50 flex items-center justify-center text-gray-400 hover:text-red-600 transition-colors"
                    title="حذف الإعلان"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}

            {desktopAds.length === 0 && (
              <div className="text-center py-8 text-gray-400 text-xs font-semibold bg-slate-50 rounded-xl border border-dashed border-slate-200 flex flex-col items-center justify-center gap-2">
                <Megaphone className="w-8 h-8 text-gray-300" />
                <span>لا توجد إعلانات مضافة حالياً. اضغط على "إضافة إعلان جديد" لإنشاء إعلانك الأول.</span>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Add/Edit Ad Modal */}
      {isAdModalOpen && editingAd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onClick={() => {
              setIsAdModalOpen(false);
              setEditingAd(null);
            }}
            className="absolute inset-0 bg-black/50 backdrop-blur-xs"
          />

          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            className="bg-white w-full max-w-lg rounded-2xl shadow-xl overflow-hidden z-10 border border-slate-100 flex flex-col"
            style={{ direction: "rtl", textAlign: "right" }}
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-sky-50 flex items-center justify-center text-sky-600">
                  <Megaphone className="w-4.5 h-4.5" />
                </div>
                <h3 className="text-gray-900 font-bold text-sm">
                  {desktopAds.some(ad => ad.id === editingAd.id) ? "تعديل إعلان" : "إضافة إعلان جديد"}
                </h3>
              </div>
              <button
                onClick={() => {
                  setIsAdModalOpen(false);
                  setEditingAd(null);
                }}
                className="w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5">عنوان الإعلان بالعربية</label>
                <input
                  type="text"
                  placeholder="مثال: ترقية إلى الخطة السحابية"
                  value={editingAd.title || ""}
                  onChange={(e) => setEditingAd({ ...editingAd, title: e.target.value })}
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-sky-400 focus:ring-2 focus:ring-sky-50 transition-all outline-none font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5">وصف الإعلان الموجه للمستخدم</label>
                <textarea
                  placeholder="مثال: استمتع بمميزات متقدمة، تقارير سحابية وتكامل غير محدود للأجهزة..."
                  value={editingAd.description || ""}
                  onChange={(e) => setEditingAd({ ...editingAd, description: e.target.value })}
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-sky-400 focus:ring-2 focus:ring-sky-50 transition-all outline-none font-semibold min-h-[80px]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1.5">نص زر الإجراء (CTA Text)</label>
                  <input
                    type="text"
                    placeholder="مثال: ترقية الآن"
                    value={editingAd.cta_text || ""}
                    onChange={(e) => setEditingAd({ ...editingAd, cta_text: e.target.value })}
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-sky-400 focus:ring-2 focus:ring-sky-50 transition-all outline-none font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1.5">رابط زر الإجراء (CTA URL)</label>
                  <input
                    type="text"
                    placeholder="https://..."
                    value={editingAd.cta_url || ""}
                    onChange={(e) => setEditingAd({ ...editingAd, cta_url: e.target.value })}
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-sky-400 focus:ring-2 focus:ring-sky-50 transition-all outline-none font-semibold"
                    style={{ direction: "ltr" }}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <div>
                  <span className="block text-xs font-bold text-slate-700">حالة نشاط الإعلان</span>
                  <span className="text-[10px] text-slate-400">سيتم عرض هذا الإعلان فقط إذا كان مفعلاً</span>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingAd({ ...editingAd, active: !editingAd.active })}
                  className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${editingAd.active ? "bg-emerald-600" : "bg-gray-200"
                    }`}
                >
                  <div className={`absolute top-0.5 right-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${editingAd.active ? "translate-x-[-20px]" : "translate-x-0"
                    }`} />
                </button>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsAdModalOpen(false);
                  setEditingAd(null);
                }}
                className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-100 transition-colors text-xs font-semibold text-slate-500"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!editingAd.title?.trim() || !editingAd.description?.trim()) {
                    toast.error("يرجى إدخال عنوان الإعلان ووصفه!");
                    return;
                  }

                  const isNew = !desktopAds.some(ad => ad.id === editingAd.id);
                  let updatedAds;
                  if (isNew) {
                    updatedAds = [...desktopAds, editingAd];
                  } else {
                    updatedAds = desktopAds.map(ad => ad.id === editingAd.id ? editingAd : ad);
                  }
                  setDesktopAds(updatedAds);
                  setIsAdModalOpen(false);
                  setEditingAd(null);
                  toast.success(isNew ? "تم إضافة الإعلان للقائمة مؤقتاً. اضغط على حفظ إعدادات النظام لتثبيته! 📢" : "تم تعديل الإعلان. اضغط على حفظ إعدادات النظام لتثبيته! 📢");
                }}
                className="px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white transition-colors text-xs font-bold shadow-md shadow-sky-100"
              >
                تأكيد الإجراء
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-3 pt-4">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className={`px-6 py-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-colors text-sm shadow-lg shadow-blue-200 flex items-center gap-2 ${isSaving ? "opacity-75 cursor-not-allowed" : ""}`}
          style={{ fontWeight: 700 }}
        >
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          {isSaving ? "جاري الحفظ والرفع..." : "حفظ إعدادات النظام بالكامل"}
        </button>
        <button
          onClick={loadSettings}
          disabled={isSaving}
          className="px-6 py-2.5 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors text-sm disabled:opacity-50"
          style={{ fontWeight: 600 }}
        >
          إعادة تحميل
        </button>
      </div>
    </div>
  );
}

// -------------------------------------------------------------------------
// DEVICES DIAGNOSTICS VIEW
// -------------------------------------------------------------------------
export function DevicesDiagnosticsView() {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pingingId, setPingingId] = useState(null);
  const [sendingAlertId, setSendingAlertId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [syncingId, setSyncingId] = useState(null);
  const [expandedDeviceId, setExpandedDeviceId] = useState(null);

  const analyzeDeviceStatus = (device) => {
    const syncData = device.companies?.sync_service_status?.[0];
    const now = new Date();

    // Check device.last_sync first to see if there's recent activity
    const lastDeviceSync = device.last_sync ? new Date(device.last_sync) : null;
    const syncDiffMinutes = lastDeviceSync ? (now - lastDeviceSync) / 1000 / 60 : null;
    const isDeviceRecentlySynced = syncDiffMinutes !== null && syncDiffMinutes < 15;

    const lastHeartbeat = syncData ? new Date(syncData.last_heartbeat) : null;
    const diffMinutes = lastHeartbeat ? (now - lastHeartbeat) / 1000 / 60 : null;

    // Consider sync online if either syncData is recent OR device recently synced
    const isSyncOnline = isDeviceRecentlySynced || (diffMinutes !== null && diffMinutes < 5);

    if (!isSyncOnline) {
      if (!syncData && !lastDeviceSync) {
        return {
          code: "NO_SYNC_SERVICE",
          statusText: "برنامج المزامنة غير مثبت أو غير مهيأ",
          severity: "critical",
          explanation: "لم يتم استقبال أي إشارة من برنامج المزامنة الخاص بهذه الشركة حتى الآن. قد يكون البرنامج غير مثبت على كمبيوتر العميل، أو لم يتم إعداده بالرمز السري الصحيح لتلك الشركة.",
          steps: [
            "تأكد من تحميل وتثبيت برنامج المزامنة (Sync App) على الكمبيوتر المتصل بالبصمة.",
            "تحقق من كتابة معرف الشركة (Company ID) بشكل سليم في إعدادات البرنامج المحلي لربطه بحساب الشركة.",
            "تأكد من أن الكمبيوتر المحلي متصل بشبكة الإنترنت."
          ]
        };
      }

      // Find the most recent offline time we know of
      const offlineMinutes = Math.min(
        syncDiffMinutes !== null ? syncDiffMinutes : Infinity,
        diffMinutes !== null ? diffMinutes : Infinity
      );

      if (offlineMinutes > 1440) {
        return {
          code: "SYNC_SERVICE_ABANDONED",
          statusText: "برنامج المزامنة متوقف بالكامل (ممسوح أو الجهاز مغلق)",
          severity: "critical",
          explanation: `برنامج المزامنة لم يرسل أي إشارة منذ أكثر من يوم كامل (${Math.round(offlineMinutes / 60)} ساعة). يرجى التحقق مما إذا كان البرنامج قد تم مسحه من الجهاز، أو أن جهاز الكمبيوتر المثبت عليه مغلق بشكل دائم.`,
          steps: [
            "تأكد من تشغيل جهاز الكمبيوتر المحلي لدى العميل والمثبت عليه البرنامج.",
            "تحقق من أن خدمة برنامج المزامنة تعمل في الخلفية ولم يتم حظرها.",
            "إذا تم تغيير نظام التشغيل أو الكمبيوتر، يرجى إعادة تنزيل البرنامج وتفعيله من جديد."
          ]
        };
      } else {
        return {
          code: "SYNC_SERVICE_OFFLINE",
          statusText: "انقطاع اتصال برنامج المزامنة بالإنترنت",
          severity: "warning",
          explanation: `برنامج المزامنة متوقف عن إرسال الإشارات منذ ${Math.round(offlineMinutes)} دقيقة. قد يكون ذلك بسبب انقطاع الإنترنت مؤقتاً لدى العميل أو إغلاق البرنامج بالخطأ.`,
          steps: [
            "تحقق من اتصال الإنترنت لدى العميل واستقراره.",
            "قم بفتح مدير المهام (Task Manager) للتأكد من عمل عملية المزامنة.",
            "جرب إعادة تشغيل البرنامج المحلي لتنشيط الاتصال."
          ]
        };
      }
    }

    const isDevicePingOk = (syncData && syncData.device_ping_status) || isDeviceRecentlySynced || device.status === 'connected';
    if (!isDevicePingOk) {
      return {
        code: "DEVICE_PING_FAILED",
        statusText: "البصمة غير متصلة بالشبكة المحلية للشركة",
        severity: "critical",
        explanation: syncData?.last_error_message
          ? `حاول برنامج المزامنة الاتصال ولكن ظهر الخطأ التالي: ${syncData.last_error_message}`
          : "برنامج المزامنة للعميل يعمل ويتصل بالإنترنت بنجاح، ولكنه لا يستطيع الوصول لجهاز البصمة في الشبكة الداخلية للشركة (LAN/Wi-Fi).",
        steps: [
          `تأكد من أن جهاز البصمة مضاء ومتصل بكابل الشبكة (LAN) أو الواي فاي بشكل سليم.`,
          `تحقق من تطابق الآي بي المحدد في اللوحة (${device.ip_address || "192.168.1.201"}) مع الآي بي الفعلي المكتوب في إعدادات جهاز البصمة.`,
          "تأكد من أن الكمبيوتر المثبت عليه البرنامج وجهاز البصمة متصلان بنفس الراوتر والشبكة الفرعية (Subnet).",
          "تأكد من عدم وجود جدار ناري (Firewall) في الشبكة المحلية يمنع الاتصال بالبورت (المنفذ) المحدد."
        ]
      };
    }

    return {
      code: "OK",
      statusText: "الجهاز متصل ويعمل بشكل ممتاز",
      severity: "success",
      explanation: "برنامج المزامنة متصل بالإنترنت، ويستطيع الوصول لجهاز البصمة محلياً وسحب الحركات ومزامنتها فورياً بدون أي عوائق.",
      steps: []
    };
  };

  const fetchDevices = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("devices")
        .select("*, companies(name, sync_service_status(*))");
      if (error) throw error;
      setDevices(data || []);
    } catch (err) {
      console.error("Error fetching devices:", err);
      toast.error("فشل في تحميل أجهزة البصمة والتشخيصات.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDevices();
  }, []);

  const handlePing = async (device) => {
    setPingingId(device.id);
    try {
      toast.info(`جاري تحديث وقراءة حالة الجهاز "${device.device_name}" من الخادم...`);

      // Delay slightly for UI response
      await new Promise((resolve) => setTimeout(resolve, 800));

      // We just re-fetch the real devices to get the exact reported status. 
      // We removed the fake connection forcing so it relies purely on real sync data.
      await fetchDevices();

      toast.success(`تم جلب التقرير الفعلي للجهاز بنجاح.`);
    } catch (err) {
      console.error("Ping error:", err);
      toast.error("فشل في استرجاع تقرير الجهاز.");
    } finally {
      setPingingId(null);
    }
  };

  const handleSendAlert = async (device) => {
    setSendingAlertId(device.id);
    try {
      const { error } = await supabase
        .from("company_notifications")
        .insert([{
          company_id: device.company_id,
          title: "تنبيه هام: انقطاع اتصال جهاز البصمة",
          message: `نود إحاطتكم علماً بأن جهاز البصمة المسمى "${device.device_name}" (رقم تسلسلي: ${device.serial_number || "غير محدد"}) قد فقد اتصاله بالخادم الرئيسي للنظام. يرجى التحقق من اتصال الإنترنت ومزود الطاقة بالجهاز لضمان مزامنة حركات الموظفين دون انقطاع.`,
          type: "warning",
          send_email: false
        }]);

      if (error) throw error;

      toast.success(`تم إرسال تنبيه انقطاع الاتصال إلى شركة "${device.companies?.name}" بنجاح.`);
    } catch (err) {
      console.error("Alert send error:", err);
      toast.error("فشل في إرسال التنبيه للشركة.");
    } finally {
      setSendingAlertId(null);
    }
  };

  const handleForceSync = async (device) => {
    setSyncingId(device.id);
    try {
      const { error } = await supabase
        .from("sync_service_status")
        .upsert({ company_id: device.company_id, force_full_sync: true });
      if (error) throw error;
      toast.success(`تم إرسال أمر المزامنة الكاملة لجهاز "${device.device_name}" بنجاح.`);
      fetchDevices();
    } catch (err) {
      console.error("Force sync error:", err);
      toast.error("فشل إرسال أمر المزامنة.");
    } finally {
      setSyncingId(null);
    }
  };

  const totalDevices = devices.length;
  const connectedDevices = devices.filter((d) => d.status === "connected").length;
  const disconnectedDevices = devices.filter((d) => d.status === "disconnected").length;
  const networkHealth = totalDevices > 0 ? Math.round((connectedDevices / totalDevices) * 100) : 100;

  const filteredDevices = devices.filter((d) => {
    const q = searchQuery.toLowerCase();
    const matchSearch =
      d.device_name.toLowerCase().includes(q) ||
      (d.serial_number || "").toLowerCase().includes(q) ||
      (d.companies?.name || "").toLowerCase().includes(q) ||
      (d.ip_address || "").toLowerCase().includes(q);

    const matchStatus = statusFilter === "All" || d.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-6" style={{ textAlign: "right", direction: "rtl" }}>
      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm flex items-center gap-4"
        >
          <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 flex-shrink-0">
            <Server className="w-6 h-6" />
          </div>
          <div>
            <div className="text-gray-400 text-xs font-bold">إجمالي الأجهزة المربوطة</div>
            <div className="text-slate-800 text-2xl font-black mt-1">{loading ? "—" : totalDevices}</div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05 }}
          className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm flex items-center gap-4"
        >
          <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 flex-shrink-0">
            <Wifi className="w-6 h-6" />
          </div>
          <div>
            <div className="text-gray-400 text-xs font-bold">الأجهزة المتصلة حالياً</div>
            <div className="text-emerald-600 text-2xl font-black mt-1">{loading ? "—" : connectedDevices}</div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm flex items-center gap-4"
        >
          <div className="w-12 h-12 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 flex-shrink-0">
            <WifiOff className="w-6 h-6" />
          </div>
          <div>
            <div className="text-gray-400 text-xs font-bold">أجهزة غير متصلة (أوفلاين)</div>
            <div className={`text-2xl font-black mt-1 ${disconnectedDevices > 0 ? "text-rose-600" : "text-slate-800"}`}>
              {loading ? "—" : disconnectedDevices}
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.15 }}
          className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm flex items-center gap-4"
        >
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${networkHealth >= 90 ? "bg-emerald-50 text-emerald-600 border border-emerald-100" : "bg-amber-50 text-amber-600 border border-amber-100"}`}>
            <CheckCircle className="w-6 h-6" />
          </div>
          <div>
            <div className="text-gray-400 text-xs font-bold">معدل استقرار الشبكة</div>
            <div className="text-slate-800 text-2xl font-black mt-1">{loading ? "—" : `${networkHealth}%`}</div>
          </div>
        </motion.div>
      </div>

      {/* Live Monitoring Grid */}
      {!loading && devices.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
          className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
              <h3 className="text-gray-900 font-bold text-sm">خريطة الاتصال النشطة للأجهزة</h3>
            </div>
            <span className="text-gray-400 text-xs font-medium">اضغط على أي جهاز لبدء فحص الاتصال الفوري (Ping)</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {devices.map((device) => {
              const isConnected = device.status === "connected";
              const isPinging = pingingId === device.id;

              return (
                <motion.div
                  key={device.id}
                  whileHover={{ scale: 1.03, translateY: -2 }}
                  onClick={() => !isPinging && handlePing(device)}
                  className={`relative p-4 rounded-xl border cursor-pointer transition-all ${isPinging
                    ? "border-blue-400 bg-blue-50/30 shadow-md ring-2 ring-blue-100"
                    : isConnected
                      ? "border-emerald-100 bg-emerald-50/10 hover:border-emerald-300 hover:bg-emerald-50/30"
                      : "border-rose-100 bg-rose-50/10 hover:border-rose-300 hover:bg-rose-50/30"
                    }`}
                >
                  {/* Status Indicator */}
                  <div className="absolute top-3 left-3 flex items-center gap-1">
                    <span className="relative flex h-2 w-2">
                      {isConnected && (
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      )}
                      <span className={`relative inline-flex rounded-full h-2 w-2 ${isConnected ? "bg-emerald-500" : "bg-rose-500"}`} />
                    </span>
                  </div>

                  {/* Device Info */}
                  <div className="flex flex-col gap-1 mt-1 text-right">
                    <div className="flex items-center gap-1.5 justify-end">
                      <span className="text-slate-800 font-bold text-xs truncate max-w-[120px]">{device.device_name}</span>
                      <Server className={`w-3.5 h-3.5 ${isConnected ? "text-emerald-500" : "text-rose-500"}`} />
                    </div>

                    <span className="text-slate-400 text-[0.65rem] truncate">{device.companies?.name || "شركة غير معروفة"}</span>

                    <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[0.65rem] text-slate-500">
                      <span className="font-mono">{device.ip_address || "192.168.1.201"}</span>
                      {isPinging ? (
                        <span className="text-blue-500 font-bold animate-pulse">فحص...</span>
                      ) : isConnected ? (
                        <span className="text-emerald-600 font-bold">متصل</span>
                      ) : (
                        <span className="text-rose-600 font-bold">منقطع</span>
                      )}
                    </div>
                  </div>

                  {/* Laser Scanning Effect on Ping */}
                  {isPinging && (
                    <motion.div
                      className="absolute inset-x-0 h-0.5 bg-blue-500 opacity-70 z-20"
                      animate={{ top: ["0%", "100%", "0%"] }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                    />
                  )}
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Main List and Controls */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {/* Header Controls */}
        <div className="px-6 py-5 border-b border-gray-100 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-gray-900 font-bold text-[0.95rem]">تشخيص ومراقبة أجهزة البصمة</h3>
            <p className="text-gray-400 text-xs mt-1">قائمة تفاعلية لمراقبة سلامة اتصال أجهزة ZK وحل مشاكل المزامنة فورياً</p>
          </div>

          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث باسم الجهاز، الشركة، أو IP..."
                className="pr-8 pl-3 py-2 text-xs rounded-xl border border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all w-56 outline-none bg-slate-50/50"
              />
            </div>

            {/* Filter Status */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 text-xs rounded-xl border border-gray-200 outline-none bg-white text-gray-600 font-bold"
            >
              <option value="All">كل الحالات</option>
              <option value="connected">متصل فقط</option>
              <option value="disconnected">غير متصل فقط</option>
            </select>

            {/* Refresh button */}
            <button
              onClick={fetchDevices}
              disabled={loading}
              className="p-2 rounded-xl border border-gray-200 hover:bg-slate-50 text-gray-500 transition-colors disabled:opacity-50"
              title="تحديث البيانات"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Devices Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-100">
                {["اسم الجهاز", "الشركة المالكة", "الرقم التسلسلي", "عنوان الشبكة (IP)", "حالة البصمة", "برنامج المزامنة", "اتصال البنج", "إجراءات التشخيص"].map((h) => (
                  <th key={h} className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                      <span className="text-sm text-gray-500 font-semibold">جاري تحميل تشخيصات الأجهزة...</span>
                    </div>
                  </td>
                </tr>
              )}

              {!loading && filteredDevices.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-20 bg-slate-50/30">
                    <div className="flex flex-col items-center justify-center">
                      <div className="relative w-48 h-48 flex items-center justify-center mb-6">
                        {/* Radar grid circles */}
                        <div className="absolute inset-0 rounded-full border border-blue-200/50" />
                        <div className="absolute inset-4 rounded-full border border-blue-200/50" />
                        <div className="absolute inset-10 rounded-full border border-blue-200/50" />
                        <div className="absolute inset-16 rounded-full border border-blue-200/50" />

                        {/* Radar Sweep */}
                        <motion.div
                          className="absolute inset-0 rounded-full bg-[conic-gradient(from_0deg,transparent_0deg,rgba(59,130,246,0.1)_90deg,rgba(59,130,246,0.4)_360deg)]"
                          animate={{ rotate: 360 }}
                          transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                        />

                        {/* Center Icon */}
                        <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center z-10 shadow-lg shadow-blue-500/30 relative">
                          <div className="absolute inset-0 rounded-full bg-blue-400 animate-ping opacity-50"></div>
                          <Wifi className="w-5 h-5 text-white" />
                        </div>

                        {/* Pulsing Dots simulating scanning */}
                        <motion.div
                          className="absolute w-2 h-2 bg-blue-500 rounded-full top-8 right-12"
                          animate={{ opacity: [0, 1, 0] }}
                          transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
                        />
                        <motion.div
                          className="absolute w-2 h-2 bg-emerald-500 rounded-full bottom-10 left-10"
                          animate={{ opacity: [0, 1, 0] }}
                          transition={{ duration: 2, repeat: Infinity, delay: 1.2 }}
                        />
                      </div>

                      <h4 className="text-gray-900 font-bold text-lg mb-2">جاري البحث ومراقبة الشبكة...</h4>
                      <p className="text-gray-500 text-sm max-w-sm text-center mb-6 leading-relaxed">
                        {searchQuery || statusFilter !== 'All'
                          ? "لا توجد أجهزة مطابقة لمعايير البحث الحالية. جرب تغيير الفلاتر."
                          : "لم يتم ربط أي أجهزة بصمة بالخادم حتى الآن. نحن في وضع الاستعداد بانتظار أول إشارة (Heartbeat)."}
                      </p>

                      {!(searchQuery || statusFilter !== 'All') && (
                        <button className="px-5 py-2.5 bg-white border border-gray-200 text-blue-600 rounded-xl text-sm font-bold shadow-sm hover:bg-blue-50 transition-colors flex items-center gap-2 group">
                          <BookOpen className="w-4 h-4 group-hover:scale-110 transition-transform" />
                          دليل ربط أجهزة البصمة
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}

              {!loading && filteredDevices.map((device, idx) => {
                const isPinging = pingingId === device.id;
                const isSendingAlert = sendingAlertId === device.id;
                const isSyncing = syncingId === device.id;

                const syncData = device.companies?.sync_service_status?.[0];
                const lastHeartbeat = syncData ? new Date(syncData.last_heartbeat) : null;
                const diffMinutes = lastHeartbeat ? (new Date() - lastHeartbeat) / 1000 / 60 : null;

                const lastDeviceSync = device.last_sync ? new Date(device.last_sync) : null;
                const syncDiffMinutes = lastDeviceSync ? (new Date() - lastDeviceSync) / 1000 / 60 : null;
                const isDeviceRecentlySynced = syncDiffMinutes !== null && syncDiffMinutes < 15;

                const isSyncOnline = isDeviceRecentlySynced || (diffMinutes !== null && diffMinutes < 5);
                const isDevicePingOk = (syncData && syncData.device_ping_status) || isDeviceRecentlySynced || device.status === 'connected';

                // Real-time dynamic connection state: device is connected if the local app is online, ping is OK, or it synced recently
                const isConnected = device.status === "connected" || isDeviceRecentlySynced;

                const diagnosis = analyzeDeviceStatus(device);

                return (
                  <Fragment key={device.id}>
                    <motion.tr
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.04 }}
                      className={`transition-all duration-300 ${expandedDeviceId === device.id
                        ? "bg-slate-50/70"
                        : isPinging
                          ? "bg-blue-50/40 hover:bg-blue-50/50"
                          : isSyncing
                            ? "bg-violet-50/40 hover:bg-violet-50/50"
                            : "hover:bg-slate-50/50"
                        }`}
                    >
                      {/* Device Name */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all ${isConnected
                            ? "bg-emerald-50 text-emerald-600 shadow-sm shadow-emerald-100"
                            : "bg-rose-50 text-rose-600 shadow-sm shadow-rose-100"
                            }`}>
                            <Server className="w-4 h-4" />
                          </div>
                          <span className="text-slate-800 font-bold text-sm">{device.device_name}</span>
                        </div>
                      </td>

                      {/* Company */}
                      <td className="px-6 py-4">
                        <span className="text-slate-600 font-semibold text-xs">{device.companies?.name || "شركة غير معروفة"}</span>
                      </td>

                      {/* Serial Number */}
                      <td className="px-6 py-4">
                        <code className="text-xs px-2 py-1 bg-slate-100 rounded-md text-slate-700 font-mono select-all">
                          {device.serial_number || "zk"}
                        </code>
                      </td>

                      {/* IP & Port */}
                      <td className="px-6 py-4">
                        <span className="text-slate-600 text-xs font-mono select-all">
                          {device.ip_address || "192.168.1.201"}:{device.port || 4370}
                        </span>
                      </td>

                      {/* Connection Status & Last Sync */}
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1.5">
                          <span className={`inline-flex w-fit items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border transition-all ${isPinging
                            ? "bg-blue-50 text-blue-700 border-blue-200"
                            : isSyncing
                              ? "bg-violet-50 text-violet-700 border-violet-200 animate-pulse"
                              : isConnected
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : "bg-rose-50 text-rose-700 border-rose-200"
                            }`}>
                            <span className="relative flex h-1.5 w-1.5">
                              {(isPinging || isSyncing || isConnected) && (
                                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isPinging ? "bg-blue-400" : isSyncing ? "bg-violet-400" : "bg-emerald-400"
                                  }`} />
                              )}
                              <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${isPinging
                                ? "bg-blue-500"
                                : isSyncing
                                  ? "bg-violet-500"
                                  : isConnected
                                    ? "bg-emerald-500"
                                    : "bg-rose-500"
                                }`} />
                            </span>
                            {isPinging ? "جاري الفحص..." : isSyncing ? "مزامنة كاملة..." : isConnected ? "متصل بالخادم" : "غير متصل"}
                          </span>
                          <span className="text-slate-500 text-[0.65rem] font-medium flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-400" />
                            {device.last_sync ? new Date(device.last_sync).toLocaleString("ar-EG", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "لم يزامن"}
                          </span>
                        </div>
                      </td>

                      {/* Sync App Status (Heartbeat) */}
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1">
                          {(() => {
                            if (!syncData && !device.last_sync) return <span className="text-gray-400 text-xs font-bold">غير مفعل</span>;

                            const isSyncActive = isSyncOnline;

                            return (
                              <>
                                <span className={`inline-flex w-fit items-center gap-1.5 px-2.5 py-1 rounded-md text-[0.7rem] font-bold ${isSyncActive ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800 animate-pulse"
                                  }`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${isSyncActive ? "bg-emerald-500" : "bg-rose-500"}`} />
                                  {isSyncActive ? "البرنامج يعمل" : "البرنامج متوقف"}
                                </span>
                                <span className="text-gray-400 text-[0.65rem] font-medium">
                                  {syncData?.service_version ? `v${syncData.service_version}` : "متصل محلياً"}
                                </span>
                              </>
                            );
                          })()}
                        </div>
                      </td>

                      {/* Ping Status */}
                      <td className="px-6 py-4">
                        {(() => {
                          if (!syncData && !device.last_sync) return <span className="text-gray-400 text-xs">—</span>;
                          const pingOk = isDevicePingOk;
                          return (
                            <span className={`inline-flex items-center gap-1.5 text-xs font-bold ${pingOk ? "text-emerald-600" : "text-rose-600"
                              }`}>
                              {pingOk ? <Wifi className="w-3.5 h-3.5 animate-pulse text-emerald-500" /> : <WifiOff className="w-3.5 h-3.5 text-rose-500" />}
                              {pingOk ? "استجابة ممتازة" : "لا يوجد رد"}
                            </span>
                          );
                        })()}
                      </td>

                      {/* Diagnostics Actions */}
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap items-center gap-2">
                          {/* Intelligent Diagnostics Panel Trigger */}
                          <button
                            onClick={() => setExpandedDeviceId(expandedDeviceId === device.id ? null : device.id)}
                            className={`flex items-center gap-1 px-2.5 py-1.5 text-[0.7rem] rounded-lg font-bold transition-all border ${expandedDeviceId === device.id
                              ? "bg-slate-800 border-slate-800 text-white shadow-sm"
                              : "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700 shadow-sm active:scale-95"
                              }`}
                            title="التشخيص الذكي"
                          >
                            <Activity className="w-3.5 h-3.5" />
                            {expandedDeviceId === device.id ? "إغلاق التقرير" : "التشخيص الذكي"}
                          </button>

                          {/* Ping / Reconnect action */}
                          <button
                            onClick={() => handlePing(device)}
                            disabled={isPinging || isSendingAlert || syncingId === device.id}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-[0.7rem] rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold transition-all shadow-sm disabled:opacity-50 active:scale-95"
                            title="فحص الاتصال"
                          >
                            {isPinging ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                          </button>

                          {/* Force Full Sync Action */}
                          <button
                            onClick={() => handleForceSync(device)}
                            disabled={isPinging || isSendingAlert || syncingId === device.id}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-[0.7rem] rounded-lg bg-violet-600 hover:bg-violet-700 text-white font-bold transition-all shadow-sm disabled:opacity-50 active:scale-95"
                            title="إجبار المزامنة الكاملة"
                          >
                            {syncingId === device.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Database className="w-3.5 h-3.5" />}
                            مزامنة شاملة
                          </button>

                          {/* Send Warning notification */}
                          <button
                            onClick={() => handleSendAlert(device)}
                            disabled={isConnected || isPinging || isSendingAlert || syncingId === device.id}
                            className={`flex items-center gap-1 px-2.5 py-1.5 text-[0.7rem] rounded-lg font-bold transition-all border ${isConnected
                              ? "bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed"
                              : "bg-amber-50 hover:bg-amber-100 border-amber-200 text-amber-700 shadow-sm active:scale-95"
                              }`}
                            title="تنبيه الشركة"
                          >
                            {isSendingAlert ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </td>
                    </motion.tr>

                    {/* Diagnostics Expanded Panel */}
                    <tr className={expandedDeviceId === device.id ? "" : "hidden"}>
                      <td colSpan={8} className="px-6 py-4 bg-slate-50/50 border-t border-b border-slate-100">
                        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-5 text-right">
                          {/* Diagnostic Header */}
                          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <div className="flex items-center gap-2">
                              <Activity className="w-5 h-5 text-blue-600 animate-pulse" />
                              <span className="font-bold text-slate-800 text-sm">تقرير التشخيص الذكي والتحليل الفوري للمشكلة</span>
                            </div>
                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${diagnosis.severity === "success"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : diagnosis.severity === "warning"
                                ? "bg-amber-50 text-amber-700 border border-amber-200"
                                : "bg-rose-50 text-rose-700 border border-rose-200"
                              }`}>
                              {diagnosis.statusText}
                            </span>
                          </div>

                          {/* Connection Path Diagram */}
                          <div className="py-4 bg-slate-50/50 rounded-xl border border-slate-100 flex flex-col md:flex-row items-center justify-around gap-4 px-4 text-center">

                            {/* Node 1: Cloud Server */}
                            <div className="flex flex-col items-center gap-1.5">
                              <div className="w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-200/50">
                                <Globe className="w-5 h-5" />
                              </div>
                              <span className="text-[0.7rem] font-bold text-slate-700">السيرفر السحابي (Cloud)</span>
                              <span className="text-[0.6rem] text-emerald-600 font-bold">متصل بالإنترنت</span>
                            </div>

                            {/* Line 1 */}
                            <div className="hidden md:flex flex-1 items-center justify-center relative px-2">
                              <div className={`h-1 w-full rounded-full ${isSyncOnline ? "bg-emerald-400" : "bg-slate-200 border-dashed border-t-2"}`} />
                              {isSyncOnline ? (
                                <span className="absolute text-[0.6rem] font-bold text-emerald-600 bg-white px-2 py-0.5 border border-emerald-100 rounded-full -top-3">مستقر</span>
                              ) : (
                                <span className="absolute text-[0.6rem] font-bold text-rose-500 bg-white px-2 py-0.5 border border-rose-100 rounded-full -top-3">مقطوع</span>
                              )}
                            </div>

                            {/* Node 2: Client Sync App */}
                            <div className="flex flex-col items-center gap-1.5">
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center shadow-lg ${isSyncOnline
                                ? "bg-emerald-500 text-white shadow-emerald-200/50"
                                : "bg-slate-300 text-slate-600 shadow-slate-100"
                                }`}>
                                <Server className="w-5 h-5" />
                              </div>
                              <span className="text-[0.7rem] font-bold text-slate-700">برنامج المزامنة المحلي (Sync App)</span>
                              <span className={`text-[0.6rem] font-bold ${isSyncOnline ? "text-emerald-600" : "text-rose-500"}`}>
                                {isSyncOnline ? "يعمل ويرسل نبضات" : "غير متصل بالسيرفر"}
                              </span>
                            </div>

                            {/* Line 2 */}
                            <div className="hidden md:flex flex-1 items-center justify-center relative px-2">
                              <div className={`h-1 w-full rounded-full ${(isSyncOnline && isDevicePingOk) ? "bg-emerald-400" : "bg-slate-200 border-dashed border-t-2"
                                }`} />
                              {(isSyncOnline && isDevicePingOk) ? (
                                <span className="absolute text-[0.6rem] font-bold text-emerald-600 bg-white px-2 py-0.5 border border-emerald-100 rounded-full -top-3">نشط</span>
                              ) : (
                                <span className="absolute text-[0.6rem] font-bold text-rose-500 bg-white px-2 py-0.5 border border-rose-100 rounded-full -top-3">مجهول</span>
                              )}
                            </div>

                            {/* Node 3: Fingerprint Device */}
                            <div className="flex flex-col items-center gap-1.5">
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center shadow-lg ${(isSyncOnline && isDevicePingOk)
                                ? "bg-emerald-500 text-white shadow-emerald-200/50"
                                : "bg-rose-50 text-white shadow-rose-200/50"
                                }`}>
                                <Wifi className="w-5 h-5" />
                              </div>
                              <span className="text-[0.7rem] font-bold text-slate-700">جهاز البصمة (ZK Device)</span>
                              <span className={`text-[0.6rem] font-bold ${(isSyncOnline && isDevicePingOk) ? "text-emerald-600" : "text-rose-500"}`}>
                                {(isSyncOnline && isDevicePingOk) ? "مرئي ومستجيب" : "غير مرئي بالشبكة"}
                              </span>
                            </div>

                          </div>

                          {/* Explanation and Troubleshooting steps */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">

                            {/* Diagnosis details */}
                            <div className="space-y-2">
                              <h4 className="text-xs font-bold text-slate-500">تحليل المشكلة الفعلي:</h4>
                              <p className="text-xs text-slate-700 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-100">
                                {diagnosis.explanation}
                              </p>
                            </div>

                            {/* Action steps */}
                            {diagnosis.steps.length > 0 && (
                              <div className="space-y-2">
                                <h4 className="text-xs font-bold text-slate-500">خطوات الحل المقترحة لإصلاح العطل:</h4>
                                <ul className="space-y-2">
                                  {diagnosis.steps.map((step, sIdx) => (
                                    <li key={sIdx} className="text-xs text-slate-600 flex items-start gap-1.5">
                                      <span className="w-4 h-4 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-[0.65rem] font-bold flex-shrink-0 mt-0.5">{sIdx + 1}</span>
                                      <span>{step}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                          </div>
                        </div>
                      </td>
                    </tr>
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------------------------------
// RENEWAL REQUESTS VIEW
// -------------------------------------------------------------------------
export function RenewalRequestsView({ renewals = [], totalCount = 0, loading = false, onQueryChange, onApprove, onReject }) {
  const { t, language } = useLocale();
  const isRtl = language === "ar";
  const [statusFilter, setStatusFilter] = useState("All");
  const [page, setPage] = useState(1);
  const pageSize = 7;

  // Modal states for approval
  const [approvingReq, setApprovingReq] = useState(null);
  const [newEndDate, setNewEndDate] = useState("");
  const [newPlan, setNewPlan] = useState("Pro");
  const [renewalAmount, setRenewalAmount] = useState("");
  const [renewalCycle, setRenewalCycle] = useState("monthly");
  const [submittingApprove, setSubmittingApprove] = useState(false);

  useEffect(() => {
    if (typeof onQueryChange === "function") {
      onQueryChange({ page, status: statusFilter });
    }
  }, [page, statusFilter, onQueryChange]);

  const handleStatusFilterChange = (status) => {
    setStatusFilter(status);
    setPage(1); // Reset to first page
  };

  const openApproveModal = (req) => {
    setApprovingReq(req);
    const plan = req.companies?.plan || "Pro";
    setNewPlan(plan);
    setRenewalAmount(
      req.companies?.subscription_amount !== undefined && req.companies?.subscription_amount !== null
        ? req.companies.subscription_amount
        : (req.companies?.settings?.subscription_amount ?? "")
    );
    setRenewalCycle(req.companies?.settings?.billing_cycle || (plan === "Enterprise" ? "yearly" : "monthly"));

    // Default next end date to +1 month from today, or +1 month from current end date if in future
    const currentEnd = req.companies?.settings?.subscription_end_date || req.companies?.settings?.trial_end_date;
    let baseDate = new Date();
    if (currentEnd) {
      const curDate = new Date(currentEnd);
      if (curDate > baseDate) baseDate = curDate;
    }
    baseDate.setMonth(baseDate.getMonth() + 1);

    // Format to yyyy-mm-dd
    const yyyy = baseDate.getFullYear();
    const mm = String(baseDate.getMonth() + 1).padStart(2, '0');
    const dd = String(baseDate.getDate()).padStart(2, '0');
    setNewEndDate(`${yyyy}-${mm}-${dd}`);
  };

  const confirmApprove = async () => {
    if (!approvingReq) return;
    setSubmittingApprove(true);
    try {
      await onApprove(approvingReq.id, approvingReq.company_id, newEndDate, newPlan, parseFloat(renewalAmount) || 0, renewalCycle);
      setApprovingReq(null);
    } catch (err) {
      console.error(err);
    } finally {
      setSubmittingApprove(false);
    }
  };

  const getWhatsAppLink = (req) => {
    const phone = req.companies?.phone || req.details?.company_phone;
    if (phone) {
      const cleanPhone = phone.replace(/[^0-9]/g, '');
      return `https://wa.me/${cleanPhone}`;
    }
    return null;
  };

  const formatRequestDate = (dateStr) => {
    if (!dateStr) return "—";
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString(language === "ar" ? "ar-EG" : "en-US", { month: "short", day: "numeric", year: "numeric" }) + " " +
        d.toLocaleTimeString(language === "ar" ? "ar-EG" : "en-US", { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "—";
    }
  };

  const formatExpiryDate = (dateStr) => {
    if (!dateStr) return language === "ar" ? "تاريخ غير محدد" : "Not Specified";
    try {
      return new Date(dateStr).toLocaleDateString(language === "ar" ? "ar-EG" : "en-US", {
        month: "short",
        day: "numeric",
        year: "numeric"
      });
    } catch {
      return "—";
    }
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1);

  const handlePageChange = (nextPage) => {
    setPage(nextPage);
  };

  return (
    <div className="space-y-6" dir={isRtl ? "rtl" : "ltr"} style={{ textAlign: isRtl ? "right" : "left" }}>

      {/* Title & Filters */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <h2 className="text-gray-900 font-extrabold text-lg flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-blue-600 animate-spin-slow" />
            {t.saRenewalPendingTitle}
          </h2>
          <p className="text-gray-400 text-xs mt-1">{t.saRenewalPendingSubtitle}</p>
        </div>

        {/* Status Filters */}
        <div className="flex bg-slate-50 p-1.5 rounded-xl border border-slate-100 gap-1">
          {[
            { key: "All", label: t.saRenewalFilterAll },
            { key: "Pending", label: t.saRenewalFilterPending },
            { key: "Approved", label: t.saRenewalFilterApproved },
            { key: "Rejected", label: t.saRenewalFilterRejected }
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => handleStatusFilterChange(tab.key)}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${statusFilter === tab.key
                ? "bg-white text-slate-800 shadow-sm"
                : "text-slate-400 hover:text-slate-600"
                }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Requests Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            <span className="text-sm text-gray-500 font-semibold">{t.saRenewalLoading}</span>
          </div>
        ) : renewals.length === 0 ? (
          <div className="py-20 text-center text-slate-400 space-y-3">
            <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mx-auto text-2xl">📥</div>
            <p className="text-sm font-semibold">{t.saRenewalNoRequests}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className={`w-full border-collapse ${isRtl ? "text-right" : "text-left"}`}>
              <thead>
                <tr className="bg-slate-50/70 text-slate-500 text-xs font-bold border-b border-slate-100">
                  <th className="px-6 py-4">{t.saRenewalThCompany}</th>
                  <th className="px-6 py-4">{t.saRenewalThRequester}</th>
                  <th className="px-6 py-4">{t.saRenewalThCurrentPlan}</th>
                  <th className="px-6 py-4">{t.saRenewalThCurrentExpiry}</th>
                  <th className="px-6 py-4">{t.saRenewalThRequestDate}</th>
                  <th className="px-6 py-4 text-center">{t.saRenewalThStatus}</th>
                  <th className="px-6 py-4 text-center">{t.saRenewalThActions}</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {renewals.map((req, idx) => {
                    const waLink = getWhatsAppLink(req);
                    return (
                      <motion.tr
                        key={req.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        className="hover:bg-slate-50/50 border-b border-slate-100 transition-colors"
                      >
                        <td className="px-6 py-4">
                          <div className="font-extrabold text-slate-800 text-sm">
                            {req.companies?.name || req.details?.company_name || "—"}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-slate-600 font-semibold text-xs">{req.details?.requested_by || "—"}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-bold">
                            {((req.companies?.plan || req.details?.current_plan) === "Free" ? "Starter" : (req.companies?.plan || req.details?.current_plan || "Starter"))}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-slate-500 font-semibold text-xs">
                            {formatExpiryDate(req.companies?.settings?.subscription_end_date || req.companies?.settings?.trial_end_date)}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-slate-400 font-medium text-xs">
                            {formatRequestDate(req.requested_at)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-bold inline-block ${req.status === "pending"
                            ? "bg-amber-50 text-amber-700 border border-amber-200"
                            : req.status === "approved"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-red-50 text-red-700 border border-red-200"
                            }`}>
                            {req.status === "pending" && t.saRenewalStatusPending}
                            {req.status === "approved" && t.saRenewalStatusApproved}
                            {req.status === "rejected" && t.saRenewalStatusRejected}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            {req.status === "pending" && (
                              <>
                                <button
                                  onClick={() => openApproveModal(req)}
                                  className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-sm shadow-blue-100 hover:shadow-md"
                                >
                                  {t.saRenewalBtnApprove}
                                </button>
                                <button
                                  onClick={() => {
                                    if (window.confirm(t.saRenewalConfirmRejectMsg)) {
                                      onReject(req.id);
                                    }
                                  }}
                                  className="px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 text-xs font-bold transition-all"
                                >
                                  {t.saRenewalBtnReject}
                                </button>
                              </>
                            )}

                            {waLink ? (
                              <a
                                href={waLink}
                                target="_blank"
                                rel="noreferrer"
                                className="p-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-600 border border-emerald-200 hover:shadow-xs transition-all"
                                title={t.saRenewalTooltipWhatsApp}
                              >
                                <MessageSquare className="w-3.5 h-3.5" />
                              </a>
                            ) : (
                              <button
                                disabled
                                className="p-2 rounded-lg bg-gray-50 text-gray-300 border border-gray-100 cursor-not-allowed"
                                title={t.saRenewalTooltipNoPhone}
                              >
                                <MessageSquare className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">
              {(t.saRenewalPagination || "الصفحة {page} من {totalPages} (إجمالي {totalCount} طلب)")
                .replace("{page}", page)
                .replace("{totalPages}", totalPages)
                .replace("{totalCount}", totalCount)}
            </span>
            <div className="flex gap-1.5">
              <button
                onClick={() => handlePageChange(Math.max(1, page - 1))}
                disabled={page === 1}
                className="p-2 rounded-lg border border-slate-200 text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors text-xs font-bold"
              >
                {t.saRenewalBtnPrev || "السابق"}
              </button>
              {pageNumbers.map((num) => (
                <button
                  key={num}
                  onClick={() => handlePageChange(num)}
                  className={`w-9 h-9 rounded-lg text-xs font-bold transition-colors ${page === num
                    ? "bg-blue-600 text-white shadow-sm"
                    : "border border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                >
                  {num}
                </button>
              ))}
              <button
                onClick={() => handlePageChange(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="p-2 rounded-lg border border-slate-200 text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors text-xs font-bold"
              >
                {t.saRenewalBtnNext || "التالي"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Approval Details Modal */}
      <AnimatePresence>
        {approvingReq && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setApprovingReq(null)}
              className="absolute inset-0 bg-black/50 backdrop-blur-xs"
            />

            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden z-10 border border-slate-100 flex flex-col"
              dir={isRtl ? "rtl" : "ltr"}
              style={{ textAlign: isRtl ? "right" : "left" }}
            >
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                    <CheckCircle className="w-4.5 h-4.5" />
                  </div>
                  <h3 className="text-gray-900 font-extrabold text-sm">{t.saRenewalModalTitle}</h3>
                </div>
                <button
                  onClick={() => setApprovingReq(null)}
                  className="w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-4">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{t.saRenewalModalCompanyName}</span>
                  <p className="text-sm font-extrabold text-slate-800">{approvingReq.companies?.name || approvingReq.details?.company_name}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Select Plan */}
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5">{t.saRenewalModalNewPlan}</label>
                    <select
                      value={newPlan}
                      onChange={(e) => setNewPlan(e.target.value)}
                      className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition-all outline-none font-bold"
                    >
                      <option value="Starter">Starter</option>
                      <option value="Pro">Pro</option>
                      <option value="Enterprise">Enterprise</option>
                    </select>
                  </div>

                  {/* End Date */}
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5">{t.saRenewalModalNewExpiry}</label>
                    <input
                      type="date"
                      value={newEndDate}
                      onChange={(e) => setNewEndDate(e.target.value)}
                      className="w-full text-xs px-3.5 py-2 rounded-xl border border-slate-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition-all outline-none font-semibold"
                      style={{ direction: "ltr" }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Renewal Amount */}
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5">مبلغ التجديد (ج.م)</label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      placeholder="0.00"
                      value={renewalAmount}
                      onChange={(e) => setRenewalAmount(e.target.value)}
                      className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition-all outline-none font-bold"
                      style={{ direction: "ltr" }}
                    />
                  </div>

                  {/* Billing Cycle */}
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5">دورة الاشتراك</label>
                    <select
                      value={renewalCycle}
                      onChange={(e) => setRenewalCycle(e.target.value)}
                      className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition-all outline-none font-bold"
                    >
                      <option value="monthly">شهري (Monthly)</option>
                      <option value="yearly">سنوي (Annual)</option>
                    </select>
                  </div>
                </div>

                {/* Info Tip */}
                <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100 text-xs text-blue-800 leading-relaxed font-medium">
                  💡 {t.saRenewalModalTip}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-2 bg-slate-50">
                <button
                  onClick={() => setApprovingReq(null)}
                  disabled={submittingApprove}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  {t.saRenewalModalBtnCancel}
                </button>
                <button
                  onClick={confirmApprove}
                  disabled={submittingApprove || !newEndDate}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-colors flex items-center gap-1.5 shadow-md shadow-blue-150 disabled:opacity-50"
                >
                  {submittingApprove ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  {t.saRenewalModalBtnConfirm}
                </button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// -------------------------------------------------------------------------
// BROADCAST ALERTS VIEW
// -------------------------------------------------------------------------
export function BroadcastAlertsView() {
  const { language } = useLocale();
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [type, setType] = useState("info"); // info, warning, error, success
  const [sendEmail, setSendEmail] = useState(false);
  const [companiesCount, setCompaniesCount] = useState(0);
  const [loadingCount, setLoadingCount] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function loadCompaniesCount() {
      try {
        const { count, error } = await supabase
          .from("companies")
          .select("id", { count: "exact", head: true });
        if (!error) {
          setCompaniesCount(count || 0);
        }
      } catch (err) {
        console.error("Failed to load companies count:", err);
      } finally {
        setLoadingCount(false);
      }
    }
    loadCompaniesCount();
  }, []);

  const handleSendBroadcast = async (e) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) {
      toast.error(language === "ar" ? "يرجى كتابة عنوان ورسالة التنبيه" : "Please enter a title and message");
      return;
    }

    setSubmitting(true);
    try {
      // 1. Fetch all company IDs
      const { data: allCompanies, error: fetchError } = await supabase
        .from("companies")
        .select("id");

      if (fetchError) throw fetchError;

      if (!allCompanies || allCompanies.length === 0) {
        toast.error(language === "ar" ? "لا توجد شركات مسجلة في النظام" : "No registered companies found");
        return;
      }

      // 2. Prepare bulk insert
      const notifications = allCompanies.map((c) => ({
        company_id: c.id,
        title: title.trim(),
        message: message.trim(),
        type,
        send_email: sendEmail,
      }));

      // 3. Insert into company_notifications in chunks
      const chunkSize = 100;
      for (let i = 0; i < notifications.length; i += chunkSize) {
        const chunk = notifications.slice(i, i + chunkSize);
        const { error: insertError } = await supabase
          .from("company_notifications")
          .insert(chunk);

        if (insertError) throw insertError;
      }

      // 4. Log admin activity
      await supabase.from("admin_activity").insert({
        event: "System Broadcast",
        action: "broadcast_notification",
        description: `Broadcast sent to ${allCompanies.length} companies: "${title}"`,
        actor: "Super Admin",
      });

      toast.success(
        language === "ar"
          ? `تم إرسال الإشعار الجماعي إلى ${allCompanies.length} شركة بنجاح! 🚀`
          : `Broadcast notification sent to ${allCompanies.length} companies successfully! 🚀`
      );

      // Reset form
      setTitle("");
      setMessage("");
      setSendEmail(false);
    } catch (err) {
      console.error("Broadcast notification error:", err);
      toast.error(
        language === "ar"
          ? `فشل في إرسال الإشعار الجماعي: ${err.message || "خطأ غير معروف"}`
          : `Failed to send broadcast notification: ${err.message || "Unknown error"}`
      );
    } finally {
      setSubmitting(false);
    }
  };

  const typesConfig = {
    info: {
      label: language === "ar" ? "إرشاد / معلومات" : "Information",
      colorClass: "border-blue-500/30 text-blue-700",
      activeBg: "bg-blue-500/10 border-blue-500 ring-2 ring-blue-100",
      icon: Bell,
    },
    success: {
      label: language === "ar" ? "نجاح / تحديث جديد" : "Update / Success",
      colorClass: "border-emerald-500/30 text-emerald-700",
      activeBg: "bg-emerald-500/10 border-emerald-500 ring-2 ring-emerald-100",
      icon: CheckCircle,
    },
    warning: {
      label: language === "ar" ? "تنبيه هام" : "Warning / Alert",
      colorClass: "border-amber-500/30 text-amber-700",
      activeBg: "bg-amber-500/10 border-amber-500 ring-2 ring-amber-100",
      icon: AlertTriangle,
    },
    error: {
      label: language === "ar" ? "طارئ / حرج" : "Critical / Urgent",
      colorClass: "border-red-500/30 text-red-700",
      activeBg: "bg-red-500/10 border-red-500 ring-2 ring-red-100",
      icon: AlertTriangle,
    },
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto" style={{ textAlign: "right", direction: "rtl" }}>
      {/* Header Panel */}
      <div className="bg-white p-6 rounded-2xl border border-gray-150 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
              <Megaphone className="w-5.5 h-5.5" />
            </div>
            <div>
              <h2 className="text-gray-900" style={{ fontWeight: 800, fontSize: "1.35rem" }}>
                {language === "ar" ? "إرسال إشعار جماعي للشركات" : "Broadcast Notifications"}
              </h2>
              <p className="text-gray-400 mt-1" style={{ fontSize: "0.825rem" }}>
                {language === "ar"
                  ? "أرسل إشعاراً فورياً وهاماً لجميع الشركات المشتركة في المنصة دفعة واحدة"
                  : "Send real-time system alerts to all registered companies simultaneously"}
              </p>
            </div>
          </div>
        </div>

        {/* Stats box */}
        <div className="flex items-center gap-3">
          <div className="bg-slate-50 border border-gray-150 text-slate-700 px-5 py-3 rounded-2xl flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-gray-400 font-bold">
                {language === "ar" ? "إجمالي الشركات المستهدفة" : "Total Target Companies"}
              </div>
              <div className="text-xl leading-none mt-1" style={{ fontWeight: 800 }}>
                {loadingCount ? <Loader2 className="w-5 h-5 animate-spin text-slate-400" /> : companiesCount}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Form Column */}
        <div className="lg:col-span-7 space-y-6">
          <form onSubmit={handleSendBroadcast} className="bg-white rounded-2xl border border-gray-150 shadow-xs p-6 space-y-6">
            {/* Notification Type Selector */}
            <div className="space-y-3">
              <label className="text-gray-700 block text-xs" style={{ fontWeight: 700 }}>
                {language === "ar" ? "درجة الأهمية ونوع الإشعار" : "Notification Severity & Type"}
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {Object.entries(typesConfig).map(([key, cfg]) => {
                  const Icon = cfg.icon;
                  const isActive = type === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setType(key)}
                      className={`flex flex-col items-center gap-2 p-3.5 rounded-xl border text-center transition-all duration-200 ${isActive ? cfg.activeBg : "border-gray-200 bg-gray-50/50 hover:bg-gray-50 text-gray-500 hover:text-gray-700"
                        }`}
                    >
                      <Icon className="w-5 h-5" />
                      <span className="text-[0.7rem] font-bold">{cfg.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Notification Title */}
            <div className="space-y-2">
              <label className="text-gray-700 block text-xs" style={{ fontWeight: 700 }}>
                {language === "ar" ? "عنوان التنبيه (Title)" : "Alert Title"}
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={language === "ar" ? "مثال: صيانة دورية مجدولة للنظام..." : "e.g., Scheduled System Maintenance..."}
                maxLength={100}
                required
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all bg-gray-50/50"
              />
            </div>

            {/* Notification Message */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-gray-700 text-xs" style={{ fontWeight: 700 }}>
                  {language === "ar" ? "نص الرسالة والتفاصيل (Message)" : "Message Details"}
                </label>
                <span className="text-[0.65rem] text-gray-400 font-mono">
                  {message.length} / 1000
                </span>
              </div>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={
                  language === "ar"
                    ? "اكتب تفاصيل التنبيه هنا بشكل واضح..."
                    : "Write the notification details clearly here..."
                }
                maxLength={1000}
                required
                rows={5}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all bg-gray-50/50 resize-y min-h-[120px]"
              />
            </div>

            {/* Email Dispatch Toggle */}
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-gray-150">
              <div>
                <div className="text-xs text-slate-800" style={{ fontWeight: 700 }}>
                  {language === "ar" ? "إرسال كـ بريد إلكتروني أيضاً" : "Also Dispatch as Email"}
                </div>
                <div className="text-[0.68rem] text-slate-400 mt-1">
                  {language === "ar"
                    ? "سيتم إرسال بريد إلكتروني لجميع مسؤولي الشركات المشتركة بالمحتوى"
                    : "Will send a background email alert to all company administrators"}
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={sendEmail}
                  onChange={(e) => setSendEmail(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 rounded-full peer peer-checked:after:-translate-x-full after:translate-x-0 rtl:peer-checked:after:translate-x-full rtl:after:translate-x-0 peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 justify-end pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-all flex items-center gap-2 shadow-lg shadow-blue-500/20 disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{language === "ar" ? "جاري الإرسال الجماعي..." : "Broadcasting..."}</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 transform rotate-180" />
                    <span>{language === "ar" ? "إرسال التنبيه الآن" : "Broadcast Alert"}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Live Preview Column */}
        <div className="lg:col-span-5 space-y-4">
          <div className="text-gray-700 text-xs" style={{ fontWeight: 700 }}>
            {language === "ar" ? "المعاينة الحية لبريد/إشعارات العميل" : "Live Client Preview"}
          </div>

          {/* Simulated Interface Wrapper */}
          <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-xl" style={{ direction: "rtl" }}>
            {/* Simulated macOS Header */}
            <div className="bg-slate-950 px-4 py-3 flex items-center gap-2 border-b border-slate-850">
              <div className="flex gap-1.5 flex-row-reverse">
                <span className="w-3.5 h-3.5 rounded-full bg-red-500/80 inline-block"></span>
                <span className="w-3.5 h-3.5 rounded-full bg-yellow-500/80 inline-block"></span>
                <span className="w-3.5 h-3.5 rounded-full bg-green-500/80 inline-block"></span>
              </div>
              <span className="text-[0.68rem] text-slate-500 font-mono ms-2 select-all">kwader.io/client/dashboard</span>
            </div>

            {/* Simulated Client Content Area */}
            <div className="p-6 bg-slate-900 min-h-[260px] flex flex-col justify-center gap-4">
              <div className="text-slate-400 text-[0.68rem] font-bold border-b border-slate-800 pb-2 mb-2 flex items-center justify-between">
                <span>{language === "ar" ? "🔔 مركز إشعارات المنشأة" : "🔔 Company Notification Center"}</span>
                <span className="text-blue-400 font-bold bg-blue-500/10 px-2 py-0.5 rounded-md text-[0.6rem]">
                  {language === "ar" ? "معاينة مباشرة" : "LIVE PREVIEW"}
                </span>
              </div>

              {/* Notification Bubble */}
              <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-4 shadow-lg relative overflow-hidden transition-all duration-300">
                {/* Visual Glow Line representing the severity */}
                <div className={`absolute top-0 bottom-0 right-0 w-1 ${type === "info" ? "bg-blue-500 shadow-[0_0_12px_#3b82f6]" :
                  type === "success" ? "bg-emerald-500 shadow-[0_0_12px_#10b981]" :
                    type === "warning" ? "bg-amber-500 shadow-[0_0_12px_#f59e0b]" :
                      "bg-red-500 shadow-[0_0_12px_#ef4444]"
                  }`} />

                <div className="flex gap-3">
                  {/* Icon Indicator bubble */}
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${type === "info" ? "bg-blue-500/10 text-blue-400" :
                    type === "success" ? "bg-emerald-500/10 text-emerald-400" :
                      type === "warning" ? "bg-amber-500/10 text-amber-400" :
                        "bg-red-500/10 text-red-400"
                    }`}>
                    {type === "info" && <Bell className="w-4.5 h-4.5" />}
                    {type === "success" && <CheckCircle className="w-4.5 h-4.5" />}
                    {type === "warning" && <AlertTriangle className="w-4.5 h-4.5" />}
                    {type === "error" && <AlertTriangle className="w-4.5 h-4.5" />}
                  </div>

                  <div className="flex-1 text-right min-w-0">
                    <div className="text-white text-xs font-bold truncate">
                      {title.trim() || (language === "ar" ? "عنوان الإشعار سيظهر هنا..." : "Alert Title Here...")}
                    </div>
                    <div className="text-slate-400 text-[0.7rem] leading-relaxed mt-1.5 whitespace-pre-wrap break-words">
                      {message.trim() || (language === "ar" ? "محتوى الإشعار وتفاصيله الهامة ستظهر هنا عند بدئك في الكتابة..." : "Detailed notification message will be typed here...")}
                    </div>
                    <div className="text-slate-600 text-[0.6rem] mt-2.5 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span>{language === "ar" ? "الآن" : "just now"}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Simulated Email view if sendEmail is checked */}
              {sendEmail && (
                <div className="bg-slate-950/40 border border-dashed border-slate-800 rounded-xl p-3 text-center text-[0.65rem] text-slate-500 animate-pulse">
                  📧 {language === "ar" ? "سيتم إرسال نسخة مطابقة عبر البريد الإلكتروني للمشتركين" : "A copy of this alert will also be emailed to subscribers"}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}









