/**
 * =========================================================================
 * KWADER AI Engine - Autonomous Cumulative Knowledge Harvester
 * =========================================================================
 * Continuously learns new verified Q&A pairs from human agent interventions
 * and high-confidence AI solutions, persisting them to Supabase `ai_knowledge_base`
 * so future occurrences are answered instantly with 0 tokens.
 */

const { setCachedResponse, normalizeArabic, stripArabicPrefixes } = require('./faqCache');

// Common Arabic stop words to exclude from keyword tagging
const STOP_WORDS = new Set([
    'في', 'من', 'على', 'إلى', 'عن', 'مع', 'هذا', 'هذه', 'تم', 'كان', 'كانت',
    'التي', 'الذي', 'الذين', 'هو', 'هي', 'أن', 'ان', 'هل', 'كيف', 'ماذا', 'لماذا',
    'لو', 'يا', 'لا', 'نعم', 'غير', 'كل', 'بعد', 'قبل', 'حتى', 'إذا', 'اذا',
    'اريد', 'عايز', 'ممكن', 'لو_سمحت', 'من_فضلك', 'ياريت', 'يتم', 'عبر', 'خلال',
    'نحو', 'حول', 'ذلك', 'تلك', 'بشكل', 'طريقة', 'كيفية', 'اي', 'اية'
]);

/**
 * Extract 3 to 8 high-value search keywords from text
 * @param {string} text 
 * @returns {Array<string>}
 */
function extractKeywords(text) {
    if (!text || typeof text !== 'string') return [];
    const normalized = normalizeArabic(text);
    const words = normalized
        .split(/\s+/)
        .map(w => w.trim())
        .map(w => stripArabicPrefixes(w))
        .filter(w => w.length >= 3 && !STOP_WORDS.has(w));

    // Deduplicate and take top 8 most informative words
    const unique = [...new Set(words)];
    return unique.slice(0, 8);
}

/**
 * Harvest and learn a new Q&A pair from a human agent response
 * @param {Object} supabase - Supabase client
 * @param {string} conversationId - The active conversation ID
 * @param {string} humanReplyText - The text sent by the human agent
 * @param {string|null} [companyId] - Company ID
 * @returns {Promise<{learned: boolean, question?: string, reason?: string}>}
 */
async function learnFromHumanInteraction(supabase, conversationId, humanReplyText, companyId = null) {
    if (!supabase || !conversationId || !humanReplyText) {
        return { learned: false, reason: 'Missing required parameters' };
    }

    const cleanReply = humanReplyText.trim();
    // Only learn meaningful, substantive replies (> 20 chars, not just "شكرا" or "لحظة")
    if (cleanReply.length < 20) {
        return { learned: false, reason: 'Reply too brief for knowledge harvesting' };
    }

    try {
        // 1. Fetch the last user question in this conversation
        const { data: lastUserMsg, error } = await supabase
            .from('ai_messages')
            .select('message_text')
            .eq('conversation_id', conversationId)
            .eq('sender_type', 'user')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (error || !lastUserMsg || !lastUserMsg.message_text) {
            return { learned: false, reason: 'No preceding user question found' };
        }

        const rawQuestion = lastUserMsg.message_text.trim();
        if (rawQuestion.length < 8) {
            return { learned: false, reason: 'Question too short to form a reliable rule' };
        }

        const keywords = extractKeywords(rawQuestion);
        if (keywords.length === 0) {
            return { learned: false, reason: 'No significant keywords extracted' };
        }

        // 2. Check if a very similar knowledge item already exists to avoid duplication
        const { data: existing } = await supabase
            .from('ai_knowledge_base')
            .select('id, question_trigger, keywords')
            .ilike('question_trigger', `%${keywords.slice(0, 2).join('%')}%`)
            .limit(1);

        if (existing && existing.length > 0) {
            // Update the existing answer with the fresher human-verified response
            await supabase
                .from('ai_knowledge_base')
                .update({
                    answer_content: cleanReply,
                    keywords: [...new Set([...(existing[0].keywords || []), ...keywords])],
                    updated_at: new Date().toISOString()
                })
                .eq('id', existing[0].id);

            // Update in-memory cache
            setCachedResponse(rawQuestion, cleanReply);
            console.log(`🧠 [AutoLearner] Updated existing knowledge item: "${existing[0].question_trigger}"`);
            return { learned: true, question: rawQuestion, updatedExisting: true };
        }

        // 3. Persist new learned knowledge item to Supabase
        const { data: newKnowledge, error: insertErr } = await supabase
            .from('ai_knowledge_base')
            .insert({
                company_id: companyId || null,
                category: 'auto_learned',
                question_trigger: rawQuestion,
                answer_content: cleanReply,
                keywords: keywords,
                is_active: true
            })
            .select('id')
            .single();

        if (insertErr) {
            console.warn('⚠️ [AutoLearner] Error inserting learned knowledge:', insertErr.message);
            return { learned: false, reason: insertErr.message };
        }

        // 4. Prime the in-memory cache immediately for 0-token future replies
        setCachedResponse(rawQuestion, cleanReply);
        console.log(`🌟 [AutoLearner] Successfully harvested new knowledge item [${newKnowledge?.id}]: "${rawQuestion}" -> "${cleanReply.slice(0, 40)}..."`);

        return {
            learned: true,
            id: newKnowledge?.id,
            question: rawQuestion
        };

    } catch (err) {
        console.warn('⚠️ [AutoLearner] Exception during learning:', err.message);
        return { learned: false, reason: err.message };
    }
}

/**
 * Autonomously learn from verified AI diagnostic or procedural responses
 * @param {string} userQuestion 
 * @param {string} aiResponse 
 */
function learnFromAiInteraction(userQuestion, aiResponse) {
    if (!userQuestion || !aiResponse) return;
    const cleanQ = userQuestion.trim();
    const cleanA = aiResponse.trim();

    // Cache responses that are explanatory or informative (between 40 and 400 chars)
    if (cleanQ.length >= 10 && cleanA.length >= 40 && cleanA.length <= 400) {
        // Do not cache personalized or transient data
        if (!/(سيريالك|رصيدك|جهازك|كود التحقق|OTP)/i.test(cleanA)) {
            setCachedResponse(cleanQ, cleanA);
        }
    }
}

module.exports = {
    learnFromHumanInteraction,
    learnFromAiInteraction,
    extractKeywords
};
