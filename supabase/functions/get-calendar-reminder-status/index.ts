// Supabase Edge Function for checking reminder request status
// Deploy with: supabase functions deploy get-calendar-reminder-status

// @ts-nocheck - Deno edge function
/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />

import { serve } from 'https://deno.land/std@0.203.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function normalizeEmail(raw: unknown): string {
  return String(raw || '').trim().toLowerCase()
}

function isValidUiuEmail(email: string): boolean {
  return /^[^\s@]+@([a-z0-9-]+\.)*uiu\.ac\.bd$/i.test(String(email || '').trim())
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
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing Supabase environment variables')
    }

    const body = await req.json().catch(() => ({}))
    const email = normalizeEmail(body?.email)
    const term = String(body?.term || '').trim()

    if (!email || !isValidUiuEmail(email)) {
      return new Response(JSON.stringify({ success: false, error: 'invalid_email' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!term) {
      return new Response(JSON.stringify({ success: false, error: 'missing_term' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    const { data: rows, error } = await supabase
      .from('academic_calendar_reminder_requests')
      .select('id,request_group_id,status,is_active,review_note,reviewed_at,requested_at,academic_calendar_events(title,start_date)')
      .eq('request_email', email)
      .eq('request_term', term)
      .order('requested_at', { ascending: false })
      .limit(500)

    if (error) throw error

    const allRows = Array.isArray(rows) ? rows : []
    const newest = allRows.length ? allRows[0] : null
    const latestGroupId = String(newest?.request_group_id || newest?.id || '')
    const groupRows = latestGroupId
      ? allRows.filter((r: any) => String(r?.request_group_id || r?.id || '') === latestGroupId)
      : []

    const hasPending = groupRows.some((r: any) => String(r?.status || '').toLowerCase() === 'pending' && r?.is_active === true)
    const hasApproved = groupRows.some((r: any) => String(r?.status || '').toLowerCase() === 'approved')
    const hasRejected = groupRows.some((r: any) => String(r?.status || '').toLowerCase() === 'rejected')

    const latestStatus = hasPending
      ? 'pending'
      : hasApproved
        ? 'approved'
        : hasRejected
          ? 'rejected'
          : (newest?.status || null)

    const reviewedRows = groupRows
      .filter((r: any) => Boolean(r?.reviewed_at))
      .sort((a: any, b: any) => String(b?.reviewed_at || '').localeCompare(String(a?.reviewed_at || '')))
    const latestReviewed = reviewedRows.length ? reviewedRows[0] : null

    const approvedEvents = groupRows
      .filter((r: any) => String(r?.status || '').toLowerCase() === 'approved')
      .map((r: any) => ({
        title: r?.academic_calendar_events?.title || null,
        startDate: r?.academic_calendar_events?.start_date || null,
      }))
      .filter((evt: any) => Boolean(evt?.title))

    const pendingRow = groupRows.find((r: any) => String(r?.status || '').toLowerCase() === 'pending' && r?.is_active === true)

    return new Response(
      JSON.stringify({
        success: true,
        pending: Boolean(pendingRow),
        requestedAt: pendingRow?.requested_at || newest?.requested_at || null,
        latestStatus,
        latestReviewNote: latestReviewed?.review_note || newest?.review_note || null,
        latestReviewedAt: latestReviewed?.reviewed_at || newest?.reviewed_at || null,
        approvedEvents,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
