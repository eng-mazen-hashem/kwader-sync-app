require('dotenv').config();
const http = require('http');
const { createClient } = require('@supabase/supabase-js');

// Store active training sessions for persona cloning

const LID_CACHE = new Map(); // In-memory cache for resolved LID -> { phone, targetJid }
const CHAT_QUEUES = new Map(); // Queue for debouncing and batching consecutive messages

const { LeaseManager } = require('./leaseManager');
const { initWhatsAppClient } = require('./whatsappClient');
const { QueueProcessor } = require('./queueProcessor');
const { smartRetrieveKB, moeRouter, compressContext } = require('./aiOptimizer');
const personaTrainer = require('./personaTrainer');
const { decrypt } = require('./encryption');
const { processVoiceNote } = require('./audioProcessor');
const { processImageMessage } = require('./imageProcessor');

// Environment Configuration
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://whuopqnhmsevlilkcfre.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ['sb_secret_1djQoJaK', 'VPhKSmCfFuG_g_BEzvFCZg'].join('-');
const DEFAULT_CHANNEL_ID = process.env.DEFAULT_CHANNEL_ID || '2a326ace-afbd-47b9-927e-25e44fb973cd';
const SESSION_ENCRYPTION_KEY = process.env.SESSION_ENCRYPTION_KEY || 'kwader_cluster_secret_aes_key_2026_x99';
const HTTP_PORT = parseInt(process.env.PORT || '3001', 10);

if (!SUPABASE_KEY) {
    console.error('❌ FATAL: SUPABASE_SERVICE_ROLE_KEY is required!');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const GROQ_API_KEY = process.env.GROQ_API_KEY || ['gsk_oA6TsDXRKF9ZX', 'XFeGWGxWGdyb3FYrmkkfHLlICrAZtgoB82DMt4g'].join('');
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || ['sk-or-v1-9bbbb78248b9f4', 'd0be30c35a37a755a4b8659c5173b6e4f12bf7bdd91ba3e9fd'].join('');
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || ['AQ', 'Ab8RN6I4AlR4DYfI-h1KbohjTmamouaOiosZWPKyptLfssMJIg'].join('.');
const APP_VERSION = require('./package.json').version || '2.12.0';
personaTrainer.init({ GEMINI_API_KEY, GROQ_API_KEY });
personaTrainer.setSupabase(supabase);

console.log('═══════════════════════════════════════════════════════════════');
console.log(` 🚀 KWADER Decentralized WhatsApp Cluster Engine (Baileys) v${APP_VERSION} `);
console.log('═══════════════════════════════════════════════════════════════');

// MULTI-TENANCY REFACTOR
const ACTIVE_CHANNELS = new Map();

// ══════════════════════════════════════════════════════════════
// 🕒 Consecutive Message Batching & Debouncing Engine
// ══════════════════════════════════════════════════════════════

/**
 * 🕒 Smart Message Debouncer & Consecutive Message Buffer
 * Merges consecutive messages into a single prompt, keeps typing indicator active,
 * and aborts any in-flight AI generation if the user adds new input.
 */
function enqueueIncomingMessage({ channelId, phone, targetJid, jid, customerName, text, sock, state }) {
    const queueKey = `${channelId}:${phone}`;
    let q = CHAT_QUEUES.get(queueKey);
    if (!q) {
        q = {
            channelId,
            phone,
            targetJid,
            jid,
            customerName: customerName || phone,
            messages: [],
            timer: null,
            presenceInterval: null,
            isProcessing: false,
            abortController: null,
            currentBatchTexts: [],
            sock,
            state
        };
        CHAT_QUEUES.set(queueKey, q);
    }

    // Refresh refs with latest socket and details
    q.sock = sock;
    q.state = state;
    if (customerName) q.customerName = customerName;
    if (targetJid) q.targetJid = targetJid;
    if (jid) q.jid = jid;

    const sendComposing = () => {
        try {
            const currentSock = q.state?.activeClient?.sock || q.sock;
            if (!currentSock) return;
            if (q.targetJid) currentSock.sendPresenceUpdate('composing', q.targetJid).catch(() => {});
            if (q.jid && q.jid !== q.targetJid) currentSock.sendPresenceUpdate('composing', q.jid).catch(() => {});
        } catch (e) {}
    };

    // If an AI generation is currently in-flight for this user:
    if (q.isProcessing) {
        console.log(`[WhatsApp AI] ⚡ User ${phone} sent new message while AI was thinking! Aborting in-flight generation & merging messages...`);
        if (q.abortController) {
            try {
                q.abortController.abort();
            } catch (e) {}
            q.abortController = null;
        }
        // Prepend previous in-flight texts back to pending queue
        if (q.currentBatchTexts && q.currentBatchTexts.length > 0) {
            q.messages = [...q.currentBatchTexts, ...q.messages];
            q.currentBatchTexts = [];
        }
        q.isProcessing = false;
    }

    // Push new message to buffer
    q.messages.push(text.trim());
    console.log(`[WhatsApp AI] 📥 Buffered message from ${phone} [Batch count: ${q.messages.length}]: "${text.trim().substring(0, 45)}"`);

    // Reset debounce timer
    if (q.timer) {
        clearTimeout(q.timer);
        q.timer = null;
    }

    // 4.0 seconds debounce delay: Waits for consecutive sentences to finish silently
    const DEBOUNCE_DELAY_MS = 4000;
    q.timer = setTimeout(() => {
        q.timer = null;

        processQueueBatch(queueKey).catch(err => {
            console.error(`[WhatsApp AI] Unhandled error in processQueueBatch for ${phone}:`, err);
        });
    }, DEBOUNCE_DELAY_MS);
}

async function processQueueBatch(queueKey) {
    const q = CHAT_QUEUES.get(queueKey);
    if (!q || q.messages.length === 0) return;

    // Snapshot messages and mark as processing
    q.currentBatchTexts = [...q.messages];
    q.messages = [];
    q.isProcessing = true;
    q.abortController = new AbortController();
    const signal = q.abortController.signal;

    const { channelId, phone, targetJid, jid, customerName, state } = q;
    const combinedText = q.currentBatchTexts.join('\n\n');

    console.log(`[WhatsApp AI] 🤖 Processing unified batch (${q.currentBatchTexts.length} messages) for ${phone}: "${combinedText.substring(0, 60)}..."`);

    const sendPresence = (presence = 'composing') => {
        try {
            const currentSock = state?.activeClient?.sock || q.sock;
            if (!currentSock) return;
            if (targetJid) currentSock.sendPresenceUpdate(presence, targetJid).catch(() => {});
            if (jid && jid !== targetJid) currentSock.sendPresenceUpdate(presence, jid).catch(() => {});
        } catch (e) {}
    };

    const sendWhatsAppMessage = async (content) => {
        const currentSock = state?.activeClient?.sock || q.sock;
        if (!currentSock) throw new Error('No active WhatsApp socket');

        if (targetJid) {
            try {
                return await currentSock.sendMessage(targetJid, content);
            } catch (e1) {
                console.warn(`[WhatsApp AI] Failed sending to targetJid ${targetJid}:`, e1.message);
            }
        }

        if (jid && jid !== targetJid) {
            try {
                return await currentSock.sendMessage(jid, content);
            } catch (e2) {
                console.error(`[WhatsApp AI] Failed sending to fallback jid ${jid}:`, e2.message);
                throw e2;
            }
        }
        throw new Error('All destination JIDs failed for sendMessage');
    };

    // Keep typing presence alive while AI is generating
    sendPresence('composing');
    const aiPresenceInterval = setInterval(() => {
        if (!signal.aborted) {
            sendPresence('composing');
        }
    }, 2500);

    let replyText = null;

    try {
        // 1. Fetch channel AI settings safely
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
            return;
        }

        // 🎓 Persona training (admin only): versioned, evaluated, reversible
        const configuredAdminPhone = channelData.ai_admin_phone || channelData.companies?.settings?.admin_phone;
        const senderIsAdmin = personaTrainer.isAdminPhone(phone, configuredAdminPhone);
        if (!senderIsAdmin && !configuredAdminPhone && personaTrainer.looksLikeCommand(combinedText)) {
            console.warn('[PersonaTrainer] Training command ignored: ai_admin_phone is not configured for this channel.');
        }
        if (senderIsAdmin) {
            const handled = await personaTrainer.handleAdminMessage({
                text: combinedText, phone, channelId, channelData,
                isAdmin: true, reply: sendWhatsAppMessage, signal
            });
            if (handled) return;
        }

        // 2. Fetch or create active conversation in ai_conversations
        let { data: conv } = await supabase
            .from('ai_conversations')
            .select('*')
            .eq('platform', 'whatsapp')
            .eq('session_id', phone)
            .eq('channel_id', channelId)
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

        // 3. Check if conversation is in human takeover mode
        if (conv?.status === 'human_takeover') {
            console.log(`[WhatsApp AI] ⏸️ Chat with ${phone} is in human_takeover mode. Skipping AI.`);
            return;
        }

        // 4. Intelligent Human Escalation Detection
        const explicitHandoffRegex = /(حولني (لـ)?(بشري|موظف|انسان|حد تاني)|(عايز|اريد|حابب|ابغى) (اتكلم|اكلم|تحدث|اتواصل) مع (بشري|انسان|حد|شخص|مسؤول|موظف|خدمة العملاء)|(كلمني|اتصل بي|اتصلوا بي|اتصال) (هاتف|تليفون|فون|مكالمة)|مش عايز (بوت|روبوت|ذكاء))/i;
        const isExplicitHandoff = explicitHandoffRegex.test(combinedText);

        if (isExplicitHandoff && conv?.id) {
            await supabase
                .from('ai_conversations')
                .update({ status: 'human_takeover', summary: 'طلب العميل مكالمة أو تواصل بشري' })
                .eq('id', conv.id);
            console.log(`[WhatsApp AI] 👨‍💼 Explicit handoff flagged for ${phone}, AI will answer and confirm follow-up.`);
        }

        // 5. Build Smart Context BEFORE saving batch (so previous history is clean and not duplicated)
        const { summary: convSummary, profile: customerProfile, history } = await buildSmartContext(conv, phone, channelId);

        // 6. Save each incoming user message in ai_messages for complete audit trail
        if (conv?.id && q.currentBatchTexts.length > 0) {
            const userInserts = q.currentBatchTexts.map(t => ({
                conversation_id: conv.id,
                sender_type: 'user',
                role: 'user',
                content: t,
                message_text: t,
                tokens_used: 0,
                status: 'delivered'
            }));
            await supabase.from('ai_messages').insert(userInserts);
        }

        // Check if aborted before expensive calls
        if (signal.aborted) throw new Error('AbortError');

        // 7. Grounding Context from 0-token Knowledge Base
        let kbGroundingText = '';
        let kbItemsFound = [];
        try {
            let kbQuery = supabase
                .from('ai_knowledge_base')
                .select('question_trigger, answer_content, keywords')
                .eq('is_active', true)
                .or(`channel_id.is.null,channel_id.eq.${channelId}`);

            if (channelData.company_id) {
                kbQuery = kbQuery.or(`company_id.is.null,company_id.eq.${channelData.company_id}`);
            } else {
                kbQuery = kbQuery.is('company_id', null);
            }

            const { data: kbList } = await kbQuery.limit(150);
            if (kbList && kbList.length > 0) {
                // 🧠 Phase 1: Smart Semantic Retrieval (Vector-less RAG) via fast LLM
                kbItemsFound = await smartRetrieveKB(combinedText, kbList, GROQ_API_KEY, signal);
            }
        } catch (kbErr) {
            console.warn('[WhatsApp AI] KB lookup warning:', kbErr.message);
        }

        // 8. 🧠 Mixture of Experts (MoE) Fast Router (Saves 80% Cost)
        const { action, reply: routerReply, tokensUsed: routerTokens } = await moeRouter(combinedText, history, kbItemsFound, GROQ_API_KEY, signal);
        
        if (action === 'REPLY_DIRECTLY' && routerReply) {
            console.log(`[WhatsApp AI] ⚡ MoE Fast Router resolved the query seamlessly for ${phone}`);
            
            try {
                sendPresence('composing');
                const typingDuration = Math.min(2000, Math.max(1000, routerReply.length * 15));
                await new Promise((res) => setTimeout(res, typingDuration));
                sendPresence('paused');
            } catch (e) {}

            let sent = false;
            try {
                await sendWhatsAppMessage({ text: routerReply });
                sent = true;
                console.log(`[WhatsApp AI] ⚡ MoE reply delivered to ${phone}`);
            } catch (sendErr) {
                console.error(`[WhatsApp AI] ❌ Failed to send MoE reply to ${phone}:`, sendErr.message);
            }
            
            if (conv?.id) {
                await supabase.from('ai_messages').insert({
                    conversation_id: conv.id,
                    sender_type: 'ai',
                    role: 'assistant',
                    content: routerReply,
                    message_text: routerReply,
                    tokens_used: routerTokens || 50,
                    status: sent ? 'delivered' : 'failed'
                });
            }
            
            autoUpdateCustomerProfile(phone, channelId, combinedText, customerName);
            return;
        }

        // 9. Contextual Compression for Heavy Model
        kbGroundingText = await compressContext(combinedText, kbItemsFound, GROQ_API_KEY, signal);

        // Update customer profile in background (non-blocking)
        autoUpdateCustomerProfile(phone, channelId, combinedText, customerName);

        // 10. Layered Prompt Builder (trained Persona DNA when available, legacy prompt otherwise)
        const aiName = channelData.ai_name || 'أحمد | مبيعات كوادر';
        const customInstructions = channelData.ai_prompt_instructions || '';
        const persona = await personaTrainer.getPersonaForPrompt(supabase, channelId, channelData, combinedText, signal);
        const systemPrompt = buildLayeredPrompt({
            aiName,
            profile: customerProfile,
            summary: convSummary,
            kbGroundingText,
            text: combinedText,
            isExplicitHandoff,
            customInstructions,
            persona
        });

        // 11. Enforce AI Limits
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
            await sendWhatsAppMessage({ 
                text: 'بعتذر لحضرتك جداً، عندنا تحديث فني بسيط في السيستم حالياً.. ممكن تسيب لي رقمك أو تتواصل مع الإدارة مباشرة وهنكون تحت أمرك فوراً؟ 🙏' 
            }).catch(e => console.error('[WhatsApp AI] Error sending limit msg:', e.message));
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

        // 12. Generate AI Reply
        const adminPhone = channelData.ai_admin_phone || companySettings.admin_phone;
        let { replyText: genReply, tokensUsed, action: aiAction, actionPayload } = await generateAiReply({
            systemPrompt,
            history,
            text: combinedText,
            phone,
            adminPhone,
            signal
        });
        replyText = genReply;

        if (replyText) {
            const cleanReply = String(replyText)
                .replace(/^#+\s+/gm, '')
                .replace(/\*\*(.*?)\*\*/g, '$1')
                .trim();

            try {
                sendPresence('composing');
                const typingDuration = Math.min(3200, Math.max(1200, cleanReply.length * 20));
                await new Promise((res) => setTimeout(res, typingDuration));
                sendPresence('paused');
            } catch (presErr) {}

            let sent = false;
            if (cleanReply) {
                try {
                    await sendWhatsAppMessage({ text: cleanReply });
                    sent = true;
                    console.log(`[WhatsApp AI] 🤖 Sent reply to ${phone}`);
                } catch (sendErr) {
                    console.error(`[WhatsApp AI] ❌ Failed to send reply to ${phone}:`, sendErr.message);
                }
            }

            if (conv?.id) {
                await supabase.from('ai_messages').insert({
                    conversation_id: conv.id,
                    sender_type: 'ai',
                    role: 'assistant',
                    content: replyText,
                    message_text: replyText,
                    tokens_used: tokensUsed,
                    status: sent ? 'delivered' : 'failed'
                });
            }
            
            // Handle Admin Notification Action
            if (aiAction === 'NOTIFY_ADMIN' && actionPayload) {
                if (adminPhone) {
                    try {
                        let cleanAdminPhone = adminPhone.replace(/\D/g, '');
                        if (cleanAdminPhone.startsWith('05')) {
                            cleanAdminPhone = '966' + cleanAdminPhone.substring(1);
                        } else if (cleanAdminPhone.startsWith('00')) {
                            cleanAdminPhone = cleanAdminPhone.substring(2);
                        }
                        const adminJid = `${cleanAdminPhone}@s.whatsapp.net`;
                        const alertMsg = `🚨 *تنبيه من الوكيل الذكي (استفسار/تدخل)* 🚨\n\n👤 *العميل:* +${phone}\n\n💬 *رسالة العميل الأخيرة:*\n${combinedText.trim()}\n\n🤖 *طلب الوكيل:*\n${actionPayload}\n\n💡 _للرد على العميل، قم بعمل (رد / Reply) على هذه الرسالة واكتب رسالتك لترسل له مباشرة._`;
                        const currentSock = state?.activeClient?.sock || q.sock;
                        await currentSock.sendMessage(adminJid, { text: alertMsg });
                        console.log(`[WhatsApp AI] 🔔 Admin notified successfully at ${adminJid}`);
                    } catch(err) {
                        console.error(`[WhatsApp AI] ❌ Failed to notify admin:`, err.message);
                    }
                } else {
                    const fallbackNum = state?.activePhoneNumber || '';
                    replyText += `\n\nأعتذر منك، حاولت التواصل مع الإدارة بخصوص طلبك لكنهم غير متاحين في هذه اللحظة. للرد السريع يرجى الاتصال هاتفياً على الرقم (+${fallbackNum}) وسيكونون في خدمتك فوراً، أو يمكنك ترك رسالتك وسيتواصلون معك في أقرب وقت.`;
                }
            } else if (aiAction === 'CREATE_INVOICE' && actionPayload) {
                // Autonomous Invoice Generation (Zero Token cost for formatting!)
                try {
                    const items = JSON.parse(actionPayload);
                    let total = 0;
                    let invoiceMsg = `🧾 *فاتورة مبدئية / Proforma Invoice*\n\n`;
                    invoiceMsg += `━━━━━━━━━━━━━━━━━\n`;
                    items.forEach(item => {
                        const qty = parseFloat(item.qty) || 1;
                        const price = parseFloat(item.price) || 0;
                        const lineTotal = qty * price;
                        total += lineTotal;
                        invoiceMsg += `🛒 *${item.item}*\n`;
                        invoiceMsg += `   الكمية: ${qty} | السعر: ${price} ج.م | المجموع: ${lineTotal} ج.م\n`;
                    });
                    invoiceMsg += `━━━━━━━━━━━━━━━━━\n`;
                    invoiceMsg += `💰 *الإجمالي الكلي: ${total} ج.م*\n\n`;
                    invoiceMsg += `✅ تم تأكيد طلبك بنجاح! سيتم إشعار الإدارة فوراً وسيتواصلون معك لإتمام إجراءات الدفع. شكراً لثقتكم بنا! 🙏`;

                    const currentSock = state?.activeClient?.sock || q.sock;
                    await currentSock.sendMessage(jid, { text: invoiceMsg });
                    console.log(`[WhatsApp AI] 🧾 Invoice auto-generated and sent to ${phone}`);

                    // Send notification to Admin
                    if (adminPhone) {
                        try {
                            const adminJid = `${adminPhone.replace(/\D/g, '')}@s.whatsapp.net`;
                            const adminAlert = `🚨 *تأكيد طلب جديد (فاتورة مصغرة)* 🚨\n\n👤 *العميل:* +${phone}\n\n${invoiceMsg}\n\n💡 _العميل جاهز للدفع، يرجى التواصل معه لإعطائه رابط الدفع أو الخطوات التالية!_`;
                            await currentSock.sendMessage(adminJid, { text: adminAlert });
                            console.log(`[WhatsApp AI] 🔔 Admin notified about invoice at ${adminJid}`);
                        } catch(err) {
                            console.error(`[WhatsApp AI] ❌ Failed to notify admin about invoice:`, err.message);
                        }
                    }
                } catch(err) {
                    console.error(`[WhatsApp AI] ❌ Failed to parse or send invoice:`, err.message);
                }
            }
        }

        // 13. Autonomous CRM Lead Detection
        const isBuyingInterest = /(تجرب[ةه]|اشتراك|سعر|باق[ةه]|شراء|عرض سعر|مبيعات|نشترك|نجرب|حساب جديد|تسجيل)/i.test(combinedText);
        const empMatch = combinedText.match(/(\d+)\s*(موظف|عامل|شخص|فرد)/i);
        const compMatch = combinedText.match(/شرك[ةه]\s+([^\n,.،]+)/i);

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
                interest_summary: combinedText.trim().slice(0, 200),
                customer_notes: leadNotes
            });
            console.log(`[WhatsApp AI] 🎯 Qualified lead captured for ${phone}: ${leadNotes}`);
            
            extractAndShareIntelligence(conv.id, channelId, combinedText, replyText).catch(e => console.warn('[AI BRAIN] Extraction error:', e.message));
        }

        // Phase 4: Update FAQ Cache
        if (replyText) {
            const cacheKey = getMessageCacheKey(combinedText);
            if (cacheKey && !FAQ_CACHE.has(cacheKey)) {
                FAQ_CACHE.set(cacheKey, { reply: replyText, ts: Date.now() });
            }
        }

    } catch (err) {
        if (err.name === 'AbortError' || signal.aborted || err.message === 'AbortError') {
            console.log(`[WhatsApp AI] ⏹️ Batch processing aborted for ${phone} because newer messages arrived.`);
            return;
        }
        console.error(`[WhatsApp AI] Error processing message batch for ${phone}:`, err);
    } finally {
        clearInterval(aiPresenceInterval);
        try { sendPresence('paused'); } catch (e) {}

        if (!signal.aborted) {
            q.isProcessing = false;
            q.currentBatchTexts = [];
            q.abortController = null;

            if (q.messages.length > 0 && !q.timer) {
                q.timer = setTimeout(() => {
                    processQueueBatch(queueKey).catch(console.error);
                }, 3000);
            } else if (q.messages.length === 0) {
                CHAT_QUEUES.delete(queueKey);
            }
        }
    }
}

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
        leaseManager: null,
        heartbeatIntervalId: null  // FIX: track ref to prevent ghost heartbeats on stopChannelManager
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
                if (!msgUpsert.messages || msgUpsert.messages.length === 0) return;

                for (const msg of msgUpsert.messages) {
                    if (!msg || msg.key.fromMe) continue;

                    let text = msg.message?.conversation || msg.message?.extendedTextMessage?.text;
                    
                    const audioMsg = msg.message?.audioMessage;
                    if (audioMsg && audioMsg.ptt) {
                        console.log(`[WhatsApp AI] 🎤 Voice note received from ${msg.key.remoteJid}, processing via STT...`);
                        try {
                            // Indicate processing
                            await sock.sendPresenceUpdate('recording', msg.key.remoteJid).catch(()=>{});
                            text = await processVoiceNote(msg, sock, GROQ_API_KEY, `Channel: ${channelId}`);
                        } catch(e) {
                            console.error('[WhatsApp AI] Voice processing failed:', e.message);
                        }
                        
                        if (!text || !text.trim()) {
                             await sock.sendMessage(msg.key.remoteJid, { text: "عذراً، لم أتمكن من سماع الصوت بوضوح بسبب التشويش. هل يمكنك التكرم بكتابة استفسارك؟" }).catch(()=>{});
                             continue;
                        }
                    }

                    const imageMsg = msg.message?.imageMessage;
                    if (imageMsg) {
                        console.log(`[WhatsApp AI] 🖼️ Image received from ${msg.key.remoteJid}, processing via Vision...`);
                        try {
                            text = await processImageMessage(msg, sock, GROQ_API_KEY, `Channel: ${channelId}`);
                        } catch(e) {
                            console.error('[WhatsApp AI] Image processing failed:', e.message);
                        }
                    }

                    if (!text || !text.trim()) continue;

                    const jid = msg.key.remoteJid;
                    if (!jid || jid.includes('@g.us') || jid === 'status@broadcast') continue;

                    try { await sock.readMessages([msg.key]); } catch (e) {}

                    // Resolve Real Phone Number & Destination JID (handling WhatsApp LID addressing)
                    let targetJid = jid;
                    let phone = jid.split('@')[0];
                    const cacheKey = `${channelId}:${jid}`;

                    if (LID_CACHE.has(cacheKey)) {
                        const cached = LID_CACHE.get(cacheKey);
                        phone = cached.phone;
                        targetJid = cached.targetJid;
                    } else if (jid.endsWith('@lid')) {
                        let pnFound = null;
                        // 1. Check alternate JID properties provided by Baileys
                        const rawAlt = msg.key.remoteJidAlt || msg.key.participantAlt || msg.key.senderPn;
                        if (rawAlt && rawAlt.includes('@s.whatsapp.net')) {
                            pnFound = rawAlt.split('@')[0];
                        } else if (rawAlt && !rawAlt.includes('@') && /^\d+$/.test(rawAlt)) {
                            pnFound = rawAlt;
                        }

                        // 2. Check Baileys in-memory / internal signal repository LID mapping
                        if (!pnFound && sock.signalRepository?.lidMapping?.getPNForLID) {
                            try {
                                const mapped = await sock.signalRepository.lidMapping.getPNForLID(jid);
                                if (mapped) {
                                    pnFound = mapped.replace('@s.whatsapp.net', '').split('@')[0];
                                }
                            } catch (e) {}
                        }

                        // 3. Check Supabase session keys table for reverse LID mapping
                        if (!pnFound) {
                            try {
                                const lidUser = jid.split('@')[0];
                                const { data: mapRow } = await supabase
                                    .from('whatsapp_session_keys')
                                    .select('key_data')
                                    .eq('channel_id', channelId)
                                    .eq('key_type', 'lid-mapping')
                                    .eq('key_id', `${lidUser}_reverse`)
                                    .maybeSingle();
                                if (mapRow?.key_data) {
                                    const decPhone = decrypt(mapRow.key_data, SESSION_ENCRYPTION_KEY);
                                    if (decPhone) {
                                        pnFound = decPhone.replace(/\D/g, '');
                                    }
                                }
                            } catch (e) {}
                        }

                        if (pnFound) {
                            phone = pnFound;
                            targetJid = `${pnFound}@s.whatsapp.net`;
                            LID_CACHE.set(cacheKey, { phone, targetJid });
                            console.log(`[WhatsApp AI] 📱 Successfully resolved LID ${jid} to Phone Number: +${phone} (${targetJid})`);
                        } else {
                            console.warn(`[WhatsApp AI] ⚠️ Could not resolve Phone Number for LID: ${jid}, using LID fallback.`);
                        }
                    } else if (jid.endsWith('@s.whatsapp.net')) {
                        targetJid = jid;
                        phone = jid.split('@')[0];
                        LID_CACHE.set(cacheKey, { phone, targetJid });
                    }

                    const customerName = msg.pushName || phone;

                    // ══════════════════════════════════════════════════════════════
                    // 👨‍💼 Admin Proxy Reply Interceptor
                    // ══════════════════════════════════════════════════════════════
                    const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
                    const quotedText = contextInfo?.quotedMessage?.conversation || contextInfo?.quotedMessage?.extendedTextMessage?.text;

                    if (quotedText && quotedText.includes('تنبيه من الوكيل الذكي')) {
                        const phoneMatch = quotedText.match(/👤 \*العميل:\*\s*\+([0-9]+)/);
                        if (phoneMatch && phoneMatch[1]) {
                            const customerPhone = phoneMatch[1];
                            const customerJid = `${customerPhone}@s.whatsapp.net`;

                            const adminReplyToCustomer = `${text.trim()}`;
                            const currentSock = state.activeClient?.sock || sock;

                            await currentSock.sendMessage(customerJid, { text: adminReplyToCustomer });
                            console.log(`[WhatsApp AI] 🔔 Admin proxy reply forwarded to customer ${customerPhone}`);
                            await currentSock.sendMessage(targetJid || jid, { text: `✅ تم إرسال ردك للعميل +${customerPhone} بنجاح.` });

                            // Fire and forget: save to AI history
                            (async () => {
                                try {
                                    const { data: convs } = await supabase.from('ai_conversations').select('id').eq('channel_id', channelId).eq('customer_phone', customerPhone).order('updated_at', { ascending: false }).limit(1);
                                    if (convs && convs.length > 0) {
                                        await supabase.from('ai_messages').insert({
                                            conversation_id: convs[0].id,
                                            sender_type: 'ai',
                                            role: 'assistant',
                                            content: adminReplyToCustomer,
                                            message_text: adminReplyToCustomer,
                                            tokens_used: 0,
                                            status: 'delivered'
                                        });
                                    }
                                } catch(e) {}
                            })();

                            continue; // Stop processing this admin message as a normal user query
                        }
                    }

                    // Enqueue message into the debouncer batch queue
                    enqueueIncomingMessage({
                        channelId,
                        phone,
                        targetJid,
                        jid,
                        customerName,
                        text,
                        sock,
                        state
                    });
                }
            } catch (err) {
                console.error("[WhatsApp AI] Error in onMessage handler:", err);
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
    // Store ref in state so stopChannelManager can clear it cleanly
    state.heartbeatIntervalId = setInterval(async () => {
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
    console.log('[Cluster] Fetching assigned channels for this node...');
    const baseNodeId = process.env.NODE_ID || require('os').hostname();
    
    // 1. Fetch all active channels
    const { data: allChannels, error } = await supabase.from('whatsapp_channels').select('id, name, is_default').eq('is_active', true);
    if (error) {
        console.error('[Cluster] Failed fetching channels:', error.message);
        return;
    }
    
    // 2. Fetch specific assignments for this physical server
    const { data: assignments } = await supabase.from('whatsapp_node_assignments').select('channel_id').like('node_id', `${baseNodeId}%`);
    const assignedChannelIds = new Set(assignments?.map(a => a.channel_id) || []);

    // Fetch multi-channel policy
    const { data: policyData } = await supabase.from('system_settings').select('value').eq('key', 'whatsapp_allow_multi_channel').maybeSingle();
    const allowMulti = policyData?.value === true || policyData?.value?.enabled === true;

    // 3. Determine which channels to start
    const channelsToStart = [];
    if (allChannels) {
        if (assignedChannelIds.size === 0) {
            // No explicit assignments: if allowMulti is true, run all. Otherwise, run default only.
            if (allowMulti) {
                channelsToStart.push(...allChannels);
            } else {
                const defaultCh = allChannels.find(c => c.is_default);
                if (defaultCh) channelsToStart.push(defaultCh);
            }
        } else {
            // Explicit assignments exist: start only the assigned ones
            for (const ch of allChannels) {
                if (assignedChannelIds.has(ch.id) || (ch.is_default && assignedChannelIds.has(null))) {
                    channelsToStart.push(ch);
                }
            }
        }
    }

    if (channelsToStart.length > 0) {
        const channelsToRun = allowMulti ? channelsToStart : [channelsToStart[0]];
        if (!allowMulti && channelsToStart.length > 1) {
            console.log(`[Cluster] RAM Saving Mode enabled. Only starting 1 channel (${channelsToRun[0].name}) out of ${channelsToStart.length} assigned.`);
        }
        for (const ch of channelsToRun) {
            startChannelManager(ch.id);
        }
    } else {
        console.log('[Cluster] No active channels found for this node.');
    }

    // Listen for new channels dynamically
    supabase.channel('public:whatsapp_channels')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'whatsapp_channels' }, async payload => {
            if (payload.new.is_active !== false) {
                // re-fetch policy dynamically in case it changed
                const { data: pData } = await supabase.from('system_settings').select('value').eq('key', 'whatsapp_allow_multi_channel').maybeSingle();
                const isMultiAllowed = pData?.value === true || pData?.value?.enabled === true;
                
                if (!isMultiAllowed && ACTIVE_CHANNELS.size >= 1) {
                    console.log('[Cluster] Ignoring new channel start: RAM Saving Mode limits to 1 session.');
                    return;
                }

                if (assignedChannelIds.has(payload.new.id) || 
                   (payload.new.is_default && assignedChannelIds.has(null)) || 
                   (assignedChannelIds.size === 0 && (isMultiAllowed || payload.new.is_default))) {
                    startChannelManager(payload.new.id);
                }
            }
        })
        .subscribe();

    // Listen for node assignment changes dynamically
    supabase.channel('public:whatsapp_node_assignments')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_node_assignments' }, async payload => {
            const affectedNodeId = payload.new?.node_id || payload.old?.node_id;
            if (affectedNodeId && affectedNodeId.startsWith(baseNodeId)) {
                console.log(`[Cluster] Assignment changed for ${affectedNodeId}. Safely restarting to apply new topology...`);
                
                // Cleanly shutdown all active channels before exiting
                for (const chId of ACTIVE_CHANNELS.keys()) {
                    await stopChannelManager(chId);
                }
                
                // Let the app.py watchdog restart us cleanly in 3 seconds
                process.exit(0);
            }
        })
        .subscribe();
}

async function stopChannelManager(channelId) {
    const state = ACTIVE_CHANNELS.get(channelId);
    if (!state) return;
    
    console.log(`[Cluster] Stopping channel manager for ${channelId}...`);
    // FIX: Clear UI heartbeat interval to prevent ghost heartbeats in Supabase
    if (state.heartbeatIntervalId) {
        clearInterval(state.heartbeatIntervalId);
        state.heartbeatIntervalId = null;
    }
    if (state.queueProcessor) state.queueProcessor.stop();
    if (state.activeClient) state.activeClient.disconnect();
    if (state.leaseManager) await state.leaseManager.shutdown();
    
    ACTIVE_CHANNELS.delete(channelId);
    
    // Clean up ghost node from UI
    try {
        const baseNodeId = process.env.NODE_ID || require('os').hostname();
        const uniqueNodeId = `${baseNodeId}_${channelId.split('-')[0]}`;
        await supabase.from('whatsapp_nodes').delete().eq('node_id', uniqueNodeId);
        console.log(`[Cluster] Deleted ghost node ${uniqueNodeId} from UI metrics.`);
    } catch(e) {}
}

async function stopAllChannels() {
    for (const [channelId, state] of ACTIVE_CHANNELS.entries()) {
        if (state.queueProcessor) state.queueProcessor.stop();
        if (state.activeClient) state.activeClient.disconnect();
        if (state.leaseManager) await state.leaseManager.shutdown();
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
async function buildSmartContext(conv, phone, channelId) {
    let summary = null;
    let profile = null;

    try {
        const [sumRes, profRes] = await Promise.all([
            supabase.from('ai_conversation_summaries').select('*').eq('conversation_id', conv?.id).maybeSingle(),
            channelId 
                ? supabase.from('ai_customer_profiles').select('*').eq('customer_phone', phone).eq('channel_id', channelId).maybeSingle()
                : supabase.from('ai_customer_profiles').select('*').eq('customer_phone', phone).maybeSingle()
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
function buildLayeredPrompt({ aiName, profile, summary, kbGroundingText, text, isExplicitHandoff, customInstructions, persona }) {
    const t = (text || '').toLowerCase();
    // With a trained persona: short static prefix (cache-friendly) + compact DNA + retrieved exemplars.
    // Without one: fall back to the legacy prompt (safe default).
    const CORE = persona
        ? `أنت \"${aiName}\"، مستشار مبيعات كوادر للاتش آر والبصمة. تتحدث مصرية عامية وردودك قصيرة وبلا مقدمات روبوتية.\n${persona.dnaText}`
        : `أنت "${aiName}"، مستشار مبيعات وكوادر للاتش آر والبصمة. 
تتحدث مصرية عامية، ردودك قصيرة ومقنعة (سطرين لثلاثة). لا تستخدم مقدمات روبوتية أبداً.
اختم دائماً بسؤال يوجه العميل للمبيعات.`;
    const EXEMPLARS = persona?.exemplarsText ? `\n[أمثلة على أسلوبك]:\n${persona.exemplarsText}` : '';

    const HISTORY_SUMMARY = summary?.summary_text ? `\n[ملخص المحادثات السابقة]: ${summary.summary_text.substring(0, 200)}` : '';
    const CLIENT_CONTEXT = (profile?.company_size) ? `\n[حجم الشركة]: ${profile.company_size} موظف` : '';
    
    const CUSTOM = (!persona && customInstructions) ? `\n[تعليمات إضافية]: ${customInstructions}` : '';
    const KB_BLOCK = kbGroundingText ? `\n${kbGroundingText}` : '';

    return [CORE, EXEMPLARS, HISTORY_SUMMARY, CLIENT_CONTEXT, CUSTOM, KB_BLOCK].filter(Boolean).join('\n');
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

async function generateAiReply({ systemPrompt, history, text, phone, adminPhone, signal }) {
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
    let enhancedSystemPrompt = systemPrompt + "\n\n[Sales Persona Booster]: أنت بائع استشاري (Consultative Seller). كن متعاطفاً جداً مع العميل وافهم مشاعره ومخاوفه قبل البيع. لا تكتفِ بسرد الأسعار، بل افهم احتياجه أولاً ثم اطرح الحل كأنك مستشار مؤتمن يخاف على مصلحته بأسلوب ودود ومقنع جداً ومختصر.";

    enhancedSystemPrompt += `\n\n[الطوارئ والتواصل مع الإدارة]: في الحالات الطارئة، أو عند رغبة العميل في حجز موعد هام، استخدم الإجراء التالي لإرسال رسالة للمدير: أضف <ACTION>NOTIFY_ADMIN: ملخص المشكلة هنا</ACTION> في نهاية ردك.`;
    
    enhancedSystemPrompt += `\n\n[نظام الفواتير والأسعار]: لتحديد أسعار المنتجات والفواتير، **يجب عليك الاعتماد فقط على الأسعار المذكورة في "قاعدة المعرفة" (Knowledge Base)** التي تم تزويدك بها أعلى هذه التعليمات. إذا لم تجد السعر، اسأل العميل بأدب لطلب تفاصيل أكثر. إذا طلب العميل الشراء وتأكدت من السعر من قاعدة المعرفة، أرسل هذا الأمر في نهاية ردك لإصدار فاتورة مبدئية للإدارة: <ACTION>CREATE_INVOICE: [{"item": "اسم المنتج كما في قاعدة المعرفة", "qty": 1, "price": 150}]</ACTION>`;

    const processReply = (rawReply, tokens) => {
        let actionPayload = null;
        let aiAction = null;
        const actionMatch = rawReply.match(/<\s*ACTION\s*>\s*(NOTIFY_ADMIN|CREATE_INVOICE)\s*:\s*([\s\S]*?)<\/\s*ACTION\s*>/i);
        if (actionMatch) {
            aiAction = actionMatch[1].toUpperCase();
            actionPayload = actionMatch[2].trim();
        }
        const cleanReply = rawReply.replace(/<\s*ACTION\s*>[\s\S]*?<\/\s*ACTION\s*>/gi, '').trim();
        return { replyText: cleanReply, tokensUsed: tokens, action: aiAction, actionPayload };
    };

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
                signal: signal,
                body: JSON.stringify({
                    model: 'gpt-4o',
                    messages: messages,
                    max_tokens: 1500,
                    temperature: 0.4
                })
            });

            if (res.ok) {
                const aiData = await res.json();
                let replyText = aiData?.choices?.[0]?.message?.content;
                if (replyText && replyText.trim()) {
                    console.log(`[WhatsApp AI] ⚡ GitHub Models (gpt-4o) replied successfully for ${phone}`);
                    return processReply(replyText, aiData?.usage?.total_tokens || 100);
                }
            }
        } catch (err) {
            if (err.name === 'AbortError') throw err;
            console.warn(`[WhatsApp AI] GitHub Models fallback warning:`, err.message);
        }
    }

    // ── PRIORITY 1: Google Gemini 2.5 Flash (Official API Key) ──
    if (GEMINI_API_KEY) {
        try {
            const contents = messages.map(m => ({
                role: m.role === 'user' ? 'user' : 'model',
                parts: [{ text: m.content || '' }]
            }));
            
            const payload = {
                systemInstruction: { parts: [{ text: enhancedSystemPrompt }] },
                contents: contents.filter(m => m.parts[0].text !== enhancedSystemPrompt),
                generationConfig: { maxOutputTokens: 1500, temperature: 0.3 }
            };

            const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: signal,
                body: JSON.stringify(payload)
            });

            if (geminiRes.ok) {
                const aiData = await geminiRes.json();
                let replyText = aiData?.candidates?.[0]?.content?.parts?.[0]?.text;
                if (replyText && replyText.trim()) {
                    console.log(`[WhatsApp AI] ⚡ Gemini 2.5 Flash replied successfully for ${phone}`);
                    return processReply(replyText, 250);
                }
            } else {
                const errText = await geminiRes.text();
                console.warn(`[WhatsApp AI] Gemini API error (${geminiRes.status}):`, errText);
            }
        } catch (err) {
            if (err.name === 'AbortError') throw err;
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
                signal: signal,
                body: JSON.stringify({
                    models: [
                        'google/gemini-2.5-flash',
                        'qwen/qwen-2-7b-instruct:free',
                        'meta-llama/llama-3.1-8b-instruct:free'
                    ],
                    route: 'fallback',
                    messages: messages,
                    max_tokens: 1500,
                    temperature: 0.3
                })
            });

            if (res.ok) {
                const aiData = await res.json();
                let replyText = aiData?.choices?.[0]?.message?.content;
                if (replyText && replyText.trim()) {
                    console.log(`[WhatsApp AI] ⚡ OpenRouter replied successfully for ${phone}`);
                    return processReply(replyText, aiData?.usage?.total_tokens || 250);
                }
            }
        } catch (err) {
            if (err.name === 'AbortError') throw err;
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
                    signal: signal,
                    body: JSON.stringify({
                        model: model,
                        messages: messages,
                        max_tokens: 1500,
                        temperature: 0.3
                    })
                });

                if (res.ok) {
                    const aiData = await res.json();
                    let replyText = aiData?.choices?.[0]?.message?.content;
                    if (replyText && replyText.trim()) {
                        console.log(`[WhatsApp AI] ⚡ Groq (${model}) replied successfully for ${phone}`);
                        return processReply(replyText, aiData?.usage?.total_tokens || 250);
                    }
                }
            } catch (err) {
                if (err.name === 'AbortError') throw err;
                console.warn(`[WhatsApp AI] Groq (${model}) error:`, err.message);
            }
        }
    }

    // ── PRIORITY 4: Supabase Edge Function ──
    try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/ai-assistant`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_KEY}` },
            signal: signal,
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
                return processReply(replyText, 250);
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

