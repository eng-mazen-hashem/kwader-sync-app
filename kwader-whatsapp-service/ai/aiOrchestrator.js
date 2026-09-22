const { callGemini } = require('./geminiClient');
const { routeIntent } = require('./intentRouter');
const { retrieveKnowledge } = require('./knowledgeRetriever');
const { AI_TOOLS, executeToolCall } = require('./salesQualifier');
const { 
    extractSerial, 
    findCompanyBySerial, 
    runCompanyDiagnostics, 
    executeDatabaseRepair 
} = require('./dbTroubleshooter');
const { getCachedResponse, setCachedResponse } = require('./faqCache');
const { extractAndDistillState, formatDistilledContext, pruneConversationHistory } = require('./contextDistiller');
const { learnFromAiInteraction } = require('./autoLearner');

/**
 * Handle incoming WhatsApp message for a channel
 * @param {Object} waClient - whatsapp-web.js Client instance
 * @param {Object} channel - Channel configuration record from `whatsapp_channels`
 * @param {Object} msg - Incoming message event object from whatsapp-web.js
 * @param {Object} supabase - Supabase client instance
 */
async function handleIncomingWhatsAppMessage(waClient, channel, msg, supabase) {
    let chat = null;
    let typingInterval = null;
    const processingStartTime = Date.now();

    try {
        // 1. Guard Clauses: Skip own messages, status broadcasts, and groups
        if (msg.fromMe || msg.isStatus || msg.broadcast) return;
        if (msg.from && (msg.from.includes('@g.us') || msg.from.includes('status@broadcast'))) return;
        if (!msg.body || typeof msg.body !== 'string' || msg.body.trim().length === 0) return;

        // 2. Check if AI Agent is enabled for this channel
        if (!channel || channel.ai_enabled !== true) {
            return;
        }

        const rawText = msg.body.trim();
        const rawSender = msg.from || '';
        const rawDigits = rawSender.replace(/@(c\.us|lid)/g, '').replace(/\D/g, '');
        const isLid = rawSender.includes('@lid') || rawDigits.length >= 15;

        let realPhone = isLid ? null : rawDigits;
        let customerName = null;

        // 3. IMMEDIATELY Activate WhatsApp Human Typing State & Seen
        const sendTyping = async () => {
            try {
                if (typeof waClient.sendPresenceAvailable === 'function') {
                    await waClient.sendPresenceAvailable().catch(() => {});
                }
                if (typeof msg.sendSeen === 'function') {
                    await msg.sendSeen().catch(() => {});
                }
                if (chat && typeof chat.sendSeen === 'function') {
                    await chat.sendSeen().catch(() => {});
                }
                if (chat && typeof chat.sendStateTyping === 'function') {
                    await chat.sendStateTyping().catch(() => {});
                }
                if (waClient?.pupPage) {
                    const targets = [rawSender];
                    if (realPhone && realPhone !== rawDigits) {
                        targets.push(`${realPhone}@c.us`);
                    }
                    await waClient.pupPage.evaluate(async (jids) => {
                        if (window.WWebJS && typeof window.WWebJS.sendChatstate === 'function') {
                            for (const jid of jids) {
                                try {
                                    await window.WWebJS.sendChatstate('typing', jid);
                                } catch (e) {}
                            }
                        }
                    }, targets).catch(() => {});
                }
            } catch (err) {}
        };

        const clearTyping = async () => {
            try {
                if (chat && typeof chat.clearState === 'function') {
                    await chat.clearState().catch(() => {});
                }
                if (waClient?.pupPage) {
                    const targets = [rawSender];
                    if (realPhone && realPhone !== rawDigits) {
                        targets.push(`${realPhone}@c.us`);
                    }
                    await waClient.pupPage.evaluate(async (jids) => {
                        if (window.WWebJS && typeof window.WWebJS.sendChatstate === 'function') {
                            for (const jid of jids) {
                                try {
                                    await window.WWebJS.sendChatstate('stop', jid);
                                } catch (e) {}
                            }
                        }
                    }, targets).catch(() => {});
                }
            } catch (err) {}
        };

        await sendTyping();
        typingInterval = setInterval(sendTyping, 2800);
        console.log(`💬 [AI Orchestrator] Direct typing indicator activated for ${rawSender}`);

        try {
            chat = await msg.getChat().catch(() => null);
        } catch (chatInitErr) {
            chat = null;
        }

        // Extract contact profile name and real phone if available
        try {
            const contact = await msg.getContact();
            if (contact) {
                customerName = contact.pushname || contact.name || contact.shortName || null;
                if (contact.number && !contact.number.includes('lid') && contact.number.length >= 8 && contact.number.length < 15) {
                    realPhone = contact.number.replace(/\D/g, '');
                }
            }
        } catch (cErr) {
            console.warn('⚠️ [AI Orchestrator] Warning fetching contact info:', cErr.message);
        }

        if (!customerName && msg._data?.notifyName) {
            customerName = msg._data.notifyName;
        }

        // If message is from a WhatsApp LID, attempt to resolve the actual phone number via waClient
        if (isLid && !realPhone) {
            try {
                if (typeof waClient.getContactLidAndPhone === 'function') {
                    const mappings = await waClient.getContactLidAndPhone([rawSender]);
                    if (mappings && mappings[0] && mappings[0].pn) {
                        const resolvedPn = mappings[0].pn.replace('@c.us', '').replace(/\D/g, '');
                        if (resolvedPn && resolvedPn.length >= 8 && resolvedPn.length < 15) {
                            realPhone = resolvedPn;
                            console.log(`📱 [AI Orchestrator] Successfully resolved LID ${rawSender} -> Phone: +${realPhone}`);
                        }
                    }
                }
            } catch (lidErr) {
                console.warn('⚠️ [AI Orchestrator] LID to phone resolution warning:', lidErr.message);
            }
        }

        if (!chat && realPhone) {
            try {
                chat = await waClient.getChatById(`${realPhone}@c.us`).catch(() => null);
            } catch (e) {}
        }
        if (!chat && rawSender) {
            try {
                chat = await waClient.getChatById(rawSender).catch(() => null);
            } catch (e) {}
        }

        // Immediate typing pulse with resolved phone & chat
        await sendTyping();

        const senderPhone = realPhone || rawDigits;

        // Helper to smoothly deliver reply with realistic human delay
        const deliverFinalReply = async (replyText) => {
            // ✅ إصلاح: ضمان أن replyText دائماً string لتجنب خطأ .trim is not a function
            const safeText = replyText != null ? String(replyText).trim() : '';
            if (!safeText) return;
            try {
                const elapsed = Date.now() - processingStartTime;
                // Realistic human typing duration: min 3.2s, max 5.2s based on length
                const targetDuration = Math.min(Math.max(safeText.length * 35, 3200), 5200);
                if (elapsed < targetDuration) {
                    await new Promise(res => setTimeout(res, targetDuration - elapsed));
                }
            } catch (delayErr) {}

            if (typingInterval) {
                clearInterval(typingInterval);
                typingInterval = null;
            }

            try {
                await msg.reply(safeText);
                console.log(`✅ [AI Orchestrator] Reply delivered to ${rawSender} (${senderPhone}) via msg.reply`);
            } catch (sendErr) {
                console.warn('⚠️ [AI Orchestrator] msg.reply failed, attempting direct waClient.sendMessage:', sendErr.message);
                try {
                    await waClient.sendMessage(rawSender, safeText);
                } catch (sendErr2) {
                    if (chat && typeof chat.sendMessage === 'function') {
                        await chat.sendMessage(safeText).catch(() => {});
                    }
                }
            } finally {
                await clearTyping();
            }
        };

        // 4. Retrieve or create active conversation session in Supabase
        let convQuery = supabase
            .from('ai_conversations')
            .select('*')
            .eq('platform', 'whatsapp');

        if (realPhone && realPhone !== rawDigits) {
            convQuery = convQuery.or(`session_id.eq.${rawDigits},session_id.eq.${realPhone},customer_phone.eq.${realPhone}`);
        } else {
            convQuery = convQuery.or(`session_id.eq.${rawDigits},customer_phone.eq.${rawDigits}`);
        }

        let { data: conversation, error: convErr } = await convQuery
            .order('last_message_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (convErr) {
            console.error('⚠️ [AI Orchestrator] Error fetching conversation:', convErr.message);
        }

        if (!conversation) {
            const { data: newConv, error: createErr } = await supabase
                .from('ai_conversations')
                .insert({
                    channel_id: channel.id,
                    company_id: channel.company_id || null,
                    platform: 'whatsapp',
                    session_id: rawDigits,
                    customer_phone: realPhone || (isLid ? null : rawDigits),
                    customer_name: customerName || null,
                    status: 'ai_active',
                    lead_status: 'none',
                    last_message_at: new Date().toISOString()
                })
                .select()
                .single();

            if (createErr) {
                console.error('⚠️ [AI Orchestrator] Error creating conversation:', createErr.message);
                if (typingInterval) clearInterval(typingInterval);
                if (chat && typeof chat.clearState === 'function') await chat.clearState().catch(() => {});
                return;
            }
            conversation = newConv;
        } else {
            // Update last_message_at and enrich customer_name / realPhone if newly available
            const updateFields = { 
                last_message_at: new Date().toISOString(),
                channel_id: channel.id
            };
            if (customerName && !conversation.customer_name) {
                updateFields.customer_name = customerName;
            }
            if (realPhone && (!conversation.customer_phone || conversation.customer_phone.length >= 15)) {
                updateFields.customer_phone = realPhone;
            }

            await supabase
                .from('ai_conversations')
                .update(updateFields)
                .eq('id', conversation.id);

            Object.assign(conversation, updateFields);
        }

        // 5. Human Takeover Check: If human agent took over, DO NOT auto-reply with AI!
        if (conversation.status === 'human_takeover') {
            if (typingInterval) clearInterval(typingInterval);
            if (chat && typeof chat.clearState === 'function') await chat.clearState().catch(() => {});

            // Store user message for the human agent to see in live dashboard
            await supabase.from('ai_messages').insert({
                conversation_id: conversation.id,
                sender_type: 'user',
                message_text: rawText
            });
            console.log(`ℹ️ [AI Orchestrator] Message from ${senderPhone} logged. AI paused (Human Takeover active).`);
            return;
        }

        // ALWAYS log incoming customer message immediately so it appears on dashboard instantly
        await supabase.from('ai_messages').insert({
            conversation_id: conversation.id,
            sender_type: 'user',
            message_text: rawText
        });

        // 6. Check Fast Intent Router (0 Tokens Saved)
        const routed = routeIntent(rawText, channel);

        if (routed.type === 'HANDOFF') {
            await supabase
                .from('ai_conversations')
                .update({
                    status: 'human_takeover',
                    summary: routed.reason || 'طلب تحويل لبشري عبر فاحص النوايا'
                })
                .eq('id', conversation.id);

            await supabase.from('ai_messages').insert({
                conversation_id: conversation.id,
                sender_type: 'ai',
                message_text: routed.reply,
                tokens_used: 0
            });

            await deliverFinalReply(routed.reply);
            return;
        }

        if (routed.type === 'DIRECT_REPLY') {
            await supabase.from('ai_messages').insert({
                conversation_id: conversation.id,
                sender_type: 'ai',
                message_text: routed.reply,
                tokens_used: 0
            });

            await deliverFinalReply(routed.reply);
            return;
        }

        // 6.5 Check Multi-Tier 0-Token Semantic FAQ & Learned Knowledge Cache
        const cachedHit = await getCachedResponse(rawText, conversation.company_id, supabase);
        if (cachedHit) {
            console.log(`⚡ [AI Orchestrator] 0-Token Cache Hit! Tier: ${cachedHit.tier} (Confidence: ${cachedHit.confidence}). Saved ~1200 tokens.`);
            await supabase.from('ai_messages').insert({
                conversation_id: conversation.id,
                sender_type: 'ai',
                message_text: cachedHit.reply,
                tokens_used: 0
            });
            await deliverFinalReply(cachedHit.reply);
            return;
        }

        // 7. Dynamic AI Processing with Gemini Flash
        let finalReply = '';
        let tokensUsed = 0;

        try {
            // A. Serial Authentication & Database Context
            const detectedSerial = extractSerial(rawText);
            let authenticatedCompany = null;
            let serialAuthStatus = 'NONE'; // 'SUCCESS', 'INVALID', 'PERSISTED', 'NONE'

            if (detectedSerial) {
                authenticatedCompany = await findCompanyBySerial(supabase, detectedSerial);
                if (authenticatedCompany) {
                    serialAuthStatus = 'SUCCESS';
                    conversation.company_id = authenticatedCompany.id;
                    conversation.context_state = {
                        ...(conversation.context_state || {}),
                        authenticated_company_id: authenticatedCompany.id,
                        authenticated_company_name: authenticatedCompany.name,
                        authenticated_license_key: authenticatedCompany.license_key
                    };
                    await supabase
                        .from('ai_conversations')
                        .update({
                            company_id: authenticatedCompany.id,
                            context_state: conversation.context_state
                        })
                        .eq('id', conversation.id);
                    console.log(`🔑 [AI Orchestrator] Company authenticated via serial: ${authenticatedCompany.name} (${authenticatedCompany.id})`);
                } else {
                    serialAuthStatus = 'INVALID';
                    console.log(`⚠️ [AI Orchestrator] Serial not found: ${detectedSerial}`);
                }
            } else if (conversation.context_state?.authenticated_company_id) {
                const compId = conversation.context_state.authenticated_company_id;
                const { data: comp } = await supabase
                    .from('companies')
                    .select('id, name, license_key, status, subscription_end_date')
                    .eq('id', compId)
                    .maybeSingle();
                if (comp) {
                    authenticatedCompany = comp;
                    serialAuthStatus = 'PERSISTED';
                }
            }

            // B. Live Database Diagnostics & Autonomous Repair
            let databaseContext = '';
            let liveDiagnostics = null;
            let proactiveRepairResult = null;

            if (authenticatedCompany) {
                liveDiagnostics = await runCompanyDiagnostics(supabase, authenticatedCompany.id);

                // Proactive Autonomous Repair if user explicitly asked for a fix/reprocess
                const wantsFix = /(حل|صلح|عالج|شغل|احسب|ظبط|فك|اربط|سكن|مشي)\b/i.test(rawText);
                if (wantsFix && liveDiagnostics) {
                    if (liveDiagnostics.stats.unprocessedLogsCount > 0 && /(بصم|حضور|انصراف|سجلات|سجل)/i.test(rawText)) {
                        proactiveRepairResult = await executeDatabaseRepair(supabase, authenticatedCompany.id, 'reprocess_attendance');
                        liveDiagnostics = await runCompanyDiagnostics(supabase, authenticatedCompany.id);
                    } else if (liveDiagnostics.stats.unassignedEmployeesCount > 0 && /(شيفت|وردية|موظف|تسكين|ربط)/i.test(rawText)) {
                        proactiveRepairResult = await executeDatabaseRepair(supabase, authenticatedCompany.id, 'assign_shift', { assign_all_unassigned: true });
                        liveDiagnostics = await runCompanyDiagnostics(supabase, authenticatedCompany.id);
                    }
                }

                const issuesText = liveDiagnostics?.issuesFound?.length > 0
                    ? liveDiagnostics.issuesFound.map(i => `  - ⚠️ [${i.severity}] ${i.message}`).join('\n')
                    : '  - ✅ لا توجد مشاكل ظاهرة، قاعدة البيانات والأجهزة والورديات بحالة ممتازة.';

                const repairText = proactiveRepairResult
                    ? `\n🛠️ إجراء إصلاحي تم تنفيذه فوراً تلقائياً:\n- ${proactiveRepairResult.message}\n`
                    : '';

                databaseContext = `
🏢 بيانات قاعدة بيانات الشركة الموثقة (${authenticatedCompany.name}):
- اسم الشركة: ${authenticatedCompany.name}
- كود الترخيص/السيريال: ${authenticatedCompany.license_key}
- حالة الاشتراك: ${authenticatedCompany.status} (ينتهي في: ${authenticatedCompany.subscription_end_date || 'غير محدد'})
- أجهزة البصمة: إجمالي ${liveDiagnostics?.stats?.totalDevices || 0} جهاز.
- الموظفون النشطون: ${liveDiagnostics?.stats?.totalActiveEmployees || 0} موظف.
- الورديات المفعلة: ${liveDiagnostics?.stats?.activeShiftsCount || 0} وردية.
- سجلات البصمات غير المعالجة: ${liveDiagnostics?.stats?.unprocessedLogsCount || 0}.
- آخر بصمة واردة للنظام: ${liveDiagnostics?.stats?.latestLogTimestamp || 'لا توجد بصمات حديثة'}.
📋 فحص وتشخيص المشاكل في قاعدة البيانات حالياً:
${issuesText}
${repairText}
`;
            } else if (serialAuthStatus === 'INVALID') {
                databaseContext = `
⚠️ تنبيه هام: العميل أرسل كود أو سيريال (${detectedSerial}) لكنه غير مسجل في قاعدة بيانات منصة كوادر!
- وضّح له بلطف أن هذا السيريال غير مسجل.
- اطلب منه نسخه بدقة من لوحة تحكم المنصة: من قائمة (الإعدادات > مفتاح الترخيص).
`;
            } else {
                const isTechnicalQuery = /(قاعدة البيانات|داتابيز|مشكل[ةه]|بصم[ةه]|جهاز|شيفت|ما بتنزل|ما بيسجل|ما بيفتح)/i.test(rawText);
                if (isTechnicalQuery) {
                    databaseContext = `
💡 ملاحظة: العميل يطرح مشكلة فنية أو استفساراً عن حسابه وقاعدة بياناته لكنه لم يرسل سيريال شركته بعد.
- رحب به بلطف، واطلب منه تزويدك بسيريال الشركة (مفتاح الترخيص / License Key) من صفحة الإعدادات، لتتمكن فوراً من الدخول لقاعدة بياناته وتشخيص المشكلة وحلها له على الفور.
`;
                }
            }

            // C. Retrieve ground-truth knowledge snippets
            const knowledgeContext = await retrieveKnowledge(supabase, rawText, channel.company_id);

            // D. Cumulative Context State Distillation & Sliding History Pruning (Saves 75%+ tokens)
            const updatedContextState = extractAndDistillState(rawText, conversation.context_state || {});
            conversation.context_state = updatedContextState;
            await supabase
                .from('ai_conversations')
                .update({ context_state: updatedContextState })
                .eq('id', conversation.id);

            const distilledContextPrompt = formatDistilledContext(updatedContextState);

            const { data: recentMessages } = await supabase
                .from('ai_messages')
                .select('sender_type, message_text')
                .eq('conversation_id', conversation.id)
                .order('created_at', { ascending: false })
                .limit(4);

            const historyContents = pruneConversationHistory(recentMessages, 2);

            // E. Build deep humanized conversational instructions
            const aiMode = channel.ai_mode || 'hybrid';
            const aiName = channel.ai_name || 'مستشار كوادر';
            
            let rolePersona = 'أنت إنسان حقيقي تعمل كمستشار مبيعات ودعم فني ذكي، لبق وودود جداً في شركة "كوادر" (KWADER).';
            if (aiMode === 'sales') {
                rolePersona = 'أنت إنسان حقيقي تعمل كمستشار مبيعات محترف وذكي وودود في شركة "كوادر" (KWADER). هدفك بناء علاقة راقية وفهم احتياج العميل واقتراح أفضل باقة وتسهيل تجربته.';
            } else if (aiMode === 'support') {
                rolePersona = 'أنت إنسان حقيقي تعمل كأخصائي دعم فني وخدمة عملاء ودود ومتعاون في شركة "كوادر" (KWADER). هدفك مساعدة العميل وحل أي استفسار برحابة صدر وبساطة.';
            }

            const customerContext = conversation.customer_name ? `
👤 بيانات العميل في هذه المحادثة:
- الاسم: ${conversation.customer_name}
- حالة العميل: تم تسجيل بياناته مسبقاً.
- ⚠️ ممنوع إعادة سؤاله عن اسمه أو بيانات شركته.
` : '';

            const systemInstruction = `
${rolePersona}
اسمك في المحادثة: ${aiName}.
${distilledContextPrompt}
${customerContext}
${databaseContext}

🎯 الهدف الأهم: التحدث كإنسان حقيقي وذكي في محادثة واتساب شخصية حية. يُمنع منعاً باتاً التحدث كروبوت أو إعطاء ردود آلية معلبة أو متكلفة.

🗣️ أسلوب الحديث واللهجة (تطبيق صارم وبشري 100%):
1. **ممنوع الفصحى الرسمية الجافة نهائياً:**
   - إياك واستخدام عبارات الروبوتات القديمة مثل: "نشكر تواصلك معنا"، "يسعدني إفادتكم"، "بناءً على طلبكم"، "عزيزي العميل"، "في حال وجود أي استفسار لا تتردد".
   - تحدث بلغة عربية بيضاء بسيطة، طبيعية، وودودة جداً (مثل اللهجة المصرية/البيضاء الدارجة المفهومة والمحبوبة عند الجميع).
   - استخدم كلمات ترحيب وتفاعل طبيعية، مثل: "يا هلا والله"، "أهلاً بيك يا فندم"، "تمام فهمت عليك"، "بص يا غالي"، "خليني أوضحلك"، "أكيد نقدر نفيدك"، "منورنا والله".
2. **رسائل واتساب خفيفة وموجزة:**
   - اكتب رداً قصيراً ومباشراً وممتعاً في القراءة (سطرين إلى 4 أسطر مركزة).
   - تجنب كتابة مقالات طويلة أو رص نقاط مرقمة كثيرة (1, 2, 3, 4).
3. **التفاعل الحقيقي والوجداني (Conversational Empathy):**
   - علّق أولاً على ما قاله العميل بلطافة قبل طرح أي تفاصيل جديدة.
   - تذكر ما قاله العميل في الرسائل السابقة ولا تسأله عن شيء ذكره بالفعل.
4. **الدعم الفني وحل مشاكل قاعدة البيانات (Database Support & Diagnosis):**
   - عندما يرسل العميل سيريال الشركة: رحب به باسم شركته وأكد له أنك متصل بقاعدة بياناته الآن.
   - لخص له حالة قاعدة البيانات بلغة عربية بيضاء واضحة ومطمئنة (عدد الأجهزة، حالة البصمات، الورديات).
   - إذا تم تنفيذ إجراء إصلاحي تلقائياً (مثل إعادة احتساب البصمات أو تسكين موظفين): وضّح له ما قمت به ببساطة، واطلب منه مراجعة لوحة التحكم للتأكد.
   - إذا طلب إصلاحاً محدداً أو فك قفل هاتف موظف: استخدم الأداة المناسبة أو نفذ المطلوب وأكد له الإنجاز.
5. **المبيعات واقتناص الفرص (Sales & Lead Capture):**
   - عند الاستفسار عن الأسعار أو رغبة العميل في الاشتراك: وضح باختصار أن الباقات مرنة واطلب اسمه واستدعِ (capture_lead).
   - إذا طلب موظفاً بشرياً صراحة: استدعِ (request_human_handoff) فوراً.

📌 حقائق المنصة وروابطها الأساسية:
- رابط التجربة والتسجيل المباشر: https://kwader.app
- الدعم الفني: فريق الدعم الفني متاح 24/7 لمساعدتكم في ربط أجهزة البصمة وإعداد لوائح العمل بدقة.

${channel.ai_prompt_instructions ? `
⭐ تعليمات خاصة وتفاصيل الشركة من الإدارة:
${channel.ai_prompt_instructions}
` : ''}

📌 مرجع معلومات المنصة الإضافي:
${knowledgeContext || 'منصة كوادر تقدم حلولاً سحابية شاملة للموارد البشرية، إدارة الحضور والانصراف، الربط مع كافة أجهزة البصمة، وحساب الرواتب والبدلات بدقة.'}
`.trim();

            // F. Dynamic Tool Pruning (Saves 400+ tokens on general messages)
            const isTechnical = !!authenticatedCompany || !!detectedSerial || 
                /(بصم|جهاز|أجهزة|اجهزة|قاعدة|داتابيز|وردية|ورديات|شيفت|تسكين|موظف|حضور|انصراف|سجلات|سجل)/i.test(rawText);

            const activeTools = [];
            if (conversation.lead_status !== 'lead_captured') {
                const leadTool = AI_TOOLS.find(t => t.name === 'capture_lead');
                if (leadTool) activeTools.push(leadTool);
            }
            const handoffTool = AI_TOOLS.find(t => t.name === 'request_human_handoff');
            if (handoffTool) activeTools.push(handoffTool);

            if (isTechnical) {
                const dbTools = AI_TOOLS.filter(t => [
                    'verify_company_serial',
                    'diagnose_company_database',
                    'reprocess_attendance',
                    'assign_employee_to_shift',
                    'reset_employee_mobile_device'
                ].includes(t.name));
                activeTools.push(...dbTools);
            }

            // Call Gemini API
            const geminiResult = await callGemini({
                systemInstruction,
                contents: historyContents,
                tools: activeTools,
                apiKey: channel.ai_api_key || process.env.GEMINI_API_KEY
            });

            // ✅ ضمان أن finalReply دائماً string حتى لو رجع Gemini object أو null
            finalReply = geminiResult.text != null ? String(geminiResult.text) : '';
            tokensUsed = geminiResult.tokensUsed || 0;

            // Autonomous Learning: Cache high quality general replies for instant 0-token re-use
            if (finalReply && !geminiResult.functionCalls?.length && !authenticatedCompany) {
                learnFromAiInteraction(rawText, finalReply);
            }

            // G. Handle Function Calls (Tools)
            if (geminiResult.functionCalls && geminiResult.functionCalls.length > 0) {
                for (const fc of geminiResult.functionCalls) {
                    const toolResult = await executeToolCall(
                        supabase,
                        conversation,
                        channel,
                        fc.name,
                        fc.args || {}
                    );

                    if (fc.name === 'capture_lead') {
                        conversation.lead_status = 'lead_captured';
                        if (fc.args?.contact_name) conversation.customer_name = fc.args.contact_name;
                        if (!finalReply) {
                            const name = fc.args?.contact_name || conversation.customer_name || '';
                            const greeting = name ? `يا هلا أستاذ ${name}! ` : 'يا أهلاً بك! ';
                            finalReply = `${greeting}سجّلت بياناتك وبيانات الشركة بنجاح. 🎉\nتقدر تبدأ وتجرب المنصة فوراً وتستكشف لوحة التحكم من الرابط:\nhttps://kwader.app`;
                        }
                    } else if (fc.name === 'request_human_handoff' && !finalReply) {
                        finalReply = 'تمام يا فندم، حولت المحادثة حالاً لأحد زملائنا في الدعم الفني وهيدخل يتابع معاك فوراً. تشرفنا بيك جداً!';
                    } else if (!finalReply && toolResult?.message) {
                        finalReply = toolResult.message;
                    }
                }
            }
        } catch (geminiErr) {
            console.error('⚠️ [AI Orchestrator] Gemini API error, applying fallback:', geminiErr.message);
            if (authenticatedCompany) {
                const compName = authenticatedCompany.name || 'شركتكم';
                if (/(بصم|جهاز)/i.test(rawText)) {
                    finalReply = `يا هلا أستاذنا! وصلت بيانات شركة (${compName}) بنجاح. وجاري تجهيز ربط جهاز البصمة لحسابكم حالاً، ثواني ونكون جاهزين! 🚀`;
                } else {
                    finalReply = `يا أهلاً بحضرتك! تم التحقق من سيريال شركة (${compName}) بنجاح. معاك خطوة بخطوة، قولي حابب نظبط إيه بالضبط في حسابك؟ 👍`;
                }
            } else if (serialAuthStatus === 'INVALID') {
                finalReply = 'يا أهلاً بيك! السيريال المرسل غير مسجل لدينا في منصة كوادر، يرجى التأكد من نسخه من قائمة (الإعدادات > مفتاح الترخيص) وإعادة إرساله.';
            } else {
                finalReply = 'معاك يا غالي وسامعك تمام! اتفضل قول لي أقدر أساعدك في إيه بالضبط؟ 😊';
            }
        }

        if (!finalReply) {
            finalReply = 'يا هلا بيك! منورنا والله، قولي إزاي أقدر أساعدك أكتر في نظام كوادر اليوم؟';
        }

        // F. Save AI response to Supabase
        await supabase.from('ai_messages').insert({
            conversation_id: conversation.id,
            sender_type: 'ai',
            message_text: finalReply,
            tokens_used: tokensUsed
        });

        // G. Send reply via WhatsApp with realistic human typing animation
        await deliverFinalReply(finalReply);

    } catch (err) {
        console.error('❌ [AI Orchestrator] Critical error processing message:', err);
        if (typingInterval) clearInterval(typingInterval);
        if (chat && typeof chat.clearState === 'function') await chat.clearState().catch(() => {});
    }
}

module.exports = {
    handleIncomingWhatsAppMessage
};
