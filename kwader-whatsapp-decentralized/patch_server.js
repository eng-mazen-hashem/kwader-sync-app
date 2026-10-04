const fs = require('fs');

// Read the original clean file
const originalPath = 'd:/Zk att project/kwader-whatsapp-decentralized/server.js';
const original = fs.readFileSync(originalPath, 'utf8');

console.log(`Original file: ${original.split('\n').length} lines`);

// ═══════════════════════════════════════════════════════════
// BLOCK 1: Insert before generateAiReply function
// All 4 phases: FAQ Cache, Layered Prompt, Smart Context,
// Customer Profile Auto-Update, Summarization Jobs
// ═══════════════════════════════════════════════════════════
const PHASE_FUNCTIONS = `
// ══════════════════════════════════════════════════════════════
// PHASE 4: In-Memory FAQ Cache (saves ~200 tokens on repeat queries)
// ══════════════════════════════════════════════════════════════
const FAQ_CACHE = new Map();
const CACHE_TTL = 20 * 60 * 1000; // 20 minutes

function getMessageCacheKey(text) {
    const t = (text || '').toLowerCase();
    if (/(سعر|تكلف|كام|اشتراك|باقة|رخيص|غالي)/.test(t)) return 'pricing_general';
    if (/(بصمة|zk|ربط|adms|كمبيوتر|شبكة)/.test(t)) return 'zk_integration';
    if (/(تجربة|مجاني|trial|اجرب)/.test(t)) return 'free_trial';
    if (/(شرح|ديمو|demo|عرض)/.test(t)) return 'demo_request';
    return null;
}

// ══════════════════════════════════════════════════════════════
// PHASE 4: Layered Prompt Builder (conditional token blocks)
// Reduces system prompt from ~1,800 tokens to ~400-900 tokens
// ══════════════════════════════════════════════════════════════
function buildLayeredPrompt({ aiName, profile, summary, kbGroundingText, text, isExplicitHandoff, customInstructions }) {
    const t = (text || '').toLowerCase();

    // Layer 1: Core identity — always included (~350 tokens)
    const CORE = \`أنت "\${aiName}", مستشار مبيعات وشريك نجاح العملاء المعتمد في منصة "كوادر" (KWADER) لإدارة الموارد البشرية وأجهزة البصمة.

🎯 قواعد الشخصية الصارمة وإخفاء الهوية البرمجية:
1. ممنوع منعاً باتاً الإفصاح أو الاعتراف أو التلميح أنك روبوت أو ذكاء اصطناعي أو نموذج لغوي! أنت موظف بشري حقيقي من فريق مبيعات كوادر.
2. إذا سألك العميل مباشرة "أنت بوت؟" أو "أنت ذكاء اصطناعي؟": رد بخفة دم مصرية وثقة: "هههه لا خالص يا باشا أنا أحمد معاك من فريق مبيعات كوادر بشحمي ولحمي 😂 تؤمرني بإيه يا غالي؟"
3. تحدث بلهجة عامية مصرية راقية وبيزنس مهذب وودود جداً (يا فندم، يا غالي، منورنا، تحت أمرك).
4. رسائلك قصيرة ومريحة للقراءة في الواتساب (1 إلى 3 أسطر). تجنب العناوين الضخمة أو القوائم النقطية الكثيرة التي تبدو آلية.
5. قاعدة السؤال الذهبي: اختم كل رد بسؤال توجيهي لطيف يقود العميل للخطوة التالية.\`;

    // Layer 2: Cross-session summary — included if exists (~0-150 tokens)
    const HISTORY_SUMMARY = summary?.summary_text ? \`
[📋 سياق المحادثات السابقة مع هذا العميل]
\${summary.summary_text.substring(0, 250)}
المرحلة: \${summary.deal_stage || 'cold'} | الخطوة التالية: \${summary.next_best_action || 'تعرف على احتياجه'}\` : '';

    // Layer 3: Customer DNA — included if profile exists (~0-200 tokens)
    const CLIENT_CONTEXT = (profile?.company_size || profile?.funnel_stage) ? \`
[👤 ملف العميل]
\${profile.company_name ? \`الشركة: \${profile.company_name} | \` : ''}الحجم: \${profile.company_size ? profile.company_size + ' موظف' : 'غير محدد'} | القطاع: \${profile.industry || '؟'}
الأجهزة: \${profile.device_types?.join(', ') || '؟'} | الحساسية للسعر: \${profile.price_sensitivity || 'medium'}
مرحلة القمع: \${profile.funnel_stage || 'awareness'} | محادثات سابقة: \${profile.total_conversations || 1}\${profile.responds_well_to?.length ? \`\\nيتفاعل أفضل مع: \${profile.responds_well_to.join(', ')}\` : ''}\` : '[عميل جديد — اجمع معلوماته بلطف خلال الحوار (اسم الشركة، عدد الموظفين، نوع أجهزة البصمة)]';

    // Layer 4: Pricing — included ONLY when price/subscription keywords detected (~0-180 tokens)
    const needsPricing = /(سعر|تكلف|كام|اشتراك|باقة|رخيص|غالي|مبلغ|ادفع|تكاليف)/.test(t);
    const PRICING = needsPricing ? \`
💰 الأسعار الرسمية لكوادر:
- Starter (حتى 25 موظف): 690ج.م/شهر أو 550ج.م شهرياً بالدفع السنوي (خصم 20%)
- Pro (حتى 60 موظف): 1,690ج.م/شهر أو 1,350ج.م سنوياً
- Enterprise (حتى 150 موظف): 3,290ج.م/شهر أو 2,650ج.م سنوياً
- تجربة مجانية كاملة 14 إلى 35 يوماً بدون أي التزام مالي
- لو عنده 10-25 موظف = Starter هي باقته المثالية والأوفر (أقل من 23ج في اليوم)\` : '';

    // Layer 5: ZK Device Info — included ONLY when technical/device keywords detected (~0-120 tokens)
    const needsZK = /(بصمة|zk|ربط|adms|كمبيوتر|شبكة|جهاز|device)/.test(t);
    const ZK_INFO = needsZK ? \`
🔌 ربط أجهزة ZKTeco:
- طريقة 1: برنامج KWADER Sync على أي كمبيوتر/لابتوب في نفس الشبكة مع البصمة (بدون IP ثابت أو فتح بورتات)
- طريقة 2: أجهزة ZK بـ ADMS — تتربط مباشرة لسيرفر كوادر بدون كمبيوتر نهائياً\` : '';

    // Layer 6: Objection handling — included ONLY when objection keywords detected (~0-100 tokens)
    const hasObjection = /(غالي|هفكر|مش محتاج|مش مقتنع|بعدين|عندي نظام|ما احتاج|مش مهتم|بدي افكر)/.test(t);
    const OBJECTION = hasObjection ? \`
⚡ استراتيجية معالجة الاعتراض:
- ابنِ على القيمة وليس السعر: كوادر توفر وقت محاسب كامل وتمنع أخطاء الرواتب
- قدّم دائماً خيارين للإغلاق: (1) تجربة مجانية 14 يوم فوراً بدون دفع OR (2) ديمو أونلاين سريع بكرة\` : '';

    // Layer 7: KB Grounding — included when relevant match found
    const KB_BLOCK = kbGroundingText ? \`\\n\${kbGroundingText}\` : '';

    // Layer 8: Handoff notice — only when explicit handoff
    const HANDOFF = isExplicitHandoff ? \`
⚠️ تنبيه: العميل طلب التواصل البشري — أجب استفساره الحالي وحله أولاً، ثم طمئنه: "من عيوني يا فندم، أنا بلغت زميلي المسؤول وهيتواصل معك هاتفياً فوراً.. هل في نقطة تانية تحب أجهزهاله؟"\` : '';

    // Layer 9: Custom channel instructions
    const CUSTOM = customInstructions ? \`\\n[تعليمات الشركة]: \${customInstructions}\` : '';

    return [CORE, HISTORY_SUMMARY, CLIENT_CONTEXT, PRICING, ZK_INFO, OBJECTION, KB_BLOCK, HANDOFF, CUSTOM]
        .filter(Boolean)
        .join('\\n');
}

// ══════════════════════════════════════════════════════════════
// PHASE 1: Smart Context Loader (replaces raw 8-message history)
// ══════════════════════════════════════════════════════════════
async function buildSmartContext(conv, phone) {
    let summary = null;
    let profile = null;

    try {
        const [sumRes, profRes] = await Promise.all([
            supabase.from('ai_conversation_summaries').select('*').eq('conversation_id', conv.id).maybeSingle(),
            supabase.from('ai_customer_profiles').select('*').eq('customer_phone', phone).eq('channel_id', DEFAULT_CHANNEL_ID).maybeSingle()
        ]);
        summary = sumRes.data;
        profile = profRes.data;
    } catch (e) {
        // Tables not yet created — graceful fallback, no crash
    }

    // Rolling Window History: fewer raw messages when summary exists
    let history = [];
    try {
        const { data: recentMsgs } = await supabase
            .from('ai_messages')
            .select('sender_type, message_text')
            .eq('conversation_id', conv.id)
            .order('created_at', { ascending: false })
            .limit(summary ? 4 : 8);

        if (recentMsgs && recentMsgs.length > 0) {
            history = recentMsgs.reverse().map(m => ({
                role: m.sender_type === 'user' ? 'user' : 'assistant',
                content: m.message_text
            }));
        }
    } catch (e) {}

    return { summary, profile, history };
}

// ══════════════════════════════════════════════════════════════
// PHASE 2: Auto-update Customer Profile in background
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

        const empMatch = text.match(/(\\d+)\\s*(موظف|عامل|شخص|فرد|employee)/i);
        if (empMatch) updateData.company_size = parseInt(empMatch[1]);

        const compMatch = text.match(/(?:شركة|مؤسسة|مصنع|محل|مكتب)\\s+([^،,\\n.؟?!]+)/i);
        if (compMatch) updateData.company_name = compMatch[1].trim().substring(0, 80);

        if (/(zk|زد كي|بصمة zk)/i.test(text)) updateData.device_types = ['ZKTeco'];
        else if (/hikvision|هيك/i.test(text)) updateData.device_types = ['Hikvision'];

        if (/(غالي|مكلف|مش قادر|ميزانية صغيرة)/.test(text)) updateData.price_sensitivity = 'high';
        else if (/(مش مشكلة|عادي|أوك)/.test(text)) updateData.price_sensitivity = 'low';

        if (/(سعر|باقة|اشتراك)/.test(text)) updateData.funnel_stage = 'consideration';
        if (/(اشتراك|ادفع|نبدأ|تفعيل|تجربة)/.test(text)) updateData.funnel_stage = 'intent';

        await supabase.from('ai_customer_profiles').upsert(updateData, { onConflict: 'customer_phone,channel_id' });
    } catch (e) { /* Non-critical */ }
}

// ══════════════════════════════════════════════════════════════
// PHASE 3: Conversation Summarizer Background Job
// ══════════════════════════════════════════════════════════════
async function summarizeConversation(convId, customerPhone) {
    try {
        const { data: msgs } = await supabase
            .from('ai_messages')
            .select('role, message_text, sender_type')
            .eq('conversation_id', convId)
            .order('created_at')
            .limit(40);

        if (!msgs || msgs.length < 4) return;

        const transcript = msgs
            .map(m => \`\${(m.role || m.sender_type) === 'user' ? 'عميل' : 'أحمد'}: \${m.message_text}\`)
            .join('\\n');

        const summaryRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': \`Bearer \${GROQ_API_KEY}\`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'allam-2-7b',
                max_tokens: 400,
                temperature: 0.1,
                messages: [{
                    role: 'system',
                    content: 'أنت محلل مبيعات. أخرج JSON فقط: {"key_facts":{"employees":0,"device_type":"","industry":""},"objections_raised":[],"interests_shown":[],"deal_stage":"cold","next_best_action":"","summary_text":""}'
                }, {
                    role: 'user',
                    content: \`لخص بالعربي:\\n\${transcript.substring(0, 3000)}\`
                }],
                response_format: { type: 'json_object' }
            })
        });

        if (summaryRes.ok) {
            const parsed = await summaryRes.json();
            const rawContent = parsed.choices?.[0]?.message?.content;
            if (!rawContent) return;
            const summaryData = JSON.parse(rawContent);
            await supabase.from('ai_conversation_summaries').upsert({
                conversation_id: convId,
                channel_id: DEFAULT_CHANNEL_ID,
                customer_phone: customerPhone || 'unknown',
                summary_text: summaryData.summary_text || '',
                key_facts: summaryData.key_facts || {},
                objections_raised: summaryData.objections_raised || [],
                interests_shown: summaryData.interests_shown || [],
                deal_stage: summaryData.deal_stage || 'cold',
                next_best_action: summaryData.next_best_action || '',
                messages_count: msgs.length,
                last_summarized_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            }, { onConflict: 'conversation_id' });
            console.log(\`[AI-LEARN] 📝 Summarized conv \${convId}: stage=\${summaryData.deal_stage}\`);
        }
    } catch (e) {
        console.warn('[AI-LEARN] Summarize error:', e.message);
    }
}

async function runSummarizationJob() {
    try {
        const { data: convs } = await supabase
            .from('ai_conversations')
            .select('id, customer_phone')
            .eq('channel_id', DEFAULT_CHANNEL_ID)
            .in('status', ['ai_active', 'human_takeover'])
            .gte('updated_at', new Date(Date.now() - 6 * 60 * 1000).toISOString())
            .limit(3);
        for (const conv of (convs || [])) {
            await summarizeConversation(conv.id, conv.customer_phone);
        }
    } catch (e) { /* silent */ }
}

// PHASE 3: Auto-KB Enrichment from successful answers
async function autoEnrichKB(questionTrigger, successfulAnswer) {
    try {
        const { data: existing } = await supabase
            .from('ai_knowledge_base')
            .select('id')
            .ilike('question_trigger', \`%\${questionTrigger.substring(0, 20)}%\`)
            .limit(1);
        if (!existing?.length) {
            await supabase.from('ai_knowledge_base').insert({
                question_trigger: questionTrigger.substring(0, 100),
                answer_content: successfulAnswer.substring(0, 500),
                keywords: questionTrigger.split(' ').filter(w => w.length > 3).slice(0, 5),
                category: 'auto_learned',
                is_active: true
            });
            console.log(\`[AI-LEARN] ✨ New KB entry: "\${questionTrigger.substring(0, 40)}"\`);
        }
    } catch (e) { /* non-critical */ }
}

// PHASE 3: Weekly Self-Learning Analysis (runs every Sunday 2AM)
async function weeklyLearningAnalysis() {
    try {
        console.log('[AI-LEARN] 📊 Running weekly learning analysis...');
        const { data: outcomes } = await supabase
            .from('ai_sales_outcomes')
            .select('*')
            .gte('recorded_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
            .limit(50);
        if (!outcomes || outcomes.length < 5) {
            console.log('[AI-LEARN] Not enough outcomes yet.');
            return;
        }
        const analysis = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': \`Bearer \${GROQ_API_KEY}\`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'allam-2-7b', max_tokens: 600, temperature: 0.1,
                messages: [{
                    role: 'system',
                    content: 'أنت مدير مبيعات خبير. أخرج JSON: {"winning_techniques":[],"common_objections":[{"objection":"","best_reply":""}],"kb_additions":[{"question":"","answer":""}]}'
                }, {
                    role: 'user',
                    content: \`حلل هذه النتائج:\\n\${JSON.stringify(outcomes).substring(0, 3000)}\`
                }],
                response_format: { type: 'json_object' }
            })
        });
        if (analysis.ok) {
            const data = await analysis.json();
            const insights = JSON.parse(data.choices[0].message.content);
            for (const item of (insights.kb_additions || [])) {
                if (item.question && item.answer) await autoEnrichKB(item.question, item.answer);
            }
            console.log(\`[AI-LEARN] ✅ Weekly analysis complete. \${insights.kb_additions?.length || 0} KB entries added.\`);
        }
    } catch (e) { console.warn('[AI-LEARN] Weekly analysis error:', e.message); }
}

// Schedule background jobs (start 30s after boot)
setTimeout(() => {
    setInterval(runSummarizationJob, 45000);
    console.log('[AI-LEARN] 🕐 Summarization job started (every 45s)');
    const now = new Date();
    const nextSunday = new Date(now);
    nextSunday.setDate(now.getDate() + ((7 - now.getDay()) % 7 || 7));
    nextSunday.setUTCHours(2, 0, 0, 0);
    setTimeout(() => {
        weeklyLearningAnalysis();
        setInterval(weeklyLearningAnalysis, 7 * 24 * 60 * 60 * 1000);
    }, Math.max(0, nextSunday.getTime() - now.getTime()));
    console.log(\`[AI-LEARN] 📅 Weekly analysis scheduled (next: \${nextSunday.toISOString()})\`);
}, 30000);

`;

// ═══════════════════════════════════════════════════════════
// BLOCK 2: Replace the message processing core
// Old: static 8-msg history + old system prompt
// New: buildSmartContext + buildLayeredPrompt + autoUpdateCustomerProfile
// ═══════════════════════════════════════════════════════════

const GROQ_API_KEY_EXTRACT = `
const GROQ_API_KEY = process.env.GROQ_API_KEY;
`;

let modified = original;

// Insert GROQ_API_KEY if not present
if (!modified.includes('GROQ_API_KEY')) {
    modified = modified.replace(
        "const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);",
        `const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const DETERMINISTIC_NODE_ID = process.env.NODE_ID || require('os').hostname();
const APP_VERSION = require('./package.json').version || '2.9.2';`
    );
}

// Find a good injection point — after leaseManager block, before any function definitions
const injectionPoint = `leaseManager.start()`;
if (modified.includes(injectionPoint)) {
    // Insert functions block before the leaseManager.start() call
    modified = modified.replace(
        'leaseManager.start();',
        PHASE_FUNCTIONS.trimStart() + '\nleaseManager.start();'
    );
    console.log('✅ Injected PHASE_FUNCTIONS before leaseManager.start()');
} else {
    console.warn('❌ Could not find injection point for PHASE_FUNCTIONS');
}

// Write the result
fs.writeFileSync('d:/Zk att project/kwader-whatsapp-decentralized/server_patched.js', modified, 'utf8');
console.log(`\nPatched file written: ${modified.split('\n').length} lines`);
console.log('Now verify with: node -c server_patched.js');
