import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const now = new Date()
    const today = now.toISOString().split('T')[0]

    // 1. Fetch companies expiring in the next 7 days
    const { data: companies, error: fetchError } = await supabase
      .from('companies')
      .select('id, name, subscription_expires_at, settings, plan')
      .not('subscription_expires_at', 'is', null)
      .eq('status', 'active')

    if (fetchError) throw fetchError

    // 2. Fetch active resellers for info
    const { data: resellers } = await supabase
      .from('resellers')
      .select('name, phone')
      .eq('status', 'active')

    const resellerInfo = (resellers || [])
      .map(r => `• ${r.name}: ${r.phone || '—'}`)
      .join('\n')

    const alertsSent = []

    for (const company of companies) {
      const expiryDate = new Date(company.subscription_expires_at)
      const diffTime = expiryDate.getTime() - now.getTime()
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

      let alertTitle = ''
      let alertMsg = ''
      let alertLevel = 0

      if (diffDays <= 1) {
        alertLevel = 1
        alertTitle = '⚠️ تنبيه هام: ينتهي اشتراكك غداً'
        alertMsg = `عزيزي العميل، نود تذكيرك بأن اشتراكك في منصة كوادر ينتهي غداً. يرجى التجديد فوراً لضمان استمرار الخدمة.`
      } else if (diffDays <= 3) {
        alertLevel = 3
        alertTitle = '📅 تذكير: اشتراكك ينتهي خلال 3 أيام'
        alertMsg = `عزيزي العميل، اشتراكك يقترب من الانتهاء (3 أيام متبقية). يرجى التواصل مع أحد موزعينا المعتمدين للتجديد.`
      } else if (diffDays <= 7) {
        alertLevel = 7
        alertTitle = '🔔 تذكير: موعد تجديد الاشتراك'
        alertMsg = `نود إعلامكم بأن اشتراككم الحالي ينتهي خلال 7 أيام. يرجى التخطيط للتجديد قريباً.`
      }

      if (alertLevel > 0) {
        // Check if we already sent this level of alert today or recently
        // (Simple logic: one alert per day)
        const lastAlertAt = company.settings?.last_alert_at
        if (lastAlertAt === today) continue

        // A. Add Internal Notification
        await supabase.from('company_notifications').insert({
          company_id: company.id,
          title: alertTitle,
          message: `${alertMsg}\n\nيمكنك التواصل مع الموزعين:\n${resellerInfo}`,
          type: diffDays <= 1 ? 'error' : 'warning'
        })

        // B. External Alerts (WhatsApp/Telegram)
        const settings = company.settings || {}
        const fullMsg = `🏢 *${company.name}*\n${alertTitle}\n\n${alertMsg}\n\n📞 *الموزعون المعتمدون:*\n${resellerInfo}\n\n📱 AttendPay Auto`

        if (settings.telegram_token && settings.telegram_chat_id) {
          await sendTelegram(settings.telegram_token, settings.telegram_chat_id, fullMsg)
        }

        // C. Update company settings to track alert
        await supabase.from('companies').update({
          settings: { ...settings, last_alert_at: today }
        }).eq('id', company.id)

        alertsSent.push({ company: company.name, level: alertLevel })
      }
    }

    return new Response(JSON.stringify({ success: true, sent: alertsSent }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})

async function sendTelegram(token: string, chatId: string, text: string) {
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
    })
  } catch (err) {
    console.error('Telegram error:', err)
  }
}
