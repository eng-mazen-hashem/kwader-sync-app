require('dotenv').config();
const http = require('http');
const { createClient } = require('@supabase/supabase-js');

// Store active training sessions for persona cloning
const TRAINER_SESSIONS = new Map();

const { LeaseManager } = require('./leaseManager');
const { initWhatsAppClient } = require('./whatsappClient');
const { QueueProcessor } = require('./queueProcessor');

// Environment Configuration
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://whuopqnhmsevlilkcfre.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DEFAULT_CHANNEL_ID = process.env.DEFAULT_CHANNEL_ID || '2a326ace-afbd-47b9-927e-25e44fb973cd';
const SESSION_ENCRYPTION_KEY = process.env.SESSION_ENCRYPTION_KEY || 'kwader_cluster_secret_aes_key_2026_x99';
const HTTP_PORT = parseInt(process.env.PORT || '3001', 10);

if (!SUPABASE_KEY) {
    console.error('❌ FATAL: SUPABASE_SERVICE_ROLE_KEY is required!');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const APP_VERSION = require('./package.json').version || '2.9.2';

console.log('═══════════════════════════════════════════════════════════════');
console.log(' 🚀 KWADER Decentralized WhatsApp Cluster Engine (Baileys) v2.9.9 ');
console.log('═══════════════════════════════════════════════════════════════');

// MULTI-TENANCY REFACTOR
const ACTIVE_CHANNELS = new Map();

async function startChannelManager(channelId) {
    if (ACTIVE_CHANNELS.has(channelId)) return;

    console.log(`\n=============================================`);
    console.log(`🚀 Booting Multi-Tenant Node for Channel: ${channelId}`);
    console.log(`=============================================\n`);

    const state = {
        activeClient: null,
        queueProcessor: null,
        currentRole: 'standby',
        currentEpoch: 0,
        isConnected: false,
        activePhoneNumber: null,
        leaseManager: null
    };

    const startWhatsAppLeaderEngine = async () => {
        if (state.activeClient) {
            state.activeClient.disconnect();
            state.activeClient = null;
        }

        if (state.queueProcessor) {
            state.queueProcessor.stop();
            state.queueProcessor = null;
        }

        state.activeClient = await initWhatsAppClient({
            channelId: channelId,
            supabase,
            encryptionKey: SESSION_ENCRYPTION_KEY,
            onConnected: (sock) => {
                state.isConnected = true;
                const fullJid = sock.user?.id || '';
                state.activePhoneNumber = fullJid.split(':')[0] || fullJid.split('@')[0] || '';
                console.log(`🎉 [WhatsApp - ${channelId}] Connected as: ${state.activePhoneNumber}`);

                if (!state.queueProcessor) {
                    state.queueProcessor = new QueueProcessor({
                        supabase,
                        channelId: channelId,
                        nodeId: state.leaseManager.nodeId,
                        getSocket: () => state.activeClient?.sock,
                        isLeader: () => state.currentRole === 'leader' && state.isConnected
                    });
                    state.queueProcessor.start();
                }
            },
            onDisconnected: ({ statusCode, isLoggedOut }) => {
                state.isConnected = false;
                console.warn(`⚠️ [WhatsApp - ${channelId}] Disconnected. Status: ${statusCode}, LoggedOut: ${isLoggedOut}`);
                if (state.queueProcessor) {
                    state.queueProcessor.stop();
                    state.queueProcessor = null;
                }
                
                if (state.currentRole === 'leader') {
                    if (isLoggedOut) {
                        console.log(`[WhatsApp - ${channelId}] Device logged out. Stepping down from leadership to allow fresh QR generation...`);
                        if (state.leaseManager) {
                            state.leaseManager.stepDown('logged_out').catch(err => 
                                console.error('Error stepping down:', err)
                            );
                        }
                    } else {
                        console.log(`[WhatsApp - ${channelId}] Attempting auto-reconnect in 5s...`);
                        setTimeout(() => {
                            if (state.currentRole === 'leader') {
                                startWhatsAppLeaderEngine().catch(err => 
                                    console.error(`[WhatsApp - ${channelId}] Auto-reconnect failed:`, err.message)
                                );
                            }
                        }, 5000);
                    }
                }
            },
        onMessage: async (msgUpsert, sock) => {
            try {
                if (!msgUpsert.messages || !msgUpsert.messages[0]) return;
                const msg = msgUpsert.messages[0];
                if (msg.key.fromMe) return;
                
                const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text;
                if (!text || !text.trim()) return;

                const jid = msg.key.remoteJid;
                if (!jid || jid.includes('@g.us') || jid === 'status@broadcast') return;

                const phone = jid.split('@')[0];
                const customerName = msg.pushName || phone;

                // 1. Fetch channel AI settings and company limits safely
                let channelData = null;
                try {
                    const { data, error } = await supabase
                        .from('whatsapp_channels')
                        .select('*, companies(settings)')
                        .eq('id', channelId)
                        .single();
                    if (error || !data) {
                        const { data: simpleData } = await supabase
                            .from('whatsapp_channels')
                            .select('*')
                            .eq('id', channelId)
                            .single();
                        channelData = simpleData;
                    } else {
                        channelData = data;
                    }
                } catch (e) {
                    console.error('[WhatsApp AI] Exception fetching channel:', e.message);
                }
                
                if (!channelData || channelData.ai_enabled === false) {
                    return; // Ignore if AI disabled
                }

                console.log(`[WhatsApp AI] 📩 Message from ${phone} (${customerName}): "${text.trim().substring(0, 50)}..."`);

                // ══════════════════════════════════════════════════════════════
                // 🎓 Open Roleplay Persona Training Mode (Cumulative Learning)
                // ══════════════════════════════════════════════════════════════
                if (text.trim() === '#تدريب' || text.trim() === '#train') {
                    TRAINER_SESSIONS.set(phone, { 
                        channelId: channelId,
                        currentPlaybook: channelData.ai_prompt_instructions || '',
                        history: [
                            { role: 'system', content: 'أنت الآن تلعب دور "عميل مهتم ولكن متردد قليلاً" يتحدث مع مندوب مبيعات على الواتساب. هدفك هو اختبار المندوب بطرح أسئلة عن تفاصيل المنتج، الأسعار، وبعض الاعتراضات (مثل السعر غالي، أو أريد ضمانات). ردودك يجب أن تكون قصيرة جداً، مصرية عامية، وكأنك تكتب من الموبايل. لا تكن ذكاءً اصطناعياً أبداً.' },
                            { role: 'assistant', content: 'السلام عليكم، كنت عايز أعرف تفاصيل أكتر عن خدماتكم وبكام الأسعار لو سمحت؟' }
                        ]
                    });
                    
                    await sock.sendMessage(jid, { text: `🤖 أهلاً يا مدير! سألعب الآن دور "العميل" وأنت المندوب.\nحاول إقناعي خطوة بخطوة وسأقوم بالرد عليك واختبارك ببعض الاعتراضات لكي أتعلم وتتشرب المنظومة طريقتك بالكامل.\n\n💡 ملاحظة: هذا التدريب تراكمي، سأضيف ما أتعلمه اليوم لخبراتي السابقة.\n\nعندما تنتهي من تدريبي وتود الحفظ، فقط اكتب: *انهاء التدريب*\n\nسأبدأ الآن كعميل 👇` });
                    
                    // Simulate typing then send first customer message
                    setTimeout(async () => {
                        await sock.sendMessage(jid, { text: 'السلام عليكم، كنت عايز أعرف تفاصيل أكتر عن خدماتكم وبكام الأسعار لو سمحت؟' });
                    }, 2000);
                    return;
                }

                if (TRAINER_SESSIONS.has(phone)) {
                    const session = TRAINER_SESSIONS.get(phone);

                    if (text.trim() === 'انهاء التدريب') {
                        await sock.sendMessage(jid, { text: `⏳ جاري تحليل المحاكي بالكامل ودمج خبراتك الجديدة مع خبراتي السابقة... 🧠` });
                        
                        try {
                            const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                                method: 'POST',
                                headers: { 'Authorization': `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    model: 'qwen-2.5-70b-versatile',
                                    messages: [{
                                        role: 'system',
                                        content: `أنت خبير هندسة أوامر وتصميم شخصيات (AI Sales Persona). تم إجراء محاكاة بيعية بين صاحب الشركة (البائع) والعميل.
المطلوب:
1. استخرج من المحادثة كل الأساليب البيعية، المعلومات الدقيقة، الأسعار، طريقة الرد على الاعتراضات، ونبرة الصوت بالعامية المصرية التي استخدمها البائع.
2. قم بدمج هذه المعلومات الجديدة مع دليل المبيعات القديم الخاص به (إن وجد) لتكوين دليل مبيعات محدث وأكثر قوة.
3. المخرجات يجب أن تكون System Prompt مباشر ومفصل ليتبعه روبوت الشركة للرد على العملاء الحقيقيين لاحقاً.

الدليل القديم:
${session.currentPlaybook || 'لا يوجد دليل قديم.'}`
                                    }, {
                                        role: 'user',
                                        content: `نص محاكاة المبيعات:\n${JSON.stringify(session.history)}`
                                    }],
                                    max_tokens: 1500,
                                    temperature: 0.1
                                })
                            });

                            if (groqRes.ok) {
                                const aiData = await groqRes.json();
                                const newPlaybook = aiData.choices[0].message.content.trim();
                                
                                await supabase.from('whatsapp_channels').update({
                                    ai_prompt_instructions: newPlaybook
                                }).eq('id', session.channelId);

                                TRAINER_SESSIONS.delete(phone);
                                await sock.sendMessage(jid, { text: `🎉 تمت العملية بنجاح! تم تطوير الدليل البيعي بنجاح ودمجه ليكون أكثر ذكاءً واحترافية.\n\nإليك الملخص الجديد:\n\n${newPlaybook}` });
                            } else {
                                await sock.sendMessage(jid, { text: `❌ حدث خطأ أثناء تحليل البيانات.` });
                            }
                        } catch (e) {
                            await sock.sendMessage(jid, { text: `❌ خطأ في الاتصال.` });
                        }
                    } else {
                        // Continue roleplay
                        session.history.push({ role: 'user', content: text });
                        
                        try {
                            const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                                method: 'POST',
                                headers: { 'Authorization': `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    model: 'allam-2-7b',
                                    messages: session.history,
                                    max_tokens: 100,
                                    temperature: 0.5
                                })
                            });
                            
                            if (groqRes.ok) {
                                const aiData = await groqRes.json();
                                const customerReply = aiData.choices[0].message.content.trim();
                                session.history.push({ role: 'assistant', content: customerReply });
                                await sock.sendMessage(jid, { text: customerReply });
                            }
                        } catch (e) {
                            await sock.sendMessage(jid, { text: `(خطأ في محاكاة العميل)` });
                        }
                    }
                    return;
                }
                // ══════════════════════════════════════════════════════════════

                // 2. Fetch or create active conversation in ai_conversations
                let { data: conv } = await supabase
                    .from('ai_conversations')
                    .select('*')
                    .eq('platform', 'whatsapp')
                    .eq('session_id', phone)
                    .maybeSingle();

                if (!conv) {
                    const { data: createdConv, error: createErr } = await supabase
                        .from('ai_conversations')
                        .insert({
                            channel_id: channelId,
                            company_id: channelData.company_id || null,
                            platform: 'whatsapp',
                            session_id: phone,
                            customer_name: customerName,
                            customer_phone: phone,
                            status: 'ai_active',
                            lead_status: 'none',
                            last_message_at: new Date().toISOString()
                        })
                        .select()
                        .single();
                    if (!createErr) conv = createdConv;
                } else {
                    await supabase
                        .from('ai_conversations')
                        .update({
                            last_message_at: new Date().toISOString(),
                            ...(customerName && (!conv.customer_name || conv.customer_name === phone) ? { customer_name: customerName } : {})
                        })
                        .eq('id', conv.id);
                }

                // 3. Save incoming user message in ai_messages
                if (conv?.id) {
                    await supabase.from('ai_messages').insert({
                        conversation_id: conv.id,
                        sender_type: 'user',
                        role: 'user',
                        content: text.trim(),
                        message_text: text.trim(),
                        tokens_used: 0,
                        status: 'delivered'
                    });
                }

                // 4. Check if conversation is in human takeover mode
                if (conv?.status === 'human_takeover') {
                    console.log(`[WhatsApp AI] ⏸️ Chat with ${phone} is in human_takeover mode. Skipping AI.`);
                    return;
                }

                // 5. Intelligent Human Escalation Detection (Must understand & solve before handoff)
                const explicitHandoffRegex = /(حولني (لـ)?(بشري|موظف|انسان|حد تاني)|(عايز|اريد|حابب|ابغى) (اتكلم|اكلم|تحدث|اتواصل) مع (بشري|انسان|حد|شخص|مسؤول|موظف|خدمة العملاء)|(كلمني|اتصل بي|اتصلوا بي|اتصال) (هاتف|تليفون|فون|مكالمة)|مش عايز (بوت|روبوت|ذكاء))/i;
                const isExplicitHandoff = explicitHandoffRegex.test(text);

                if (isExplicitHandoff && conv?.id) {
                    await supabase
                        .from('ai_conversations')
                        .update({ status: 'human_takeover', summary: 'طلب العميل مكالمة أو تواصل بشري' })
                        .eq('id', conv.id);
                    console.log(`[WhatsApp AI] 👨‍💼 Explicit handoff flagged for ${phone}, AI will answer and confirm follow-up.`);
                }

                // 6. Grounding Context from 0-token Knowledge Base (Never raw bypass)
                let kbGroundingText = '';
                try {
                    let kbQuery = supabase
                        .from('ai_knowledge_base')
                        .select('question_trigger, answer_content, keywords')
                        .eq('is_active', true);

                    if (channelData.company_id) {
                        kbQuery = kbQuery.or(`company_id.is.null,company_id.eq.${channelData.company_id}`);
                    } else {
                        kbQuery = kbQuery.is('company_id', null);
                    }

                    const { data: kbList } = await kbQuery.limit(60);
                    if (kbList && kbList.length > 0) {
                        const lowerText = text.trim().toLowerCase();
                        for (const item of kbList) {
                            const triggerMatch = item.question_trigger && lowerText.includes(item.question_trigger.toLowerCase());
                            const keywordMatch = Array.isArray(item.keywords) && item.keywords.some(k => k && lowerText.includes(k.toLowerCase()));
                            if (triggerMatch || keywordMatch) {
                                kbGroundingText = `\n\n📚 معلومات موثقة من قاعدة المعرفة بخصوص الاستفسار:\n${item.answer_content}\n(تنبيه: أعد صياغة هذه المعلومات بأسلوبك البشري الودود وبالعامية المصرية المناسبة للمحادثة واختم بسؤال، لا تقم بنسخها بنقاط جافة!)`;
                                break;
                            }
                        }
                    }
                } catch (kbErr) {
                    console.warn('[WhatsApp AI] KB lookup warning:', kbErr.message);
                }

                // 7. PHASE 1+2: Smart Context Loading (summary + profile + rolling window history)
                const { summary: convSummary, profile: customerProfile, history } = await buildSmartContext(conv, phone);

                // PHASE 2: Update customer profile in background (non-blocking)
                autoUpdateCustomerProfile(phone, channelId, text, customerName);

                // 8. PHASE 4: Layered Prompt (conditional blocks = ~55% fewer tokens)
                const aiName = channelData.ai_name || 'أحمد | مبيعات كوادر';
                const customInstructions = channelData.ai_prompt_instructions || '';
                const systemPrompt = buildLayeredPrompt({
                    aiName,
                    profile: customerProfile,
                    summary: convSummary,
                    kbGroundingText,
                    text,
                    isExplicitHandoff,
                    customInstructions
                });

                // 8.5. Enforce AI Limits
                const companySettings = channelData.companies?.settings || {};
                const limits = companySettings.limits || {};
                const usage = companySettings.usage || {};
                
                let currentMonthUsage = usage.ai_queries_this_month || 0;
                let lastResetMonth = usage.last_reset_month || new Date().getMonth();
                
                if (lastResetMonth !== new Date().getMonth()) {
                    currentMonthUsage = 0;
                }

                const maxQueries = limits.max_ai_queries !== undefined ? limits.max_ai_queries : 500;
                
                if (channelData.company_id && currentMonthUsage >= maxQueries) {
                    console.log(`[WhatsApp AI] 🚫 AI Limit Reached for channel ${channelId} (${currentMonthUsage}/${maxQueries})`);
                    await sock.sendMessage(jid, { 
                        text: 'بعتذر لحضرتك جداً، عندنا تحديث فني بسيط في السيستم حالياً.. ممكن تسيب لي رقمك أو تتواصل مع الإدارة مباشرة وهنكون تحت أمرك فوراً؟ 🙏' 
                    });
                    return;
                }

                // Pre-increment usage to avoid race conditions
                if (channelData.company_id) {
                    currentMonthUsage++;
                    await supabase.from('companies').update({
                        settings: {
                            ...companySettings,
                            usage: {
                                ...usage,
                                ai_queries_this_month: currentMonthUsage,
                                last_reset_month: new Date().getMonth()
                            }
                        }
                    }).eq('id', channelData.company_id);
                }

                // 9. Generate AI Reply
                const { replyText, tokensUsed } = await generateAiReply({
                    systemPrompt,
                    history,
                    text: text.trim(),
                    phone
                });

                if (replyText) {
                    // Save AI reply to ai_messages
                    if (conv?.id) {
                        await supabase.from('ai_messages').insert({
                            conversation_id: conv.id,
                            sender_type: 'ai',
                            role: 'assistant',
                            content: replyText,
                            message_text: replyText,
                            tokens_used: tokensUsed,
                            status: 'delivered'
                        });
                    }

                    // Clean up response: strip robotic Markdown headers to look authentic
                    const cleanReply = String(replyText)
                        .replace(/^#+\s+/gm, '')
                        .replace(/\*\*(.*?)\*\*/g, '$1')
                        .trim();

                    // Natural human typing presence simulation
                    try {
                        await sock.sendPresenceUpdate('composing', jid);
                        const typingDuration = Math.min(3200, Math.max(1200, cleanReply.length * 20));
                        await new Promise((res) => setTimeout(res, typingDuration));
                        await sock.sendPresenceUpdate('paused', jid);
                    } catch (presErr) {
                        // Presence update is non-critical
                    }

                    // Send via WhatsApp
                    await sock.sendMessage(jid, { text: cleanReply });
                    console.log(`[WhatsApp AI] 🤖 Sent reply to ${phone}`);
                }

                // 10. Autonomous CRM Lead Detection + PHASE 3 FAQ Cache update
                const isBuyingInterest = /(تجرب[ةه]|اشتراك|سعر|باق[ةه]|شراء|عرض سعر|مبيعات|نشترك|نجرب|حساب جديد|تسجيل)/i.test(text);
                const empMatch = text.match(/(\d+)\s*(موظف|عامل|شخص|فرد)/i);
                const compMatch = text.match(/شرك[ةه]\s+([^\n,.،]+)/i);

                let leadNotes = `تم التقاط العميل آلياً عبر محادثة واتساب (${phone})`;
                if (empMatch) leadNotes += ` | عدد الموظفين التقريبي: ${empMatch[1]}`;
                if (compMatch) leadNotes += ` | اسم الشركة: ${compMatch[1].trim()}`;

                if ((isBuyingInterest || empMatch) && conv?.id && conv.lead_status !== 'lead_captured') {
                    await supabase
                        .from('ai_conversations')
                        .update({
                            lead_status: 'lead_captured',
                            summary: empMatch ? `مهتم - ${empMatch[0]}` : 'عميل مهتم بالاشتراك أو التجربة'
                        })
                        .eq('id', conv.id);

                    await supabase.from('ai_leads').insert({
                        conversation_id: conv.id,
                        channel_id: channelId,
                        company_id: channelData.company_id || null,
                        contact_name: customerName,
                        contact_phone: phone,
                        customer_name: customerName,
                        customer_phone: phone,
                        status: 'new',
                        interest_summary: text.trim().slice(0, 200),
                        customer_notes: leadNotes
                    });
                    console.log(`[WhatsApp AI] 🎯 Qualified lead captured for ${phone}: ${leadNotes}`);
                    
                    // Trigger Global Learning Brain (Non-blocking)
                    extractAndShareIntelligence(conv.id, channelId, text, replyText).catch(e => console.warn('[AI BRAIN] Extraction error:', e.message));
                }

                // PHASE 4: Update FAQ Cache with successful reply (non-blocking)
                if (replyText) {
                    const cacheKey = getMessageCacheKey(text);
                    if (cacheKey && !FAQ_CACHE.has(cacheKey)) {
                        FAQ_CACHE.set(cacheKey, { reply: replyText, ts: Date.now() });
                    }
                }

            } catch (err) {
                console.error("[WhatsApp AI] Error processing message:", err);
            }
        }
    });
    };

    const baseNodeId = process.env.NODE_ID || require('os').hostname();
    const uniqueNodeId = `${baseNodeId}_${channelId.split('-')[0]}`;

    state.leaseManager = new LeaseManager({
        supabase,
        channelId: channelId,
        nodeId: uniqueNodeId,
        leaseDurationSeconds: 15,
        heartbeatIntervalMs: 5000,
        getActiveSessionsCount: () => {
            let count = 0;
            for (const [_, chState] of ACTIVE_CHANNELS.entries()) {
                if (chState.currentRole === 'leader') count++;
            }
            return count;
        },
        onBecameLeader: async ({ epoch, nodeId }) => {
            state.currentRole = 'leader';
            state.currentEpoch = epoch;
            console.log(`\n👑 [Cluster - ${channelId}] Node elected as LEADER! Starting Engine...`);
            try {
                await startWhatsAppLeaderEngine();
            } catch (err) {
                console.error(`[Cluster - ${channelId}] Failed starting engine:`, err.message);
            }
        },
        onStepDown: async (reason) => {
            state.currentRole = 'standby';
            state.isConnected = false;
            console.log(`\n🔻 [Cluster - ${channelId}] Stepping down to STANDBY. Reason: ${reason}`);
            if (state.queueProcessor) {
                state.queueProcessor.stop();
                state.queueProcessor = null;
            }
            if (state.activeClient) {
                state.activeClient.disconnect();
                state.activeClient = null;
            }
        }
    });

    ACTIVE_CHANNELS.set(channelId, state);
    state.leaseManager.start();

    // Periodic Heartbeat for UI metrics (both Standby & Leader)
    setInterval(async () => {
        try {
            const memMb = Math.round(process.memoryUsage().rss / 1024 / 1024);
            const uptimeSec = Math.round(process.uptime());
            const host = require('os').hostname();
            await supabase.from('whatsapp_nodes').upsert({
                node_id: uniqueNodeId,
                channel_id: channelId,
                is_active: true,
                status: state.currentRole,
                role: state.currentRole,
                is_leader: state.currentRole === 'leader',
                version: APP_VERSION,
                memory_rss_mb: memMb,
                uptime_seconds: uptimeSec,
                hostname: host,
                health_score: 100,
                last_heartbeat: new Date().toISOString(),
                last_seen: new Date().toISOString()
            }, { onConflict: 'node_id' });
        } catch (e) {}
    }, 10000);
}

// Initialize multi-tenant polling
async function initMultiTenant() {
    console.log('[Cluster] Fetching all active channels for this node...');
    let query = supabase.from('whatsapp_channels').select('id, name').eq('is_active', true);
    if (process.env.DEFAULT_CHANNEL_ID) {
        query = query.eq('id', process.env.DEFAULT_CHANNEL_ID);
    }
    
    const { data: channels, error } = await query;
    if (error) {
        console.error('[Cluster] Failed fetching channels:', error.message);
        return;
    }
    
    if (channels && channels.length > 0) {
        for (const ch of channels) {
            startChannelManager(ch.id);
        }
    } else {
        console.log('[Cluster] No active channels found for this node.');
    }

    // Listen for new channels dynamically
    supabase.channel('public:whatsapp_channels')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'whatsapp_channels' }, payload => {
            if (payload.new.is_active !== false) {
                if (!process.env.DEFAULT_CHANNEL_ID || payload.new.id === process.env.DEFAULT_CHANNEL_ID) {
                    startChannelManager(payload.new.id);
                }
            }
        })
        .subscribe();
}

async function stopAllChannels() {
    for (const [channelId, state] of ACTIVE_CHANNELS.entries()) {
        if (state.queueProcessor) state.queueProcessor.stop();
        if (state.activeClient) state.activeClient.disconnect();
    }
}

// ══════════════════════════════════════════════════════════════
// PHASE 5: Global Continuous Learning Brain (Shared Intelligence)
// ══════════════════════════════════════════════════════════════
async function extractAndShareIntelligence(convId, channelId, lastUserMessage, successfulReply) {
    try {
        console.log(`[AI BRAIN 🧠] Analyzing successful deal for conv ${convId}...`);
        
        // Use Groq (Fast & Cheap) for analysis
        const groqKey = process.env.GROQ_API_KEY;
        if (!groqKey) return;

        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${groqKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'llama3-70b-8192',
                max_tokens: 250,
                temperature: 0.1,
                messages: [{
                    role: 'system',
                    content: 'You are an AI Sales Analyst. Extract the sales technique used in the following successful interaction. Respond ONLY with a JSON object: {"insight_type": "winning_technique", "extracted_principle": "short description of the technique in Arabic"}'
                }, {
                    role: 'user',
                    content: `User Said: "${lastUserMessage}"\nAgent Replied: "${successfulReply}"\nExtract the core sales principle.`
                }],
                response_format: { type: 'json_object' }
            })
        });

        if (res.ok) {
            const data = await res.json();
            const insight = JSON.parse(data.choices[0].message.content);
            
            if (insight.extracted_principle) {
                await supabase.from('ai_global_learning_insights').insert({
                    source_channel_id: channelId,
                    source_conversation_id: convId,
                    insight_type: insight.insight_type || 'winning_technique',
                    trigger_context: lastUserMessage.substring(0, 300),
                    ai_successful_response: successfulReply.substring(0, 500),
                    extracted_principle: insight.extracted_principle
                });
                console.log(`[AI BRAIN 🧠] Insight saved! The global agent IQ just increased. Learned: ${insight.extracted_principle}`);
            }
        }
    } catch (e) {
        console.warn(`[AI BRAIN 🧠] Failed to extract intelligence:`, e.message);
    }
}

// Local lightweight HTTP status API
const server = http.createServer((req, res) => {
    if (req.url === '/status' || req.url === '/api/status') {
        const memRss = Math.round(process.memoryUsage().rss / 1024 / 1024);
        
        // Build array of channel statuses
        const channelStatuses = [];
        for (const [channelId, state] of ACTIVE_CHANNELS.entries()) {
            channelStatuses.push({
                channelId,
                role: state.currentRole,
                epoch: state.currentEpoch,
                whatsappConnected: state.isConnected,
                phoneNumber: state.activePhoneNumber
            });
        }
        
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({
            status: 'online',
            mode: 'multi-tenant',
            activeChannels: channelStatuses,
            memoryRssMb: memRss,
            uptimeSeconds: Math.round(process.uptime()),
            timestamp: new Date().toISOString()
        }));
        return;
    }

    if (req.url === '/ping') {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('pong');
        return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
});

// ══════════════════════════════════════════════════════════════
// PHASE 1: Smart Context Loader (Sliding Window & History Compression)
// ══════════════════════════════════════════════════════════════
async function buildSmartContext(conv, phone) {
    let summary = null;
    let profile = null;

    try {
        const [sumRes, profRes] = await Promise.all([
            supabase.from('ai_conversation_summaries').select('*').eq('conversation_id', conv?.id).maybeSingle(),
            supabase.from('ai_customer_profiles').select('*').eq('customer_phone', phone).eq('channel_id', DEFAULT_CHANNEL_ID).maybeSingle()
        ]);
        summary = sumRes.data;
        profile = profRes.data;
    } catch (e) {}

    let history = [];
    try {
        if (conv?.id) {
            const { data: recentMsgs } = await supabase
                .from('ai_messages')
                .select('sender_type, message_text')
                .eq('conversation_id', conv.id)
                .order('created_at', { ascending: false })
                .limit(summary ? 3 : 5); // Token Optimization: Tight sliding window

            if (recentMsgs && recentMsgs.length > 0) {
                history = recentMsgs.reverse().map(m => ({
                    role: m.sender_type === 'user' ? 'user' : 'assistant',
                    content: m.message_text
                }));
            }
        }
    } catch (e) {}

    return { summary, profile, history };
}

// ══════════════════════════════════════════════════════════════
// PHASE 2: Auto-update Customer Profile (Background)
// ══════════════════════════════════════════════════════════════
async function autoUpdateCustomerProfile(phone, channelId, text, customerName) {
    try {
        const updateData = {
            customer_phone: phone,
            channel_id: channelId,
            last_contact_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        if (customerName && customerName !== phone) updateData.customer_name = customerName;

        const empMatch = text.match(/(\d+)\s*(موظف|عامل|شخص|فرد|employee)/i);
        if (empMatch) updateData.company_size = parseInt(empMatch[1]);
        const compMatch = text.match(/(?:شركة|مؤسسة|مصنع|محل|مكتب)\s+([^،,\n.؟?!]+)/i);
        if (compMatch) updateData.company_name = compMatch[1].trim().substring(0, 80);

        await supabase.from('ai_customer_profiles').upsert(updateData, { onConflict: 'customer_phone,channel_id' });
    } catch (e) {}
}

// ══════════════════════════════════════════════════════════════
// PHASE 4: Layered Prompt Builder (Dynamic Token Reduction)
// ══════════════════════════════════════════════════════════════
function buildLayeredPrompt({ aiName, profile, summary, kbGroundingText, text, isExplicitHandoff, customInstructions }) {
    const t = (text || '').toLowerCase();
    const CORE = `أنت "${aiName}"، مستشار مبيعات وكوادر للاتش آر والبصمة. 
تتحدث مصرية عامية، ردودك قصيرة ومقنعة (سطرين لثلاثة). لا تستخدم مقدمات روبوتية أبداً.
اختم دائماً بسؤال يوجه العميل للمبيعات.`;

    const HISTORY_SUMMARY = summary?.summary_text ? `\n[ملخص المحادثات السابقة]: ${summary.summary_text.substring(0, 200)}` : '';
    const CLIENT_CONTEXT = (profile?.company_size) ? `\n[حجم الشركة]: ${profile.company_size} موظف` : '';
    
    const needsPricing = /(سعر|تكلف|بكام|اشتراك|باقة|رخيص|غالي|فلوس)/.test(t);
    const PRICING = needsPricing ? `\n[الأسعار]: باقة Starter بـ 690ج/شهر (25 موظف)، Pro بـ 1690ج/شهر. يوجد تجربة مجانية 14 يوم.` : '';

    const CUSTOM = customInstructions ? `\n[تعليمات إضافية]: ${customInstructions}` : '';
    const KB_BLOCK = kbGroundingText ? `\n${kbGroundingText}` : '';

    return [CORE, HISTORY_SUMMARY, CLIENT_CONTEXT, PRICING, CUSTOM, KB_BLOCK].filter(Boolean).join('\n');
}

// Phase 4: Semantic Caching (Intent-Based Pre-Routing)
const FAQ_CACHE = new Map([
    ['greeting_standard', { reply: 'يا أهلاً بحضرتك يا فندم! منورنا في كوادر 🚀.. اقدر اساعدك إزاي النهاردة؟', ts: Date.now() }],
    ['demo_standard', { reply: 'يسعدنا جداً تجربتك للنظام! تقدر تجرب سيستم كوادر بالكامل مجاناً لمدة 14 يوم وتتأكد بنفسك من كفاءته.. تحب ابعتلك لينك التسجيل؟', ts: Date.now() }]
]);
const CACHE_TTL = 1000 * 60 * 60 * 24; // 24 hours for static intents

function getMessageCacheKey(text) {
    const t = (text || '').toLowerCase().trim();
    if (/^(سلام|السلام عليكم|مرحبا|اهلا|هاي|مساء الخير|صباح الخير|السلام عليكم ورحمة الله وبركاته|اهلا بك|ازيك)$/.test(t)) return 'greeting_standard';
    if (/^(مجاني|اجرب|تجربة|ديمو|عرض|عايز اجرب|بدي اجرب|حابب اجرب)$/.test(t)) return 'demo_standard';
    
    if(!text || text.length < 5 || text.length > 100) return null;
    const clean = t.replace(/[^a-z0-9\u0600-\u06FF]/gi, '');
    return clean.length >= 5 ? clean : null;
}

async function generateAiReply({ systemPrompt, history, text, phone }) {
    // Check FAQ cache first (Phase 4)
    const cacheKey = getMessageCacheKey(text);
    if (cacheKey && FAQ_CACHE.has(cacheKey)) {
        const cached = FAQ_CACHE.get(cacheKey);
        if (Date.now() - cached.ts < CACHE_TTL) {
            console.log(`[WhatsApp AI] ⚡ Cache HIT for ${phone} (${cacheKey})`);
            return { replyText: cached.reply, tokensUsed: 0 };
        } else {
            FAQ_CACHE.delete(cacheKey);
        }
    }

    // Add strong sales empathy booster
    const enhancedSystemPrompt = systemPrompt + "\n\n[Sales Persona Booster]: أنت بائع استشاري (Consultative Seller). كن متعاطفاً جداً مع العميل وافهم مشاعره ومخاوفه قبل البيع. لا تكتفِ بسرد الأسعار، بل افهم احتياجه أولاً ثم اطرح الحل كأنك مستشار مؤتمن يخاف على مصلحته بأسلوب ودود ومقنع جداً ومختصر.";

    const messages = [
        { role: 'system', content: enhancedSystemPrompt },
        ...history,
        { role: 'user', content: text }
    ];

    // ── TIER 0: GitHub Models API (Free Tier for Developers) - Cost Saver ──
    if (process.env.GITHUB_TOKEN) {
        try {
            const res = await fetch('https://models.inference.ai.azure.com/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${process.env.GITHUB_TOKEN}`
                },
                body: JSON.stringify({
                    model: 'gpt-4o-mini',
                    messages: messages,
                    max_tokens: 300,
                    temperature: 0.3
                })
            });

            if (res.ok) {
                const aiData = await res.json();
                let replyText = aiData?.choices?.[0]?.message?.content;
                if (replyText && replyText.trim()) {
                    replyText = replyText.replace(/<ACTION>[\s\S]*?<\/ACTION>/g, '').trim();
                    console.log(`[WhatsApp AI] ⚡ GitHub Models (gpt-4o-mini) replied successfully for ${phone}`);
                    return { replyText, tokensUsed: aiData?.usage?.total_tokens || 100 };
                }
            }
        } catch (err) {
            console.warn(`[WhatsApp AI] GitHub Models fallback warning:`, err.message);
        }
    }

    // ── PRIORITY 1: Google Gemini 3.8 Flash (Official API Key) ──
    if (GEMINI_API_KEY) {
        try {
            const contents = messages.map(m => ({
                role: m.role === 'user' ? 'user' : 'model',
                parts: [{ text: m.content || '' }]
            }));
            
            const payload = {
                systemInstruction: { parts: [{ text: enhancedSystemPrompt }] },
                contents: contents.filter(m => m.parts[0].text !== enhancedSystemPrompt),
                generationConfig: { maxOutputTokens: 350, temperature: 0.3 }
            };

            const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${GEMINI_API_KEY}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (geminiRes.ok) {
                const aiData = await geminiRes.json();
                let replyText = aiData?.candidates?.[0]?.content?.parts?.[0]?.text;
                if (replyText && replyText.trim()) {
                    replyText = replyText.replace(/<ACTION>[\s\S]*?<\/ACTION>/g, '').trim();
                    console.log(`[WhatsApp AI] ⚡ Gemini 3.8 Flash replied successfully for ${phone}`);
                    return { replyText, tokensUsed: 250 };
                }
            } else {
                const errText = await geminiRes.text();
                console.warn(`[WhatsApp AI] Gemini API error (${geminiRes.status}):`, errText);
            }
        } catch (err) {
            console.warn(`[WhatsApp AI] Native Gemini fallback warning:`, err.message);
        }
    }

    // ── PRIORITY 2: OpenRouter ──
    if (OPENROUTER_API_KEY) {
        try {
            const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                    'HTTP-Referer': 'https://kwader.com', 
                    'X-Title': 'Kwader Sales Agent'
                },
                body: JSON.stringify({
                    models: [
                        'google/gemini-3.8-flash',
                        'qwen/qwen3.8-27b:free',
                        'inclusionai/ling-3.0-flash-sante:free'
                    ],
                    route: 'fallback',
                    messages: messages,
                    max_tokens: 300,
                    temperature: 0.3
                })
            });

            if (res.ok) {
                const aiData = await res.json();
                let replyText = aiData?.choices?.[0]?.message?.content;
                if (replyText && replyText.trim()) {
                    replyText = replyText.replace(/<ACTION>[\s\S]*?<\/ACTION>/g, '').trim();
                    console.log(`[WhatsApp AI] ⚡ OpenRouter replied successfully for ${phone}`);
                    return { replyText, tokensUsed: aiData?.usage?.total_tokens || 250 };
                }
            }
        } catch (err) {
            console.warn(`[WhatsApp AI] OpenRouter fallback warning:`, err.message);
        }
    }

    // ── PRIORITY 3: Groq ──
    if (GROQ_API_KEY) {
        const groqModels = ['openai/gpt-oss-120b', 'qwen/qwen3.8-27b'];
        for (let model of groqModels) {
            try {
                const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${GROQ_API_KEY}`
                    },
                    body: JSON.stringify({
                        model: model,
                        messages: messages,
                        max_tokens: 300,
                        temperature: 0.3
                    })
                });

                if (res.ok) {
                    const aiData = await res.json();
                    let replyText = aiData?.choices?.[0]?.message?.content;
                    if (replyText && replyText.trim()) {
                        replyText = replyText.replace(/<ACTION>[\s\S]*?<\/ACTION>/g, '').trim();
                        console.log(`[WhatsApp AI] ⚡ Groq (${model}) replied successfully for ${phone}`);
                        return { replyText, tokensUsed: aiData?.usage?.total_tokens || 250 };
                    }
                }
            } catch (err) {
                console.warn(`[WhatsApp AI] Groq (${model}) error:`, err.message);
            }
        }
    }

    // ── PRIORITY 4: Supabase Edge Function ──
    try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/ai-assistant`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_KEY}` },
            body: JSON.stringify({
                company_id: DEFAULT_CHANNEL_ID,
                messages: [
                    { role: 'system', content: enhancedSystemPrompt },
                    ...history,
                    { role: 'user', content: text }
                ]
            })
        });

        if (res.ok) {
            const aiData = await res.json();
            let replyText = aiData?.choices?.[0]?.message?.content;
            if (replyText && replyText.trim()) {
                replyText = replyText.replace(/<ACTION>[\s\S]*?<\/ACTION>/g, '').trim();
                return { replyText, tokensUsed: 250 };
            }
        }
    } catch (err) {
        console.warn(`[WhatsApp AI] Edge function fallback failed:`, err.message);
    }

    return {
        replyText: 'أهلاً بك في منصة كوادر! يسعدنا تواصلك معنا، وسيقوم أحد مسؤولي خدمة العملاء والدعم بالرد عليك في أقرب وقت. كيف يمكننا مساعدتك اليوم؟',
        tokensUsed: 0
    };
}

server.listen(HTTP_PORT, '127.0.0.1', () => {
    console.log(`📡 Local Status API listening on http://127.0.0.1:${HTTP_PORT}`);
    initMultiTenant();
});

// Handle graceful shutdown
const handleExit = async (sig) => {
    console.log(`\n🛑 Received ${sig}. Exiting gracefully...`);
    server.close();
    for (const [channelId, state] of ACTIVE_CHANNELS.entries()) {
        if (state.leaseManager) await state.leaseManager.shutdown(`signal_${sig}`);
    }
    await stopAllChannels();
    process.exit(0);
};

process.on('SIGINT', () => handleExit('SIGINT'));
process.on('SIGTERM', () => handleExit('SIGTERM'));

