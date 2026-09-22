/**
 * ============================================================
 * KWADER AI Engine - Lightweight Knowledge Retriever
 * ============================================================
 * Queries Supabase `ai_knowledge_base` for relevant company/product FAQ
 * snippets to ground the AI model with accurate, non-hallucinated data
 * while keeping token consumption minimal (< 400 tokens).
 */

/**
 * Fetch top relevant knowledge snippets for the given customer query
 * @param {Object} supabase - The Supabase client instance
 * @param {string} queryText - Customer message
 * @param {string} [companyId] - Optional company ID for tenant-specific knowledge
 * @returns {Promise<string>} Formatted knowledge context
 */
async function retrieveKnowledge(supabase, queryText, companyId = null) {
    if (!supabase || !queryText) return '';

    try {
        let dbQuery = supabase
            .from('ai_knowledge_base')
            .select('category, question_trigger, answer_content, keywords')
            .eq('is_active', true);

        if (companyId) {
            dbQuery = dbQuery.or(`company_id.eq.${companyId},company_id.is.null`);
        } else {
            dbQuery = dbQuery.is('company_id', null);
        }

        const { data, error } = await dbQuery.limit(20);
        if (error || !data || data.length === 0) {
            return '';
        }

        // Score records by keyword overlap with queryText
        const queryWords = queryText.toLowerCase().split(/\s+/).filter(w => w.length > 2);
        
        const scoredItems = data.map(item => {
            let score = 0;
            const triggerLower = (item.question_trigger || '').toLowerCase();
            const answerLower = (item.answer_content || '').toLowerCase();
            const keywords = Array.isArray(item.keywords) ? item.keywords : [];

            for (const word of queryWords) {
                if (triggerLower.includes(word)) score += 3;
                if (keywords.some(k => k.toLowerCase().includes(word))) score += 4;
                if (answerLower.includes(word)) score += 1;
            }

            return { item, score };
        });

        // Filter and sort by highest score, take top 3 items
        const relevant = scoredItems
            .filter(entry => entry.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, 3)
            .map(entry => entry.item);

        if (relevant.length === 0) {
            // If no direct keyword match, return the company profile & core features
            const defaults = data.filter(d => ['company_profile', 'features', 'pricing'].includes(d.category)).slice(0, 3);
            return defaults.map(d => `• (${d.question_trigger}): ${d.answer_content}`).join('\n\n');
        }

        return relevant
            .map(d => `• (${d.question_trigger}): ${d.answer_content}`)
            .join('\n\n');

    } catch (err) {
        console.warn('⚠️ [KnowledgeRetriever] Error retrieving knowledge:', err.message);
        return '';
    }
}

module.exports = {
    retrieveKnowledge
};
