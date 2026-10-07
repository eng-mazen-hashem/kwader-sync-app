/**
 * 🎓 Persona Trainer
 * Incremental, versioned, evaluated persona training driven by admin WhatsApp commands.
 *
 * Design rules (post-training discipline):
 *  - Training ADDS to the persona (merge), it never overwrites it.
 *  - A candidate version is only promoted if it passes a fixed eval gate against the
 *    current version (same model, same cases). UNVERIFIED is never a pass.
 *  - Every version is stored, so `#تراجع` restores the previous one instantly.
 *  - Facts go to the knowledge base, style goes to the DNA, examples go to the exemplar bank.
 *  - State lives in `system_settings` (no schema migration required).
 */

const STATE_PREFIX = 'persona_state:';
const SESSION_PREFIX = 'persona_session:';

const LIMITS = {
    MAX_RULES: 12,
    MAX_FORBIDDEN: 8,
    MAX_RULE_CHARS: 140,
    MAX_DNA_CHARS: 900,          // ≈ 250-300 tokens of Arabic
    MAX_EXEMPLARS: 30,
    MAX_DELTA_EXEMPLARS: 4,
    MAX_DELTA_FACTS: 8,
    MAX_VERSIONS: 20,
    MIN_ADMIN_TURNS: 2,
    EVAL_MIN_VALID_CASES: 3
};

const INJECTION_PATTERNS = [
    /ignore (all )?(previous|prior|above)/i,
    /system prompt/i,
    /تجاهل (كل )?(التعليمات|ما سبق)/,
    /انس(ى)? (كل )?(التعليمات|ما سبق)/,
    /(api|secret)[ _-]?key/i,
    /https?:\/\//i
];

const DEFAULT_EVAL_CASES = [
    { msg: 'السلام عليكم', maxChars: 220 },
    { msg: 'بكام الاشتراك؟', maxChars: 420 },
    { msg: 'السعر غالي عليا', maxChars: 420 },
    { msg: 'مش عايز اتعامل مع روبوت، عايز حد بشري', maxChars: 420 },
    { msg: 'عندي 40 موظف وعايز اجرب النظام', maxChars: 420 },
    { msg: 'ممكن تشرحلي النظام بالتفصيل؟', maxChars: 480 }
];

const GLOBAL_BANNED_IN_REPLY = [/كذكاء اصطناعي/, /as an ai/i, /^#{1,6}\s/m];

// ───────────────────────── helpers ─────────────────────────

const stateCache = new Map(); // channelId -> { state, ts }
const bootstrapInflight = new Map();
const STATE_CACHE_MS = 60 * 1000;

function digits(s) {
    return String(s || '').replace(/\D/g, '');
}

/** True if `phone` is the configured admin number (compares last 9 digits to survive country-code formats). */
function isAdminPhone(phone, adminPhone) {
    const a = digits(adminPhone);
    const p = digits(phone);
    if (!a || !p) return false;
    return a.slice(-9) === p.slice(-9);
}

function parseJson(text) {
    if (!text) return null;
    let t = String(text).trim();
    t = t.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
    try {
        return JSON.parse(t);
    } catch (e) {
        const first = t.indexOf('{');
        const last = t.lastIndexOf('}');
        if (first >= 0 && last > first) {
            try { return JSON.parse(t.slice(first, last + 1)); } catch (e2) { /* fallthrough */ }
        }
    }
    return null;
}

function cleanStr(s, max) {
    if (typeof s !== 'string') return '';
    return s.replace(/\s+/g, ' ').trim().slice(0, max);
}

function isSafeText(s) {
    return !INJECTION_PATTERNS.some(re => re.test(s));
}

function normalizeForCompare(s) {
    return String(s || '').toLowerCase().replace(/[^a-z0-9\u0600-\u06FF]/g, '');
}

function uniqueByNorm(list) {
    const seen = new Set();
    const out = [];
    for (const item of list) {
        const key = normalizeForCompare(item);
        if (!key || seen.has(key)) continue;
        seen.add(key);
        out.push(item);
    }
    return out;
}

// ───────────────────────── DNA model ─────────────────────────

function emptyDna() {
    return { tone: '', rules: [], forbidden: [], closing: '' };
}

function sanitizeDna(raw) {
    const dna = emptyDna();
    if (!raw || typeof raw !== 'object') return dna;
    dna.tone = isSafeText(cleanStr(raw.tone, 160)) ? cleanStr(raw.tone, 160) : '';
    dna.closing = isSafeText(cleanStr(raw.closing, 140)) ? cleanStr(raw.closing, 140) : '';
    const rules = Array.isArray(raw.rules) ? raw.rules : [];
    dna.rules = uniqueByNorm(
        rules.map(r => cleanStr(r, LIMITS.MAX_RULE_CHARS)).filter(r => r.length >= 4 && isSafeText(r))
    ).slice(0, LIMITS.MAX_RULES);
    const forb = Array.isArray(raw.forbidden) ? raw.forbidden : [];
    dna.forbidden = uniqueByNorm(
        forb.map(r => cleanStr(r, 80)).filter(r => r.length >= 2 && isSafeText(r))
    ).slice(0, LIMITS.MAX_FORBIDDEN);
    return dna;
}

function renderDna(dna) {
    if (!dna) return '';
    const parts = [];
    if (dna.tone) parts.push(`النبرة: ${dna.tone}`);
    if (dna.rules?.length) parts.push('القواعد:\n' + dna.rules.map(r => `- ${r}`).join('\n'));
    if (dna.forbidden?.length) parts.push(`ممنوع: ${dna.forbidden.join('، ')}`);
    if (dna.closing) parts.push(`الإقفال: ${dna.closing}`);
    return parts.join('\n');
}

/** Validate an LLM-produced delta. Returns a clean delta (possibly empty). */
function validateDelta(raw) {
    const d = { add_rules: [], remove_rules: [], tone: '', forbidden_add: [], closing: '', exemplars: [], facts: [] };
    if (!raw || typeof raw !== 'object') return d;

    d.add_rules = uniqueByNorm(
        (Array.isArray(raw.add_rules) ? raw.add_rules : [])
            .map(r => cleanStr(r, LIMITS.MAX_RULE_CHARS))
            .filter(r => r.length >= 4 && isSafeText(r))
    ).slice(0, 6);
    d.remove_rules = (Array.isArray(raw.remove_rules) ? raw.remove_rules : [])
        .map(r => cleanStr(r, LIMITS.MAX_RULE_CHARS)).filter(Boolean).slice(0, 6);
    const tone = cleanStr(raw.tone, 160);
    d.tone = tone && isSafeText(tone) ? tone : '';
    const closing = cleanStr(raw.closing, 140);
    d.closing = closing && isSafeText(closing) ? closing : '';
    d.forbidden_add = uniqueByNorm(
        (Array.isArray(raw.forbidden_add) ? raw.forbidden_add : [])
            .map(r => cleanStr(r, 80)).filter(r => r.length >= 2 && isSafeText(r))
    ).slice(0, 5);

    d.exemplars = (Array.isArray(raw.exemplars) ? raw.exemplars : [])
        .map(e => ({
            intent: cleanStr(e?.intent, 40) || 'general',
            customer: cleanStr(e?.customer, 200),
            reply: cleanStr(e?.reply, 300)
        }))
        .filter(e => e.customer.length >= 3 && e.reply.length >= 5 && isSafeText(e.reply))
        .slice(0, LIMITS.MAX_DELTA_EXEMPLARS);

    d.facts = (Array.isArray(raw.facts) ? raw.facts : [])
        .map(f => ({
            question: cleanStr(f?.question, 160),
            answer: cleanStr(f?.answer, 500),
            keywords: (Array.isArray(f?.keywords) ? f.keywords : []).map(k => cleanStr(k, 40)).filter(Boolean).slice(0, 8)
        }))
        .filter(f => f.question.length >= 3 && f.answer.length >= 3 && isSafeText(f.answer))
        .slice(0, LIMITS.MAX_DELTA_FACTS);

    return d;
}

function deltaIsEmpty(d) {
    return !d.add_rules.length && !d.remove_rules.length && !d.tone && !d.closing &&
        !d.forbidden_add.length && !d.exemplars.length && !d.facts.length;
}

/** Merge a validated delta into DNA. Additive: removals only match existing rules by similarity. */
function mergeDna(oldDna, delta) {
    const base = sanitizeDna(oldDna);
    let rules = [...base.rules];

    for (const rm of delta.remove_rules) {
        const n = normalizeForCompare(rm);
        if (n.length < 4) continue;
        rules = rules.filter(r => {
            const rn = normalizeForCompare(r);
            return !(rn.includes(n) || n.includes(rn));
        });
    }
    rules = uniqueByNorm([...rules, ...delta.add_rules]);
    // Cap: keep the NEWEST rules when over the limit
    if (rules.length > LIMITS.MAX_RULES) rules = rules.slice(rules.length - LIMITS.MAX_RULES);

    const merged = {
        tone: delta.tone || base.tone,
        closing: delta.closing || base.closing,
        rules,
        forbidden: uniqueByNorm([...base.forbidden, ...delta.forbidden_add]).slice(0, LIMITS.MAX_FORBIDDEN)
    };

    // Hard size cap: drop oldest rules until the rendered DNA fits
    while (renderDna(merged).length > LIMITS.MAX_DNA_CHARS && merged.rules.length > 1) {
        merged.rules.shift();
    }
    return merged;
}

function pickExemplars(exemplars, userText, n = 2) {
    if (!Array.isArray(exemplars) || exemplars.length === 0) return [];
    const toks = new Set(normalizeTokens(userText));
    const scored = exemplars.map((e, i) => {
        const et = normalizeTokens(e.customer);
        let overlap = 0;
        for (const t of et) if (toks.has(t)) overlap++;
        const score = et.length ? overlap / Math.sqrt(et.length) : 0;
        return { e, score, i };
    });
    scored.sort((a, b) => (b.score - a.score) || (b.i - a.i));
    const best = scored.filter(s => s.score > 0).slice(0, n).map(s => s.e);
    if (best.length) return best;
    return [exemplars[exemplars.length - 1]]; // most recent as stylistic anchor
}

function normalizeTokens(s) {
    return String(s || '').toLowerCase().split(/[^a-z0-9\u0600-\u06FF]+/).filter(t => t.length >= 2);
}

function renderExemplars(list) {
    if (!list || !list.length) return '';
    return list.map(e => `عميل: ${e.customer}\nأنت: ${e.reply}`).join('\n---\n');
}

// ───────────────────────── LLM access ─────────────────────────

let KEYS = { gemini: null, groq: null };
function init({ GEMINI_API_KEY, GROQ_API_KEY }) {
    KEYS = { gemini: GEMINI_API_KEY || null, groq: GROQ_API_KEY || null };
}

/**
 * messages: [{role:'user'|'assistant', content}]
 * Gemini first, Groq fallback. Throws AbortError if aborted.
 */
async function callLLM({ system, messages, json = false, temperature = 0.3, maxTokens = 800, signal }) {
    if (KEYS.gemini) {
        try {
            const body = {
                systemInstruction: { parts: [{ text: system || '' }] },
                contents: messages.map(m => ({
                    role: m.role === 'user' ? 'user' : 'model',
                    parts: [{ text: m.content || '' }]
                })),
                generationConfig: {
                    temperature,
                    maxOutputTokens: maxTokens,
                    thinkingConfig: { thinkingBudget: 0 },
                    ...(json ? { responseMimeType: 'application/json' } : {})
                }
            };
            const res = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${KEYS.gemini}`,
                { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal }
            );
            if (res.ok) {
                const data = await res.json();
                const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
                if (text.trim()) return text.trim();
            } else {
                console.warn(`[PersonaTrainer] Gemini ${res.status}`);
            }
        } catch (e) {
            if (e.name === 'AbortError') throw e;
            console.warn('[PersonaTrainer] Gemini error:', e.message);
        }
    }
    if (KEYS.groq) {
        try {
            const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${KEYS.groq}`, 'Content-Type': 'application/json' },
                signal,
                body: JSON.stringify({
                    model: 'llama-3.3-70b-versatile',
                    messages: [{ role: 'system', content: system || '' }, ...messages],
                    temperature,
                    max_tokens: maxTokens,
                    ...(json ? { response_format: { type: 'json_object' } } : {})
                })
            });
            if (res.ok) {
                const data = await res.json();
                const text = data?.choices?.[0]?.message?.content || '';
                if (text.trim()) return text.trim();
            } else {
                console.warn(`[PersonaTrainer] Groq ${res.status}`);
            }
        } catch (e) {
            if (e.name === 'AbortError') throw e;
            console.warn('[PersonaTrainer] Groq error:', e.message);
        }
    }
    return null;
}

// ───────────────────────── persistence ─────────────────────────

async function readSetting(supabase, key) {
    const { data } = await supabase.from('system_settings').select('value').eq('key', key).maybeSingle();
    return data?.value ?? null;
}

async function writeSetting(supabase, key, value) {
    const { error } = await supabase.from('system_settings')
        .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    if (error) throw new Error(`persist ${key}: ${error.message}`);
}

function blankState() {
    return { activeVersion: 0, versions: [], exemplars: [] };
}

async function loadState(supabase, channelId, { force = false } = {}) {
    const cached = stateCache.get(channelId);
    if (!force && cached && Date.now() - cached.ts < STATE_CACHE_MS) return cached.state;
    let state = null;
    try {
        state = await readSetting(supabase, STATE_PREFIX + channelId);
    } catch (e) {
        console.warn('[PersonaTrainer] loadState failed:', e.message);
        if (cached) return cached.state; // serve stale rather than lose persona
    }
    if (!state || typeof state !== 'object') state = blankState();
    state.versions = Array.isArray(state.versions) ? state.versions : [];
    state.exemplars = Array.isArray(state.exemplars) ? state.exemplars : [];
    stateCache.set(channelId, { state, ts: Date.now() });
    return state;
}

async function saveState(supabase, channelId, state) {
    if (state.versions.length > LIMITS.MAX_VERSIONS) {
        // keep the active version always; trim oldest others
        const active = state.versions.find(v => v.v === state.activeVersion);
        const rest = state.versions.filter(v => v.v !== state.activeVersion);
        const keep = rest.slice(rest.length - (LIMITS.MAX_VERSIONS - 1));
        state.versions = [...keep, ...(active ? [active] : [])].sort((a, b) => a.v - b.v);
    }
    if (state.exemplars.length > LIMITS.MAX_EXEMPLARS) {
        state.exemplars = state.exemplars.slice(state.exemplars.length - LIMITS.MAX_EXEMPLARS);
    }
    await writeSetting(supabase, STATE_PREFIX + channelId, state);
    stateCache.set(channelId, { state, ts: Date.now() });
}

function activeVersionOf(state) {
    return state.versions.find(v => v.v === state.activeVersion) || null;
}

function sessionKey(channelId, phone) {
    return `${SESSION_PREFIX}${channelId}:${digits(phone)}`;
}

const sessionCache = new Map();

async function getSession(supabase, channelId, phone) {
    const k = sessionKey(channelId, phone);
    if (sessionCache.has(k)) return sessionCache.get(k);
    try {
        const s = await readSetting(supabase, k);
        if (s && Array.isArray(s.history)) {
            sessionCache.set(k, s);
            return s;
        }
    } catch (e) { /* treat as no session */ }
    return null;
}

async function putSession(supabase, channelId, phone, session) {
    const k = sessionKey(channelId, phone);
    sessionCache.set(k, session);
    try { await writeSetting(supabase, k, session); } catch (e) { console.warn('[PersonaTrainer] session persist failed:', e.message); }
}

async function clearSession(supabase, channelId, phone) {
    const k = sessionKey(channelId, phone);
    sessionCache.delete(k);
    try { await supabase.from('system_settings').delete().eq('key', k); } catch (e) { /* ignore */ }
}

// ───────────────────────── bootstrap from legacy prompt ─────────────────────────

async function distillLegacyPrompt(legacyText, signal) {
    const out = await callLLM({
        system: 'أنت خبير هندسة برومبت. حوّل دليل المبيعات التالي إلى بصمة شخصية مضغوطة جداً بصيغة JSON فقط: ' +
            '{"tone":"وصف النبرة في جملة","rules":["حتى 8 قواعد قصيرة قابلة للتنفيذ"],"forbidden":["حتى 5 أشياء ممنوعة"],"closing":"أسلوب الإقفال"}. ' +
            'لا تضف أسعاراً أو أرقاماً أو روابط. اجعل كل قاعدة أقل من 120 حرفاً.',
        messages: [{ role: 'user', content: legacyText.slice(0, 6000) }],
        json: true, temperature: 0.1, maxTokens: 700, signal
    });
    const dna = sanitizeDna(parseJson(out));
    return (dna.rules.length || dna.tone) ? dna : null;
}

async function ensureBootstrapped(supabase, channelId, channelData, signal) {
    let state = await loadState(supabase, channelId);
    if (activeVersionOf(state)) return state;
    const legacy = (channelData?.ai_prompt_instructions || '').trim();
    if (legacy.length < 80) return state; // nothing to distill

    if (bootstrapInflight.has(channelId)) return bootstrapInflight.get(channelId);
    const p = (async () => {
        try {
            const dna = await distillLegacyPrompt(legacy, signal);
            if (!dna) return state;
            const fresh = await loadState(supabase, channelId, { force: true });
            if (activeVersionOf(fresh)) return fresh;
            fresh.versions.push({
                v: 1, dna, status: 'active', score: null, parent: 0,
                note: 'bootstrap من الدليل القديم', createdAt: new Date().toISOString()
            });
            fresh.activeVersion = 1;
            await saveState(supabase, channelId, fresh);
            console.log(`[PersonaTrainer] 🧬 Bootstrapped persona v1 for ${channelId} (${renderDna(dna).length} chars)`);
            return fresh;
        } catch (e) {
            if (e.name === 'AbortError') throw e;
            console.warn('[PersonaTrainer] bootstrap failed, keeping legacy prompt:', e.message);
            return state;
        } finally {
            bootstrapInflight.delete(channelId);
        }
    })();
    bootstrapInflight.set(channelId, p);
    return p;
}

/**
 * Persona material for the live reply prompt. Returns null → caller uses the legacy prompt (safe fallback).
 */
async function getPersonaForPrompt(supabase, channelId, channelData, userText, signal) {
    try {
        const state = await ensureBootstrapped(supabase, channelId, channelData, signal);
        const ver = activeVersionOf(state);
        if (!ver) return null;
        const dnaText = renderDna(ver.dna);
        if (!dnaText) return null;
        return {
            version: ver.v,
            dnaText,
            exemplarsText: renderExemplars(pickExemplars(state.exemplars, userText, 2))
        };
    } catch (e) {
        if (e.name === 'AbortError') throw e;
        console.warn('[PersonaTrainer] getPersonaForPrompt failed:', e.message);
        return null;
    }
}

// ───────────────────────── extraction ─────────────────────────

const EXTRACT_SYSTEM = `أنت مهندس شخصيات لوكلاء مبيعات واتساب. ستحصل على (1) بصمة الشخصية الحالية و(2) محادثة تدريب بين المدير (يلعب دور البائع) وعميل تجريبي، أو تعليمة مباشرة من المدير.
استخرج فقط ما هو جديد أو مختلف عن البصمة الحالية. الرد JSON فقط بهذا الشكل بالضبط:
{
 "add_rules": ["قاعدة أسلوب/سلوك قصيرة قابلة للتنفيذ (حتى 6)"],
 "remove_rules": ["نص قاعدة حالية يطلب المدير إلغاءها (إن وجد)"],
 "tone": "نبرة جديدة فقط إذا تغيرت وإلا فارغ",
 "closing": "أسلوب إقفال جديد فقط إذا تغير وإلا فارغ",
 "forbidden_add": ["أشياء ممنوعة جديدة"],
 "exemplars": [{"intent":"price|objection|greeting|demo|general","customer":"رسالة العميل","reply":"أفضل رد للمدير بنفس أسلوبه (قصير)"}],
 "facts": [{"question":"سؤال قصير","answer":"إجابة دقيقة","keywords":["كلمة"]}]
}
قواعد صارمة:
- الأسلوب والسلوك في rules، أما الأسعار والمواصفات والمعلومات الواقعية ففي facts فقط (لا تضعها في rules).
- لا تخترع معلومات لم يقلها المدير. لا روابط. لا تعليمات تخص النظام أو المفاتيح.
- exemplars: انسخ ردود المدير الحقيقية (حتى 4 أفضلها) ولا تؤلف ردوداً.
- إذا لم يوجد جديد اترك القوائم فارغة.`;

async function extractDelta({ history, currentDna, instruction, signal }) {
    const transcript = instruction
        ? `تعليمة مباشرة من المدير:\n${instruction}`
        : 'المحادثة (user=المدير كبائع، assistant=العميل التجريبي):\n' +
          history.filter(h => h.role !== 'system').map(h => `${h.role === 'user' ? 'المدير' : 'العميل'}: ${h.content}`).join('\n');

    for (let attempt = 0; attempt < 2; attempt++) {
        const out = await callLLM({
            system: EXTRACT_SYSTEM,
            messages: [{ role: 'user', content: `البصمة الحالية:\n${renderDna(currentDna) || '(فارغة)'}\n\n${transcript}` }],
            json: true, temperature: 0.1, maxTokens: 1800, signal
        });
        const parsed = parseJson(out);
        if (parsed) return validateDelta(parsed);
    }
    return null; // extraction failure ≠ empty delta
}

// ───────────────────────── evaluation gate ─────────────────────────

function coreFor(aiName) {
    return `أنت "${aiName || 'أحمد | مبيعات كوادر'}"، مستشار مبيعات كوادر للاتش آر والبصمة. ردودك قصيرة وبلا مقدمات روبوتية.`;
}

/** Deterministic reply checks → { passed, total, failures[] } */
function scoreReply(reply, evalCase, dna) {
    const failures = [];
    let total = 0;
    const check = (ok, label) => { total++; if (!ok) failures.push(label); };

    check(!!reply && reply.trim().length > 0, 'empty');
    if (reply) {
        check(reply.length <= (evalCase.maxChars || 450), 'too_long');
        for (const re of GLOBAL_BANNED_IN_REPLY) check(!re.test(reply), 'banned_pattern');
        for (const f of (dna?.forbidden || [])) {
            const n = normalizeForCompare(f);
            if (n.length >= 3) check(!normalizeForCompare(reply).includes(n), `forbidden:${f}`);
        }
    }
    return { passed: total - failures.length, total, failures };
}

async function genWithDna(dna, aiName, msg, signal) {
    const system = `${coreFor(aiName)}\n${renderDna(dna)}`;
    return callLLM({ system, messages: [{ role: 'user', content: msg }], temperature: 0.3, maxTokens: 350, signal });
}

async function evaluateCandidate({ candidateDna, baselineDna, aiName, exemplars, signal }) {
    const cases = [
        ...DEFAULT_EVAL_CASES,
        ...(exemplars || []).slice(-4).map(e => ({ msg: e.customer, maxChars: 480 }))
    ];
    let candPassed = 0, candTotal = 0, basePassed = 0, baseTotal = 0, valid = 0;
    const failures = [];

    for (const c of cases) {
        const [candReply, baseReply] = await Promise.all([
            genWithDna(candidateDna, aiName, c.msg, signal),
            baselineDna ? genWithDna(baselineDna, aiName, c.msg, signal) : Promise.resolve('')
        ]);
        if (!candReply || (baselineDna && !baseReply)) continue; // skip invalid pair on both sides
        valid++;
        const cs = scoreReply(candReply, c, candidateDna);
        candPassed += cs.passed; candTotal += cs.total;
        if (cs.failures.length) failures.push(`«${c.msg.slice(0, 25)}»: ${cs.failures.join(',')}`);
        if (baselineDna) {
            const bs = scoreReply(baseReply, c, baselineDna);
            basePassed += bs.passed; baseTotal += bs.total;
        }
    }

    const candScore = candTotal ? candPassed / candTotal : 0;
    const baseScore = baseTotal ? basePassed / baseTotal : null;
    let verdict;
    if (valid < LIMITS.EVAL_MIN_VALID_CASES) verdict = 'UNVERIFIED';
    else if (baseScore !== null && candScore + 1e-9 < baseScore) verdict = 'FAIL';
    else if (candScore < 0.8) verdict = 'FAIL';
    else verdict = 'PASS';

    return { verdict, candScore, baseScore, validCases: valid, totalCases: cases.length, failures };
}

// ───────────────────────── knowledge-base facts ─────────────────────────

async function saveFacts(supabase, channelId, companyId, facts) {
    if (!facts.length) return 0;
    let inserted = 0;
    try {
        const { data: existing } = await supabase.from('ai_knowledge_base')
            .select('question_trigger').eq('channel_id', channelId).limit(500);
        const have = new Set((existing || []).map(r => normalizeForCompare(r.question_trigger)));
        const rows = facts
            .filter(f => !have.has(normalizeForCompare(f.question)))
            .map(f => ({
                company_id: companyId || null,
                channel_id: channelId,
                category: 'faq',
                question_trigger: f.question,
                answer_content: f.answer,
                keywords: f.keywords,
                is_active: true
            }));
        if (rows.length) {
            const { error } = await supabase.from('ai_knowledge_base').insert(rows);
            if (!error) inserted = rows.length;
            else console.warn('[PersonaTrainer] KB insert error:', error.message);
        }
    } catch (e) {
        console.warn('[PersonaTrainer] saveFacts failed:', e.message);
    }
    return inserted;
}

// ───────────────────────── training application ─────────────────────────

/**
 * Extract → merge → evaluate → promote/reject. Returns a result object (never throws on LLM failure).
 */
async function applyTraining({ supabase, channelId, channelData, history, instruction, note, signal }) {
    const state = await ensureBootstrapped(supabase, channelId, channelData, signal);
    const base = activeVersionOf(state);
    const baseDna = base ? base.dna : null;

    const delta = await extractDelta({ history, currentDna: baseDna || emptyDna(), instruction, signal });
    if (!delta) return { status: 'ERROR', message: 'تعذر تحليل التدريب (فشل استخراج منظم). لم يتغير شيء، حاول مرة أخرى.' };
    if (deltaIsEmpty(delta)) return { status: 'EMPTY', message: 'لم أجد جديداً أتعلمه من هذا التدريب. لم يتغير شيء.' };

    const candidateDna = mergeDna(baseDna || emptyDna(), delta);
    const evalRes = await evaluateCandidate({
        candidateDna,
        baselineDna: baseDna,
        aiName: channelData?.ai_name,
        exemplars: [...state.exemplars, ...delta.exemplars],
        signal
    });

    const fresh = await loadState(supabase, channelId, { force: true });
    const nextV = (fresh.versions.reduce((m, v) => Math.max(m, v.v), 0)) + 1;
    const record = {
        v: nextV, dna: candidateDna, parent: fresh.activeVersion, score: Number(evalRes.candScore.toFixed(3)),
        baseScore: evalRes.baseScore === null ? null : Number(evalRes.baseScore.toFixed(3)),
        note: (note || '').slice(0, 120), createdAt: new Date().toISOString(),
        status: 'rejected'
    };

    if (evalRes.verdict === 'UNVERIFIED') {
        return { status: 'UNVERIFIED', evalRes, delta, message: 'لم أستطع التحقق من النسخة الجديدة (فشل توليد كافٍ من الردود التجريبية). لم تُفعَّل. أعد المحاولة بعد قليل.' };
    }

    if (evalRes.verdict === 'PASS') {
        record.status = 'active';
        fresh.versions.forEach(v => { if (v.status === 'active') v.status = 'archived'; });
        fresh.versions.push(record);
        fresh.activeVersion = nextV;
        const merged = [...fresh.exemplars, ...delta.exemplars.map(e => ({ ...e, v: nextV }))];
        const seen = new Set();
        fresh.exemplars = merged.filter(e => {
            const k = normalizeForCompare(e.customer + e.reply);
            if (seen.has(k)) return false; seen.add(k); return true;
        });
        await saveState(supabase, channelId, fresh);
        const factsSaved = await saveFacts(supabase, channelId, channelData?.company_id, delta.facts);
        return { status: 'PASS', version: nextV, evalRes, delta, factsSaved };
    }

    fresh.versions.push(record);
    await saveState(supabase, channelId, fresh);
    return { status: 'FAIL', version: nextV, evalRes, delta };
}

function pct(x) { return x === null || x === undefined ? '—' : `${Math.round(x * 100)}%`; }

function summarizeResult(r) {
    if (r.status === 'PASS') {
        const lines = [
            `✅ تم التدريب وتفعيل النسخة *v${r.version}*`,
            `📊 الاختبار: ${pct(r.evalRes.candScore)} (قبل: ${pct(r.evalRes.baseScore)}) على ${r.evalRes.validCases} حالة`
        ];
        if (r.delta.add_rules.length) lines.push(`➕ قواعد جديدة: ${r.delta.add_rules.length}`);
        if (r.delta.exemplars.length) lines.push(`💬 أمثلة محفوظة: ${r.delta.exemplars.length}`);
        if (r.factsSaved) lines.push(`📚 معلومات أُضيفت لقاعدة المعرفة: ${r.factsSaved}`);
        lines.push('للتراجع اكتب: #تراجع');
        return lines.join('\n');
    }
    if (r.status === 'FAIL') {
        return `⛔ رُفضت النسخة الجديدة (v${r.version}) ولم تُفعَّل، النسخة الحالية سليمة.\n📊 الاختبار: ${pct(r.evalRes.candScore)} مقابل ${pct(r.evalRes.baseScore)}\n` +
            (r.evalRes.failures.length ? `الأسباب: ${r.evalRes.failures.slice(0, 3).join(' | ')}` : '');
    }
    return `⚠️ ${r.message}`;
}

// ───────────────────────── versions / rollback ─────────────────────────

async function rollback(supabase, channelId) {
    const state = await loadState(supabase, channelId, { force: true });
    const cur = activeVersionOf(state);
    if (!cur) return { ok: false, message: 'لا توجد نسخة نشطة للتراجع عنها.' };
    // walk the parent chain to the nearest earlier non-rejected version
    let target = null;
    let pv = cur.parent;
    while (pv) {
        const cand = state.versions.find(v => v.v === pv);
        if (!cand) break;
        if (cand.status !== 'rejected') { target = cand; break; }
        pv = cand.parent;
    }
    if (!target) return { ok: false, message: 'لا توجد نسخة سابقة للتراجع إليها.' };
    state.versions.forEach(v => { if (v.v === cur.v) v.status = 'rolled_back'; });
    target.status = 'active';
    state.activeVersion = target.v;
    await saveState(supabase, channelId, state);
    return { ok: true, from: cur.v, to: target.v };
}

function listVersions(state) {
    const items = state.versions.slice(-5).reverse().map(v => {
        const mark = v.v === state.activeVersion ? '🟢' : (v.status === 'rejected' ? '🔴' : '⚪');
        return `${mark} v${v.v} • ${pct(v.score)} • ${v.status}${v.note ? ' • ' + v.note : ''}`;
    });
    return items.length ? items.join('\n') : 'لا توجد نسخ بعد.';
}

// ───────────────────────── roleplay ─────────────────────────

const CUSTOMER_SYSTEM = 'أنت الآن تلعب دور "عميل مهتم ولكن متردد قليلاً" يتحدث مع مندوب مبيعات على واتساب. ' +
    'اختبر المندوب بأسئلة عن التفاصيل والأسعار واعتراضات (السعر غالي، أريد ضمانات). ردودك قصيرة جداً (جملة أو اثنتين)، مصرية عامية، كأنك تكتب من الموبايل. لا تكشف أنك ذكاء اصطناعي.';

const OPENING = 'السلام عليكم، كنت عايز أعرف تفاصيل أكتر عن خدماتكم وبكام الأسعار لو سمحت؟';

// ───────────────────────── command router ─────────────────────────

const CMD_START = /^(#تدريب|#train)(\s+([\s\S]+))?$/i;

/** Quick check so the caller can skip admin lookups for normal customer messages. */
function looksLikeCommand(text) {
    const t = (text || '').trim();
    return CMD_START.test(t) || ['#نسخ', '#تراجع', '#شخصية', '#الغاء_التدريب', 'انهاء التدريب'].includes(t);
}

/**
 * Handles admin training commands and roleplay turns.
 * @returns {Promise<boolean>} true when the message was consumed (caller must not run the sales AI).
 */
async function handleAdminMessage({ text, phone, channelId, channelData, isAdmin, reply, signal }) {
    if (!isAdmin) return false;
    const supabase = ctxSupabase;
    const t = (text || '').trim();
    const session = await getSession(supabase, channelId, phone);

    // Roleplay turn (session active and not a control command)
    const startMatch = t.match(CMD_START);
    const isControl = startMatch || ['#نسخ', '#تراجع', '#شخصية', '#الغاء_التدريب', 'انهاء التدريب'].includes(t);

    if (session && !isControl) {
        session.history.push({ role: 'user', content: t });
        const recent = session.history.slice(-20);
        const custReply = await callLLM({
            system: CUSTOMER_SYSTEM, messages: recent, temperature: 0.6, maxTokens: 150, signal
        });
        if (custReply) {
            session.history.push({ role: 'assistant', content: custReply });
            await reply({ text: custReply });
        } else {
            await reply({ text: '(تعذر توليد رد العميل التجريبي، أعد إرسال رسالتك)' });
            session.history.pop();
        }
        await putSession(supabase, channelId, phone, session);
        return true;
    }

    if (t === '#نسخ') {
        const state = await loadState(supabase, channelId, { force: true });
        await reply({ text: `🧬 نسخ الشخصية:\n${listVersions(state)}` });
        return true;
    }

    if (t === '#شخصية') {
        const state = await ensureBootstrapped(supabase, channelId, channelData, signal);
        const ver = activeVersionOf(state);
        await reply({ text: ver ? `🧬 الشخصية الحالية (v${ver.v}):\n${renderDna(ver.dna)}\n\n💬 أمثلة محفوظة: ${state.exemplars.length}` : 'لا توجد شخصية مدرَّبة بعد. ابدأ بـ #تدريب' });
        return true;
    }

    if (t === '#تراجع') {
        const r = await rollback(supabase, channelId);
        await reply({ text: r.ok ? `↩️ تم التراجع من v${r.from} إلى v${r.to}.` : `⚠️ ${r.message}` });
        return true;
    }

    if (t === '#الغاء_التدريب') {
        await clearSession(supabase, channelId, phone);
        await reply({ text: '🗑️ أُلغيت جلسة التدريب دون أي تغيير.' });
        return true;
    }

    if (t === 'انهاء التدريب') {
        if (!session) return false; // normal message when no session
        const adminTurns = session.history.filter(h => h.role === 'user').length;
        if (adminTurns < LIMITS.MIN_ADMIN_TURNS) {
            await reply({ text: `⚠️ التدريب قصير جداً (${adminTurns} رسالة منك). أكمل المحاكاة قليلاً أو اكتب #الغاء_التدريب.` });
            return true;
        }
        await reply({ text: '⏳ جاري تحليل التدريب واختبار النسخة الجديدة قبل تفعيلها...' });
        const result = await applyTraining({
            supabase, channelId, channelData, history: session.history, note: 'جلسة محاكاة', signal
        });
        if (result.status === 'UNVERIFIED' || result.status === 'ERROR') {
            // keep the session so nothing is lost
            await putSession(supabase, channelId, phone, session);
        } else {
            await clearSession(supabase, channelId, phone);
        }
        await reply({ text: summarizeResult(result) });
        return true;
    }

    if (startMatch) {
        const instruction = (startMatch[3] || '').trim();
        if (instruction) {
            await reply({ text: '⏳ جاري تطبيق التعليمة واختبارها...' });
            const result = await applyTraining({
                supabase, channelId, channelData, history: [], instruction, note: 'تعليمة مباشرة', signal
            });
            await reply({ text: summarizeResult(result) });
            return true;
        }
        const history = session?.history?.length
            ? session.history
            : [{ role: 'assistant', content: OPENING }];
        await putSession(supabase, channelId, phone, { history, startedAt: session?.startedAt || new Date().toISOString() });
        await reply({
            text: '🤖 أهلاً يا مدير! سألعب دور "العميل" وأنت المندوب. حاول إقناعي خطوة بخطوة وسأختبرك باعتراضات.\n\n' +
                '💡 تدريب تراكمي: كل ما أتعلمه يُضاف لشخصيتي ويُختبر قبل التفعيل.\n' +
                '• للحفظ اكتب: *انهاء التدريب*\n• للإلغاء: #الغاء_التدريب\n• للتراجع عن آخر تدريب: #تراجع\n\nسأبدأ كعميل 👇'
        });
        if (!session?.history?.length) {
            setTimeout(() => { reply({ text: OPENING }).catch(() => {}); }, 1500);
        }
        return true;
    }

    return false;
}

let ctxSupabase = null;
function setSupabase(sb) { ctxSupabase = sb; }

module.exports = {
    init, setSupabase,
    isAdminPhone, looksLikeCommand, handleAdminMessage, getPersonaForPrompt,
    // exported for tests
    _internal: {
        parseJson, sanitizeDna, validateDelta, mergeDna, renderDna, pickExemplars,
        scoreReply, deltaIsEmpty, LIMITS, emptyDna, normalizeForCompare
    }
};
