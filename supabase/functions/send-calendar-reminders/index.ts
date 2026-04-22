// Supabase Edge Function for sending approved academic calendar reminders
// Deploy with: supabase functions deploy send-calendar-reminders

// @ts-nocheck - Deno edge function
/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />

import { serve } from 'https://deno.land/std@0.203.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const REMINDER_CRON_SECRET = Deno.env.get('REMINDER_CRON_SECRET') || ''
const EMAIL_FROM = Deno.env.get('REMINDER_EMAIL_FROM') || 'The Awesome UIU <noreply@awesomeuiu.tech>'
const EMAIL_REPLY_TO = Deno.env.get('REMINDER_EMAIL_REPLY_TO') || ''

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-reminder-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function getDhakaTodayYmd(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Dhaka',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function parseYmdUtc(ymd: string): Date | null {
  const str = String(ymd || '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return null
  const dt = new Date(`${str}T00:00:00.000Z`)
  return Number.isNaN(dt.getTime()) ? null : dt
}

function toYmdUtc(date: Date): string {
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function subtractDaysYmd(ymd: string, daysBefore: number): string | null {
  const dt = parseYmdUtc(ymd)
  if (!dt) return null
  dt.setUTCDate(dt.getUTCDate() - daysBefore)
  return toYmdUtc(dt)
}

function eventDateLabel(ymd: string): string {
  const dt = parseYmdUtc(ymd)
  if (!dt) return ymd
  return dt.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'Asia/Dhaka',
  })
}

function buildEmailHtml(req: any): string {
  const title = String(req?.academic_calendar_events?.title || 'Upcoming event')
  const eventDate = String(req?.academic_calendar_events?.start_date || '')
  const term = String(req?.academic_calendar_events?.term || '')
  const daysBefore = Number(req?.days_before || 0)

  return `
    <div style="font-family: Inter, Arial, sans-serif; line-height: 1.6; color: #1f2937; max-width: 640px; margin: 0 auto;">
      <h2 style="margin: 0 0 10px;">Academic Calendar Reminder</h2>
      <p style="margin: 0 0 12px;">This is your approved reminder from The Awesome UIU.</p>
      <div style="border: 1px solid #d1d5db; border-radius: 12px; padding: 14px; background: #f9fafb;">
        <p style="margin: 0 0 6px;"><strong>Event:</strong> ${title}</p>
        <p style="margin: 0 0 6px;"><strong>Date:</strong> ${eventDateLabel(eventDate)}</p>
        <p style="margin: 0 0 6px;"><strong>Term:</strong> ${term || 'N/A'}</p>
        <p style="margin: 0;"><strong>Reminder:</strong> ${daysBefore} day(s) before</p>
      </div>
      <p style="margin: 14px 0 0; color: #4b5563; font-size: 14px;">You are receiving this because your reminder request was approved by admin.</p>
    </div>
  `
}

function buildEmailText(req: any): string {
  const title = String(req?.academic_calendar_events?.title || 'Upcoming event')
  const eventDate = String(req?.academic_calendar_events?.start_date || '')
  const term = String(req?.academic_calendar_events?.term || '')
  const daysBefore = Number(req?.days_before || 0)

  return [
    'Academic Calendar Reminder',
    '',
    `Event: ${title}`,
    `Date: ${eventDateLabel(eventDate)}`,
    `Term: ${term || 'N/A'}`,
    `Reminder: ${daysBefore} day(s) before`,
    '',
    'You are receiving this because your reminder request was approved by admin.',
  ].join('\n')
}

function buildStudentReminderEmailHtml(reminder: any): string {
  const title = String(reminder?.title || 'Personal reminder')
  const reminderDate = String(reminder?.reminder_date || '')
  const term = String(reminder?.term || '')
  const description = String(reminder?.description || '').trim()

  return `
    <div style="font-family: Inter, Arial, sans-serif; line-height: 1.6; color: #1f2937; max-width: 640px; margin: 0 auto;">
      <h2 style="margin: 0 0 10px;">Your Academic Calendar Reminder</h2>
      <p style="margin: 0 0 12px;">This is your scheduled personal reminder from The Awesome UIU.</p>
      <div style="border: 1px solid #d1d5db; border-radius: 12px; padding: 14px; background: #f9fafb;">
        <p style="margin: 0 0 6px;"><strong>Reminder:</strong> ${title}</p>
        <p style="margin: 0 0 6px;"><strong>Date:</strong> ${eventDateLabel(reminderDate)}</p>
        <p style="margin: 0;"><strong>Term:</strong> ${term || 'N/A'}</p>
      </div>
      ${description ? `<p style="margin: 14px 0 0;"><strong>Note:</strong> ${description}</p>` : ''}
      <p style="margin: 14px 0 0; color: #4b5563; font-size: 14px;">You are receiving this because you created a personal reminder in Academic Calendar.</p>
    </div>
  `
}

function buildStudentReminderEmailText(reminder: any): string {
  const title = String(reminder?.title || 'Personal reminder')
  const reminderDate = String(reminder?.reminder_date || '')
  const term = String(reminder?.term || '')
  const description = String(reminder?.description || '').trim()

  return [
    'Your Academic Calendar Reminder',
    '',
    `Reminder: ${title}`,
    `Date: ${eventDateLabel(reminderDate)}`,
    `Term: ${term || 'N/A'}`,
    description ? `Note: ${description}` : '',
    '',
    'You are receiving this because you created a personal reminder in Academic Calendar.',
  ].filter(Boolean).join('\n')
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
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !RESEND_API_KEY) {
      throw new Error('Missing required environment variables')
    }

    const authHeader = req.headers.get('Authorization') || ''
    const bearer = authHeader.replace(/^Bearer\s+/i, '').trim()
    const providedSecret = req.headers.get('x-reminder-secret') || bearer

    if (REMINDER_CRON_SECRET && providedSecret !== REMINDER_CRON_SECRET) {
      return new Response(JSON.stringify({ success: false, error: 'forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    const todayYmd = getDhakaTodayYmd()

    const { data: requests, error: requestErr } = await supabase
      .from('academic_calendar_reminder_requests')
      .select('id,event_id,request_email,days_before,status,is_active,academic_calendar_events!inner(id,title,term,start_date)')
      .eq('status', 'approved')
      .eq('is_active', true)
      .limit(10000)

    if (requestErr) throw requestErr

    const due = (requests || []).filter((row: any) => {
      const eventStart = String(row?.academic_calendar_events?.start_date || '')
      const daysBefore = Number(row?.days_before || 0)
      if (!eventStart || !Number.isFinite(daysBefore)) return false
      const sendDate = subtractDaysYmd(eventStart, daysBefore)
      return sendDate === todayYmd
    })

    const existingSet = new Set<string>()
    if (due.length) {
      const dueIds = due.map((row: any) => row.id)
      const { data: existingLogs, error: existingLogErr } = await supabase
        .from('academic_calendar_reminder_dispatch_log')
        .select('reminder_request_id,event_start_date')
        .in('reminder_request_id', dueIds)
        .limit(10000)

      if (existingLogErr) throw existingLogErr

      ;(existingLogs || []).forEach((row: any) => {
        existingSet.add(`${row.reminder_request_id}|${row.event_start_date}`)
      })
    }

    let sent = 0
    let skipped = 0
    let failed = 0

    for (const row of due) {
      const eventStart = String(row?.academic_calendar_events?.start_date || '')
      const dedupeKey = `${row.id}|${eventStart}`
      if (existingSet.has(dedupeKey)) {
        skipped += 1
        continue
      }

      const email = String(row?.request_email || '').trim().toLowerCase()
      if (!email) {
        failed += 1
        continue
      }

      const subject = `Reminder: ${String(row?.academic_calendar_events?.title || 'Academic event')} (${eventStart})`
      const html = buildEmailHtml(row)
      const text = buildEmailText(row)

      try {
        const resendResp = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: EMAIL_FROM,
            to: [email],
            reply_to: EMAIL_REPLY_TO || undefined,
            subject,
            html,
            text,
          }),
        })

        const responseBody = await resendResp.json().catch(() => null)

        if (!resendResp.ok) {
          failed += 1
          await supabase
            .from('academic_calendar_reminder_dispatch_log')
            .insert({
              reminder_request_id: row.id,
              event_id: row.event_id,
              event_start_date: eventStart,
              scheduled_send_date: todayYmd,
              email_sent_to: email,
              error_message: JSON.stringify(responseBody || { status: resendResp.status }),
              provider_response: responseBody,
            })
          continue
        }

        sent += 1
        await supabase
          .from('academic_calendar_reminder_dispatch_log')
          .insert({
            reminder_request_id: row.id,
            event_id: row.event_id,
            event_start_date: eventStart,
            scheduled_send_date: todayYmd,
            email_sent_to: email,
            resend_message_id: responseBody?.id || null,
            provider_response: responseBody,
          })
      } catch (err) {
        failed += 1
        await supabase
          .from('academic_calendar_reminder_dispatch_log')
          .insert({
            reminder_request_id: row.id,
            event_id: row.event_id,
            event_start_date: eventStart,
            scheduled_send_date: todayYmd,
            email_sent_to: email,
            error_message: err instanceof Error ? err.message : String(err),
          })
      }
    }

    let studentScanned = 0
    let studentDue = 0
    let studentSent = 0
    let studentFailed = 0

    const nowIso = new Date().toISOString()
    const { data: studentReminders, error: studentReminderErr } = await supabase
      .from('student_calendar_reminders')
      .select('id,student_email,title,description,term,reminder_date,remind_at,is_active,email_sent_at')
      .eq('is_active', true)
      .is('email_sent_at', null)
      .lte('remind_at', nowIso)
      .limit(10000)

    if (studentReminderErr) throw studentReminderErr

    studentScanned = studentReminders?.length || 0

    for (const reminder of studentReminders || []) {
      const email = String(reminder?.student_email || '').trim().toLowerCase()
      if (!email) {
        studentFailed += 1
        continue
      }

      studentDue += 1
      const subject = `Reminder: ${String(reminder?.title || 'Personal reminder')}`
      const html = buildStudentReminderEmailHtml(reminder)
      const text = buildStudentReminderEmailText(reminder)

      try {
        const resendResp = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: EMAIL_FROM,
            to: [email],
            reply_to: EMAIL_REPLY_TO || undefined,
            subject,
            html,
            text,
          }),
        })

        const responseBody = await resendResp.json().catch(() => null)

        if (!resendResp.ok) {
          studentFailed += 1
          continue
        }

        studentSent += 1
        await supabase
          .from('student_calendar_reminders')
          .update({ email_sent_at: new Date().toISOString() })
          .eq('id', reminder.id)
      } catch {
        studentFailed += 1
      }
    }

    await supabase
      .from('student_calendar_reminders')
      .update({ is_active: false })
      .eq('is_active', true)
      .lt('reminder_date', todayYmd)

    return new Response(JSON.stringify({
      success: true,
      scanned: requests?.length || 0,
      due: due.length,
      sent,
      skipped,
      failed,
      studentScanned,
      studentDue,
      studentSent,
      studentFailed,
      date: todayYmd,
    }), {
      status: 200,
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
