-- ============================================
-- Student Personal Academic Calendar Reminders
--
-- Goals:
-- - Let students add their own reminders per calendar date
-- - Enforce maximum 5 active (upcoming/today) reminders per student
-- - Track reminder send status for scheduled email delivery
-- ============================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.student_calendar_reminders (
	id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
	student_email TEXT NOT NULL,
	student_id TEXT,
	term TEXT,
	title TEXT NOT NULL,
	description TEXT,
	reminder_date DATE NOT NULL,
	days_before INTEGER NOT NULL DEFAULT 0 CHECK (days_before BETWEEN 0 AND 30),
	remind_at TIMESTAMPTZ NOT NULL,
	is_active BOOLEAN NOT NULL DEFAULT TRUE,
	email_sent_at TIMESTAMPTZ,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	CONSTRAINT student_calendar_reminders_title_len CHECK (char_length(btrim(title)) BETWEEN 1 AND 140),
	CONSTRAINT student_calendar_reminders_email_format CHECK (
		student_email ~* '^[^\s@]+@([a-z0-9-]+\.)*uiu\.ac\.bd$'
	)
);

CREATE INDEX IF NOT EXISTS idx_student_calendar_reminders_email
ON public.student_calendar_reminders(student_email);

CREATE INDEX IF NOT EXISTS idx_student_calendar_reminders_active_date
ON public.student_calendar_reminders(student_email, is_active, reminder_date);

CREATE INDEX IF NOT EXISTS idx_student_calendar_reminders_due
ON public.student_calendar_reminders(is_active, remind_at, email_sent_at);

CREATE UNIQUE INDEX IF NOT EXISTS uq_student_calendar_reminders_active_event
ON public.student_calendar_reminders(student_email, reminder_date, lower(btrim(title)))
WHERE is_active = true;

ALTER TABLE public.student_calendar_reminders
ADD COLUMN IF NOT EXISTS days_before INTEGER;

UPDATE public.student_calendar_reminders
SET days_before = 0
WHERE days_before IS NULL;

ALTER TABLE public.student_calendar_reminders
ALTER COLUMN days_before SET DEFAULT 0,
ALTER COLUMN days_before SET NOT NULL;

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

DROP TRIGGER IF EXISTS trigger_student_calendar_reminders_updated_at ON public.student_calendar_reminders;
CREATE TRIGGER trigger_student_calendar_reminders_updated_at
BEFORE UPDATE ON public.student_calendar_reminders
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.student_calendar_reminders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow admin read student calendar reminders" ON public.student_calendar_reminders;
CREATE POLICY "Allow admin read student calendar reminders"
ON public.student_calendar_reminders
FOR SELECT
TO authenticated
USING (public.is_admin());

DROP POLICY IF EXISTS "Allow admin update student calendar reminders" ON public.student_calendar_reminders;
CREATE POLICY "Allow admin update student calendar reminders"
ON public.student_calendar_reminders
FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Allow admin insert student calendar reminders" ON public.student_calendar_reminders;
CREATE POLICY "Allow admin insert student calendar reminders"
ON public.student_calendar_reminders
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());
