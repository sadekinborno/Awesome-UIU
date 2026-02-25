// Supabase Edge Function for sending admin emails
// Deploy with: supabase functions deploy send-admin-email

// @ts-nocheck - Deno edge function
/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />

import { serve } from 'https://deno.land/std@0.203.0/http/server.ts'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')
const EMAIL_FROM = Deno.env.get('ADMIN_EMAIL_FROM') || 'The Awesome UIU <noreply@awesomeuiu.tech>'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function normalizeRecipients(input: unknown): string[] {
  if (!input) return []
  const text = Array.isArray(input) ? input.join('\n') : String(input)
  return text
    .replace(/[;,]/g, '\n')
    .split(/\r?\n/)
    .map((v) => v.trim().toLowerCase())
    .filter((v) => /^\S+@\S+\.\S+$/.test(v))
}

function textToHtml(text: string): string {
  const escaped = String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br/>')
  return `<div style="font-family: Inter, Arial, sans-serif; line-height: 1.6; color: #1f2937;">${escaped}</div>`
}

async function checkIsAdmin(authHeader: string): Promise<boolean> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !authHeader) return false
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/is_admin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
        Authorization: authHeader,
      },
      body: '{}',
    })
    if (!res.ok) return false
    const data = await res.json().catch(() => null)
    return data === true
  } catch {
    return false
  }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ success: false, error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    if (!RESEND_API_KEY || !SUPABASE_URL || !SUPABASE_ANON_KEY) {
      throw new Error('Missing required environment variables')
    }

    const authHeader = req.headers.get('Authorization') || ''
    const isAdmin = await checkIsAdmin(authHeader)
    if (!isAdmin) {
      return new Response(JSON.stringify({ success: false, error: 'admin_only' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json().catch(() => ({}))
    const recipients = normalizeRecipients(body?.emails ?? body?.to ?? body?.email)
    const subject = String(body?.subject || '').trim()
    const text = String(body?.text ?? body?.message ?? '').trim()
    const html = String(body?.html || '').trim() || textToHtml(text)

    if (!recipients.length) {
      return new Response(JSON.stringify({ success: false, error: 'no_recipients' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!subject) {
      return new Response(JSON.stringify({ success: false, error: 'missing_subject' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const sent: string[] = []
    const failed: Array<{ email: string; error: string }> = []

    for (const email of recipients) {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: EMAIL_FROM,
          to: [email],
          subject,
          html,
          text: text || undefined,
        }),
      })

      if (!res.ok) {
        const err = await res.text()
        failed.push({ email, error: err || `resend_${res.status}` })
      } else {
        sent.push(email)
      }
    }

    return new Response(
      JSON.stringify({
        success: sent.length > 0,
        sentCount: sent.length,
        failedCount: failed.length,
        sent,
        failed,
      }),
      {
        status: sent.length > 0 ? 200 : 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error occurred'
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
