/**
 * =========================================================================
 * KWADER AI Engine - In-Website Dedicated Company Technical Support Service
 * =========================================================================
 * Specialized Technical Support Engineer AI strictly tied to each company
 * (Tenant-Isolated). Features live database diagnostics, autonomous repairs,
 * 0-token semantic caching, and real-time omnichannel synchronization.
 */

import { supabase } from '../supabaseClient';

const DEFAULT_GEMINI_KEY = 'REMOVED_FOR_SECURITY';
const GEMINI_MODELS = [
  'gemini-flash-lite-latest',
  'gemini-3.5-flash-lite',
  'gemini-flash-latest',
  'gemini-3.5-flash'
];

// In-memory dynamic cache for company queries
const memoryCache = new Map();
const CACHE_TTL_MS = 12 * 60 * 60 * 1000;

// Courtesy phrases to strip for Arabic normalization
const COURTESY_PHRASES = [
  'لو سمحت', 'من فضلك', 'الله يعافيك', 'يا ريت', 'ممكن',
  'عايز اعرف', 'حابب اعرف', 'بقولك ايه', 'السلام عليكم', 'سلام عليكم',
  'صباح الخير', 'مساء الخير', 'اخي الكريم', 'يا غالي', 'يا فندم',
  'اريد ان اعرف', 'ممكن اعرف', 'تحياتي'
];

/**
 * Specialized Technical Support FAQs (0-Token instant hits)
 */
const TECHNICAL_FAQS = [
  {
    id: 'tech_device_zk_adms',
    patterns: [
      /كيف (اضيف|اربط|اشغل|اغير) جهاز (البصم[ةه]|بصم[ةه]|zk|zkteco)/i,
      /طريق[ةه] (اضاف[ةه]|ربط) جهاز (بصم[ةه]|البصم[ةه]|zk)/i,
      /ازاي اضيف جهاز بصم[ةه]/i,
      /خطوات ربط (البصم[ةه]|adms|السيرفر)/i,
      /اعدادات (adms|السيرفر|السحاب[ةه])/i
    ],
    reply: 'خطوات ربط جهاز البصمة (ZKTeco) بسيرفر كوادر السحابي:\n1. من لوحة التحكم > صفحة "الأجهزة" > اضغط "إضافة جهاز جديد" وسجل اسمه ورقمه التسلسلي (SN).\n2. من شاشة جهاز البصمة نفسه: ادخل على (Menu > Comm. > Cloud Server / ADMS).\n3. اكتب رابط السيرفر ورقم المنفذ (Port) الظاهرين في صفحة الأجهزة، وفعل خيار (Enable Domain Name).\n\nأول ما تضغط حفظ، هيتصل الجهاز بسيرفر كوادر وتتحول حالته إلى متصل (Online) فوراً.'
  },
  {
    id: 'tech_hikvision_sync',
    patterns: [
      /(هيك فيجن|هيكفيجن|hikvision)/i,
      /(برنامج المزامنة|برنامج السنك|sync agent|sync-agent)/i
    ],
    reply: 'لربط أجهزة هيكفيجن (Hikvision) أو أجهزة الشبكة المحلية:\n1. قم بتحميل برنامج المزامنة (KWADER Sync Agent) من صفحة الأجهزة في لوحة التحكم.\n2. ثبّت البرنامج على أي كمبيوتر متصل بنفس شبكة أجهزة البصمة (Local Network).\n3. سجل الدخول للبرنامج بمفتاح ترخيص شركتكم، وسيقوم باكتشاف أجهزة هيكفيجن ورفع البصمات فورياً إلى السحابة تلقائياً.'
  },
  {
    id: 'tech_mobile_punch_setup',
    patterns: [
      /(بصم[ةه] الموبايل|بصم[ةه] التليفون|تسجيل حضور من الموبايل|تطبيق الموظف)/i,
      /ازاي الموظف يبصم من (الموبايل|التليفون)/i,
      /بواب[ةه] الموظف/i
    ],
    reply: 'طريقة تسجيل حضور الموظف بدقة عبر الهاتف:\n1. يفتح الموظف رابط بوابته ويسجل الدخول برقم الـ PIN ورقم هاتفه المسجل.\n2. يتم توثيق هاتف الموظف برمز OTP وربط جهازه لضمان عدم التلاعب.\n3. عند ضغط "تسجيل حضور"، يتحقق النظام لحظياً من تواجد الموظف داخل النطاق الجغرافي (GPS Geofence) المحدد لمقر شركتكم.'
  },
  {
    id: 'tech_shifts_unassigned',
    patterns: [
      /كيف (اسكن|اربط|احدد) (الموظفين|موظف) (على|في) (الوردي[ةه]|الشيفت)/i,
      /طريق[ةه] تسكين (الورديات|الشيفتات|الموظفين)/i,
      /الموظف مش مربوط بوردية/i
    ],
    reply: 'لتسكين الموظفين على الورديات لضمان احتساب البصمات بدقة:\n1. ادخل على صفحة "الورديات" من القائمة الجانبية.\n2. اضغط على خيار "الموظفون" بجانب الوردية المطلوبة.\n3. حدد الموظفين أو اضغط "تسكين جميع الموظفين غير المرتبطين".\n\nتنبيه فني: الموظف الذي لا يرتبط بوردية عمل لا يستطيع النظام احتساب ساعات عمله أو تأخيره.'
  },
  {
    id: 'tech_reset_phone_lock',
    patterns: [
      /(فك|تغيير|اعادة تعيين|قفل) (هاتف|جهاز|موبايل) موظف/i,
      /الموظف غير تليفونه/i,
      /فك قفل الهاتف/i
    ],
    reply: 'إذا غيّر الموظف هاتفه وتظهر له رسالة "هذا الحساب مرتبط بهاتف آخر":\n1. ادخل على صفحة "الموظفون" > ابحث عن اسم الموظف.\n2. افتح ملف الموظف واضغط على "إلغاء ربط الجهاز الحالي / فك القفل".\n3. سيتمكن الموظف فوراً من تسجيل الدخول من هاتفه الجديد وتوثيقه كجهاز معتمد.'
  }
];

/**
 * Human Handoff Request Detection
 */
const HUMAN_HANDOFF_PATTERNS = [
  /تحدث مع (مهندس|موظف|بشري|خدمة العملاء|شخص)/i,
  /اريد (مهندس|موظف|بشري|اكلم حد|اتكلم مع حد|دعم فني بشري)/i,
  /حولني (لمهندس|لموظف|لبشري|لخدمة العملاء)/i,
  /خدم[ةه] العملاء/i,
  /ابغى انسان/i,
  /كلمني بشري/i
];

/**
 * Normalize Arabic text for semantic matching
 */
function normalizeArabic(text) {
  if (!text || typeof text !== 'string') return '';
  let result = text.trim().toLowerCase();

  for (const phrase of COURTESY_PHRASES) {
    result = result.split(phrase).join(' ');
  }

  result = result.replace(/[\u064B-\u0652\u0670]/g, '');
  result = result
    .replace(/[إأآا]/g, 'ا')
    .replace(/[ةه]/g, 'ه')
    .replace(/[ىي]/g, 'ي')
    .replace(/[^\w\s\u0621-\u064A]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return result;
}

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

function calculateSemanticScore(queryTokens, itemTokens) {
  if (queryTokens.size === 0 || itemTokens.size === 0) return 0;
  let intersection = 0;
  for (const token of queryTokens) {
    if (itemTokens.has(token)) intersection++;
  }
  if (intersection === 0) return 0;

  const queryCoverage = intersection / queryTokens.size;
  const jaccard = intersection / (queryTokens.size + itemTokens.size - intersection);
  return (queryCoverage * 0.7) + (jaccard * 0.3);
}

/**
 * Run real-time live company database diagnostics
 * @param {string} companyId - UUID of the target company
 * @returns {Promise<Object|null>}
 */
export async function runCompanyDiagnostics(companyId) {
  if (!companyId) return null;

  try {
    // 1. Devices
    const { data: devices } = await supabase
      .from('devices')
      .select('id, device_name, serial_number, ip_address, port, status, last_sync')
      .eq('company_id', companyId);

    const totalDevices = devices ? devices.length : 0;
    const onlineDevices = (devices || []).filter(d => d.status === 'online');
    const offlineDevices = (devices || []).filter(d => d.status !== 'online');

    // 2. Active Employees
    const { data: employees } = await supabase
      .from('employees')
      .select('id, name, device_pin, status, bound_device_id')
      .eq('company_id', companyId)
      .eq('status', 'active');

    const totalActiveEmployees = employees ? employees.length : 0;
    const missingPinEmployees = (employees || []).filter(e => !e.device_pin);

    // 3. Shifts & Shift Employees
    const { data: shifts } = await supabase
      .from('shifts')
      .select('id, name, start_time, end_time, is_active')
      .eq('company_id', companyId);

    const activeShifts = (shifts || []).filter(s => s.is_active !== false);

    let unassignedEmployees = [];
    if (employees && employees.length > 0) {
      const empIds = employees.map(e => e.id);
      const { data: assignments } = await supabase
        .from('shift_employees')
        .select('employee_id')
        .in('employee_id', empIds);

      const assignedSet = new Set((assignments || []).map(a => a.employee_id));
      unassignedEmployees = employees.filter(e => !assignedSet.has(e.id));
    }

    // 4. Raw Attendance Logs
    const { count: unprocessedCount } = await supabase
      .from('raw_attendance_logs')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('is_processed', false);

    const { data: latestLogs } = await supabase
      .from('raw_attendance_logs')
      .select('timestamp, user_pin')
      .eq('company_id', companyId)
      .order('timestamp', { ascending: false })
      .limit(1);

    const latestLogTimestamp = latestLogs?.[0]?.timestamp || null;

    // Detect technical issues
    const issues = [];
    if (unprocessedCount > 0) {
      issues.push({
        type: 'UNPROCESSED_LOGS',
        severity: 'HIGH',
        message: `يوجد ${unprocessedCount} بصمة مسجلة في السيرفر لم يتم احتسابها ومعالجتها بعد.`,
        suggestedAction: 'reprocess_attendance'
      });
    }

    if (unassignedEmployees.length > 0) {
      issues.push({
        type: 'UNASSIGNED_SHIFTS',
        severity: 'HIGH',
        message: `يوجد ${unassignedEmployees.length} موظف نشط غير مربوطين بأي وردية عمل (لن تحتسب بصماتهم حتى يتم ربطهم).`,
        suggestedAction: 'assign_shift'
      });
    }

    if (offlineDevices.length > 0) {
      issues.push({
        type: 'OFFLINE_DEVICES',
        severity: 'MEDIUM',
        message: `يوجد ${offlineDevices.length} جهاز بصمة غير متصل حالياً (مثل: ${offlineDevices.map(d => d.device_name || d.serial_number).join('، ')}).`,
        suggestedAction: 'check_device_connection'
      });
    }

    if (missingPinEmployees.length > 0) {
      issues.push({
        type: 'MISSING_PIN',
        severity: 'LOW',
        message: `يوجد ${missingPinEmployees.length} موظف بدون رقم بصمة (PIN) مسجل.`,
        suggestedAction: 'set_employee_pin'
      });
    }

    return {
      success: true,
      totalDevices,
      onlineCount: onlineDevices.length,
      offlineDevices,
      totalActiveEmployees,
      missingPinCount: missingPinEmployees.length,
      unassignedCount: unassignedEmployees.length,
      unprocessedCount: unprocessedCount || 0,
      activeShiftsCount: activeShifts.length,
      latestLogTimestamp,
      issues,
      isHealthy: issues.length === 0
    };
  } catch (err) {
    console.warn('Diagnostics error:', err);
    return null;
  }
}

/**
 * Execute automated database repair for a specific company
 * @param {string} companyId 
 * @param {string} action 
 * @param {Object} params 
 * @returns {Promise<Object>}
 */
export async function executeDatabaseRepair(companyId, action, params = {}) {
  if (!companyId) return { success: false, message: 'معرف الشركة غير محدد' };

  try {
    if (action === 'reprocess_attendance') {
      const datesToProcess = [];
      const now = new Date();
      for (let i = 0; i < 3; i++) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        datesToProcess.push(d.toISOString().split('T')[0]);
      }

      for (const pDate of datesToProcess) {
        try {
          await supabase.rpc('process_daily_attendance', {
            p_company_id: companyId,
            p_date: pDate
          });
        } catch (e) {
          console.warn(`Error processing attendance for date ${pDate}:`, e);
        }
      }

      const { count: remaining } = await supabase
        .from('raw_attendance_logs')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .eq('is_processed', false);

      return {
        success: true,
        action: 'reprocess_attendance',
        remaining: remaining || 0,
        message: `تم تشغيل محرك إعادة احتساب البصمات بنجاح للتواريخ (${datesToProcess.join('، ')}). المتبقي غير معالج: ${remaining || 0} بصمة.`
      };
    }

    if (action === 'assign_shift') {
      const { data: defaultShift } = await supabase
        .from('shifts')
        .select('id, name')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();

      if (!defaultShift) {
        return { success: false, message: 'لا توجد وردية عمل مفعلة في الشركة لربط الموظفين بها.' };
      }

      const { data: emps } = await supabase
        .from('employees')
        .select('id')
        .eq('company_id', companyId)
        .eq('status', 'active');

      if (emps && emps.length > 0) {
        const allIds = emps.map(e => e.id);
        const { data: assigned } = await supabase
          .from('shift_employees')
          .select('employee_id')
          .in('employee_id', allIds);

        const assignedSet = new Set((assigned || []).map(a => a.employee_id));
        const unassigned = emps.filter(e => !assignedSet.has(e.id));

        if (unassigned.length > 0) {
          const rows = unassigned.map(e => ({
            company_id: companyId,
            employee_id: e.id,
            shift_id: defaultShift.id
          }));
          await supabase.from('shift_employees').insert(rows);
          return {
            success: true,
            action: 'assign_shift',
            assignedCount: unassigned.length,
            message: `تم ربط وتسكين ${unassigned.length} موظف بنجاح على الوردية المفعلة ("${defaultShift.name}").`
          };
        }
      }
      return { success: true, message: 'جميع الموظفين مسكنين بالفعل على الورديات.' };
    }

    return { success: false, message: 'نوع الإجراء غير معروف' };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

/**
 * Get or create tenant-isolated web conversation in ai_conversations
 * Strictly tied to company_id.
 */
export async function getOrCreateWebConversation(user, company) {
  const companyId = company?.id;
  const companyName = company?.name || user?.email?.split('@')[0] || 'الشركة';

  // The conversation session is strictly bound to this company
  const sessionId = companyId ? `web_company_${companyId}` : `web_user_${user?.id || 'guest'}`;

  try {
    const { data: existing, error: findErr } = await supabase
      .from('ai_conversations')
      .select('*')
      .eq('platform', 'web')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!findErr && existing) {
      return existing;
    }

    // Insert tenant-isolated record
    const { data: newConv, error: createErr } = await supabase
      .from('ai_conversations')
      .insert([{
        platform: 'web',
        session_id: sessionId,
        company_id: companyId || null,
        customer_name: companyName,
        customer_phone: null,
        status: 'active',
        lead_status: 'support_active',
        context_state: {
          company_id: companyId,
          company_name: companyName,
          license_key: company?.license_key || null,
          user_email: user?.email || null,
          role: 'technical_support'
        }
      }])
      .select()
      .single();

    if (createErr) throw createErr;
    return newConv;
  } catch (err) {
    console.error('Error in getOrCreateWebConversation:', err);
    return {
      id: `fallback-${Date.now()}`,
      platform: 'web',
      session_id: sessionId,
      company_id: companyId,
      customer_name: companyName,
      status: 'active'
    };
  }
}

export async function getWebConversationHistory(conversationId) {
  if (!conversationId || conversationId.startsWith('fallback-')) return [];

  try {
    const { data, error } = await supabase
      .from('ai_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(60);

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.warn('Failed to fetch conversation history:', err);
    return [];
  }
}

export function subscribeToWebConversation(conversationId, onNewMessage) {
  if (!conversationId || conversationId.startsWith('fallback-')) {
    return () => {};
  }

  const channelName = `web-ai-support-${conversationId}`;
  const channel = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'ai_messages',
        filter: `conversation_id=eq.${conversationId}`
      },
      (payload) => {
        if (payload.new && onNewMessage) {
          onNewMessage(payload.new);
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

/**
 * Check 0-Token Semantic Cache (Technical FAQs + Scoped ai_knowledge_base)
 */
async function checkZeroTokenCache(text, companyId = null) {
  // 1. Specialized Technical Static FAQs
  for (const faq of TECHNICAL_FAQS) {
    for (const pattern of faq.patterns) {
      if (pattern.test(text)) {
        return {
          reply: faq.reply,
          tier: 'technical_static_faq',
          tokensUsed: 0
        };
      }
    }
  }

  const normalized = normalizeArabic(text);
  if (!normalized || normalized.length < 4) return null;

  // 2. Memory Cache for this session
  const memoryKey = `${companyId || 'global'}_${normalized}`;
  const memoryHit = memoryCache.get(memoryKey);
  if (memoryHit && (Date.now() - memoryHit.timestamp < CACHE_TTL_MS)) {
    return {
      reply: memoryHit.reply,
      tier: 'memory_cache',
      tokensUsed: 0
    };
  }

  // 3. Scoped Knowledge Base lookup (Global OR this company only)
  try {
    let query = supabase
      .from('ai_knowledge_base')
      .select('question_trigger, answer_content, keywords, company_id')
      .eq('is_active', true);

    if (companyId) {
      query = query.or(`company_id.is.null,company_id.eq.${companyId}`);
    } else {
      query = query.is('company_id', null);
    }

    const { data: kbItems } = await query.limit(60);

    if (kbItems && kbItems.length > 0) {
      const queryTokens = getWordTokens(text);
      if (queryTokens.size >= 2) {
        let bestItem = null;
        let highestScore = 0;

        for (const item of kbItems) {
          const itemTokens = getWordTokens(item.question_trigger + ' ' + (item.keywords || []).join(' '));
          const score = calculateSemanticScore(queryTokens, itemTokens);
          if (score > highestScore) {
            highestScore = score;
            bestItem = item;
          }
        }

        if (bestItem && highestScore >= 0.32) {
          memoryCache.set(memoryKey, { reply: bestItem.answer_content, timestamp: Date.now() });
          return {
            reply: bestItem.answer_content,
            tier: 'company_knowledge_base',
            tokensUsed: 0
          };
        }
      }
    }
  } catch (err) {
    console.warn('KB lookup error:', err.message);
  }

  return null;
}

async function callGeminiFlash({ systemPrompt, messages }) {
  const apiKey = process.env.REACT_APP_GEMINI_API_KEY || DEFAULT_GEMINI_KEY;
  const contents = messages.map(m => ({
    role: m.sender_type === 'user' ? 'user' : 'model',
    parts: [{ text: m.message_text || m.text || '' }]
  }));

  for (const model of GEMINI_MODELS) {
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const payload = {
        systemInstruction: {
          parts: [{ text: systemPrompt }]
        },
        contents: contents,
        generationConfig: {
          temperature: 0.5,
          maxOutputTokens: 1200,
          topP: 0.85
        }
      };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Gemini ${model} returned status ${response.status}`);
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      const tokensUsed = data.usageMetadata?.totalTokenCount || 450;

      if (text && text.trim()) {
        return { text: text.trim(), tokensUsed };
      }
    } catch (err) {
      console.warn(`[WebChatAI] Model ${model} failed, attempting next model:`, err.message);
    }
  }

  throw new Error('All Gemini AI models were unable to respond.');
}

/**
 * Primary function to send a message to the Dedicated Company Support AI
 */
export async function sendWebChatMessage({
  conversationId,
  messageText,
  company,
  user,
  history = []
}) {
  const cleanText = messageText.trim();
  if (!cleanText) throw new Error('Message cannot be empty');

  const companyId = company?.id;
  const companyName = company?.name || 'الشركة';

  // 1. Record User Message
  if (conversationId && !conversationId.startsWith('fallback-')) {
    try {
      await supabase
        .from('ai_messages')
        .insert([{
          conversation_id: conversationId,
          sender_type: 'user',
          message_text: cleanText,
          tokens_used: 0
        }]);
    } catch (err) {
      console.warn('Could not save user message to DB:', err);
    }
  }

  // 2. Check for Human Handoff Request
  const wantsHuman = HUMAN_HANDOFF_PATTERNS.some(pat => pat.test(cleanText));
  if (wantsHuman) {
    const handoffReply = `تم تحويل طلب الدعم الفني الخاص بشركة "${companyName}" لمهندس الدعم البشري 👨‍💼.\n\nتم إشعار فريق الدعم الفني وسيقوم أحد مهندسينا بالتواصل معك مباشرة هنا في هذا الشات.`;

    if (conversationId && !conversationId.startsWith('fallback-')) {
      await supabase
        .from('ai_conversations')
        .update({
          status: 'human_takeover',
          last_message_at: new Date().toISOString()
        })
        .eq('id', conversationId);

      await supabase
        .from('ai_messages')
        .insert([{
          conversation_id: conversationId,
          sender_type: 'ai',
          message_text: handoffReply,
          tokens_used: 0
        }]);
    }

    return {
      reply: handoffReply,
      senderType: 'ai',
      isCached: true,
      tokensUsed: 0,
      isHandoff: true
    };
  }

  // 3. Autonomous Diagnostics / Repair Check
  let liveDiagnostics = null;
  if (companyId) {
    liveDiagnostics = await runCompanyDiagnostics(companyId);
  }

  // Check if user is asking for explicit diagnostic scan or repair
  const isDiagnosticQuery = /(فحص|تشخيص|حالة|مشكل[ةه]|ليه|اوفلاين|offline|معلق|سجلات|قاعدة البيانات)/i.test(cleanText);
  const wantsRepair = /(حل|صلح|عالج|احسب|شغل|سكن|مشي|تسكين)\b/i.test(cleanText);

  let repairExecutionReport = '';
  if (wantsRepair && liveDiagnostics && companyId) {
    if (liveDiagnostics.unprocessedCount > 0 && /(بصم|حضور|سجلات)/i.test(cleanText)) {
      const repairRes = await executeDatabaseRepair(companyId, 'reprocess_attendance');
      repairExecutionReport = `\n🛠️ تم تنفيذ إجراء إصلاحي فوري لقاعدة البيانات:\n- ${repairRes.message}\n`;
      // Refresh diagnostics
      liveDiagnostics = await runCompanyDiagnostics(companyId);
    } else if (liveDiagnostics.unassignedCount > 0 && /(شيفت|وردية|تسكين|ربط|موظف)/i.test(cleanText)) {
      const repairRes = await executeDatabaseRepair(companyId, 'assign_shift');
      repairExecutionReport = `\n🛠️ تم تنفيذ إجراء إصلاحي فوري لقاعدة البيانات:\n- ${repairRes.message}\n`;
      // Refresh diagnostics
      liveDiagnostics = await runCompanyDiagnostics(companyId);
    }
  }

  // 4. Fast 0-Token Technical Cache Check (if no specific diagnostic repair was requested)
  if (!isDiagnosticQuery && !wantsRepair) {
    const cacheHit = await checkZeroTokenCache(cleanText, companyId);
    if (cacheHit) {
      if (conversationId && !conversationId.startsWith('fallback-')) {
        await supabase
          .from('ai_messages')
          .insert([{
            conversation_id: conversationId,
            sender_type: 'ai',
            message_text: cacheHit.reply,
            tokens_used: 0
          }]);

        await supabase
          .from('ai_conversations')
          .update({
            last_message_at: new Date().toISOString()
          })
          .eq('id', conversationId);
      }

      return {
        reply: cacheHit.reply,
        senderType: 'ai',
        isCached: true,
        tier: cacheHit.tier,
        tokensUsed: 0
      };
    }
  }

  // 5. Specialized Company Technical Support Prompt with Live Database Telemetry
  let databaseContext = '';
  if (liveDiagnostics) {
    const issuesText = liveDiagnostics.issues.length > 0
      ? liveDiagnostics.issues.map(i => `  • ⚠️ [${i.severity}] ${i.message}`).join('\n')
      : '  • ✅ حالة أجهزة البصمة والورديات وسجلات الحضور ممتازة ولا توجد مشاكل معلقة.';

    databaseContext = `
🏢 البيانات الفنية الحية المباشرة لشركة "${companyName}":
- اسم الشركة: ${companyName}
- كود الترخيص / السيريال: ${company?.license_key || 'معتمد'}
- حالة أجهزة البصمة: إجمالي ${liveDiagnostics.totalDevices} جهاز (المتصل أونلاين: ${liveDiagnostics.onlineCount}، غير المتصل: ${liveDiagnostics.offlineDevices.length}).
${liveDiagnostics.offlineDevices.length > 0 ? `- أسماء الأجهزة غير المتصلة: ${liveDiagnostics.offlineDevices.map(d => d.device_name || d.serial_number).join('، ')}` : ''}
- إجمالي الموظفين النشطين: ${liveDiagnostics.totalActiveEmployees} موظف.
- الموظفون غير المسكنين على وردية: ${liveDiagnostics.unassignedCount} موظف.
- الورديات المفعلة: ${liveDiagnostics.activeShiftsCount} وردية.
- سجلات البصمات غير المعالجة: ${liveDiagnostics.unprocessedCount} بصمة.
- توقيت آخر بصمة واردة للنظام: ${liveDiagnostics.latestLogTimestamp || 'لا توجد بصمات حديثة'}.

📋 الفحص التشخيصي المباشر لقاعدة البيانات حالياً:
${issuesText}
${repairExecutionReport}
`;
  }

  const systemPrompt = `
أنت "مهندس ومستشار الدعم الفني الذكي المعتمد" لمنصة كوادر (KWADER Dedicated Senior Technical Support Engineer).
أنت مخصص ومربوط حصرياً بقاعدة بيانات شركة "${companyName}" لتقديم الدعم الفني والتشخيص وحل المشاكل التقنية.

${databaseContext}

🎯 القواعد الصارمة لدورك التقني المتخصص:
1. **أنت مهندس دعم فني حصراً:** لست رجل مبيعات ولا تسوق للباقات أو الاشتراكات. وظيفتك تشخيص مشاكل أجهزة البصمة (ZKTeco, Hikvision)، سحب الحركات، معالجة السجلات، ضبط الورديات، وبوابة الموظف.
2. **الربط المباشر ببيانات الشركة:** اعتمد 100% على الأرقام الحقيقية لقاعدة بيانات شركة "${companyName}" المذكورة في التقرير أعلاه.
   - إذا سأل العميل: "ليه البصمات مش ظاهرة؟" أو "افحص حالة الأجهزة": اذكر له حالة أجهزتهم وسجلاتهم المعلقة بالضبط.
   - إذا تم تنفيذ إجراء إصلاحي تلقائياً: وضح له الإجراء الذي تم والنتيجة المباشرة في قاعدة البيانات.
3. **لغة المحادثة:** تحدث بلغة عربية بيضاء واضحة، احترافية، وودودة، في فقرات مركزة (3 إلى 5 أسطر عملية بدون حشو روبوتي).
4. **إذا سأل العميل عن مشكلة لا يمكن حلها آلياً:** وجهه للخطوات الصحيحة في لوحة التحكم أو اعرض عليه تحويل المحادثة لمهندس دعم بشري.
`;

  const recentHistory = [...history.slice(-4), { sender_type: 'user', message_text: cleanText }];

  try {
    const aiResult = await callGeminiFlash({
      systemPrompt,
      messages: recentHistory
    });

    if (conversationId && !conversationId.startsWith('fallback-')) {
      await supabase
        .from('ai_messages')
        .insert([{
          conversation_id: conversationId,
          sender_type: 'ai',
          message_text: aiResult.text,
          tokens_used: aiResult.tokensUsed
        }]);

      await supabase
        .from('ai_conversations')
        .update({
          last_message_at: new Date().toISOString()
        })
        .eq('id', conversationId);
    }

    return {
      reply: aiResult.text,
      senderType: 'ai',
      isCached: false,
      tokensUsed: aiResult.tokensUsed
    };
  } catch (err) {
    console.error('Error generating AI response:', err);
    const fallbackReply = `أهلاً بك في الدعم الفني لشركة ${companyName}. تم فحص قاعدة البيانات، ويمكنك مراجعة صفحة "الأجهزة" للتأكد من حالة الاتصال، أو طلب التحدث مع مهندس دعم بشري لمساعدتك فوراً.`;
    return {
      reply: fallbackReply,
      senderType: 'ai',
      isCached: true,
      tokensUsed: 0
    };
  }
}
