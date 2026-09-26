import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Bot, MessageSquare, Users, BookOpen, Settings, Send,
  UserCheck, ShieldAlert, Phone, RefreshCw, Plus, Trash2, ExternalLink,
  Search, Sparkles, Activity, ShieldCheck, Zap
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import { useLocale } from '../context/LocaleContext';
import './AiSalesCenter.css';

export default function AiSalesCenter() {
  const { company, isSuperAdmin } = useAuth();
  const { language } = useLocale();
  const isRTL = language === 'ar';

  const [activeTab, setActiveTab] = useState('inbox'); // 'inbox' | 'leads' | 'knowledge' | 'channels'

  // ==========================================
  // INBOX STATES
  // ==========================================
  const [conversations, setConversations] = useState([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [selectedConvId, setSelectedConvId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all'); // 'all' | 'ai_active' | 'human_takeover' | 'leads'
  const chatBottomRef = useRef(null);
  const chatFeedRef = useRef(null);
  const isNearBottomRef = useRef(true);
  const [showScrollBottomBtn, setShowScrollBottomBtn] = useState(false);

  const handleChatScroll = () => {
    if (!chatFeedRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatFeedRef.current;
    // Consider at bottom if within 120px from bottom edge
    const isNear = scrollHeight - scrollTop - clientHeight < 120;
    isNearBottomRef.current = isNear;
    setShowScrollBottomBtn(!isNear);
  };

  // ==========================================
  // LEADS STATES
  // ==========================================
  const [leads, setLeads] = useState([]);
  const [loadingLeads, setLoadingLeads] = useState(false);

  // ==========================================
  // KNOWLEDGE BASE STATES
  // ==========================================
  const [knowledgeItems, setKnowledgeItems] = useState([]);
  const [loadingKnowledge, setLoadingKnowledge] = useState(false);
  const [showAddKbModal, setShowAddKbModal] = useState(false);
  const [newKb, setNewKb] = useState({ category: 'faq', question_trigger: '', answer_content: '', keywords: '' });
  const [savingKb, setSavingKb] = useState(false);

  // ==========================================
  // CHANNELS AI CONFIG STATES
  // ==========================================
  const [channels, setChannels] = useState([]);
  const [loadingChannels, setLoadingChannels] = useState(false);
  const [savingChannelId, setSavingChannelId] = useState(null);

  // ------------------------------------------
  // 1. FETCH CONVERSATIONS & REALTIME SYNC
  // ------------------------------------------
  const fetchConversations = useCallback(async () => {
    try {
      let query = supabase
        .from('ai_conversations')
        .select(`
          id, channel_id, company_id, platform, session_id,
          customer_name, customer_phone, status, lead_status,
          summary, last_message_at, created_at,
          whatsapp_channels ( name, phone_number )
        `)
        .order('last_message_at', { ascending: false });

      if (company?.id && !isSuperAdmin) {
        query = query.or(`company_id.eq.${company.id},company_id.is.null`);
      }

      const { data, error } = await query.limit(50);
      if (error) throw error;
      setConversations(data || []);
      if (!selectedConvId && data && data.length > 0) {
        setSelectedConvId(data[0].id);
      }
    } catch (err) {
      console.error('Error fetching conversations:', err);
    } finally {
      setLoadingConversations(false);
    }
  }, [company?.id, isSuperAdmin, selectedConvId]);

  useEffect(() => {
    fetchConversations();

    const convIntervalId = setInterval(() => {
      fetchConversations();
    }, 3000);

    const convChannel = supabase
      .channel('ai_conversations_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ai_conversations' }, () => {
        fetchConversations();
      })
      .subscribe();

    return () => {
      clearInterval(convIntervalId);
      supabase.removeChannel(convChannel);
    };
  }, [fetchConversations]);

  // ------------------------------------------
  // 2. FETCH MESSAGES FOR SELECTED CONVERSATION
  // ------------------------------------------
  const fetchMessages = useCallback(async (convId, isBackground = false) => {
    if (!convId) return;
    if (!isBackground) setLoadingMessages(true);
    try {
      const { data, error } = await supabase
        .from('ai_messages')
        .select('*')
        .eq('conversation_id', convId)
        .order('created_at', { ascending: true })
        .limit(100);

      if (error) throw error;
      setMessages((prev) => {
        const next = data || [];
        // Only update state if message count or last message changed
        // This prevents re-render and unwanted auto-scroll when user scrolls up!
        if (prev.length === next.length) {
          const lastPrev = prev[prev.length - 1]?.id;
          const lastNext = next[next.length - 1]?.id;
          if (lastPrev === lastNext) return prev;
        }
        return next;
      });
    } catch (err) {
      if (!isBackground) console.error('Error fetching messages:', err);
    } finally {
      if (!isBackground) setLoadingMessages(false);
    }
  }, []);

  useEffect(() => {
    if (selectedConvId) {
      fetchMessages(selectedConvId);

      // Auto-scroll to bottom once when opening/switching conversation
      isNearBottomRef.current = true;
      setShowScrollBottomBtn(false);
      setTimeout(() => {
        chatBottomRef.current?.scrollIntoView({ behavior: 'auto' });
      }, 50);

      const msgIntervalId = setInterval(() => {
        fetchMessages(selectedConvId, true);
      }, 3500);

      const msgChannel = supabase
        .channel(`ai_messages_${selectedConvId}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'ai_messages',
          filter: `conversation_id=eq.${selectedConvId}`
        }, (payload) => {
          setMessages((prev) => {
            if (prev.some((m) => m.id === payload.new.id)) return prev;
            return [...prev, payload.new];
          });
        })
        .subscribe();

      return () => {
        clearInterval(msgIntervalId);
        supabase.removeChannel(msgChannel);
      };
    }
  }, [selectedConvId, fetchMessages]);

  // Only auto-scroll down if user was already at/near the bottom
  useEffect(() => {
    if (isNearBottomRef.current) {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // ------------------------------------------
  // 3. HUMAN AGENT: SEND DIRECT REPLY
  // ------------------------------------------
  const handleSendHumanReply = async (e) => {
    e.preventDefault();
    if (!replyText.trim() || !selectedConvId) return;

    const currentConv = conversations.find((c) => c.id === selectedConvId);
    if (!currentConv) return;

    setSendingReply(true);
    const textToSend = replyText.trim();
    setReplyText('');

    try {
      // 1. Store in ai_messages as human_agent
      const { data: newMsg, error: msgErr } = await supabase.from('ai_messages').insert({
        conversation_id: selectedConvId,
        sender_type: 'human_agent',
        message_text: textToSend,
        tokens_used: 0
      }).select().single();

      if (msgErr) throw msgErr;

      // Optimistically show reply immediately in chat feed
      if (newMsg) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });
      }

      // 2. Platform-specific routing: Web vs WhatsApp
      const isWebPlatform = currentConv.platform === 'web';

      if (!isWebPlatform) {
        // Resolve destination phone number or WhatsApp LID identifier
        const targetPhone = (currentConv.customer_phone && currentConv.customer_phone.length < 15)
          ? currentConv.customer_phone.replace(/\D/g, '')
          : (currentConv.session_id || '').replace(/\D/g, '');
        if (!targetPhone) {
          throw new Error('رقم هاتف العميل غير مسجل في هذه المحادثة');
        }

        // Resolve Channel ID
        let channelId = currentConv.channel_id;
        if (!channelId) {
          const { data: activeChan } = await supabase
            .from('whatsapp_channels')
            .select('id')
            .or('is_default.eq.true,status.eq.connected')
            .limit(1)
            .maybeSingle();
          if (activeChan?.id) channelId = activeChan.id;
        }

        // Push to whatsapp_queue (with correct column 'phone', NOT 'phone_number')
        const { error: queueErr } = await supabase.from('whatsapp_queue').insert({
          channel_id: channelId || null,
          phone: targetPhone,
          message: textToSend,
          priority: 10,
          status: 'pending'
        });

        if (queueErr) {
          console.error('Failed to insert into whatsapp_queue:', queueErr);
          throw queueErr;
        }
      }

      // 5. Update conversation last interaction & status to human_takeover
      await supabase
        .from('ai_conversations')
        .update({
          status: 'human_takeover',
          last_message_at: new Date().toISOString()
        })
        .eq('id', selectedConvId);

      // 6. Autonomous Learning: Harvest this human-verified answer as new AI knowledge (0-Token future hit)
      const lastUserQuestion = messages.filter((m) => m.sender_type === 'user').slice(-1)[0]?.message_text;
      if (lastUserQuestion && lastUserQuestion.trim().length >= 8 && textToSend.trim().length >= 20) {
        const cleanQ = lastUserQuestion.trim();
        const cleanA = textToSend.trim();
        const keywords = cleanQ
          .toLowerCase()
          .replace(/[^\w\s\u0621-\u064A]/g, ' ')
          .split(/\s+/)
          .filter((w) => w.length >= 3)
          .slice(0, 6);

        supabase
          .from('ai_knowledge_base')
          .insert({
            company_id: currentConv.company_id || null,
            category: 'auto_learned',
            question_trigger: cleanQ,
            answer_content: cleanA,
            keywords: keywords,
            is_active: true
          })
          .then(({ error: kErr }) => {
            if (!kErr) {
              toast.info(
                isRTL
                  ? '🧠 تم استيعاب ردك كمعرفة جديدة سيتعلم منها الذكاء الاصطناعي مستقبلاً!'
                  : '🧠 Answer auto-harvested into AI Knowledge Base!'
              );
              fetchKnowledge();
            }
          })
          .catch(() => {});
      }

      // Force scroll to bottom because user sent their own reply
      isNearBottomRef.current = true;
      setShowScrollBottomBtn(false);
      setTimeout(() => {
        chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 50);

      toast.success(
        isRTL
          ? (isWebPlatform ? 'تم إرسال الرد للعميل في محادثة الموقع بنجاح' : 'تم إرسال الرد للعميل في واتساب')
          : 'Reply sent successfully'
      );
    } catch (err) {
      console.error('Error sending reply:', err);
      toast.error(isRTL ? `فشل إرسال الرد: ${err.message}` : `Failed to send reply: ${err.message}`);
    } finally {
      setSendingReply(false);
    }
  };

  // ------------------------------------------
  // 4. TOGGLE AI / HUMAN STATUS
  // ------------------------------------------
  const handleToggleStatus = async (convId, currentStatus) => {
    const nextStatus = currentStatus === 'human_takeover' ? 'ai_active' : 'human_takeover';
    try {
      const { error } = await supabase
        .from('ai_conversations')
        .update({
          status: nextStatus,
          summary: nextStatus === 'human_takeover' ? 'تدخل يدوي من لوحة التحكم' : 'إعادة تفعيل الذكاء الاصطناعي',
          updated_at: new Date().toISOString()
        })
        .eq('id', convId);

      if (error) throw error;
      setConversations((prev) =>
        prev.map((c) => (c.id === convId ? { ...c, status: nextStatus } : c))
      );
      toast.success(
        nextStatus === 'human_takeover'
          ? (isRTL ? 'تم تفعيل التدخل البشري وتوقف البوت عن الرد' : 'Switched to human takeover')
          : (isRTL ? 'تمت إعادة تشغيل وكيل الذكاء الاصطناعي بنجاح 🟢' : 'AI Agent resumed')
      );
    } catch (err) {
      toast.error(err.message);
    }
  };

  // ------------------------------------------
  // 5. FETCH LEADS
  // ------------------------------------------
  const fetchLeads = useCallback(async () => {
    setLoadingLeads(true);
    try {
      let query = supabase.from('ai_leads').select('*').order('created_at', { ascending: false });
      if (company?.id && !isSuperAdmin) {
        query = query.or(`company_id.eq.${company.id},company_id.is.null`);
      }
      const { data, error } = await query;
      if (error) throw error;
      setLeads(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingLeads(false);
    }
  }, [company?.id, isSuperAdmin]);

  const handleUpdateLeadStatus = async (leadId, newStatus) => {
    try {
      const { error } = await supabase
        .from('ai_leads')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', leadId);
      if (error) throw error;
      setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, status: newStatus } : l)));
      toast.success(isRTL ? 'تم تحديث حالة العميل' : 'Lead status updated');
    } catch (err) {
      toast.error(err.message);
    }
  };

  // ------------------------------------------
  // 6. FETCH & MANAGE KNOWLEDGE BASE
  // ------------------------------------------
  const fetchKnowledge = useCallback(async () => {
    setLoadingKnowledge(true);
    try {
      let query = supabase.from('ai_knowledge_base').select('*').order('created_at', { ascending: false });
      if (company?.id && !isSuperAdmin) {
        query = query.or(`company_id.eq.${company.id},company_id.is.null`);
      }
      const { data, error } = await query;
      if (error) throw error;
      setKnowledgeItems(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingKnowledge(false);
    }
  }, [company?.id, isSuperAdmin]);

  const handleAddKnowledge = async (e) => {
    e.preventDefault();
    if (!newKb.question_trigger || !newKb.answer_content) return;
    setSavingKb(true);
    try {
      const keywordsArr = newKb.keywords
        ? newKb.keywords.split(',').map((k) => k.trim()).filter(Boolean)
        : [];

      const { error } = await supabase.from('ai_knowledge_base').insert({
        company_id: company?.id || null,
        category: newKb.category,
        question_trigger: newKb.question_trigger,
        answer_content: newKb.answer_content,
        keywords: keywordsArr,
        is_active: true
      });
      if (error) throw error;
      toast.success(isRTL ? 'تمت إضافة المعلومة لقاعدة المعرفة' : 'Knowledge item added');
      setShowAddKbModal(false);
      setNewKb({ category: 'faq', question_trigger: '', answer_content: '', keywords: '' });
      fetchKnowledge();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSavingKb(false);
    }
  };

  const handleDeleteKnowledge = async (id) => {
    try {
      const { error } = await supabase.from('ai_knowledge_base').delete().eq('id', id);
      if (error) throw error;
      setKnowledgeItems((prev) => prev.filter((item) => item.id !== id));
      toast.success(isRTL ? 'تم حذف العنصر' : 'Item deleted');
    } catch (err) {
      toast.error(err.message);
    }
  };

  // ------------------------------------------
  // 7. FETCH & MANAGE CHANNELS CONFIG
  // ------------------------------------------
  const fetchChannels = useCallback(async () => {
    setLoadingChannels(true);
    try {
      const { data, error } = await supabase
        .from('whatsapp_channels')
        .select('*')
        .order('created_at', { ascending: true });
      if (error) throw error;
      setChannels(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingChannels(false);
    }
  }, []);

  const handleSaveChannelConfig = async (channel) => {
    setSavingChannelId(channel.id);
    try {
      const { error } = await supabase
        .from('whatsapp_channels')
        .update({
          ai_enabled: channel.ai_enabled,
          ai_mode: channel.ai_mode || 'hybrid',
          ai_name: channel.ai_name || 'مساعد كوادر الذكي',
          ai_greeting: channel.ai_greeting,
          ai_prompt_instructions: channel.ai_prompt_instructions,
          ai_auto_handoff_keywords: Array.isArray(channel.ai_auto_handoff_keywords)
            ? channel.ai_auto_handoff_keywords
            : (channel.ai_auto_handoff_keywords || '').toString().split(',').map((k) => k.trim()).filter(Boolean),
          updated_at: new Date().toISOString()
        })
        .eq('id', channel.id);

      if (error) throw error;
      toast.success(isRTL ? 'تم حفظ إعدادات الذكاء الاصطناعي للقناة' : 'Channel AI settings saved');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSavingChannelId(null);
    }
  };

  // Load data based on active tab
  useEffect(() => {
    if (activeTab === 'leads') fetchLeads();
    if (activeTab === 'knowledge') fetchKnowledge();
    if (activeTab === 'channels') fetchChannels();
  }, [activeTab, fetchLeads, fetchKnowledge, fetchChannels]);

  // Filtered Conversations
  const filteredConversations = useMemo(() => {
    return conversations.filter((c) => {
      const matchSearch =
        !searchQuery ||
        (c.customer_name && c.customer_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (c.customer_phone && c.customer_phone.includes(searchQuery)) ||
        (c.session_id && c.session_id.includes(searchQuery));

      if (!matchSearch) return false;
      if (filterStatus === 'ai_active') return c.status === 'ai_active';
      if (filterStatus === 'human_takeover') return c.status === 'human_takeover';
      if (filterStatus === 'leads') return c.lead_status === 'lead_captured';
      if (filterStatus === 'web') return c.platform === 'web';
      return true;
    });
  }, [conversations, searchQuery, filterStatus]);

  const selectedConv = conversations.find((c) => c.id === selectedConvId);

  // Stats calculation
  const stats = useMemo(() => {
    return {
      total: conversations.length,
      humanTakeover: conversations.filter((c) => c.status === 'human_takeover').length,
      leads: conversations.filter((c) => c.lead_status === 'lead_captured').length,
      web: conversations.filter((c) => c.platform === 'web').length
    };
  }, [conversations]);

  return (
    <div className="ai-hub-root" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Top Header & Brand Command Center */}
      <header className="ai-hub-header">
        <div className="ai-header-brand">
          <div className="ai-brand-icon-box">
            <Sparkles className="w-7 h-7 text-emerald-400 animate-pulse" />
          </div>
          <div>
            <div className="ai-brand-badge">
              <span className="ai-pulse-dot" />
              <span>KWADER NEURAL AGENT • v2.1 ACTIVE</span>
            </div>
            <h1 className="ai-header-title">
              {isRTL ? 'مركز الذكاء الاصطناعي للمبيعات والخدمة' : 'AI Sales & Customer Support Hub'}
            </h1>
            <p className="ai-header-desc">
              {isRTL
                ? 'أتمتة محادثات الواتساب اللحظية، تأهيل المبيعات، وقاعدة المعرفة الفورية بأعلى دقة وأقل استهلاك'
                : 'Automate WhatsApp conversations, qualify leads, and manage KB with minimal resource cost'}
            </p>
          </div>
        </div>

        {/* KPI Stat Cards */}
        <div className="ai-kpi-group">
          <div className="ai-kpi-card blue">
            <div className="ai-kpi-icon">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <div className="ai-kpi-value">{stats.total}</div>
              <div className="ai-kpi-label">{isRTL ? 'إجمالي المحادثات' : 'Total Chats'}</div>
            </div>
          </div>

          <div className="ai-kpi-card amber">
            <div className="ai-kpi-icon">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="ai-kpi-value">{stats.humanTakeover}</div>
              <div className="ai-kpi-label">{isRTL ? 'تدخل بشري فوري' : 'Human Takeover'}</div>
            </div>
          </div>

          <div className="ai-kpi-card emerald">
            <div className="ai-kpi-icon">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="ai-kpi-value">{stats.leads}</div>
              <div className="ai-kpi-label">{isRTL ? 'عملاء مؤهلين (Leads)' : 'Qualified Leads'}</div>
            </div>
          </div>

          <div className="ai-kpi-card purple">
            <div className="ai-kpi-icon">
              <Zap className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <div className="ai-kpi-value">{knowledgeItems.length}</div>
              <div className="ai-kpi-label">{isRTL ? 'معارف مكتسبة (0-Token)' : 'Learned Knowledge (0-Token)'}</div>
            </div>
          </div>
        </div>
      </header>

      {/* Floating Segmented Tabs */}
      <nav className="ai-tabs-container">
        <button
          type="button"
          onClick={() => setActiveTab('inbox')}
          className={`ai-tab-button ${activeTab === 'inbox' ? 'active' : ''}`}
        >
          <MessageSquare className="w-4 h-4" />
          <span>{isRTL ? 'صندوق المحادثات الحية' : 'Live Inbox'}</span>
          {stats.humanTakeover > 0 && (
            <span className="ai-badge-pill">
              {stats.humanTakeover}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('leads')}
          className={`ai-tab-button ${activeTab === 'leads' ? 'active' : ''}`}
        >
          <Users className="w-4 h-4" />
          <span>{isRTL ? 'العملاء المحتملين (CRM)' : 'Sales Leads'}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('knowledge')}
          className={`ai-tab-button ${activeTab === 'knowledge' ? 'active' : ''}`}
        >
          <BookOpen className="w-4 h-4" />
          <span>{isRTL ? 'قاعدة المعرفة والأسئلة' : 'Knowledge Base'}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('channels')}
          className={`ai-tab-button ${activeTab === 'channels' ? 'active' : ''}`}
        >
          <Settings className="w-4 h-4" />
          <span>{isRTL ? 'إعدادات القنوات والوكيل' : 'Channel AI Settings'}</span>
        </button>
      </nav>

      {/* ============================================================
          TAB 1: LIVE INBOX STUDIO
          ============================================================ */}
      {activeTab === 'inbox' && (
        <div className="ai-inbox-grid">
          {/* Left Panel: Conversations List */}
          <section className="ai-panel-glass">
            <div className="ai-list-search-header">
              <div className="ai-search-box-wrapper">
                <Search className="w-4 h-4" />
                <input
                  type="text"
                  placeholder={isRTL ? 'بحث برقم الهاتف أو اسم العميل...' : 'Search by phone or name...'}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="ai-search-input-dark"
                />
              </div>

              <div className="ai-chips-scroller">
                <button
                  type="button"
                  onClick={() => setFilterStatus('all')}
                  className={`ai-filter-chip ${filterStatus === 'all' ? 'active' : ''}`}
                >
                  {isRTL ? 'الكل' : 'All'} ({conversations.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterStatus('human_takeover')}
                  className={`ai-filter-chip ${filterStatus === 'human_takeover' ? 'active' : ''}`}
                >
                  ⚠️ {isRTL ? 'تدخل بشري' : 'Human Needed'} ({stats.humanTakeover})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterStatus('ai_active')}
                  className={`ai-filter-chip ${filterStatus === 'ai_active' ? 'active' : ''}`}
                >
                  🤖 {isRTL ? 'نشط بالذكاء' : 'AI Active'}
                </button>
                <button
                  type="button"
                  onClick={() => setFilterStatus('leads')}
                  className={`ai-filter-chip ${filterStatus === 'leads' ? 'active' : ''}`}
                >
                  🎯 {isRTL ? 'عملاء' : 'Leads'} ({stats.leads})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterStatus('web')}
                  className={`ai-filter-chip ${filterStatus === 'web' ? 'active' : ''}`}
                >
                  🌐 {isRTL ? 'شات الموقع' : 'Web'} ({stats.web})
                </button>
              </div>
            </div>

            <div className="ai-conv-scroll-area">
              {loadingConversations ? (
                <div className="p-12 text-center text-xs text-slate-400">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-3 text-emerald-400" />
                  {isRTL ? 'جارٍ مزامنة المحادثات الحية...' : 'Loading chats...'}
                </div>
              ) : filteredConversations.length === 0 ? (
                <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
                  <MessageSquare className="w-8 h-8 text-slate-600 mb-1" />
                  <span className="text-xs font-bold">{isRTL ? 'لا توجد محادثات مطابقة' : 'No conversations found'}</span>
                </div>
              ) : (
                filteredConversations.map((conv) => {
                  const isSelected = conv.id === selectedConvId;
                  const isTakeover = conv.status === 'human_takeover';
                  const isLead = conv.lead_status === 'lead_captured';

                  return (
                    <div
                      key={conv.id}
                      onClick={() => setSelectedConvId(conv.id)}
                      className={`ai-conv-item-card ${isSelected ? 'selected' : ''}`}
                    >
                      <div className="ai-conv-top-line">
                        <div className="ai-conv-client-title">
                          <span className="text-sm">{conv.platform === 'web' ? '🌐' : '📱'}</span>
                          <span className="truncate font-semibold text-slate-100">
                            {conv.customer_name ? (
                              conv.customer_name
                            ) : conv.platform === 'web' ? (
                              <span>{isRTL ? 'زائر الموقع' : 'Web Visitor'}</span>
                            ) : conv.customer_phone ? (
                              <span dir="ltr">+{conv.customer_phone}</span>
                            ) : conv.session_id ? (
                              <span dir="ltr">+{conv.session_id}</span>
                            ) : (
                              <span>{isRTL ? 'عميل واتساب' : 'WhatsApp Customer'}</span>
                            )}
                          </span>
                        </div>
                        <span className="ai-conv-time">
                          {new Date(conv.last_message_at || conv.created_at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>

                      <div className="ai-conv-badges-line">
                        {isTakeover ? (
                          <span className="ai-status-tag takeover">
                            ⚠️ {isRTL ? 'مطلوب تدخل بشري' : 'Human Needed'}
                          </span>
                        ) : (
                          <span className="ai-status-tag active">
                            🤖 {isRTL ? 'وكيل ذكي' : 'AI Active'}
                          </span>
                        )}

                        {isLead && (
                          <span className="ai-status-tag lead">
                            🎯 {isRTL ? 'عميل مؤهل' : 'Lead'}
                          </span>
                        )}

                        {conv.platform === 'web' ? (
                          <span className="ai-conv-channel-name text-blue-400 border-blue-500/30">
                            🌐 {isRTL ? 'شات الموقع' : 'Web'}
                          </span>
                        ) : conv.whatsapp_channels?.name ? (
                          <span className="ai-conv-channel-name">
                            {conv.whatsapp_channels.name}
                          </span>
                        ) : null}
                      </div>

                      {conv.summary && (
                        <p className="ai-conv-snippet">
                          {conv.summary}
                        </p>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </section>

          {/* Right Panel: Chat Thread & Live Actions */}
          <section className="ai-panel-glass ai-chat-thread-panel">
            {selectedConv ? (
              <>
                {/* Chat Header */}
                <div className="ai-thread-header">
                  <div className="ai-thread-client-info">
                    <div className="ai-avatar-circle">
                      {selectedConv.platform === 'web' ? '🌐' : (selectedConv.customer_name?.charAt(0) || '📱')}
                    </div>
                    <div>
                      <div className="flex items-center gap-2.5">
                        <h3 className="ai-thread-name">
                          {selectedConv.customer_name || (selectedConv.platform === 'web' ? (isRTL ? 'زائر الموقع' : 'Web Visitor') : (isRTL ? 'عميل واتساب' : 'WhatsApp Customer'))}
                        </h3>
                        {selectedConv.platform === 'web' ? (
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-semibold border border-blue-400/30">
                            🌐 {isRTL ? 'محادثة من الموقع مباشرة' : 'Direct Website Chat'}
                          </span>
                        ) : selectedConv.customer_phone && selectedConv.customer_phone.length < 15 ? (
                          <a
                            href={`https://wa.me/${selectedConv.customer_phone}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ai-thread-phone-link"
                            dir="ltr"
                          >
                            +{selectedConv.customer_phone}
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        ) : selectedConv.session_id ? (
                          <span className="ai-thread-phone-link" dir="ltr">
                            +{selectedConv.session_id}
                          </span>
                        ) : null}
                      </div>
                      <span className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                        <span className={`w-2 h-2 rounded-full ${selectedConv.status === 'human_takeover' ? 'bg-amber-400' : 'bg-emerald-400 animate-pulse'}`} />
                        {selectedConv.status === 'human_takeover'
                          ? (isRTL ? 'الوضع: محول لموظف بشري (الرد الآلي متوقف)' : 'Human Takeover (Bot Paused)')
                          : (isRTL ? 'الوضع: الرد الآلي بالذكاء الاصطناعي نشط' : 'AI Active')}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleToggleStatus(selectedConv.id, selectedConv.status)}
                      className={`ai-btn-takeover ${
                        selectedConv.status === 'human_takeover' ? 'resume' : 'warn'
                      }`}
                    >
                      {selectedConv.status === 'human_takeover' ? (
                        <>
                          <Bot className="w-4 h-4" />
                          <span>{isRTL ? '🟢 إعادة تشغيل الذكاء الاصطناعي' : 'Resume AI'}</span>
                        </>
                      ) : (
                        <>
                          <ShieldAlert className="w-4 h-4" />
                          <span>{isRTL ? '⚠️ استلام المحادثة (تدخل بشري)' : 'Take Over'}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Messages Feed */}
                <div 
                  ref={chatFeedRef} 
                  onScroll={handleChatScroll} 
                  className="ai-chat-feed"
                  style={{ position: 'relative' }}
                >
                  {loadingMessages ? (
                    <div className="m-auto text-center text-xs text-slate-400">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-400" />
                      {isRTL ? 'جارٍ تحميل السجل...' : 'Loading messages...'}
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="m-auto text-center text-xs text-slate-400">
                      {isRTL ? 'لا توجد رسائل مسجلة بعد' : 'No messages yet'}
                    </div>
                  ) : (
                    messages.map((m) => {
                      const isUser = m.sender_type === 'user';
                      const isAi = m.sender_type === 'ai';

                      return (
                        <div
                          key={m.id}
                          className={`ai-bubble ${
                            isUser ? 'ai-bubble-user' : isAi ? 'ai-bubble-ai' : 'ai-bubble-human'
                          }`}
                        >
                          <div className="whitespace-pre-wrap">{m.message_text}</div>
                          <div className="ai-bubble-meta">
                            <span className="font-bold">
                              {isUser
                                ? (isRTL ? '👤 العميل' : 'User')
                                : isAi
                                ? (isRTL ? '🤖 مساعد كوادر' : 'KWADER AI')
                                : (isRTL ? '👨‍💼 موظف خدمة العملاء' : 'Support Agent')}
                            </span>
                            <span>•</span>
                            <span className="font-mono">
                              {new Date(m.created_at).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                            {m.tokens_used > 0 && (
                              <span className="font-mono text-emerald-400/80">
                                ({m.tokens_used} tok)
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}

                  {showScrollBottomBtn && (
                    <button
                      type="button"
                      onClick={() => {
                        isNearBottomRef.current = true;
                        setShowScrollBottomBtn(false);
                        chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
                      }}
                      className="ai-scroll-bottom-btn"
                      title={isRTL ? 'الانتقال إلى أسفل المحادثة' : 'Scroll to bottom'}
                    >
                      <span>↓</span>
                      <span>{isRTL ? 'الانتقال إلى أحدث الرسائل' : 'Scroll to bottom'}</span>
                    </button>
                  )}

                  <div ref={chatBottomRef} />
                </div>

                {/* Reply Form */}
                <form onSubmit={handleSendHumanReply} className="ai-input-form-bar">
                  <textarea
                    rows={2}
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder={
                      isRTL
                        ? 'اكتب رداً مباشراً للعميل عبر الواتساب (سيتم التحويل لبشري تلقائياً)...'
                        : 'Type reply to send directly to customer WhatsApp...'
                    }
                    className="ai-textarea-dark"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendHumanReply(e);
                      }
                    }}
                  />
                  <button
                    type="submit"
                    disabled={sendingReply || !replyText.trim()}
                    className="ai-btn-send"
                  >
                    <Send className="w-4 h-4" />
                    <span>{isRTL ? 'إرسال لواتساب' : 'Send'}</span>
                  </button>
                </form>
              </>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-12 text-slate-400">
                <div className="w-16 h-16 rounded-3xl bg-slate-800/60 border border-slate-700 flex items-center justify-center mb-4 shadow-xl">
                  <Bot className="w-8 h-8 text-emerald-400" />
                </div>
                <h3 className="text-base font-extrabold text-white mb-1">
                  {isRTL ? 'اختر محادثة لعرض تفاصيلها' : 'Select a conversation'}
                </h3>
                <p className="text-xs text-slate-400 max-w-xs">
                  {isRTL
                    ? 'يمكنك قراءة المحادثات الحية فور ورودها والتدخل للرد المباشر في أي وقت بنقرة واحدة'
                    : 'Monitor incoming live WhatsApp chats and take over immediately whenever needed'}
                </p>
              </div>
            )}
          </section>
        </div>
      )}

      {/* ============================================================
          TAB 2: LEADS CRM
          ============================================================ */}
      {activeTab === 'leads' && (
        <div className="ai-content-card">
          <div className="ai-section-head">
            <div>
              <h2 className="ai-section-title">
                {isRTL ? 'العملاء المحتملين المؤهلين آلياً (Leads Pipeline)' : 'AI-Qualified Sales Leads'}
              </h2>
              <p className="ai-section-subtitle">
                {isRTL
                  ? 'يتم استخراج هؤلاء العملاء آلياً بواسطة وكيل المبيعات الذكي أثناء المحادثة'
                  : 'Automatically extracted by the AI sales agent during chats'}
              </p>
            </div>
            <button
              type="button"
              onClick={fetchLeads}
              className="ai-btn-takeover resume py-2 px-4 text-xs"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>{isRTL ? 'تحديث البيانات' : 'Refresh'}</span>
            </button>
          </div>

          <div className="ai-dark-table-wrap">
            <table className="ai-dark-table">
              <thead>
                <tr>
                  <th>{isRTL ? 'اسم العميل' : 'Contact Name'}</th>
                  <th>{isRTL ? 'الهاتف' : 'Phone'}</th>
                  <th>{isRTL ? 'الشركة' : 'Company'}</th>
                  <th>{isRTL ? 'عدد الموظفين' : 'Employees'}</th>
                  <th>{isRTL ? 'الخدمات المطلوبة' : 'Interested Services'}</th>
                  <th>{isRTL ? 'حالة المبيعات' : 'Sales Status'}</th>
                  <th>{isRTL ? 'تاريخ الالتقاط' : 'Date'}</th>
                  <th>{isRTL ? 'تواصل مباشر' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody>
                {loadingLeads ? (
                  <tr>
                    <td colSpan={8} className="text-center py-10 text-xs text-slate-400">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-emerald-400" />
                      {isRTL ? 'جارٍ تحميل العملاء...' : 'Loading leads...'}
                    </td>
                  </tr>
                ) : leads.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-xs text-slate-400">
                      {isRTL ? 'لم يتم التقاط عملاء محتملين بعد' : 'No leads captured yet'}
                    </td>
                  </tr>
                ) : (
                  leads.map((lead) => (
                    <tr key={lead.id}>
                      <td className="font-extrabold text-white">{lead.contact_name || '—'}</td>
                      <td className="font-mono text-xs">
                        <a
                          href={`https://wa.me/${lead.contact_phone}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1"
                        >
                          +{lead.contact_phone}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </td>
                      <td className="font-bold text-slate-300">{lead.company_name || '—'}</td>
                      <td>
                        {lead.employee_count ? (
                          <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-slate-800 text-slate-300 border border-slate-700">
                            {lead.employee_count} {isRTL ? 'موظف' : 'employees'}
                          </span>
                        ) : '—'}
                      </td>
                      <td>
                        {Array.isArray(lead.interested_products) && lead.interested_products.length > 0 ? (
                          <div className="flex gap-1.5 flex-wrap">
                            {lead.interested_products.map((p, i) => (
                              <span key={i} className="text-[10px] bg-slate-800 text-emerald-300 border border-emerald-500/20 px-2 py-0.5 rounded-md font-bold">
                                {p}
                              </span>
                            ))}
                          </div>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>
                        <select
                          value={lead.status || 'new'}
                          onChange={(e) => handleUpdateLeadStatus(lead.id, e.target.value)}
                          className="text-xs font-extrabold py-1 px-2 rounded-lg border border-slate-700 bg-slate-900 text-white outline-none cursor-pointer"
                        >
                          <option value="new">🆕 جديد (New)</option>
                          <option value="contacted">📞 تم التواصل (Contacted)</option>
                          <option value="qualified">🎯 مؤهل (Qualified)</option>
                          <option value="closed_won">🎉 تعاقد ناجح (Won)</option>
                          <option value="closed_lost">❌ ملغي (Lost)</option>
                        </select>
                      </td>
                      <td className="text-xs text-slate-400 font-mono">
                        {new Date(lead.created_at).toLocaleDateString()}
                      </td>
                      <td>
                        <a
                          href={`https://wa.me/${lead.contact_phone}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ai-btn-takeover resume py-1 px-3 text-xs"
                        >
                          <Phone className="w-3 h-3" />
                          <span>{isRTL ? 'واتساب' : 'Chat'}</span>
                        </a>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============================================================
          TAB 3: KNOWLEDGE BASE
          ============================================================ */}
      {activeTab === 'knowledge' && (
        <div className="ai-content-card">
          <div className="ai-section-head">
            <div>
              <h2 className="ai-section-title">
                {isRTL ? 'قاعدة المعرفة والأسئلة الشائعة (AI Grounding)' : 'Knowledge Base (Grounding)'}
              </h2>
              <p className="ai-section-subtitle">
                {isRTL
                  ? 'يعتمد الذكاء الاصطناعي على هذه البيانات للإجابة بدقة متناهية دون تأليف أو تخمين'
                  : 'The AI references these exact facts to answer accurately without hallucinations'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowAddKbModal(true)}
              className="ai-btn-takeover resume py-2 px-4 text-xs"
            >
              <Plus className="w-4 h-4" />
              <span>{isRTL ? 'إضافة معلومة جديدة' : 'Add Item'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {loadingKnowledge ? (
              <div className="col-span-2 text-center py-12 text-xs text-slate-400">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-400" />
                {isRTL ? 'جارٍ تحميل قاعدة المعرفة...' : 'Loading...'}
              </div>
            ) : knowledgeItems.length === 0 ? (
              <div className="col-span-2 text-center py-12 text-xs text-slate-400">
                {isRTL ? 'لا توجد معلومات مضافة بعد' : 'No items yet'}
              </div>
            ) : (
              knowledgeItems.map((item) => (
                <div key={item.id} className="p-5 rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-md shadow-lg flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                        {item.category}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDeleteKnowledge(item.id)}
                        className="text-slate-500 hover:text-red-400 p-1 transition-colors"
                        title={isRTL ? 'حذف' : 'Delete'}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <h4 className="text-sm font-extrabold text-white mb-2">
                      {item.question_trigger}
                    </h4>
                    <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
                      {item.answer_content}
                    </p>
                  </div>
                  {Array.isArray(item.keywords) && item.keywords.length > 0 && (
                    <div className="flex gap-1.5 flex-wrap mt-4 pt-3 border-t border-slate-800/80">
                      {item.keywords.map((k, i) => (
                        <span key={i} className="text-[10px] text-slate-400 bg-slate-800/80 border border-slate-700/80 px-2 py-0.5 rounded-md font-mono">
                          #{k}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Add Knowledge Modal */}
          {showAddKbModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
              <div className="bg-slate-900 rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-800 text-white">
                <h3 className="text-base font-extrabold text-white mb-4">
                  {isRTL ? 'إضافة معلومة جديدة لقاعدة المعرفة' : 'Add Knowledge Item'}
                </h3>
                <form onSubmit={handleAddKnowledge} className="flex flex-col gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-300 mb-1.5 block">
                      {isRTL ? 'التصنيف' : 'Category'}
                    </label>
                    <select
                      value={newKb.category}
                      onChange={(e) => setNewKb({ ...newKb, category: e.target.value })}
                      className="ai-input-dark"
                    >
                      <option value="company_profile">{isRTL ? '🏢 نبذة وتفاصيل الشركة وخدماتها (Company Profile)' : 'Company Profile'}</option>
                      <option value="pricing">{isRTL ? '💰 الأسعار والباقات (Pricing)' : 'Pricing'}</option>
                      <option value="features">{isRTL ? '✨ المميزات والخدمات (Features)' : 'Features'}</option>
                      <option value="support">{isRTL ? '🛠️ الدعم الفني وأجهزة البصمة (Support)' : 'Support'}</option>
                      <option value="faq">{isRTL ? '❓ أسئلة واستفسارات شائعة (FAQ)' : 'FAQ'}</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-300 mb-1.5 block">
                      {isRTL ? 'عنوان الموضوع أو السؤال' : 'Topic Title / Question'}
                    </label>
                    <input
                      type="text"
                      placeholder={isRTL ? 'مثال: نبذة عن الشركة وخدماتها / شروط التجربة' : 'e.g. About company / trial policy'}
                      value={newKb.question_trigger}
                      onChange={(e) => setNewKb({ ...newKb, question_trigger: e.target.value })}
                      className="ai-input-dark"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-300 mb-1.5 block">
                      {isRTL ? 'التفاصيل والمعلومات (يستوعبها الذكاء الاصطناعي ويشرحها للعميل)' : 'Details & Facts (AI synthesizes this)'}
                    </label>
                    <textarea
                      rows={4}
                      placeholder={isRTL ? 'اكتب الإجابة الواضحة والموجزة...' : 'Write the exact answer...'}
                      value={newKb.answer_content}
                      onChange={(e) => setNewKb({ ...newKb, answer_content: e.target.value })}
                      className="ai-input-dark resize-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-300 mb-1.5 block">
                      {isRTL ? 'الكلمات المفتاحية (مفصولة بفاصلة)' : 'Keywords (comma-separated)'}
                    </label>
                    <input
                      type="text"
                      placeholder="تجربة, مجاني, باقات, تفعيل"
                      value={newKb.keywords}
                      onChange={(e) => setNewKb({ ...newKb, keywords: e.target.value })}
                      className="ai-input-dark"
                    />
                  </div>

                  <div className="flex gap-2 justify-end mt-2">
                    <button
                      type="button"
                      onClick={() => setShowAddKbModal(false)}
                      className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white rounded-xl transition-colors"
                    >
                      {isRTL ? 'إلغاء' : 'Cancel'}
                    </button>
                    <button
                      type="submit"
                      disabled={savingKb}
                      className="ai-btn-takeover resume py-2 px-5 text-xs"
                    >
                      {savingKb ? (isRTL ? 'جارٍ الحفظ...' : 'Saving...') : (isRTL ? 'حفظ المعلومة' : 'Save')}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================================================
          TAB 4: CHANNELS AI CONFIG
          ============================================================ */}
      {activeTab === 'channels' && (
        <div className="ai-content-card">
          <div className="ai-section-head">
            <div>
              <h2 className="ai-section-title">
                {isRTL ? 'ربط وتفعيل الذكاء الاصطناعي على قنوات الواتساب' : 'WhatsApp Channels AI Settings'}
              </h2>
              <p className="ai-section-subtitle">
                {isRTL
                  ? 'يمكنك تفعيل أو تعطيل وكيل الذكاء الاصطناعي وتحديد نبرة الإجابة لكل قناة بشكل مستقل'
                  : 'Enable or disable AI agent and customize persona for each WhatsApp channel independently'}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            {loadingChannels ? (
              <div className="text-center py-12 text-xs text-slate-400">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-400" />
                {isRTL ? 'جارٍ تحميل القنوات...' : 'Loading channels...'}
              </div>
            ) : channels.length === 0 ? (
              <div className="text-center py-12 text-xs text-slate-400">
                {isRTL ? 'لا توجد قنوات واتساب مسجلة بعد' : 'No WhatsApp channels registered'}
              </div>
            ) : (
              channels.map((ch) => {
                const isSaving = savingChannelId === ch.id;

                return (
                  <div key={ch.id} className="ai-channel-card-dark">
                    <div className="flex items-center justify-between flex-wrap gap-3 border-b border-slate-800 pb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-xl">
                          📲
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-black text-white">{ch.name}</h3>
                            {ch.is_default && (
                              <span className="text-[10px] font-extrabold bg-slate-800 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                                {isRTL ? 'القناة المركزية الافتراضية' : 'Default Channel'}
                              </span>
                            )}
                          </div>
                          {ch.phone_number && (
                            <span className="text-xs font-mono font-bold text-slate-400">
                              (+{ch.phone_number})
                            </span>
                          )}
                        </div>
                      </div>

                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={ch.ai_enabled || false}
                          onChange={(e) => {
                            const updated = { ...ch, ai_enabled: e.target.checked };
                            setChannels((prev) => prev.map((c) => (c.id === ch.id ? updated : c)));
                          }}
                          className="sr-only peer"
                        />
                        <div className="w-12 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-600 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                        <span className="ms-3 text-xs font-extrabold text-white">
                          {ch.ai_enabled
                            ? (isRTL ? 'الوكيل الذكي مفعل 🟢' : 'AI Enabled')
                            : (isRTL ? 'الوكيل الذكي معطل ⚪' : 'AI Disabled')}
                        </span>
                      </label>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="text-xs font-bold text-slate-300 mb-1.5 block">
                          {isRTL ? 'اسم البوت في المحادثة' : 'Agent Name'}
                        </label>
                        <input
                          type="text"
                          value={ch.ai_name || ''}
                          onChange={(e) => {
                            const updated = { ...ch, ai_name: e.target.value };
                            setChannels((prev) => prev.map((c) => (c.id === ch.id ? updated : c)));
                          }}
                          placeholder="مساعد كوادر الذكي"
                          className="ai-input-dark"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-bold text-slate-300 mb-1.5 block">
                          {isRTL ? 'نمط عمل الوكيل' : 'Agent Mode'}
                        </label>
                        <select
                          value={ch.ai_mode || 'hybrid'}
                          onChange={(e) => {
                            const updated = { ...ch, ai_mode: e.target.value };
                            setChannels((prev) => prev.map((c) => (c.id === ch.id ? updated : c)));
                          }}
                          className="ai-input-dark font-extrabold cursor-pointer"
                        >
                          <option value="hybrid">{isRTL ? 'هجين (مبيعات + خدمة عملاء ودعم)' : 'Hybrid (Sales + Support)'}</option>
                          <option value="sales">{isRTL ? 'مبيعات فقط وتأهيل عملاء (Sales Only)' : 'Sales Only'}</option>
                          <option value="support">{isRTL ? 'خدمة عملاء ودعم فني (Support Only)' : 'Support Only'}</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-xs font-bold text-slate-300 mb-1.5 block">
                          {isRTL ? 'كلمات التحويل الفوري للبشري' : 'Handoff Trigger Keywords'}
                        </label>
                        <input
                          type="text"
                          value={
                            Array.isArray(ch.ai_auto_handoff_keywords)
                              ? ch.ai_auto_handoff_keywords.join(', ')
                              : ch.ai_auto_handoff_keywords || ''
                          }
                          onChange={(e) => {
                            const updated = { ...ch, ai_auto_handoff_keywords: e.target.value };
                            setChannels((prev) => prev.map((c) => (c.id === ch.id ? updated : c)));
                          }}
                          placeholder="بشري, موظف, خدمة عملاء, شكوى"
                          className="ai-input-dark"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-300 mb-1.5 block">
                        {isRTL ? 'الرسالة الترحيبية المخصصة (0 توكنز)' : 'Custom Greeting Message'}
                      </label>
                      <input
                        type="text"
                        value={ch.ai_greeting || ''}
                        onChange={(e) => {
                          const updated = { ...ch, ai_greeting: e.target.value };
                          setChannels((prev) => prev.map((c) => (c.id === ch.id ? updated : c)));
                        }}
                        placeholder="أهلاً بك في منصة كوادر! 👋 كيف يمكنني مساعدتك اليوم؟"
                        className="ai-input-dark"
                      />
                    </div>

                    {/* ============================================================
                        COMPANY DETAILS & SPEAKING STYLE INSTRUCTIONS
                        ============================================================ */}
                    <div className="space-y-3 p-4 rounded-2xl bg-slate-900/80 border border-emerald-500/20 shadow-inner">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-amber-400" />
                          <label className="text-xs font-black text-white">
                            {isRTL
                              ? 'تفاصيل ونبذة الشركة + توجيهات أسلوب التحدث واللهجة'
                              : 'Company Profile & Speaking Persona Instructions'}
                          </label>
                        </div>
                        <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                          {isRTL ? 'أولوية قصوى للموديل ⭐' : 'Highest AI Priority ⭐'}
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        {isRTL
                          ? 'اكتب هنا كل ما ترغب أن يعرفه الوكيل الذكي عن شركتك (خدماتكم، أسعاركم، سياستكم) وطريقة حديثه المفضلة (تجنب الفصحى، لهجة مصرية أو بيضاء مريحة، أسلوب بشري مرح).'
                          : 'Write complete details about your company, offerings, and specify the exact conversational tone/dialect.'}
                      </p>

                      <textarea
                        rows={6}
                        value={ch.ai_prompt_instructions || ''}
                        onChange={(e) => {
                          const updated = { ...ch, ai_prompt_instructions: e.target.value };
                          setChannels((prev) => prev.map((c) => (c.id === ch.id ? updated : c)));
                        }}
                        placeholder={
                          isRTL
                            ? `مثال لتوجيهات الذكاء الاصطناعي:
- تفاصيل الشركة: شركة تقدم حلول سحابية لإدارة الحضور والانصراف، وربط البصمات، وحساب الرواتب..
- طريقة الحديث: تحدث بلهجة عربية بيضاء بسيطة وسلسة وقريبة من العامية الراقية، ممنوع التحدث بالفصحى الرسمية الجافة أو عبارات الروبوتات مثل "نشكر تواصلكم". خليك ودود ومرح، واستخدم عبارات زي "يا هلا بيك" و"تمام فهمت عليك" و"خليني أوضحلك"، واختصر الردود دائماً في سطرين أو 3 أسطر واختم بسؤال يفتح حوار لطيف.`
                            : 'Enter company details, services, pricing notes, and conversational tone instructions...'
                        }
                        className="ai-input-dark resize-y font-sans leading-relaxed text-xs p-3"
                      />

                      {/* Quick Presets */}
                      <div className="flex items-center gap-2 flex-wrap pt-1">
                        <span className="text-[11px] font-bold text-slate-400">
                          {isRTL ? 'نماذج جاهزة سريعة:' : 'Quick Presets:'}
                        </span>

                        <button
                          type="button"
                          onClick={() => {
                            const presetText = isRTL
                              ? 'تحدث بلهجة عربية بيضاء بسيطة وسلسة جداً وقريبة من العامية الراقية، ممنوع الفصحى المتكلفة أو الردود الروبوتية مثل "نشكر تواصلكم مع المنصة". كن ودوداً جداً ومرحاً واستخدم عبارات ترحيب طبيعية مثل "يا هلا والله" و"منورنا"، واجعل إجاباتك خفيفة وموجزة.'
                              : 'Speak in a friendly, conversational, human white Arabic dialect. Avoid stiff formal Arabic and robotic phrases.';
                            const updatedInstructions = ch.ai_prompt_instructions
                              ? `${ch.ai_prompt_instructions.trim()}\n\n${presetText}`
                              : presetText;
                            const updated = { ...ch, ai_prompt_instructions: updatedInstructions };
                            setChannels((prev) => prev.map((c) => (c.id === ch.id ? updated : c)));
                          }}
                          className="px-2.5 py-1 text-[11px] font-bold bg-slate-800 hover:bg-slate-700 text-emerald-300 rounded-lg border border-slate-700 transition-colors"
                        >
                          💬 {isRTL ? '+ أسلوب إنسان ودود ولهجة بيضاء' : '+ Friendly Human Tone'}
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            const presetText = isRTL
                              ? 'أسلوبك أسلوب خبير ومستشار مبيعات شاطر ولبق، تفهم احتياج العميل مباشرة، وتركز على تبسيط الأمور وتوضيح المزايا والاشتراك وتجربة النظام المجانية، وتطلب اسمه واسم شركته بلطافة لتسجيله كعميل محتمل.'
                              : 'Act as a top-performing sales consultant. Focus on customer value and capture lead info.';
                            const updatedInstructions = ch.ai_prompt_instructions
                              ? `${ch.ai_prompt_instructions.trim()}\n\n${presetText}`
                              : presetText;
                            const updated = { ...ch, ai_prompt_instructions: updatedInstructions };
                            setChannels((prev) => prev.map((c) => (c.id === ch.id ? updated : c)));
                          }}
                          className="px-2.5 py-1 text-[11px] font-bold bg-slate-800 hover:bg-slate-700 text-cyan-300 rounded-lg border border-slate-700 transition-colors"
                        >
                          🎯 {isRTL ? '+ مستشار مبيعات محترف' : '+ Sales Consultant'}
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            const presetText = isRTL
                              ? 'تحدث بلهجة مصرية عامية مهذبة وودودة جداً، زي: "يا هلا بيك يا فندم"، "تمام فهمت قصدك"، "بص يا غالي"، "خليني أقولك"، مع الحفاظ على الاحترام التام والبساطة واختصار الإجابات بدون تطويل.'
                              : 'Speak in polite, friendly Egyptian colloquial Arabic with brief and engaging replies.';
                            const updatedInstructions = ch.ai_prompt_instructions
                              ? `${ch.ai_prompt_instructions.trim()}\n\n${presetText}`
                              : presetText;
                            const updated = { ...ch, ai_prompt_instructions: updatedInstructions };
                            setChannels((prev) => prev.map((c) => (c.id === ch.id ? updated : c)));
                          }}
                          className="px-2.5 py-1 text-[11px] font-bold bg-slate-800 hover:bg-slate-700 text-amber-300 rounded-lg border border-slate-700 transition-colors"
                        >
                          🇪🇬 {isRTL ? '+ عامية مصرية راقية' : '+ Egyptian Friendly'}
                        </button>
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={() => handleSaveChannelConfig(ch)}
                        className="ai-btn-takeover resume py-2.5 px-6 text-xs font-black shadow-lg shadow-emerald-500/20"
                      >
                        {isSaving ? (isRTL ? 'جارٍ الحفظ...' : 'Saving...') : (isRTL ? '💾 حفظ إعدادات القناة وتوجيهات الوكيل' : 'Save Channel Config')}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
