-- ============================================
-- Academic Calendar (Events)
--
-- Goals:
-- - Store academic calendar events (single-day and ranges)
-- - Public can read events (anon/authenticated)
-- - Only authenticated admins can insert/update/delete (public.is_admin())
--
-- Prereqs:
-- - uuid-ossp extension (usually enabled)
-- - admin-auth-setup.sql (creates public.is_admin())
-- ============================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.academic_calendar_events (
	id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
	term TEXT NOT NULL, -- e.g., "Spring 2026"
	title TEXT NOT NULL,
	category TEXT NOT NULL DEFAULT 'general',
	audience TEXT NOT NULL DEFAULT 'all',
	importance INTEGER NOT NULL DEFAULT 2 CHECK (importance BETWEEN 1 AND 3),
	start_date DATE NOT NULL,
	end_date DATE NOT NULL,
	all_day BOOLEAN NOT NULL DEFAULT TRUE,
	description TEXT,
	source TEXT NOT NULL DEFAULT 'admin',
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	CONSTRAINT academic_calendar_date_range CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_academic_calendar_term ON public.academic_calendar_events(term);
CREATE INDEX IF NOT EXISTS idx_academic_calendar_start ON public.academic_calendar_events(start_date);
CREATE INDEX IF NOT EXISTS idx_academic_calendar_end ON public.academic_calendar_events(end_date);

-- Reuse the shared timestamp trigger if it exists; otherwise define a local one.
DO $do$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_proc
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

DROP TRIGGER IF EXISTS trigger_academic_calendar_updated_at ON public.academic_calendar_events;
CREATE TRIGGER trigger_academic_calendar_updated_at
BEFORE UPDATE ON public.academic_calendar_events
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.academic_calendar_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read on academic_calendar_events" ON public.academic_calendar_events;
CREATE POLICY "Allow public read on academic_calendar_events"
ON public.academic_calendar_events
FOR SELECT
TO public
USING (true);

DROP POLICY IF EXISTS "Allow admin insert on academic_calendar_events" ON public.academic_calendar_events;
CREATE POLICY "Allow admin insert on academic_calendar_events"
ON public.academic_calendar_events
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Allow admin update on academic_calendar_events" ON public.academic_calendar_events;
CREATE POLICY "Allow admin update on academic_calendar_events"
ON public.academic_calendar_events
FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Allow admin delete on academic_calendar_events" ON public.academic_calendar_events;
CREATE POLICY "Allow admin delete on academic_calendar_events"
ON public.academic_calendar_events
FOR DELETE
TO authenticated
USING (public.is_admin());
