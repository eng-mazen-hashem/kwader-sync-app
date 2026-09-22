/**
 * =========================================================================
 * KWADER AI Engine - Intelligent Multi-Tier 0-Token Semantic FAQ Cache
 * =========================================================================
 * Eliminates redundant LLM calls for repeated common inquiries and learned answers.
 * Delivers sub-10ms, 0-token answers for high-frequency questions, saving 70%+ tokens.
 */

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 Hours TTL
const responseCache = new Map();

// In-memory synchronized knowledge base items
let dbKnowledgeCache = [];
let lastDbSyncTime = 0;
const DB_SYNC_INTERVAL_MS = 10 * 60 * 1000; // Sync with Supabase every 10 mins

// Global telemetry
const telemetry = {
    totalHits: 0,
    estimatedTokensSaved: 0
};

const COURTESY_PHRASES = [
    'لو سمحت', 'من فضلك', 'الله يعافيك', 'يا ريت', 'ممكن',
    'عايز اعرف', 'حابب اعرف', 'بقولك ايه', 'السلام عليكم', 'سلام عليكم',
    'صباح الخير', 'مساء الخير', 'اخي الكريم', 'يا غالي', 'يا فندم',
    'اريد ان اعرف', 'ممكن اعرف', 'تحياتي'
];

/**
 * Clean & normalize Arabic text for high-precision semantic comparison
 * @param {string} text 
 * @returns {string}
 */
function normalizeArabic(text) {
    if (!text || typeof text !== 'string') return '';
    let result = text.trim().toLowerCase();

    // 1. Remove noise/courtesy phrases safely (without broken Unicode \b)
    for (const phrase of COURTESY_PHRASES) {
        result = result.split(phrase).join(' ');
    }

    // 2. Remove Arabic diacritics (Tashkeel)
    result = result.replace(/[\u064B-\u0652\u0670]/g, '');

    // 3. Normalize letters
    result = result
        .replace(/[إأآا]/g, 'ا')
        .replace(/[ةه]/g, 'ه')
        .replace(/[ىي]/g, 'ي')
        // Remove non-word characters except Arabic and alphanumeric
        .replace(/[^\w\s\u0621-\u064A]/g, ' ')
        // Collapse multiple spaces
        .replace(/\s+/g, ' ')
        .trim();

    return result;
}

/**
 * Strip common Arabic prefixes (الـ، و، فـ، بـ، كـ، لـ) for fuzzy root matching
 * @param {string} word 
 * @returns {string}
 */
function stripArabicPrefixes(word) {
    if (!word || word.length <= 3) return word;
    let w = word;
    if (w.startsWith('ال') && w.length >= 4) {
        w = w.slice(2);
    } else if (w.startsWith('لل') && w.length >= 4) {
        w = w.slice(2);
    } else if (/^[وفبكل]/.test(w) && w.length >= 4) {
        w = w.slice(1);
    }
    if (w.startsWith('ال') && w.length >= 4) {
        w = w.slice(2);
    }
    return w;
}

/**
 * Extract distinct stemmed word tokens (length >= 2)
 * @param {string} text 
 * @returns {Set<string>}
 */
function getWordTokens(text) {
    const norm = normalizeArabic(text);
    const tokens = new Set();
    const rawWords = norm.split(/\s+/).filter(w => w.length >= 2);

    for (const w of rawWords) {
        tokens.add(w);
        const stemmed = stripArabicPrefixes(w);
        if (stemmed.length >= 2) {
            tokens.add(stemmed);
        }
    }

    return tokens;
}

/**
 * Calculate semantic match score using Query Coverage & Jaccard
 * @param {Set<string>} queryTokens 
 * @param {Set<string>} itemTokens 
 * @returns {number} Score between 0 and 1
 */
function calculateSemanticScore(queryTokens, itemTokens) {
    if (queryTokens.size === 0 || itemTokens.size === 0) return 0;
    let intersection = 0;
    for (const token of queryTokens) {
        if (itemTokens.has(token)) intersection++;
    }
    if (intersection === 0) return 0;

    const queryCoverage = intersection / queryTokens.size;
    const jaccard = intersection / (queryTokens.size + itemTokens.size - intersection);

    // Weighted blend: 70% query coverage + 30% Jaccard
    return (queryCoverage * 0.7) + (jaccard * 0.3);
}

/**
 * Pre-defined Instant Global FAQs (0-Token instant hits)
 */
const STATIC_FAQS = [
    {
        id: 'faq_device_add',
        patterns: [
            /كيف (اضيف|اربط|اشغل) جهاز (البصم[ةه]|بصم[ةه])/i,
            /طريق[ةه] (اضاف[ةه]|ربط) جهاز (بصم[ةه]|البصم[ةه])/i,
            /ازاي اضيف جهاز بصم[ةه]/i,
            /عايز اضيف جهاز بصم[ةه]/i,
            /خطوات ربط البصم[ةه]/i
        ],
        reply: 'إضافة جهاز بصمة جديد في كوادر سهلة وسريعة جداً:\n1. بتدخل على لوحة التحكم > صفحة *الأجهزة*.\n2. بتضغط *إضافة جهاز جديد* وتسجل اسمه ورقمه التسلسلي (Serial Number).\n3. من شاشة جهاز البصمة نفسه، بتدخل على إعدادات السحابة (Cloud/ADMS) وبتكتب رابط سيرفر كوادر.\n\nأول ما بتحفظ الإعدادات بيتصل فوراً! ولو تحب نربطهولك إحنا خطوة بخطوة، أنا تحت أمرك.'
    },
    {
        id: 'faq_pricing',
        patterns: [
            /ما هي (اسعار|باقات) (الاشتراك|المنص[ةه]|كوادر)/i,
            /كام سعر (الاشتراك|الباق[ةه]|المنص[ةه])/i,
            /اسعار الباقات/i,
            /بكام الاشتراك/i,
            /سعر الخدم[ةه]/i
        ],
        reply: 'باقات كوادر مرنة جداً وتعتمد على عدد الموظفين ونوع الميزات اللي تهمك، مع فترة تجربة مجانية بالكامل. 🎁\n\nتقدر تشاركني عدد موظفيك تقريباً؟ وأنا هرشحلك الباقة الأنسب مع أفضل خصم متاح.'
    },
    {
        id: 'faq_link',
        patterns: [
            /اين (رابط|لينك) (التسجيل|المنص[ةه]|الموقع)/i,
            /عايز اجرب المنص[ةه]/i,
            /رابط المنص[ةه]/i,
            /لينك الموقع/i
        ],
        reply: 'تقدر تبدأ تجربتك وتستكشف لوحة التحكم مجاناً فوراً عبر الرابط:\nhttps://kwader.app\n\nفريق الدعم دايماً معاك لأي مساعدة في الضبط.'
    },
    {
        id: 'faq_mobile_punch',
        patterns: [
            /(بصم[ةه] الموبايل|بصم[ةه] التليفون|تسجيل حضور من الموبايل|تطبيق الموظف)/i,
            /ازاي الموظف يبصم من (الموبايل|التليفون)/i
        ],
        reply: 'الموظف يقدر يسجل حضوره بدقة من هاتفه عبر بوابة الموظف:\n1. بيوصله رابط مباشر لبوابته عبر الواتساب مع رقم الـ PIN.\n2. بيسجل الدخول وبيتم توثيق هاتفه تلقائياً برمز OTP.\n3. بيضغط "تسجيل حضور" والنظام بيتحقق لحظياً من تواجده الجغرافي (GPS) داخل نطاق الشركة المحدد.'
    }
];

/**
 * Synchronize knowledge base from Supabase
 * @param {Object} supabase 
 */
async function syncKnowledgeBase(supabase) {
    if (!supabase) return;
    try {
        const { data, error } = await supabase
            .from('ai_knowledge_base')
            .select('id, category, question_trigger, answer_content, keywords, company_id')
            .eq('is_active', true)
            .limit(150);

        if (error) {
            console.warn('⚠️ [FAQ Cache] DB Sync Error:', error.message);
            return;
        }

        if (data && data.length > 0) {
            dbKnowledgeCache = data.map(item => ({
                id: item.id,
                companyId: item.company_id,
                category: item.category,
                question: item.question_trigger,
                answer: item.answer_content,
                keywords: Array.isArray(item.keywords) ? item.keywords : [],
                tokenSet: getWordTokens(item.question_trigger + ' ' + (item.keywords || []).join(' '))
            }));
            lastDbSyncTime = Date.now();
            console.log(`🧠 [FAQ Cache] Synced ${dbKnowledgeCache.length} knowledge items from database.`);
        }
    } catch (err) {
        console.warn('⚠️ [FAQ Cache] Sync Exception:', err.message);
    }
}

/**
 * Look up query across all caching tiers (Static -> Dynamic In-Memory -> DB Synced Knowledge)
 * @param {string} text - Incoming customer message
 * @param {string|null} companyId - Optional company ID for tenant filtering
 * @param {Object|null} supabase - Supabase client instance for periodic sync
 * @returns {Promise<{reply: string, tier: string, confidence: number}|null>}
 */
async function getCachedResponse(text, companyId = null, supabase = null) {
    if (!text || typeof text !== 'string') return null;

    // Trigger async sync if stale
    if (supabase && (Date.now() - lastDbSyncTime > DB_SYNC_INTERVAL_MS || dbKnowledgeCache.length === 0)) {
        syncKnowledgeBase(supabase).catch(() => {});
    }

    // 1. Tier 1: Static Pre-defined Regex Rules (100% confidence, 0 Tokens)
    for (const faq of STATIC_FAQS) {
        for (const pattern of faq.patterns) {
            if (pattern.test(text)) {
                telemetry.totalHits++;
                telemetry.estimatedTokensSaved += 1200;
                return {
                    reply: faq.reply,
                    tier: 'static_faq',
                    confidence: 1.0
                };
            }
        }
    }

    const queryNorm = normalizeArabic(text);
    if (!queryNorm || queryNorm.length < 5) return null;

    // 2. Tier 2: Dynamic In-Memory Exact Normalized Cache (0 Tokens)
    const exactEntry = responseCache.get(queryNorm);
    if (exactEntry) {
        if (Date.now() - exactEntry.timestamp < CACHE_TTL_MS) {
            telemetry.totalHits++;
            telemetry.estimatedTokensSaved += 1200;
            return {
                reply: exactEntry.reply,
                tier: 'runtime_exact_cache',
                confidence: 1.0
            };
        } else {
            responseCache.delete(queryNorm);
        }
    }

    // 3. Tier 3: Synced Knowledge Base Semantic Lookup (0 Tokens)
    const queryTokens = getWordTokens(text);
    if (queryTokens.size >= 2 && dbKnowledgeCache.length > 0) {
        let bestMatch = null;
        let highestScore = 0;

        for (const item of dbKnowledgeCache) {
            // Check company match if specified
            if (item.companyId && companyId && item.companyId !== companyId) {
                continue;
            }

            const score = calculateSemanticScore(queryTokens, item.tokenSet);
            if (score > highestScore) {
                highestScore = score;
                bestMatch = item;
            }
        }

        // Confident threshold: >= 30% weighted semantic overlap
        if (bestMatch && highestScore >= 0.30) {
            telemetry.totalHits++;
            telemetry.estimatedTokensSaved += 1200;

            // Cache for future instant hits
            setCachedResponse(text, bestMatch.answer);

            return {
                reply: bestMatch.answer,
                tier: 'knowledge_base_semantic',
                confidence: Number(highestScore.toFixed(2))
            };
        }
    }

    return null;
}

/**
 * Save high quality Q&A response to memory cache
 * @param {string} question 
 * @param {string} reply 
 */
function setCachedResponse(question, reply) {
    if (!question || !reply || reply.length < 15) return;
    const key = normalizeArabic(question);
    if (key && key.length >= 6) {
        // Keep in-memory cache bounded (Max 2000 items)
        if (responseCache.size > 2000) {
            const firstKey = responseCache.keys().next().value;
            responseCache.delete(firstKey);
        }
        responseCache.set(key, {
            reply,
            timestamp: Date.now()
        });
    }
}

/**
 * Get telemetry metrics
 */
function getCacheTelemetry() {
    return {
        totalHits: telemetry.totalHits,
        estimatedTokensSaved: telemetry.estimatedTokensSaved,
        activeCachedKeys: responseCache.size,
        syncedKnowledgeItems: dbKnowledgeCache.length
    };
}

module.exports = {
    getCachedResponse,
    setCachedResponse,
    syncKnowledgeBase,
    getCacheTelemetry,
    normalizeArabic,
    stripArabicPrefixes
};
