// Supabase Edge Function for student personal calendar reminders
// Deploy with: supabase functions deploy student-calendar-reminders

// @ts-nocheck
/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />

import { serve } from 'https://deno.land/std@0.203.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-api-version, x-region',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function normalizeEmail(raw: unknown): string {
  return String(raw || '').trim().toLowerCase()
}

function isValidUiuEmail(email: string): boolean {
  return /^[^\s@]+@([a-z0-9-]+\.)*uiu\.ac\.bd$/i.test(String(email || '').trim())
}

function isValidYmd(value: unknown): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || '').trim())
}

function isValidHm(value: unknown): boolean {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(String(value || '').trim())
}

function getDhakaTodayYmd(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Dhaka',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function toDhakaIso(ymd: string, hm: string): string {
  return `${ymd}T${hm}:00+06:00`
}

function subtractDaysYmd(ymd: string, daysBefore: number): string | null {
  if (!isValidYmd(ymd)) return null
  const dt = new Date(`${ymd}T00:00:00.000Z`)
  if (Number.isNaN(dt.getTime())) return null
  dt.setUTCDate(dt.getUTCDate() - daysBefore)
  const y = dt.getUTCFullYear()
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0')
  const d = String(dt.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

async function deactivatePastReminders(supabase: any, email: string) {
  const todayYmd = getDhakaTodayYmd()
  await supabase
    .from('student_calendar_reminders')
    .update({ is_active: false })
    .eq('student_email', email)
    .eq('is_active', true)
    .lt('reminder_date', todayYmd)
}

async function countActiveReminders(supabase: any, email: string) {
  const todayYmd = getDhakaTodayYmd()
  const { count, error } = await supabase
    .from('student_calendar_reminders')
    .select('id', { count: 'exact', head: true })
    .eq('student_email', email)
    .eq('is_active', true)
    .gte('reminder_date', todayYmd)

  if (error) throw error
  return Number(count || 0)
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
    const action = String(body?.action || '').trim().toLowerCase()
    const email = normalizeEmail(body?.email)

    if (!email || !isValidUiuEmail(email)) {
      return new Response(JSON.stringify({ success: false, error: 'invalid_email' }), {
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

    await deactivatePastReminders(supabase, email)

    if (action === 'list') {
      const term = String(body?.term || '').trim()
      let query = supabase
        .from('student_calendar_reminders')
        .select('id,title,description,term,reminder_date,days_before,remind_at,created_at,is_active,email_sent_at')
        .eq('student_email', email)
        .eq('is_active', true)
        .order('reminder_date', { ascending: true })
        .order('remind_at', { ascending: true })
        .limit(200)

      if (term) {
        query = query.eq('term', term)
      }

      const { data, error } = await query
      if (error) throw error

      const activeCount = await countActiveReminders(supabase, email)

      return new Response(JSON.stringify({ success: true, reminders: data || [], activeCount, limit: 5 }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (action === 'create') {
      const title = String(body?.title || '').trim()
      const description = String(body?.description || '').trim() || null
      const studentId = String(body?.studentId || '').trim() || null
      const term = String(body?.term || '').trim() || null
      const reminderDate = String(body?.reminderDate || '').trim()
      const daysBefore = Number.parseInt(String(body?.daysBefore ?? '0'), 10)
      const reminderTime = String(body?.reminderTime || '').trim()

      if (!title || title.length > 140) {
        return new Response(JSON.stringify({ success: false, error: 'invalid_title' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      if (!isValidYmd(reminderDate)) {
        return new Response(JSON.stringify({ success: false, error: 'invalid_reminder_date' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      if (!isValidHm(reminderTime)) {
        return new Response(JSON.stringify({ success: false, error: 'invalid_reminder_time' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      if (!Number.isInteger(daysBefore) || daysBefore < 0 || daysBefore > 30) {
        return new Response(JSON.stringify({ success: false, error: 'invalid_days_before' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const todayYmd = getDhakaTodayYmd()
      if (reminderDate < todayYmd) {
        return new Response(JSON.stringify({ success: false, error: 'past_reminder_date' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const sendDate = subtractDaysYmd(reminderDate, daysBefore)
      if (!sendDate) {
        return new Response(JSON.stringify({ success: false, error: 'invalid_send_date' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const remindAtIso = toDhakaIso(sendDate, reminderTime)
      const remindAt = new Date(remindAtIso)
      if (Number.isNaN(remindAt.getTime())) {
        return new Response(JSON.stringify({ success: false, error: 'invalid_remind_at' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      if (remindAt.getTime() <= Date.now()) {
        return new Response(JSON.stringify({ success: false, error: 'remind_at_must_be_future' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const activeCount = await countActiveReminders(supabase, email)
      if (activeCount >= 5) {
        return new Response(JSON.stringify({ success: false, error: 'reminder_limit_reached', limit: 5, activeCount }), {
          status: 409,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const { data: sameDayRows, error: duplicateErr } = await supabase
        .from('student_calendar_reminders')
        .select('id,title')
        .eq('student_email', email)
        .eq('is_active', true)
        .eq('reminder_date', reminderDate)
        .limit(200)

      if (duplicateErr) throw duplicateErr
      const duplicateExists = (sameDayRows || []).some((row: any) => String(row?.title || '').trim().toLowerCase() === title.toLowerCase())
      if (duplicateExists) {
        return new Response(JSON.stringify({ success: false, error: 'duplicate_reminder_for_event' }), {
          status: 409,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const { data, error } = await supabase
        .from('student_calendar_reminders')
        .insert({
          student_email: email,
          student_id: studentId,
          term,
          title,
          description,
          reminder_date: reminderDate,
          days_before: daysBefore,
          remind_at: remindAt.toISOString(),
          is_active: true,
        })
        .select('id,title,description,term,reminder_date,days_before,remind_at,created_at,is_active,email_sent_at')
        .single()

      if (error) throw error

      return new Response(JSON.stringify({ success: true, reminder: data, activeCount: activeCount + 1, limit: 5 }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (action === 'remove') {
      const reminderId = String(body?.reminderId || '').trim()
      if (!reminderId) {
        return new Response(JSON.stringify({ success: false, error: 'missing_reminder_id' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const { data: existing, error: existingErr } = await supabase
        .from('student_calendar_reminders')
        .select('id,is_active')
        .eq('id', reminderId)
        .eq('student_email', email)
        .limit(1)
        .maybeSingle()

      if (existingErr) throw existingErr
      if (!existing) {
        return new Response(JSON.stringify({ success: false, error: 'reminder_not_found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      if (existing.is_active === true) {
        const { error: deactivateErr } = await supabase
          .from('student_calendar_reminders')
          .update({ is_active: false })
          .eq('id', reminderId)
          .eq('student_email', email)

        if (deactivateErr) throw deactivateErr
      }

      const activeCount = await countActiveReminders(supabase, email)
      return new Response(JSON.stringify({ success: true, activeCount, limit: 5 }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ success: false, error: 'invalid_action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
