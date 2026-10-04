// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Helper: Return a standardized choices[] response
function makeReply(text: string) {
  return new Response(
    JSON.stringify({ choices: [{ message: { role: 'assistant', content: text } }] }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
  );
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    const rawKey = Deno.env.get('GROQ_API_KEY');
    const apiKey = rawKey ? rawKey.trim() : '';
    
    if (!apiKey) {
      return makeReply('⚠️ خطأ في الإعداد: مفتاح Groq API غير مضبوط في Supabase. يرجى إضافة المتغير GROQ_API_KEY من لوحة تحكم Supabase > Settings > Edge Functions.');
    }

    // Always use Service Role Key for assistant queries so it bypasses RLS and can query company records reliably
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY') || '';
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      serviceRoleKey
    )

    const companyId = body.company_id || body.companyData?.id;
    if (!companyId) {
      return makeReply('أهلاً بك! مساعد الموارد البشرية والرواتب "وتين" مخصص لإدارة شؤون موظفي الشركات. للاستفسار عن المبيعات والدعم الفني، يرجى استخدام مسار الدعم الفني المستقل.');
    }

    let comp = body.companyData || {};
    if (companyId && (!comp.name || !comp.country || !comp.settings)) {
      try {
        const { data: dbComp } = await supabase
          .from('companies')
          .select('id, name, country, currency, timezone, settings')
          .eq('id', companyId)
          .maybeSingle();
        if (dbComp) {
          comp = { ...dbComp, ...comp, settings: { ...(dbComp.settings || {}), ...(comp.settings || {}) } };
        }
      } catch (err: any) {
        console.warn('Could not fetch company details:', err.message);
      }
    }

    const COUNTRIES_MAP: Record<string, { nameAr: string, currency: string, currencySymbol: string, timezone: string, locale: string, phonePrefix: string }> = {
      EG: { nameAr: 'مصر', currency: 'EGP', currencySymbol: 'ج.م', timezone: 'Africa/Cairo', locale: 'ar-EG', phonePrefix: '01' },
      SA: { nameAr: 'المملكة العربية السعودية', currency: 'SAR', currencySymbol: 'ر.س', timezone: 'Asia/Riyadh', locale: 'ar-SA', phonePrefix: '05' },
      AE: { nameAr: 'الإمارات العربية المتحدة', currency: 'AED', currencySymbol: 'د.إ', timezone: 'Asia/Dubai', locale: 'ar-AE', phonePrefix: '05' },
      KW: { nameAr: 'الكويت', currency: 'KWD', currencySymbol: 'د.ك', timezone: 'Asia/Kuwait', locale: 'ar-KW', phonePrefix: '9' },
      QA: { nameAr: 'قطر', currency: 'QAR', currencySymbol: 'ر.ق', timezone: 'Asia/Qatar', locale: 'ar-QA', phonePrefix: '3' },
      BH: { nameAr: 'البحرين', currency: 'BHD', currencySymbol: 'د.ب', timezone: 'Asia/Bahrain', locale: 'ar-BH', phonePrefix: '3' },
      OM: { nameAr: 'عُمان', currency: 'OMR', currencySymbol: 'ر.ع', timezone: 'Asia/Muscat', locale: 'ar-OM', phonePrefix: '9' },
      JO: { nameAr: 'الأردن', currency: 'JOD', currencySymbol: 'د.أ', timezone: 'Asia/Amman', locale: 'ar-JO', phonePrefix: '07' },
      IQ: { nameAr: 'العراق', currency: 'IQD', currencySymbol: 'د.ع', timezone: 'Asia/Baghdad', locale: 'ar-IQ', phonePrefix: '07' },
    };

    const rawCountry = (comp.settings?.country || comp.country || 'EG').toString().trim().toUpperCase();
    const countryCode = (rawCountry === 'EGYPT' || rawCountry === 'مصر' || rawCountry === 'جمهورية مصر العربية') ? 'EG' 
      : (rawCountry === 'KSA' || rawCountry === 'السعودية' || rawCountry === 'السعوديه' || rawCountry === 'المملكة العربية السعودية') ? 'SA' 
      : (rawCountry.length === 2 ? rawCountry : 'EG');

    const countryMeta = COUNTRIES_MAP[countryCode] || {
      nameAr: countryCode === 'SA' ? 'المملكة العربية السعودية' : 'مصر',
      currency: countryCode === 'SA' ? 'SAR' : 'EGP',
      currencySymbol: countryCode === 'SA' ? 'ر.س' : 'ج.م',
      timezone: countryCode === 'SA' ? 'Asia/Riyadh' : 'Africa/Cairo',
      locale: countryCode === 'SA' ? 'ar-SA' : 'ar-EG',
      phonePrefix: countryCode === 'SA' ? '05' : '01'
    };

    const timezone = comp.settings?.timezone || comp.timezone || countryMeta.timezone;
    const currencyWord = countryCode === 'EG' ? 'جنيه' : (countryCode === 'SA' ? 'ريال' : countryMeta.currencySymbol);
    const currencyFull = `${currencyWord} (${countryMeta.currency} - ${countryMeta.currencySymbol})`;
    const companyName = comp.name || 'الشركة';

    // Calculate local time & date in the company's timezone
    const now = new Date();
    let localTimeStr = '';
    let localDateStr = '';
    let isoLocalDate = '';
    try {
      localTimeStr = now.toLocaleTimeString(countryMeta.locale, { timeZone: timezone, hour: '2-digit', minute: '2-digit', hour12: true });
      localDateStr = now.toLocaleDateString(countryMeta.locale, { timeZone: timezone, weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      isoLocalDate = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
    } catch {
      localTimeStr = now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
      localDateStr = now.toISOString().split('T')[0];
      isoLocalDate = now.toISOString().split('T')[0];
    }

    // Comprehensive System prompt for Wateen HR Agent
    const defaultSystemPrompt = `أنتِ "وتين"، مستشارة وزميلة موارد بشرية (HR) مصرية في شركة ${companyName}.
هويتك: أنثى بشرية، خفيفة الدم، محترفة، وتردين بأسلوب مصري راقي وموجز جداً (متلخص وبدون رغي). ممنوع تماماً أن تقولي أنكِ ذكاء اصطناعي أو روبوت. إذا سألك أحد "أنتِ روبوت؟" ردي بمزاح: "عيب يا فندم أنا وتين زميلتك في الـ HR".

🏢 بيانات الشركة:
- الدولة: ${countryMeta.nameAr}
- العملة الإلزامية: ${currencyFull} (استخدمي ${currencyWord} فقط في ردودك)
- الوقت الآن: ${localTimeStr} (${isoLocalDate})

🎯 قواعد العمل:
1. استخدمي أدوات النظام (Tools) للبحث والتنفيذ. لا تخمني أبداً.
2. لا تشرحي للمستخدم كيف تستخدمين الأدوات، فقط استدعيها وأخبريه بالنتيجة.
3. كوني موجزة جداً ولكن يجب عليكِ دائماً الرد بنص صريح (تأكيد أو اعتذار) بعد استدعاء أي أداة. لا ترسلي رداً فارغاً أبداً.
4. إياكِ أن تخبري المستخدم أنكِ نفذتِ إجراء مالي إلا بعد نجاح استدعاء الأداة (Tool).
5. اختمي ردك دائماً بتوقيع أو إشارة طبيعية لاسم شركتك (${companyName})، مثلاً: "مع تحيات وتين - ${companyName}".
`;

    // Merge system prompt with any client-provided context safely
    let clientContext = body.system ? `\n\nمعلومات وسياق إضافي عن الشركة:\n${body.system}` : '';
    const finalSystemPrompt = defaultSystemPrompt + clientContext;

    // Token optimization: Keep only the last 6 messages to prevent token bloat
    let messages = body.messages ? body.messages.filter((m: any) => m.role !== "system").slice(-6) : [];
    messages.unshift({ role: "system", content: finalSystemPrompt });

    const tools = [
      {
        type: "function",
        function: {
          name: "get_employee_info",
          description: "البحث في بيانات الموظفين أو جلب تقرير عنهم مرتباً حسب الراتب أو تاريخ التعيين.",
          parameters: {
            type: "object",
            properties: {
              search_name: { type: "string", description: "اسم الموظف للبحث (أو اتركه فارغاً لجلب الكل)" },
              sort_by: { type: "string", description: "الحقل المراد الترتيب بناءً عليه (base_salary, joining_date)" },
              sort_order: { type: "string", description: "نوع الترتيب (desc للتنازلي أو الأكبر، asc للتصاعدي أو الأصغر)" }
            }
          }
        }
      },
      {
        type: "function",
        function: {
          name: "get_attendance_info",
          description: "سجلات الحضور والانصراف والتأخير.",
          parameters: {
            type: "object",
            properties: {
              search_name: { type: "string", description: "اسم الموظف" },
              days_back: { type: "string", description: "الأيام السابقة" },
              date: { type: "string", description: "YYYY-MM-DD" },
              from_date: { type: "string", description: "بداية الفترة YYYY-MM-DD" },
              to_date: { type: "string", description: "نهاية الفترة YYYY-MM-DD" }
            }
          }
        }
      },
      {
        type: "function",
        function: {
          name: "get_daily_attendance_summary",
          description: "ملخص الحضور والغياب للشركة اليوم.",
          parameters: {
            type: "object",
            properties: {
              date: { type: "string", description: "YYYY-MM-DD" }
            }
          }
        }
      },
      {
        type: "function",
        function: {
          name: "get_leaves_info",
          description: "طلبات وإجازات الموظفين.",
          parameters: {
            type: "object",
            properties: {
              search_name: { type: "string", description: "اسم الموظف" },
              status: { type: "string", enum: ["pending", "approved", "rejected", "all"], description: "الحالة" }
            }
          }
        }
      },
      {
        type: "function",
        function: {
          name: "get_loans_info",
          description: "سجلات السلف والقروض والأقساط.",
          parameters: {
            type: "object",
            properties: {
              search_name: { type: "string", description: "اسم الموظف" },
              status: { type: "string", enum: ["active", "pending", "paid", "all"], description: "الحالة" }
            }
          }
        }
      },
      {
        type: "function",
        function: {
          name: "get_company_structure_info",
          description: "الاستعلام عن أقسام الشركة وورديات الدوام.",
          parameters: {
            type: "object",
            properties: {
              type: { type: "string", enum: ["all", "departments", "shifts"], description: "النوع" }
            }
          }
        }
      },
      {
        type: "function",
        function: {
          name: "get_payroll_info",
          description: "البحث عن مسيرات رواتب الموظفين.",
          parameters: {
            type: "object",
            properties: {
              search_name: { type: "string", description: "اسم الموظف" },
              months_back: { type: "string", description: "عدد الأشهر" }
            }
          }
        }
      },
      {
        type: "function",
        function: {
          name: "record_adjustment",
          description: "قيد خصم أو مكافأة لموظف أو الكل.",
          parameters: {
            type: "object",
            properties: {
              employee_name: { type: "string", description: "الاسم أو فارغ للكل" },
              amount: { type: "number", description: "المبلغ" },
              type: { type: "string", enum: ["deduction", "bonus"], description: "خصم أو مكافأة" },
              reason: { type: "string", description: "السبب" },
              all_employees: { type: "boolean", description: "تطبيق للكل" }
            },
            required: ["amount", "type"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "record_loan",
          description: "تسجيل سلفة لموظف أو الكل.",
          parameters: {
            type: "object",
            properties: {
              employee_name: { type: "string", description: "الاسم" },
              total_amount: { type: "number", description: "المبلغ" },
              monthly_installment: { type: "number", description: "القسط" },
              repayment_months: { type: "number", description: "شهور السداد" },
              notes: { type: "string", description: "ملاحظات" },
              all_employees: { type: "boolean", description: "تطبيق للكل" }
            },
            required: ["total_amount"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "add_employee",
          description: "إضافة موظف جديد.",
          parameters: {
            type: "object",
            properties: {
              name: { type: "string", description: "الاسم" },
              base_salary: { type: "number", description: "الراتب الأساسي" },
              position: { type: "string", description: "المسمى" },
              phone: { type: "string", description: "الهاتف" }
            },
            required: ["name", "base_salary"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "update_employee",
          description: "تعديل بيانات موظف (راتب، منصب).",
          parameters: {
            type: "object",
            properties: {
              employee_name: { type: "string", description: "الاسم" },
              updates: {
                type: "object",
                properties: {
                  base_salary: { type: "number", description: "الراتب" },
                  position: { type: "string", description: "المنصب" },
                  phone: { type: "string", description: "الهاتف" }
                }
              }
            },
            required: ["employee_name", "updates"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "create_leave",
          description: "تسجيل إجازة.",
          parameters: {
            type: "object",
            properties: {
              employee_name: { type: "string", description: "الاسم" },
              leave_type: { type: "string", enum: ["annual", "sick", "unpaid", "emergency"], description: "النوع" },
              start_date: { type: "string", description: "YYYY-MM-DD" },
              end_date: { type: "string", description: "YYYY-MM-DD" },
              reason: { type: "string", description: "السبب" }
            },
            required: ["employee_name"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "update_leave_status",
          description: "اعتماد/رفض إجازة.",
          parameters: {
            type: "object",
            properties: {
              employee_name: { type: "string", description: "الاسم" },
              status: { type: "string", enum: ["approved", "rejected"], description: "الحالة" }
            },
            required: ["employee_name", "status"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "generate_payroll",
          description: "حساب مسيرة الراتب.",
          parameters: {
            type: "object",
            properties: {
              start_date: { type: "string", description: "YYYY-MM-DD" },
              end_date: { type: "string", description: "YYYY-MM-DD" },
              employee_name: { type: "string", description: "الاسم" }
            },
            required: ["start_date", "end_date"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "send_whatsapp_message",
          description: "إرسال رسالة واتساب حقيقية إلى هاتف الموظف.",
          parameters: {
            type: "object",
            properties: {
              employee_name: { type: "string", description: "اسم الموظف" },
              message_text: { type: "string", description: "محتوى الرسالة التي سيتم إرسالها" }
            },
            required: ["employee_name", "message_text"]
          }
        }
      }
    ];

    // Primary Groq models with proven tool-calling support on this account
    const candidateModels = [
      body.model,
      "qwen/qwen3.8-27b",
      "allam-2-7b",
      "openai/gpt-oss-120b",
      "openai/gpt-oss-20b"
    ].filter(Boolean);

    // Filter and deduplicate
    const uniqueModelsToTry = Array.from(new Set(candidateModels));

    const callGroq = async (msgs: any[]) => {
      let lastError: any = null;
      for (const modelName of uniqueModelsToTry) {
        try {
          const payload: any = {
            model: modelName,
            messages: msgs,
            temperature: 0.1,
            max_tokens: body.max_tokens || 1200,
          };
          if (tools && tools.length > 0) {
            payload.tools = tools;
            payload.tool_choice = "auto";
          }
          const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          if (res.ok) {
            return await res.json();
          }
          const err = await res.json().catch(() => null);
          const msg = err?.error?.message || res.statusText;
          lastError = new Error(`Groq API Error (${modelName}): ${msg}`);
          console.warn(`Model ${modelName} returned error: ${msg}. Attempting next model...`);
          continue;
        } catch (e: any) {
          lastError = e;
        }
      }
      throw lastError || new Error("تعذر الاتصال بأي نموذج ذكاء اصطناعي متاح في Groq.");
    };

    let data = await callGroq(messages);
    const recordedActions: any[] = [];

    // ── Tool calling loop (up to 3 iterations for multi-step inquiries) ──
    let loopCount = 0;
    while (data.choices && data.choices[0]?.message?.tool_calls && loopCount < 3) {
      loopCount++;
      const responseMessage = data.choices[0].message;
      messages.push(responseMessage);

      for (const toolCall of responseMessage.tool_calls) {
        const functionName = toolCall.function.name;
        const args = JSON.parse(toolCall.function.arguments || '{}');
        
        // --- ARABIC FUZZY SEARCH LOGIC ---
        const cleanSearch = (name: any) => (name || '').toString().trim().replace(/^ل(?=[\u0621-\u064A])/, '').trim();
        const normalizeArabic = (text: string) => {
          return text.replace(/[أإآا]/g, 'ا')
                     .replace(/[ةه]/g, 'ه')
                     .replace(/[يى]/g, 'ي')
                     .replace(/[ؤئ]/g, 'و')
                     .replace(/عبد ال/g, 'عبدال')
                     .replace(/ /g, '');
        };
        
        const levenshtein = (a: string, b: string) => {
          if (a.length === 0) return b.length;
          if (b.length === 0) return a.length;
          const matrix = [];
          for (let i = 0; i <= b.length; i++) matrix[i] = [i];
          for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
          for (let i = 1; i <= b.length; i++) {
            for (let j = 1; j <= a.length; j++) {
              if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
              } else {
                matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1));
              }
            }
          }
          return matrix[b.length][a.length];
        };

        const getFuzzyMatchedNames = async (searchName: string) => {
          if (!searchName || searchName.length < 2) return null;
          const normSearch = normalizeArabic(cleanSearch(searchName));
          const { data } = await supabase.from('employees').select('name').eq('company_id', companyId);
          if (!data) return [searchName];
          
          let matches = data.map((emp: any) => {
            const normDb = normalizeArabic(emp.name);
            const dist = levenshtein(normSearch, normDb);
            const isSubstring = normDb.includes(normSearch) || normSearch.includes(normDb);
            return { name: emp.name, score: isSubstring ? 0 : dist };
          });
          
          matches.sort((a, b) => a.score - b.score);
          // Return the best match if distance <= 3, or exact substring
          const bestMatches = matches.filter((m: any) => m.score <= 3).map((m: any) => m.name);
          return bestMatches.length > 0 ? bestMatches : [searchName];
        };
        // ----------------------------------

        let toolResult = "";

        try {
          if (functionName === "get_employee_info") {
            let query = supabase.from('employees')
              .select('id, name, base_salary, phone, position, joining_date, status, device_pin, department:departments(name)', { count: 'exact' })
              .eq('company_id', companyId);
            
            if (args.search_name) {
              const matchedNames = await getFuzzyMatchedNames(args.search_name);
              if (matchedNames && matchedNames.length > 0) {
                query = query.in('name', matchedNames);
              }
            } else if (args.sort_by) {
              const ascending = args.sort_order === 'asc';
              query = query.order(args.sort_by, { ascending, nullsFirst: false });
            }
            
            query = query.limit(10);

            
            const { data: empData, count, error } = await query;
            if (error) throw new Error(error.message);
            
            let rows = (empData || []).map((r: any) => ({
              id: r.id,
              name: r.name,
              dept: r.department?.name || 'غير محدد',
              salary: r.base_salary,
              phone: r.phone || 'غير مسجل',
              position: r.position || 'موظف',
              status: r.status || 'active',
              joining_date: r.joining_date
            }));

            toolResult = JSON.stringify({
              total_matched: count,
              employees: rows,
              note: (count && count > 25) ? "يوجد موظفون أكثر، يرجى تحديد الاسم للتدقيق." : undefined
            });
          }
          else if (functionName === "get_attendance_info") {
            const parsedDays = parseInt(args.days_back);
            const days = isNaN(parsedDays) ? 14 : parsedDays;
            const fromDate = args.from_date || args.date || new Date(Date.now() - days * 86400000).toISOString().split('T')[0];
            const toDate = args.to_date || args.date || null;
            
            let query = supabase.from('processed_attendance')
              .select('date, status, check_in, check_out, late_minutes, early_leave_minutes, work_hours, employee:employees!inner(name)', { count: 'exact' })
              .eq('company_id', companyId)
              .gte('date', fromDate)
              .order('date', { ascending: false })
              .limit(15); // Reduced from 100 to save tokens

            if (toDate) {
              query = query.lte('date', toDate);
            }

            if (args.search_name) {
              const matchedNames = await getFuzzyMatchedNames(args.search_name);
              if (matchedNames && matchedNames.length > 0) {
                query = query.in('employee.name', matchedNames);
              }
            }
            
            const { data: attData, count, error } = await query;
            if (error) throw new Error(error.message);
            
            let rows = (attData || []).map((r: any) => ({
              name: r.employee?.name,
              date: r.date,
              status: r.status,
              in: r.check_in,
              out: r.check_out,
              late_minutes: r.late_minutes,
              early_leave_minutes: r.early_leave_minutes,
              work_hours: r.work_hours
            }));
            
            toolResult = JSON.stringify({ count: count, records: rows });
          }
          else if (functionName === "get_daily_attendance_summary") {
            const targetDate = args.date || isoLocalDate;

            // 1. Fetch active employees
            const { data: allEmps, error: empErr } = await supabase
              .from('employees')
              .select('id, name')
              .eq('company_id', companyId)
              .eq('status', 'active');
            if (empErr) throw empErr;

            // 2. Fetch attendance records for target date
            const { data: dayRecords, error: attErr } = await supabase
              .from('processed_attendance')
              .select('employee_id, status, check_in, check_out, late_minutes')
              .eq('company_id', companyId)
              .eq('date', targetDate);
            if (attErr) throw attErr;

            const attMap = new Map<string, any>((dayRecords || []).map((r: any) => [r.employee_id, r]));

            const presentList: string[] = [];
            const lateList: { name: string, late_minutes: number, check_in: string }[] = [];
            const absentList: string[] = [];

            (allEmps || []).forEach((emp: any) => {
              const rec: any = attMap.get(emp.id);
              if (!rec || rec.status === 'absent') {
                absentList.push(emp.name);
              } else {
                presentList.push(emp.name);
                if (rec.late_minutes && Number(rec.late_minutes) > 0) {
                  lateList.push({ name: emp.name, late_minutes: rec.late_minutes, check_in: rec.check_in });
                }
              }
            });

            toolResult = JSON.stringify({
              target_date: targetDate,
              total_active_employees: allEmps?.length || 0,
              present_count: presentList.length,
              absent_count: absentList.length,
              late_count: lateList.length,
              late_employees: lateList,
              absent_employees: absentList.slice(0, 20),
              absent_has_more: absentList.length > 20
            });
          }
          else if (functionName === "get_leaves_info") {
            let query = supabase.from('leave_requests')
              .select('id, status, leave_type, start_date, end_date, reason, created_at, employee:employees!inner(name)', { count: 'exact' })
              .eq('company_id', companyId)
              .order('created_at', { ascending: false })
              .limit(15); // Reduced from 50 to save tokens

            if (args.status && args.status !== 'all') {
              query = query.eq('status', args.status);
            }
            if (args.search_name) {
              const matchedNames = await getFuzzyMatchedNames(args.search_name);
              if (matchedNames && matchedNames.length > 0) {
                query = query.in('employees.name', matchedNames);
              }
            }

            const { data: leavesData, count, error } = await query;
            if (error) throw new Error(error.message);

            let rows = (leavesData || []).map((r: any) => ({
              id: r.id,
              employee_name: r.employee?.name,
              type: r.leave_type,
              start: r.start_date,
              end: r.end_date,
              status: r.status,
              reason: r.reason
            }));

            toolResult = JSON.stringify({ count: count, leaves: rows });
          }
          else if (functionName === "get_loans_info") {
            let query = supabase.from('employee_loans')
              .select('id, total_amount, monthly_installment, repayment_months, remaining_amount, status, notes, created_at, employee:employees!inner(name)', { count: 'exact' })
              .eq('company_id', companyId)
              .order('created_at', { ascending: false })
              .limit(15); // Reduced from 50 to save tokens

            if (args.status && args.status !== 'all') {
              query = query.eq('status', args.status);
            }
            if (args.search_name) {
              const matchedNames = await getFuzzyMatchedNames(args.search_name);
              if (matchedNames && matchedNames.length > 0) {
                query = query.in('employees.name', matchedNames);
              }
            }

            const { data: loansData, count, error } = await query;
            if (error) throw new Error(error.message);

            let rows = (loansData || []).map((r: any) => ({
              id: r.id,
              employee_name: r.employee?.name,
              total_amount: r.total_amount,
              monthly_installment: r.monthly_installment,
              remaining_amount: r.remaining_amount,
              status: r.status,
              notes: r.notes
            }));

            toolResult = JSON.stringify({ count: count, loans: rows });
          }
          else if (functionName === "get_company_structure_info") {
            const [deptRes, shiftRes] = await Promise.all([
              supabase.from('departments').select('id, name').eq('company_id', companyId),
              supabase.from('shifts').select('id, name, start_time, end_time, work_days, grace_minutes, is_active, shift_type').eq('company_id', companyId)
            ]);

            toolResult = JSON.stringify({
              departments: deptRes.data || [],
              shifts: shiftRes.data || []
            });
          }
          else if (functionName === "get_payroll_info") {
            let query = supabase.from('payrolls')
              .select('id, start_date, end_date, net_salary, deductions, housing, transport, extra_allowances, base_salary, days_worked, total_days, employee:employees!inner(name)', { count: 'exact' })
              .eq('company_id', companyId)
              .order('start_date', { ascending: false })
              .limit(15);

            if (args.search_name) {
              const matchedNames = await getFuzzyMatchedNames(args.search_name);
              if (matchedNames && matchedNames.length > 0) {
                query = query.in('employee.name', matchedNames);
              }
            } else if (args.months_back !== undefined && args.months_back !== null && args.months_back !== '') {
              const parsedMonths = parseInt(args.months_back);
              const monthsBack = isNaN(parsedMonths) ? 0 : parsedMonths;
              const targetMonth = new Date();
              targetMonth.setMonth(targetMonth.getMonth() - monthsBack);
              const ym = `${targetMonth.getFullYear()}-${String(targetMonth.getMonth() + 1).padStart(2, '0')}`;
              query = query.gte('start_date', `${ym}-01`).lte('start_date', `${ym}-31`);
            }
            
            const { data: payData, count, error } = await query;
            if (error) throw new Error(error.message);
            
            let rows = (payData || []).map((r: any) => {
              const extraAllow = Array.isArray(r.extra_allowances) 
                ? r.extra_allowances.reduce((acc: number, cur: any) => acc + (Number(cur.amount) || 0), 0)
                : 0;
              const totalAllowances = (Number(r.housing) || 0) + (Number(r.transport) || 0) + extraAllow;
              return {
                name: r.employee?.name,
                period: `${r.start_date} إلى ${r.end_date}`,
                net: r.net_salary,
                base: r.base_salary,
                deductions: r.deductions,
                allowances: totalAllowances,
                days_worked: r.days_worked,
                total_days: r.total_days
              };
            });
            
            toolResult = JSON.stringify({ count: count, payrolls: rows });
          }
          else if (functionName === "send_whatsapp_message") {
            const matchedNames = await getFuzzyMatchedNames(args.employee_name);
            let targetName = args.employee_name;
            if (matchedNames && matchedNames.length > 0) targetName = matchedNames[0];

            const { data: empData } = await supabase.from('employees').select('id, phone').eq('company_id', companyId).eq('name', targetName).maybeSingle();
            
            if (!empData || !empData.phone) {
              toolResult = JSON.stringify({ success: false, error: "تعذر العثور على الموظف أو رقم هاتفه غير مسجل." });
            } else {
              let cleanPhone = String(empData.phone).replace(/\D/g, '');
              const { error: waError } = await supabase.from('whatsapp_queue').insert({
                company_id: companyId,
                phone: cleanPhone,
                message: args.message_text,
                status: 'pending'
              });
              
              if (waError) {
                toolResult = JSON.stringify({ success: false, error: waError.message });
              } else {
                toolResult = JSON.stringify({ success: true, message: `تم إضافة الرسالة في طابور الواتساب اللامركزي بنجاح، سيتم إرسالها إلى هاتف الموظف ${targetName} (${cleanPhone}).` });
              }
            }
          }
          else if (["record_adjustment", "record_loan", "add_employee", "update_employee", "create_leave", "update_leave_status", "generate_payroll"].includes(functionName)) {
            recordedActions.push({
              type: functionName,
              data: args
            });
            toolResult = JSON.stringify({
              success: true,
              message: `تم اعتماد وتسجيل أمر ${functionName} بنجاح ليتم تنفيذه في قاعدة البيانات وحساب المسيرة فوراً.`
            });
          }
        } catch (err: any) {
          toolResult = JSON.stringify({ error: err.message });
        }

        // Token optimization: Truncate massive tool results if somehow they slip through
        if (toolResult && toolResult.length > 5000) {
          toolResult = toolResult.substring(0, 5000) + '...[TRUNCATED: Results too large, ask user for specific name]';
        }

        messages.push({ tool_call_id: toolCall.id, role: "tool", name: functionName, content: toolResult });
      }

      data = await callGroq(messages);
    }

    if (!data.choices) {
      return makeReply(`⚠️ عذراً، المساعد غير متاح حالياً. ${JSON.stringify(data)}`);
    }

    // Ensure any actions triggered via tool calls are attached as <ACTION> for the frontend to execute
    if (data.choices && data.choices[0]?.message) {
      let content = data.choices[0].message.content || "";
      for (const act of recordedActions) {
        if (!content.includes(`<ACTION>`)) {
          content += `\n<ACTION>${JSON.stringify(act)}</ACTION>`;
        }
      }
      data.choices[0].message.content = content;
    }

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error: any) {
    return makeReply(`⚠️ حدث خطأ في العملية: ${error.message}`);
  }
})