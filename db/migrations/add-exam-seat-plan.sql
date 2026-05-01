-- ============================================
-- Exam Routine & Seat Plan
--
-- Goals:
-- - Store exam sessions (mid/final) and per-course exams
-- - Store seat plan allocations per exam (room + optional student ID range)
-- - Public can read sessions/exams/seat allocations
-- - Only authenticated admins can insert/update/delete (public.is_admin())
--
-- Prereqs:
-- - uuid-ossp extension (usually enabled)
-- - admin-auth-setup.sql (creates public.is_admin())
-- ============================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

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

-- 1) Sessions (e.g., Spring 2026 Mid)
CREATE TABLE IF NOT EXISTS public.exam_sessions (
	id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
	name TEXT NOT NULL UNIQUE,
	exam_type TEXT NOT NULL CHECK (exam_type IN ('mid', 'final')),
	term TEXT,
	published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	is_active BOOLEAN NOT NULL DEFAULT TRUE,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_exam_sessions_active_published
	ON public.exam_sessions (is_active, published_at DESC);

DROP TRIGGER IF EXISTS trigger_exam_sessions_updated_at ON public.exam_sessions;
CREATE TRIGGER trigger_exam_sessions_updated_at
BEFORE UPDATE ON public.exam_sessions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Exams (one per dept+course+section in a session)
CREATE TABLE IF NOT EXISTS public.exam_exams (
	id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
	session_id UUID NOT NULL REFERENCES public.exam_sessions(id) ON DELETE CASCADE,

	department TEXT NOT NULL,
	course_code TEXT NOT NULL,
	course_title TEXT,
	section TEXT NOT NULL,
	teacher TEXT,

	exam_date DATE NOT NULL,
	start_time TIME NOT NULL,
	end_time TIME NOT NULL,

	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

	UNIQUE (session_id, department, course_code, section, exam_date, start_time)
);

CREATE INDEX IF NOT EXISTS idx_exam_exams_lookup
	ON public.exam_exams (session_id, department, course_code, section);

CREATE INDEX IF NOT EXISTS idx_exam_exams_session
	ON public.exam_exams (session_id);

DROP TRIGGER IF EXISTS trigger_exam_exams_updated_at ON public.exam_exams;
CREATE TRIGGER trigger_exam_exams_updated_at
BEFORE UPDATE ON public.exam_exams
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 3) Seat allocations (usually multiple rooms per exam)
CREATE TABLE IF NOT EXISTS public.exam_seat_allocations (
	id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
	exam_id UUID NOT NULL REFERENCES public.exam_exams(id) ON DELETE CASCADE,

	room_number TEXT,
	room_label TEXT NOT NULL,

	student_id_start BIGINT,
	student_id_end BIGINT,

	student_id_range int8range GENERATED ALWAYS AS (
		CASE
			WHEN student_id_start IS NULL OR student_id_end IS NULL THEN NULL
			ELSE int8range(student_id_start, student_id_end, '[]')
		END
	) STORED,

	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

	CHECK (
		(student_id_start IS NULL AND student_id_end IS NULL)
		OR (student_id_start IS NOT NULL AND student_id_end IS NOT NULL AND student_id_start <= student_id_end)
	)
);

CREATE INDEX IF NOT EXISTS idx_exam_seat_alloc_exam
	ON public.exam_seat_allocations (exam_id);

CREATE INDEX IF NOT EXISTS idx_exam_seat_alloc_range_gist
	ON public.exam_seat_allocations USING gist (student_id_range);

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

ALTER TABLE public.exam_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_seat_allocations ENABLE ROW LEVEL SECURITY;

-- Public read
DROP POLICY IF EXISTS "Allow public read on exam_sessions" ON public.exam_sessions;
CREATE POLICY "Allow public read on exam_sessions"
ON public.exam_sessions
FOR SELECT
TO public
USING (true);

DROP POLICY IF EXISTS "Allow public read on exam_exams" ON public.exam_exams;
CREATE POLICY "Allow public read on exam_exams"
ON public.exam_exams
FOR SELECT
TO public
USING (true);

DROP POLICY IF EXISTS "Allow public read on exam_seat_allocations" ON public.exam_seat_allocations;
CREATE POLICY "Allow public read on exam_seat_allocations"
ON public.exam_seat_allocations
FOR SELECT
TO public
USING (true);

-- Admin write
DROP POLICY IF EXISTS "Allow admin insert on exam_sessions" ON public.exam_sessions;
CREATE POLICY "Allow admin insert on exam_sessions"
ON public.exam_sessions
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Allow admin update on exam_sessions" ON public.exam_sessions;
CREATE POLICY "Allow admin update on exam_sessions"
ON public.exam_sessions
FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Allow admin delete on exam_sessions" ON public.exam_sessions;
CREATE POLICY "Allow admin delete on exam_sessions"
ON public.exam_sessions
FOR DELETE
TO authenticated
USING (public.is_admin());

DROP POLICY IF EXISTS "Allow admin insert on exam_exams" ON public.exam_exams;
CREATE POLICY "Allow admin insert on exam_exams"
ON public.exam_exams
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Allow admin update on exam_exams" ON public.exam_exams;
CREATE POLICY "Allow admin update on exam_exams"
ON public.exam_exams
FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Allow admin delete on exam_exams" ON public.exam_exams;
CREATE POLICY "Allow admin delete on exam_exams"
ON public.exam_exams
FOR DELETE
TO authenticated
USING (public.is_admin());

DROP POLICY IF EXISTS "Allow admin insert on exam_seat_allocations" ON public.exam_seat_allocations;
CREATE POLICY "Allow admin insert on exam_seat_allocations"
ON public.exam_seat_allocations
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Allow admin update on exam_seat_allocations" ON public.exam_seat_allocations;
CREATE POLICY "Allow admin update on exam_seat_allocations"
ON public.exam_seat_allocations
FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Allow admin delete on exam_seat_allocations" ON public.exam_seat_allocations;
CREATE POLICY "Allow admin delete on exam_seat_allocations"
ON public.exam_seat_allocations
FOR DELETE
TO authenticated
USING (public.is_admin());
