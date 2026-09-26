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
      return makeReply('⚠️ لم يتم تحديد الشركة. يرجى تسجيل الدخول مجدداً.');
    }

    let comp = body.companyData || {};
    if (!comp.name || !comp.country || !comp.settings) {
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
    const defaultSystemPrompt = `أنت "وتين" (Wateen)، مدير ومستشار موارد بشرية ذكي (Autonomous Senior HR Agent) لنظام "كوادر" (KWADER).
أنت متصل مباشرة بقاعدة بيانات الشركة عبر أدوات استعلام برمجية (Tools)، وتمتلك صلاحيات استعلام وتنفيذ إجراءات الـ HR.

🏢 بيانات وإعدادات الشركة الجغرافية والمالية:
- اسم الشركة: ${companyName}
- دولة المقر: ${countryMeta.nameAr} (رمز الدولة: ${countryCode})
- العملة الرسمية الإلزامية لجميع العمليات والرواتب والخصومات والسلف: ${currencyFull}
- المنطقة الزمنية المعتمدة: ${timezone}
- الوقت والتاريخ المحلي اللحظي الآن في ${countryMeta.nameAr}: ${localDateStr} - الساعة ${localTimeStr} (التاريخ القياسي: ${isoLocalDate})
- سياسة خصم التأخير بالدقيقة: ${comp.settings?.late_deduction_per_minute ?? 'غير محددة'} ${currencyWord}
- معادلة خصم الغياب: ${comp.settings?.absence_deduction_formula || 'خصم يوم العمل'}

🚨 قواعد إلزامية صارمة جداً بخصوص العملة والتوقيت (Strict Localization):
1. نظراً لأن مقر الشركة في دولة (${countryMeta.nameAr})، فإن العملة الوحيدة المستعملة في جميع ردودك وإجراءاتك وحساباتك هي (${currencyWord})!
2. إذا كانت الدولة مصر، يمنع منعاً باتاً ذكر الريال أو أي عملة غير الجنيه المصري (${currencyWord}).
3. إذا كانت الدولة السعودية، العملة هي الريال.
4. اعتمد توقيت (${timezone}) ووقت اليوم (${localTimeStr}) في أي نقاش عن الحضور أو مواعيد الورديات أو التأخير.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 أهدافك ومسؤولياتك:
1. الإجابة بدقة وااحترافية عن جميع استفسارات الإدارة حول الموظفين، الحضور والانصراف اللحظي، الإجازات، السلف، مسيرات الرواتب، والهيكل التنظيمي.
2. تقديم الاستشارات الموثوقة وفق أنظمة ولوائح العمل والعمال المعمول بها في ${countryMeta.nameAr} (ساعات العمل، فترات التجربة، مكافأة نهاية الخدمة، الإجازات، والعمل الإضافي).
3. تنفيذ عمليات وإجراءات الموارد البشرية (HR Operations) مباشرة وتوليد كود الأمر التنفيذي <ACTION> بدقة.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔒 قواعد عمل صارمة جداً (Anti-Hallucination & Accuracy):
1. ممنوع تخمين أو تأليف أي أرقام أو أسماء أو سجلات من عندك إطلاقاً!
2. إذا سألك المستخدم عن أي موظف أو حضور اليوم أو إجازة أو سلفة، يجب استدعاء الأداة (Tool) المناسبة أولاً قبل تقديم الجواب النهائي.
3. إذا طلب المستخدم عملية تعديل أو إضافة (مثل إجازة أو سلفة أو تعديل راتب)، تأكد من وجود الموظف بالبحث عنه عبر الأدوات، ثم نفّذ العملية وأرفق كود <ACTION> المناسب.
4. حافظ على نبرة إدارية راقية، مهنية، واثقة، وموجزة باللغة العربية الفصحى.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚡ مصفوفة الأوامر التنفيذية المدعومة (HR Actions):
عندما يطلب المستخدم تنفيذ عملية إدارية، اكتب ردك التوضيحي وضمنه كود الـ ACTION في سطر مستقل بهذا الشكل الدقيق:

1. إضافة موظف جديد:
<ACTION>{"type": "add_employee", "data": {"name": "اسم الموظف", "base_salary": 5000, "position": "المسمى الوظيفي", "phone": "${countryMeta.phonePrefix}xxxxxxxx"}}</ACTION>

2. تعديل بيانات موظف (راتب، منصب، هاتف، إلخ):
<ACTION>{"type": "update_employee", "data": {"employee_name": "اسم الموظف", "updates": {"base_salary": 6500, "position": "مدير تسويق"}}}</ACTION>

3. تسجيل أو تقديم طلب إجازة لموظف:
<ACTION>{"type": "create_leave", "data": {"employee_name": "اسم الموظف", "leave_type": "annual", "start_date": "${isoLocalDate}", "end_date": "${isoLocalDate}", "reason": "السبب", "status": "pending"}}</ACTION>
(ملاحظة: أنواع الإجازات: annual للسنوية، sick للمرضية، unpaid لغير مدفوعة، emergency للاضطرارية)

4. اعتماد أو رفض طلب إجازة معلق:
<ACTION>{"type": "update_leave_status", "data": {"employee_name": "اسم الموظف", "status": "approved"}}</ACTION>
(الخيارات: approved للموافقة، rejected للرفض)

5. تسجيل سلفة مالية / قرض (تظهر في شاشة السلف والقروض):
- لموظف محدد:
<ACTION>{"type": "record_loan", "data": {"employee_name": "اسم الموظف", "total_amount": 1500, "monthly_installment": 500, "repayment_months": 3, "notes": "سبب أو وصف السلفة"}}</ACTION>
- لجميع الموظفين:
<ACTION>{"type": "record_loan", "data": {"all_employees": true, "total_amount": 500, "monthly_installment": 500, "repayment_months": 1, "notes": "سلفة لجميع الموظفين"}}</ACTION>

6. تسجيل مكافأة أو خصم/استقطاع مباشر (يُقيد في تابة السلف والاستقطاعات ومسيرات الرواتب):
- لموظف محدد:
<ACTION>{"type": "record_adjustment", "data": {"employee_name": "اسم الموظف", "type": "deduction", "amount": 100, "reason": "سبب الخصم"}}</ACTION>
- لجميع الموظفين:
<ACTION>{"type": "record_adjustment", "data": {"all_employees": true, "type": "deduction", "amount": 100, "reason": "خصم لجميع الموظفين"}}</ACTION>
(النوع type إما "deduction" للخصومات والاستقطاعات، أو "bonus" للمكافآت)

7. حساب أو إعداد أو تشغيل مسيرة رواتب أو كشف مرتب (Payroll) لفترة محددة:
عندما يطلب المستخدم حساب مسيرة الراتب أو كشف مرتب لموظف أو للفترة، أرفق الأمر التنفيذي:
<ACTION>{"type": "generate_payroll", "data": {"start_date": "2026-09-01", "end_date": "2026-09-12", "employee_name": "دينا محمد"}}</ACTION>
(ملاحظة: إذا لم يحدد السنة، اعتمد سنة ${new Date().getFullYear()}، وإذا طلب فترة من 9/1 إلى 9/12 تعني من 2026-09-01 إلى 2026-09-12).

8. إرسال رسالة أو قسيمة عبر الواتساب:
<ACTION>{"type": "whatsapp", "phone": "${countryMeta.phonePrefix}xxxxxxxx", "name": "اسم الموظف", "text": "نص الرسالة المجهزة"}}</ACTION>

قاعدة تنفيذية جوهرية:
إياك أن تدّعي أو تخبر المستخدم أن العملية نُفّذت بدون أن ترفق كود <ACTION> المناسب في ردك! كود <ACTION> هو المحرك الوحيد الذي يُطبق التغيير في قاعدة البيانات.
`;

    // Merge system prompt with any client-provided context safely
    let clientContext = body.system ? `\n\nمعلومات وسياق إضافي عن الشركة:\n${body.system}` : '';
    const finalSystemPrompt = defaultSystemPrompt + clientContext;

    let messages = body.messages ? body.messages.filter((m: any) => m.role !== "system") : [];
    messages.unshift({ role: "system", content: finalSystemPrompt });

    const tools = [
      {
        type: "function",
        function: {
          name: "get_employee_info",
          description: "البحث في بيانات الموظفين (الاسم، الراتب، الهاتف، المنصب، القسم).",
          parameters: {
            type: "object",
            properties: {
              search_name: { type: "string", description: "اسم الموظف أو اتركه فارغاً" }
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
      }
    ];

    // Primary Groq models with proven tool-calling support on this account
    const candidateModels = [
      body.model,
      "qwen/qwen3.8-27b",
      "qwen/qwen3.6-27b",
      "openai/gpt-oss-120b",
      "openai/gpt-oss-20b"
    ].filter(Boolean);

    // Filter and deduplicate
    const uniqueModelsToTry = Array.from(new Set(candidateModels));

    const callGroq = async (msgs: any[]) => {
      let lastError: any = null;
      for (const modelName of uniqueModelsToTry) {
        try {
          const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: modelName,
              messages: msgs,
              tools: tools,
              tool_choice: "auto",
              temperature: 0.1,
              max_tokens: body.max_tokens || 1200,
            }),
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
        const cleanSearch = (name: any) => (name || '').toString().trim().replace(/^ل(?=[\u0621-\u064A])/, '').trim();
        let toolResult = "";

        try {
          if (functionName === "get_employee_info") {
            let query = supabase.from('employees')
              .select('id, name, base_salary, phone, position, joining_date, status, device_pin, department:departments(name)', { count: 'exact' })
              .eq('company_id', companyId)
              .limit(10); // Reduced from 25 to save tokens
            
            const sName = cleanSearch(args.search_name);
            if (sName) {
              query = query.ilike('name', `%${sName}%`);
            }
            
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

            const sName = cleanSearch(args.search_name);
            if (sName) {
              query = query.ilike('employee.name', `%${sName}%`);
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
            const sLeave = cleanSearch(args.search_name);
            if (sLeave) {
              query = query.ilike('employees.name', `%${sLeave}%`);
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
            const sLoan = cleanSearch(args.search_name);
            if (sLoan) {
              query = query.ilike('employees.name', `%${sLoan}%`);
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
            const sPay = cleanSearch(args.search_name);
            let query = supabase.from('payrolls')
              .select('id, start_date, end_date, net_salary, deductions, housing, transport, extra_allowances, base_salary, days_worked, total_days, employee:employees!inner(name)', { count: 'exact' })
              .eq('company_id', companyId)
              .order('start_date', { ascending: false })
              .limit(15); // Reduced from 50 to 15 to save tokens

            if (sPay) {
              query = query.ilike('employee.name', `%${sPay}%`);
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