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

    const { action, payment_id, rejection_note, reviewer_id } = await req.json()

    if (!payment_id) {
      return new Response(JSON.stringify({ error: 'payment_id is required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    // Fetch the payment request
    const { data: payment, error: fetchError } = await supabase
      .from('payment_requests')
      .select('*, companies(id, name, subscription_expires_at, restriction_level, settings, plan)')
      .eq('id', payment_id)
      .single()

    if (fetchError || !payment) {
      return new Response(JSON.stringify({ error: 'Payment request not found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      })
    }

    if (action === 'approve') {
      // Calculate new expiry date: extend by subscription_duration_months (default 1)
      const months = payment.subscription_duration_months || 1
      const currentExpiry = payment.companies?.subscription_expires_at
        ? new Date(payment.companies.subscription_expires_at)
        : new Date()
      
      // If already expired, start from now; otherwise extend from current expiry
      const baseDate = currentExpiry < new Date() ? new Date() : currentExpiry
      const newExpiry = new Date(baseDate)
      newExpiry.setMonth(newExpiry.getMonth() + months)

      // Update company subscription
      const { error: companyError } = await supabase
        .from('companies')
        .update({
          subscription_expires_at: newExpiry.toISOString(),
          restriction_level: null,
          status: 'active'
        })
        .eq('id', payment.company_id)

      if (companyError) throw companyError

      // Mark payment as approved
      const { error: paymentError } = await supabase
        .from('payment_requests')
        .update({
          status: 'approved',
          reviewed_at: new Date().toISOString(),
          reviewed_by: reviewer_id || null
        })
        .eq('id', payment_id)

      if (paymentError) throw paymentError

      // Send in-app notification to the company
      await supabase.from('company_notifications').insert({
        company_id: payment.company_id,
        title: '✅ تم تفعيل اشتراكك بنجاح',
        message: `تم استلام دفعتك وتفعيل اشتراكك في منصة كوادر حتى ${newExpiry.toLocaleDateString('ar-EG')}. نشكرك على ثقتك بنا!`,
        type: 'success'
      })

      return new Response(JSON.stringify({
        success: true,
        action: 'approved',
        new_expiry: newExpiry.toISOString(),
        company: payment.companies?.name
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })

    } else if (action === 'reject') {
      // Mark payment as rejected
      const { error: paymentError } = await supabase
        .from('payment_requests')
        .update({
          status: 'rejected',
          reviewed_at: new Date().toISOString(),
          reviewed_by: reviewer_id || null,
          notes: rejection_note || 'تم الرفض من قبل الإدارة'
        })
        .eq('id', payment_id)

      if (paymentError) throw paymentError

      // Notify company of rejection
      await supabase.from('company_notifications').insert({
        company_id: payment.company_id,
        title: '❌ تم رفض طلب الدفع',
        message: `للأسف تم رفض طلب الدفع الخاص بك. ${rejection_note ? `السبب: ${rejection_note}` : ''} يرجى التواصل مع الدعم أو إعادة المحاولة.`,
        type: 'error'
      })

      return new Response(JSON.stringify({
        success: true,
        action: 'rejected',
        company: payment.companies?.name
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })

    } else {
      return new Response(JSON.stringify({ error: 'Invalid action. Use "approve" or "reject"' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

  } catch (error) {
    console.error('approve-payment error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
