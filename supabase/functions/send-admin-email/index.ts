// Supabase Edge Function: send-admin-email
// Admin-only email sender for specific users using Resend.

// @ts-nocheck
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

function normalizeRecipients(input) {
  const source = Array.isArray(input) ? input.join('\n') : String(input || '')
  const normalized = source.replace(/[;,]/g, '\n')
  const lines = normalized.split(/\r?\n/)
  const set = new Set()
  for (const line of lines) {
    const email = String(line || '').trim().toLowerCase()
    if (!email) continue
    if (!/^\S+@\S+\.\S+$/.test(email)) continue
    set.add(email)
  }
  return Array.from(set)
}

function textToHtml(text) {
  const escaped = String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br/>')

  return '<div style="font-family: Inter, Arial, sans-serif; line-height: 1.6; color: #1f2937;">' +
    '<h2 style="margin: 0 0 12px;">The Awesome UIU</h2>' +
    '<div>' + escaped + '</div>' +
    '<hr style="margin: 20px 0; border: none; border-top: 1px solid #e5e7eb;"/>' +
    '<p style="font-size: 12px; color: #6b7280; margin: 0;">This email was sent from The Awesome UIU admin panel.</p>' +
    '</div>'
}

async function checkAdmin(authHeader) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/is_admin`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY || '',
      'Authorization': authHeader,
    },
    body: '{}',
  })

  if (!response.ok) return false
  const data = await response.json().catch(() => null)
  return data === true
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ success: false, error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!RESEND_API_KEY || !SUPABASE_URL || !SUPABASE_ANON_KEY) {
      throw new Error('Missing required environment variables')
    }

    const authHeader = req.headers.get('Authorization') || ''
    if (!authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const isAdmin = await checkAdmin(authHeader)
    if (!isAdmin) {
      return new Response(JSON.stringify({ success: false, error: 'admin_only' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const payload = await req.json()
    const recipients = normalizeRecipients(payload && payload.emails)
    const subject = String((payload && payload.subject) || '').trim()
    const text = String((payload && payload.text) || '').trim()
    const htmlInput = String((payload && payload.html) || '').trim()
    const html = htmlInput || textToHtml(text)

    if (!recipients.length) throw new Error('At least one valid recipient email is required')
    if (!subject) throw new Error('Subject is required')
    if (!text && !html) throw new Error('Email body is required')

    const sent = []
    const failed = []

    for (const email of recipients) {
      const resendResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: EMAIL_FROM,
          to: [email],
          subject,
          html,
          text: text || undefined,
        }),
      })

      const resendData = await resendResponse.json().catch(() => null)
      if (!resendResponse.ok) {
        failed.push({
          email,
          error: JSON.stringify(resendData || { status: resendResponse.status }),
        })
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
    return new Response(
      JSON.stringify({ success: false, error: message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  }
})
