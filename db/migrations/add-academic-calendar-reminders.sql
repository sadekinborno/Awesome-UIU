-- ============================================
-- Academic Calendar Reminder Requests + Delivery Logs
--
-- Goals:
-- - Allow students to request reminder emails for selected calendar events
-- - Require admin approval before reminders are sent
-- - Track sent reminders to avoid duplicate deliveries
--
-- Prereqs:
-- - add-academic-calendar.sql (creates public.academic_calendar_events)
-- - admin-auth-setup.sql (creates public.is_admin())
-- ============================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.academic_calendar_reminder_requests (
	id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
	event_id UUID NOT NULL REFERENCES public.academic_calendar_events(id) ON DELETE CASCADE,
	request_email TEXT NOT NULL,
	request_student_id TEXT,
	days_before INTEGER NOT NULL CHECK (days_before BETWEEN 1 AND 30),
	status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'canceled')),
	review_note TEXT,
	reviewed_by UUID,
	reviewed_at TIMESTAMPTZ,
	is_active BOOLEAN NOT NULL DEFAULT TRUE,
	requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	CONSTRAINT academic_calendar_reminder_uiu_email CHECK (
		request_email ~* '^[^\s@]+@([a-z0-9-]+\.)*uiu\.ac\.bd$'
	)
);

CREATE TABLE IF NOT EXISTS public.academic_calendar_reminder_dispatch_log (
	id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
	reminder_request_id UUID NOT NULL REFERENCES public.academic_calendar_reminder_requests(id) ON DELETE CASCADE,
	event_id UUID NOT NULL REFERENCES public.academic_calendar_events(id) ON DELETE CASCADE,
	event_start_date DATE NOT NULL,
	scheduled_send_date DATE NOT NULL,
	email_sent_to TEXT NOT NULL,
	resend_message_id TEXT,
	provider_response JSONB,
	error_message TEXT,
	sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_calendar_reminder_dispatch_once
ON public.academic_calendar_reminder_dispatch_log(reminder_request_id, event_start_date);

CREATE INDEX IF NOT EXISTS idx_calendar_reminders_status
ON public.academic_calendar_reminder_requests(status, is_active, requested_at DESC);

CREATE INDEX IF NOT EXISTS idx_calendar_reminders_event
ON public.academic_calendar_reminder_requests(event_id);

CREATE INDEX IF NOT EXISTS idx_calendar_reminders_email
ON public.academic_calendar_reminder_requests(request_email);

CREATE INDEX IF NOT EXISTS idx_calendar_dispatch_event_date
ON public.academic_calendar_reminder_dispatch_log(event_start_date, scheduled_send_date);

-- Reuse shared trigger function if available; otherwise create local fallback.
DO $do$
BEGIN
	IF NOT EXISTS (
		SELECT 1
		FROM pg_proc
		WHERE pronamespace = 'public'::regnamespace
			AND proname = 'update_updated_at_column'
	) THEN
		CREATE OR REPLACE FUNCTION public.update_updated_at_column()
		RETURNS TRIGGER AS $$
		BEGIN
			NEW.updated_at = NOW();
			RETURN NEW;
		END;
		$$ LANGUAGE plpgsql;
	END IF;
END $do$;

DROP TRIGGER IF EXISTS trigger_calendar_reminders_updated_at ON public.academic_calendar_reminder_requests;
CREATE TRIGGER trigger_calendar_reminders_updated_at
BEFORE UPDATE ON public.academic_calendar_reminder_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Ensure API roles can access via RLS rules.
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT INSERT ON public.academic_calendar_reminder_requests TO anon, authenticated;
GRANT SELECT, UPDATE ON public.academic_calendar_reminder_requests TO authenticated;
GRANT INSERT ON public.academic_calendar_reminder_dispatch_log TO authenticated;
GRANT SELECT ON public.academic_calendar_reminder_dispatch_log TO authenticated;

-- RLS
ALTER TABLE public.academic_calendar_reminder_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academic_calendar_reminder_dispatch_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public create reminder requests" ON public.academic_calendar_reminder_requests;
CREATE POLICY "Allow public create reminder requests"
ON public.academic_calendar_reminder_requests
FOR INSERT
TO anon, authenticated
WITH CHECK (
	status = 'pending'
	AND is_active = true
	AND reviewed_by IS NULL
	AND reviewed_at IS NULL
);

DROP POLICY IF EXISTS "Allow admin read reminder requests" ON public.academic_calendar_reminder_requests;
CREATE POLICY "Allow admin read reminder requests"
ON public.academic_calendar_reminder_requests
FOR SELECT
TO authenticated
USING (public.is_admin());

DROP POLICY IF EXISTS "Allow admin update reminder requests" ON public.academic_calendar_reminder_requests;
CREATE POLICY "Allow admin update reminder requests"
ON public.academic_calendar_reminder_requests
FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Allow admin delete reminder requests" ON public.academic_calendar_reminder_requests;
CREATE POLICY "Allow admin delete reminder requests"
ON public.academic_calendar_reminder_requests
FOR DELETE
TO authenticated
USING (public.is_admin());

DROP POLICY IF EXISTS "Allow admin read reminder dispatch logs" ON public.academic_calendar_reminder_dispatch_log;
CREATE POLICY "Allow admin read reminder dispatch logs"
ON public.academic_calendar_reminder_dispatch_log
FOR SELECT
TO authenticated
USING (public.is_admin());

DROP POLICY IF EXISTS "Allow admin insert reminder dispatch logs" ON public.academic_calendar_reminder_dispatch_log;
CREATE POLICY "Allow admin insert reminder dispatch logs"
ON public.academic_calendar_reminder_dispatch_log
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

-- service_role bypasses RLS; this policy allows authenticated-admin writes from admin tooling.
DROP POLICY IF EXISTS "Allow admin update reminder dispatch logs" ON public.academic_calendar_reminder_dispatch_log;
CREATE POLICY "Allow admin update reminder dispatch logs"
ON public.academic_calendar_reminder_dispatch_log
FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());
