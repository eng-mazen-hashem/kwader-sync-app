import { useState, useEffect, useCallback } from "react";
import {
    CheckCircle, XCircle, Clock, CreditCard, Eye, Phone,
    Wallet, RefreshCw, Settings, Save, AlertCircle, Link2, Copy, Trash2, Plus, Loader2
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { supabase } from "../../supabaseClient";
import { toast } from "sonner";

const METHOD_LABELS = {
    vodafone_cash: { label: "Vodafone Cash", color: "text-red-600 bg-red-50 border-red-200", badgeColor: "bg-red-500", emoji: "📱" },
    instapay: { label: "InstaPay", color: "text-indigo-600 bg-indigo-50 border-indigo-200", badgeColor: "bg-indigo-600", emoji: "⚡" },
};

const STATUS_CLASSES = {
    pending: "bg-amber-50 text-amber-700 border border-amber-250",
    approved: "bg-emerald-50 text-emerald-700 border border-emerald-250",
    rejected: "bg-red-50 text-red-700 border border-red-250",
};

const STATUS_LABELS = {
    pending: "قيد المراجعة",
    approved: "مقبول/مدفوع",
    rejected: "مرفوض",
};

function RejectModal({ onConfirm, onCancel }) {
    const [note, setNote] = useState("");
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onCancel}
                className="absolute inset-0 bg-black/50 backdrop-blur-xs"
            />
            <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 20 }}
                className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden z-10 border border-slate-100 p-6 relative"
                dir="rtl"
            >
                <h3 className="text-red-650 font-bold text-base mb-2">❌ رفض طلب الدفع</h3>
                <p className="text-slate-500 text-xs mb-4 leading-relaxed">
                    هل أنت متأكد من رغبتك في رفض هذا الطلب؟ سيتم إخطار العميل فوراً ويمكنك إضافة سبب للرفض أدناه.
                </p>
                <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="اكتب سبب الرفض هنا..."
                    rows={3}
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-red-400 focus:ring-2 focus:ring-red-50 outline-none resize-none mb-4 font-semibold"
                />
                <div className="flex items-center justify-end gap-2">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                    >
                        إلغاء
                    </button>
                    <button
                        onClick={() => onConfirm(note)}
                        className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-750 text-white font-bold text-xs transition-colors flex items-center gap-1.5 shadow-md shadow-red-150"
                    >
                        تأكيد الرفض
                    </button>
                </div>
            </motion.div>
        </div>
    );
}

function PaymentConfigSection({ config, onSave, saving }) {
    const [form, setForm] = useState({ ...config });
    const [changed, setChanged] = useState(false);

    useEffect(() => {
        setForm({ ...config });
    }, [config]);

    const handleChange = (key, val) => {
        setForm(prev => ({ ...prev, [key]: val }));
        setChanged(true);
    };

    const handleSave = () => {
        onSave(form);
        setChanged(false);
    };

    const fields = [
        { key: "vodafone_cash_number", label: "رقم Vodafone Cash", icon: "📱", placeholder: "01xxxxxxxxx" },
        { key: "vodafone_cash_name", label: "اسم صاحب محفظة Vodafone", icon: "👤", placeholder: "محمد أحمد" },
        { key: "instapay_number", label: "رقم/حساب InstaPay", icon: "⚡", placeholder: "01xxxxxxxxx أو اسم المستخدم" },
        { key: "instapay_name", label: "اسم صاحب حساب InstaPay", icon: "👤", placeholder: "محمد أحمد" },
        { key: "admin_whatsapp", label: "رقم واتساب الإدارة (دولي)", icon: "💬", placeholder: "201xxxxxxxxx" },
    ];

    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6" dir="rtl">
            <div className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                    <Settings className="w-4.5 h-4.5" />
                </div>
                <div>
                    <h3 className="text-gray-900 font-bold text-sm">إعدادات حسابات الدفع</h3>
                    <p className="text-gray-400 text-xs mt-0.5">تظهر هذه التفاصيل مباشرة للعملاء في صفحة تحويل الدفع</p>
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {fields.map(({ key, label, icon, placeholder }) => (
                    <div key={key}>
                        <label className="block text-[0.72rem] font-bold text-slate-500 mb-1.5">
                            <span className="ml-1">{icon}</span> {label}
                        </label>
                        <input
                            type="text"
                            value={form[key] || ""}
                            onChange={(e) => handleChange(key, e.target.value)}
                            placeholder={placeholder}
                            className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition-all outline-none font-semibold"
                            dir={key.includes("number") || key.includes("whatsapp") ? "ltr" : "rtl"}
                        />
                    </div>
                ))}
            </div>
            {changed && (
                <div className="mt-4 flex justify-start">
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-colors flex items-center gap-1.5 shadow-md shadow-blue-150 disabled:opacity-50"
                    >
                        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-4 h-4" />}
                        {saving ? "جاري الحفظ..." : "حفظ الإعدادات"}
                    </button>
                </div>
            )}
        </div>
    );
}

export function PaymentRequestsView({
    payments, total, loading, statusFilter,
    onFilterChange, onApprove, onReject,
    paymentConfig, onSaveConfig, savingConfig
}) {
    const [rejectTarget, setRejectTarget] = useState(null);
    const [rejectQuickTarget, setRejectQuickTarget] = useState(null);
    const [showConfig, setShowConfig] = useState(false);
    const [activeTab, setActiveTab] = useState("kwader"); // "kwader" or "quick"
    
    // Quick payments state
    const [quickPayments, setQuickPayments] = useState([]);
    const [quickPaymentsLoading, setQuickPaymentsLoading] = useState(false);
    const [copiedId, setCopiedId] = useState("");

    // Quick payment form state
    const [clientName, setClientName] = useState("");
    const [projectName, setProjectName] = useState("");
    const [amount, setAmount] = useState("");
    const [creatingLink, setCreatingLink] = useState(false);

    const fetchQuickPayments = useCallback(async () => {
        setQuickPaymentsLoading(true);
        try {
            const { data, error } = await supabase
                .from("quick_payments")
                .select("*")
                .order("created_at", { ascending: false });
            if (error) throw error;
            setQuickPayments(data || []);
        } catch (err) {
            console.error("fetchQuickPayments:", err.message);
        } finally {
            setQuickPaymentsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (activeTab === "quick") {
            fetchQuickPayments();
        }
    }, [activeTab, fetchQuickPayments]);

    const handleCreateLink = async (e) => {
        e.preventDefault();
        if (!clientName.trim() || !projectName.trim() || !amount) {
            toast.error("يرجى ملء جميع الحقول المطلوبة");
            return;
        }
        setCreatingLink(true);
        try {
            const { data, error } = await supabase
                .from("quick_payments")
                .insert({
                    client_name: clientName.trim(),
                    project_name: projectName.trim(),
                    amount: parseFloat(amount),
                    status: "pending"
                })
                .select()
                .single();
            if (error) throw error;

            const link = `${window.location.origin}/pay/${data.id}`;
            await navigator.clipboard.writeText(link);
            toast.success("تم إنشاء رابط الدفع ونسخه إلى الحافظة بنجاح! 🔗");
            
            // Clear form
            setClientName("");
            setProjectName("");
            setAmount("");
            
            // Refresh
            fetchQuickPayments();
        } catch (err) {
            toast.error("فشل إنشاء الرابط: " + err.message);
        } finally {
            setCreatingLink(false);
        }
    };

    const handleApproveQuick = async (id) => {
        try {
            const { error } = await supabase
                .from("quick_payments")
                .update({ status: "approved", paid_at: new Date().toISOString() })
                .eq("id", id);
            if (error) throw error;
            toast.success("تم تأكيد دفع الفاتورة بنجاح! ✅");
            fetchQuickPayments();
        } catch (err) {
            toast.error("فشل التأكيد: " + err.message);
        }
    };

    const handleRejectQuickConfirm = async (note) => {
        if (!rejectQuickTarget) return;
        try {
            const { error } = await supabase
                .from("quick_payments")
                .update({ status: "rejected", notes: note })
                .eq("id", rejectQuickTarget);
            if (error) throw error;
            toast.success("تم رفض طلب الدفع السريع");
            setRejectQuickTarget(null);
            fetchQuickPayments();
        } catch (err) {
            toast.error("فشل الرفض: " + err.message);
        }
    };

    const handleDeleteQuick = async (id) => {
        try {
            const { error } = await supabase
                .from("quick_payments")
                .delete()
                .eq("id", id);
            if (error) throw error;
            toast.success("تم حذف الرابط بنجاح");
            fetchQuickPayments();
        } catch (err) {
            toast.error("فشل الحذف: " + err.message);
        }
    };

    const copyLink = async (id) => {
        const link = `${window.location.origin}/pay/${id}`;
        try {
            await navigator.clipboard.writeText(link);
            setCopiedId(id);
            setTimeout(() => setCopiedId(""), 2000);
            toast.success("تم نسخ الرابط!");
        } catch {
            toast.error("فشل نسخ الرابط");
        }
    };

    const formatDate = (val) => {
        if (!val) return "—";
        try {
            return new Date(val).toLocaleString("ar-EG", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Cairo" });
        } catch { return "—"; }
    };

    return (
        <div className="space-y-6" style={{ textAlign: "right", direction: "rtl" }}>
            {rejectTarget && (
                <RejectModal
                    onConfirm={(note) => { onReject(rejectTarget, note); setRejectTarget(null); }}
                    onCancel={() => setRejectTarget(null)}
                />
            )}
            
            {rejectQuickTarget && (
                <RejectModal
                    onConfirm={handleRejectQuickConfirm}
                    onCancel={() => setRejectQuickTarget(null)}
                />
            )}

            {/* Header section with clean design */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-gray-900 font-extrabold text-lg flex items-center gap-2">
                        <span>💳</span> طلبات وبوابات الدفع الإلكتروني
                    </h2>
                    <p className="text-gray-400 text-xs mt-0.5">
                        إدارة اشتراكات كوادر، بالإضافة لإنشاء فواتير وروابط دفع سريعة للمشاريع الأخرى
                    </p>
                </div>
                <div className="flex items-center gap-2.5">
                    <button
                        onClick={() => setShowConfig(!showConfig)}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border flex items-center gap-2 shadow-xs ${
                            showConfig 
                                ? "bg-slate-800 border-slate-800 text-white" 
                                : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                        }`}
                    >
                        <Settings className="w-4 h-4" />
                        {showConfig ? "إخفاء إعدادات الحسابات" : "إعدادات حسابات الدفع"}
                    </button>
                </div>
            </div>

            {/* Config View */}
            <AnimatePresence>
                {showConfig && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                    >
                        <PaymentConfigSection config={paymentConfig} onSave={onSaveConfig} saving={savingConfig} />
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Tab navigation matching theme */}
            <div className="flex gap-2 border-b border-slate-100 pb-1 mt-2">
                {[
                    { id: "kwader", label: "🏢 اشتراكات منصة كوادر" },
                    { id: "quick", label: "🔗 روابط دفع سريعة (مشاريع أخرى)" }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all ${
                            activeTab === tab.id 
                                ? "border-blue-600 text-blue-650" 
                                : "border-transparent text-slate-400 hover:text-slate-600"
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab content wrapper */}
            <div className="space-y-4">
                {activeTab === "kwader" ? (
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
                            <h3 className="text-gray-900 font-bold text-sm">طلبات اشتراكات كوادر</h3>
                            
                            {/* Status Filter Tabs */}
                            <div className="flex items-center gap-1.5">
                                {[
                                    { id: "pending", label: "قيد المراجعة" },
                                    { id: "approved", label: "مقبولة" },
                                    { id: "rejected", label: "مرفوضة" },
                                    { id: "all", label: "الكل" }
                                ].map(tab => (
                                    <button
                                        key={tab.id}
                                        onClick={() => onFilterChange(tab.id)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                                            statusFilter === tab.id
                                                ? "bg-blue-600 border-blue-600 text-white"
                                                : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                                        }`}
                                    >
                                        {tab.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Table / List */}
                        {loading ? (
                            <div className="py-16 flex flex-col items-center justify-center gap-3">
                                <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                                <span className="text-xs text-gray-500 font-semibold">جاري تحميل طلبات الدفع...</span>
                            </div>
                        ) : payments.length === 0 ? (
                            <div className="p-16 text-center text-gray-400">لا توجد طلبات دفع تطابق معايير التصفية.</div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="bg-gray-50/80 border-b border-gray-100">
                                            {["الشركة", "طريقة الدفع", "رقم العملية", "المبلغ", "التاريخ", "الحالة", "إجراءات"].map((h) => (
                                                <th key={h} className="px-6 py-3.5 text-right font-bold text-xs text-slate-400">
                                                    {h}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {payments.map(payment => {
                                            const method = METHOD_LABELS[payment.payment_method] || { label: payment.payment_method, color: "text-slate-600 bg-slate-50 border-slate-200", badgeColor: "bg-slate-500", emoji: "💳" };
                                            const statusClass = STATUS_CLASSES[payment.status] || STATUS_CLASSES.pending;
                                            const company = payment.companies;

                                            return (
                                                <tr key={payment.id} className="hover:bg-blue-50/10 transition-colors">
                                                    <td className="px-6 py-4">
                                                        <span className="text-gray-800 font-bold text-xs">{company?.name || "—"}</span>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="inline-flex items-center gap-1.5">
                                                            <span className="text-sm">{method.emoji}</span>
                                                            <span className="text-xs text-slate-600 font-semibold">{method.label}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className="text-slate-500 font-semibold text-xs font-mono">{payment.transaction_ref || "—"}</span>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className="text-emerald-600 font-extrabold text-xs">{Number(payment.amount).toLocaleString("ar-EG")} ج.م</span>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className="text-slate-400 text-xs font-semibold">{formatDate(payment.requested_at)}</span>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className={`text-[0.7rem] px-2.5 py-1 rounded-full font-bold ${statusClass}`}>
                                                            {STATUS_LABELS[payment.status] || payment.status}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        {payment.status === "pending" ? (
                                                            <div className="flex gap-1.5">
                                                                <button
                                                                    onClick={() => onApprove(payment.id)}
                                                                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[0.7rem] font-bold transition-all shadow-sm shadow-emerald-100"
                                                                >
                                                                    قبول وتفعيل
                                                                </button>
                                                                <button
                                                                    onClick={() => setRejectTarget(payment.id)}
                                                                    className="px-2.5 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 text-[0.7rem] font-bold transition-all"
                                                                >
                                                                    رفض
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <span className="text-slate-300 text-xs font-semibold">—</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="space-y-5">
                        {/* Create link form */}
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                            <div className="flex items-center gap-2.5 mb-4">
                                <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
                                    <Plus className="w-4.5 h-4.5" />
                                </div>
                                <h3 className="text-gray-900 font-bold text-sm">إنشاء رابط دفع سريع مستقل</h3>
                            </div>
                            <form onSubmit={handleCreateLink} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                                <div>
                                    <label className="block text-[0.72rem] font-bold text-slate-500 mb-1.5">اسم العميل</label>
                                    <input
                                        type="text"
                                        value={clientName}
                                        onChange={(e) => setClientName(e.target.value)}
                                        placeholder="مثال: شركة النور للتوريدات"
                                        className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-50 outline-none font-semibold"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-[0.72rem] font-bold text-slate-500 mb-1.5">المشروع / الخدمة</label>
                                    <input
                                        type="text"
                                        value={projectName}
                                        onChange={(e) => setProjectName(e.target.value)}
                                        placeholder="مثال: تصميم متجر إلكتروني"
                                        className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-50 outline-none font-semibold"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-[0.72rem] font-bold text-slate-500 mb-1.5">المبلغ المطلوب (جنيه مصري)</label>
                                    <input
                                        type="number"
                                        value={amount}
                                        onChange={(e) => setAmount(e.target.value)}
                                        placeholder="1500"
                                        className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-50 outline-none font-semibold"
                                        style={{ direction: "ltr" }}
                                        required
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={creatingLink}
                                    className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors flex items-center justify-center gap-1.5 shadow-md shadow-emerald-100 disabled:opacity-50"
                                >
                                    {creatingLink ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
                                    {creatingLink ? "جاري الإنشاء..." : "إنشاء ونسخ الرابط"}
                                </button>
                            </form>
                        </div>

                        {/* List Quick payments */}
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                                <h3 className="text-gray-900 font-bold text-sm">روابط الفواتير السريعة النشطة</h3>
                                <button
                                    onClick={fetchQuickPayments}
                                    className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors"
                                >
                                    <RefreshCw className="w-4.5 h-4.5" />
                                </button>
                            </div>

                            {quickPaymentsLoading ? (
                                <div className="py-16 flex flex-col items-center justify-center gap-3">
                                    <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                                    <span className="text-xs text-gray-500 font-semibold">جاري تحميل الفواتير...</span>
                                </div>
                            ) : quickPayments.length === 0 ? (
                                <div className="p-16 text-center text-gray-400">لا توجد روابط دفع سريعة نشطة حالياً.</div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="bg-gray-50/80 border-b border-gray-100">
                                                {["العميل", "المشروع / الخدمة", "المبلغ", "تاريخ الإنشاء", "التحويل والمستند", "الحالة", "إجراءات"].map((h) => (
                                                    <th key={h} className="px-6 py-3.5 text-right font-bold text-xs text-slate-400">
                                                        {h}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                            {quickPayments.map(p => {
                                                const statusClass = STATUS_CLASSES[p.status] || STATUS_CLASSES.pending;
                                                const isPendingWithRef = p.status === "pending" && p.transaction_ref;
                                                const methodEmoji = p.payment_method === 'vodafone_cash' ? '📱 فودافون' : '⚡ انستاباي';

                                                return (
                                                    <tr key={p.id} className="hover:bg-blue-50/10 transition-colors">
                                                        <td className="px-6 py-4">
                                                            <span className="text-gray-800 font-bold text-xs">{p.client_name}</span>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <span className="text-slate-600 font-semibold text-xs">{p.project_name}</span>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <span className="text-emerald-600 font-extrabold text-xs">{Number(p.amount).toLocaleString("ar-EG")} ج.م</span>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <span className="text-slate-400 text-xs font-semibold">{formatDate(p.created_at)}</span>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            {p.transaction_ref ? (
                                                                <div className="flex flex-col">
                                                                    <span className="text-xs text-slate-700 font-bold">{methodEmoji}</span>
                                                                    <span className="text-[0.7rem] text-slate-400 font-mono mt-0.5">Ref: {p.transaction_ref}</span>
                                                                </div>
                                                            ) : (
                                                                <span className="text-slate-300 text-xs font-semibold">بانتظار التحويل</span>
                                                            )}
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <span className={`text-[0.7rem] px-2.5 py-1 rounded-full font-bold ${statusClass}`}>
                                                                {isPendingWithRef ? "بانتظار التأكيد ⏳" : STATUS_LABELS[p.status] || p.status}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center gap-1.5">
                                                                <button
                                                                    onClick={() => copyLink(p.id)}
                                                                    className={`p-1.5 rounded-lg border transition-all ${
                                                                        copiedId === p.id 
                                                                            ? "bg-emerald-50 border-emerald-200 text-emerald-600" 
                                                                            : "bg-white border-slate-200 text-slate-450 hover:bg-slate-50"
                                                                    }`}
                                                                    title="نسخ الرابط"
                                                                >
                                                                    {copiedId === p.id ? <CheckCircle className="w-4 h-4" /> : <Link2 className="w-4 h-4" />}
                                                                </button>
                                                                
                                                                {p.status === "pending" && (
                                                                    <>
                                                                        <button
                                                                            onClick={() => handleApproveQuick(p.id)}
                                                                            className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[0.7rem] font-bold transition-all shadow-sm"
                                                                        >
                                                                            قبول/دفع
                                                                        </button>
                                                                        <button
                                                                            onClick={() => setRejectQuickTarget(p.id)}
                                                                            className="px-2.5 py-1.5 rounded-lg border border-red-200 text-red-650 hover:bg-red-50 text-[0.7rem] font-bold transition-all"
                                                                        >
                                                                            رفض
                                                                        </button>
                                                                    </>
                                                                )}

                                                                <button
                                                                    onClick={() => handleDeleteQuick(p.id)}
                                                                    className="p-1.5 rounded-lg hover:bg-red-50 text-red-600 transition-all border border-transparent hover:border-red-100"
                                                                    title="حذف الفاتورة"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
