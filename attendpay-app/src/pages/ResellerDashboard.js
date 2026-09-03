import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLocale } from '../context/LocaleContext';
import { supabase } from '../supabaseClient';
import AccountSettingsModal from '../components/AccountSettingsModal';
import { ResellerSidebar } from '../components/reseller/ResellerSidebar';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Building2, CheckCircle2, AlertTriangle, Plus, Calendar, 
  RefreshCw, MessageSquare, Send, Loader2, X, Clock, HardDrive, Copy,
  ChevronDown, Settings, LogOut
} from 'lucide-react';
import { toast } from 'sonner';
import './ResellerDashboard.css';

/* ── helpers ─────────────────────────────────────────────────── */
const priorityStyle = {
  Low:      "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
  Medium:   "bg-amber-500/10 text-amber-400 border border-amber-500/20",
  High:     "bg-rose-500/10 text-rose-400 border border-rose-500/20",
  Critical: "bg-rose-500/20 text-rose-300 border border-rose-500/30 animate-pulse",
};

const statusStyle = {
  Open:        "bg-blue-500/10 text-blue-400 border border-blue-500/20",
  "In Progress":"bg-orange-500/10 text-orange-400 border border-orange-500/20",
  Resolved:    "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
  Closed:      "bg-slate-500/10 text-slate-400 border border-slate-500/20",
};

function StatusBadge({ status, t }) {
  const map = {
    active:    { label: t.rdStatusActive,    cls: 'rs-badge rs-badge-active' },
    suspended: { label: t.rdStatusSuspended, cls: 'rs-badge rs-badge-suspended' },
    pending:   { label: t.rdStatusPending,   cls: 'rs-badge rs-badge-pending' },
  };
  const { label, cls } = map[status] || { label: status, cls: 'rs-badge rs-badge-active' };
  return <span className={cls}>{label}</span>;
}

/* ── AddClientModal ──────────────────────────────────────────── */
function AddClientModal({ resellerId, onClose, onSuccess, t }) {
  const { user } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', phone: '', owner_name: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [inviteLink, setInviteLink] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email) { setError(t.rdModalErrRequired); return; }
    setLoading(true); setError('');
    try {
      const trialExpiry = new Date();
      trialExpiry.setDate(trialExpiry.getDate() + 35);
      const { data: newCompany, error: err } = await supabase.from('companies').insert({
        name: form.name, phone: form.phone,
        owner_id: user?.id, reseller_id: resellerId, status: 'active',
        restriction_level: 'none', plan: 'Pro',
        subscription_amount: 0,
        subscription_expires_at: trialExpiry.toISOString(),
        subscription_end_date: trialExpiry.toISOString().split('T')[0],
        settings: {
          email: form.email, owner_name: form.owner_name,
          subscription_amount: 0,
          subscription_expires_at: trialExpiry.toISOString(),
          subscription_end_date: trialExpiry.toISOString(),
          trial_end_date: trialExpiry.toISOString()
        }
      }).select('id').single();
      if (err) throw err;
      if (!newCompany?.id) throw new Error(t.errorGeneric);
      const { data: inviteData, error: inviteErr } = await supabase.from('company_invites').insert({
        company_id: newCompany.id, email: form.email, role: 'owner',
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      }).select('token').single();
      if (inviteErr) throw inviteErr;
      setInviteLink(`${window.location.origin}/invite?token=${inviteData.token}`);
      onSuccess();
    } catch (err) {
      setError(err.message || t.errorGeneric);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      toast.success(t.rdInviteLinkCopied || 'تم نسخ رابط دعوة العميل بنجاح!');
    } catch { toast.error(t.errorGeneric); }
  };

  return (
    <div className="rs-modal-overlay" onClick={onClose}>
      <div className="rs-modal" onClick={e => e.stopPropagation()}>
        <div className="rs-modal-header">
          <h3>{inviteLink ? (t.rdModalInviteLinkTitle || 'رابط دعوة العميل') : t.rdModalAddClientTitle}</h3>
          <button onClick={onClose} className="rs-modal-close"><X size={18} /></button>
        </div>
        {inviteLink ? (
          <div className="rs-modal-body space-y-4">
            <p className="text-slate-400 text-sm leading-relaxed">
              {t.rdModalInviteLinkDesc || 'قم بنسخ هذا الرابط وإرساله للعميل ليكمل إعداد حسابه:'}
            </p>
            <div className="flex items-center gap-2 bg-black/30 border border-white/5 p-3 rounded-xl focus-within:border-blue-500/50 transition-all">
              <input type="text" readOnly value={inviteLink}
                className="w-full bg-transparent border-none text-slate-300 text-xs outline-none select-all" dir="ltr" />
              <button onClick={handleCopyLink}
                className="p-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-lg transition-colors cursor-pointer">
                <Copy size={16} />
              </button>
            </div>
            <div className="rs-modal-actions pt-2">
              <button onClick={onClose} className="rs-btn-primary w-full justify-center">
                {t.confirmBtn || 'تأكيد'}
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="rs-modal-body">
            {error && <div className="rs-form-error">{error}</div>}
            <div className="rs-form-row">
              <label>{t.rdModalCompanyNameLabel}</label>
              <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                placeholder={t.rdModalCompanyNamePlaceholder} required />
            </div>
            <div className="rs-form-row">
              <label>{t.rdModalEmailLabel}</label>
              <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                placeholder="company@example.com" required />
            </div>
            <div className="rs-form-row">
              <label>{t.rdModalPhoneLabel}</label>
              <input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                placeholder={t.rdModalPhonePlaceholder} />
            </div>
            <div className="rs-form-row">
              <label>{t.rdModalOwnerLabel}</label>
              <input value={form.owner_name} onChange={e => setForm(p => ({ ...p, owner_name: e.target.value }))}
                placeholder={t.rdModalOwnerPlaceholder} />
            </div>
            <div className="rs-modal-actions">
              <button type="button" onClick={onClose} className="rs-btn-ghost">{t.cancelBtn}</button>
              <button type="submit" className="rs-btn-primary" disabled={loading}>
                {loading ? t.rdModalAddingBtn : t.rdModalConfirmAddBtn}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

/* ── ManageSubscriptionModal ──────────────────────────────────── */
function ManageSubscriptionModal({ company, onClose, onSuccess, t, language }) {
  const [plan, setPlan] = useState(company.plan || 'Free');
  const [amount, setAmount] = useState(company.subscription_amount || 0);
  const [expiryDate, setExpiryDate] = useState(
    company.subscription_expires_at
      ? new Date(company.subscription_expires_at).toISOString().split('T')[0]
      : ''
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const { data: currentCompany } = await supabase.from('companies').select('settings').eq('id', company.id).single();
      const currentSettings = currentCompany?.settings || {};
      const { error: err } = await supabase.from('companies').update({
        plan, subscription_amount: amount,
        subscription_expires_at: expiryDate ? new Date(expiryDate).toISOString() : null,
        subscription_end_date: expiryDate || null,
        settings: {
          ...currentSettings, subscription_amount: amount,
          subscription_expires_at: expiryDate ? new Date(expiryDate).toISOString() : null,
          subscription_end_date: expiryDate ? new Date(expiryDate).toISOString() : null,
          trial_end_date: expiryDate ? new Date(expiryDate).toISOString() : null
        }
      }).eq('id', company.id);
      if (err) throw err;
      toast.success(language === 'ar' ? 'تم تحديث الاشتراك بنجاح' : 'Subscription updated successfully');
      onSuccess(); onClose();
    } catch (err) {
      setError(err.message || t.errorGeneric);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rs-modal-overlay" onClick={onClose}>
      <div className="rs-modal" onClick={e => e.stopPropagation()}>
        <div className="rs-modal-header">
          <h3>{language === 'ar' ? `إدارة اشتراك: ${company.name}` : `Manage: ${company.name}`}</h3>
          <button onClick={onClose} className="rs-modal-close"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="rs-modal-body space-y-4">
          {error && <div className="rs-form-error">{error}</div>}
          <div className="rs-form-row">
            <label>{language === 'ar' ? 'باقة الاشتراك' : 'Subscription Plan'}</label>
            <select value={plan} onChange={e => setPlan(e.target.value)}
              style={{ direction: language === 'ar' ? 'rtl' : 'ltr' }}>
              <option value="Free">Free (مجانية)</option>
              <option value="Pro">Pro (الاحترافية)</option>
              <option value="Enterprise">Enterprise (المؤسسات)</option>
            </select>
          </div>
          <div className="rs-form-row">
            <label>{language === 'ar' ? 'مبلغ الاشتراك (ج.م)' : 'Amount (EGP)'}</label>
            <input type="number" value={amount}
              onChange={e => setAmount(parseFloat(e.target.value) || 0)} placeholder="0" required />
          </div>
          <div className="rs-form-row">
            <label>{language === 'ar' ? 'تاريخ انتهاء الاشتراك' : 'Expiry Date'}</label>
            <input type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)}
              style={{ direction: 'ltr', textAlign: 'center' }} required />
          </div>
          <div className="rs-modal-actions pt-1">
            <button type="button" onClick={onClose} className="rs-btn-ghost" style={{ flex: '0 0 auto', minWidth: '90px' }}>
              {t.cancelBtn || 'إلغاء'}
            </button>
            <button type="submit" className="rs-btn-primary flex-1" disabled={loading}>
              {loading ? (language === 'ar' ? 'جاري الحفظ...' : 'Saving...') : (language === 'ar' ? 'حفظ وتأكيد' : 'Save & Confirm')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════════════════════ */
export default function ResellerDashboard() {
  const { resellerData, user, signOut, activeRole, switchRole, company } = useAuth();
  const { t, language } = useLocale();
  const navigate = useNavigate();
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [activeTab, setActiveTab] = useState('clients');
  const [showRoleMenu, setShowRoleMenu] = useState(false);
  const roleMenuRef = useRef(null);

  /* State */
  const [companies, setCompanies]               = useState([]);
  const [companiesLoading, setCompaniesLoading] = useState(true);
  const [showAddModal, setShowAddModal]         = useState(false);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [subscriptionCompany, setSubscriptionCompany]     = useState(null);
  const [search, setSearch]         = useState('');
  const [filter, setFilter]         = useState('all');
  const [actionLoading, setActionLoading]       = useState(null);

  const [devices, setDevices]               = useState([]);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [pingingId, setPingingId]           = useState(null);
  const [sendingAlertId, setSendingAlertId] = useState(null);
  const [syncingId, setSyncingId]           = useState(null);

  const [tickets, setTickets]               = useState([]);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [replies, setReplies]               = useState([]);
  const [loadingReplies, setLoadingReplies] = useState(false);
  const [replyText, setReplyText]           = useState('');
  const [isSendingReply, setIsSendingReply] = useState(false);
  const [hasMoreReplies, setHasMoreReplies] = useState(false);
  const [loadingOlder, setLoadingOlder]     = useState(false);
  const chatEndRef = useRef(null);

  const resellerId = resellerData?.id;

  /* ─ Fetchers ─ */
  const fetchCompanies = useCallback(async () => {
    if (!resellerId) return;
    setCompaniesLoading(true);
    try {
      const { data, error } = await supabase.from('companies')
        .select('id, name, phone, status, restriction_level, created_at, settings, owner_id, plan, subscription_amount, subscription_expires_at, company_invites(token, email, expires_at, role)')
        .eq('reseller_id', resellerId).order('created_at', { ascending: false });
      if (!error) {
        setCompanies((data || []).map(c => {
          const ownerInvite = Array.isArray(c.company_invites)
            ? c.company_invites.find(inv => inv.role === 'owner')
            : (c.company_invites?.role === 'owner' ? c.company_invites : null);
          return {
            ...c,
            email: c.settings?.email || '',
            owner_name: c.settings?.owner_name || '',
            invite_token: ownerInvite?.token || null,
            invite_expired: ownerInvite ? new Date(ownerInvite.expires_at) < new Date() : false
          };
        }));
      }
    } finally { setCompaniesLoading(false); }
  }, [resellerId]);

  const fetchDevices = useCallback(async () => {
    if (!resellerId) return;
    setLoadingDevices(true);
    try {
      const { data, error } = await supabase.from('devices')
        .select('*, companies!inner(name, reseller_id, sync_service_status(*))')
        .eq('companies.reseller_id', resellerId);
      if (!error) setDevices(data || []);
    } finally { setLoadingDevices(false); }
  }, [resellerId]);

  const fetchTickets = useCallback(async () => {
    if (!resellerId) return;
    setLoadingTickets(true);
    try {
      const { data, error } = await supabase.from('support_tickets')
        .select('*, companies!inner(name, reseller_id)')
        .eq('companies.reseller_id', resellerId)
        .order('created_at', { ascending: false });
      if (!error) setTickets(data || []);
    } finally { setLoadingTickets(false); }
  }, [resellerId]);

  useEffect(() => {
    if (resellerId) { fetchCompanies(); fetchDevices(); fetchTickets(); }
  }, [resellerId, fetchCompanies, fetchDevices, fetchTickets]);

  /* Realtime */
  useEffect(() => {
    if (!resellerId) return;
    const channel = supabase.channel('reseller-tickets-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_tickets' }, () => fetchTickets())
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [resellerId, fetchTickets]);

  useEffect(() => {
    if (!selectedTicket?.id) return;
    const channel = supabase.channel(`reseller-replies-${selectedTicket.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'support_ticket_replies', filter: `ticket_id=eq.${selectedTicket.id}` },
        (payload) => {
          setReplies(prev => prev.some(r => r.id === payload.new.id) ? prev : [...prev, payload.new]);
        })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [selectedTicket?.id]);

  useEffect(() => {
    if (chatEndRef.current && !loadingOlder) chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [replies, loadingOlder]);

  /* ─ Actions ─ */
  const toggleStatus = async (comp) => {
    const newStatus = comp.status === 'active' ? 'suspended' : 'active';
    setActionLoading(comp.id);
    try {
      const { error } = await supabase.from('companies').update({ status: newStatus }).eq('id', comp.id).eq('reseller_id', resellerId);
      if (!error) {
        setCompanies(prev => prev.map(c => c.id === comp.id ? { ...c, status: newStatus } : c));
        toast.success(newStatus === 'active' ? 'تم تفعيل الحساب بنجاح' : 'تم تعليق الحساب بنجاح');
      } else toast.error('فشل في تعديل حالة الحساب.');
    } finally { setActionLoading(null); }
  };

  const handleCopyInviteLink = async (comp) => {
    if (!comp.invite_token) { toast.error(language === 'ar' ? 'لم يتم العثور على رمز الدعوة.' : 'Invite token not found.'); return; }
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/invite?token=${comp.invite_token}`);
      toast.success(t.rdInviteLinkCopied || 'تم نسخ رابط دعوة العميل بنجاح!');
    } catch { toast.error(t.errorGeneric); }
  };

  const handleRegenerateInviteLink = async (comp) => {
    setActionLoading(comp.id);
    try {
      await supabase.from('company_invites').delete().eq('company_id', comp.id).eq('role', 'owner');
      const { error } = await supabase.from('company_invites').insert({
        company_id: comp.id, email: comp.email, role: 'owner',
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      }).select('token').single();
      if (error) throw error;
      toast.success(t.rdInviteRegenerated || 'تم إعادة إنشاء رابط الدعوة بنجاح!');
      fetchCompanies();
    } catch (err) { toast.error(err.message || t.errorGeneric); }
    finally { setActionLoading(null); }
  };

  /* ─ Diagnostics ─ */
  const analyzeDeviceStatus = (device) => {
    const syncData = device.companies?.sync_service_status?.[0] || device.companies?.sync_service_status;
    const now = new Date();
    const lastDeviceSync = device.last_sync ? new Date(device.last_sync) : null;
    const syncDiffMinutes = lastDeviceSync ? (now - lastDeviceSync) / 1000 / 60 : null;
    const isDeviceRecentlySynced = syncDiffMinutes !== null && syncDiffMinutes < 15;
    const lastHeartbeat = syncData ? new Date(syncData.last_heartbeat) : null;
    const diffMinutes = lastHeartbeat ? (now - lastHeartbeat) / 1000 / 60 : null;
    const isSyncOnline = isDeviceRecentlySynced || (diffMinutes !== null && diffMinutes < 5);

    if (!isSyncOnline) {
      if (!syncData && !lastDeviceSync) return {
        code: "NO_SYNC_SERVICE",
        statusText: language === 'ar' ? "برنامج المزامنة غير مثبت أو غير مهيأ" : "Sync service not configured",
        severity: "critical",
        explanation: language === 'ar' ? "لم يتم استقبال أي إشارة من برنامج المزامنة. قد يكون البرنامج غير مثبت على كمبيوتر العميل." : "No signal from sync service. It might not be installed.",
        steps: language === 'ar' ? ["تأكد من تحميل وتثبيت برنامج المزامنة.", "تحقق من كتابة معرف الشركة بشكل سليم.", "تأكد من اتصال الإنترنت."] : ["Download and install the Sync App.", "Verify Company ID is correct.", "Check internet connection."]
      };
      const offlineMinutes = Math.min(syncDiffMinutes !== null ? syncDiffMinutes : Infinity, diffMinutes !== null ? diffMinutes : Infinity);
      if (offlineMinutes > 1440) return {
        code: "SYNC_SERVICE_ABANDONED",
        statusText: language === 'ar' ? "برنامج المزامنة متوقف بالكامل" : "Sync service completely offline",
        severity: "critical",
        explanation: language === 'ar' ? `برنامج المزامنة لم يرسل أي إشارة منذ أكثر من ${Math.round(offlineMinutes / 60)} ساعة.` : `No signals for ${Math.round(offlineMinutes / 60)}h+.`,
        steps: language === 'ar' ? ["تأكد من تشغيل جهاز الكمبيوتر.", "تحقق من أن الخدمة تعمل في الخلفية.", "إعادة تنزيل البرنامج إذا لزم."] : ["Ensure PC is on.", "Verify background service is running.", "Re-install if needed."]
      };
      return {
        code: "SYNC_SERVICE_OFFLINE",
        statusText: language === 'ar' ? "انقطاع اتصال برنامج المزامنة" : "Sync service disconnected",
        severity: "warning",
        explanation: language === 'ar' ? `برنامج المزامنة متوقف منذ ${Math.round(offlineMinutes)} دقيقة.` : `Offline for ${Math.round(offlineMinutes)}m.`,
        steps: language === 'ar' ? ["تحقق من اتصال الإنترنت.", "افتح مدير المهام للتأكد.", "أعد تشغيل البرنامج المحلي."] : ["Check internet.", "Open Task Manager to verify.", "Restart Sync App."]
      };
    }
    const isDevicePingOk = (syncData?.device_ping_status) || isDeviceRecentlySynced || device.status === 'connected';
    if (!isDevicePingOk) return {
      code: "DEVICE_PING_FAILED",
      statusText: language === 'ar' ? "البصمة غير متصلة بالشبكة المحلية" : "Fingerprint device offline locally",
      severity: "critical",
      explanation: syncData?.last_error_message
        ? (language === 'ar' ? `خطأ: ${syncData.last_error_message}` : `Error: ${syncData.last_error_message}`)
        : (language === 'ar' ? "برنامج المزامنة يعمل لكنه لا يستطيع الوصول لجهاز البصمة." : "Sync online but can't reach device locally."),
      steps: language === 'ar' ? [`تأكد أن جهاز البصمة مضاء ومتصل بالشبكة.`, `تحقق من الآي بي: ${device.ip_address || "192.168.1.201"}`, "تأكد أن الجهاز والكمبيوتر على نفس الشبكة."] : ["Ensure device is on and connected.", `Verify IP: ${device.ip_address || "192.168.1.201"}`, "Check same subnet/router."]
    };
    return {
      code: "OK",
      statusText: language === 'ar' ? "الجهاز متصل ويعمل بشكل ممتاز" : "Device connected & working",
      severity: "success",
      explanation: language === 'ar' ? "برنامج المزامنة متصل ويمزامن الحركات فورياً." : "Sync service online and syncing in real-time.",
      steps: []
    };
  };

  const handlePing = async (device) => {
    setPingingId(device.id);
    try {
      toast.info(`جاري تحديث تقرير تشخيص الجهاز "${device.device_name}"...`);
      await new Promise(r => setTimeout(r, 800));
      await fetchDevices();
      toast.success('تم جلب تقرير الحالة بنجاح.');
    } catch { toast.error("فشل في تحديث حالة التقرير."); }
    finally { setPingingId(null); }
  };

  const handleSendAlert = async (device) => {
    setSendingAlertId(device.id);
    try {
      const { error } = await supabase.from("company_notifications").insert([{
        company_id: device.company_id,
        title: language === 'ar' ? "تنبيه من الموزع: انقطاع اتصال جهاز البصمة" : "Reseller Alert: Fingerprint Disconnect",
        message: language === 'ar' ? `جهاز البصمة "${device.device_name}" قد فقد اتصاله. يرجى التحقق من اتصال الإنترنت.` : `Device "${device.device_name}" appears offline. Check power and network.`,
        type: "warning", send_email: true
      }]);
      if (error) throw error;
      toast.success(`تم إرسال تنبيه انقطاع الاتصال إلى شركة "${device.companies?.name}" بنجاح.`);
    } catch { toast.error("فشل في إرسال التنبيه للشركة."); }
    finally { setSendingAlertId(null); }
  };

  const handleForceSync = async (device) => {
    setSyncingId(device.id);
    try {
      const { error } = await supabase.from("sync_service_status").upsert({ company_id: device.company_id, force_full_sync: true });
      if (error) throw error;
      toast.success(`تم إرسال أمر المزامنة الكاملة لجهاز "${device.device_name}" بنجاح.`);
      fetchDevices();
    } catch { toast.error("فشل إرسال أمر المزامنة."); }
    finally { setSyncingId(null); }
  };

  /* ─ Support Chat ─ */
  const fetchReplies = async (ticketId, isLoadMore = false) => {
    if (isLoadMore) setLoadingOlder(true); else setLoadingReplies(true);
    try {
      const fromRange = isLoadMore ? replies.length : 0;
      const { data, error } = await supabase.from("support_ticket_replies")
        .select("*").eq("ticket_id", ticketId)
        .order("created_at", { ascending: false }).range(fromRange, fromRange + 29);
      if (error) throw error;
      const newReplies = data ? [...data].reverse() : [];
      setHasMoreReplies(newReplies.length === 30);
      if (isLoadMore) setReplies(prev => [...newReplies, ...prev]);
      else setReplies(newReplies);
    } catch (err) { toast.error(t.rdChatNoReplies); }
    finally { setLoadingReplies(false); setLoadingOlder(false); }
  };

  const selectTicketAndChat = async (ticket) => {
    setSelectedTicket(ticket); setReplies([]);
    await fetchReplies(ticket.id, false);
  };

  const handleStatusChange = async (nextStatus) => {
    if (!selectedTicket) return;
    try {
      const { error } = await supabase.from("support_tickets").update({ status: nextStatus }).eq("id", selectedTicket.id);
      if (error) throw error;
      toast.success(`تم تحديث حالة التذكرة: ${nextStatus}`);
      setSelectedTicket(p => ({ ...p, status: nextStatus }));
      fetchTickets();
    } catch { toast.error("فشل في تحديث حالة التذكرة."); }
  };

  const handlePriorityChange = async (nextPriority) => {
    if (!selectedTicket) return;
    try {
      const { error } = await supabase.from("support_tickets").update({ priority: nextPriority }).eq("id", selectedTicket.id);
      if (error) throw error;
      toast.success(`تم تحديث الأولوية: ${nextPriority}`);
      setSelectedTicket(p => ({ ...p, priority: nextPriority }));
      fetchTickets();
    } catch { toast.error("فشل في تحديث الأولوية."); }
  };

  const sendReply = async () => {
    if (!replyText.trim() || !selectedTicket) return;
    const originalText = replyText;
    const tempId = `temp-${Date.now()}`;
    const newReplyOptimistic = {
      id: tempId, ticket_id: selectedTicket.id, sender_type: "admin",
      sender_name: resellerData?.name || "الموزع", message: originalText.trim(),
      created_at: new Date().toISOString(), isOptimistic: true,
    };
    setReplies(prev => [...prev, newReplyOptimistic]);
    setReplyText(""); setIsSendingReply(true);
    try {
      const { data, error } = await supabase.from("support_ticket_replies").insert([{
        ticket_id: selectedTicket.id, sender_type: "admin",
        sender_name: resellerData?.name || "الموزع", message: originalText.trim(),
      }]).select();
      if (error) throw error;
      if (data?.length > 0) setReplies(prev => prev.map(r => r.id === tempId ? data[0] : r));
      else setReplies(prev => prev.map(r => r.id === tempId ? { ...newReplyOptimistic, isOptimistic: false } : r));
      toast.success(t.rdChatSendSuccess);
      if (selectedTicket.status === "Open") await handleStatusChange("In Progress");
    } catch (err) {
      toast.error(t.rdChatSendError);
      setReplies(prev => prev.filter(r => r.id !== tempId));
      setReplyText(originalText);
    } finally { setIsSendingReply(false); }
  };

  /* ─ Derived ─ */
  const stats = {
    totalClients:   companies.length,
    activeClients:  companies.filter(c => c.status === 'active').length,
    totalDevices:   devices.length,
    criticalDevices: devices.filter(d => analyzeDeviceStatus(d).severity === 'critical').length,
    openTickets:    tickets.filter(t => t.status === 'Open').length,
    activeChats:    tickets.filter(t => t.status === 'In Progress').length,
  };

  const filterOptions = [
    { key: 'all',       label: t.rdFilterAll },
    { key: 'active',    label: t.rdFilterActive },
    { key: 'suspended', label: t.rdFilterSuspended },
  ];

  const filteredCompanies = companies.filter(c => {
    const matchSearch = !search || c.name?.toLowerCase().includes(search.toLowerCase()) || c.email?.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'all' || c.status === filter;
    return matchSearch && matchFilter;
  });

  const tabTitles = {
    clients:     { title: t.rdTabClients || 'إدارة العملاء',      sub: `${stats.totalClients} شركة مسجلة` },
    diagnostics: { title: t.rdTabDiagnostics || 'تشخيص الأجهزة', sub: `${stats.criticalDevices} جهاز يحتاج اهتماماً` },
    support:     { title: t.rdTabSupport || 'الدعم الفني',         sub: `${stats.openTickets} تذكرة مفتوحة` },
  };

  /* ─ Render ─ */
  return (
    <div className="rs-layout" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* Sidebar */}
      <ResellerSidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        stats={stats}
        resellerData={resellerData}
        user={user}
        onAccountSettings={() => setShowAccountModal(true)}
      />

      {/* Main Content */}
      <div className="rs-content">
        {/* Header */}
        <header className="rs-header">
          <div className="rs-header-title">
            <h1>{tabTitles[activeTab]?.title}</h1>
            <p>{tabTitles[activeTab]?.sub}</p>
          </div>

          <div className="rs-header-spacer" />

          {/* Tab Switcher */}
          <div className="rs-tab-group">
            <button className={`rs-tab-btn ${activeTab === 'clients' ? 'active' : ''}`} onClick={() => setActiveTab('clients')}>
              <Building2 size={15} />
              <span>{t.rdTabClients}</span>
            </button>
            <button className={`rs-tab-btn ${activeTab === 'diagnostics' ? 'active' : ''}`} onClick={() => setActiveTab('diagnostics')}>
              <HardDrive size={15} />
              <span>{t.rdTabDiagnostics}</span>
              {stats.criticalDevices > 0 && <span className="rs-tab-badge danger animate-pulse">{stats.criticalDevices}</span>}
            </button>
            <button className={`rs-tab-btn ${activeTab === 'support' ? 'active' : ''}`} onClick={() => setActiveTab('support')}>
              <MessageSquare size={15} />
              <span>{t.rdTabSupport}</span>
              {stats.openTickets > 0 && <span className="rs-tab-badge info">{stats.openTickets}</span>}
            </button>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button className="rs-hdr-btn" title={t.rdReloadBtn} onClick={() => { fetchCompanies(); fetchDevices(); fetchTickets(); }}>
              <RefreshCw size={16} />
            </button>
            {/* Role switcher */}
            <div className="relative" ref={roleMenuRef}>
              <button
                className="rs-role-btn"
                onClick={() => setShowRoleMenu(!showRoleMenu)}
              >
                <span className="text-xs">{resellerData?.name || 'الموزع'}</span>
                <ChevronDown size={14} className={`transition-transform ${showRoleMenu ? 'rotate-180' : ''}`} />
              </button>
              {showRoleMenu && (
                <div className="rs-role-menu">
                  <button className="rs-role-menu-item"
                    onClick={() => { setShowRoleMenu(false); setShowAccountModal(true); }}>
                    <Settings size={15} /> {t.rdAccountSettings}
                  </button>
                  {company && (
                    <>
                      <div className="rs-role-divider" />
                      <button className={`rs-role-menu-item ${activeRole === 'org_admin' ? 'active' : ''}`}
                        onClick={() => { switchRole('org_admin'); setShowRoleMenu(false); navigate('/dashboard'); }}>
                        <Building2 size={15} /> {t.rdCompanyAccount}
                      </button>
                      <button className={`rs-role-menu-item ${activeRole === 'reseller' ? 'active' : ''}`}
                        onClick={() => { switchRole('reseller'); setShowRoleMenu(false); navigate('/dashboard'); }}>
                        <Settings size={15} /> {t.rdResellerAccount}
                      </button>
                    </>
                  )}
                  <div className="rs-role-divider" />
                  <button className="rs-role-menu-item danger"
                    onClick={signOut}>
                    <LogOut size={15} /> {t.rdSignOutBtn || 'تسجيل الخروج'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="rs-main">
          {/* Welcome */}
          <div className="rs-page-head">
            <div>
              <h1>{t.rdWelcomeMsg?.replace('{name}', resellerData?.name || t.rdDefaultWelcomeName)}</h1>
              <p>{t.rdWelcomeSubtitle}</p>
            </div>
            {activeTab === 'clients' && (
              <button className="rs-btn-primary" onClick={() => setShowAddModal(true)}>
                <Plus size={17} />
                {t.rdAddClientBtn}
              </button>
            )}
          </div>

          {/* Stats */}
          <div className="rs-stats-grid">
            <div className="rs-stat-card primary">
              <div className="rs-stat-icon"><Building2 size={22} /></div>
              <div>
                <div className="rs-stat-value">{companiesLoading ? '–' : stats.totalClients}</div>
                <div className="rs-stat-label">{t.rdStatTotalClients}</div>
              </div>
            </div>
            <div className="rs-stat-card success">
              <div className="rs-stat-icon"><CheckCircle2 size={22} /></div>
              <div>
                <div className="rs-stat-value">{companiesLoading ? '–' : stats.activeClients}</div>
                <div className="rs-stat-label">{t.rdStatActiveAccounts}</div>
              </div>
            </div>
            <div className="rs-stat-card warning">
              <div className="rs-stat-icon"><HardDrive size={22} /></div>
              <div>
                <div className="rs-stat-value">{loadingDevices ? '–' : stats.totalDevices}</div>
                <div className="rs-stat-label">{t.rdStatTotalDevices}</div>
              </div>
            </div>
            <div className="rs-stat-card danger">
              <div className="rs-stat-icon"><AlertTriangle size={22} /></div>
              <div>
                <div className="rs-stat-value">{loadingDevices ? '–' : stats.criticalDevices}</div>
                <div className="rs-stat-label">{t.rdStatCriticalDevices}</div>
              </div>
            </div>
          </div>

          {/* Tab Content */}
          <AnimatePresence mode="wait">
            {/* ── Clients ── */}
            {activeTab === 'clients' && (
              <motion.div key="clients" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} className="rs-section">
                <div className="rs-section-header">
                  <h2>{t.rdClientListTitle}</h2>
                  <div className="rs-filters">
                    <input className="rs-search" placeholder={t.rdSearchPlaceholder} value={search} onChange={e => setSearch(e.target.value)} />
                    <div className="rs-filter-tabs">
                      {filterOptions.map(f => (
                        <button key={f.key} className={`rs-filter-tab ${filter === f.key ? 'active' : ''}`} onClick={() => setFilter(f.key)}>
                          {f.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {companiesLoading ? (
                  <div className="rs-loading"><div className="rs-spinner" /><p className="rs-muted mt-3">{t.rdLoading}</p></div>
                ) : filteredCompanies.length === 0 ? (
                  <div className="rs-empty">
                    <div className="rs-empty-icon">🏢</div>
                    <h3>{t.rdEmptyTitle}</h3>
                    <p>{t.rdEmptyDesc}</p>
                    <button className="rs-btn-primary" onClick={() => setShowAddModal(true)}>
                      <Plus size={15} />{t.rdAddClientShort}
                    </button>
                  </div>
                ) : (
                  <div className="rs-table-wrap">
                    <table className="rs-table">
                      <thead>
                        <tr>
                          <th>{t.rdThCompanyName}</th>
                          <th>{t.rdThEmail}</th>
                          <th>{t.rdThManager}</th>
                          <th>{language === 'ar' ? 'الباقة والاشتراك' : 'Plan & Subscription'}</th>
                          <th>{t.rdThStatus}</th>
                          <th>{t.rdThJoinDate}</th>
                          <th>{t.rdThActions}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredCompanies.map(comp => (
                          <tr key={comp.id} className={`rs-row ${comp.status === 'suspended' ? 'suspended' : ''}`}>
                            <td>
                              <div className="rs-company-cell">
                                <div className="rs-company-avatar">{(comp.name || 'S').charAt(0)}</div>
                                <div>
                                  <div className="rs-company-name">{comp.name}</div>
                                  {comp.phone && <div className="rs-company-phone">{comp.phone}</div>}
                                </div>
                              </div>
                            </td>
                            <td className="rs-muted">{comp.email || '—'}</td>
                            <td className="rs-muted">{comp.owner_name || '—'}</td>
                            <td>
                              <div className="flex flex-col gap-1">
                                <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold w-fit ${
                                  comp.plan === 'Pro' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                                  : comp.plan === 'Enterprise' ? 'bg-violet-500/10 text-violet-400 border border-violet-500/20'
                                  : 'bg-slate-500/10 text-slate-400 border border-slate-500/20'
                                }`}>{comp.plan || 'Free'}</span>
                                {comp.subscription_expires_at && (
                                  <span className="text-[10px] text-slate-400 font-semibold">
                                    {language === 'ar' ? 'تنتهي: ' : 'Exp: '}
                                    {new Date(comp.subscription_expires_at).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US')}
                                  </span>
                                )}
                                {comp.subscription_amount !== undefined && (
                                  <span className="text-[10px] text-emerald-400 font-bold">
                                    {comp.subscription_amount} {language === 'ar' ? 'ج.م' : 'EGP'}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td>
                              {comp.owner_id === user?.id
                                ? <span className="rs-badge rs-badge-pending">{t.rdStatusPendingInvite || 'في انتظار التسجيل'}</span>
                                : <StatusBadge status={comp.status} t={t} />
                              }
                            </td>
                            <td className="rs-muted">{new Date(comp.created_at).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US')}</td>
                            <td>
                              <div className="rs-actions">
                                {comp.owner_id === user?.id ? (
                                  <>
                                    <button className="rs-action-btn success" onClick={() => handleCopyInviteLink(comp)} title={t.rdCopyInviteLink}>
                                      <Copy size={13} /><span>{t.rdCopyInviteLink}</span>
                                    </button>
                                    <button className="rs-action-btn warn" onClick={() => handleRegenerateInviteLink(comp)}
                                      disabled={actionLoading === comp.id} title={t.rdBtnRegenerateInvite}>
                                      <RefreshCw size={13} className={actionLoading === comp.id ? 'animate-spin' : ''} />
                                      <span>{t.rdBtnRegenerateInvite}</span>
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button className="rs-action-btn primary-btn"
                                      onClick={() => { setSubscriptionCompany(comp); setShowSubscriptionModal(true); }}>
                                      <Calendar size={13} /><span>{language === 'ar' ? 'الاشتراك' : 'Subscribe'}</span>
                                    </button>
                                    <button className={`rs-action-btn ${comp.status === 'active' ? 'warn' : 'success'}`}
                                      onClick={() => toggleStatus(comp)} disabled={actionLoading === comp.id}>
                                      {actionLoading === comp.id ? '...' : <AlertTriangle size={13} />}
                                      {comp.status === 'active' ? t.rdActionSuspend : t.rdActionActivate}
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </motion.div>
            )}

            {/* ── Diagnostics ── */}
            {activeTab === 'diagnostics' && (
              <motion.div key="diagnostics" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} className="rs-section p-6 space-y-6">
                <div className="flex justify-between items-center border-b border-white/5 pb-4">
                  <div>
                    <h2 className="text-lg font-bold text-white">{t.rdTabDiagnostics}</h2>
                    <p className="text-slate-400 text-xs mt-1">{language === 'ar' ? 'اكتشف وأصلح أخطاء أجهزة البصمة والمزامنة لعملائك' : 'Discover and resolve device & sync issues for clients'}</p>
                  </div>
                  <button className="rs-btn-ghost text-xs py-2 px-3" onClick={fetchDevices} disabled={loadingDevices}>
                    <RefreshCw size={13} className={loadingDevices ? "animate-spin" : ""} />{t.rdReloadBtn}
                  </button>
                </div>
                {loadingDevices ? (
                  <div className="rs-loading"><div className="rs-spinner" /><p className="rs-muted mt-3">{t.rdLoading}</p></div>
                ) : devices.length === 0 ? (
                  <div className="rs-empty"><div className="rs-empty-icon">🔌</div><h3>{t.rdNoDevicesMessage}</h3></div>
                ) : (
                  <div className="grid grid-cols-1 gap-5">
                    {devices.map(device => {
                      const diagnosis = analyzeDeviceStatus(device);
                      const isCritical = diagnosis.severity === 'critical';
                      const isWarning  = diagnosis.severity === 'warning';
                      return (
                        <div key={device.id} className={`rs-device-card border ${isCritical ? 'border-rose-500/20 bg-rose-500/5' : isWarning ? 'border-amber-500/20 bg-amber-500/5' : 'border-white/5 bg-slate-900/40'} rounded-2xl p-5 flex flex-col md:flex-row gap-5 justify-between items-start`}>
                          <div className="space-y-3 flex-1">
                            <div className="flex items-center gap-3 flex-wrap">
                              <span className="px-2.5 py-0.5 rounded-lg bg-blue-600/10 text-blue-400 border border-blue-600/20 text-xs font-bold">{device.companies?.name}</span>
                              <h3 className="font-bold text-slate-100 text-[0.95rem]">{device.device_name}</h3>
                              <span className={`px-2 py-0.5 rounded-full text-[0.7rem] font-bold ${isCritical ? 'bg-rose-500/20 text-rose-400' : isWarning ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                                {diagnosis.statusText}
                              </span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-400">
                              <div className="flex items-center gap-1.5"><Calendar size={12} /><span>{t.rdThSerialNumber}: <span className="font-semibold text-slate-300">{device.serial_number || '—'}</span></span></div>
                              <div className="flex items-center gap-1.5"><HardDrive size={12} /><span>IP: <span className="font-semibold text-slate-300">{device.ip_address || '—'}</span></span></div>
                              <div className="flex items-center gap-1.5"><Clock size={12} /><span>{t.rdThLastSync}: <span className="font-semibold text-slate-300">{device.last_sync ? new Date(device.last_sync).toLocaleString() : '—'}</span></span></div>
                            </div>
                            {(isCritical || isWarning) && (
                              <div className="bg-black/30 border border-white/5 rounded-xl p-4 space-y-2.5">
                                <div className="flex items-start gap-2 text-xs text-slate-300 leading-relaxed">
                                  <AlertTriangle size={14} className={`${isCritical ? 'text-rose-400' : 'text-amber-400'} flex-shrink-0 mt-0.5`} />
                                  <div><span className="font-bold text-slate-200">{language === 'ar' ? 'التشخيص:' : 'Diagnosis:'}</span> {diagnosis.explanation}</div>
                                </div>
                                {diagnosis.steps.length > 0 && (
                                  <div className="space-y-1 pt-1.5 border-t border-white/5">
                                    <div className="text-[0.72rem] font-bold text-slate-300">{t.rdTroubleshootingSteps}:</div>
                                    <ul className="list-disc list-inside text-[0.7rem] text-slate-400 space-y-1">
                                      {diagnosis.steps.map((step, idx) => <li key={idx}>{step}</li>)}
                                    </ul>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="flex md:flex-col gap-2 w-full md:w-auto justify-end flex-shrink-0">
                            <button onClick={() => handlePing(device)} disabled={pingingId === device.id}
                              className="flex-1 md:flex-none py-2 px-3.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 border border-white/5">
                              {pingingId === device.id ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                              <span>{language === 'ar' ? 'فحص الاتصال' : 'Check Ping'}</span>
                            </button>
                            <button onClick={() => handleForceSync(device)} disabled={syncingId === device.id}
                              className="flex-1 md:flex-none py-2 px-3.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-blue-600/10">
                              {syncingId === device.id ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                              <span>{t.rdActionForceSync}</span>
                            </button>
                            {(isCritical || isWarning) && (
                              <button onClick={() => handleSendAlert(device)} disabled={sendingAlertId === device.id}
                                className="flex-1 md:flex-none py-2 px-3.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-amber-600/10">
                                {sendingAlertId === device.id ? <Loader2 size={13} className="animate-spin" /> : <AlertTriangle size={13} />}
                                <span>{t.rdActionSendAlert}</span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            )}

            {/* ── Support ── */}
            {activeTab === 'support' && (
              <motion.div key="support" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} className="rs-section p-6 space-y-5">
                <div>
                  <h2 className="text-lg font-bold text-white">{t.rdSupportTicketsHeader}</h2>
                  <p className="text-slate-400 text-xs mt-1">{language === 'ar' ? 'شاهد طلبات الدعم وتحدث مباشرة مع عملائك' : 'View support requests and chat with clients'}</p>
                </div>
                {loadingTickets ? (
                  <div className="rs-loading"><div className="rs-spinner" /><p className="rs-muted mt-3">{t.rdLoading}</p></div>
                ) : (
                  <div className="flex flex-col lg:flex-row gap-5 min-h-[500px]">
                    {/* Tickets list */}
                    <div className="w-full lg:w-1/3 border border-white/5 rounded-2xl bg-slate-900/40 p-3.5 space-y-2.5 overflow-y-auto max-h-[600px] rs-scrollbar">
                      {tickets.length === 0 ? (
                        <div className="text-center py-12 text-slate-500">
                          <MessageSquare size={36} className="mx-auto mb-2 opacity-25" />
                          <p className="text-xs font-bold">{t.rdNoTicketsMessage}</p>
                        </div>
                      ) : tickets.map(ticket => (
                        <div key={ticket.id} onClick={() => selectTicketAndChat(ticket)}
                          className={`p-3.5 rounded-xl border cursor-pointer transition-all ${selectedTicket?.id === ticket.id ? 'bg-blue-600/10 border-blue-500/50 shadow-md shadow-blue-500/5' : 'bg-slate-800/40 border-white/5 hover:border-white/10 hover:bg-slate-800/80'}`}>
                          <div className="flex justify-between items-start mb-2">
                            <span className="text-[0.68rem] px-2 py-0.5 rounded-md bg-white/5 text-slate-300 font-semibold truncate max-w-[120px]">{ticket.companies?.name}</span>
                            <span className={`text-[0.6rem] px-2 py-0.5 rounded-full font-bold ${statusStyle[ticket.status]}`}>{ticket.status}</span>
                          </div>
                          <h4 className="font-bold text-slate-200 text-sm mb-2 truncate">{ticket.subject}</h4>
                          <div className="flex justify-between items-center text-[0.68rem] text-slate-500">
                            <span className="flex items-center gap-1"><Clock size={11} />{new Date(ticket.created_at).toLocaleDateString()}</span>
                            <span className={`px-1.5 py-0.5 rounded text-[0.65rem] font-bold ${priorityStyle[ticket.priority]}`}>{ticket.priority}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                    {/* Chat */}
                    <div className="flex-1 border border-white/5 rounded-2xl bg-slate-900/40 flex flex-col overflow-hidden h-[600px]">
                      {selectedTicket ? (
                        <>
                          <div className="p-4 border-b border-white/5 bg-slate-800/40 flex justify-between items-center flex-wrap gap-3">
                            <div>
                              <h3 className="font-bold text-sm text-slate-100 truncate max-w-xs">{selectedTicket.subject}</h3>
                              <p className="text-xs text-slate-400 mt-0.5">{t.rdChatClientLabel} <span className="font-bold text-blue-400">{selectedTicket.companies?.name}</span></p>
                            </div>
                            <div className="flex items-center gap-2">
                              <select value={selectedTicket.status} onChange={e => handleStatusChange(e.target.value)}
                                className="bg-slate-800 border border-white/5 text-slate-200 text-xs px-2 py-1 rounded-xl outline-none font-bold cursor-pointer">
                                {["Open","In Progress","Resolved","Closed"].map(s => <option key={s} value={s}>{s}</option>)}
                              </select>
                              <select value={selectedTicket.priority} onChange={e => handlePriorityChange(e.target.value)}
                                className="bg-slate-800 border border-white/5 text-slate-200 text-xs px-2 py-1 rounded-xl outline-none font-bold cursor-pointer">
                                {["Low","Medium","High","Critical"].map(p => <option key={p} value={p}>{p}</option>)}
                              </select>
                            </div>
                          </div>
                          <div className="p-4 bg-blue-600/5 border-b border-white/5 text-xs text-slate-300 leading-relaxed max-h-[80px] overflow-y-auto">
                            <span className="font-bold text-slate-200 block mb-1">{language === 'ar' ? 'الوصف:' : 'Description:'}</span>
                            {selectedTicket.description || (language === 'ar' ? 'لا يوجد وصف.' : 'No description.')}
                          </div>
                          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-950/20 rs-scrollbar">
                            {loadingReplies ? (
                              <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-blue-500" /></div>
                            ) : (
                              <>
                                {hasMoreReplies && (
                                  <div className="flex justify-center mb-3">
                                    <button onClick={() => fetchReplies(selectedTicket.id, true)} disabled={loadingOlder}
                                      className="text-xs px-3 py-1.5 bg-slate-800 border border-white/5 hover:bg-slate-700 text-slate-200 font-bold rounded-xl transition-all disabled:opacity-50 flex items-center gap-1.5">
                                      {loadingOlder ? <Loader2 size={11} className="animate-spin" /> : null}
                                      {language === 'ar' ? 'تحميل الرسائل السابقة' : 'Load older'}
                                    </button>
                                  </div>
                                )}
                                {replies.length === 0 && (
                                  <div className="text-center py-12 text-slate-500">
                                    <MessageSquare size={34} className="mx-auto mb-2 opacity-25" />
                                    <p className="text-xs font-semibold">{t.rdChatNoReplies}</p>
                                  </div>
                                )}
                                {replies.map(reply => {
                                  const isClient = reply.sender_type === "customer";
                                  return (
                                    <div key={reply.id} className={`flex ${isClient ? 'justify-start' : 'justify-end'}`}>
                                      <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-xs leading-relaxed shadow-sm ${isClient ? 'bg-slate-800 text-slate-200 rounded-tl-none border border-white/5' : 'bg-blue-600 text-white rounded-tr-none'}`}
                                        style={{ opacity: reply.isOptimistic ? 0.7 : 1 }}>
                                        <div className={`flex items-center gap-1.5 mb-1.5 text-[10px] font-bold ${isClient ? 'text-slate-400' : 'text-blue-200'}`}>
                                          <span>{isClient ? reply.sender_name : (language === 'ar' ? 'الدعم الفني (أنت)' : 'Support (You)')}</span>
                                          <span>•</span>
                                          {reply.isOptimistic ? <span>...</span> : <span>{reply.created_at ? new Date(reply.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ""}</span>}
                                        </div>
                                        <p className="whitespace-pre-wrap font-medium">{reply.message}</p>
                                      </div>
                                    </div>
                                  );
                                })}
                                <div ref={chatEndRef} />
                              </>
                            )}
                          </div>
                          <div className="p-3.5 bg-slate-800/40 border-t border-white/5 flex gap-2 items-end">
                            <textarea value={replyText} onChange={e => setReplyText(e.target.value)}
                              placeholder={t.rdChatWriteReplyPlaceholder} rows={1}
                              className="flex-1 bg-slate-900 border border-white/5 rounded-xl px-3.5 py-2.5 text-xs outline-none focus:border-blue-500/50 resize-none max-h-32 text-slate-200 placeholder:text-slate-500 font-medium"
                              style={{ minHeight: "42px" }}
                              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendReply(); } }} />
                            <button onClick={sendReply} disabled={isSendingReply || !replyText.trim()}
                              className="w-11 h-11 bg-blue-600 hover:bg-blue-500 text-white rounded-xl flex items-center justify-center transition-colors shadow-lg shadow-blue-600/10 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0">
                              {isSendingReply ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} className={language === 'ar' ? "rotate-180" : ""} />}
                            </button>
                          </div>
                        </>
                      ) : (
                        <div className="flex-1 flex flex-col justify-center items-center text-slate-500 p-6">
                          <MessageSquare size={44} className="opacity-15 mb-3" />
                          <h4 className="font-bold text-slate-300 text-sm">{language === 'ar' ? 'الدردشة الحية مع العميل' : 'Live Chat Console'}</h4>
                          <p className="text-xs text-slate-400 mt-1 text-center max-w-xs leading-relaxed">
                            {language === 'ar' ? 'حدد تذكرة دعم من القائمة الجانبية للبدء في مراسلة العميل.' : 'Select a ticket to start chatting.'}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>

      {/* Modals */}
      {showAddModal && (
        <AddClientModal resellerId={resellerId} t={t} onClose={() => setShowAddModal(false)} onSuccess={fetchCompanies} />
      )}
      {showSubscriptionModal && subscriptionCompany && (
        <ManageSubscriptionModal company={subscriptionCompany} t={t} language={language}
          onClose={() => { setShowSubscriptionModal(false); setSubscriptionCompany(null); }}
          onSuccess={fetchCompanies} />
      )}
      {showAccountModal && <AccountSettingsModal onClose={() => setShowAccountModal(false)} />}
    </div>
  );
}
