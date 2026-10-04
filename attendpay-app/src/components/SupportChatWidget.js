import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  MessageCircle,
  X,
  Plus,
  Send,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Clock,
  CheckCircle,
  Bot,
  Sparkles,
  User,
  Headphones,
  Zap,
  ShieldAlert,
  Wrench,
  Server,
  RefreshCw
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "../supabaseClient";
import { useAuth } from "../context/AuthContext";
import { useLocale } from "../context/LocaleContext";
import {
  getOrCreateWebConversation,
  getWebConversationHistory,
  subscribeToWebConversation,
  sendWebChatMessage,
  runCompanyDiagnostics,
  executeDatabaseRepair
} from "../services/webChatAiService";

const statusStyle = {
  Open: "bg-blue-100 text-blue-800",
  "In Progress": "bg-orange-100 text-orange-800",
  Resolved: "bg-emerald-100 text-emerald-800",
  Closed: "bg-gray-100 text-gray-800",
};

const TECHNICAL_SUGGESTED_QUESTIONS = [
  { text: "فحص وتشخيص قاعدة البيانات 🛠️", query: "افحص وشخص حالة قاعدة البيانات وأجهزة البصمة والورديات لشركتنا الآن" },
  { text: "حل مشكلة عدم معالجة البصمات ⚡", query: "حل مشكلة البصمات غير المعالجة وأعد احتساب حضور الموظفين لشركتنا فوراً" },
  { text: "طريقة ربط جهاز البصمة بالسيرفر 📱", query: "ما هي خطوات ربط جهاز البصمة ZKTeco بسيرفر السحابة ADMS؟" },
  { text: "طلب مهندس دعم فني بشري 👨‍💼", query: "اريد التحدث مع مهندس دعم فني بشري" },
];

export default function SupportChatWidget() {
  const { company, user } = useAuth();
  const { language } = useLocale();
  const isRTL = language === "ar";
  
  const [isOpen, setIsOpen] = useState(false);
  // Active Tab: 'ai' (Live Technical Support AI) or 'tickets' (Support Tickets)
  const [activeTab, setActiveTab] = useState("ai");

  // ==========================
  // AI TECHNICAL CHAT STATES
  // ==========================
  const [aiConv, setAiConv] = useState(null);
  const [aiMessages, setAiMessages] = useState([]);
  const [loadingAiChat, setLoadingAiChat] = useState(false);
  const [aiInput, setAiInput] = useState("");
  const [aiSending, setAiSending] = useState(false);
  const [isAiTyping, setIsAiTyping] = useState(false);
  const [liveDiag, setLiveDiag] = useState(null);
  const [loadingDiag, setLoadingDiag] = useState(false);
  const aiChatEndRef = useRef(null);

  // ==========================
  // TICKETS STATES
  // ==========================
  const [view, setView] = useState("list"); // list, chat, new
  const [tickets, setTickets] = useState([]);
  const [loadingTickets, setLoadingTickets] = useState(false);
  
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [replies, setReplies] = useState([]);
  const [loadingReplies, setLoadingReplies] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [sendingReply, setSendingReply] = useState(false);

  // Supabase Resource Optimization States
  const [hasMoreReplies, setHasMoreReplies] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [typingUsers, setTypingUsers] = useState([]);
  const [localTyping, setLocalTyping] = useState(false);

  const [newSubject, setNewSubject] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [creatingTicket, setCreatingTicket] = useState(false);

  const ticketChatEndRef = useRef(null);
  const presenceChannelRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // =========================================================================
  // FETCH LIVE COMPANY DIAGNOSTICS
  // =========================================================================
  const fetchLiveDiagnostics = useCallback(async () => {
    if (!company?.id) return;
    setLoadingDiag(true);
    try {
      const diag = await runCompanyDiagnostics(company.id);
      setLiveDiag(diag);
    } catch (err) {
      console.warn("Failed to fetch diagnostics:", err);
    } finally {
      setLoadingDiag(false);
    }
  }, [company?.id]);

  // =========================================================================
  // AI CHAT INITIALIZATION & REALTIME SYNC (TENANT-BOUND)
  // =========================================================================
  useEffect(() => {
    if (!isOpen || activeTab !== "ai") return;

    let isMounted = true;
    async function initAiSession() {
      setLoadingAiChat(true);
      try {
        const conv = await getOrCreateWebConversation(user, company);
        if (!isMounted) return;
        setAiConv(conv);

        if (conv?.id) {
          const history = await getWebConversationHistory(conv.id);
          if (!isMounted) return;
          setAiMessages(history);
        }

        fetchLiveDiagnostics();
      } catch (err) {
        console.error("Failed to init AI chat session:", err);
      } finally {
        if (isMounted) setLoadingAiChat(false);
      }
    }

    initAiSession();

    return () => {
      isMounted = false;
    };
  }, [isOpen, activeTab, user?.id, company?.id, fetchLiveDiagnostics]);

  // Subscribe to real-time incoming messages in the AI conversation (Human Agent takeover replies from AiSalesCenter)
  useEffect(() => {
    if (!aiConv?.id || activeTab !== "ai") return;

    const unsubscribe = subscribeToWebConversation(aiConv.id, (newMsg) => {
      setAiMessages((prev) => {
        if (prev.some((m) => m.id === newMsg.id || (m.isOptimistic && m.message_text === newMsg.message_text))) {
          return prev.map((m) => (m.isOptimistic && m.message_text === newMsg.message_text ? newMsg : m));
        }
        return [...prev, newMsg];
      });

      // If human agent replied, update status
      if (newMsg.sender_type === "human_agent") {
        setAiConv((prev) => prev ? { ...prev, status: "human_takeover" } : prev);
        toast.info(isRTL ? "وصلك رد جديد من مهندس الدعم الفني" : "New reply from technical support engineer");
      }
    });

    return () => {
      unsubscribe();
    };
  }, [aiConv?.id, activeTab, isRTL]);

  // Auto-scroll AI chat
  useEffect(() => {
    if (activeTab === "ai" && aiChatEndRef.current) {
      aiChatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [aiMessages, isAiTyping, activeTab]);

  // Send message to Dedicated Technical Support AI / Human engineer
  const handleSendAiMessage = async (overrideText = null) => {
    const textToSend = (overrideText || aiInput).trim();
    if (!textToSend || aiSending) return;

    const tempId = `temp-${Date.now()}`;
    const optimisticMsg = {
      id: tempId,
      conversation_id: aiConv?.id,
      sender_type: "user",
      message_text: textToSend,
      created_at: new Date().toISOString(),
      isOptimistic: true
    };

    setAiMessages((prev) => [...prev, optimisticMsg]);
    setAiInput("");
    setAiSending(true);
    setIsAiTyping(true);

    try {
      const response = await sendWebChatMessage({
        conversationId: aiConv?.id,
        messageText: textToSend,
        company,
        user,
        history: aiMessages
      });

      setIsAiTyping(false);

      if (response.isHandoff) {
        setAiConv((prev) => prev ? { ...prev, status: "human_takeover" } : prev);
      }

      // Add AI reply to messages
      const aiReplyMsg = {
        id: `ai-${Date.now()}`,
        conversation_id: aiConv?.id,
        sender_type: response.senderType || "ai",
        message_text: response.reply,
        created_at: new Date().toISOString(),
        tokens_used: response.tokensUsed || 0,
        isCached: response.isCached
      };

      setAiMessages((prev) => [
        ...prev.map((m) => m.id === tempId ? { ...m, isOptimistic: false } : m),
        aiReplyMsg
      ]);

      // Refresh diagnostics if user triggered an action
      fetchLiveDiagnostics();
    } catch (err) {
      console.error("Failed to send AI message:", err);
      setIsAiTyping(false);
      toast.error(isRTL ? "تعذر إرسال الرسالة، يرجى المحاولة مرة أخرى" : "Failed to send message, please try again");
    } finally {
      setAiSending(false);
    }
  };

  // =========================================================================
  // TICKETS SYSTEM FUNCTIONALITY (PRESERVED 100%)
  // =========================================================================
  useEffect(() => {
    if (isOpen && activeTab === "tickets" && company?.id) {
      fetchTickets();
    }
  }, [isOpen, activeTab, company?.id]);

  const fetchTickets = async () => {
    setLoadingTickets(true);
    try {
      const { data, error } = await supabase
        .from("support_tickets")
        .select("id, subject, description, status, created_at, company_id")
        .eq("company_id", company.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setTickets(data || []);
    } catch (err) {
      console.error(err);
      toast.error(isRTL ? "فشل في تحميل تذاكر الدعم" : "Failed to load support tickets");
    } finally {
      setLoadingTickets(false);
    }
  };

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
        .select("id, ticket_id, sender_type, sender_name, message, created_at")
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: false })
        .range(fromRange, toRange);

      if (error) throw error;

      const newReplies = data ? [...data].reverse() : [];
      setHasMoreReplies(newReplies.length === 30);

      if (isLoadMore) {
        setReplies((prev) => [...newReplies, ...prev]);
      } else {
        setReplies(newReplies);
      }
    } catch (err) {
      console.error(err);
      toast.error(isRTL ? "فشل في تحميل الردود" : "Failed to load replies");
    } finally {
      setLoadingReplies(false);
      setLoadingOlder(false);
    }
  };

  const openTicket = async (ticket) => {
    setSelectedTicket(ticket);
    setView("chat");
    setReplies([]);
    await fetchReplies(ticket.id, false);
  };

  useEffect(() => {
    if (!selectedTicket?.id || view !== "chat" || activeTab !== "tickets") return;

    const channelName = `client-replies-${selectedTicket.id}`;
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
  }, [selectedTicket?.id, view, activeTab]);

  useEffect(() => {
    if (!selectedTicket?.id || view !== "chat" || !user?.id || activeTab !== "tickets") return;

    const presenceChannel = supabase.channel(`client-presence-${selectedTicket.id}`);
    presenceChannelRef.current = presenceChannel;

    presenceChannel
      .on("presence", { event: "sync" }, () => {
        const state = presenceChannel.presenceState();
        const typingList = [];
        Object.keys(state).forEach((key) => {
          const presences = state[key];
          presences.forEach((p) => {
            if (p.t && p.u !== user.id) {
              typingList.push(p.name || (isRTL ? "الدعم الفني" : "Support"));
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
  }, [selectedTicket?.id, view, user?.id, isRTL, activeTab]);

  const handleTicketTextareaChange = (e) => {
    setReplyText(e.target.value);

    if (presenceChannelRef.current && user?.id) {
      if (!localTyping) {
        setLocalTyping(true);
        presenceChannelRef.current.track({
          u: user.id,
          t: true,
          name: company?.name || user.email || "Client",
        });
      }

      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        setLocalTyping(false);
        if (presenceChannelRef.current) {
          presenceChannelRef.current.track({
            u: user.id,
            t: false,
            name: company?.name || user.email || "Client",
          });
        }
      }, 3000);
    }
  };

  useEffect(() => {
    if (view === "chat" && ticketChatEndRef.current && !loadingOlder && activeTab === "tickets") {
      ticketChatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [replies, view, loadingOlder, activeTab]);

  const handleSendTicketReply = async () => {
    if (!replyText.trim() || !selectedTicket) return;

    const originalText = replyText;
    const tempId = `temp-${Date.now()}`;
    const newReplyOptimistic = {
      id: tempId,
      ticket_id: selectedTicket.id,
      sender_type: "customer",
      sender_name: company?.name || user?.email || "Client",
      message: originalText.trim(),
      created_at: new Date().toISOString(),
      isOptimistic: true,
    };

    setReplies((prev) => [...prev, newReplyOptimistic]);
    setReplyText("");
    setSendingReply(true);

    try {
      const { data, error } = await supabase
        .from("support_ticket_replies")
        .insert([{
          ticket_id: selectedTicket.id,
          sender_type: "customer",
          sender_name: company?.name || user?.email || "Client",
          message: originalText.trim(),
        }])
        .select();
        
      if (error) throw error;
      
      if (data && data.length > 0) {
        setReplies((prev) =>
          prev.map((r) => (r.id === tempId ? data[0] : r))
        );
      } else {
        setReplies((prev) =>
          prev.map((r) => (r.id === tempId ? { ...newReplyOptimistic, isOptimistic: false } : r))
        );
      }
    } catch (err) {
      console.error(err);
      toast.error(isRTL ? "فشل إرسال الرد: " + err.message : "Failed to send reply: " + err.message);
      setReplies((prev) => prev.filter((r) => r.id !== tempId));
      setReplyText(originalText);
    } finally {
      setSendingReply(false);
    }
  };

  const handleCreateTicket = async () => {
    if (!newSubject.trim() || !newDescription.trim()) {
      toast.error(isRTL ? "يرجى ملء جميع الحقول" : "Please fill in all fields");
      return;
    }
    setCreatingTicket(true);
    try {
      const newTicket = {
        company_id: company?.id,
        subject: newSubject.trim(),
        description: newDescription.trim(),
        status: "Open",
        priority: "Medium",
      };
      const { data, error } = await supabase
        .from("support_tickets")
        .insert([newTicket])
        .select();

      if (error) throw error;
      
      toast.success(isRTL ? "تم فتح التذكرة بنجاح" : "Ticket created successfully");
      setNewSubject("");
      setNewDescription("");
      
      const ticket = data && data.length > 0 ? data[0] : newTicket;
      
      const { error: replyError } = await supabase.from("support_ticket_replies").insert([{
        ticket_id: ticket.id,
        sender_type: "customer",
        sender_name: company?.name || "Client",
        message: newDescription.trim()
      }]);
      
      if (replyError) console.error("Failed to insert reply:", replyError);
      
      await fetchTickets();
      setView("list");
    } catch (err) {
      console.error(err);
      toast.error(isRTL ? "فشل إنشاء التذكرة: " + err.message : "Failed to create ticket: " + err.message);
    } finally {
      setCreatingTicket(false);
    }
  };

  if (!user && !company) return null;

  const isHumanTakeover = aiConv?.status === "human_takeover";

  return (
    <>
      {/* Floating Action Button */}
      <motion.button
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-6 ${isRTL ? 'left-6' : 'right-6'} w-14 h-14 bg-gradient-to-tr from-slate-900 via-indigo-900 to-blue-600 text-white rounded-full flex items-center justify-center shadow-2xl hover:shadow-indigo-500/50 transition-all z-40 group`}
        style={{ display: isOpen ? "none" : "flex" }}
        title={isRTL ? "مهندس الدعم الفني الذكي" : "Technical Support AI"}
      >
        <div className="relative">
          <Wrench className="w-6 h-6 text-white group-hover:rotate-45 transition-transform" />
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-slate-900 animate-pulse" />
        </div>
      </motion.button>

      {/* Chat Widget Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className={`fixed bottom-6 ${isRTL ? 'left-6' : 'right-6'} w-88 sm:w-[430px] bg-white rounded-2xl shadow-2xl border border-slate-200/90 flex flex-col z-50 overflow-hidden`}
            style={{ height: "660px", maxHeight: "90vh", direction: isRTL ? "rtl" : "ltr" }}
          >
            {/* Header: Dedicated Technical Support Center */}
            <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 px-5 pt-4 pb-3 text-white shadow-md z-10 relative">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/20 backdrop-blur-md flex items-center justify-center border border-indigo-400/30 text-white shadow-inner">
                    {activeTab === "ai" ? <Wrench className="w-5 h-5 text-indigo-300" /> : <Headphones className="w-5 h-5 text-blue-300" />}
                  </div>
                  <div>
                    <h3 className="font-bold text-sm tracking-wide flex items-center gap-1.5">
                      {activeTab === "ai" ? (isRTL ? "مهندس الدعم الفني الذكي" : "KWADER Technical Support AI") : (isRTL ? "مركز تذاكر الدعم" : "Support Tickets")}
                      {activeTab === "ai" && (
                        <span className="text-[10px] bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 px-1.5 py-0.5 rounded-full font-semibold">
                          {isHumanTakeover ? (isRTL ? "مهندس بشري" : "Live Engineer") : (isRTL ? "تشخيص فوري" : "Live Diag")}
                        </span>
                      )}
                    </h3>
                    <p className="text-slate-300/80 text-[11px] leading-tight flex items-center gap-1 mt-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                      <span className="font-semibold text-slate-200">{company?.name || "الشركة"}</span>
                      <span>•</span>
                      <span>{isRTL ? "مربوط بقاعدة بيانات الشركة" : "Company Database Connected"}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button 
                    onClick={() => setIsOpen(false)} 
                    className="p-1.5 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Segmented Tab Switch */}
              <div className="bg-black/40 backdrop-blur-sm p-1 rounded-xl flex items-center gap-1 border border-white/10 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setActiveTab("ai")}
                  className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                    activeTab === "ai"
                      ? "bg-indigo-600 text-white shadow-md font-bold"
                      : "text-slate-300 hover:text-white hover:bg-white/10"
                  }`}
                >
                  <Wrench className={`w-3.5 h-3.5 ${activeTab === "ai" ? "text-indigo-200" : "text-slate-400"}`} />
                  <span>{isRTL ? "الدعم الفني الذكي" : "Technical AI"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("tickets")}
                  className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                    activeTab === "tickets"
                      ? "bg-indigo-600 text-white shadow-md font-bold"
                      : "text-slate-300 hover:text-white hover:bg-white/10"
                  }`}
                >
                  <Headphones className={`w-3.5 h-3.5 ${activeTab === "tickets" ? "text-indigo-200" : "text-slate-400"}`} />
                  <span>{isRTL ? "تذاكر الدعم" : "Tickets"}</span>
                  {tickets.length > 0 && (
                    <span className="text-[10px] px-1.5 py-0.2 bg-blue-100 text-blue-900 rounded-full font-bold">
                      {tickets.length}
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* ========================================================= */}
            {/* TAB 1: DEDICATED COMPANY TECHNICAL SUPPORT AI             */}
            {/* ========================================================= */}
            {activeTab === "ai" && (
              <div className="flex-1 flex flex-col bg-slate-50 relative overflow-hidden">
                {/* Real-time Telemetry Status Bar */}
                <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white px-3.5 py-2 border-b border-slate-700/60 flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-2 truncate">
                    <Server className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
                    {liveDiag ? (
                      <span className="text-slate-200 font-medium truncate">
                        {liveDiag.totalDevices} أجهزة ({liveDiag.onlineCount} متصل) • {liveDiag.totalActiveEmployees} موظف
                      </span>
                    ) : (
                      <span className="text-slate-300 font-medium">{company?.name || "قاعدة البيانات"}</span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {loadingDiag ? (
                      <RefreshCw className="w-3 h-3 text-indigo-400 animate-spin" />
                    ) : liveDiag?.issues?.length > 0 ? (
                      <button
                        type="button"
                        onClick={() => handleSendAiMessage("افحص وشخص المشاكل المرصودة في قاعدة البيانات واقترح حلولاً")}
                        className="text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-full font-bold hover:bg-amber-500/30 transition-colors flex items-center gap-1"
                      >
                        <ShieldAlert className="w-3 h-3 text-amber-400" />
                        <span>{liveDiag.issues.length} تنبيهات</span>
                      </button>
                    ) : (
                      <span className="text-[9px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/30 font-semibold">
                        ✅ متصل وسليم
                      </span>
                    )}
                  </div>
                </div>

                {/* Handoff Status Bar if in human takeover mode */}
                {isHumanTakeover && (
                  <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center justify-between text-xs text-amber-950 font-semibold shadow-inner">
                    <span className="flex items-center gap-1.5">
                      <ShieldAlert className="w-4 h-4 text-amber-600" />
                      {isRTL ? "محادثة محولة لمهندس الدعم الفني البشري" : "Handed over to support engineer"}
                    </span>
                    <span className="text-[10px] bg-amber-200/80 px-2 py-0.5 rounded-full text-amber-900 font-bold">
                      {isRTL ? "مباشر" : "Live"}
                    </span>
                  </div>
                )}

                {/* Message Stream */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
                  {loadingAiChat ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2">
                      <Loader2 className="w-7 h-7 text-indigo-600 animate-spin" />
                      <span className="text-xs font-semibold">{isRTL ? "جارٍ الاتصال بمهندس الدعم الفني..." : "Connecting Support AI..."}</span>
                    </div>
                  ) : aiMessages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-5 px-3 text-center">
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-slate-900 via-indigo-900 to-blue-700 text-white flex items-center justify-center shadow-lg shadow-indigo-200 mb-3">
                        <Wrench className="w-7 h-7 text-indigo-200" />
                      </div>
                      <h4 className="font-bold text-slate-800 text-sm mb-1">
                        {isRTL ? `مرحباً بك في الدعم الفني لشركة "${company?.name || 'الشركة'}" 🛠️` : "Technical Support"}
                      </h4>
                      <p className="text-xs text-slate-500 max-w-xs mb-4">
                        {isRTL
                          ? "أنا مهندس الدعم الفني الذكي لمنصة كوادر. مربوط مباشرة بقاعدة بيانات شركتكم لتشخيص أجهزة البصمة، الورديات، ومزامنة الحضور فورياً."
                          : "I am KWADER Technical Support AI, bound to your company database for live diagnostics and repair."}
                      </p>

                      {/* Technical Suggestion Chips */}
                      <div className="w-full space-y-1.5 text-right">
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-1">
                          {isRTL ? "إجراءات تشخيصية سريعة لشركتكم:" : "Quick Technical Actions:"}
                        </span>
                        <div className="grid grid-cols-1 gap-1.5">
                          {TECHNICAL_SUGGESTED_QUESTIONS.map((chip, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => handleSendAiMessage(chip.query)}
                              className="text-right p-2.5 bg-white hover:bg-indigo-50/80 border border-slate-200 hover:border-indigo-300 rounded-xl text-xs font-semibold text-slate-700 hover:text-indigo-600 transition-all shadow-sm flex items-center justify-between group"
                            >
                              <span>{chip.text}</span>
                              <ChevronLeft className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-500 transition-transform group-hover:-translate-x-0.5" />
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      {aiMessages.map((msg) => {
                        const isUser = msg.sender_type === "user";
                        const isHumanAgent = msg.sender_type === "human_agent";
                        const isAi = msg.sender_type === "ai";

                        return (
                          <div
                            key={msg.id}
                            className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                          >
                            <div
                              className={`max-w-[88%] rounded-2xl px-4 py-3 shadow-sm text-xs leading-relaxed transition-all ${
                                isUser
                                  ? `bg-gradient-to-r from-slate-900 to-indigo-900 text-white ${
                                      isRTL ? "rounded-tl-none" : "rounded-tr-none"
                                    }`
                                  : isHumanAgent
                                  ? `bg-amber-50/95 border border-amber-200 text-amber-950 ${
                                      isRTL ? "rounded-tr-none" : "rounded-tl-none"
                                    }`
                                  : `bg-white border border-slate-200/90 text-slate-800 ${
                                      isRTL ? "rounded-tr-none" : "rounded-tl-none"
                                    }`
                              }`}
                              style={{ opacity: msg.isOptimistic ? 0.7 : 1 }}
                            >
                              {/* Bubble Meta Header */}
                              <div className="flex items-center justify-between gap-3 text-[10px] mb-1 font-bold">
                                <span className="flex items-center gap-1">
                                  {isUser ? (
                                    <>
                                      <User className="w-3 h-3 text-indigo-300" />
                                      <span className="text-indigo-100">{isRTL ? "مسؤول النظام" : "Admin"}</span>
                                    </>
                                  ) : isHumanAgent ? (
                                    <>
                                      <Headphones className="w-3 h-3 text-amber-600" />
                                      <span className="text-amber-700">{isRTL ? "مهندس الدعم البشري" : "Support Engineer"}</span>
                                    </>
                                  ) : (
                                    <>
                                      <Wrench className="w-3 h-3 text-indigo-500" />
                                      <span className="text-indigo-600">{isRTL ? "مهندس الدعم الذكي" : "KWADER Tech AI"}</span>
                                    </>
                                  )}
                                </span>

                                <span className={`font-mono text-[9px] ${isUser ? "text-indigo-200" : "text-slate-400"}`}>
                                  {msg.isOptimistic
                                    ? (isRTL ? "جارٍ الإرسال..." : "Sending...")
                                    : new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                </span>
                              </div>

                              {/* Message Text */}
                              <div className="whitespace-pre-wrap font-medium">
                                {msg.message_text}
                              </div>

                              {/* 0-Token Instant Micro Badge */}
                              {isAi && (msg.tokens_used === 0 || msg.isCached) && (
                                <div className="mt-1.5 flex items-center gap-1 text-[9px] text-emerald-600 font-semibold">
                                  <Zap className="w-2.5 h-2.5 text-emerald-500" />
                                  <span>{isRTL ? "إجابة فورية دلالية (0-Token)" : "0-Token Instant Hit"}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}

                      {/* Typing indicator */}
                      {isAiTyping && (
                        <div className="flex justify-start">
                          <div className="bg-white border border-slate-200 rounded-2xl rounded-tr-none px-4 py-2.5 shadow-sm flex items-center gap-2 text-xs text-indigo-600 font-medium">
                            <Wrench className="w-3.5 h-3.5 text-indigo-500 animate-spin" />
                            <span>{isRTL ? "مهندس الدعم يفحص قاعدة البيانات..." : "Diagnosing database..."}</span>
                          </div>
                        </div>
                      )}

                      <div ref={aiChatEndRef} />
                    </>
                  )}
                </div>

                {/* Bottom Bar: Handoff Quick Action & Input */}
                <div className="p-3 bg-white border-t border-slate-100 flex flex-col gap-2">
                  {!isHumanTakeover && aiMessages.length > 2 && (
                    <div className="flex justify-between items-center px-1">
                      <button
                        type="button"
                        onClick={() => handleSendAiMessage("حل مشكلة البصمات غير المعالجة وأعد احتساب حضور الموظفين لشركتنا")}
                        className="text-[11px] text-emerald-600 hover:text-emerald-800 font-bold flex items-center gap-1"
                      >
                        <Zap className="w-3 h-3 text-emerald-500" />
                        <span>{isRTL ? "إعادة احتساب البصمات ⚡" : "Reprocess Attendance"}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSendAiMessage("اريد التحدث مع مهندس دعم فني بشري")}
                        className="text-[11px] text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
                      >
                        <Headphones className="w-3 h-3" />
                        <span>{isRTL ? "طلب مهندس بشري 👨‍💼" : "Human Engineer 👤"}</span>
                      </button>
                    </div>
                  )}

                  <div className="flex items-end gap-2">
                    <textarea
                      value={aiInput}
                      onChange={(e) => setAiInput(e.target.value)}
                      placeholder={isRTL ? `اسأل مهندس الدعم الفني لـ ${company?.name || 'الشركة'}...` : "Ask Technical Support..."}
                      rows={1}
                      className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs outline-none focus:border-indigo-500 focus:bg-white resize-none max-h-28 text-slate-800 font-medium transition-all"
                      style={{ minHeight: "42px" }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSendAiMessage();
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => handleSendAiMessage()}
                      disabled={aiSending || !aiInput.trim()}
                      className="w-10 h-10 bg-gradient-to-r from-slate-900 to-indigo-700 hover:from-slate-800 hover:to-indigo-800 text-white rounded-xl flex items-center justify-center transition-all shadow-md shadow-indigo-200 disabled:opacity-50 flex-shrink-0"
                    >
                      {aiSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className={`w-4 h-4 ${isRTL ? "rotate-180" : ""}`} />}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ========================================================= */}
            {/* TAB 2: SUPPORT TICKETS                                    */}
            {/* ========================================================= */}
            {activeTab === "tickets" && (
              <div className="flex-1 flex flex-col bg-slate-50 relative overflow-hidden">
                {/* Secondary View Switcher for Tickets */}
                {view !== "list" && (
                  <div className="bg-slate-100 border-b border-slate-200 px-4 py-2 flex items-center justify-between text-xs font-semibold text-slate-700">
                    <button
                      type="button"
                      onClick={() => setView("list")}
                      className="flex items-center gap-1 text-blue-600 hover:text-blue-800 transition-colors"
                    >
                      {isRTL ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                      <span>{isRTL ? "الرجوع لقائمة التذاكر" : "Back to tickets"}</span>
                    </button>
                    <span className="font-bold text-slate-500">
                      {view === "new" ? (isRTL ? "تذكرة جديدة" : "New Ticket") : `#${selectedTicket?.id?.slice(0, 8)}`}
                    </span>
                  </div>
                )}

                {/* VIEW: LIST */}
                {view === "list" && (
                  <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    <button
                      type="button"
                      onClick={() => setView("new")}
                      className="w-full py-3 bg-white border border-blue-100 rounded-xl flex items-center justify-center gap-2 text-blue-600 font-bold hover:bg-blue-50 hover:border-blue-200 transition-all shadow-sm"
                    >
                      <Plus className="w-4 h-4" />
                      {isRTL ? "فتح تذكرة دعم جديدة" : "Open New Ticket"}
                    </button>

                    <div className="mt-4">
                      <h4 className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-3 px-1">
                        {isRTL ? "تذاكرك السابقة" : "Your Tickets"}
                      </h4>
                      
                      {loadingTickets ? (
                        <div className="flex justify-center py-8">
                          <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
                        </div>
                      ) : tickets.length === 0 ? (
                        <div className="text-center py-8 bg-white rounded-xl border border-dashed border-gray-200">
                          <CheckCircle className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                          <p className="text-gray-400 text-xs font-semibold">{isRTL ? "لا توجد تذاكر حالياً" : "No tickets yet"}</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {tickets.map((ticket) => (
                            <div 
                              key={ticket.id}
                              onClick={() => openTicket(ticket)}
                              className="bg-white p-3.5 rounded-xl border border-gray-100 shadow-sm cursor-pointer hover:border-blue-300 hover:shadow-md transition-all group"
                            >
                              <div className="flex justify-between items-start mb-2">
                                <span className="text-gray-800 font-bold text-sm truncate pr-2">{ticket.subject}</span>
                                <span className={`text-[0.65rem] px-2 py-0.5 rounded-full font-bold whitespace-nowrap ${statusStyle[ticket.status] || statusStyle.Open}`}>
                                  {ticket.status}
                                </span>
                              </div>
                              <div className="flex items-center justify-between text-gray-400 text-xs">
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {new Date(ticket.created_at).toLocaleDateString()}
                                </span>
                                <span className="text-blue-500 font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                                  {isRTL ? "عرض" : "View"}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* VIEW: NEW TICKET */}
                {view === "new" && (
                  <div className="p-5 flex flex-col h-full bg-white">
                    <div className="space-y-4 flex-1">
                      <div>
                        <label className="block text-xs font-bold text-gray-600 mb-1.5">{isRTL ? "الموضوع" : "Subject"}</label>
                        <input
                          value={newSubject}
                          onChange={(e) => setNewSubject(e.target.value)}
                          placeholder={isRTL ? "بخصوص ماذا؟" : "Regarding what?"}
                          className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:border-blue-500 outline-none text-sm bg-slate-50 transition-colors text-slate-800 font-medium"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-600 mb-1.5">{isRTL ? "التفاصيل" : "Details"}</label>
                        <textarea
                          value={newDescription}
                          onChange={(e) => setNewDescription(e.target.value)}
                          placeholder={isRTL ? "اشرح المشكلة أو الطلب بالتفصيل..." : "Explain your issue in detail..."}
                          rows={6}
                          className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:border-blue-500 outline-none text-sm bg-slate-50 transition-colors resize-none text-slate-800 font-medium"
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleCreateTicket}
                      disabled={creatingTicket || !newSubject.trim() || !newDescription.trim()}
                      className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-blue-200 disabled:opacity-50 flex justify-center items-center gap-2 mt-4"
                    >
                      {creatingTicket ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className={`w-4 h-4 ${isRTL ? "rotate-180" : ""}`} />}
                      {isRTL ? "إرسال التذكرة" : "Submit Ticket"}
                    </button>
                  </div>
                )}

                {/* VIEW: CHAT FOR A TICKET */}
                {view === "chat" && selectedTicket && (
                  <div className="flex flex-col h-full bg-slate-50">
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                      {loadingReplies ? (
                        <div className="flex justify-center py-8">
                          <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
                        </div>
                      ) : (
                        <>
                          {hasMoreReplies && (
                            <div className="flex justify-center mb-2">
                              <button
                                type="button"
                                onClick={() => fetchReplies(selectedTicket.id, true)}
                                disabled={loadingOlder}
                                className="text-xs px-3 py-1.5 bg-blue-50 border border-blue-100 hover:bg-blue-100/80 text-blue-600 font-bold rounded-xl transition-all disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
                              >
                                {loadingOlder ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                                {isRTL ? "تحميل الرسائل السابقة" : "Load older messages"}
                              </button>
                            </div>
                          )}

                          {replies.length === 0 && (
                            <div className={`flex ${isRTL ? "justify-end" : "justify-start"}`}>
                              <div className="bg-blue-600 text-white rounded-2xl rounded-tr-none px-4 py-3 max-w-[85%] text-sm shadow-sm">
                                <p className="whitespace-pre-wrap">{selectedTicket?.description}</p>
                              </div>
                            </div>
                          )}

                          {replies.map((r) => {
                            const isClient = r.sender_type === "customer";
                            return (
                              <div key={r.id} className={`flex ${isClient ? "justify-end" : "justify-start"}`}>
                                <div 
                                  className={`max-w-[85%] rounded-2xl px-4 py-3 shadow-sm text-sm transition-opacity duration-200 ${
                                    isClient 
                                      ? `bg-blue-600 text-white ${isRTL ? "rounded-tl-none" : "rounded-tr-none"}` 
                                      : `bg-white border border-gray-100 text-gray-800 ${isRTL ? "rounded-tr-none" : "rounded-tl-none"}`
                                  }`}
                                  style={{ opacity: r.isOptimistic ? 0.7 : 1 }}
                                >
                                  <div className={`text-[0.65rem] mb-1 font-bold ${isClient ? "text-blue-200" : "text-gray-400"}`}>
                                    {isClient ? (isRTL ? "أنت" : "You") : r.sender_name || (isRTL ? "الدعم الفني" : "Support")}
                                    <span className="mx-1">•</span>
                                    {r.isOptimistic ? (
                                      <span>{isRTL ? "جاري الإرسال..." : "Sending..."}</span>
                                    ) : (
                                      <span>{new Date(r.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                    )}
                                  </div>
                                  <p className="whitespace-pre-wrap font-medium">{r.message}</p>
                                </div>
                              </div>
                            );
                          })}
                          <div ref={ticketChatEndRef} />
                        </>
                      )}
                    </div>

                    {typingUsers.length > 0 && (
                      <div className="px-4 py-1 text-xs text-gray-400 font-semibold bg-white border-t border-gray-50 flex items-center gap-1.5 italic animate-pulse">
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500" />
                        {typingUsers.join(", ")} {isRTL ? "يكتب الآن..." : "is typing..."}
                      </div>
                    )}

                    <div className="p-3 bg-white border-t border-gray-100 flex items-end gap-2">
                      <textarea
                        value={replyText}
                        onChange={handleTicketTextareaChange}
                        placeholder={isRTL ? "اكتب رسالة..." : "Type a message..."}
                        rows={1}
                        className="flex-1 bg-slate-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-blue-400 resize-none max-h-32 text-slate-800 font-medium"
                        style={{ minHeight: "44px" }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleSendTicketReply();
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={handleSendTicketReply}
                        disabled={sendingReply || !replyText.trim()}
                        className="w-11 h-11 bg-blue-600 hover:bg-blue-700 text-white rounded-xl flex items-center justify-center transition-colors shadow-sm disabled:opacity-50 flex-shrink-0"
                      >
                        {sendingReply ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className={`w-4 h-4 ${isRTL ? "rotate-180" : ""}`} />}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
