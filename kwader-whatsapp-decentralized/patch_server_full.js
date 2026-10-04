const fs = require('fs');

const originalPath = 'd:/Zk att project/kwader-whatsapp-decentralized/server.js';
const original = fs.readFileSync(originalPath, 'utf8');

const NEW_ON_MESSAGE = `
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

                // 1. Fetch channel AI settings
                const { data: channelData } = await supabase
                    .from('whatsapp_channels')
                    .select('*')
                    .eq('id', DEFAULT_CHANNEL_ID)
                    .single();
                
                if (!channelData || channelData.ai_enabled === false) {
                    return; // Ignore if AI disabled
                }

                console.log(\`[WhatsApp AI] 📩 Message from \${phone} (\${customerName}): "\${text.trim().substring(0, 50)}..."\`);

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
                            channel_id: DEFAULT_CHANNEL_ID,
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
                    console.log(\`[WhatsApp AI] ⏸️ Chat with \${phone} is in human_takeover mode. Skipping AI.\`);
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
                    console.log(\`[WhatsApp AI] 👨‍💼 Explicit handoff flagged for \${phone}, AI will answer and confirm follow-up.\`);
                }

                // 6. Grounding Context from 0-token Knowledge Base (Never raw bypass)
                let kbGroundingText = '';
                try {
                    let kbQuery = supabase
                        .from('ai_knowledge_base')
                        .select('question_trigger, answer_content, keywords')
                        .eq('is_active', true);

                    if (channelData.company_id) {
                        kbQuery = kbQuery.or(\`company_id.is.null,company_id.eq.\${channelData.company_id}\`);
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
                                kbGroundingText = \`\\n\\n📚 معلومات موثقة من قاعدة المعرفة بخصوص الاستفسار:\\n\${item.answer_content}\\n(تنبيه: أعد صياغة هذه المعلومات بأسلوبك البشري الودود وبالعامية المصرية المناسبة للمحادثة واختم بسؤال، لا تقم بنسخها بنقاط جافة!)\`;
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
                autoUpdateCustomerProfile(phone, DEFAULT_CHANNEL_ID, text, customerName);

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
                        .replace(/^#+\\s+/gm, '')
                        .replace(/\\*\\*(.*?)\\*\\*/g, '$1')
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
                    console.log(\`[WhatsApp AI] 🤖 Sent reply to \${phone}\`);
                }

                // 10. Autonomous CRM Lead Detection + PHASE 3 FAQ Cache update
                const isBuyingInterest = /(تجرب[ةه]|اشتراك|سعر|باق[ةه]|شراء|عرض سعر|مبيعات|نشترك|نجرب|حساب جديد|تسجيل)/i.test(text);
                const empMatch = text.match(/(\\d+)\\s*(موظف|عامل|شخص|فرد)/i);
                const compMatch = text.match(/شرك[ةه]\\s+([^\\n,.،]+)/i);

                let leadNotes = \`تم التقاط العميل آلياً عبر محادثة واتساب (\${phone})\`;
                if (empMatch) leadNotes += \` | عدد الموظفين التقريبي: \${empMatch[1]}\`;
                if (compMatch) leadNotes += \` | اسم الشركة: \${compMatch[1].trim()}\`;

                if ((isBuyingInterest || empMatch) && conv?.id && conv.lead_status !== 'lead_captured') {
                    await supabase
                        .from('ai_conversations')
                        .update({
                            lead_status: 'lead_captured',
                            summary: empMatch ? \`مهتم - \${empMatch[0]}\` : 'عميل مهتم بالاشتراك أو التجربة'
                        })
                        .eq('id', conv.id);

                    await supabase.from('ai_leads').insert({
                        conversation_id: conv.id,
                        channel_id: DEFAULT_CHANNEL_ID,
                        company_id: channelData.company_id || null,
                        contact_name: customerName,
                        contact_phone: phone,
                        customer_name: customerName,
                        customer_phone: phone,
                        status: 'new',
                        interest_summary: text.trim().slice(0, 200),
                        customer_notes: leadNotes
                    });
                    console.log(\`[WhatsApp AI] 🎯 Qualified lead captured for \${phone}: \${leadNotes}\`);
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
`;

const NEW_FUNCTIONS = `
async function generateAiReply({ systemPrompt, history, text, phone }) {
    // Check FAQ cache first (Phase 4)
    const cacheKey = getMessageCacheKey(text);
    if (cacheKey && FAQ_CACHE.has(cacheKey)) {
        const cached = FAQ_CACHE.get(cacheKey);
        if (Date.now() - cached.ts < CACHE_TTL) {
            console.log(\`[WhatsApp AI] ⚡ Cache HIT for \${phone} (\${cacheKey})\`);
            return { replyText: cached.reply, tokensUsed: 0 };
        } else {
            FAQ_CACHE.delete(cacheKey);
        }
    }

    const groqModels = ['qwen/qwen3.8-27b', 'allam-2-7b', 'openai/gpt-oss-120b'];
    const messages = [
        { role: 'system', content: systemPrompt },
        ...history,
        { role: 'user', content: text }
    ];

    for (let model of groqModels) {
        try {
            const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': \`Bearer \${GROQ_API_KEY}\`
                },
                body: JSON.stringify({
                    model: 'qwen-2.5-70b-versatile',
                    messages: messages,
                    max_tokens: 250,
                    temperature: 0.2
                })
            });

            if (res.ok) {
                const aiData = await res.json();
                let replyText = aiData?.choices?.[0]?.message?.content;
                if (replyText && replyText.trim()) {
                    replyText = replyText.replace(/<ACTION>[\\s\\S]*?<\\/ACTION>/g, '').trim();
                    return { replyText, tokensUsed: aiData?.usage?.total_tokens || 250 };
                }
            }
        } catch (err) {
            console.warn(\`[WhatsApp AI] Groq fallback warning:\`, err.message);
        }
    }

    try {
        const res = await fetch(\`\${SUPABASE_URL}/functions/v1/ai-assistant\`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': \`Bearer \${SUPABASE_KEY}\` },
            body: JSON.stringify({
                company_id: DEFAULT_CHANNEL_ID,
                messages: [
                    { role: 'system', content: systemPrompt },
                    ...history,
                    { role: 'user', content: text }
                ]
            })
        });

        if (res.ok) {
            const aiData = await res.json();
            let replyText = aiData?.choices?.[0]?.message?.content;
            if (replyText && replyText.trim()) {
                replyText = replyText.replace(/<ACTION>[\\s\\S]*?<\\/ACTION>/g, '').trim();
                return { replyText, tokensUsed: 250 };
            }
        }
    } catch (err) {
        console.warn(\`[WhatsApp AI] Edge function fallback failed:\`, err.message);
    }

    return {
        replyText: 'أهلاً بك في منصة كوادر! يسعدنا تواصلك معنا، وسيقوم أحد مسؤولي خدمة العملاء والدعم بالرد عليك في أقرب وقت. كيف يمكننا مساعدتك اليوم؟',
        tokensUsed: 0
    };
}
`;

// Extract old onMessage boundaries
const startIdx = original.indexOf('onMessage: async (msgUpsert, sock) => {');
const endIdx = original.indexOf('async function stopWhatsAppLeaderEngine() {', startIdx);

if (startIdx === -1 || endIdx === -1) {
    console.error('Could not find onMessage block.');
    process.exit(1);
}

const beforeOnMessage = original.substring(0, startIdx);
const afterOnMessage = '    });\n}\n\n' + original.substring(endIdx);

// Construct new file content
let finalCode = beforeOnMessage + NEW_ON_MESSAGE.trim() + '\n' + afterOnMessage;

// Add GROQ_API_KEY
if (!finalCode.includes('GROQ_API_KEY')) {
    finalCode = finalCode.replace(
        "const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);",
        "const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);\nconst GROQ_API_KEY = process.env.GROQ_API_KEY;\nconst APP_VERSION = require('./package.json').version || '2.9.2';"
    );
}

// Ensure PHASE_FUNCTIONS from previous patch is still there, or add it
const fs2 = require('fs');
const prevPatch = fs2.readFileSync('patch_server.js', 'utf8');
const phaseFuncMatch = prevPatch.match(/const PHASE_FUNCTIONS = \`([\\s\\S]*?)\`;\\n/);

if (phaseFuncMatch) {
    const phaseFunctionsStr = phaseFuncMatch[1].replace(/\\\\/g, '\\\\').replace(/\\\$/g, '$'); // unescape backticks & variables
    
    // Inject at the end, before leaseManager.start
    finalCode = finalCode.replace(
        'leaseManager.start();',
        phaseFunctionsStr + '\\n' + NEW_FUNCTIONS + '\\nleaseManager.start();'
    );
}

fs.writeFileSync('d:/Zk att project/kwader-whatsapp-decentralized/server.js', finalCode, 'utf8');
console.log('✅ Wrote entirely new server.js properly. Run node -c server.js to test.');
