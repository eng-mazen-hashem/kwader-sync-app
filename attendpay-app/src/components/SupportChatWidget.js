import React, { useState, useEffect, useRef } from "react";
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
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "../supabaseClient";
import { useAuth } from "../context/AuthContext";
import { useLocale } from "../context/LocaleContext";

const statusStyle = {
  Open: "bg-blue-100 text-blue-800",
  "In Progress": "bg-orange-100 text-orange-800",
  Resolved: "bg-emerald-100 text-emerald-800",
  Closed: "bg-gray-100 text-gray-800",
};

export default function SupportChatWidget() {
  const { company, user } = useAuth();
  const { language } = useLocale();
  const isRTL = language === "ar";
  
  const [isOpen, setIsOpen] = useState(false);
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

  const chatEndRef = useRef(null);
  const presenceChannelRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Fetch tickets
  useEffect(() => {
    if (isOpen && company?.id) {
      fetchTickets();
    }
  }, [isOpen, company?.id]);

  const fetchTickets = async () => {
    setLoadingTickets(true);
    try {
      const { data, error } = await supabase
        .from("support_tickets")
        .select("*")
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
    setReplies([]); // Reset to clear stale UI data immediately
    await fetchReplies(ticket.id, false);
  };

  /**
   * Realtime Connection Management Optimization (Critical):
   * 1. Subscribes specifically to replies belonging to the active ticket (filtered by ticket_id).
   *    Never listens to the entire messages/replies table globally.
   * 2. Absolute Cleanup: removes the channel on unmount/dependency change to prevent memory leaks and zombie sockets.
   */
  useEffect(() => {
    if (!selectedTicket?.id || view !== "chat") return;

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
          // Guard against duplicate insertions in the UI state
          setReplies((prev) => {
            if (prev.some((r) => r.id === payload.new.id)) return prev;
            return [...prev, payload.new];
          });
        }
      )
      .subscribe();

    return () => {
      // Unmount cleanup prevents active socket count from escalating
      supabase.removeChannel(channel);
    };
  }, [selectedTicket?.id, view]);

  /**
   * Minimalist Presence Optimization:
   * Uses highly compressed payloads (single letter keys: 'u' for user ID, 't' for typing status)
   * to sync real-time typing indicators without consuming excess bandwidth or limits.
   */
  useEffect(() => {
    if (!selectedTicket?.id || view !== "chat" || !user?.id) return;

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
  }, [selectedTicket?.id, view, user?.id, isRTL]);

  const handleTextareaChange = (e) => {
    setReplyText(e.target.value);

    // Sync typing status if channel is active
    if (presenceChannelRef.current && user?.id) {
      if (!localTyping) {
        setLocalTyping(true);
        presenceChannelRef.current.track({
          u: user.id,
          t: true,
          name: company.name || user.email || "Client",
        });
      }

      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        setLocalTyping(false);
        if (presenceChannelRef.current) {
          presenceChannelRef.current.track({
            u: user.id,
            t: false,
            name: company.name || user.email || "Client",
          });
        }
      }, 3000);
    }
  };

  useEffect(() => {
    if (view === "chat" && chatEndRef.current && !loadingOlder) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [replies, view, loadingOlder]);

  /**
   * Optimistic UI Refactoring:
   * Appends the message to state immediately before making the API request.
   * If the insert fails, it gracefully rolls back state and restores draft input.
   */
  const handleSendReply = async () => {
    if (!replyText.trim() || !selectedTicket) return;

    const originalText = replyText;
    const tempId = `temp-${Date.now()}`;
    const newReplyOptimistic = {
      id: tempId,
      ticket_id: selectedTicket.id,
      sender_type: "customer",
      sender_name: company.name || user?.email || "Client",
      message: originalText.trim(),
      created_at: new Date().toISOString(),
      isOptimistic: true, // Used to render in lighter style during transit
    };

    // Optimistically update replies state and clear text area immediately
    setReplies((prev) => [...prev, newReplyOptimistic]);
    setReplyText("");
    setSendingReply(true);

    try {
      const { data, error } = await supabase
        .from("support_ticket_replies")
        .insert([{
          ticket_id: selectedTicket.id,
          sender_type: "customer",
          sender_name: company.name || user?.email || "Client",
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
    } catch (err) {
      console.error(err);
      toast.error(isRTL ? "فشل إرسال الرد: " + err.message : "Failed to send reply: " + err.message);
      
      // Rollback: Remove the optimistic reply and restore draft input
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
        company_id: company.id,
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
      
      // Add first message automatically as a reply
      const { error: replyError } = await supabase.from("support_ticket_replies").insert([{
        ticket_id: ticket.id,
        sender_type: "customer",
        sender_name: company.name || "Client",
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

  if (!company) return null; // Only show if user has a company

  return (
    <>
      {/* Floating Action Button */}
      <motion.button
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-6 ${isRTL ? 'left-6' : 'right-6'} w-14 h-14 bg-gradient-to-tr from-blue-600 to-indigo-600 text-white rounded-full flex items-center justify-center shadow-2xl hover:shadow-blue-500/50 transition-all z-40`}
        style={{ display: isOpen ? "none" : "flex" }}
      >
        <MessageCircle className="w-6 h-6" />
      </motion.button>

      {/* Chat Widget Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className={`fixed bottom-6 ${isRTL ? 'left-6' : 'right-6'} w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-gray-100 flex flex-col z-50 overflow-hidden`}
            style={{ height: "600px", maxHeight: "85vh", direction: isRTL ? "rtl" : "ltr" }}
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-4 text-white flex items-center justify-between shadow-md z-10 relative">
              <div className="flex items-center gap-3">
                {view !== "list" && (
                  <button onClick={() => setView("list")} className="p-1 hover:bg-white/20 rounded-lg transition-colors">
                    {isRTL ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
                  </button>
                )}
                <div>
                  <h3 className="font-bold text-[1rem]">
                    {view === "list" ? (isRTL ? "الدعم الفني" : "Support") : view === "new" ? (isRTL ? "تذكرة جديدة" : "New Ticket") : `#${selectedTicket?.id?.slice(0, 8) || ''}`}
                  </h3>
                  {view === "list" && (
                    <p className="text-blue-100 text-xs mt-0.5">{isRTL ? "نحن هنا لمساعدتك" : "We are here to help"}</p>
                  )}
                  {view === "chat" && (
                    <p className="text-blue-100 text-xs mt-0.5 truncate max-w-[150px]">{selectedTicket?.subject}</p>
                  )}
                </div>
              </div>
              <button onClick={() => setIsOpen(false)} className="p-1.5 bg-white/10 hover:bg-white/20 rounded-full transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto bg-slate-50 relative">
              
              {/* VIEW: LIST */}
              {view === "list" && (
                <div className="p-4 space-y-3">
                  <button
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
                        {tickets.map(ticket => (
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
                    onClick={handleCreateTicket}
                    disabled={creatingTicket || !newSubject.trim() || !newDescription.trim()}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-blue-200 disabled:opacity-50 flex justify-center items-center gap-2 mt-4"
                  >
                    {creatingTicket ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className={`w-4 h-4 ${isRTL ? "rotate-180" : ""}`} />}
                    {isRTL ? "إرسال التذكرة" : "Submit Ticket"}
                  </button>
                </div>
              )}

              {/* VIEW: CHAT */}
              {view === "chat" && (
                <div className="flex flex-col h-full bg-slate-50">
                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {loadingReplies ? (
                      <div className="flex justify-center py-8">
                        <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
                      </div>
                    ) : (
                      <>
                        {/* Supabase Pagination Optimization: Load Older Button */}
                        {hasMoreReplies && (
                          <div className="flex justify-center mb-2">
                            <button
                              onClick={() => fetchReplies(selectedTicket.id, true)}
                              disabled={loadingOlder}
                              className="text-xs px-3 py-1.5 bg-blue-50 border border-blue-100 hover:bg-blue-100/80 text-blue-600 font-bold rounded-xl transition-all disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
                            >
                              {loadingOlder ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : null}
                              {isRTL ? "تحميل الرسائل السابقة" : "Load older messages"}
                            </button>
                          </div>
                        )}

                        {/* Original Ticket info as the first message bubble */}
                        {replies.length === 0 && (
                          <div className={`flex ${isRTL ? "justify-end" : "justify-start"}`}>
                            <div className="bg-blue-600 text-white rounded-2xl rounded-tr-none px-4 py-3 max-w-[85%] text-sm shadow-sm">
                              <p className="whitespace-pre-wrap">{selectedTicket?.description}</p>
                            </div>
                          </div>
                        )}

                        {replies.map(r => {
                          const isClient = r.sender_type === "customer";
                          return (
                            <div key={r.id} className={`flex ${isClient ? (isRTL ? "justify-end" : "justify-end") : (isRTL ? "justify-start" : "justify-start")}`}>
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
                        <div ref={chatEndRef} />
                      </>
                    )}
                  </div>

                  {/* Typing Indicator Bar */}
                  {typingUsers.length > 0 && (
                    <div className="px-4 py-1 text-xs text-gray-400 font-semibold bg-white border-t border-gray-50 flex items-center gap-1.5 italic animate-pulse">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500" />
                      {typingUsers.join(", ")} {isRTL ? "يكتب الآن..." : "is typing..."}
                    </div>
                  )}

                  {/* Chat Input */}
                  <div className="p-3 bg-white border-t border-gray-100 flex items-end gap-2">
                    <textarea
                      value={replyText}
                      onChange={handleTextareaChange}
                      placeholder={isRTL ? "اكتب رسالة..." : "Type a message..."}
                      rows={1}
                      className="flex-1 bg-slate-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-blue-400 resize-none max-h-32 text-slate-800 font-medium"
                      style={{ minHeight: "44px" }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSendReply();
                        }
                      }}
                    />
                    <button
                      onClick={handleSendReply}
                      disabled={sendingReply || !replyText.trim()}
                      className="w-11 h-11 bg-blue-600 hover:bg-blue-700 text-white rounded-xl flex items-center justify-center transition-colors shadow-sm disabled:opacity-50 flex-shrink-0"
                    >
                      {sendingReply ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className={`w-4 h-4 ${isRTL ? "rotate-180" : ""}`} />}
                    </button>
                  </div>
                </div>
              )}

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
