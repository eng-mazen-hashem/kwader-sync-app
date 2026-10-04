// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function makeReply(text: string, leadDetected = false) {
  return new Response(
    JSON.stringify({
      choices: [{ message: { role: 'assistant', content: text } }],
      lead_detected: leadDetected
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
  );
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json();
    const rawKey = Deno.env.get('GROQ_API_KEY');
    const apiKey = rawKey ? rawKey.trim() : '';

    if (!apiKey) {
      return makeReply('أهلاً بك في منصة كوادر! يسعدنا تواصلك معنا، وسيقوم أحد مسؤولي خدمة العملاء والدعم الفني بالتواصل معك فوراً.');
    }

    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY') || '';
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      serviceRoleKey
    );

    const companyId = body.company_id || null;
    const channelId = body.channel_id || null;
    const incomingMessages = Array.isArray(body.messages) ? body.messages : [];
    const lastUserMessage = incomingMessages.filter((m: any) => m.role === 'user').slice(-1)[0]?.content || '';

    // ── 1. Fetch Company or Grounding Info if available ──
    let companyName = 'منصة كوادر (KWADER)';
    let companyContext = '';

    if (companyId) {
      try {
        const { data: comp } = await supabase
          .from('companies')
          .select('name, country, currency, timezone, settings')
          .eq('id', companyId)
          .maybeSingle();

        if (comp?.name) {
          companyName = comp.name;
          companyContext = `الشركة الحالية: "${comp.name}" | العملة: ${comp.currency || 'العملة المحلية'} | الدولة: ${comp.country || 'EG'}`;
        }
      } catch (e: any) {
        console.warn('Could not fetch company info:', e.message);
      }
    }

    // ── 2. Knowledge Base Grounding Lookup ──
    let kbGroundingText = '';
    if (lastUserMessage && lastUserMessage.trim().length >= 4) {
      try {
        let kbQuery = supabase
          .from('ai_knowledge_base')
          .select('question_trigger, answer_content, keywords, category')
          .eq('is_active', true);

        if (companyId) {
          kbQuery = kbQuery.or(`company_id.is.null,company_id.eq.${companyId}`);
        } else {
          kbQuery = kbQuery.is('company_id', null);
        }

        const { data: kbList } = await kbQuery.limit(30);
        if (kbList && kbList.length > 0) {
          const lowerUser = lastUserMessage.toLowerCase();
          const matched = kbList.filter((k: any) => {
            const trig = (k.question_trigger || '').toLowerCase();
            const kwMatch = Array.isArray(k.keywords) && k.keywords.some((kw: string) => kw && lowerUser.includes(kw.toLowerCase()));
            return lowerUser.includes(trig) || kwMatch;
          });

          if (matched.length > 0) {
            kbGroundingText = '\n\n📚 حقائق ومعلومات موثقة من قاعدة المعرفة:\n' +
              matched.slice(0, 3).map((m: any) => `- ${m.question_trigger}: ${m.answer_content}`).join('\n');
          }
        }
      } catch (e: any) {
        console.warn('KB grounding lookup failed:', e.message);
      }
    }

    // ── 3. Dedicated Sales & Technical Support System Prompt ──
    const agentName = body.ai_name || 'أحمد | مستشار مبيعات كوادر';
    const customInstructions = body.system || body.instructions || '';

    const systemPrompt = `أنت "${agentName}"، مستشار مبيعات وشريك نجاح العملاء المعتمد في منصة "كوادر" (KWADER HR & Attendance Management Platform).
أنت تتحدث مع عميل في محادثة مباشرة لتقديم الاستشارات، مساعدة الشركات، وإتمام الاشتراكات.

${companyContext ? `🏢 السياق: ${companyContext}` : ''}
${kbGroundingText}

🎯 قواعد الشخصية الصارمة وإخفاء الهوية البرمجية:
1. ممنوع منعاً باتاً الإفصاح أو التلميح أنك روبوت أو ذكاء اصطناعي أو نموذج لغوي! أنت موظف بشري حقيقي من فريق مبيعات كوادر.
2. إذا سألك العميل مباشرة: "أنت روبوت أو ذكاء اصطناعي؟":
   رد بخفة دم مصرية وثقة: "هههه لا خالص يا باشا أنا أحمد معاك بشحمي ولحمي من مكتب المبيعات 😂 تؤمرني بإيه يا غالي؟" ثم عد لموضوع العميل فوراً.
3. تحدث بلهجة عامية مصرية راقية وبيزنس مهذب وودود جداً (يا فندم، يا غالي، منورنا، تحت أمرك، تؤمرني، ولا يهمك).
4. رسائلك قصيرة (1 إلى 3 أسطر) ومريحة للقراءة في الواتساب أو الشات، وتجنب القوائم النقطية الكثيرة التي تبدو آلية.
5. قاعدة السؤال الذهبي: لا تنهي أي رسالة بدون سؤال توجيهي لطيف يقود العميل للخطوة التالية.
6. استراتيجية المبيعات وتقفيل الصفقات:
   - افهم حجم الشركة (عدد الموظفين، نوع أجهزة البصمة المستخدمة ZKTeco أو Hikvision) قبل طرح الأسعار لترشيح الباقة الأوفر.
   - اعرض خيارين للحسم (تقفيل البدائل): "تحب نفعلك تجربة مجانية 14 يوم تجرب بنفسك، ولا نحدد ميعاد لديمو سريع أونلاين بكرة المهندس يشرحلك كل شاشات السيستم؟"
   - التعامل مع الاعتراضات: إذا قال السعر غالي، وضح القيمة والوفر في منع أخطاء الرواتب وتوفير جهد المحاسبة، واعرض التجربة المجانية أولاً.
${customInstructions ? `\nتعليمات إضافية خاصة:\n${customInstructions}` : ''}`;

    // ── 4. Format messages for LLM ──
    const filteredMessages = incomingMessages.filter((m: any) => m.role !== 'system');
    const finalMessages = [
      { role: 'system', content: systemPrompt },
      ...filteredMessages
    ];

    // ── 5. Call Groq with Multi-Model Redundancy ──
    const candidateModels = [
      body.model,
      "qwen/qwen3.8-27b",
      "allam-2-7b",
      "openai/gpt-oss-120b"
    ].filter(Boolean);

    const uniqueModels = Array.from(new Set(candidateModels));
    let lastError: any = null;
    let replyText = '';
    let tokensUsed = 250;

    for (const model of uniqueModels) {
      try {
        const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: model,
            messages: finalMessages,
            temperature: 0.35,
            max_tokens: body.max_tokens || 800,
          }),
        });

        if (groqRes.ok) {
          const resData = await groqRes.json();
          const content = resData.choices?.[0]?.message?.content;
          if (content && content.trim()) {
            replyText = content.replace(/<ACTION>[\s\S]*?<\/ACTION>/g, '').trim();
            tokensUsed = resData.usage?.total_tokens || 250;
            break;
          }
        } else {
          const errData = await groqRes.json().catch(() => null);
          console.warn(`[AI Support Agent] Model ${model} returned error:`, errData);
        }
      } catch (err: any) {
        lastError = err;
        console.warn(`[AI Support Agent] Model ${model} network error:`, err.message);
      }
    }

    if (!replyText) {
      replyText = 'أهلاً بك في منصة كوادر! يسعدنا تواصلك معنا، وسيقوم أحد مسؤولي خدمة العملاء والدعم الفني بالتواصل معك فوراً لتلبية طلبك والإجابة على أي استفسار.';
    }

    // ── 6. Check for buying / trial intent ──
    const isLead = /(تجرب[ةه]|اشتراك|سعر|باق[ةه]|شراء|عرض سعر|مبيعات|نشترك|نجرب|حساب جديد|تسجيل)/i.test(lastUserMessage);

    return new Response(
      JSON.stringify({
        choices: [{ message: { role: 'assistant', content: replyText } }],
        lead_detected: isLead,
        tokens_used: tokensUsed
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error: any) {
    return makeReply(`أهلاً بك في منصة كوادر! فريق الدعم الفني جاهز لمساعدتك دائماً.`);
  }
});
