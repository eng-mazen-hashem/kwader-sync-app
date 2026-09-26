import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  const url = new URL(req.url)

  try {
    // 1. Extract API Key from Header or Query
    const apiKey = req.headers.get('x-api-key') || 
                   req.headers.get('authorization')?.replace('Bearer ', '').trim() ||
                   url.searchParams.get('api_key')

    if (!apiKey) {
      return new Response(JSON.stringify({ 
        error: 'Unauthorized', 
        message: 'Missing API Key. Pass your key via x-api-key header or Authorization: Bearer <key>' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401
      })
    }

    // 2. Verify API Key atomically via database RPC
    const { data: authData, error: authError } = await supabase.rpc('verify_whatsapp_api_key', {
      p_api_key: apiKey
    })

    if (authError || !authData?.valid) {
      return new Response(JSON.stringify({ 
        error: 'Forbidden', 
        message: authData?.error || 'Invalid or inactive API key' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403
      })
    }

    // =========================================================================
    // GET /whatsapp-gateway?message_id=... (Check Message Delivery Status)
    // =========================================================================
    if (req.method === 'GET') {
      const messageId = url.searchParams.get('message_id')
      if (!messageId) {
        return new Response(JSON.stringify({ 
          service: 'KWADER WhatsApp Gateway API v2.0',
          authenticated_as: authData.key_name,
          channel: authData.channel_name,
          usage: 'Use POST / to dispatch WhatsApp messages, or GET /?message_id=<id> to check status.'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        })
      }

      const { data: msgRecord, error: msgError } = await supabase
        .from('whatsapp_queue')
        .select('id, phone, status, created_at, processed_at, error, channel_id')
        .eq('id', messageId)
        .maybeSingle()

      if (msgError || !msgRecord) {
        return new Response(JSON.stringify({ error: 'NotFound', message: 'Message not found' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 404
        })
      }

      return new Response(JSON.stringify({
        success: true,
        message: msgRecord
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      })
    }

    // =========================================================================
    // POST /whatsapp-gateway (Send WhatsApp Message)
    // =========================================================================
    if (req.method === 'POST') {
      const body = await req.json().catch(() => ({}))
      const { phone, message, pdf_url, priority, channel_id } = body

      if (!phone || !message) {
        return new Response(JSON.stringify({ 
          error: 'BadRequest', 
          message: 'Both "phone" and "message" fields are required' 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        })
      }

      const cleanPhone = String(phone).replace(/\D/g, '')
      if (cleanPhone.length < 8) {
        return new Response(JSON.stringify({ 
          error: 'BadRequest', 
          message: 'Invalid phone number format. Must include country code without leading zeros or plus.' 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        })
      }

      // Target channel: specified in body, or assigned to API Key, or default
      const targetChannelId = channel_id || authData.channel_id

      // Insert message into queue with high priority
      const { data: inserted, error: queueError } = await supabase
        .from('whatsapp_queue')
        .insert({
          phone: cleanPhone,
          message: message.trim(),
          pdf_url: pdf_url || null,
          priority: typeof priority === 'number' ? priority : 10,
          status: 'pending',
          channel_id: targetChannelId,
          api_key_id: authData.key_id
        })
        .select('id, created_at')
        .single()

      if (queueError) {
        return new Response(JSON.stringify({ 
          error: 'QueueError', 
          message: 'Failed to enqueue message', 
          details: queueError.message 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500
        })
      }

      return new Response(JSON.stringify({
        success: true,
        message_id: inserted.id,
        status: 'queued',
        channel: authData.channel_name,
        target_phone: cleanPhone,
        queued_at: inserted.created_at
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      })
    }

    return new Response(JSON.stringify({ error: 'MethodNotAllowed' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 405
    })

  } catch (err) {
    return new Response(JSON.stringify({ error: 'InternalServerError', message: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    })
  }
})
