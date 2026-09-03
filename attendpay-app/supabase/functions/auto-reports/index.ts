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

    // Check if it's a manual/unified WhatsApp notification dispatch
    const body = await req.json().catch(() => ({}))
    if (body.action === 'send_whatsapp') {
      const { phone, message } = body
      if (!phone || !message) {
        return new Response(JSON.stringify({ error: 'Phone and message are required' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        })
      }

      // ✅ الجديد: إدراج الرسالة في طابور الواتساب اللامركزي
      const { error: queueError } = await supabase
        .from('whatsapp_queue')
        .insert({ phone: phone.replace(/\D/g, ''), message, status: 'pending' })

      if (queueError) {
        return new Response(JSON.stringify({ error: 'فشل إضافة الرسالة إلى الطابور', details: queueError.message }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500
        })
      }

      return new Response(JSON.stringify({ success: true, queued: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      })
    }

    // 1. Get due schedules
    const { data: schedules, error: schedError } = await supabase
      .from('report_schedules')
      .select('*, companies(name, settings)')
      .eq('is_active', true)
      .lte('next_send_at', new Date().toISOString())

    if (schedError) throw schedError

    const results = []

    for (const sched of schedules) {
      try {
        const company = sched.companies
        const settings = company.settings || {}

        // 2. Fetch data for this specific company
        const now = new Date()
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]
        const today = now.toISOString().split('T')[0]
        const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]

        const [employees, attendance, payrolls] = await Promise.all([
          supabase.from('employees').select('id,name,base_salary').eq('company_id', sched.company_id).eq('status', 'active'),
          supabase.from('processed_attendance').select('employee_id,date,status,check_in,check_out,late_minutes').eq('company_id', sched.company_id).gte('date', weekAgo),
          supabase.from('payrolls').select('employee_id,net_salary,deductions,base_salary,housing,transport,days_worked,total_days').eq('company_id', sched.company_id).eq('start_date', firstDay).eq('end_date', lastDay)
        ])

        const empMap = {}
        employees.data?.forEach(e => { empMap[e.id] = e.name })

        const reportData = {
          employees: employees.data || [],
          attendance: (attendance.data || []).map(r => ({ ...r, employee_name: empMap[r.employee_id] || 'موظف' })),
          payrolls: (payrolls.data || []).map(r => ({ ...r, employee_name: empMap[r.employee_id] || 'موظف' }))
        }

        // 3. Build report text
        const reportText = buildReportText(sched.report_type, reportData, company)

        // 4. Send via Channels (Telegram & WhatsApp)
        // --- Telegram ---
        if (sched.channels.includes('telegram') && settings.telegram_token && settings.telegram_chat_id) {
          await sendTelegram(settings.telegram_token, settings.telegram_chat_id, reportText)
        }

        // --- WhatsApp (Decentralized Queue - v2.0) ---
        const toPhone = settings.whatsapp_phone || settings.whatsapp_number;
        if (sched.channels.includes('whatsapp') && toPhone) {
          // ✅ الجديد: إدراج الرسالة في الطابور اللامركزي
          // سيلتقطها عميل الواتساب النشط (LEADER) على جهاز أحد المشتركين تلقائياً
          const { error: queueError } = await supabase
            .from('whatsapp_queue')
            .insert({
              phone:   toPhone.replace(/\D/g, ''),
              message: reportText,
              status:  'pending'
            })
          if (queueError) {
            throw new Error(`فشل إضافة تقرير الجدولة إلى طابور الواتساب: ${queueError.message}`)
          }
          console.log(`✅ تم إضافة تقرير للشركة "${company.name}" إلى طابور الواتساب → ${toPhone}`)
        }

        // 5. Calculate next send time and update
        const { data: nextTs } = await supabase.rpc('calc_next_send', {
          p_frequency: sched.frequency,
          p_send_time: sched.send_time,
          p_send_day: sched.send_day
        })

        await supabase.from('report_schedules').update({
          last_sent_at: new Date().toISOString(),
          next_send_at: nextTs
        }).eq('id', sched.id)

        results.push({ id: sched.id, success: true })
      } catch (err) {
        console.error(`Error processing schedule ${sched.id}:`, err)
        results.push({ id: sched.id, success: false, error: err.message })
      }
    }

    return new Response(JSON.stringify({ processed: results.length, details: results }), {
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

// --- Helper Functions ---

async function sendTelegram(token: string, chatId: string, text: string) {
  const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
  })
  const d = await r.json()
  if (!d.ok) throw new Error(d.description || 'فشل إرسال تيليجرام')
}

async function sendWhatsApp(accountSid: string, authToken: string, toPhone: string, text: string) {
  const fromNumber = 'whatsapp:+14155238886' // رقم ساندبوكس Twilio
  const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`
  
  const formattedPhone = toPhone.startsWith('+') ? toPhone : `+${toPhone}`
  
  const formData = new URLSearchParams()
  formData.append('To', `whatsapp:${formattedPhone}`)
  formData.append('From', fromNumber)
  formData.append('Body', text)

  const r = await fetch(twilioUrl, {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + btoa(`${accountSid}:${authToken}`),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: formData,
  })
  
  const d = await r.json()
  if (!r.ok) throw new Error(d.message || 'فشل إرسال واتساب عبر Twilio')
}

async function sendCustomWhatsApp(apiUrl: string, apiKey: string, toPhone: string, text: string) {
  const formattedPhone = toPhone.replace(/\D/g, '')
  
  // Auto-append /api/send-report if not present at the end of the URL
  let targetUrl = apiUrl;
  if (!targetUrl.endsWith('/api/send-report') && !targetUrl.endsWith('/api/send-report/')) {
    targetUrl = targetUrl.replace(/\/$/, '') + '/api/send-report';
  }

  console.log(`Sending WhatsApp using URL: ${targetUrl}`);

  const r = await fetch(targetUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      phone: formattedPhone,
      message: text
    })
  })
  
  let responseBody = '';
  try {
    responseBody = await r.text();
  } catch (e) {
    responseBody = 'Failed to read response body';
  }

  if (!r.ok) {
    let errorDetail = '';
    try {
      const parsed = JSON.parse(responseBody);
      errorDetail = parsed.error || parsed.details || JSON.stringify(parsed);
    } catch {
      errorDetail = responseBody;
    }
    throw new Error(`WhatsApp API error (status ${r.status}): ${errorDetail || 'No details'}`);
  }
}

function buildReportText(type: string, data: any, company: any) {
  const now = new Date()
  const month = now.toLocaleDateString('ar-SA', { month: 'long', year: 'numeric' })
  const today = now.toISOString().split('T')[0]

  const formatCurrency = (val: number) => {
    return val.toLocaleString('ar-SA') + ' ر.س'
  }

  switch (type) {
    case 'payroll':
    case 'salary': {
      const pays = data.payrolls || []
      const total = pays.reduce((s: any, p: any) => s + Number(p.net_salary), 0)
      return [
        `🏢 *${company?.name}*`,
        `💰 *كشف رواتب ${month}*`,
        `━━━━━━━━━━━━━━━━━━━━`,
        ...pays.map((p: any, i: number) =>
          `${i + 1}. ${p.employee_name}\n` +
          `   💵 الصافي: ${formatCurrency(Number(p.net_salary))}`
        ),
        `━━━━━━━━━━━━━━━━━━━━`,
        `✅ *إجمالي الصافي: ${formatCurrency(total)}*`,
        `📱 AttendPay Auto`,
      ].join('\n')
    }
    case 'attendance':
    case 'attendance_today': {
      const todayAtt = (data.attendance || []).filter((a: any) => a.date === today)
      const present = todayAtt.filter((a: any) => ['present', 'late', 'early_leave'].includes(a.status))
      const absent = todayAtt.filter((a: any) => a.status === 'absent')
      return [
        `🏢 *${company?.name}*`,
        `📋 *تقرير الحضور اليومي*`,
        `📅 ${now.toLocaleDateString('ar-SA', { weekday: 'long', day: 'numeric', month: 'long' })}`,
        `━━━━━━━━━━━━━━━━━━━━`,
        `✅ الحاضرون (${present.length}):`,
        ...present.map((a: any) => `  • ${a.employee_name}${a.check_in ? ` — ${a.check_in}` : ''}`),
        ...(absent.length > 0 ? [``, `❌ الغائبون (${absent.length}):`, ...absent.map((a: any) => `  • ${a.employee_name}`)] : []),
        `━━━━━━━━━━━━━━━━━━━━`,
        `📊 ${present.length} حاضر · ${absent.length} غائب`,
        `📱 AttendPay Auto`,
      ].join('\n')
    }
    case 'absent':
    case 'late_report': {
      const lates = (data.attendance || []).filter((a: any) => a.status === 'late');
      return [
        `🏢 *${company?.name}*`,
        `⏰ *تقرير التأخر — ${month}*`,
        `━━━━━━━━━━━━━━━━━━━━`,
        lates.length ? lates.map((a: any) => `• ${a.employee_name} | ${a.date} | ${a.late_minutes}د`).join('\n') : '✅ لا توجد حالات تأخر',
        `━━━━━━━━━━━━━━━━━━━━`,
        `📱 AttendPay Auto`,
      ].join('\n');
    }
    case 'summary': {
      return [
        `🏢 *${company?.name}*`,
        `📊 *الملخص الدوري*`,
        `📅 ${now.toLocaleDateString('ar-SA')}`,
        `━━━━━━━━━━━━━━━━━━━━`,
        `👥 الموظفون: ${data.employees?.length || 0}`,
        `💰 الرواتب المحسوبة: ${data.payrolls?.length || 0}`,
        `━━━━━━━━━━━━━━━━━━━━`,
        `📱 AttendPay Auto`,
      ].join('\n');
    }
    default: return 'No report type specified'
  }
}