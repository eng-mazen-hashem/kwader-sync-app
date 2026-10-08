

/**
 * 🔍 Smart Semantic Retriever (Vector-less RAG)
 * Uses ultra-fast Llama-3 to match user intent with Knowledge Base questions,
 * without relying on exact keywords and without wasting tokens on full file processing.
 */
async function smartRetrieveKB(text, kbList, groqApiKey, signal) {
    if (!kbList || kbList.length === 0 || !groqApiKey) return [];
    
    // Fallback if list is too large (cap at 150 items to save prompt tokens)
    const limitedKbList = kbList.slice(0, 150);

    const prompt = `أنت مساعد استرجاع ذكي (Semantic Retriever).
رسالة العميل: "${text}"

فيما يلي قائمة بالمواضيع المتاحة في قاعدة المعرفة:
${limitedKbList.map((k, i) => `[${i}] ${k.question_trigger}`).join('\n')}

هل يوجد أي موضوع من القائمة السابقة يجيب أو يرتبط بسؤال العميل؟ (حتى لو اختلفت الصياغة، ابحث عن المعنى).
أرجع فقط مصفوفة JSON تحتوي على الأرقام المطابقة (IDs). إذا لم تجد، أرجع مصفوفة فارغة.
الرد بصيغة JSON فقط بهذا الشكل:
{"matches": [0, 5]}`;

    try {
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${groqApiKey}`, 'Content-Type': 'application/json' },
            signal: signal,
            body: JSON.stringify({
                model: 'llama-3.1-8b-instant',
                messages: [
                    { role: 'system', content: prompt }
                ],
                max_tokens: 50,
                temperature: 0,
                response_format: { type: 'json_object' }
            })
        });

        if (res.ok) {
            const data = await res.json();
            const result = JSON.parse(data.choices[0].message.content);
            if (result && Array.isArray(result.matches)) {
                return result.matches.map(index => limitedKbList[index]).filter(Boolean);
            }
        }
    } catch (e) {
        console.warn('[Smart Retriever] Failed, falling back to keyword matching...', e.message);
    }
    
    // Fallback: Exact keyword match if LLM fails
    const lowerText = text.trim().toLowerCase();
    return kbList.filter(item => {
        const triggerMatch = item.question_trigger && lowerText.includes(item.question_trigger.toLowerCase());
        const keywordMatch = Array.isArray(item.keywords) && item.keywords.some(k => k && lowerText.includes(k.toLowerCase()));
        return triggerMatch || keywordMatch;
    });
}

/**
 * 🧠 Mixture of Experts (MoE) Router
 * Routes generic/frequent questions to a blazing fast, cheap 8B model.
 * If the question is complex (objections, deep sales), routes it to the heavy model.
 * Saves ~90% of tokens for standard greetings and simple FAQs.
 */
async function moeRouter(text, history, kbList, groqApiKey, signal) {
    if (!groqApiKey) return { action: 'ROUTE_TO_HEAVY', reply: null };

    // 1. Build a prompt for the router (Llama 3 8B)
    const routerPrompt = `أنت مُوجّه طلبات ذكي (AI Router). 
اقرأ رسالة العميل وحدد إذا كانت:
1. "greeting" (تحية أو شكر)
2. "simple_faq" (سؤال بسيط إجابته موجودة بدقة في قاعدة المعرفة المرفقة)
3. "complex_sales" (اعتراض، تفاوض، طلب معقد، أو سؤال غير موجود بالمعرفة)

قاعدة المعرفة المتاحة:
${kbList.map(k => `- ${k.question_trigger}: ${k.answer_content}`).join('\n')}

إذا كان greeting أو simple_faq، اكتب الرد المناسب بالعامية المصرية الودودة.
إذا كان complex_sales، اكتب فقط عبارة: ROUTE_TO_HEAVY.

الرد بصيغة JSON فقط:
{"intent": "نوع_الطلب", "reply": "الرد_أو_العبارة"}`;

    try {
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${groqApiKey}`, 'Content-Type': 'application/json' },
            signal: signal,
            body: JSON.stringify({
                model: 'llama-3.1-8b-instant',
                messages: [
                    { role: 'system', content: routerPrompt },
                    { role: 'user', content: `رسالة العميل: ${text}` }
                ],
                max_tokens: 150,
                temperature: 0.1,
                response_format: { type: 'json_object' }
            })
        });

        if (res.ok) {
            const data = await res.json();
            const result = JSON.parse(data.choices[0].message.content);
            
            if (result.intent === 'complex_sales' || result.reply === 'ROUTE_TO_HEAVY') {
                return { action: 'ROUTE_TO_HEAVY', reply: null };
            }
            
            return { action: 'REPLY_DIRECTLY', reply: result.reply, tokensUsed: data.usage.total_tokens };
        }
    } catch (e) {
        console.warn('[MoE Router] Failed, routing to heavy model...', e.message);
    }
    
    return { action: 'ROUTE_TO_HEAVY', reply: null };
}

/**
 * 📚 Contextual Compression (RAG Optimizer)
 * Trims down the retrieved knowledge base to only the EXACT relevant sentences.
 */
async function compressContext(text, kbList, groqApiKey, signal) {
    if (!kbList || kbList.length === 0 || !groqApiKey) return '';
    
    const rawKb = kbList.map(k => k.answer_content).join('\n\n');
    
    // If it's small enough, no need to compress
    if (rawKb.length < 300) return `\n\n📚 معلومات من قاعدة المعرفة:\n${rawKb}`;

    try {
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${groqApiKey}`, 'Content-Type': 'application/json' },
            signal: signal,
            body: JSON.stringify({
                model: 'llama-3.1-8b-instant',
                messages: [
                    { role: 'system', content: 'أنت مساعد لاستخراج المعلومات. اقرأ المستند التالي واستخرج فقط الجمل التي تجيب على سؤال العميل. لا تضف أي كلام من عندك. إذا لم تكن الإجابة موجودة، اكتب "لا يوجد".' },
                    { role: 'user', content: `المستند:\n${rawKb}\n\nسؤال العميل: ${text}` }
                ],
                max_tokens: 200,
                temperature: 0
            })
        });

        if (res.ok) {
            const data = await res.json();
            const compressed = data.choices[0].message.content.trim();
            if (compressed !== 'لا يوجد' && compressed.length > 5) {
                return `\n\n📚 معلومات مركزة من قاعدة المعرفة:\n${compressed}`;
            }
            return '';
        }
    } catch (e) {
        // Fallback to full text if compression fails
        return `\n\n📚 معلومات من قاعدة المعرفة:\n${rawKb.substring(0, 500)}`;
    }
}

module.exports = {
    smartRetrieveKB,
    moeRouter,
    compressContext
};
