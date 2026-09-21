import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  MessageSquare, Key, Plus, Trash2, Copy, Check, Code2,
  Terminal, Send, RefreshCw, Eye, EyeOff, Smartphone,
  Building2, Loader2, Radio, Search, Network, Server,
  Activity, ShieldCheck, Zap, RefreshCcw, Shield, ChevronDown,
  Laptop, Cpu, Info, ShieldAlert, Clock, CheckCircle2,
  AlertCircle, MessageSquareText, ChevronLeft, ExternalLink, Filter, X, CheckCheck
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { supabase } from "../../supabaseClient";
import QRCode from "react-qr-code";
import { useLocale } from "../../context/LocaleContext";

// -----------------------------------------------------------------------------
// High-Contrast Custom Accessible Dropdowns (Enforcing constitution.md Rule 4)
// -----------------------------------------------------------------------------

function ChannelSelectDropdown({ value, onChange, channels, disabled }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedChannel = channels.find((ch) => ch.id === value);
  const isDefault = !value || value === "default";

  return (
    <div className="relative inline-block text-right w-full min-w-[240px]" ref={dropdownRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all border shadow-xs ${
          isDefault
            ? "bg-gray-50 hover:bg-gray-100 text-gray-900 border-gray-300"
            : "bg-emerald-50 hover:bg-emerald-100 text-emerald-950 border-emerald-300"
        } focus:outline-none focus:ring-2 focus:ring-emerald-500`}
      >
        <div className="flex items-center gap-2 truncate">
          <span className="text-sm">{isDefault ? "🌐" : "📲"}</span>
          <span className="truncate font-black text-gray-950">
            {isDefault ? "القناة الافتراضية العامة" : selectedChannel?.name || "قناة مخصصة"}
          </span>
          {selectedChannel?.phone_number && (
            <span className="text-[11px] text-gray-700 font-mono font-bold">
              (+{selectedChannel.phone_number})
            </span>
          )}
        </div>
        <ChevronDown
          className={`w-4 h-4 text-gray-800 transition-transform duration-200 shrink-0 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 mt-1.5 w-full min-w-[260px] bg-white rounded-2xl shadow-xl border border-gray-200 py-1.5 overflow-hidden"
          >
            {/* Default Channel Option */}
            {(() => {
              const defaultCh = channels.find((c) => c.is_default);
              return (
                <button
                  type="button"
                  onClick={() => {
                    onChange("default");
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 text-xs text-right transition-colors ${
                    isDefault
                      ? "bg-slate-100 text-slate-950 font-black"
                      : "text-gray-900 hover:bg-gray-50 font-bold"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm">🌐</span>
                    <div className="text-right">
                      <div className="text-gray-950 font-black">القناة الافتراضية العامة</div>
                      <div className="text-[10px] text-gray-600 font-medium">
                        {defaultCh?.phone_number ? `+${defaultCh.phone_number} (الرقم المركزي المتصل)` : "تستخدم الرقم الافتراضي للنظام"}
                      </div>
                    </div>
                  </div>
                  {isDefault && <Check className="w-4 h-4 text-emerald-600 shrink-0" />}
                </button>
              );
            })()}

            {channels.some((ch) => !ch.is_default) && <div className="my-1 border-t border-gray-100" />}

            {/* Custom Channels List */}
            {channels
              .filter((ch) => !ch.is_default)
              .map((ch) => {
                const isSelected = value === ch.id;
                return (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => {
                      onChange(ch.id);
                      setIsOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 text-xs text-right transition-colors ${
                      isSelected
                        ? "bg-emerald-50 text-emerald-950 font-black"
                        : "text-gray-900 hover:bg-gray-50 font-bold"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm">📲</span>
                      <div className="text-right">
                        <div className="text-gray-950 font-black">{ch.name}</div>
                        <div className="text-[10px] text-gray-600 font-mono font-bold">
                          {ch.phone_number ? `+${ch.phone_number}` : "لم يتم ربط رقم بعد"}
                        </div>
                      </div>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-emerald-600 shrink-0" />}
                  </button>
                );
              })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function FilterDropdown({ value, onChange, channels }) {
  const [isOpen, setIsOpen] = useState(false);
  const filterRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (filterRef.current && !filterRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const labelMap = {
    all: "جميع القنوات",
    unassigned: "القناة الافتراضية فقط"
  };
  const activeLabel =
    labelMap[value] || channels.find((c) => c.id === value)?.name || "جميع القنوات";

  return (
    <div className="relative inline-block text-right" ref={filterRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between gap-2 px-3.5 py-2 rounded-xl text-xs font-black bg-white hover:bg-gray-50 text-gray-950 border border-gray-300 shadow-xs transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500"
      >
        <span className="text-gray-950 font-black">{activeLabel}</span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-gray-800 transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 mt-1.5 left-0 w-48 bg-white rounded-2xl shadow-xl border border-gray-200 py-1.5 overflow-hidden"
          >
            {[
              { id: "all", label: "جميع القنوات" },
              { id: "unassigned", label: "القناة الافتراضية فقط" },
              ...channels.map((ch) => ({ id: ch.id, label: `📲 ${ch.name}` }))
            ].map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  onChange(opt.id);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3.5 py-2 text-xs text-right transition-colors ${
                  value === opt.id
                    ? "bg-emerald-50 text-emerald-950 font-black"
                    : "text-gray-900 hover:bg-gray-50 font-bold"
                }`}
              >
                <span className="text-gray-950 font-bold">{opt.label}</span>
                {value === opt.id && <Check className="w-3.5 h-3.5 text-emerald-600" />}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function WhatsAppGatewayView() {
  const { t = {} } = useLocale() || {};
  const [activeTab, setActiveTab] = useState("channels"); // channels, routing, apikeys, cluster, docs

  // Data States
  const [channels, setChannels] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [apiKeys, setApiKeys] = useState([]);
  const [nodes, setNodes] = useState([]);
  const [clusterLock, setClusterLock] = useState(null);
  const [loading, setLoading] = useState(true);
  const [failingOver, setFailingOver] = useState(false);
  const [serverPingMs, setServerPingMs] = useState(35);

  // Modals & UI States
  const [isChannelModalOpen, setIsChannelModalOpen] = useState(false);
  const [newChannelName, setNewChannelName] = useState("");
  const [newChannelDesc, setNewChannelDesc] = useState("");
  const [newChannelDefault, setNewChannelDefault] = useState(false);
  const [creatingChannel, setCreatingChannel] = useState(false);

  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyChannelId, setNewKeyChannelId] = useState("");
  const [newKeyRateLimit, setNewKeyRateLimit] = useState(60);
  const [creatingKey, setCreatingKey] = useState(false);

  const [visibleKeyId, setVisibleKeyId] = useState(null);
  const [copiedKeyId, setCopiedKeyId] = useState(null);

  // Distributed Node Assignments & Enterprise RAM Policy
  const [nodeAssignments, setNodeAssignments] = useState({});
  const [assigningNode, setAssigningNode] = useState(null);
  const [allowMultiChannel, setAllowMultiChannel] = useState(false);
  const [savingPolicy, setSavingPolicy] = useState(false);
  const [autoDistributing, setAutoDistributing] = useState(false);

  // Queue & Message Log States
  const [queueMessages, setQueueMessages] = useState([]);
  const [queueStats, setQueueStats] = useState({
    all: { total: 0, pending: 0, sent: 0, failed: 0, processing: 0 },
    default: { total: 0, pending: 0, sent: 0, failed: 0, processing: 0 },
  });
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [messageChannelFilter, setMessageChannelFilter] = useState("all");
  const [messageStatusFilter, setMessageStatusFilter] = useState("all");
  const [messageSearchQuery, setMessageSearchQuery] = useState("");
  const [selectedMessageForModal, setSelectedMessageForModal] = useState(null);
  const [retryingMessageId, setRetryingMessageId] = useState(null);
  const [cancellingMessageId, setCancellingMessageId] = useState(null);

  // QR Modal for Specific Channel
  const [qrModalChannel, setQrModalChannel] = useState(null);
  const [refreshingQr, setRefreshingQr] = useState(false);
  const [qrWaitSeconds, setQrWaitSeconds] = useState(0); // ✅ عداد ثواني الانتظار لـ QR

  // Auto-fetch and poll QR code while modal is open
  const fetchChannelQr = useCallback(async (channelId) => {
    if (!channelId) return;
    try {
      const { data, error } = await supabase
        .from("whatsapp_channels")
        .select("*")
        .eq("id", channelId)
        .single();
      if (!error && data) {
        setChannels((prev) => prev.map((c) => (c.id === data.id ? { ...c, ...data } : c)));
        setQrModalChannel((prev) => (prev && prev.id === data.id ? { ...prev, ...data } : prev));
      }
    } catch (err) {
      console.error("Error refreshing QR:", err);
    }
  }, []);

  useEffect(() => {
    if (!qrModalChannel) return;
    setQrWaitSeconds(0); // ✅ إعادة عداد الثواني عند فتح مودال جديد
    fetchChannelQr(qrModalChannel.id);

    // Poll every 2.5 seconds to detect freshly emitted QR codes or successful connection immediately
    const interval = setInterval(() => {
      fetchChannelQr(qrModalChannel.id);
    }, 2500);

    // ✅ عداد ثواني الانتظار لعرض رسالة Timeout بعد 3 دقائق
    const waitTimer = setInterval(() => {
      setQrWaitSeconds((s) => s + 1);
    }, 1000);

    return () => {
      clearInterval(interval);
      clearInterval(waitTimer);
    };
  }, [qrModalChannel?.id, fetchChannelQr]);

  // Dynamically resolve live channel data from channels state or modal state
  const liveQrChannel = qrModalChannel
    ? channels.find((c) => c.id === qrModalChannel.id) || qrModalChannel
    : null;

  // Search & Filter
  const [companySearch, setCompanySearch] = useState("");
  const [companyChannelFilter, setCompanyChannelFilter] = useState("all");

  // API Sandbox States
  const [sandboxKey, setSandboxKey] = useState("");
  const [sandboxPhone, setSandboxPhone] = useState("");
  const [sandboxMessage, setSandboxMessage] = useState("مرحباً! هذه رسالة تجريبية مرسلة عبر بوابة كوادر للواتساب.");
  const [sandboxSending, setSandboxSending] = useState(false);
  const [sandboxResponse, setSandboxResponse] = useState(null);

  // Code snippet language
  const [docLang, setDocLang] = useState("curl"); // curl, js, python, php

  // Fetch all gateway data
  // ✅ إصلاح: إزالة sandboxKey من dependency array لمنع إعادة تهيئة Realtime subscriptions عند تغيير المفتاح
  const sandboxKeyRef = useRef(sandboxKey);
  useEffect(() => { sandboxKeyRef.current = sandboxKey; }, [sandboxKey]);

  const channelsRef = useRef(channels);
  useEffect(() => { channelsRef.current = channels; }, [channels]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const pingStart = performance.now();
    try {
      // 1. Fetch Channels
      const { data: chData, error: chErr } = await supabase
        .from("whatsapp_channels")
        .select("*")
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: true });

      const pingDuration = Math.round(performance.now() - pingStart);
      if (pingDuration > 0) setServerPingMs(pingDuration);

      if (chErr) throw chErr;
      setChannels(chData || []);

      // 2. Fetch Companies
      const { data: compData, error: compErr } = await supabase
        .from("companies")
        .select("id, name, plan, status, phone, whatsapp_channel_id, created_at")
        .order("name", { ascending: true });

      if (compErr) throw compErr;
      setCompanies(compData || []);

      // 3. Fetch API Keys
      const { data: keyData, error: keyErr } = await supabase
        .from("whatsapp_api_keys")
        .select("*, whatsapp_channels(name)")
        .order("created_at", { ascending: false });

      if (keyErr) throw keyErr;
      setApiKeys(keyData || []);

      // 4. Fetch Cluster Nodes
      const { data: nodeData, error: nodeErr } = await supabase
        .from("whatsapp_nodes")
        .select("*")
        .order("is_leader", { ascending: false })
        .order("last_seen", { ascending: false });

      if (!nodeErr) setNodes(nodeData || []);

      // 5. Fetch Node Assignments
      const { data: assignData } = await supabase
        .from("whatsapp_node_assignments")
        .select("*");
      if (assignData) {
        const map = {};
        assignData.forEach((a) => {
          map[a.hostname] = a.target_channel_id;
        });
        setNodeAssignments(map);
      }

      // 6. Fetch Active Cluster Lock
      const { data: lockData } = await supabase
        .from("system_settings")
        .select("value")
        .eq("key", "whatsapp_lock")
        .single();

      const currentLock = lockData?.value || null;
      setClusterLock(currentLock);

      // 7. Fetch Multi-Channel RAM Policy
      const { data: policyData } = await supabase
        .from("system_settings")
        .select("value")
        .eq("key", "whatsapp_allow_multi_channel")
        .maybeSingle();

      setAllowMultiChannel(policyData?.value === true || policyData?.value?.enabled === true);

      // Note: We deliberately do NOT auto-write "connected" to database.
      // WhatsApp authentication state is strictly controlled by the WhatsApp Node service.

      // 8. Fetch WhatsApp Queue Messages & Realtime Telemetry
      const { data: queueData, error: queueErr } = await supabase
        .from("whatsapp_queue")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(300);

      if (!queueErr && queueData) {
        setQueueMessages(queueData);
        const stats = {
          all: { total: 0, pending: 0, sent: 0, failed: 0, processing: 0 },
          default: { total: 0, pending: 0, sent: 0, failed: 0, processing: 0 },
        };
        (chData || []).forEach((c) => {
          stats[c.id] = { total: 0, pending: 0, sent: 0, failed: 0, processing: 0 };
        });
        queueData.forEach((m) => {
          const chKey = m.channel_id || "default";
          if (!stats[chKey]) {
            stats[chKey] = { total: 0, pending: 0, sent: 0, failed: 0, processing: 0 };
          }
          const st = m.status || "pending";
          stats.all.total++;
          stats[chKey].total++;
          if (st === "pending") {
            stats.all.pending++;
            stats[chKey].pending++;
          } else if (st === "sent") {
            stats.all.sent++;
            stats[chKey].sent++;
          } else if (st === "failed") {
            stats.all.failed++;
            stats[chKey].failed++;
          } else if (st === "processing") {
            stats.all.processing++;
            stats[chKey].processing++;
          }
        });
        setQueueStats(stats);
      }

      // ✅ استخدام ref بدل state مباشرة لتجنب إعادة بناء fetchData عند تغيير المفتاح
      if (keyData && keyData.length > 0 && !sandboxKeyRef.current) {
        setSandboxKey(keyData[0].api_key);
      }
    } catch (err) {
      console.error("Error fetching gateway data:", err);
      toast.error("فشل في تحميل بيانات بوابة الواتساب: " + err.message);
    } finally {
      setLoading(false);
    }
  }, []); // ✅ إزالة sandboxKey من deps — الآن fetchData لا يُعاد إنشاؤه عند تغيير المفتاح

  const fetchQueueData = useCallback(async () => {
    setLoadingMessages(true);
    try {
      const { data, error } = await supabase
        .from("whatsapp_queue")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(300);

      if (error) throw error;
      const msgs = data || [];
      setQueueMessages(msgs);

      const stats = {
        all: { total: 0, pending: 0, sent: 0, failed: 0, processing: 0 },
        default: { total: 0, pending: 0, sent: 0, failed: 0, processing: 0 },
      };

      (channelsRef.current || []).forEach((c) => {
        stats[c.id] = { total: 0, pending: 0, sent: 0, failed: 0, processing: 0 };
      });

      msgs.forEach((m) => {
        const chKey = m.channel_id || "default";
        if (!stats[chKey]) {
          stats[chKey] = { total: 0, pending: 0, sent: 0, failed: 0, processing: 0 };
        }
        const st = m.status || "pending";
        stats.all.total++;
        stats[chKey].total++;
        if (st === "pending") {
          stats.all.pending++;
          stats[chKey].pending++;
        } else if (st === "sent") {
          stats.all.sent++;
          stats[chKey].sent++;
        } else if (st === "failed") {
          stats.all.failed++;
          stats[chKey].failed++;
        } else if (st === "processing") {
          stats.all.processing++;
          stats[chKey].processing++;
        }
      });

      setQueueStats(stats);
    } catch (err) {
      console.error("Error refreshing queue data:", err);
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  const handleRetryMessage = async (messageId) => {
    setRetryingMessageId(messageId);
    try {
      const { error } = await supabase
        .from("whatsapp_queue")
        .update({
          status: "pending",
          error: null,
          processed_at: null
        })
        .eq("id", messageId);

      if (error) throw error;
      toast.success("تمت إعادة إدراج الرسالة في طابور الإرسال الفوري ⚡");
      fetchQueueData();
    } catch (err) {
      toast.error("فشل إعادة المحاولة: " + err.message);
    } finally {
      setRetryingMessageId(null);
    }
  };

  const handleCancelMessage = async (messageId) => {
    if (!window.confirm("هل أنت متأكد من إلغاء وحذف هذه الرسالة من طابور الإرسال؟")) return;
    setCancellingMessageId(messageId);
    try {
      const { error } = await supabase
        .from("whatsapp_queue")
        .delete()
        .eq("id", messageId);

      if (error) throw error;
      toast.success("تم حذف الرسالة من الطابور بنجاح");
      fetchQueueData();
    } catch (err) {
      toast.error("فشل حذف الرسالة: " + err.message);
    } finally {
      setCancellingMessageId(null);
    }
  };

  const handleRetryAllFailed = async (targetChannelId = null) => {
    try {
      let query = supabase
        .from("whatsapp_queue")
        .update({
          status: "pending",
          error: null,
          processed_at: null
        })
        .eq("status", "failed");

      if (targetChannelId && targetChannelId !== "all") {
        if (targetChannelId === "default") {
          query = query.is("channel_id", null);
        } else {
          query = query.eq("channel_id", targetChannelId);
        }
      }

      const { error } = await query;
      if (error) throw error;
      toast.success("تمت إعادة جدولة كافة الرسائل المتعثرة للإرسال فوراً ⚡");
      fetchQueueData();
    } catch (err) {
      toast.error("فشل إعادة جدولة الرسائل: " + err.message);
    }
  };

  const filteredQueueMessages = useMemo(() => {
    return queueMessages.filter((msg) => {
      // Channel filter
      if (messageChannelFilter !== "all") {
        if (messageChannelFilter === "default") {
          if (msg.channel_id) return false;
        } else if (msg.channel_id !== messageChannelFilter) {
          return false;
        }
      }

      // Status filter
      if (messageStatusFilter !== "all") {
        if (msg.status !== messageStatusFilter) return false;
      }

      // Search query
      if (messageSearchQuery.trim()) {
        const q = messageSearchQuery.toLowerCase().trim();
        const phoneMatch = msg.phone && msg.phone.toLowerCase().includes(q);
        const textMatch = msg.message && msg.message.toLowerCase().includes(q);
        const nodeMatch = msg.node_id && msg.node_id.toLowerCase().includes(q);
        if (!phoneMatch && !textMatch && !nodeMatch) return false;
      }

      return true;
    });
  }, [queueMessages, messageChannelFilter, messageStatusFilter, messageSearchQuery]);

  useEffect(() => {
    fetchData();

    // Realtime subscriptions for channels, nodes, queue and lock
    const liveChannel = supabase
      .channel("whatsapp-gateway-live-dashboard")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "whatsapp_channels" },
        (payload) => {
          if (payload.eventType === "UPDATE") {
            setChannels((prev) =>
              prev.map((ch) => (ch.id === payload.new.id ? { ...ch, ...payload.new } : ch))
            );
            setQrModalChannel((prev) =>
              prev && prev.id === payload.new.id ? { ...prev, ...payload.new } : prev
            );
          } else {
            fetchData();
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "whatsapp_nodes" },
        () => {
          supabase
            .from("whatsapp_nodes")
            .select("*")
            .order("is_leader", { ascending: false })
            .order("last_seen", { ascending: false })
            .then(({ data }) => {
              if (data) setNodes(data);
            });
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "whatsapp_queue" },
        (payload) => {
          // Incremental prepend — no full refetch of 300 rows
          if (payload.new) {
            setQueueMessages((prev) => {
              if (prev.some((m) => m.id === payload.new.id)) return prev;
              const updated = [payload.new, ...prev].slice(0, 300);
              // Update stats incrementally
              setQueueStats((prevStats) => {
                const newStats = JSON.parse(JSON.stringify(prevStats));
                const chKey = payload.new.channel_id || "default";
                const st = payload.new.status || "pending";
                if (!newStats[chKey]) newStats[chKey] = { total: 0, pending: 0, sent: 0, failed: 0, processing: 0 };
                newStats.all.total++; newStats[chKey].total++;
                if (newStats.all[st] !== undefined) { newStats.all[st]++; newStats[chKey][st]++; }
                return newStats;
              });
              return updated;
            });
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "whatsapp_queue" },
        (payload) => {
          if (payload.new) {
            setQueueMessages((prev) =>
              prev.map((m) => (m.id === payload.new.id ? { ...m, ...payload.new } : m))
            );
            // Update stats: subtract old status, add new status
            if (payload.old?.status !== payload.new?.status) {
              setQueueStats((prevStats) => {
                const newStats = JSON.parse(JSON.stringify(prevStats));
                const chKey = payload.new.channel_id || "default";
                const oldSt = payload.old?.status || "pending";
                const newSt = payload.new?.status || "pending";
                if (!newStats[chKey]) newStats[chKey] = { total: 0, pending: 0, sent: 0, failed: 0, processing: 0 };
                if (newStats.all[oldSt] !== undefined) { newStats.all[oldSt] = Math.max(0, newStats.all[oldSt] - 1); newStats[chKey][oldSt] = Math.max(0, newStats[chKey][oldSt] - 1); }
                if (newStats.all[newSt] !== undefined) { newStats.all[newSt]++; newStats[chKey][newSt]++; }
                return newStats;
              });
            }
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "whatsapp_queue" },
        (payload) => {
          if (payload.old?.id) {
            setQueueMessages((prev) => prev.filter((m) => m.id !== payload.old.id));
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "system_settings", filter: "key=eq.whatsapp_lock" },
        (payload) => {
          setClusterLock(payload.new?.value || null);
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "whatsapp_node_assignments" },
        () => {
          supabase
            .from("whatsapp_node_assignments")
            .select("*")
            .then(({ data }) => {
              if (data) {
                const map = {};
                data.forEach((a) => {
                  map[a.hostname] = a.target_channel_id;
                });
                setNodeAssignments(map);
              }
            });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "system_settings", filter: "key=eq.whatsapp_allow_multi_channel" },
        (payload) => {
          setAllowMultiChannel(payload.new?.value === true || payload.new?.value?.enabled === true);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(liveChannel);
    };
  }, []);

  // Handle assigning channel to a specific machine/node
  const handleAssignChannelToNode = async (hostname, targetChannelId) => {
    if (!hostname) return;
    setAssigningNode(hostname);
    try {
      const { error } = await supabase
        .from("whatsapp_node_assignments")
        .upsert(
          {
            hostname: hostname,
            target_channel_id: targetChannelId || null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "hostname" }
        );
      if (error) throw error;

      setNodeAssignments((prev) => ({
        ...prev,
        [hostname]: targetChannelId || null,
      }));

      const chName = targetChannelId
        ? channels.find((c) => c.id === targetChannelId)?.name || "مخصصة"
        : "القناة الافتراضية العامة";
      toast.success(`🎯 تم توجيه الجهاز (${hostname}) لخدمة: ${chName}`);
    } catch (err) {
      console.error("Failed to assign channel:", err);
      toast.error("فشل حفظ توجيه القناة: " + err.message);
    } finally {
      setAssigningNode(null);
    }
  };

  // Handle toggling multi-channel fallback
  const handleToggleMultiChannel = async (enabled) => {
    setSavingPolicy(true);
    try {
      const { error } = await supabase
        .from("system_settings")
        .upsert(
          {
            key: "whatsapp_allow_multi_channel",
            value: enabled,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "key" }
        );
      if (error) throw error;
      setAllowMultiChannel(enabled);
      toast.success(
        enabled
          ? "تم تفعيل السماح بتشغيل قنوات إضافية على نفس الجهاز عند نقص الأجهزة"
          : "تم تفعيل سياسة حماية رامات العميل (قناة واحدة فقط لكل جهاز)"
      );
    } catch (err) {
      toast.error("فشل حفظ إعداد السياسة: " + err.message);
    } finally {
      setSavingPolicy(false);
    }
  };

  // Handle auto-distributing channels across active devices
  const handleAutoDistributeChannels = async () => {
    setAutoDistributing(true);
    try {
      const activeHosts = [
        ...new Set(
          nodes
            .filter((n) => {
              const s = n.last_seen ? Math.round((Date.now() - new Date(n.last_seen).getTime()) / 1000) : 9999;
              return s < 180 && n.status !== "offline";
            })
            .map((n) => n.hostname)
            .filter(Boolean)
        ),
      ];

      if (activeHosts.length === 0) {
        toast.error("لا توجد أجهزة متصلة ونشطة حالياً لتوزيع القنوات عليها");
        return;
      }

      const nonDefaultChs = channels.filter((c) => !c.is_default);
      const updates = [];

      // Host 0 gets Default Channel (target_channel_id = null)
      updates.push({
        hostname: activeHosts[0],
        target_channel_id: null,
        updated_at: new Date().toISOString(),
      });

      // Subsequent hosts get non-default channels (1 channel per host)
      for (let i = 1; i < activeHosts.length; i++) {
        const targetChId = nonDefaultChs[i - 1] ? nonDefaultChs[i - 1].id : null;
        updates.push({
          hostname: activeHosts[i],
          target_channel_id: targetChId,
          updated_at: new Date().toISOString(),
        });
      }

      const { error } = await supabase
        .from("whatsapp_node_assignments")
        .upsert(updates, { onConflict: "hostname" });

      if (error) throw error;
      toast.success(
        `⚡ تم توزيع القنوات بنجاح: جهاز مستقل لكل قناة لحماية الذاكرة والرامات!`
      );
      fetchData();
    } catch (err) {
      toast.error("فشل التوزيع التلقائي: " + err.message);
    } finally {
      setAutoDistributing(false);
    }
  };

  // ✅ إصلاح #2: تنظيف العقد الشبح يدوياً من الداشبورد
  const [purgingGhosts, setPurgingGhosts] = useState(false);

  const handlePurgeGhostNodes = async () => {
    if (!window.confirm(t.msgConfirmPurgeGhosts || "هل أنت متأكد من حذف جميع العقد غير النشطة (الشبح) من الشبكة؟\nالعقد التي لم ترسل نبضة منذ أكثر من 3 دقائق ستُحذف نهائياً.")) return;
    setPurgingGhosts(true);
    try {
      const threeMinutesAgo = new Date(Date.now() - 3 * 60 * 1000).toISOString();
      const { error } = await supabase
        .from("whatsapp_nodes")
        .delete()
        .lt("last_seen", threeMinutesAgo);

      if (error) throw error;
      toast.success(t.msgPurgeGhostSuccess || "🧹 تم تنظيف العقد الشبح بنجاح! الشبكة جاهزة.");
      fetchData();
    } catch (err) {
      toast.error((t.msgPurgeNodesError || "فشل تنظيف العقد: ") + err.message);
    } finally {
      setPurgingGhosts(false);
    }
  };

  // -------------------------------------------------------------------------
  // 1. CHANNELS MANAGEMENT
  // -------------------------------------------------------------------------
  const handleCreateChannel = async (e) => {
    e.preventDefault();
    if (!newChannelName.trim()) {
      toast.error("يرجى إدخال اسم القناة");
      return;
    }

    setCreatingChannel(true);
    try {
      if (newChannelDefault) {
        // unset other defaults
        await supabase
          .from("whatsapp_channels")
          .update({ is_default: false })
          .eq("is_default", true);
      }

      const { error } = await supabase
        .from("whatsapp_channels")
        .insert({
          name: newChannelName.trim(),
          description: newChannelDesc.trim() || null,
          is_default: newChannelDefault,
          status: "disconnected"
        })
        .select()
        .single();

      if (error) throw error;

      toast.success("تم إنشاء القناة بنجاح! 🎉");
      setNewChannelName("");
      setNewChannelDesc("");
      setNewChannelDefault(false);
      setIsChannelModalOpen(false);
      fetchData();
    } catch (err) {
      toast.error("فشل إنشاء القناة: " + err.message);
    } finally {
      setCreatingChannel(false);
    }
  };

  const handleSetDefaultChannel = async (channelId) => {
    try {
      await supabase.from("whatsapp_channels").update({ is_default: false }).neq("id", channelId);
      const { error } = await supabase.from("whatsapp_channels").update({ is_default: true }).eq("id", channelId);
      if (error) throw error;
      toast.success("تم تعيين القناة كافتراضية لجميع العملاء غير المخصصين.");
      fetchData();
    } catch (err) {
      toast.error("فشل التعيين: " + err.message);
    }
  };

  const handleDeleteChannel = async (channelId) => {
    if (!window.confirm("هل أنت متأكد من حذف هذه القناة؟ سيتم نقل الشركات المخصصة لها للقناة الافتراضية.")) return;
    try {
      const { error } = await supabase.from("whatsapp_channels").delete().eq("id", channelId);
      if (error) throw error;
      toast.success("تم حذف القناة بنجاح.");
      fetchData();
    } catch (err) {
      toast.error("فشل حذف القناة: " + err.message);
    }
  };

  const handleDisconnectChannel = async (channel) => {
    if (!channel) return;
    const confirmMsg = `هل أنت متأكد من تسجيل الخروج وفصل حساب الواتساب الخاص بقناة "${channel.name}"؟\nسيتم مسح الجلسة وتوليد رمز QR جديد لربط رقم آخر.`;
    if (!window.confirm(confirmMsg)) return;

    try {
      const isDefault = channel.is_default;
      const controlKey = !isDefault && channel.id
        ? `whatsapp_control_${channel.id}`
        : "whatsapp_control_master";

      // 1. إرسال أمر فوري عبر Realtime للعقدة النشطة لمسح الجلسة فوراً
      await supabase.from("system_settings").upsert({
        key: controlKey,
        value: {
          action: "force_disconnect",
          channel_id: channel.id,
          requested_at: new Date().toISOString(),
          requested_by: "admin"
        },
        updated_at: new Date().toISOString()
      }, { onConflict: "key" });

      // 2. تحديث القناة في جدول whatsapp_channels فورياً
      await supabase.from("whatsapp_channels").update({
        status: "qr_pending",
        phone_number: null,
        qr_code: null,
        updated_at: new Date().toISOString()
      }).eq("id", channel.id);

      // 3. حذف النسخة الاحتياطية والـ QR القديم
      const sessionZipKey = !isDefault && channel.id
        ? `whatsapp_session_zip_${channel.id}`
        : "whatsapp_session_zip";
      const qrPendingKey = !isDefault && channel.id
        ? `whatsapp_qr_pending_${channel.id}`
        : "whatsapp_qr_pending";

      await supabase.from("system_settings").delete().eq("key", sessionZipKey);
      await supabase.from("system_settings").delete().eq("key", qrPendingKey);

      toast.success("تم إرسال أمر فصل الواتساب! جاري طلب رمز QR جديد...");

      // 4. فتح نافذة الـ QR فوراً للمستخدم
      setQrModalChannel({ ...channel, status: "qr_pending", phone_number: null, qr_code: null });
      fetchData();
    } catch (err) {
      console.error("Failed to disconnect WhatsApp:", err);
      toast.error("فشل فصل الواتساب: " + err.message);
    }
  };

  // -------------------------------------------------------------------------
  // 2. CLIENT ROUTING MATRIX
  // -------------------------------------------------------------------------
  const handleAssignCompanyChannel = async (companyId, channelId) => {
    try {
      const targetVal = channelId === "default" ? null : channelId;
      const { error } = await supabase
        .from("companies")
        .update({ whatsapp_channel_id: targetVal })
        .eq("id", companyId);

      if (error) throw error;

      setCompanies((prev) =>
        prev.map((c) => (c.id === companyId ? { ...c, whatsapp_channel_id: targetVal } : c))
      );
      toast.success("تم تحديث قناة إرسال الشركة بنجاح.");
    } catch (err) {
      toast.error("فشل التوجيه: " + err.message);
    }
  };

  const filteredCompanies = useMemo(() => {
    return companies.filter((comp) => {
      const matchName = comp.name?.toLowerCase().includes(companySearch.toLowerCase()) ||
                        comp.phone?.includes(companySearch);

      if (companyChannelFilter === "all") return matchName;
      if (companyChannelFilter === "unassigned") return matchName && !comp.whatsapp_channel_id;
      return matchName && comp.whatsapp_channel_id === companyChannelFilter;
    });
  }, [companies, companySearch, companyChannelFilter]);

  // -------------------------------------------------------------------------
  // 3. API KEYS MANAGEMENT
  // -------------------------------------------------------------------------
  const generateRandomKey = () => {
    const chars = "abcdef0123456789";
    let token = "";
    for (let i = 0; i < 32; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `kwa_live_${token}`;
  };

  const handleCreateApiKey = async (e) => {
    e.preventDefault();
    if (!newKeyName.trim()) {
      toast.error("يرجى إدخال اسم النظام أو المفتاح");
      return;
    }

    setCreatingKey(true);
    try {
      const generatedKey = generateRandomKey();
      const targetChannel = newKeyChannelId || null;

      const { data, error } = await supabase
        .from("whatsapp_api_keys")
        .insert({
          name: newKeyName.trim(),
          api_key: generatedKey,
          channel_id: targetChannel,
          rate_limit_per_minute: parseInt(newKeyRateLimit) || 60,
          is_active: true
        })
        .select("*, whatsapp_channels(name)")
        .single();

      if (error) throw error;

      toast.success("تم إنشاء مفتاح الـ API بنجاح! 🔑");
      setNewKeyName("");
      setNewKeyChannelId("");
      setIsKeyModalOpen(false);
      setApiKeys((prev) => [data, ...prev]);
    } catch (err) {
      toast.error("فشل إنشاء المفتاح: " + err.message);
    } finally {
      setCreatingKey(false);
    }
  };

  const handleToggleKeyStatus = async (keyId, currentStatus) => {
    try {
      const { error } = await supabase
        .from("whatsapp_api_keys")
        .update({ is_active: !currentStatus })
        .eq("id", keyId);

      if (error) throw error;

      setApiKeys((prev) =>
        prev.map((k) => (k.id === keyId ? { ...k, is_active: !currentStatus } : k))
      );
      toast.success(!currentStatus ? "تم تفعيل المفتاح." : "تم إيقاف المفتاح مؤقتاً.");
    } catch (err) {
      toast.error("فشل تحديث الحالة: " + err.message);
    }
  };

  const handleDeleteApiKey = async (keyId) => {
    if (!window.confirm("هل أنت متأكد من حذف مفتاح الـ API نهائياً؟ ستتوقف أي خدمات خارجية تستخدمه فوراً.")) return;
    try {
      const { error } = await supabase.from("whatsapp_api_keys").delete().eq("id", keyId);
      if (error) throw error;
      setApiKeys((prev) => prev.filter((k) => k.id !== keyId));
      toast.success("تم حذف المفتاح.");
    } catch (err) {
      toast.error("فشل الحذف: " + err.message);
    }
  };

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedKeyId(id);
    toast.success("تم نسخ مفتاح الـ API للحافظة!");
    setTimeout(() => setCopiedKeyId(null), 2000);
  };

  // -------------------------------------------------------------------------
  // 4. API SANDBOX TEST CONSOLE
  // -------------------------------------------------------------------------
  const handleSendTestMessage = async (e) => {
    e.preventDefault();
    if (!sandboxKey) {
      toast.error("يرجى اختيار مفتاح API للاختبار");
      return;
    }
    if (!sandboxPhone.trim() || !sandboxMessage.trim()) {
      toast.error("يرجى إدخال رقم هاتف ورسالة");
      return;
    }

    setSandboxSending(true);
    setSandboxResponse(null);

    const startTime = Date.now();
    try {
      const baseUrl = process.env.REACT_APP_SUPABASE_URL || "https://bpmbtursvnkdmnybzvrm.supabase.co";
      const res = await fetch(`${baseUrl}/functions/v1/whatsapp-gateway`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": sandboxKey
        },
        body: JSON.stringify({
          phone: sandboxPhone.trim(),
          message: sandboxMessage.trim(),
          priority: 10
        })
      });

      const responseTime = Date.now() - startTime;
      const data = await res.json();

      setSandboxResponse({
        status: res.status,
        ok: res.ok,
        responseTime: `${responseTime}ms`,
        body: data
      });

      if (res.ok) {
        toast.success("تم إرسال الرسالة إلى طابور الواتساب بنجاح! 🚀");
        fetchData(); // refresh counters
      } else {
        toast.error("خطأ من الـ API: " + (data.message || data.error));
      }
    } catch (err) {
      const responseTime = Date.now() - startTime;
      setSandboxResponse({
        status: 500,
        ok: false,
        responseTime: `${responseTime}ms`,
        body: { error: "NetworkError", message: err.message }
      });
      toast.error("فشل الاتصال بالـ API: " + err.message);
    } finally {
      setSandboxSending(false);
    }
  };

  // -------------------------------------------------------------------------
  // 4.5 DECENTRALIZED CLUSTER MANAGEMENT & FAILOVER
  // -------------------------------------------------------------------------
  const executeFailover = async () => {
    setFailingOver(true);
    try {
      const activeLeaderNode = clusterLock?.node_id || "manual_admin";
      const { error } = await supabase.rpc("release_whatsapp_lock", {
        p_node_id: activeLeaderNode,
        p_lock_key: "whatsapp_lock",
        p_reason: "admin_forced_failover_test"
      });

      if (error) {
        await supabase
          .from("system_settings")
          .upsert({
            key: "whatsapp_lock",
            value: {
              node_id: null,
              released_at: new Date().toISOString(),
              reason: "admin_forced_failover_test"
            },
            updated_at: new Date().toISOString()
          }, { onConflict: "key" });
      }

      toast.success("⚡ تم إرسال أمر تنحي القائد! العقد الاحتياطية ستستحوذ فوراً في غضون أجزاء من الثانية.");
      setTimeout(fetchData, 1000);
    } catch (err) {
      toast.error("فشل تنفيذ أمر التنازل: " + err.message);
    } finally {
      setFailingOver(false);
    }
  };

  const handleForceFailover = () => {
    toast("هل تريد فرض تنحي القائد الحالي واختبار الاستحواذ التلقائي؟", {
      description: "سيتم تحرير قفل الإرسال ونقله فورياً إلى إحدى المحطات الاحتياطية المتصلة.",
      action: {
        label: "تأكيد التنحي",
        onClick: () => executeFailover()
      },
      cancel: {
        label: "إلغاء"
      }
    });
  };

  // -------------------------------------------------------------------------
  // 5. CODE SNIPPETS
  // -------------------------------------------------------------------------
  const selectedKeyObject = apiKeys.find((k) => k.api_key === sandboxKey) || apiKeys[0];
  const activeKeySample = selectedKeyObject?.api_key || "kwa_live_your_api_key_here";

  const gatewayEndpoint = `${process.env.REACT_APP_SUPABASE_URL || "https://bpmbtursvnkdmnybzvrm.supabase.co"}/functions/v1/whatsapp-gateway`;

  const codeSnippets = {
    curl: `curl -X POST "${gatewayEndpoint}" \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: ${activeKeySample}" \\
  -d '{
    "phone": "201012345678",
    "message": "مرحباً بكم! رمز التحقق الخاص بك هو 123456"
  }'`,

    js: `// Using Fetch (Node.js 18+ or Browser)
const response = await fetch("${gatewayEndpoint}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-api-key": "${activeKeySample}"
  },
  body: JSON.stringify({
    phone: "201012345678",
    message: "مرحباً بكم! رمز التحقق الخاص بك هو 123456",
    priority: 10
  })
});

const data = await response.json();
console.log("Status:", data);`,

    python: `import requests

url = "${gatewayEndpoint}"
headers = {
    "Content-Type": "application/json",
    "x-api-key": "${activeKeySample}"
}
payload = {
    "phone": "201012345678",
    "message": "مرحباً بكم! رمز التحقق الخاص بك هو 123456",
    "priority": 10
}

response = requests.post(url, json=payload, headers=headers)
print(response.json())`,

    php: `<?php
$curl = curl_init();

$payload = json_encode([
    "phone" => "201012345678",
    "message" => "مرحباً بكم! رمز التحقق الخاص بك هو 123456"
]);

curl_setopt_array($curl, [
    CURLOPT_URL => "${gatewayEndpoint}",
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => $payload,
    CURLOPT_HTTPHEADER => [
        "Content-Type: application/json",
        "x-api-key: ${activeKeySample}"
    ],
]);

$response = curl_exec($curl);
curl_close($curl);
echo $response;
?>`
  };

  const aliveNodesCount = useMemo(() => {
    return nodes.filter((n) => {
      const s = n.last_seen ? Math.round((Date.now() - new Date(n.last_seen).getTime()) / 1000) : null;
      return s !== null && s < 180 && n.status !== "offline";
    }).length;
  }, [nodes]);

  const handlePurgeDeadNodes = async () => {
    try {
      // ✅ إصلاح: تقليل المهلة من 10 دقائق إلى 3 دقائق لتنظيف العقد الشبح بشكل أسرع
      const threeMinutesAgo = new Date(Date.now() - 3 * 60 * 1000).toISOString();
      const { error } = await supabase
        .from("whatsapp_nodes")
        .delete()
        .or(`last_seen.lt.${threeMinutesAgo},status.eq.offline`);
      if (error) throw error;
      toast.success(t.msgPurgeDeadSuccess || "🧹 تم تنظيف العقد الشبح بنجاح");
      fetchData();
    } catch (err) {
      toast.error((t.msgPurgeRecordsError || "فشل تنظيف السجلات: ") + err.message);
    }
  };


  return (
    <div className="space-y-6 select-none" style={{ direction: "rtl" }}>
      {/* Header & Stats Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-gray-900" style={{ fontWeight: 800, fontSize: "1.25rem" }}>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <MessageSquare className="w-5 h-5" />
            </div>
            <span>بوابة قنوات الواتساب والـ API الخارجي</span>
          </div>
          <p className="text-gray-400 text-xs mt-1">
            إدارة أرقام واتساب المؤسسة، والشبكة اللامركزية، وتوجيه رسائل الشركات ومفاتيح المطورين
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchData}
            disabled={loading}
            className="p-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-600 transition-all shadow-xs"
            title="تحديث البيانات"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-emerald-600" : ""}`} />
          </button>
          <button
            onClick={() => setIsKeyModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-900 hover:bg-black text-white text-xs font-bold transition-all shadow-sm"
          >
            <Key className="w-4 h-4" />
            <span>مفتاح API جديد</span>
          </button>
          <button
            onClick={() => setIsChannelModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة قناة / رقم</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-gray-200 pb-2 overflow-x-auto">
        {[
          { id: "channels", label: "قنوات وأرقام الإرسال", icon: Radio, count: channels.length },
          {
            id: "messages",
            label: "سجل ورؤية الرسائل والطابور",
            icon: MessageSquareText,
            count: queueStats.all?.pending > 0 ? `${queueStats.all?.pending} بالانتظار` : (queueStats.all?.total || queueMessages.length),
            isPulse: (queueStats.all?.pending || 0) > 0
          },
          { id: "cluster", label: "الشبكة اللامركزية والعُقد", icon: Network, count: nodes.length },
          { id: "routing", label: "توجيه الشركات والعملاء", icon: Building2, count: companies.length },
          { id: "apikeys", label: "مفاتيح الـ API الخارجية", icon: Key, count: apiKeys.length },
          { id: "docs", label: "وثائق الربط والـ Sandbox", icon: Terminal }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2.5 px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                isActive
                  ? "bg-white text-emerald-700 border border-emerald-200 shadow-sm"
                  : "text-gray-500 hover:text-gray-900 hover:bg-gray-100"
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? "text-emerald-600" : "text-gray-400"}`} />
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span className={`text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 font-bold ${
                  tab.isPulse
                    ? "bg-amber-100 text-amber-900 border border-amber-300 font-black animate-pulse"
                    : isActive
                    ? "bg-emerald-50 text-emerald-700 font-bold"
                    : "bg-gray-100 text-gray-500"
                }`}>
                  {tab.isPulse && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />}
                  <span>{tab.count}</span>
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* TAB 1: CHANNELS MANAGEMENT */}
      {activeTab === "channels" && (
        <div className="space-y-4">
          {/* Quick Workload & Multi-Session Policy Bar */}
          <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-indigo-50 border border-emerald-200/80 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white rounded-xl border border-emerald-200 text-emerald-700 shadow-2xs shrink-0">
                <Cpu className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-black text-emerald-950 flex items-center gap-2">
                  <span>توزيع القنوات والسيشنز على أجهزة العملاء</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                    allowMultiChannel ? "bg-amber-100 text-amber-800 border border-amber-200" : "bg-emerald-100 text-emerald-800 border border-emerald-200"
                  }`}>
                    {allowMultiChannel ? "مسموح بعدة سيشنز على الجهاز" : "سيشن واحدة فقط لكل جهاز (توفير الرام)"}
                  </span>
                </h4>
                <p className="text-[11px] text-emerald-800 mt-0.5">
                  الوضع الافتراضي يشغل قناة واحدة فقط لكل جهاز لتوفير الرامات. يمكنك تفعيل تعدد السيشنز للجهاز الواحد عند نقص الأجهزة.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0 flex-wrap">
              {/* Toggle */}
              <label className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border cursor-pointer select-none text-xs font-bold transition-all ${
                allowMultiChannel
                  ? "bg-amber-50 border-amber-300 text-amber-900"
                  : "bg-white border-emerald-200 text-gray-800 hover:bg-emerald-50/50"
              }`}>
                <input
                  type="checkbox"
                  checked={allowMultiChannel}
                  onChange={(e) => handleToggleMultiChannel(e.target.checked)}
                  disabled={savingPolicy}
                  className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                />
                <span>السماح بتشغيل أكثر من قناة/سيشن على نفس الجهاز</span>
                {savingPolicy && <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />}
              </label>

              {/* View Cluster / Node distribution button */}
              <button
                type="button"
                onClick={() => setActiveTab("cluster")}
                className="px-3 py-1.5 text-xs font-bold text-emerald-700 hover:text-emerald-800 bg-white hover:bg-emerald-50 border border-emerald-200 rounded-xl transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
              >
                <span>إدارة توزيع الأجهزة والعُقد</span>
                <span>➔</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {channels.map((channel) => {
              const isDefault = channel.is_default;
              const assignedCount = isDefault
                ? companies.filter((c) => !c.whatsapp_channel_id || c.whatsapp_channel_id === channel.id).length
                : companies.filter((c) => c.whatsapp_channel_id === channel.id).length;

              // Check if default channel is connected via cluster lock
              const isDefaultLeaderActive =
                isDefault &&
                clusterLock?.node_id &&
                clusterLock?.last_heartbeat &&
                Date.now() - new Date(clusterLock.last_heartbeat).getTime() < 120000;
              const activeLeaderNodeId = isDefaultLeaderActive ? clusterLock.node_id : channel.active_node_id;

              // Telemetry: node lookup, role (leader vs standby), and response time
              const aliveNodes = nodes.filter((n) => {
                const lastSeen = n.last_seen ? new Date(n.last_seen).getTime() : 0;
                return (Date.now() - lastSeen) < 180000 && n.status !== "offline";
              });

              const activeNode =
                aliveNodes.find(
                  (n) =>
                    (activeLeaderNodeId && n.node_id === activeLeaderNodeId) ||
                    (channel.active_node_id && n.node_id === channel.active_node_id) ||
                    (channel.node_id && n.node_id === channel.node_id) ||
                    (isDefault && (n.is_leader || (clusterLock?.node_id && n.node_id === clusterLock.node_id))) ||
                    (!isDefault && n.channel_id === channel.id)
                ) ||
                nodes.find(
                  (n) =>
                    (activeLeaderNodeId && n.node_id === activeLeaderNodeId) ||
                    (channel.active_node_id && n.node_id === channel.active_node_id) ||
                    (channel.node_id && n.node_id === channel.node_id) ||
                    (isDefault && (n.is_leader || (clusterLock?.node_id && n.node_id === clusterLock.node_id))) ||
                    (!isDefault && n.channel_id === channel.id)
                );

              const lastPulseDate = activeNode?.last_seen
                ? new Date(activeNode.last_seen)
                : channel.last_heartbeat
                ? new Date(channel.last_heartbeat)
                : null;

              const pulseSecondsAgo = lastPulseDate
                ? Math.max(0, Math.round((Date.now() - lastPulseDate.getTime()) / 1000))
                : null;

              const isNodeAlive = pulseSecondsAgo !== null && pulseSecondsAgo < 180 && activeNode?.status !== "offline";
              const isConnected = Boolean(channel.status === "connected" && (isNodeAlive || isDefaultLeaderActive) && channel.phone_number);
              // ✅ إصلاح: isQrPending يجب أن يكون فقط إذا كانت الحالة "qr_pending" تحديداً
              // وليس إذا كانت "disconnected" لتجنب عرض بطاقة "مفصول" بلون أصفر مضلل
              const isQrPending = !isConnected && channel.status === "qr_pending";

              const isLeader = Boolean(
                isConnected &&
                isNodeAlive &&
                ((activeNode?.is_leader || activeNode?.role === "leader") ||
                 (isDefault && isDefaultLeaderActive) ||
                 (clusterLock?.node_id && activeNode?.node_id === clusterLock.node_id))
              );

              const isStandby = Boolean(
                isConnected && !isLeader && isNodeAlive && (activeNode?.role === "standby" || !activeNode?.is_leader)
              );

              const latencyMs = activeNode?.response_time_ms || channel.response_time_ms || serverPingMs || 35;

              return (
                <div
                  key={channel.id}
                  className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-all space-y-4 relative overflow-hidden"
                >
                  {isDefault && (
                    <div className="absolute top-0 left-0 bg-emerald-600 text-white text-[10px] font-bold px-3 py-0.5 rounded-br-xl shadow-sm">
                      القناة الافتراضية
                    </div>
                  )}

                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold ${
                        isConnected
                          ? "bg-emerald-50 text-emerald-600 border border-emerald-100"
                          : isQrPending
                          ? "bg-amber-50 text-amber-600 border border-amber-100"
                          : "bg-gray-100 text-gray-500"
                      }`}>
                        <Smartphone className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-gray-900 font-bold text-sm">{channel.name}</div>
                        <div className="text-gray-400 text-xs">
                          {channel.phone_number
                            ? `+${channel.phone_number}`
                            : isConnected
                            ? `متصل (رقم المنصة المركزي)`
                            : "لم يتم ربط رقم بعد"}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      {!isDefault && (
                        <button
                          onClick={() => handleDeleteChannel(channel.id)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                          title="حذف القناة"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {channel.description && (
                    <p className="text-gray-500 text-xs line-clamp-2">{channel.description}</p>
                  )}

                  {/* Channel Status Badge */}
                  <div className="flex items-center justify-between pt-2 border-t border-gray-100 text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${
                        isConnected
                          ? "bg-emerald-500 animate-pulse"
                          : isQrPending
                          ? "bg-amber-500 animate-pulse"
                          : "bg-gray-400"
                      }`} />
                      <span className="font-semibold text-gray-700">
                        {isConnected
                          ? "🟢 متصل وشغال"
                          : isQrPending
                          ? "🟡 بانتظار مسح QR"
                          : "🔴 مفصول"}
                      </span>
                    </div>

                    {isDefault ? (
                      <span className="text-[11px] text-emerald-800 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-lg font-bold">
                        عامة لجميع الشركات ({assignedCount})
                      </span>
                    ) : (
                      <span className="text-[11px] text-gray-500 bg-gray-50 border border-gray-200/60 px-2 py-0.5 rounded-lg font-medium">
                        الشركات المخصصة: <strong className="text-gray-800 font-bold">{assignedCount}</strong>
                      </span>
                    )}
                  </div>

                  {/* Server Telemetry & System Identity Panel */}
                  <div className="bg-slate-50/90 border border-slate-200/90 rounded-2xl p-3.5 space-y-3 text-xs">
                    {/* Role & Response Time */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-gray-500 font-bold text-[11px]">حالة المحطة:</span>
                        {isLeader ? (
                          <span
                            className="inline-flex items-center gap-1 bg-amber-100 text-amber-950 border border-amber-300 font-black text-[10px] px-2.5 py-0.5 rounded-lg shadow-2xs cursor-help"
                            title="القائد الفعلي: هذا الجهاز هو المتصل بواتساب ويب والمسؤول الحصري عن معالجة وإرسال الرسائل وأكواد الـ OTP"
                          >
                            👑 <span>القائد النشط (المرسل الفعلي)</span>
                          </span>
                        ) : isStandby ? (
                          <span
                            className="inline-flex items-center gap-1 bg-blue-50 text-blue-900 border border-blue-200 font-bold text-[10px] px-2.5 py-0.5 rounded-lg cursor-help"
                            title="الاستعداد: جهاز بديل يعمل في الخلفية ومستعد للاستحواذ التلقائي في أجزاء من الثانية إذا توقف القائد"
                          >
                            🛡️ <span>استعداد (محطة بديلة)</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-500 font-medium text-[10px] px-2.5 py-0.5 rounded-lg">
                            ⚪ <span>غير متصل بمحطة</span>
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 font-mono">
                        <span className="text-gray-400 font-sans text-[10px]">الاستجابة:</span>
                        <div className="flex items-center gap-1 bg-emerald-100/90 border border-emerald-300 text-emerald-950 font-black text-[11px] px-2 py-0.5 rounded-md">
                          <Activity className="w-3 h-3 text-emerald-600 animate-pulse" />
                          <span>{latencyMs}ms</span>
                        </div>
                        {pulseSecondsAgo !== null && (
                          <span className="text-[10px] text-gray-400 font-sans font-medium" title="زمن آخر نبضة حياة">
                            ({pulseSecondsAgo < 60 ? `${pulseSecondsAgo}ث` : `${Math.round(pulseSecondsAgo / 60)}د`})
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Operational Details Grid: Software, Host Device, and Account Scope */}
                    <div className="pt-2.5 border-t border-slate-200/70 grid grid-cols-2 gap-2 text-[11px] text-gray-600">
                      <div className="flex items-center gap-1.5 min-w-0" title={`اسم كمبيوتر السيرفر: ${activeNode?.hostname || "سيرفر ويندوز محلي"}`}>
                        <Laptop className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        <span className="text-gray-400 shrink-0">الجهاز:</span>
                        <span className="font-bold text-gray-800 truncate">
                          {activeNode?.hostname || (isConnected ? "DESKTOP-S2B1RKS" : "غير محدد")}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 min-w-0" title={`برنامج الخدمة: Kwader WhatsApp Gateway v${activeNode?.version || "2.1.0"}`}>
                        <Cpu className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        <span className="text-gray-400 shrink-0">البرنامج:</span>
                        <span className="font-bold text-indigo-700 font-mono truncate">
                          Kwader-WS v{activeNode?.version || "2.1"}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 col-span-2 text-gray-700 bg-white/80 p-2 rounded-xl border border-slate-200/50">
                        <Building2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span className="text-gray-500 shrink-0 font-medium">نطاق الاشتراك:</span>
                        <span className="font-bold text-gray-900 truncate">
                          {isDefault
                            ? `نظام مركزي عام يغطي كافة الشركات (${assignedCount} شركة مسجلة)`
                            : `قناة مخصصة لـ (${assignedCount}) شركة`}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Channel Queue & Sent Messages Stats */}
                  {(() => {
                    const chStats = queueStats[channel.id] || (isDefault ? queueStats.default : { pending: 0, sent: 0, failed: 0, total: 0 });
                    return (
                      <div className="bg-slate-50/90 border border-slate-200/90 rounded-2xl p-3.5 space-y-2.5 text-xs">
                        <div className="flex items-center justify-between text-gray-700 font-bold">
                          <div className="flex items-center gap-1.5 text-gray-950 font-black">
                            <MessageSquareText className="w-4 h-4 text-emerald-600" />
                            <span>حالة الرسائل وطابور الإرسال:</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setMessageChannelFilter(isDefault ? "default" : channel.id);
                              setActiveTab("messages");
                            }}
                            className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            <span>سجل رؤية الرسائل</span>
                            <ChevronLeft className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="grid grid-cols-3 gap-2 text-center">
                          {/* Pending Messages */}
                          <div
                            onClick={() => {
                              setMessageChannelFilter(isDefault ? "default" : channel.id);
                              setMessageStatusFilter("pending");
                              setActiveTab("messages");
                            }}
                            className={`p-2 rounded-xl border transition-all cursor-pointer ${
                              chStats.pending > 0
                                ? "bg-amber-50 border-amber-300 text-amber-950 shadow-2xs hover:bg-amber-100"
                                : "bg-white border-gray-200 text-gray-500 hover:bg-gray-50"
                            }`}
                            title="الرسائل المنتظر إرسالها من هذا الرقم في الطابور حالياً"
                          >
                            <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-amber-800">
                              <Clock className="w-3 h-3" />
                              <span>بالانتظار</span>
                            </div>
                            <div className="text-sm font-black font-mono mt-0.5">
                              {chStats.pending}
                            </div>
                          </div>

                          {/* Sent Messages */}
                          <div
                            onClick={() => {
                              setMessageChannelFilter(isDefault ? "default" : channel.id);
                              setMessageStatusFilter("sent");
                              setActiveTab("messages");
                            }}
                            className="bg-white hover:bg-emerald-50/80 border border-gray-200 hover:border-emerald-300 p-2 rounded-xl transition-all cursor-pointer text-gray-800"
                            title="الرسائل التي تم إرسالها بنجاح من هذا الرقم"
                          >
                            <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-emerald-700">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>المرسلة</span>
                            </div>
                            <div className="text-sm font-black font-mono mt-0.5 text-emerald-900">
                              {chStats.sent}
                            </div>
                          </div>

                          {/* Failed Messages */}
                          <div
                            onClick={() => {
                              setMessageChannelFilter(isDefault ? "default" : channel.id);
                              setMessageStatusFilter("failed");
                              setActiveTab("messages");
                            }}
                            className={`p-2 rounded-xl border transition-all cursor-pointer ${
                              chStats.failed > 0
                                ? "bg-rose-50 border-rose-300 text-rose-950 shadow-2xs hover:bg-rose-100"
                                : "bg-white border-gray-200 text-gray-400 hover:bg-gray-50"
                            }`}
                            title="الرسائل التي تعثر إرسالها وتحتاج مراجعة"
                          >
                            <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-rose-700">
                              <AlertCircle className="w-3 h-3" />
                              <span>المتعثرة</span>
                            </div>
                            <div className="text-sm font-black font-mono mt-0.5">
                              {chStats.failed}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2 pt-1">
                    {!isDefault && (
                      <button
                        onClick={() => handleSetDefaultChannel(channel.id)}
                        className="py-2 px-3 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 text-xs font-semibold transition-colors"
                      >
                        تعيين كافتراضية
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setMessageChannelFilter(isDefault ? "default" : channel.id);
                        setActiveTab("messages");
                      }}
                      className="py-2 px-3 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-800 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                      title="عرض سجل الرسائل المفصل لهذا الرقم"
                    >
                      <Eye className="w-3.5 h-3.5 text-emerald-600" />
                      <span>سجل الرسائل</span>
                    </button>
                    {!isConnected ? (
                      <button
                        onClick={() => {
                          setQrModalChannel(channel);
                          fetchChannelQr(channel.id);
                        }}
                        className="flex-1 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold transition-colors border border-emerald-200 flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Radio className="w-3.5 h-3.5" />
                        <span>ربط الواتساب (QR)</span>
                      </button>
                    ) : (
                      <>
                        <div className="flex-1 flex items-center justify-between bg-emerald-50/70 border border-emerald-200 px-3 py-1.5 rounded-xl text-xs text-emerald-900">
                          <span className="font-bold flex items-center gap-1.5">
                            <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[2.5]" />
                            <span>جاهز للإرسال</span>
                          </span>
                          <span className="text-[10px] text-emerald-700 font-mono font-semibold truncate max-w-[100px]">
                            {activeLeaderNodeId ? activeLeaderNodeId.substring(0, 14) : "نشط لا مركزياً"}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDisconnectChannel(channel)}
                          className="px-2.5 py-1.5 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold transition-all flex items-center gap-1 shrink-0 cursor-pointer shadow-2xs"
                          title="تسجيل الخروج وفصل هذا الرقم لربط رقم جديد"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>فصل</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB: MESSAGES QUEUE & HISTORY */}
      {activeTab === "messages" && (() => {
        const stats = {
          total: filteredQueueMessages.length,
          pending: filteredQueueMessages.filter((m) => m.status === "pending").length,
          sent: filteredQueueMessages.filter((m) => m.status === "sent").length,
          failed: filteredQueueMessages.filter((m) => m.status === "failed").length,
          processing: filteredQueueMessages.filter((m) => m.status === "processing").length,
        };

        const activeChannelObj = channels.find((c) => c.id === messageChannelFilter);
        const channelLabel =
          messageChannelFilter === "all"
            ? "جميع القنوات والأرقام"
            : messageChannelFilter === "default"
            ? "القناة الافتراضية العامة"
            : activeChannelObj?.name || "قناة مخصصة";

        return (
          <div className="space-y-6">
            {/* Top KPI & Banner */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-6 space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h3 className="text-gray-900 font-bold text-sm flex items-center gap-2">
                    <MessageSquareText className="w-5 h-5 text-emerald-600" />
                    <span>سجل ورؤية الرسائل وطابور الإرسال اللامركزي</span>
                  </h3>
                  <p className="text-gray-500 text-xs mt-0.5">
                    متابعة حية للرسائل الصادرة، وطابور الرسائل المنتظر إرسالها لكل رقم وقناة، وسجل التسليم وإعادة المحاولة.
                  </p>
                </div>

                <div className="flex items-center gap-2.5 flex-wrap">
                  <button
                    type="button"
                    onClick={fetchQueueData}
                    disabled={loadingMessages}
                    className="px-3.5 py-2 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-bold transition-all flex items-center gap-2 shadow-2xs cursor-pointer"
                    title="تحديث قائمة الرسائل"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingMessages ? "animate-spin text-emerald-600" : "text-gray-500"}`} />
                    <span>تحديث السجل</span>
                  </button>

                  {stats.failed > 0 && (
                    <button
                      type="button"
                      onClick={() => handleRetryAllFailed(messageChannelFilter)}
                      className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black transition-all flex items-center gap-1.5 shadow-sm cursor-pointer active:scale-95"
                      title="إعادة جدولة كافة الرسائل المتعثرة في الطابور للإرسال فوراً"
                    >
                      <Zap className="w-3.5 h-3.5" />
                      <span>إعادة إرسال كل المتعثرة ({stats.failed})</span>
                    </button>
                  )}
                </div>
              </div>

              {/* 4 Summary Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Total */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-right space-y-1">
                  <div className="text-[11px] font-bold text-gray-500 flex items-center justify-between">
                    <span>إجمالي الرسائل</span>
                    <MessageSquare className="w-4 h-4 text-slate-400" />
                  </div>
                  <div className="text-xl font-black text-slate-900 font-mono">
                    {stats.total}
                  </div>
                  <div className="text-[10px] text-gray-400 truncate font-bold">
                    {channelLabel}
                  </div>
                </div>

                {/* Pending */}
                <div className={`rounded-2xl p-4 text-right space-y-1 border transition-all ${
                  stats.pending > 0
                    ? "bg-amber-50/90 border-amber-300 text-amber-950 shadow-2xs"
                    : "bg-slate-50 border-slate-200 text-slate-700"
                }`}>
                  <div className="text-[11px] font-bold flex items-center justify-between">
                    <span className="text-amber-900 font-bold">بانتظار الإرسال (الطابور)</span>
                    <Clock className={`w-4 h-4 ${stats.pending > 0 ? "text-amber-600 animate-spin" : "text-gray-400"}`} />
                  </div>
                  <div className="text-xl font-black font-mono flex items-center gap-2">
                    <span>{stats.pending}</span>
                    {stats.pending > 0 && (
                      <span className="text-[10px] bg-amber-200 text-amber-900 px-2 py-0.5 rounded-full font-bold animate-pulse">
                        جاهزة للمعالجة
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-amber-800/80 font-medium">
                    تُعالج فورياً بحسب أولوية القناة
                  </div>
                </div>

                {/* Sent */}
                <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-4 text-right space-y-1">
                  <div className="text-[11px] font-bold text-emerald-900 flex items-center justify-between">
                    <span>تم إرسالها بنجاح</span>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="text-xl font-black text-emerald-950 font-mono">
                    {stats.sent}
                  </div>
                  <div className="text-[10px] text-emerald-700 font-medium">
                    تم تسليمها للعملاء والموظفين
                  </div>
                </div>

                {/* Failed */}
                <div className={`rounded-2xl p-4 text-right space-y-1 border transition-all ${
                  stats.failed > 0
                    ? "bg-rose-50 border-rose-300 text-rose-950 shadow-2xs"
                    : "bg-slate-50 border-slate-200 text-slate-700"
                }`}>
                  <div className="text-[11px] font-bold flex items-center justify-between">
                    <span className="text-rose-900 font-bold">رسائل متعثرة</span>
                    <AlertCircle className="w-4 h-4 text-rose-500" />
                  </div>
                  <div className="text-xl font-black font-mono text-rose-950">
                    {stats.failed}
                  </div>
                  <div className="text-[10px] text-rose-700 font-medium">
                    {stats.failed > 0 ? "يمكن إعادة المحاولة بضغطة زر" : "لا توجد أي أخطاء إرسال"}
                  </div>
                </div>
              </div>

              {/* Filters & Search Toolbar */}
              <div className="pt-4 border-t border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                {/* Channel Filter Selector */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-full">
                  <span className="text-xs font-bold text-gray-500 shrink-0">القناة:</span>
                  <button
                    type="button"
                    onClick={() => setMessageChannelFilter("all")}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                      messageChannelFilter === "all"
                        ? "bg-emerald-600 text-white shadow-xs"
                        : "bg-gray-100 hover:bg-gray-200 text-gray-700"
                    }`}
                  >
                    جميع القنوات
                  </button>
                  <button
                    type="button"
                    onClick={() => setMessageChannelFilter("default")}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                      messageChannelFilter === "default"
                        ? "bg-emerald-600 text-white shadow-xs"
                        : "bg-gray-100 hover:bg-gray-200 text-gray-700"
                    }`}
                  >
                    القناة الافتراضية
                  </button>
                  {channels
                    .filter((c) => !c.is_default)
                    .map((ch) => (
                      <button
                        key={ch.id}
                        type="button"
                        onClick={() => setMessageChannelFilter(ch.id)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                          messageChannelFilter === ch.id
                            ? "bg-emerald-600 text-white shadow-xs"
                            : "bg-gray-100 hover:bg-gray-200 text-gray-700"
                        }`}
                      >
                        {ch.name}
                      </button>
                    ))}
                </div>

                {/* Status Filter & Search Input */}
                <div className="flex items-center gap-3 flex-wrap">
                  {/* Status Pills */}
                  <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl text-xs font-bold shrink-0">
                    {[
                      { id: "all", label: "الكل" },
                      { id: "pending", label: "⏳ بالانتظار" },
                      { id: "sent", label: "✅ المرسلة" },
                      { id: "failed", label: "❌ المتعثرة" },
                    ].map((st) => (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => setMessageStatusFilter(st.id)}
                        className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                          messageStatusFilter === st.id
                            ? "bg-white text-gray-900 shadow-xs font-black"
                            : "text-gray-500 hover:text-gray-900"
                        }`}
                      >
                        {st.label}
                      </button>
                    ))}
                  </div>

                  {/* Search Input */}
                  <div className="relative shrink-0">
                    <Search className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="بحث برقم الهاتف أو النص..."
                      value={messageSearchQuery}
                      onChange={(e) => setMessageSearchQuery(e.target.value)}
                      className="pr-9 pl-3 py-1.5 rounded-xl border border-gray-200 text-xs outline-none focus:border-emerald-500 w-52 bg-white font-medium"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Messages Table */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
              <div className="p-4 border-b border-gray-100 flex items-center justify-between text-xs font-bold text-gray-700">
                <div className="flex items-center gap-2">
                  <span className="text-gray-900 font-black">سجل الرسائل التفصيلي:</span>
                  <span className="text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 font-black">
                    {filteredQueueMessages.length} رسالة
                  </span>
                </div>
                {loadingMessages && (
                  <div className="flex items-center gap-1.5 text-gray-400 text-[11px]">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                    <span>جاري التحديث...</span>
                  </div>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-100 text-slate-950 font-black border-b border-slate-300">
                    <tr>
                      <th className="p-3.5 text-slate-950 font-black"># المعرف</th>
                      <th className="p-3.5 text-slate-950 font-black">المستلم (الهاتف)</th>
                      <th className="p-3.5 text-slate-950 font-black">القناة المرسلة</th>
                      <th className="p-3.5 text-slate-950 font-black">نص الرسالة</th>
                      <th className="p-3.5 text-slate-950 font-black">المرفق</th>
                      <th className="p-3.5 text-slate-950 font-black">التوقيت</th>
                      <th className="p-3.5 text-slate-950 font-black">المحطة</th>
                      <th className="p-3.5 text-center text-slate-950 font-black">الحالة</th>
                      <th className="p-3.5 text-center text-slate-950 font-black">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredQueueMessages.length === 0 ? (
                      <tr>
                        <td colSpan="9" className="p-10 text-center text-gray-500 space-y-2">
                          <MessageSquareText className="w-8 h-8 text-gray-300 mx-auto" />
                          <div className="font-bold text-gray-700">لا توجد رسائل مطابقة لخيارات البحث أو الفلترة</div>
                          <p className="text-[11px] text-gray-400">
                            سيتم إدراج أي رسالة فور توليدها أو جدولتها في هذا الجدول تلقائياً عبر Realtime.
                          </p>
                        </td>
                      </tr>
                    ) : (
                      filteredQueueMessages.map((msg) => {
                        const isPending = msg.status === "pending";
                        const isSent = msg.status === "sent";
                        const isFailed = msg.status === "failed";
                        const isProcessing = msg.status === "processing";

                        const msgChannel = channels.find((c) => c.id === msg.channel_id);
                        const chName = msgChannel ? msgChannel.name : "القناة الافتراضية";
                        const chPhone = msgChannel?.phone_number || (channels.find((c) => c.is_default)?.phone_number);

                        // Detect if message is an OTP
                        const isOtp = msg.message && (msg.message.includes("رمز تحقق") || msg.message.includes("OTP") || msg.message.includes("كود"));

                        // Format created time
                        const createdDate = msg.created_at ? new Date(msg.created_at) : null;
                        const createdFormatted = createdDate
                          ? createdDate.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }) + " - " + createdDate.toLocaleDateString("ar-EG", { month: "short", day: "numeric" })
                          : "—";

                        return (
                          <tr key={msg.id} className="hover:bg-gray-50/80 transition-colors">
                            {/* ID */}
                            <td className="p-3.5 font-mono text-[11px] text-gray-500 font-bold">
                              #{msg.id}
                            </td>

                            {/* Phone */}
                            <td className="p-3.5">
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono font-bold text-slate-950 text-xs select-all" dir="ltr">
                                  +{msg.phone}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    navigator.clipboard.writeText(msg.phone);
                                    toast.success("تم نسخ رقم الهاتف");
                                  }}
                                  className="text-gray-400 hover:text-gray-700 p-1 rounded-md cursor-pointer"
                                  title="نسخ الرقم"
                                >
                                  <Copy className="w-3 h-3" />
                                </button>
                              </div>
                            </td>

                            {/* Channel */}
                            <td className="p-3.5">
                              <div className="space-y-0.5">
                                <div className="font-bold text-gray-900 text-xs">{chName}</div>
                                {chPhone && (
                                  <div className="text-[10px] text-gray-500 font-mono font-bold">
                                    +{chPhone}
                                  </div>
                                )}
                              </div>
                            </td>

                            {/* Message Preview */}
                            <td className="p-3.5 max-w-xs">
                              <div
                                onClick={() => setSelectedMessageForModal(msg)}
                                className="cursor-pointer group space-y-1"
                                title="اضغط لمعاينة النص كاملاً"
                              >
                                {isOtp && (
                                  <span className="inline-block bg-amber-100 text-amber-900 border border-amber-300 px-1.5 py-0.2 rounded font-black text-[9px] mb-0.5">
                                    🔐 كود OTP
                                  </span>
                                )}
                                <p className="text-gray-700 group-hover:text-emerald-700 text-xs line-clamp-2 transition-colors font-medium">
                                  {msg.message || "—"}
                                </p>
                              </div>
                            </td>

                            {/* Attachment / PDF */}
                            <td className="p-3.5">
                              {msg.pdf_url ? (
                                <a
                                  href={msg.pdf_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2 py-1 rounded-lg transition-all"
                                  title="فتح المستند المرفق"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                  <span>مستند PDF</span>
                                </a>
                              ) : (
                                <span className="text-gray-400 text-[11px]">لا يوجد</span>
                              )}
                            </td>

                            {/* Time */}
                            <td className="p-3.5 text-gray-600 font-medium text-[11px]">
                              {createdFormatted}
                            </td>

                            {/* Node ID */}
                            <td className="p-3.5">
                              {msg.node_id ? (
                                <span className="font-mono text-[10px] bg-slate-100 text-slate-800 border border-slate-200 px-2 py-0.5 rounded-md font-semibold truncate max-w-[110px] inline-block" title={msg.node_id}>
                                  {msg.node_id.replace("Demo-", "").replace("Redline-", "")}
                                </span>
                              ) : (
                                <span className="text-gray-400 text-[10px]">بانتظار محطة</span>
                              )}
                            </td>

                            {/* Status Badge */}
                            <td className="p-3.5 text-center">
                              {isSent && (
                                <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-950 border border-emerald-300 font-black text-[10px] px-2.5 py-1 rounded-lg">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                                  <span>تم الإرسال</span>
                                </span>
                              )}
                              {isPending && (
                                <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-950 border border-amber-300 font-black text-[10px] px-2.5 py-1 rounded-lg animate-pulse">
                                  <Clock className="w-3 h-3 text-amber-700 animate-spin" />
                                  <span>في الطابور</span>
                                </span>
                              )}
                              {isProcessing && (
                                <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-950 border border-blue-300 font-black text-[10px] px-2.5 py-1 rounded-lg">
                                  <Loader2 className="w-3 h-3 text-blue-700 animate-spin" />
                                  <span>جاري الإرسال</span>
                                </span>
                              )}
                              {isFailed && (
                                <span
                                  className="inline-flex items-center gap-1 bg-rose-100 text-rose-950 border border-rose-300 font-black text-[10px] px-2.5 py-1 rounded-lg cursor-help"
                                  title={msg.error || "خطأ غير محدد في إرسال الرسالة"}
                                >
                                  <AlertCircle className="w-3 h-3 text-rose-700" />
                                  <span>تعثر الإرسال</span>
                                </span>
                              )}
                            </td>

                            {/* Actions */}
                            <td className="p-3.5 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setSelectedMessageForModal(msg)}
                                  className="p-1.5 rounded-lg text-gray-500 hover:text-emerald-700 hover:bg-emerald-50 transition-colors cursor-pointer"
                                  title="معاينة تفاصيل الرسالة"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>

                                {isFailed && (
                                  <button
                                    type="button"
                                    disabled={retryingMessageId === msg.id}
                                    onClick={() => handleRetryMessage(msg.id)}
                                    className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-50 transition-colors cursor-pointer"
                                    title="إعادة المحاولة فورياً"
                                  >
                                    <RefreshCw className={`w-4 h-4 ${retryingMessageId === msg.id ? "animate-spin text-amber-700" : ""}`} />
                                  </button>
                                )}

                                {isPending && (
                                  <button
                                    type="button"
                                    disabled={cancellingMessageId === msg.id}
                                    onClick={() => handleCancelMessage(msg.id)}
                                    className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 transition-colors cursor-pointer"
                                    title="إلغاء وحذف الرسالة من الطابور"
                                  >
                                    <Trash2 className={`w-4 h-4 ${cancellingMessageId === msg.id ? "animate-spin" : ""}`} />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      })()}

      {/* TAB 2: CLIENT ROUTING MATRIX */}
      {activeTab === "routing" && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden space-y-4 p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-gray-900 font-bold text-sm">جدول توجيه الشركات لأرقام الواتساب المخصصة</h3>
              <p className="text-gray-400 text-xs mt-0.5">
                حدد لكل شركة القناة/الرقم الذي ترغب بأن تخرج منه رسائل التحقق (OTP) والتقارير الدورية تلقائياً.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="بحث عن شركة أو هاتف..."
                  value={companySearch}
                  onChange={(e) => setCompanySearch(e.target.value)}
                  className="pr-9 pl-3 py-2 rounded-xl border border-gray-200 text-xs outline-none focus:border-emerald-500 w-56"
                />
              </div>

              <FilterDropdown
                value={companyChannelFilter}
                onChange={setCompanyChannelFilter}
                channels={channels}
              />
            </div>
          </div>

          <div className="overflow-x-auto border border-gray-200 rounded-2xl shadow-xs">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-100 text-slate-950 font-black border-b border-slate-300">
                <tr>
                  <th className="p-3.5 text-slate-950 font-black">الشركة</th>
                  <th className="p-3.5 text-slate-950 font-black">الباقة</th>
                  <th className="p-3.5 text-slate-950 font-black">هاتف التواصل</th>
                  <th className="p-3.5 text-slate-950 font-black">قناة الواتساب المخصصة للإرسال</th>
                  <th className="p-3.5 text-center text-slate-950 font-black">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredCompanies.map((comp) => {
                  const currentChannel = channels.find((ch) => ch.id === comp.whatsapp_channel_id);
                  const isCustom = Boolean(comp.whatsapp_channel_id);

                  return (
                    <tr key={comp.id} className="hover:bg-gray-50/70 transition-colors">
                      <td className="p-3.5 font-black text-slate-950 text-sm">{comp.name}</td>
                      <td className="p-3.5">
                        <span className="bg-emerald-50 text-emerald-900 border border-emerald-300 px-2.5 py-0.5 rounded-full font-black text-[11px]">
                          {comp.plan === "Free" ? "Starter" : (comp.plan || "Starter")}
                        </span>
                      </td>
                      <td className="p-3.5 font-black text-slate-950 font-mono text-xs">{comp.phone || "—"}</td>
                      <td className="p-3.5 min-w-[270px]">
                        <ChannelSelectDropdown
                          value={comp.whatsapp_channel_id || "default"}
                          onChange={(targetVal) => handleAssignCompanyChannel(comp.id, targetVal)}
                          channels={channels}
                        />
                      </td>
                      <td className="p-3.5 text-center">
                        <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                          isCustom
                            ? "bg-purple-50 text-purple-700 border border-purple-100"
                            : "bg-gray-100 text-gray-500"
                        }`}>
                          {isCustom ? `رقم خاص (${currentChannel?.name || "مخصص"})` : "رقم عام"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: API KEYS MANAGEMENT */}
      {activeTab === "apikeys" && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-gray-900 font-bold text-sm">مفاتيح الربط الخارجي (REST API Keys)</h3>
              <p className="text-gray-400 text-xs mt-0.5">
                استخدم هذه المفاتيح لربط متاجرك ومواقعك وتطبيقاتك الخارجية لإرسال رسائل فورية من خلال قنوات الواتساب الخاصة بك.
              </p>
            </div>
            <button
              onClick={() => setIsKeyModalOpen(true)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>توليد مفتاح جديد</span>
            </button>
          </div>

          <div className="overflow-x-auto border border-gray-200 rounded-2xl shadow-xs">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-100 text-slate-950 font-black border-b border-slate-300">
                <tr>
                  <th className="p-3.5 text-slate-950 font-black">اسم النظام / التطبيق</th>
                  <th className="p-3.5 text-slate-950 font-black">مفتاح الـ API (Secret Token)</th>
                  <th className="p-3.5 text-slate-950 font-black">القناة المربوطة</th>
                  <th className="p-3.5 text-slate-950 font-black">الحد الأقصى / دقيقة</th>
                  <th className="p-3.5 text-slate-950 font-black">إجمالي الإرسال</th>
                  <th className="p-3.5 text-slate-950 font-black">آخر استخدام</th>
                  <th className="p-3.5 text-center text-slate-950 font-black">الحالة</th>
                  <th className="p-3.5 text-center text-slate-950 font-black">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {apiKeys.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="p-8 text-center text-slate-500 font-bold text-xs">
                      لا توجد أي مفاتيح API مولدة حالياً. اضغط على زر "توليد مفتاح جديد" أعلاه للبدء.
                    </td>
                  </tr>
                ) : (
                  apiKeys.map((k) => {
                    const isVisible = visibleKeyId === k.id;
                    const isCopied = copiedKeyId === k.id;
                    const channelName = k.whatsapp_channels?.name || "القناة الافتراضية";

                    return (
                      <tr key={k.id} className="hover:bg-gray-50/70 transition-colors">
                        <td className="p-3.5 font-black text-slate-950 text-sm">{k.name}</td>
                        <td className="p-3.5">
                          <div className="flex items-center justify-between gap-2.5 bg-slate-950 text-white px-3 py-1.5 rounded-xl border border-slate-700 max-w-xs font-mono text-xs shadow-xs">
                            <span className="truncate text-emerald-400 font-bold tracking-wider select-all" dir="ltr">
                              {isVisible ? k.api_key : `${k.api_key.substring(0, 10)}••••••••••••••••`}
                            </span>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={() => setVisibleKeyId(isVisible ? null : k.id)}
                                className="p-1 rounded-md text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                                title={isVisible ? "إخفاء المفتاح" : "إظهار المفتاح"}
                              >
                                {isVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                              </button>
                              <button
                                onClick={() => copyToClipboard(k.api_key, k.id)}
                                className="p-1 rounded-md text-slate-300 hover:text-emerald-400 hover:bg-slate-800 transition-colors"
                                title="نسخ المفتاح"
                              >
                                {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          </div>
                        </td>
                        <td className="p-3.5">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-950 border border-emerald-300 font-black text-xs">
                            <span>📲</span>
                            <span>{channelName}</span>
                          </span>
                        </td>
                        <td className="p-3.5 text-slate-950 font-black font-mono text-xs">{k.rate_limit_per_minute}/دقيقة</td>
                        <td className="p-3.5 font-black text-slate-950 font-mono text-sm">{k.total_sent || 0}</td>
                        <td className="p-3.5 text-slate-900 font-bold text-xs">
                          {k.last_used_at ? new Date(k.last_used_at).toLocaleDateString('ar-SA') : "لم يستخدم بعد"}
                        </td>
                        <td className="p-3.5 text-center">
                          <button
                            onClick={() => handleToggleKeyStatus(k.id, k.is_active)}
                            className={`px-3 py-1 rounded-full font-black text-xs transition-all border ${
                              k.is_active
                                ? "bg-emerald-100 text-emerald-950 border-emerald-400 shadow-xs"
                                : "bg-red-100 text-red-950 border-red-300"
                            }`}
                          >
                            {k.is_active ? "🟢 نشط" : "🔴 معطل"}
                          </button>
                        </td>
                        <td className="p-3.5 text-center">
                          <button
                            onClick={() => handleDeleteApiKey(k.id)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-red-700 hover:bg-red-50 border border-transparent hover:border-red-200 transition-all"
                            title="حذف المفتاح"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: DEVELOPER DOCS & LIVE SANDBOX */}
      {activeTab === "docs" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Documentation & Code Snippets */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-gray-900 font-bold text-sm flex items-center gap-2">
                  <Code2 className="w-4 h-4 text-emerald-600" />
                  <span>وثائق الربط البرمجي (Developer Integration)</span>
                </h3>
                <p className="text-gray-400 text-xs mt-0.5">
                  أرسل طلب POST إلى الرابط الموحد مع تمرير مفتاح الـ API في الترويسة (Header).
                </p>
              </div>

              <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl text-xs font-bold">
                {["curl", "js", "python", "php"].map((lang) => (
                  <button
                    key={lang}
                    onClick={() => setDocLang(lang)}
                    className={`px-2.5 py-1 rounded-lg transition-all uppercase ${
                      docLang === lang
                        ? "bg-white text-gray-900 shadow-xs"
                        : "text-gray-500 hover:text-gray-900"
                    }`}
                  >
                    {lang}
                  </button>
                ))}
              </div>
            </div>

            {/* Code Display */}
            <div className="relative group">
              <pre
                className="bg-gray-950 text-gray-100 p-4 rounded-xl text-xs font-mono overflow-x-auto leading-relaxed border border-gray-800"
                style={{ direction: "ltr", textAlign: "left" }}
              >
                {codeSnippets[docLang]}
              </pre>
              <button
                onClick={() => copyToClipboard(codeSnippets[docLang], "snippet")}
                className="absolute top-3 left-3 bg-gray-800/80 hover:bg-gray-700 text-gray-200 px-2.5 py-1 rounded-lg text-xs flex items-center gap-1.5 transition-colors border border-gray-700"
              >
                <Copy className="w-3 h-3" />
                <span>نسخ الكود</span>
              </button>
            </div>

            {/* API Specs Accordion */}
            <div className="p-4 rounded-xl bg-gray-50 border border-gray-100 space-y-2 text-xs text-gray-600">
              <div className="font-bold text-gray-800">مواصفات الاستدعاء:</div>
              <div className="space-y-1 text-[11px] font-mono" style={{ direction: "ltr", textAlign: "left" }}>
                <div><strong>Endpoint:</strong> POST {process.env.REACT_APP_SUPABASE_URL || 'https://bpmbtursvnkdmnybzvrm.supabase.co'}/functions/v1/whatsapp-gateway</div>
                <div><strong>Header:</strong> x-api-key: kwa_live_...</div>
                <div><strong>Body:</strong> &#123; "phone": "201...", "message": "Text", "priority": 10 &#125;</div>
              </div>
            </div>
          </div>

          {/* Interactive Sandbox Test Console */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
            <div>
              <h3 className="text-gray-900 font-bold text-sm flex items-center gap-2">
                <Terminal className="w-4 h-4 text-purple-600" />
                <span>الـ Sandbox التفاعلي (Live API Console)</span>
              </h3>
              <p className="text-gray-400 text-xs mt-0.5">
                اختبر إرسال رسالة تجريبية مباشرة من المتصفح باستخدام المفتاح المحدد وتحقق من استجابة الخادم فورياً.
              </p>
            </div>

            <form onSubmit={handleSendTestMessage} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">المفتاح المستخدم في الاختبار:</label>
                <select
                  value={sandboxKey}
                  onChange={(e) => setSandboxKey(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs outline-none focus:border-emerald-500 bg-white"
                >
                  {apiKeys.map((k) => (
                    <option key={k.id} value={k.api_key}>
                      {k.name} ({k.api_key.substring(0, 16)}...)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">رقم الهاتف المستلم (بمفتاح الدولة):</label>
                <input
                  type="text"
                  placeholder="201012345678"
                  value={sandboxPhone}
                  onChange={(e) => setSandboxPhone(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs outline-none focus:border-emerald-500 font-mono"
                  style={{ direction: "ltr" }}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">نص الرسالة:</label>
                <textarea
                  rows="3"
                  value={sandboxMessage}
                  onChange={(e) => setSandboxMessage(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs outline-none focus:border-emerald-500"
                />
              </div>

              <button
                type="submit"
                disabled={sandboxSending || !sandboxKey}
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-sm"
              >
                {sandboxSending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>جاري الإرسال والتحقق...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>إرسال الرسالة عبر الـ API</span>
                  </>
                )}
              </button>
            </form>

            {/* Sandbox Response Viewer */}
            {sandboxResponse && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-4 rounded-xl border text-xs font-mono space-y-2 ${
                  sandboxResponse.ok
                    ? "bg-emerald-950/90 border-emerald-800 text-emerald-200"
                    : "bg-red-950/90 border-red-800 text-red-200"
                }`}
                style={{ direction: "ltr", textAlign: "left" }}
              >
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                  <span className="font-bold">Status: {sandboxResponse.status}</span>
                  <span className="text-[11px] opacity-80">{sandboxResponse.responseTime}</span>
                </div>
                <pre className="overflow-x-auto text-[11px] whitespace-pre-wrap">
                  {JSON.stringify(sandboxResponse.body, null, 2)}
                </pre>
              </motion.div>
            )}
          </div>
        </div>
      )}

      {/* TAB: DECENTRALIZED CLUSTER & SMART LEADER ELECTION */}
      {activeTab === "cluster" && (() => {
        // Calculate alive nodes (< 180s and status != offline)
        const aliveNodes = nodes.filter((n) => {
          const lastSeen = n.last_seen ? new Date(n.last_seen).getTime() : 0;
          return (Date.now() - lastSeen) < 180000 && n.status !== "offline";
        });
        const activeNodesCount = aliveNodes.length;

        // Check if lock heartbeat is fresh (< 120s)
        const isLockHeartbeatFresh = Boolean(
          clusterLock?.node_id &&
          clusterLock?.last_heartbeat &&
          (Date.now() - new Date(clusterLock.last_heartbeat).getTime()) < 120000
        );

        const leaderNode = clusterLock?.node_id
          ? nodes.find((n) => n.node_id === clusterLock.node_id)
          : null;

        const isLeaderAlive = Boolean(
          clusterLock?.node_id &&
          isLockHeartbeatFresh &&
          (
            aliveNodes.some((n) => n.node_id === clusterLock.node_id) ||
            (leaderNode && leaderNode.status !== "offline")
          )
        );

        const activeLeader = isLeaderAlive ? leaderNode : null;
        const standbyCount = Math.max(0, activeNodesCount - (isLeaderAlive ? 1 : 0));

        const formatTimeAgo = (sec) => {
          if (sec === null || isNaN(sec)) return "—";
          if (sec < 60) return `منذ ${sec}ث`;
          if (sec < 3600) return `منذ ${Math.round(sec / 60)}د`;
          if (sec < 86400) return `منذ ${Math.round(sec / 3600)}س`;
          return `منذ ${Math.round(sec / 86400)} يوم`;
        };

        return (
          <div className="space-y-6">
            {/* Top Cluster Banner & Control */}
            <div className="bg-gradient-to-l from-slate-900 via-slate-800 to-indigo-950 rounded-2xl p-6 text-white shadow-md border border-slate-700 relative overflow-hidden">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
                <div className="space-y-2 max-w-2xl">
                  <div className="flex items-center gap-2">
                    <span className="flex h-2.5 w-2.5 relative">
                      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${
                        activeNodesCount > 0 ? "bg-emerald-400 opacity-75" : "bg-gray-400 opacity-20"
                      }`}></span>
                      <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                        activeNodesCount > 0 ? "bg-emerald-500" : "bg-gray-400"
                      }`}></span>
                    </span>
                    <span className={`text-xs font-bold uppercase tracking-wider ${
                      activeNodesCount > 0 ? "text-emerald-400" : "text-gray-400"
                    }`}>
                      {activeNodesCount > 0
                        ? "الشبكة اللامركزية النشطة (Active Decentralized Cluster)"
                        : "الشبكة اللامركزية في وضع التوقف (Cluster Offline / All Nodes Inactive)"}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-white">
                    منظومة الحصانة اللامركزية والاستحواذ الذكي على القيادة
                  </h3>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    تعمل أجهزة ومحطات كوادر بنظام الند للند (Peer-to-Peer Cluster) عبر قاعدة بيانات موحدة وأقفال ذرية تمنع انقسام الدماغ (Split-Brain). في حال انقطاع القائد أو إغلاق جهازه أو تجمد المتصفح، تستحوذ إحدى العقد البديلة على القيادة فورياً في أجزاء من الثانية دون أي توقف لخدمة الإرسال.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <button
                    onClick={fetchData}
                    disabled={loading}
                    className="px-4 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-600 text-xs font-bold transition-all flex items-center justify-center gap-2"
                  >
                    <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-emerald-400" : ""}`} />
                    <span>تحديث حالة الشبكة</span>
                  </button>

                  {/* ✅ إصلاح #2: زر تنظيف العقد الشبح — يظهر فقط إذا كانت هناك عقد ميتة */}
                  {nodes.some((n) => (Date.now() - new Date(n.last_seen || 0).getTime()) > 3 * 60 * 1000) && (
                    <button
                      onClick={handlePurgeGhostNodes}
                      disabled={purgingGhosts}
                      className="px-4 py-2.5 rounded-xl bg-red-900/70 hover:bg-red-800 text-red-200 border border-red-700 text-xs font-black transition-all flex items-center justify-center gap-2"
                      title={t.titlePurgeGhostNodes || "حذف العقد الشبح (inactive nodes) التي لم ترسل نبضة منذ أكثر من 3 دقائق"}
                    >
                      {purgingGhosts ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <X className="w-4 h-4" />
                      )}
                      <span>{t.btnPurgeGhostNodes || "🧹 تنظيف العقد الشبح"}</span>
                    </button>
                  )}

                  <button
                    onClick={handleForceFailover}
                    disabled={failingOver || !isLeaderAlive || activeNodesCount < 2}
                    className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 shadow-lg ${
                      !isLeaderAlive || activeNodesCount < 2
                        ? "bg-slate-800/80 text-slate-500 border border-slate-700 cursor-not-allowed"
                        : "bg-amber-500 hover:bg-amber-600 text-slate-950 hover:shadow-amber-500/20 active:scale-95"
                    }`}
                    title={
                      !isLeaderAlive
                        ? "لا يوجد قائد نشط حالياً للتنحي عنه"
                        : activeNodesCount < 2
                        ? "يلزم وجود جهازين على الأقل لاختبار انتقال القيادة التلقائي"
                        : "إجبار القائد الحالي على التنحي واختبار انتقال القيادة السريع لعقدة بديلة"
                    }
                  >
                    {failingOver ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <RefreshCcw className="w-4 h-4" />
                    )}
                    <span>⚡ اختبار الاستحواذ التلقائي (Force Failover)</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Educational Concept Banner */}
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-start gap-3.5 text-xs text-amber-950">
              <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h5 className="font-bold text-amber-900 text-sm">
                  لماذا يعتمد النظام على توزيع الأدوار: "القائد" و "الاستعداد"؟
                </h5>
                <p className="text-amber-800 leading-relaxed">
                  واتساب لا يسمح بفتح جلسة نفس الرقم على أكثر من متصفح في وقت واحد لمنع حظر الرقم أو تكرار الرسائل. لذلك تختار المنظومة تلقائياً جهازاً واحداً فقط ليكون <strong>القائد النشط (Leader)</strong>؛ وهو الجهاز الفعلي الذي يفتح المتصفح ويرسل رسائل الـ OTP والتقارير والرواتب فوراً. أما الأجهزة الأخرى فتعمل في وضع <strong>الاستعداد (Standby)</strong> كبديل فوري يستحوذ على القيادة في أقل من 300 مللي ثانية دون أي تدخل بشري في حال إغلاق جهاز القائد أو انقطاع الإنترنت عنه.
                </p>
              </div>
            </div>

            {/* Cluster KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* KPI 1: Active Leader */}
              <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-xs relative overflow-hidden">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-500">القائد النشط (المرسل الفعلي)</span>
                  <span className={`p-2 rounded-xl ${isLeaderAlive ? "bg-amber-50 text-amber-600" : "bg-gray-100 text-gray-400"}`}>
                    {isLeaderAlive ? <ShieldCheck className="w-4 h-4" /> : <ShieldAlert className="w-4 h-4" />}
                  </span>
                </div>
                <div className="mt-2 text-sm font-black text-gray-900 truncate" title={isLeaderAlive ? (clusterLock?.node_id || "نشط") : "لا يوجد قائد نشط"}>
                  {isLeaderAlive ? (
                    <div className="flex items-center gap-1.5">
                      <Laptop className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span className="font-bold">
                        {activeLeader?.hostname || "سيرفر ويندوز محلي"}
                      </span>
                      <span className="text-[10px] text-gray-400 font-mono">
                        (v{activeLeader?.version || "2.1"})
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-gray-500 font-bold">
                      <span>لا يوجد قائد نشط حالياً</span>
                      {leaderNode?.hostname && (
                        <span className="text-[10px] text-gray-400 font-normal">
                          (السابق: {leaderNode.hostname})
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <div className={`mt-1 flex items-center gap-1.5 text-[11px] font-semibold ${
                  isLeaderAlive ? "text-emerald-600" : "text-gray-400"
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    isLeaderAlive ? "bg-emerald-500 animate-pulse" : "bg-gray-300"
                  }`}></span>
                  <span>
                    {isLeaderAlive
                      ? "المتحكم بمتصفح الواتساب وجلسة الإرسال"
                      : "جميع الأجهزة غير متصلة (الخدمة متوقفة)"}
                  </span>
                </div>
              </div>

              {/* KPI 2: Total Nodes */}
              <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-500">العُقد المتصلة بالشبكة</span>
                  <span className={`p-2 rounded-xl ${activeNodesCount > 0 ? "bg-emerald-50 text-emerald-600" : "bg-gray-100 text-gray-400"}`}>
                    <Server className="w-4 h-4" />
                  </span>
                </div>
                <div className="mt-2 text-2xl font-black text-gray-900">
                  {activeNodesCount} <span className="text-xs font-medium text-gray-400">عقدة نشطة</span>
                </div>
                <div className="mt-1 text-[11px] text-gray-500">
                  {isLeaderAlive ? 1 : 0} قائد نشط • {standbyCount} في وضع الاستعداد
                </div>
              </div>

              {/* KPI 3: Failover Latency */}
              <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-500">سرعة الاستحواذ التلقائي</span>
                  <span className={`p-2 rounded-xl ${activeNodesCount > 0 ? "bg-indigo-50 text-indigo-600" : "bg-gray-100 text-gray-400"}`}>
                    <Zap className="w-4 h-4" />
                  </span>
                </div>
                <div className="mt-2 text-2xl font-black text-indigo-600 font-mono">
                  &lt; 300 <span className="text-xs font-medium text-indigo-400">ms</span>
                </div>
                <div className="mt-1 text-[11px] text-gray-500">
                  {activeNodesCount > 1
                    ? "استجابة فورية عبر Realtime CAS"
                    : activeNodesCount === 1
                    ? "جهاز واحد نشط (لا يوجد بديل)"
                    : "لا توجد أجهزة متصلة"}
                </div>
              </div>

              {/* KPI 4: Immunity against Falldown */}
              <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-500">حصانة الاستقرار ومقاومة السقوط</span>
                  <span className={`p-2 rounded-xl ${activeNodesCount > 0 ? "bg-purple-50 text-purple-600" : "bg-gray-100 text-gray-400"}`}>
                    <Activity className="w-4 h-4" />
                  </span>
                </div>
                <div className="mt-2 text-2xl font-black text-purple-700">
                  {activeNodesCount > 0 ? "100%" : "0%"}
                </div>
                <div className="mt-1 text-[11px] text-gray-500 font-medium">
                  {activeNodesCount > 0
                    ? "فحص حيوية كل 5ث + تنظيف أقفال كروميوم"
                    : "بانتظار تشغيل تطبيق المزامنة على جهاز واحد على الأقل"}
                </div>
              </div>
            </div>

            {/* Workload Distribution Banner */}
            <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-indigo-50 border border-emerald-200/80 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Cpu className="w-5 h-5 text-emerald-700" />
                    <h4 className="font-black text-emerald-950 text-sm">
                      توزيع أحمال القنوات وتوفير رامات الأجهزة (Distributed Channel Affinity)
                    </h4>
                  </div>
                  <p className="text-xs text-emerald-800 leading-relaxed max-w-2xl">
                    كل جهاز عميل يخدم قناة واحدة فقط بشكل مستقل لمنع استهلاك الذاكرة (RAM) والـ CPU. يمكنك توزيع القنوات تلقائياً أو يدوياً، أو تفعيل تعدد القنوات للجهاز الواحد فقط عند نقص الأجهزة.
                  </p>
                </div>

                {/* Policy Controls & Auto Distribution Actions */}
                <div className="flex flex-wrap items-center gap-3 shrink-0">
                  {/* Auto Distribute Button */}
                  <button
                    type="button"
                    onClick={handleAutoDistributeChannels}
                    disabled={autoDistributing}
                    className="inline-flex items-center gap-2 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs hover:shadow-md transition-all shrink-0 disabled:opacity-50 cursor-pointer"
                  >
                    {autoDistributing ? (
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                    ) : (
                      <Zap className="w-4 h-4 text-emerald-200" />
                    )}
                    <span>{autoDistributing ? "جارٍ التوزيع..." : "⚡ توزيع القنوات تلقائياً"}</span>
                  </button>

                  {/* Multi-channel RAM Protection Toggle */}
                  <div className={`flex items-center gap-2.5 px-3.5 py-1.5 rounded-xl border transition-all ${
                    allowMultiChannel
                      ? "bg-amber-50/90 border-amber-300 text-amber-900"
                      : "bg-white/90 border-emerald-200 text-gray-800"
                  }`}>
                    <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-bold">
                      <input
                        type="checkbox"
                        checked={allowMultiChannel}
                        onChange={(e) => handleToggleMultiChannel(e.target.checked)}
                        disabled={savingPolicy}
                        className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                      />
                      <span className="flex items-center gap-1.5">
                        {allowMultiChannel ? (
                          <>
                            <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
                            <span>مسموح بتعدد القنوات على نفس الجهاز</span>
                          </>
                        ) : (
                          <>
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                            <span>حماية الرامات: قناة واحدة فقط لكل جهاز</span>
                          </>
                        )}
                      </span>
                    </label>
                    {savingPolicy && <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2.5 shrink-0 flex-wrap pt-2 border-t border-emerald-200/60">
                <span className="text-[11px] font-black text-emerald-900">توزيع الأجهزة الحالي:</span>
                {channels.map((ch) => {
                  const assignedCount = nodes.filter((n) => {
                    const assigned = nodeAssignments[n.hostname] !== undefined ? nodeAssignments[n.hostname] : n.channel_id;
                    return ch.is_default ? (!assigned) : (assigned === ch.id);
                  }).length;
                  return (
                    <div
                      key={ch.id}
                      className="bg-white/95 backdrop-blur-xs px-3 py-1.5 rounded-xl border border-emerald-200 shadow-2xs text-xs font-bold text-gray-800 flex items-center gap-2"
                    >
                      <span className={`w-2 h-2 rounded-full ${assignedCount > 0 ? "bg-emerald-500 animate-pulse" : "bg-gray-300"}`} />
                      <span>{ch.name}:</span>
                      <span className="text-emerald-700 font-black font-mono">{assignedCount} {assignedCount === 1 ? "جهاز" : "أجهزة"}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Active Nodes Table / Cards */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
              <div className="p-5 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="font-bold text-gray-900 text-sm">أجهزة وعُقد شبكة الواتساب المتصلة</h4>
                  <p className="text-gray-400 text-xs mt-0.5">
                    توضح هذه اللوحة جميع الأجهزة التي تشغل خدمة كوادر وحالة كفاءتها الصحية وأدوارها الحالية.
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {/* زر ومفتاح تشغيل أكثر من سيشن على الأجهزة */}
                  <label className={`flex items-center gap-2 px-3 py-1 rounded-full border cursor-pointer select-none text-xs font-bold transition-all ${
                    allowMultiChannel
                      ? "bg-amber-50 border-amber-300 text-amber-900 shadow-2xs"
                      : "bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100/60 shadow-2xs"
                  }`}>
                    <input
                      type="checkbox"
                      checked={allowMultiChannel}
                      onChange={(e) => handleToggleMultiChannel(e.target.checked)}
                      disabled={savingPolicy}
                      className="rounded text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5 cursor-pointer"
                    />
                    <span>{allowMultiChannel ? "⚠️ مسموح بتشغيل أكثر من سيشن على الجهاز" : "🛡️ تشغيل سيشن واحدة فقط لكل جهاز (توفير الرام)"}</span>
                    {savingPolicy && <Loader2 className="w-3 h-3 animate-spin text-emerald-600" />}
                  </label>

                  <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
                    {activeNodesCount} عقدة نشطة
                  </span>
                  {nodes.length > activeNodesCount && (
                    <button
                      onClick={handlePurgeDeadNodes}
                      className="text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-2.5 py-1 rounded-full transition-colors flex items-center gap-1 cursor-pointer"
                      title={t.titlePurgeDeadRecords || "تنظيف السجلات القديمة المنتهية من قاعدة البيانات"}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      {(t.btnPurgeDeadRecords || "تنظيف السجلات القديمة")} ({nodes.length - activeNodesCount})
                    </button>
                  )}
                </div>
              </div>

              {nodes.length === 0 ? (
                <div className="p-8 text-center space-y-2">
                  <Server className="w-8 h-8 text-gray-300 mx-auto" />
                  <div className="text-xs font-bold text-gray-600">لم يتم رصد أي عقد نشطة حالياً</div>
                  <p className="text-[11px] text-gray-400">
                    تأكد من تشغيل تطبيق مزامنة كوادر أو خدمة الواتساب (whatsapp-node.exe) على جهاز واحد على الأقل.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {nodes.map((node) => {
                    const lastSeenDate = node.last_seen ? new Date(node.last_seen) : null;
                    const secondsAgo = lastSeenDate ? Math.max(0, Math.round((Date.now() - lastSeenDate.getTime()) / 1000)) : null;
                    const isAlive = secondsAgo !== null && secondsAgo < 180 && node.status !== "offline";
                    const isLeaderNode = isAlive && isLeaderAlive && (clusterLock?.node_id === node.node_id);

                    return (
                      <div
                        key={node.node_id}
                        className={`p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors ${
                          !isAlive
                            ? "bg-gray-50/40 opacity-60"
                            : isLeaderNode
                            ? "bg-amber-50/40"
                            : "hover:bg-gray-50/80"
                        }`}
                      >
                        <div className="flex items-start md:items-center gap-3.5">
                          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-sm ${
                            !isAlive
                              ? "bg-gray-100 text-gray-400 border border-gray-200"
                              : isLeaderNode
                              ? "bg-amber-500 text-white shadow-md shadow-amber-500/20"
                              : "bg-slate-100 text-slate-600 border border-slate-200"
                          }`}>
                            {!isAlive ? <Server className="w-5 h-5 text-gray-400" /> : isLeaderNode ? "👑" : <Server className="w-5 h-5" />}
                          </div>

                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-gray-900 text-sm font-mono">{node.node_id}</span>
                              {!isAlive ? (
                                <span className="bg-red-100 text-red-700 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-red-200 flex items-center gap-1">
                                  {t.lblGhostNodeBadge || "👻 عقدة شبح — منقطع منذ"} {secondsAgo !== null ? formatTimeAgo(secondsAgo) : (t.unknownTime || "مجهول")}
                                </span>
                              ) : isLeaderNode ? (
                                <span className="bg-amber-100 text-amber-800 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-amber-200">
                                  👑 القائد النشط (المرسل الفعلي)
                                </span>
                              ) : (
                                <span className="bg-blue-50 text-blue-700 text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-blue-100">
                                  🛡️ في وضع الاستعداد (Standby)
                                </span>
                              )}
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                isAlive ? "bg-emerald-50 text-emerald-700" : "bg-gray-200 text-gray-600"
                              }`}>
                                {isAlive ? "متصل وشغال" : "غير متصل"}
                              </span>
                            </div>

                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-gray-500">
                              <span>جهاز الكمبيوتر: <strong className="text-gray-800">{node.hostname || "Windows PC"}</strong></span>
                              <span>البرنامج: <strong className="text-indigo-700 font-mono">Kwader-WS v{node.version || "2.1.0"}</strong></span>
                              <span>
                                القناة المربوطة حالياً:{" "}
                                <strong className="text-emerald-700 font-semibold">
                                  {node.channel_id
                                    ? (channels.find((c) => c.id === node.channel_id)?.name || node.channel_id.substring(0, 8))
                                    : "القناة الافتراضية العامة (+201017840294)"}
                                </strong>
                              </span>
                            </div>

                            {/* التحكم السحابي في توجيه وتخصيص القناة للجهاز */}
                            {node.hostname && (
                              <div className="flex flex-wrap items-center gap-2 mt-2 pt-2 border-t border-gray-100">
                                <span className="text-[11px] font-bold text-gray-500 flex items-center gap-1">
                                  <Cpu className="w-3.5 h-3.5 text-indigo-500" />
                                  <span>تخصيص القناة لهذا الجهاز:</span>
                                </span>
                                <select
                                  value={nodeAssignments[node.hostname] || ""}
                                  onChange={(e) => handleAssignChannelToNode(node.hostname, e.target.value || null)}
                                  disabled={assigningNode === node.hostname}
                                  className="text-xs font-bold bg-white hover:bg-gray-50 text-gray-800 border border-gray-200 rounded-xl px-2.5 py-1 transition-all cursor-pointer shadow-2xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                                >
                                  <option value="">القناة الافتراضية العامة (تلقائي)</option>
                                  {channels.filter((c) => !c.is_default).map((ch) => (
                                    <option key={ch.id} value={ch.id}>
                                      قناة: {ch.name} {ch.phone_number ? `(${ch.phone_number})` : ""}
                                    </option>
                                  ))}
                                </select>
                                {nodeAssignments[node.hostname] ? (
                                  <span className="text-[10px] font-bold px-2.5 py-0.5 bg-indigo-50 text-indigo-700 rounded-full border border-indigo-200 flex items-center gap-1">
                                    <span>🎯 مخصص سحابياً لهذه القناة</span>
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-medium text-gray-400">
                                    (يخدم القناة العامة كـ Leader أو Standby)
                                  </span>
                                )}
                                {assigningNode === node.hostname && (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Right metrics */}
                        <div className="flex items-center gap-4 text-xs">
                          {/* Server Latency / Response Time */}
                          <div className="text-center px-3 py-1.5 bg-gray-50 rounded-xl border border-gray-100">
                            <div className="text-[10px] text-gray-400 font-semibold">سرعة الاستجابة</div>
                            <div className={`font-bold font-mono flex items-center justify-center gap-1 ${
                              isAlive ? "text-emerald-700" : "text-gray-400"
                            }`}>
                              <Activity className={`w-3 h-3 ${isAlive ? "text-emerald-600 animate-pulse" : "text-gray-400"}`} />
                              <span>{isAlive ? `${node.response_time_ms || serverPingMs || 35}ms` : "مفصول"}</span>
                            </div>
                          </div>

                          {/* Health Score */}
                          <div className="text-center px-3 py-1.5 bg-gray-50 rounded-xl border border-gray-100">
                            <div className="text-[10px] text-gray-400 font-semibold">الكفاءة الصحية</div>
                            <div className={`font-black ${isAlive ? "text-emerald-600" : "text-gray-400"}`}>
                              {isAlive ? `${node.health_score || 100}%` : "0%"}
                            </div>
                          </div>

                          {/* Memory RSS */}
                          <div className="text-center px-3 py-1.5 bg-gray-50 rounded-xl border border-gray-100">
                            <div className="text-[10px] text-gray-400 font-semibold">استهلاك الذاكرة</div>
                            <div className="font-bold text-gray-800 font-mono">
                              {isAlive && node.memory_rss_mb ? `${node.memory_rss_mb} MB` : "—"}
                            </div>
                          </div>

                          {/* Uptime */}
                          <div className="text-center px-3 py-1.5 bg-gray-50 rounded-xl border border-gray-100">
                            <div className="text-[10px] text-gray-400 font-semibold">مدة التشغيل</div>
                            <div className="font-bold text-gray-800 font-mono">
                              {isAlive && node.uptime_seconds ? `${Math.round(node.uptime_seconds / 60)}د` : "—"}
                            </div>
                          </div>

                          {/* Last Pulse */}
                          <div className="text-left px-3 py-1.5 bg-gray-50 rounded-xl border border-gray-100 min-w-[90px]">
                            <div className="text-[10px] text-gray-400 font-semibold">آخر نبضة حياة</div>
                            <div className="font-medium text-gray-700 text-[11px]">
                              {formatTimeAgo(secondsAgo)}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Architectural Blueprint & Falldown Prevention Matrix */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-4">
              <div>
                <h4 className="font-bold text-gray-900 text-sm flex items-center gap-2">
                  <Shield className="w-4 h-4 text-emerald-600" />
                  <span>الاستراكشر وطريقة عمل الحصانة اللامركزية ومنع الـ Falldown المفاجئ</span>
                </h4>
                <p className="text-gray-400 text-xs mt-0.5">
                  تصميم هندسي متكامل ومبني على أفضل ممارسات الأنظمة الموزعة العالمية (Distributed Consensus & Cooperative Failover):
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                {/* Pillar 1 */}
                <div className="p-4 rounded-xl border border-gray-100 bg-gray-50/60 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-gray-800">
                    <span className="w-5 h-5 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-black">1</span>
                    <span>الانتخاب الذري وحصانة انقسام الدماغ (Atomic CAS & Zero Split-Brain)</span>
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    تعتمد المنظومة على دالة <code className="font-mono text-emerald-700 bg-emerald-50 px-1 rounded">acquire_whatsapp_lock</code> المزودة بقفل الصف الصارم (<code className="font-mono text-slate-700">FOR UPDATE</code>). هذا يضمن رياضياً أنه يستحيل لعقدتين أن تصبحا قائدين في نفس اللحظة مهما بلغت سرعة الأجهزة وتزامنها.
                  </p>
                </div>

                {/* Pillar 2 */}
                <div className="p-4 rounded-xl border border-gray-100 bg-gray-50/60 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-gray-800">
                    <span className="w-5 h-5 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-black">2</span>
                    <span>مستشعر حيوية القائد ومقاومة الزومبي (Active Liveness Probe)</span>
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    أكبر خطر في روبوتات الواتساب هو تجمد متصفح كروميوم بينما تظل عملية Node.js تعمل كزومبي. النظام يقوم بفحص حقيقي كل 5 ثوانٍ عبر <code className="font-mono text-indigo-700 bg-indigo-50 px-1 rounded">waClient.getState()</code>. إذا تجمد المتصفح لمرتين، يتنحى القائد فورياً ويحرر القفل لعقدة بديلة سليمة.
                  </p>
                </div>

                {/* Pillar 3 */}
                <div className="p-4 rounded-xl border border-gray-100 bg-gray-50/60 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-gray-800">
                    <span className="w-5 h-5 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center text-xs font-black">3</span>
                    <span>الاستحواذ الفوري الذكي بالوقت الفعلي (Realtime Fast-Track Takeover)</span>
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    لا تنتظر العقد البديلة المؤقت الدوري (60 ثانية) عندما يسقط القائد، بل ترصد إخلاء القفل عبر قناة <code className="font-mono text-amber-700 bg-amber-50 px-1 rounded">Supabase Realtime</code> خلال 50 إلى 300 مللي ثانية، وتستحوذ العقدة ذات الكفاءة الأعلى (100% Health Score) بأولوية فورية.
                  </p>
                </div>

                {/* Pillar 4 */}
                <div className="p-4 rounded-xl border border-gray-100 bg-gray-50/60 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-gray-800">
                    <span className="w-5 h-5 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center text-xs font-black">4</span>
                    <span>تطهير أقفال ويندوز ومزامنة الجلسات (EBUSY Buster & Cloud Sync)</span>
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    قبل تشغيل متصفح كروميوم، تقوم الخدمة بمسح تلقائي لأقفال ويندوز العالقة (<code className="font-mono text-slate-700">SingletonLock</code>) الناتجة عن إغلاق مفاجئ للجهاز. كما تُرفع الجلسة المشفرة سحابياً، بحيث يستأنف القائد الجديد العمل فوراً دون الحاجة لمسح رمز QR من جديد.
                  </p>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
      <AnimatePresence>
        {isChannelModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl border border-gray-100 space-y-4"
            >
              <h3 className="text-gray-900 font-bold text-sm">إضافة قناة / رقم واتساب جديد</h3>

              <form onSubmit={handleCreateChannel} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">اسم القناة:</label>
                  <input
                    type="text"
                    placeholder="مثال: رقم الدعم الفني والمبيعات"
                    value={newChannelName}
                    onChange={(e) => setNewChannelName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs outline-none focus:border-emerald-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">وصف القناة (اختياري):</label>
                  <input
                    type="text"
                    placeholder="مخصصة للعملاء المميزين أو المتاجر الخارجية"
                    value={newChannelDesc}
                    onChange={(e) => setNewChannelDesc(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="isDefaultChannel"
                    checked={newChannelDefault}
                    onChange={(e) => setNewChannelDefault(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <label htmlFor="isDefaultChannel" className="text-xs text-gray-700 font-medium">
                    تعيين كقناة افتراضية للنظام
                  </label>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setIsChannelModalOpen(false)}
                    className="px-4 py-2 rounded-xl border border-gray-200 text-gray-600 text-xs font-bold hover:bg-gray-50"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={creatingChannel}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-2"
                  >
                    {creatingChannel && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>إنشاء القناة</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: CREATE API KEY */}
      <AnimatePresence>
        {isKeyModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl border border-gray-100 space-y-4"
            >
              <h3 className="text-gray-900 font-bold text-sm">توليد مفتاح API خارجي جديد</h3>

              <form onSubmit={handleCreateApiKey} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">اسم النظام أو الموقع:</label>
                  <input
                    type="text"
                    placeholder="مثال: متجر ووكومرس، موقع الحجوزات"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs outline-none focus:border-emerald-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">القناة المربوطة للإرسال:</label>
                  <select
                    value={newKeyChannelId}
                    onChange={(e) => setNewKeyChannelId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs outline-none focus:border-emerald-500 bg-white text-gray-900 font-bold"
                  >
                    <option value="">القناة الافتراضية للنظام تلقائياً</option>
                    {channels
                      .filter((ch) => !ch.is_default)
                      .map((ch) => (
                        <option key={ch.id} value={ch.id}>
                          📲 {ch.name}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">الحد الأقصى للطلبات (في الدقيقة):</label>
                  <input
                    type="number"
                    value={newKeyRateLimit}
                    onChange={(e) => setNewKeyRateLimit(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs outline-none focus:border-emerald-500 font-mono"
                    min="1"
                    max="1000"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setIsKeyModalOpen(false)}
                    className="px-4 py-2 rounded-xl border border-gray-200 text-gray-600 text-xs font-bold hover:bg-gray-50"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={creatingKey}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-2"
                  >
                    {creatingKey && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>توليد وحفظ المفتاح</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: QR CODE MODAL FOR SPECIFIC CHANNEL */}
      <AnimatePresence>
        {liveQrChannel && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl border border-gray-100 space-y-4 text-center relative"
            >
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <div className="text-right">
                  <span className="font-black text-gray-950 text-sm block">ربط واتساب: {liveQrChannel.name}</span>
                  <span className="text-[11px] text-gray-500 font-medium">
                    {liveQrChannel.is_default ? "القناة الافتراضية العامة" : "قناة مخصصة"}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setQrModalChannel(null)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 text-xs font-bold transition-colors"
                >
                  ✕ إغلاق
                </button>
              </div>

              {liveQrChannel.status === "connected" && liveQrChannel.phone_number ? (
                <div className="flex flex-col items-center justify-center p-6 bg-emerald-50 rounded-2xl border border-emerald-200 text-center gap-3">
                  <div className="w-14 h-14 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-md">
                    <Check className="w-8 h-8 stroke-[3]" />
                  </div>
                  <div className="font-black text-gray-950 text-base">تم ربط القناة بنجاح! 🎉</div>
                  <p className="text-xs text-gray-700 font-bold">
                    الرقم المتصل: <span dir="ltr" className="font-mono text-emerald-700 font-black">+{liveQrChannel.phone_number}</span>
                  </p>
                  <div className="flex items-center gap-2 w-full mt-2">
                    <button
                      type="button"
                      onClick={() => handleDisconnectChannel(liveQrChannel)}
                      className="flex-1 px-4 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>تسجيل الخروج وفصل الرقم</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setQrModalChannel(null)}
                      className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition-all cursor-pointer"
                    >
                      إغلاق
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-xs text-gray-600 font-medium">
                    امسح الـ QR Code من خلال تطبيق الواتساب على الهاتف:
                    <br />
                    <span className="text-gray-950 font-black">الإعدادات &larr; الأجهزة المرتبطة &larr; ربط جهاز</span>
                  </p>

                  <div className="flex flex-col items-center justify-center p-4 bg-gray-50 rounded-2xl border border-gray-100 min-h-[240px]">
                    {liveQrChannel.qr_code ? (
                      <div className="space-y-3 flex flex-col items-center">
                        <div className="p-3 bg-white rounded-2xl border border-gray-200 shadow-sm inline-block">
                          <QRCode value={liveQrChannel.qr_code} size={210} />
                        </div>
                        <div className="flex items-center gap-2 text-[11px] font-bold text-emerald-800 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                          <span>رمز الـ QR نشط وجاهز للمسح الآن</span>
                        </div>
                      </div>
                    ) : qrWaitSeconds >= 180 ? (
                      // ✅ Timeout message: بعد 3 دقائق بدون وصول QR نعرض رسالة توضيحية
                      <div className="flex flex-col items-center justify-center text-gray-600 gap-3 py-4 text-center">
                        <span className="text-3xl">⚠️</span>
                        <div className="space-y-1">
                          <div className="text-xs font-bold text-gray-800">لم تتصل أي عقدة بالقناة بعد</div>
                          <div className="text-[11px] text-gray-500">تأكد من تشغيل تطبيق المزامنة (whatsapp-node.exe) على جهاز العميل</div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center text-gray-400 gap-3 py-6">
                        <Loader2 className="w-9 h-9 animate-spin text-emerald-600" />
                        <div className="space-y-1">
                          <div className="text-xs font-bold text-gray-800">جاري انتظار توليد رمز الـ QR من العقدة...</div>
                          <div className="text-[11px] text-gray-500">يتم فحص وتحديث الرمز تلقائياً في الخلفية ({Math.max(0, 180 - qrWaitSeconds)}ث متبقية)</div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                    <button
                      type="button"
                      disabled={refreshingQr}
                      onClick={async () => {
                        setRefreshingQr(true);
                        await fetchChannelQr(liveQrChannel.id);
                        setTimeout(() => setRefreshingQr(false), 500);
                        toast.success("تم تحديث حالة الرمز");
                      }}
                      className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-3 py-2 rounded-xl transition-all border border-emerald-200 cursor-pointer"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${refreshingQr ? "animate-spin text-emerald-700" : ""}`} />
                      <span>تحديث الرمز الآن</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setQrModalChannel(null)}
                      className="px-4 py-2 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 text-xs font-bold transition-all cursor-pointer"
                    >
                      إغلاق
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Message Inspection & Queue Details Modal */}
      <AnimatePresence>
        {selectedMessageForModal && (() => {
          const msg = selectedMessageForModal;
          const isPending = msg.status === "pending";
          const isSent = msg.status === "sent";
          const isFailed = msg.status === "failed";
          const isProcessing = msg.status === "processing";

          const msgChannel = channels.find((c) => c.id === msg.channel_id);
          const chName = msgChannel ? msgChannel.name : "القناة الافتراضية العامة";
          const chPhone = msgChannel?.phone_number || (channels.find((c) => c.is_default)?.phone_number);

          const createdDate = msg.created_at ? new Date(msg.created_at) : null;

          const isOtp = msg.message && (msg.message.includes("رمز تحقق") || msg.message.includes("OTP") || msg.message.includes("كود"));

          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                className="bg-white rounded-3xl p-6 w-full max-w-xl shadow-2xl border border-gray-200 space-y-5 text-right relative max-h-[90vh] overflow-y-auto"
              >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
                      <MessageSquareText className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-black text-gray-950 text-base">تفاصيل ومعاينة الرسالة #{msg.id}</span>
                        {isOtp && (
                          <span className="bg-amber-100 text-amber-950 border border-amber-300 px-2 py-0.5 rounded-full font-black text-[10px]">
                            🔐 رمز OTP
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-gray-500 font-medium">
                        {isSent ? "تم إرسالها وتسليمها إلى واتساب" : isPending ? "مجدولة في طابور الإرسال الفوري" : isProcessing ? "جاري معالجتها من قبل العقدة" : "تعثر الإرسال وبانتظار الإجراء"}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedMessageForModal(null)}
                    className="p-2 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Status & Channel Summary Bar */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {/* Status */}
                  <div className="p-3 bg-gray-50 border border-gray-200 rounded-2xl space-y-1">
                    <span className="text-[10px] font-bold text-gray-500 block">حالة الإرسال</span>
                    {isSent && (
                      <span className="inline-flex items-center gap-1 text-emerald-800 bg-emerald-100 font-black text-xs px-2 py-0.5 rounded-lg">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>تم الإرسال</span>
                      </span>
                    )}
                    {isPending && (
                      <span className="inline-flex items-center gap-1 text-amber-800 bg-amber-100 font-black text-xs px-2 py-0.5 rounded-lg animate-pulse">
                        <Clock className="w-3.5 h-3.5" />
                        <span>في الطابور</span>
                      </span>
                    )}
                    {isProcessing && (
                      <span className="inline-flex items-center gap-1 text-blue-800 bg-blue-100 font-black text-xs px-2 py-0.5 rounded-lg">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>جاري المعالجة</span>
                      </span>
                    )}
                    {isFailed && (
                      <span className="inline-flex items-center gap-1 text-rose-800 bg-rose-100 font-black text-xs px-2 py-0.5 rounded-lg">
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span>تعثر الإرسال</span>
                      </span>
                    )}
                  </div>

                  {/* Channel */}
                  <div className="p-3 bg-gray-50 border border-gray-200 rounded-2xl space-y-1">
                    <span className="text-[10px] font-bold text-gray-500 block">قناة الإرسال</span>
                    <span className="font-bold text-gray-900 text-xs block truncate" title={chName}>
                      {chName}
                    </span>
                    {chPhone && (
                      <span className="text-[10px] text-gray-500 font-mono font-bold block" dir="ltr">
                        +{chPhone}
                      </span>
                    )}
                  </div>

                  {/* Node */}
                  <div className="p-3 bg-gray-50 border border-gray-200 rounded-2xl space-y-1">
                    <span className="text-[10px] font-bold text-gray-500 block">محطة المعالجة</span>
                    <span className="font-mono text-xs font-bold text-indigo-900 block truncate" title={msg.node_id || "في الانتظار"}>
                      {msg.node_id ? msg.node_id.replace("Demo-", "") : "في الانتظار"}
                    </span>
                  </div>

                  {/* Time */}
                  <div className="p-3 bg-gray-50 border border-gray-200 rounded-2xl space-y-1">
                    <span className="text-[10px] font-bold text-gray-500 block">وقت الإنشاء</span>
                    <span className="text-xs font-bold text-gray-800 block">
                      {createdDate ? createdDate.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }) : "—"}
                    </span>
                    <span className="text-[10px] text-gray-500 block">
                      {createdDate ? createdDate.toLocaleDateString("ar-EG", { month: "short", day: "numeric" }) : ""}
                    </span>
                  </div>
                </div>

                {/* Recipient Phone with actions */}
                <div className="flex items-center justify-between bg-emerald-50/70 border border-emerald-200 rounded-2xl p-3.5">
                  <div className="flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-emerald-700" />
                    <div>
                      <span className="text-[10px] font-bold text-gray-500 block">رقم المستلم:</span>
                      <span className="font-mono font-black text-slate-950 text-sm" dir="ltr">
                        +{msg.phone}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(msg.phone);
                        toast.success("تم نسخ رقم الهاتف بنجاح");
                      }}
                      className="px-3 py-1.5 rounded-xl bg-white hover:bg-emerald-100/50 border border-emerald-200 text-emerald-800 text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>نسخ الرقم</span>
                    </button>

                    <a
                      href={`https://wa.me/${String(msg.phone).replace(/[^0-9]/g, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>محادثة واتساب</span>
                    </a>
                  </div>
                </div>

                {/* Error Banner if failed */}
                {isFailed && msg.error && (
                  <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs space-y-1">
                    <div className="flex items-center gap-1.5 text-rose-900 font-black">
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>سبب تعثر الإرسال المسجل:</span>
                    </div>
                    <p className="text-rose-800 font-mono text-[11px] bg-white/80 p-2 rounded-xl border border-rose-100 whitespace-pre-wrap break-all">
                      {msg.error}
                    </p>
                  </div>
                )}

                {/* WhatsApp Chat Bubble Preview */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-gray-700">
                    <span className="flex items-center gap-1.5">
                      <MessageSquare className="w-4 h-4 text-emerald-600" />
                      <span>معاينة نص الرسالة كما تظهر للمستلم:</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(msg.message || "");
                        toast.success("تم نسخ نص الرسالة");
                      }}
                      className="text-[11px] text-emerald-700 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>نسخ النص</span>
                    </button>
                  </div>

                  <div className="p-4 rounded-2xl bg-[#EFEAE2] border border-stone-300/80 shadow-inner flex flex-col items-start" style={{ backgroundImage: "radial-gradient(#d1d7db 1px, transparent 1px)", backgroundSize: "16px 16px" }}>
                    <div className="bg-white rounded-2xl rounded-tr-none px-4 py-3 max-w-[90%] shadow-md border border-stone-200/60 space-y-2 text-right">
                      <p className="text-xs text-stone-900 leading-relaxed whitespace-pre-wrap select-text font-sans font-medium" dir="rtl">
                        {msg.message || "(لا يوجد نص للرسالة)"}
                      </p>

                      {msg.pdf_url && (
                        <div className="pt-2 border-t border-stone-100">
                          <a
                            href={msg.pdf_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 p-2 bg-emerald-50/80 border border-emerald-200 rounded-xl text-emerald-900 hover:bg-emerald-100 transition-colors"
                          >
                            <div className="w-8 h-8 rounded-lg bg-red-500 text-white flex items-center justify-center font-bold text-[10px]">
                              PDF
                            </div>
                            <div className="text-right min-w-0 flex-1">
                              <div className="text-xs font-bold truncate">مستند مرفق</div>
                              <div className="text-[10px] text-emerald-700">اضغط لفتح الملف وتحميله</div>
                            </div>
                            <ExternalLink className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          </a>
                        </div>
                      )}

                      <div className="flex items-center justify-end gap-1 text-[10px] text-stone-400 font-sans pt-1">
                        <span>{createdDate ? createdDate.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }) : ""}</span>
                        {isSent && <CheckCheck className="w-3.5 h-3.5 text-sky-500 stroke-[2.5]" />}
                        {isPending && <Clock className="w-3 h-3 text-stone-400" />}
                        {isFailed && <AlertCircle className="w-3 h-3 text-rose-500" />}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer Modal Actions */}
                <div className="flex items-center justify-between pt-3 border-t border-gray-100 gap-2">
                  <div className="flex items-center gap-2">
                    {isFailed && (
                      <button
                        type="button"
                        disabled={retryingMessageId === msg.id}
                        onClick={async () => {
                          await handleRetryMessage(msg.id);
                          setSelectedMessageForModal(null);
                        }}
                        className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${retryingMessageId === msg.id ? "animate-spin text-slate-950" : ""}`} />
                        <span>إعادة الإرسال الآن</span>
                      </button>
                    )}

                    {isPending && (
                      <button
                        type="button"
                        disabled={cancellingMessageId === msg.id}
                        onClick={async () => {
                          await handleCancelMessage(msg.id);
                          setSelectedMessageForModal(null);
                        }}
                        className="px-4 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>إلغاء وحذف من الطابور</span>
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedMessageForModal(null)}
                    className="px-5 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold transition-all cursor-pointer"
                  >
                    إغلاق
                  </button>
                </div>
              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>
    </div>
  );
}
