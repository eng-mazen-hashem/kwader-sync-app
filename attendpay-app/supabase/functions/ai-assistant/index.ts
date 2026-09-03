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
    const apiKey = Deno.env.get('GROQ_API_KEY')
    
    if (!apiKey) {
      return makeReply('⚠️ خطأ في الإعداد: مفتاح Groq API غير مضبوط في Supabase. يرجى إضافة المتغير GROQ_API_KEY من لوحة تحكم Supabase > Settings > Edge Functions.');
    }

    const authHeader = req.headers.get('Authorization')
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader || '' } } }
    )

    const companyId = body.company_id || body.companyData?.id;
    if (!companyId) {
      return makeReply('⚠️ لم يتم تحديد الشركة. يرجى تسجيل الدخول مجدداً.');
    }

    // Default System prompt (fallback if not provided by frontend)
    const defaultSystemPrompt = `أنت "وتين"، مدير موارد بشرية ذكي لشركة.
لقد تم تزويدك بأدوات (Tools) للبحث المباشر في قاعدة بيانات الشركة. 
تاريخ اليوم: ${new Date().toLocaleDateString('ar-SA')}

تعليمات صارمة جداً:
1. لا تخمن أي معلومة أبداً! إذا سألك المستخدم عن موظف، استخدم الأدوات (Tools) فوراً.
2. إذا طلب إرسال رسالة واتساب، استخدم الكود:
<ACTION>{"type": "whatsapp", "phone": "رقم_الهاتف", "name": "اسم_الموظف", "text": "الرسالة"}</ACTION>
3. إذا طلب إضافة موظف، أرسل:
<ACTION>{"type": "add_employee", "data": {"name": "الاسم", "base_salary": الراتب_كرقم}}</ACTION>`;

    // Always use the strictly defined default system prompt to prevent prompt injection
    const finalSystemPrompt = defaultSystemPrompt;

    let messages = body.messages ? body.messages.filter((m: any) => m.role !== "system") : [];
    messages.unshift({ role: "system", content: finalSystemPrompt });

    const tools = [
      {
        type: "function",
        function: {
          name: "get_employee_info",
          description: "ابحث عن بيانات الموظفين والمناصب، أرقام الهواتف، الأقسام والورديات، الراتب، تاريخ الانضمام، وحالة الموظف.",
          parameters: {
            type: "object",
            properties: {
              search_name: { type: "string", description: "اسم الموظف للبحث عنه. اتركه فارغاً لعرض الكل." }
            }
          }
        }
      },
      {
        type: "function",
        function: {
          name: "get_attendance_info",
          description: "ابحث عن سجلات الحضور والانصراف وأوقات الدخول والخروج",
          parameters: {
            type: "object",
            properties: {
              search_name: { type: "string", description: "اسم الموظف" },
              days_back: { type: "string", description: "عدد الأيام السابقة للبحث (مثال: '3', '7')" }
            }
          }
        }
      },
      {
        type: "function",
        function: {
          name: "get_payroll_info",
          description: "ابحث عن الراتب المعتمد، الخصومات، وصافي الراتب لموظف",
          parameters: {
            type: "object",
            properties: {
              search_name: { type: "string", description: "اسم الموظف" },
              months_back: { type: "string", description: "عدد الأشهر السابقة للبحث (مثال: '1' للشهر الماضي، '0' للشهر الحالي)" }
            }
          }
        }
      }
    ];

    const callGroq = async (msgs: any[]) => {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: body.model || "llama-3.3-70b-versatile",
          messages: msgs,
          tools: tools,
          tool_choice: "auto",
          temperature: 0.1,
          max_tokens: body.max_tokens || 800,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(`Groq API Error: ${err?.error?.message || res.statusText}`);
      }
      return await res.json();
    };

    let data = await callGroq(messages);

    // ── Tool calling loop (up to 3 iterations for complex multi-step queries) ──
    let loopCount = 0;
    while (data.choices && data.choices[0]?.message?.tool_calls && loopCount < 3) {
      loopCount++;
      const responseMessage = data.choices[0].message;
      messages.push(responseMessage);

      for (const toolCall of responseMessage.tool_calls) {
        const functionName = toolCall.function.name;
        const args = JSON.parse(toolCall.function.arguments);
        let toolResult = "";

        try {
          if (functionName === "get_employee_info") {
            let query = supabase.from('employees')
              .select('id, name, base_salary, phone, position, joining_date, status, device_pin', { count: 'exact' })
              .eq('company_id', companyId)
              .limit(20);
            
            if (args.search_name) {
              query = query.ilike('name', `%${args.search_name}%`);
            }
            
            const { data: empData, count, error } = await query;
            if (error) throw new Error(error.message);
            let rows = (empData || []).map((r: any) => ([r.name, r.departments?.name || '-', r.shifts?.name || '-', r.base_salary, r.phone, r.position, r.status, r.joining_date]));
            toolResult = JSON.stringify({ 
              cols: ['name','dept','shift','salary','phone','pos','status','joining_date'],
              data: rows, 
              note: (count && count > 20) ? "هناك المزيد من الموظفين، يرجى الاستعلام باسم أكثر تحديدا." : undefined 
            });
          }
          else if (functionName === "get_attendance_info") {
            const parsedDays = parseInt(args.days_back);
            const days = isNaN(parsedDays) ? 1 : parsedDays;
            
            // Calculate a safe range: from (today - days) to (today)
            // But if user asks for yesterday, we should definitely include it.
            const fromDate = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];
            
            let query = supabase.from('processed_attendance')
              .select('date, status, check_in, check_out, late_minutes, overtime_minutes, early_departure_minutes, employees!inner(name)', { count: 'exact' })
              .eq('company_id', companyId)
              .gte('date', fromDate)
              .order('date', { ascending: false })
              .limit(100); // Increased limit from 30 to 100

            if (args.search_name) {
              query = query.ilike('employees.name', `%${args.search_name}%`);
            }
            
            const { data: attData, count, error } = await query;
            if (error) throw new Error(error.message);
            
            let rows = (attData || []).map((r: any) => ([
              r.employees?.name, r.employees?.departments?.name || '-', r.date, r.status, r.check_in, r.check_out, r.late_minutes, r.overtime_minutes
            ]));
            
            toolResult = JSON.stringify({
              cols: ['name','dept','date','status','in','out','lateMins','overtime'],
              data: rows,
              count: count,
              note: (count && count > 100) ? "There are more records. Use search_name to filter." : undefined,
              tip: rows.length === 0 ? "No records found in this range. Try increasing days_back." : undefined
            });
          }
          else if (functionName === "get_payroll_info") {
            const parsedMonths = parseInt(args.months_back);
            const monthsBack = isNaN(parsedMonths) ? 0 : parsedMonths;
            const targetMonth = new Date();
            targetMonth.setMonth(targetMonth.getMonth() - monthsBack);
            const firstDay = new Date(targetMonth.getFullYear(), targetMonth.getMonth(), 1).toISOString().split('T')[0];
            
            let query = supabase.from('payrolls')
              .select('net_salary, deductions, allowances, base_salary, days_worked, total_days, employees!inner(name)', { count: 'exact' })
              .eq('company_id', companyId)
              .eq('start_date', firstDay)
              .limit(50); // Increased from 20

            if (args.search_name) {
              query = query.ilike('employees.name', `%${args.search_name}%`);
            }
            
            const { data: payData, count, error } = await query;
            if (error) throw new Error(error.message);
            
            let rows = (payData || []).map((r: any) => ([
              r.employees?.name, r.employees?.departments?.name || '-', r.net_salary, r.base_salary, r.deductions, r.allowances, r.days_worked, r.total_days
            ]));
            
            toolResult = JSON.stringify({
              cols: ['name','dept','net','base','deduct','allowances','days_worked','total_days'],
              data: rows,
              count: count
            });
          }
        } catch (err: any) {
          toolResult = JSON.stringify({ error: err.message });
        }

        messages.push({ tool_call_id: toolCall.id, role: "tool", name: functionName, content: toolResult });
      }

      data = await callGroq(messages);
    }

    if (!data.choices) {
      return makeReply(`⚠️ عذراً، المساعد غير متاح حالياً. ${JSON.stringify(data)}`);
    }

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error: any) {
    return makeReply(`⚠️ حدث خطأ في العملية: ${error.message}`);
  }
})