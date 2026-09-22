/**
 * ============================================================
 * KWADER AI Engine - Zero-Token Fast Intent Router
 * ============================================================
 * Filters common repetitive queries, greetings, and immediate
 * handoffs without calling the LLM API, saving 50%+ on tokens and latency.
 */

const DEFAULT_HANDOFF_KEYWORDS = [
    'تحدث مع موظف', 'اتكلم مع موظف', 'تحدث مع شخص', 'حولني لموظف', 'حولني لشخص', 'حولني لبشري',
    'اريد موظف', 'ابغى موظف', 'ابي موظف', 'موظف بشري', 'خدمة عملاء', 'خدمه عملاء', 'خدمة عملاء بشرية',
    'شخص حقيقي', 'انسان حقيقي', 'إنسان حقيقي', 'شخص بشري',
    'كلمني شخص', 'كلمني حد', 'خدمة العملاء', 'خدمه العملاء', 'الدعم البشري',
    'اريد التواصل مع شخص', 'ابغى اكلم موظف', 'شكوى رسمية',
    'human agent', 'speak to agent', 'speak to human', 'real person'
];

const { getCachedResponse } = require('./faqCache');

const GREETING_REGEX = /^(سلام( عليكم)?|السلام عليكم|مرحبا|مرحباً|أهلا|اهلا|أهلاً|هلا|صباح الخير|مساء الخير|hi|hello|hey)[\s.!؟]*$/i;
const REGISTRATION_LINK_REGEX = /((رابط|لينك)\s*(التسجيل|المنص[ةه]|التجرب[ةه]|الموقع))|((وين|فين|ارسل|ابعت|هات)\s*(رابط|لينك))|^(موقعكم|الموقع الإلكتروني)$/i;
const COURTESY_THANKS_REGEX = /^(شكرا|شكراً|تسلم|الف شكر|ألف شكر|مشكور|يعطيك العافية|جزاك الله خير|الله يسعدك|thx|thanks|thank you)[\s.!؟]*$/i;
const COURTESY_OK_REGEX = /^(تمام|اوك|أوك|ماشى|ماشي|حسنا|حسناً|ok|okay)[\s.!؟]*$/i;
const PRESENCE_PING_REGEX = /^([؟?.]+|الو|ألو|معايا[؟?]?|في حد هنا[؟?]?|سامعني[؟?]?|موجود[؟?]?|فينك[؟?]?)$/i;

/**
 * Route an incoming message text
 * @param {string} text - The raw customer message
 * @param {Object} channel - The whatsapp_channel config
 * @returns {{ type: 'HANDOFF' | 'DIRECT_REPLY' | 'PASS_TO_AI', reply?: string, reason?: string }}
 */
function routeIntent(text, channel = {}) {
    if (!text || typeof text !== 'string') {
        return { type: 'PASS_TO_AI' };
    }

    const cleanText = text.trim().toLowerCase();

    // 0. High-Priority Guard: Serial numbers and technical database queries ALWAYS go to AI
    const hasSerialOrUuid = /\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b/.test(text) ||
        /(?:سيريال|سريال|ترخيص|كود الشركة|license|serial|قاعدة البيانات|داتابيز|database)/i.test(text);
    if (hasSerialOrUuid) {
        return { type: 'PASS_TO_AI' };
    }

    // 1. Check Zero-Token FAQ Cache first (Instant sub-10ms response)
    const cachedFaq = getCachedResponse(text);
    if (cachedFaq) {
        return {
            type: 'DIRECT_REPLY',
            reply: cachedFaq
        };
    }

    // 2. Check Courtesies (Gratitude / Acknowledgments)
    if (COURTESY_THANKS_REGEX.test(cleanText)) {
        return {
            type: 'DIRECT_REPLY',
            reply: 'العفو يا غالي! تحت أمرك في أي وقت، ودايماً سعداء بخدمتك. لو احتجت أي مساعدة إضافية في المنصة أو أجهزة البصمة أنا معاك. 🌸'
        };
    }
    if (COURTESY_OK_REGEX.test(cleanText)) {
        return {
            type: 'DIRECT_REPLY',
            reply: 'على خير وتوفيق بإذن الله! أنا في خدمتك دايماً لو حبيت تستفسر عن أي شيء في أي وقت. 🚀'
        };
    }

    // 3. Check Presence / Ping queries ("؟", "؟؟", "معايا؟", "ألو")
    if (PRESENCE_PING_REGEX.test(cleanText)) {
        return {
            type: 'DIRECT_REPLY',
            reply: 'معاك يا غالي وسامعك تمام، اتفضل قول لي أقدر أساعدك في إيه؟ 😊'
        };
    }

    const handoffKeywords = Array.isArray(channel.ai_auto_handoff_keywords) && channel.ai_auto_handoff_keywords.length > 0
        ? channel.ai_auto_handoff_keywords
        : DEFAULT_HANDOFF_KEYWORDS;

    // 3. Check for explicit Human Handoff request (with safety guard for employee count & HR terms)
    const isDomainOrCount = /(\d+\s*(موظف|عامل|شخص|فرد|نفر)|عدد\s*(ال)?موظف|موارد\s*بشر|تطبيق\s*الموظف|رواتب\s*الموظف)/i.test(cleanText);
    if (!isDomainOrCount) {
        for (const kw of handoffKeywords) {
            if (cleanText.includes(kw.toLowerCase())) {
                return {
                    type: 'HANDOFF',
                    reason: `Customer requested human agent: "${kw}"`,
                    reply: 'تم تحويل محادثتك الآن إلى أحد مسؤولي خدمة العملاء وسيتواصل معك خلال لحظات. نشكر تفهمك! 🙏'
                };
            }
        }
    }

    // 4. Check for simple greeting (0 Tokens saved)
    if (GREETING_REGEX.test(cleanText)) {
        const name = channel.ai_name || 'مستشار كوادر';
        const greeting = channel.ai_greeting || 
            `وعليكم السلام ورحمة الله وبركاته! أهلاً وسهلاً بك. معكم ${name} من فريق كوادر. 🌸\nيسعدني جداً تواصلك معنا، كيف أقدر أساعدك اليوم؟`;
        return {
            type: 'DIRECT_REPLY',
            reply: greeting
        };
    }

    // 5. Fast Links / Direct Registration
    if (REGISTRATION_LINK_REGEX.test(cleanText)) {
        return {
            type: 'DIRECT_REPLY',
            reply: 'يسعدنا جداً اهتمامك بالتجربة! يمكنك استكشاف لوحة التحكم وتجربة المنصة مجاناً عبر الرابط:\nhttps://kwader.app\n\nوإذا أحببت ترشيح الباقة الأنسب لشركتك، شاركني فقط عدد الموظفين ونوع أجهزة البصمة لديك وسأساعدك فوراً! 🚀'
        };
    }

    // 6. Otherwise, pass to Gemini AI Agent
    return {
        type: 'PASS_TO_AI'
    };
}

module.exports = {
    routeIntent,
    DEFAULT_HANDOFF_KEYWORDS
};
