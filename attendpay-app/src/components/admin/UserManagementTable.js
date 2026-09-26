import { useState, useEffect, Fragment } from "react";
import {
  Eye, Pencil, Ban, Search, ChevronLeft, ChevronRight,
  UserPlus, Download, CheckCircle2, Trash2,
  ChevronUp, ChevronDown, X, CreditCard, Bell, RefreshCw,
  AlertTriangle, Sliders, Sparkles, MessageSquare,
  KeyRound, Copy, Check, ShieldCheck, EyeOff,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { supabase } from "../../supabaseClient";
import { useLocale } from "../../context/LocaleContext";
import { DEFAULT_PLAN_LIMITS, normalizePlanName } from "../../constants/planLimits";

const planBadgeStyle = {
  Starter: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  Free: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  Pro: "bg-blue-50 text-blue-700",
  Enterprise: "bg-gray-900 text-white",
};

const planDotStyle = {
  Starter: "bg-emerald-500",
  Free: "bg-emerald-500",
  Pro: "bg-blue-500",
  Enterprise: "bg-white/50",
};

const getPlanBadge = (p) => {
  const planName = (p || "Starter").toString().toLowerCase();
  if (planName.includes("pro")) return "bg-blue-50 text-blue-700 border border-blue-200";
  if (planName.includes("enterprise")) return "bg-gray-900 text-white";
  return "bg-emerald-50 text-emerald-700 border border-emerald-200";
};

const getPlanDot = (p) => {
  const planName = (p || "Starter").toString().toLowerCase();
  if (planName.includes("pro")) return "bg-blue-500";
  if (planName.includes("enterprise")) return "bg-white/50";
  return "bg-emerald-500";
};

const getDisplayPlanName = (p) => {
  const planName = (p || "Starter").toString().toLowerCase();
  if (planName.includes("pro")) return "Pro";
  if (planName.includes("enterprise")) return "Enterprise";
  return "Starter";
};

const usageColor = (v) =>
  v >= 90 ? "bg-red-500" : v >= 70 ? "bg-amber-500" : v >= 40 ? "bg-blue-500" : "bg-emerald-500";

const usageTrack = (v) =>
  v >= 90 ? "bg-red-100" : v >= 70 ? "bg-amber-100" : v >= 40 ? "bg-blue-100" : "bg-emerald-100";

// -------------------------------------------------------------------------
function AddUserModal({ onClose, onAdd }) {
  const [form, setForm] = useState({ name: "", email: "", company: "", plan: "Starter", password: "" });
  const [errors, setErrors] = useState({});

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = "Name is required";
    if (!form.email.includes("@")) e.email = "Valid email required";
    if (!form.password || form.password.length < 6) e.password = "Min 6 characters";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (ev) => {
    ev.preventDefault();
    if (!validate()) return;
    onAdd({ ...form, status: "active", resourceUsage: 0, initials: form.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() });
    toast.success(`User "${form.name}" created successfully.`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose} style={{ direction: 'rtl' }}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 20 }}
        transition={{ duration: 0.2 }}
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md z-10 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div style={{ textAlign: 'right' }}>
            <h3 className="text-gray-900" style={{ fontWeight: 700, fontSize: "1.05rem" }}>Add New User</h3>
            <p className="text-gray-400" style={{ fontSize: "0.78rem" }}>Create a manual account</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4" style={{ textAlign: 'right' }}>
          {[
            { label: "Full Name", key: "name", type: "text", placeholder: "e.g. John Smith" },
            { label: "Email Address", key: "email", type: "email", placeholder: "john@company.com" },
            { label: "Company", key: "company", type: "text", placeholder: "Company name" },
            { label: "Password", key: "password", type: "password", placeholder: "Min. 6 characters" },
          ].map(({ label, key, type, placeholder }) => (
            <div key={key}>
              <label className="block text-gray-700 mb-1.5" style={{ fontWeight: 600, fontSize: "0.8rem" }}>{label}</label>
              <input
                type={type}
                value={form[key]}
                onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                placeholder={placeholder}
                className={`w-full px-3.5 py-2.5 rounded-xl border text-sm outline-none transition-all ${
                  errors[key] ? "border-red-300 focus:ring-2 focus:ring-red-100" : "border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                }`}
                style={{ direction: 'ltr' }}
              />
              {errors[key] && <p className="text-red-500 mt-1" style={{ fontSize: "0.72rem" }}>{errors[key]}</p>}
            </div>
          ))}
          <div>
            <label className="block text-gray-700 mb-1.5" style={{ fontWeight: 600, fontSize: "0.8rem" }}>Plan</label>
            <select
              value={form.plan}
              onChange={e => setForm(f => ({ ...f, plan: e.target.value }))}
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all bg-white"
            >
              {["Starter", "Pro", "Enterprise"].map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors text-sm"
              style={{ fontWeight: 600 }}>
              Cancel
            </button>
            <button type="submit"
              className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-colors text-sm shadow-lg shadow-blue-200"
              style={{ fontWeight: 700 }}>
              Create User
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// -------------------------------------------------------------------------
function ManageSubscriptionModal({ user, onClose, onSave }) {
  const normalizedUserPlan = (user.plan === "Free" ? "Starter" : (user.plan || "Starter"));
  const [selectedPlan, setSelectedPlan] = useState(normalizedUserPlan);
  const [amount, setAmount] = useState(
    user.subscription_amount !== undefined && user.subscription_amount !== null
      ? user.subscription_amount
      : ""
  );
  const [expiryDate, setExpiryDate] = useState(user.subscription_expires_at ? user.subscription_expires_at.split('T')[0] : "");
  const [billingCycle, setBillingCycle] = useState(user.billing_cycle || (user.plan === "Enterprise" ? "yearly" : "monthly"));

  const userLimits = user.limits || user.settings?.limits || {};
  const initialPlanDefaults = DEFAULT_PLAN_LIMITS[normalizePlanName(normalizedUserPlan)] || DEFAULT_PLAN_LIMITS.Starter;

  const [maxEmployees, setMaxEmployees] = useState(
    userLimits.max_employees ?? user.settings?.max_employees ?? initialPlanDefaults.max_employees
  );
  const [maxDevices, setMaxDevices] = useState(
    userLimits.max_devices ?? user.settings?.max_devices ?? initialPlanDefaults.max_devices
  );
  const [aiEnabled, setAiEnabled] = useState(
    userLimits.ai_enabled ?? user.settings?.ai_enabled ?? initialPlanDefaults.ai_enabled
  );
  const [maxAiQueries, setMaxAiQueries] = useState(
    userLimits.max_ai_queries ?? user.settings?.max_ai_queries ?? initialPlanDefaults.max_ai_queries
  );
  const [whatsappEnabled, setWhatsappEnabled] = useState(
    userLimits.whatsapp_enabled ?? user.settings?.whatsapp_enabled ?? initialPlanDefaults.whatsapp_enabled
  );

  const handlePlanSelect = (pName) => {
    setSelectedPlan(pName);
    const defs = DEFAULT_PLAN_LIMITS[pName] || DEFAULT_PLAN_LIMITS.Starter;
    setMaxEmployees(defs.max_employees);
    setMaxDevices(defs.max_devices);
    setAiEnabled(defs.ai_enabled);
    setMaxAiQueries(defs.max_ai_queries);
    setWhatsappEnabled(defs.whatsapp_enabled);
  };

  const plans = [
    { name: "Starter", price: "690 ج.م", desc: "الخطة الأساسية (حتى 25 موظف)" },
    { name: "Pro", price: "1,690 ج.م", desc: "الخطة الاحترافية (حتى 60 موظف)" },
    { name: "Enterprise", price: "3,290 ج.م", desc: "خطة الشركات (150+ موظف)" },
  ];

  const applyQuickDuration = (months, cycle = 'monthly') => {
    // Start from current expiry if it's in the future, otherwise from today
    let baseDate = new Date();
    if (expiryDate) {
      const cur = new Date(expiryDate);
      if (cur > baseDate) baseDate = cur;
    }
    baseDate.setMonth(baseDate.getMonth() + months);
    const yyyy = baseDate.getFullYear();
    const mm = String(baseDate.getMonth() + 1).padStart(2, '0');
    const dd = String(baseDate.getDate()).padStart(2, '0');
    setExpiryDate(`${yyyy}-${mm}-${dd}`);
    setBillingCycle(cycle);
  };

  const parsedAmount = parseFloat(amount) || 0;
  const monthlyYield = billingCycle === "yearly" ? Math.round((parsedAmount / 12) * 10) / 10 : parsedAmount;
  const annualYield = billingCycle === "yearly" ? parsedAmount : parsedAmount * 12;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto" onClick={onClose} style={{ direction: 'rtl' }}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 20 }}
        transition={{ duration: 0.2 }}
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg z-10 overflow-hidden my-8"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-slate-50/50">
          <div className="flex items-center gap-3" style={{ textAlign: 'right' }}>
            <div className={`w-10 h-10 rounded-full ${user.avatarColor} flex items-center justify-center shadow-sm`}>
              <span className="text-white" style={{ fontWeight: 700, fontSize: "0.75rem" }}>{user.initials}</span>
            </div>
            <div>
              <h3 className="text-gray-900" style={{ fontWeight: 700, fontSize: "1.05rem" }}>إدارة وتجديد اشتراك الشركة</h3>
              <p className="text-gray-400" style={{ fontSize: "0.78rem" }}>{user.name} · {user.email}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5 max-h-[80vh] overflow-y-auto" style={{ textAlign: 'right' }}>
          {/* Plan Selection */}
          <label className="block text-gray-700 mb-2 font-bold text-xs">اختيار باقة الاشتراك</label>
          <div className="grid grid-cols-3 gap-3 mb-4">
            {plans.map((p) => (
              <button
                type="button"
                key={p.name}
                onClick={() => handlePlanSelect(p.name)}
                className={`p-3 rounded-xl border-2 text-center transition-all ${
                  selectedPlan === p.name
                    ? p.name === "Enterprise" ? "border-violet-500 bg-violet-50"
                      : p.name === "Pro" ? "border-blue-500 bg-blue-50"
                      : "border-emerald-500 bg-emerald-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <div className={`text-sm mb-0.5 ${selectedPlan === p.name ? (p.name === "Enterprise" ? "text-violet-700" : p.name === "Pro" ? "text-blue-700" : "text-emerald-700") : "text-gray-700"}`}
                  style={{ fontWeight: 700 }}>{p.name}</div>
                <div className="text-gray-400" style={{ fontSize: "0.65rem" }}>{p.desc}</div>
              </button>
            ))}
          </div>

          {/* Usage Limits Card */}
          <div className="mb-4 p-3.5 rounded-xl border border-indigo-100 bg-indigo-50/40">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-indigo-600" />
                <span className="text-xs font-bold text-gray-800">حدود الاستخدام وحصص الباقة (Usage Limits)</span>
              </div>
              <button
                type="button"
                onClick={() => handlePlanSelect(selectedPlan)}
                className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-1"
                title="إعادة تعيين الحصص بحسب المعايير الافتراضية للباقة المختارة"
              >
                <RefreshCw className="w-3 h-3" />
                استعادة حدود الباقة
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-gray-600 mb-1 text-[11px] font-bold">
                  أقصى موظفين (Max Employees)
                </label>
                <input
                  type="number"
                  min="1"
                  value={maxEmployees}
                  onChange={e => setMaxEmployees(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-bold text-gray-800 bg-white outline-none focus:border-indigo-500"
                  style={{ direction: 'ltr' }}
                />
                {user.usageStats && (
                  <span className="text-[10px] text-indigo-700 font-semibold mt-0.5 block">
                    المسجل حالياً: {user.usageStats.employeesCount} موظف
                  </span>
                )}
              </div>

              <div>
                <label className="block text-gray-600 mb-1 text-[11px] font-bold">
                  أقصى أجهزة بصمة (Max Devices)
                </label>
                <input
                  type="number"
                  min="1"
                  value={maxDevices}
                  onChange={e => setMaxDevices(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-bold text-gray-800 bg-white outline-none focus:border-indigo-500"
                  style={{ direction: 'ltr' }}
                />
                {user.usageStats && (
                  <span className="text-[10px] text-indigo-700 font-semibold mt-0.5 block">
                    المسجل حالياً: {user.usageStats.devicesCount} جهاز
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-indigo-100/70">
              <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-gray-100">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span className="text-[11px] font-bold text-gray-700">المساعد وتين AI</span>
                </div>
                <input
                  type="checkbox"
                  checked={aiEnabled}
                  onChange={e => setAiEnabled(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4 cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-gray-100">
                <div className="flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="text-[11px] font-bold text-gray-700">بوابة الواتساب</span>
                </div>
                <input
                  type="checkbox"
                  checked={whatsappEnabled}
                  onChange={e => setWhatsappEnabled(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4 cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Amount & Cycle Row */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-gray-700 mb-1.5 font-bold text-xs">
                مبلغ الاشتراك (ج.م) <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={amount}
                  placeholder="0.00"
                  onChange={e => setAmount(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-sm font-bold text-gray-900 outline-none focus:border-blue-500 transition-all"
                  style={{ direction: 'ltr' }}
                />
                <span className="absolute left-3 top-2 text-xs text-gray-400 font-semibold pointer-events-none">EGP</span>
              </div>
            </div>

            <div>
              <label className="block text-gray-700 mb-1.5 font-bold text-xs">دورة الفوترة / التجديد</label>
              <select
                value={billingCycle}
                onChange={e => setBillingCycle(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-sm font-semibold bg-white text-gray-800 outline-none focus:border-blue-500 transition-all"
              >
                <option value="monthly">شهري (Monthly)</option>
                <option value="yearly">سنوي (Annual)</option>
              </select>
            </div>
          </div>

          {/* Quick Extend Buttons */}
          <div className="mb-4">
            <label className="block text-gray-500 mb-1.5 font-bold text-[11px]">
              تمديد سريع لفترة التجديد:
            </label>
            <div className="grid grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => applyQuickDuration(1, 'monthly')}
                className="py-1.5 px-2 rounded-lg text-xs font-bold border border-slate-200 hover:border-blue-400 hover:bg-blue-50/50 text-slate-700 transition-all"
              >
                + شهر (شهري)
              </button>
              <button
                type="button"
                onClick={() => applyQuickDuration(3, 'monthly')}
                className="py-1.5 px-2 rounded-lg text-xs font-bold border border-slate-200 hover:border-blue-400 hover:bg-blue-50/50 text-slate-700 transition-all"
              >
                + 3 أشهر
              </button>
              <button
                type="button"
                onClick={() => applyQuickDuration(6, 'monthly')}
                className="py-1.5 px-2 rounded-lg text-xs font-bold border border-slate-200 hover:border-blue-400 hover:bg-blue-50/50 text-slate-700 transition-all"
              >
                + 6 أشهر
              </button>
              <button
                type="button"
                onClick={() => applyQuickDuration(12, 'yearly')}
                className="py-1.5 px-2 rounded-lg text-xs font-bold border border-purple-200 bg-purple-50/30 hover:border-purple-400 hover:bg-purple-50 text-purple-800 transition-all"
              >
                + سنة (سنوي)
              </button>
            </div>
          </div>

          {/* Expiry Date */}
          <div className="mb-4">
            <label className="block text-gray-700 mb-1.5 font-bold text-xs">تاريخ انتهاء الاشتراك الجديد</label>
            <input
              type="date"
              value={expiryDate}
              onChange={e => setExpiryDate(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-800 outline-none focus:border-blue-400 transition-all"
              style={{ direction: 'ltr' }}
            />
          </div>

          {/* Financial Calculation Preview Banner */}
          <div className="mb-5 p-3 rounded-xl bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 border border-blue-100">
            <div className="text-[11px] font-bold text-slate-500 mb-1">محاكاة مساهمة هذا الاشتراك في الإيرادات:</div>
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-blue-800">
                💵 شهرياً: <span className="text-sm font-extrabold">{monthlyYield.toLocaleString()}</span> ج.م
              </span>
              <span className="font-bold text-purple-800">
                📅 سنوياً: <span className="text-sm font-extrabold">{annualYield.toLocaleString()}</span> ج.م
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors text-sm font-bold">
              إلغاء
            </button>
            <button
              onClick={() => {
                onSave({
                  plan: selectedPlan,
                  amount: parsedAmount,
                  billingCycle,
                  expiryDate: expiryDate || null,
                  limits: {
                    max_employees: parseInt(maxEmployees, 10) || 25,
                    max_devices: parseInt(maxDevices, 10) || 1,
                    ai_enabled: Boolean(aiEnabled),
                    max_ai_queries: Boolean(aiEnabled) ? (parseInt(maxAiQueries, 10) || 250) : 0,
                    whatsapp_enabled: Boolean(whatsappEnabled),
                  }
                });
                onClose();
              }}
              className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-colors text-sm shadow-lg shadow-blue-200 flex items-center justify-center gap-1.5 font-bold"
            >
              <CheckCircle2 className="w-4 h-4" />
              حفظ التجديد والحدود
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// -------------------------------------------------------------------------
function NotifyCompanyModal({ user, onClose, onSend }) {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [sendEmail, setSendEmail] = useState(true);
  const [type, setType] = useState("info");
  const [errors, setErrors] = useState({});
  const { language } = useLocale();

  const typesConfig = {
    info: {
      label: language === "ar" ? "معلومات" : "Info",
      activeBg: "bg-blue-50 border-blue-500 text-blue-600 ring-2 ring-blue-100",
      icon: Bell,
    },
    success: {
      label: language === "ar" ? "تحديث / نجاح" : "Success",
      activeBg: "bg-emerald-50 border-emerald-500 text-emerald-600 ring-2 ring-emerald-100",
      icon: CheckCircle2,
    },
    warning: {
      label: language === "ar" ? "تنبيه" : "Warning",
      activeBg: "bg-amber-50 border-amber-500 text-amber-600 ring-2 ring-amber-100",
      icon: AlertTriangle,
    },
    error: {
      label: language === "ar" ? "حرج / هام" : "Critical",
      activeBg: "bg-red-50 border-red-500 text-red-600 ring-2 ring-red-100",
      icon: AlertTriangle,
    },
  };

  const validate = () => {
    const e = {};
    if (!title.trim()) e.title = "Title is required";
    if (!message.trim()) e.message = "Message is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (ev) => {
    ev.preventDefault();
    if (!validate()) return;
    await onSend({ title, message, sendEmail, type });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose} style={{ direction: 'rtl' }}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 20 }}
        transition={{ duration: 0.2 }}
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md z-10 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div style={{ textAlign: 'right' }}>
            <h3 className="text-gray-900" style={{ fontWeight: 700, fontSize: "1.05rem" }}>Send Notification</h3>
            <p className="text-gray-400" style={{ fontSize: "0.78rem" }}>{user?.company || user?.name}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4" style={{ textAlign: 'right' }}>
          <div className="space-y-1.5">
            <label className="block text-gray-700 mb-1.5" style={{ fontWeight: 600, fontSize: "0.8rem" }}>
              {language === "ar" ? "درجة الأهمية ونوع الإشعار" : "Notification Type & Severity"}
            </label>
            <div className="grid grid-cols-4 gap-2">
              {Object.entries(typesConfig).map(([key, cfg]) => {
                const Icon = cfg.icon;
                const isActive = type === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setType(key)}
                    className={`flex flex-col items-center gap-1.5 p-2.5 rounded-xl border text-center transition-all duration-200 ${
                      isActive ? cfg.activeBg : "border-gray-200 bg-gray-50/50 hover:bg-gray-50 text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    <Icon className="w-4.5 h-4.5" />
                    <span className="text-[0.65rem] font-bold">{cfg.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <label className="block text-gray-700 mb-1.5" style={{ fontWeight: 600, fontSize: "0.8rem" }}>Title</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="عنوان الإشعار"
              className={`w-full px-3.5 py-2.5 rounded-xl border text-sm outline-none transition-all ${
                errors.title ? "border-red-300 focus:ring-2 focus:ring-red-100" : "border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              }`}
            />
            {errors.title && <p className="text-red-500 mt-1" style={{ fontSize: "0.72rem" }}>{errors.title}</p>}
          </div>
          <div>
            <label className="block text-gray-700 mb-1.5" style={{ fontWeight: 600, fontSize: "0.8rem" }}>Message</label>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="نص الإشعار"
              rows={4}
              className={`w-full px-3.5 py-2.5 rounded-xl border text-sm outline-none transition-all ${
                errors.message ? "border-red-300 focus:ring-2 focus:ring-red-100" : "border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              }`}
            />
            {errors.message && <p className="text-red-500 mt-1" style={{ fontSize: "0.72rem" }}>{errors.message}</p>}
          </div>
          <label className="flex items-center gap-2 text-gray-600 text-sm">
            <input
              type="checkbox"
              checked={sendEmail}
              onChange={(e) => setSendEmail(e.target.checked)}
            />
            Send Email (requires email provider)
          </label>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors text-sm"
              style={{ fontWeight: 600 }}>
              Cancel
            </button>
            <button type="submit"
              className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-colors text-sm shadow-lg shadow-blue-200"
              style={{ fontWeight: 700 }}>
              Send
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// -------------------------------------------------------------------------
// Super Admin Quick Password & Security Management Modal
// -------------------------------------------------------------------------
function PasswordManagementModal({ user, onClose }) {
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [success, setSuccess] = useState(false);

  // Generate strong random password
  const handleGenerate = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*";
    let pass = "Kwader#";
    for (let i = 0; i < 6; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewPassword(pass);
    setShowPassword(true);
    setCopied(false);
    toast.info("تم توليد كلمة مرور قوية تلقائياً ⚡");
  };

  const handleCopy = (text) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("تم نسخ كلمة المرور للحافظة 📋");
    setTimeout(() => setCopied(false), 2500);
  };

  const handleWhatsAppShare = () => {
    if (!newPassword) return;
    const msg = `مرحباً بك،\nتم تحديث وتعيين بيانات تسجيل الدخول الخاصة بك على منصة كوادر:\n\n📧 البريد الإلكتروني: ${user.email}\n🔑 كلمة المرور الجديدة: ${newPassword}\n\n🌐 رابط تسجيل الدخول:\n${window.location.origin}/login\n\nيرجى تسجيل الدخول وتغيير كلمة المرور إن رغبت في ذلك.`;
    const url = `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");
  };

  const handleUpdate = async (e) => {
    e?.preventDefault();
    if (!newPassword || newPassword.trim().length < 6) {
      toast.error("كلمة المرور يجب أن تتكون من 6 أحرف على الأقل.");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("super_admin_update_user_password", {
        p_target_user_id: user.auth_user_id || user.userId || user.rawCompany?.owner_id || (typeof user.id === 'string' && user.id.includes("-") ? user.id : null),
        p_new_password: newPassword.trim(),
        p_target_email: user.email
      });

      if (error) throw error;

      setSuccess(true);
      toast.success(`تم تحديث كلمة المرور للمستخدم (${user.email}) بنجاح! 🎉`);
    } catch (err) {
      console.error(err);
      toast.error(err.message || "فشل تحديث كلمة المرور.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose} style={{ direction: 'rtl' }}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 20 }}
        transition={{ duration: 0.2 }}
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg z-10 overflow-hidden border border-gray-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-slate-50/70">
          <div className="flex items-center gap-3 text-right">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center shadow-sm">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-gray-900 font-bold text-base">إدارة كلمة المرور والأمان</h3>
              <p className="text-gray-500 text-xs mt-0.5">{user.company ? `${user.company} · ` : ""}{user.email}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-200/50 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="px-6 py-5 space-y-5 text-right">
          {/* Security Notice */}
          <div className="p-3.5 bg-amber-50/80 border border-amber-200/60 rounded-xl flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-amber-900 leading-relaxed">
              <span className="font-bold block mb-0.5">تشفير أحادي الاتجاه آمن (Bcrypt AES-256):</span>
              كلمات المرور مشفرة لحماية خصوصية الحسابات والبيانات البنكية ولا يمكن قراءتها كنص عادي. بصفتك <strong>سوبر أدمن</strong>، يمكنك تعيين كلمة مرور جديدة فوراً بنقرة واحدة، ومشاركتها مع العميل بأمان.
            </div>
          </div>

          {/* User Info Card */}
          <div className="p-3 bg-gray-50 border border-gray-200/60 rounded-xl flex items-center justify-between text-xs">
            <div>
              <span className="text-gray-400 block mb-0.5">البريد الإلكتروني:</span>
              <span className="font-semibold text-gray-800" style={{ direction: 'ltr', display: 'inline-block' }}>{user.email}</span>
            </div>
            <div className="text-left">
              <span className="text-gray-400 block mb-0.5">الدور / الحساب:</span>
              <span className="font-semibold text-indigo-600">{user.role || (user.company ? "مالك شركة" : "مستخدم")}</span>
            </div>
          </div>

          {/* Password Input & Generator */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-gray-700">كلمة المرور الجديدة</label>
              <button
                type="button"
                onClick={handleGenerate}
                className="inline-flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-700 font-semibold transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5" />
                توليد كلمة مرور قوية تلقائياً
              </button>
            </div>

            <div className="relative flex items-center">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="أدخل 6 أحرف على الأقل..."
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full pl-24 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all text-right"
                style={{ direction: 'ltr', textAlign: 'right' }}
              />

              <div className="absolute left-2 flex items-center gap-1">
                {newPassword && (
                  <button
                    type="button"
                    onClick={() => handleCopy(newPassword)}
                    title="نسخ كلمة المرور"
                    className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          {/* Post-update actions (WhatsApp share, Copy) */}
          {success && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex flex-col gap-2"
            >
              <div className="flex items-center gap-2 text-emerald-800 text-xs font-bold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                تم تحديث وتثبيت كلمة المرور بنجاح في قاعدة البيانات!
              </div>
              <p className="text-emerald-700 text-xs leading-relaxed">
                كلمة المرور الحالية للمستخدم: <strong className="font-mono bg-white px-2 py-0.5 rounded border border-emerald-300 text-gray-900">{newPassword}</strong>
              </p>
              <div className="flex items-center gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => handleCopy(newPassword)}
                  className="flex-1 py-1.5 px-3 bg-white border border-emerald-300 hover:bg-emerald-100 text-emerald-800 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Copy className="w-3.5 h-3.5" />
                  {copied ? "تم النسخ!" : "نسخ كلمة المرور"}
                </button>
                <button
                  type="button"
                  onClick={handleWhatsAppShare}
                  className="flex-1 py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  إرسال للعميل عبر واتساب
                </button>
              </div>
            </motion.div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleUpdate}
              disabled={loading || !newPassword || newPassword.length < 6}
              className="flex-1 py-2.5 px-4 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all shadow-md shadow-amber-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <KeyRound className="w-4 h-4" />
                  <span>تحديث كلمة المرور فوراً</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-semibold transition-colors"
            >
              إغلاق
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export function UserManagementTable({
  users,
  onUsersChange,
  totalCount,
  onQueryChange,
  loading = false,
  onStatusChange,
  onSubscriptionChange,
  onNotify,
  onDelete,
  onImpersonate,
  onForceRefresh,
  initialStatus,
}) {
  const { t, language } = useLocale();
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState(initialStatus || "all");
  const [sortField, setSortField] = useState("name");
  const [sortDir, setSortDir] = useState("asc");

  useEffect(() => {
    if (initialStatus !== undefined) {
      setStatusFilter(initialStatus);
      setPage(1);
    }
  }, [initialStatus]);
  const [page, setPage] = useState(1);
  const [addOpen, setAddOpen] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [notifyUser, setNotifyUser] = useState(null);
  const [passwordUser, setPasswordUser] = useState(null);
  const pageSize = 7;
  const serverMode = typeof onQueryChange === "function";

  useEffect(() => {
    if (!serverMode) return;
    onQueryChange({
      search,
      plan: planFilter,
      status: statusFilter,
      sortField,
      sortDir,
      page,
      pageSize,
    });
  }, [onQueryChange, page, pageSize, planFilter, search, serverMode, sortDir, sortField, statusFilter]);

  const handleSort = (field) => {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  };

  const filtered = serverMode
    ? users
    : users
      .filter(u => {
        const q = search.toLowerCase();
        const matchSearch = u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.company.toLowerCase().includes(q);
        const matchPlan = planFilter === "All" || u.plan === planFilter;
        const matchStatus = statusFilter === "all" || u.status === statusFilter;
        return matchSearch && matchPlan && matchStatus;
      })
      .sort((a, b) => {
        let cmp = 0;
        if (sortField === "name") cmp = a.name.localeCompare(b.name);
        else if (sortField === "plan") cmp = a.plan.localeCompare(b.plan);
        else if (sortField === "registeredAt") cmp = new Date(a.registeredAt).getTime() - new Date(b.registeredAt).getTime();
        else if (sortField === "resourceUsage") cmp = a.resourceUsage - b.resourceUsage;
        else if (sortField === "status") cmp = a.status.localeCompare(b.status);
        return sortDir === "asc" ? cmp : -cmp;
      });

  const effectiveTotal = serverMode ? (totalCount ?? users.length) : filtered.length;
  const totalPages = Math.max(1, Math.ceil(effectiveTotal / pageSize));
  const paged = serverMode ? users : filtered.slice((page - 1) * pageSize, page * pageSize);
  const pageWindow = 5;
  const startPage = Math.max(1, Math.min(page - 2, totalPages - pageWindow + 1));
  const endPage = Math.min(totalPages, startPage + pageWindow - 1);
  const pageNumbers = Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i);

  const toggleBan = async (id) => {
    const user = users.find(u => u.id === id);
    const newStatus = user?.status === "active" ? "suspended" : "active";
    try {
      if (onStatusChange) {
        await onStatusChange(id, newStatus);
      } else {
        onUsersChange(users.map(u => u.id === id ? { ...u, status: newStatus } : u));
      }
      toast(newStatus === "suspended" ? `User suspended.` : `User reactivated.`, {
        icon: newStatus === "suspended" ? "🚫" : "✅",
      });
    } catch (err) {
      toast.error("Failed to update status.");
    }
  };

  const updatePlan = (id, plan) => {
    onUsersChange(users.map(u => u.id === id ? { ...u, plan } : u));
  };

  const addUser = (data) => {
    const newUser = {
      id: Date.now(), name: data.name, email: data.email, initials: data.initials || "??",
      avatarColor: "bg-slate-500", plan: data.plan || "Starter", registeredAt: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      resourceUsage: 0, status: "active", company: data.company || "—", country: "—", lastActive: "Just now",
    };
    onUsersChange([newUser, ...users]);
  };

  const SortIcon = ({ field }) => (
    <span className="inline-flex flex-col mr-1 opacity-40">
      {sortField === field ? (
        sortDir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
      ) : (
        <span className="w-3 h-3 flex items-center justify-center opacity-50">↕</span>
      )}
    </span>
  );

  return (
    <>
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden" style={{ direction: 'rtl' }}>
        {/* Table toolbar */}
        <div className="px-6 py-4 border-b border-gray-100 flex flex-wrap items-center gap-3">
          <div style={{ textAlign: 'right' }}>
            <h2 className="text-gray-900" style={{ fontWeight: 700, fontSize: "1rem" }}>All Users</h2>
            <p className="text-gray-400" style={{ fontSize: "0.75rem" }}>{effectiveTotal} users found</p>
          </div>
          <div className="flex-1" />

          {/* Search */}
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search name, email, company..."
              className="pr-8 pl-3 py-1.5 rounded-lg border border-gray-200 text-sm outline-none focus:border-gray-400 transition-all w-52 placeholder-gray-400"
              style={{ direction: 'rtl' }}
            />
          </div>

          {/* Plan filter */}
          <select
            value={planFilter}
            onChange={e => { setPlanFilter(e.target.value); setPage(1); }}
            className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm outline-none focus:border-gray-400 bg-white text-gray-700"
            style={{ fontWeight: 500 }}
          >
            {["All", "Starter", "Pro", "Enterprise"].map(p => (
              <option key={p} value={p}>{p === "All" ? "All Plans" : p}</option>
            ))}
          </select>

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
            className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm outline-none focus:border-gray-400 bg-white text-gray-700"
            style={{ fontWeight: 500 }}
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="expiring">{language === "ar" ? "منتهي أو قارب على الانتهاء" : "Expiring / Expired"}</option>
          </select>

          {/* Export */}
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors text-sm" style={{ fontWeight: 600 }}>
            <Download className="w-3.5 h-3.5" />
            Export
          </button>

          {/* Add User */}
          <button
            onClick={() => setAddOpen(true)}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-gray-900 text-white hover:bg-gray-800 transition-colors text-sm shadow-sm"
            style={{ fontWeight: 700 }}
          >
            <UserPlus className="w-4 h-4" />
            Manual New User
          </button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50/80 border-b border-gray-100">
                {[
                  { label: "الشركة / العميل", field: "name", width: "w-52" },
                  { label: "البريد الإلكتروني", field: null, width: "w-48" },
                  { label: "الباقة", field: "plan", width: "w-28" },
                  { label: "الاشتراك", field: "subscription_amount", width: "w-36" },
                  { label: "تاريخ التسجيل", field: "registeredAt", width: "w-32" },
                  { label: "الاستهلاك", field: "resourceUsage", width: "w-44" },
                  { label: "الإجراءات", field: null, width: "w-36" },
                ].map(({ label, field, width }) => (
                  <th
                    key={label}
                    onClick={() => field && handleSort(field)}
                    className={`px-5 py-3.5 text-right ${width} ${field ? "cursor-pointer hover:text-gray-800 select-none" : ""}`}
                    style={{ fontWeight: 600, fontSize: "0.75rem", color: "#64748b", letterSpacing: "0.04em" }}
                  >
                    <span className="uppercase">{label}</span>
                    {field && <SortIcon field={field} />}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading && (
                <tr>
                  <td colSpan={6} className="px-6 py-10">
                    <div className="space-y-3">
                      {[0, 1, 2].map((idx) => (
                        <div key={idx} className="h-10 bg-gray-100 rounded-lg animate-pulse" />
                      ))}
                    </div>
                  </td>
                </tr>
              )}
              <AnimatePresence mode="popLayout">
                {!loading && paged.map((user, idx) => (
                  <Fragment key={user.id}>
                    <motion.tr
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15, delay: idx * 0.03 }}
                      className="hover:bg-gray-50 transition-colors group"
                    >
                      {/* User */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-full ${user.avatarColor} flex items-center justify-center flex-shrink-0 shadow-sm`}>
                            <span className="text-white" style={{ fontWeight: 700, fontSize: "0.65rem" }}>{user.initials}</span>
                          </div>
                          <div className="min-w-0 text-right">
                            <div className="flex items-center gap-1.5">
                              <span className="text-gray-900 truncate" style={{ fontWeight: 600, fontSize: "0.875rem" }}>{user.name}</span>
                              {user.status === "suspended" && (
                                <span className="bg-red-100 text-red-700 text-[10px] px-1.5 py-0.5 rounded font-bold">
                                  SUSPENDED
                                </span>
                              )}
                            </div>
                            <div className="text-gray-400 truncate" style={{ fontSize: "0.72rem" }}>{user.company}</div>
                          </div>
                        </div>
                      </td>

                      {/* Email */}
                      <td className="px-5 py-4 text-right">
                        <span className="text-gray-600 text-sm" style={{ direction: 'ltr' }}>{user.email}</span>
                        <div className="text-gray-400 mt-0.5" style={{ fontSize: "0.7rem" }}>
                          {user.lastActive}
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block ml-1" />
                        </div>
                      </td>

                      {/* Plan */}
                      <td className="px-5 py-4 text-right">
                        <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full ${getPlanBadge(user.plan)}`} style={{ fontWeight: 700 }}>
                          <span className={`w-1.5 h-1.5 rounded-full ${getPlanDot(user.plan)}`} />
                          {getDisplayPlanName(user.plan)}
                        </span>
                      </td>

                      {/* Subscription Info */}
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center gap-1.5 justify-end">
                          <span className="text-gray-900 font-bold" style={{ fontSize: "0.875rem" }}>
                            {Number(user.subscription_amount || 0).toLocaleString()}
                          </span>
                          <span className="text-gray-400 text-xs">ج.م</span>
                          {Number(user.subscription_amount || 0) > 0 && (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                              user.billing_cycle === 'yearly' 
                                ? 'bg-purple-50 text-purple-700 border border-purple-100' 
                                : 'bg-blue-50 text-blue-700 border border-blue-100'
                            }`}>
                              {user.billing_cycle === 'yearly' ? 'سنوي' : 'شهري'}
                            </span>
                          )}
                        </div>
                        <div className={`text-xs mt-1 ${user.subscription_expires_at && new Date(user.subscription_expires_at) < new Date() ? 'text-red-500 font-bold' : 'text-gray-400'}`} style={{ fontWeight: 500 }}>
                          {user.subscription_expires_at ? (
                            (user.status === "trialing" && (!user.subscription_amount || Number(user.subscription_amount) === 0))
                              ? `تجريبي: ${new Date(user.subscription_expires_at).toLocaleDateString('ar-EG')}`
                              : new Date(user.subscription_expires_at).toLocaleDateString('ar-EG')
                          ) : "غير محدد"}
                        </div>
                      </td>

                      {/* Registered */}
                      <td className="px-5 py-4 text-right">
                        <span className="text-gray-600 text-sm">{user.registeredAt}</span>
                      </td>

                      {/* Resource Usage */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2.5">
                          <div className={`flex-1 h-2 rounded-full ${usageTrack(user.resourceUsage)} overflow-hidden min-w-[80px]`}>
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${user.resourceUsage}%` }}
                              transition={{ duration: 0.6, ease: "easeOut" }}
                              className={`h-full rounded-full ${usageColor(user.resourceUsage)}`}
                            />
                          </div>
                          <span
                            className={`text-xs flex-shrink-0 ${
                              user.resourceUsage >= 90 ? "text-red-600" : user.resourceUsage >= 70 ? "text-amber-600" : "text-gray-600"
                            }`}
                            style={{ fontWeight: 700, minWidth: "32px" }}
                          >
                            {user.resourceUsage}%
                          </span>
                        </div>
                        {user.usageStats && (
                          <div className="flex items-center gap-2 text-[10px] text-gray-500 mt-1 justify-end font-medium">
                            <span title="عدد الموظفين المسجلين مقارنة بالحد الأقصى">
                              👥 {user.usageStats.employeesCount} / {user.usageStats.maxEmployees >= 999 ? '∞' : user.usageStats.maxEmployees}
                            </span>
                            <span>·</span>
                            <span title="عدد أجهزة البصمة المربوطة مقارنة بالحد الأقصى">
                              📟 {user.usageStats.devicesCount} / {user.usageStats.maxDevices >= 999 ? '∞' : user.usageStats.maxDevices}
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5">
                           {/* Login As */}
                          <button
                            onClick={() => onImpersonate?.(user)}
                            title={t.saImpersonateBtn || "Login As User"}
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-900 transition-all"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {/* Force Hard Refresh */}
                          <button
                            onClick={() => onForceRefresh?.(user.id)}
                            title={t.saForceRefreshBtn || "Force Browser Refresh"}
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-900 transition-all"
                          >
                            <RefreshCw className="w-4 h-4" />
                          </button>

                          {/* Password & Security Management */}
                          <button
                            onClick={() => setPasswordUser(user)}
                            title="إدارة وتعيين كلمة المرور / Password Management"
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-amber-500 hover:bg-amber-50 hover:text-amber-600 transition-all"
                          >
                            <KeyRound className="w-4 h-4" />
                          </button>

                          {/* Edit Plan */}
                          <button
                            onClick={() => setEditUser(user)}
                            title="Edit / Upgrade Plan"
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-900 transition-all"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>

                          {/* Ban / Unban */}
                          <button
                            onClick={() => toggleBan(user.id)}
                            title={user.status === "active" ? "Suspend User" : "Reactivate User"}
                            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                              user.status === "active"
                                ? "text-gray-400 hover:bg-red-50 hover:text-red-600"
                                : "text-emerald-500 hover:bg-emerald-50 hover:text-emerald-600"
                            }`}
                          >
                            {user.status === "active" ? <Ban className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                          </button>

                          {/* Notify */}
                          <button
                            onClick={() => setNotifyUser(user)}
                            title="Send Notification"
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-900 transition-all"
                          >
                            <Bell className="w-4 h-4" />
                          </button>

                          {/* Delete */}
                          <button
                            onClick={() => onDelete?.(user.id)}
                            title="Delete Company Completely"
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-red-50 hover:text-red-600 transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </motion.tr>

                    {/* Sub-row rendering for team members */}
                    {user.teamMembers && user.teamMembers.length > 0 && (
                      <tr className="bg-slate-50/50">
                        <td colSpan={7} className="px-14 py-3 text-right">
                          <div className="flex flex-col gap-2 border-r-2 border-indigo-500/20 pr-4">
                            <div className="text-[0.72rem] text-indigo-500 font-bold tracking-wider uppercase mb-1">
                              الموظفين والمفوضين بالصلاحيات (HR Sub-Users):
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                              {user.teamMembers.map(member => (
                                <div key={member.id} className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-slate-100 shadow-sm hover:border-amber-200 transition-colors">
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs flex-shrink-0">
                                      {member.email.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="min-w-0 text-right">
                                      <div className="text-xs text-slate-800 font-semibold truncate" style={{ direction: 'ltr' }}>{member.email}</div>
                                      <div className="text-[0.65rem] text-slate-400 flex gap-2">
                                        <span>النوع: {member.role === 'hr' ? 'مسؤول HR' : member.role}</span>
                                        <span>·</span>
                                        <span>آخر ظهور: {member.lastActive}</span>
                                      </div>
                                    </div>
                                  </div>
                                  <button
                                    onClick={() => setPasswordUser({ ...member, name: member.email, company: user.company })}
                                    title="تغيير كلمة المرور لهذا المفوض"
                                    className="p-1.5 rounded-lg text-amber-500 hover:bg-amber-50 hover:text-amber-600 transition-colors flex-shrink-0"
                                  >
                                    <KeyRound className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
          <span className="text-gray-400" style={{ fontSize: "0.8rem" }}>
            Showing {effectiveTotal === 0 ? 0 : Math.min((page - 1) * pageSize + 1, effectiveTotal)}–{Math.min(page * pageSize, effectiveTotal)} of {effectiveTotal} users
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            {pageNumbers.map(p => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={`w-8 h-8 rounded-lg border text-sm transition-colors ${
                  p === page ? "bg-gray-900 border-gray-900 text-white" : "border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
                style={{ fontWeight: 600 }}
              >
                {p}
              </button>
            ))}
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {addOpen && <AddUserModal onClose={() => setAddOpen(false)} onAdd={addUser} />}
        {editUser && (
          <ManageSubscriptionModal
            user={editUser}
            onClose={() => setEditUser(null)}
            onSave={(updates) => { 
              if (onSubscriptionChange) {
                onSubscriptionChange(editUser.id, updates);
              } else {
                updatePlan(editUser.id, updates.plan); 
              }
              setEditUser(null); 
            }}
          />
        )}
        {notifyUser && (
          <NotifyCompanyModal
            user={notifyUser}
            onClose={() => setNotifyUser(null)}
            onSend={async ({ title, message, sendEmail }) => {
              if (!onNotify) {
                toast.info("Notification system not configured yet.");
                return;
              }
              await onNotify({ companyId: notifyUser.id, title, message, sendEmail });
            }}
          />
        )}
        {passwordUser && (
          <PasswordManagementModal
            user={passwordUser}
            onClose={() => setPasswordUser(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
