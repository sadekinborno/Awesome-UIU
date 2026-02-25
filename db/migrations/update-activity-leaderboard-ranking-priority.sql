-- ============================================
-- Update activity leaderboard ranking priority
--
-- Desired ranking:
-- 1) Most successful referrals
-- 2) Most reviews submitted
-- 3) Most votes cast on reviews
-- Tie-breaker: user_visits.visit_count
--
-- NOTE: This function is admin-only via public.is_admin().
-- ============================================

ALTER TABLE public.users
	ADD COLUMN IF NOT EXISTS points BIGINT NOT NULL DEFAULT 0;

-- For now, keep leaderboard points all-time until the next countdown starts.
DELETE FROM public.app_settings WHERE key = 'points_countdown_start';

CREATE OR REPLACE FUNCTION public.get_activity_leaderboard(p_limit INTEGER DEFAULT 10)
RETURNS TABLE (
	user_id UUID,
	email TEXT,
	student_id TEXT,
	reviews_count BIGINT,
	votes_cast BIGINT,
	referrals_count BIGINT,
	visit_count INTEGER,
	score BIGINT
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
	points_window_start_utc TIMESTAMPTZ;
BEGIN
	IF NOT public.is_admin() THEN
		RAISE EXCEPTION 'admin_only';
	END IF;

	BEGIN
		SELECT NULLIF(a.value, '')::timestamptz
		INTO points_window_start_utc
		FROM public.app_settings a
		WHERE a.key = 'points_countdown_start'
		LIMIT 1;
	EXCEPTION WHEN OTHERS THEN
		points_window_start_utc := NULL;
	END;

	WITH review_agg AS (
		SELECT
			tr.student_id::uuid AS user_id,
			COUNT(*)::bigint AS reviews_count
		FROM public.teacher_reviews tr
		WHERE tr.student_id IS NOT NULL
			AND (points_window_start_utc IS NULL OR tr.created_at >= points_window_start_utc)
		GROUP BY tr.student_id::uuid
	),
	vote_agg AS (
		SELECT
			rv.voter_user_id AS user_id,
			COUNT(*)::bigint AS votes_cast
		FROM public.review_votes rv
		WHERE rv.voter_user_id IS NOT NULL
			AND (points_window_start_utc IS NULL OR rv.created_at >= points_window_start_utc)
		GROUP BY rv.voter_user_id
	),
	ref_agg AS (
		SELECT
			u.referred_by_user_id AS user_id,
			COUNT(*)::bigint AS referrals_count
		FROM public.users u
		WHERE u.referred_by_user_id IS NOT NULL
			AND (points_window_start_utc IS NULL OR u.created_at >= points_window_start_utc)
		GROUP BY u.referred_by_user_id
	),
	ranked AS (
		SELECT
			u.id AS user_id,
			u.email,
			u.student_id,
			COALESCE(r.reviews_count, 0) AS reviews_count,
			COALESCE(v.votes_cast, 0) AS votes_cast,
			COALESCE(ref.referrals_count, 0) AS referrals_count,
			COALESCE(uv.visit_count, 0) AS visit_count,
			(
				COALESCE(ref.referrals_count, 0) * 30
				+ COALESCE(r.reviews_count, 0) * 15
				+ COALESCE(v.votes_cast, 0) * 5
			)::bigint AS computed_points
		FROM public.users u
		LEFT JOIN review_agg r ON r.user_id = u.id
		LEFT JOIN vote_agg v ON v.user_id = u.id
		LEFT JOIN ref_agg ref ON ref.user_id = u.id
		LEFT JOIN public.user_visits uv ON uv.user_id = u.id
		WHERE u.email_verified = TRUE
	),
	updated AS (
		SELECT * FROM ranked
	)
	UPDATE public.users u
	SET points = updated.computed_points
	FROM updated
	WHERE u.id = updated.user_id;

	RETURN QUERY
	WITH review_agg AS (
		SELECT
			tr.student_id::uuid AS user_id,
			COUNT(*)::bigint AS reviews_count
		FROM public.teacher_reviews tr
		WHERE tr.student_id IS NOT NULL
			AND (points_window_start_utc IS NULL OR tr.created_at >= points_window_start_utc)
		GROUP BY tr.student_id::uuid
	),
	vote_agg AS (
		SELECT
			rv.voter_user_id AS user_id,
			COUNT(*)::bigint AS votes_cast
		FROM public.review_votes rv
		WHERE rv.voter_user_id IS NOT NULL
			AND (points_window_start_utc IS NULL OR rv.created_at >= points_window_start_utc)
		GROUP BY rv.voter_user_id
	),
	ref_agg AS (
		SELECT
			u.referred_by_user_id AS user_id,
			COUNT(*)::bigint AS referrals_count
		FROM public.users u
		WHERE u.referred_by_user_id IS NOT NULL
			AND (points_window_start_utc IS NULL OR u.created_at >= points_window_start_utc)
		GROUP BY u.referred_by_user_id
	)
	SELECT
		u.id AS user_id,
		u.email,
		u.student_id,
		COALESCE(r.reviews_count, 0) AS reviews_count,
		COALESCE(v.votes_cast, 0) AS votes_cast,
		COALESCE(ref.referrals_count, 0) AS referrals_count,
		COALESCE(uv.visit_count, 0) AS visit_count,
		COALESCE(u.points, 0)::bigint AS score
	FROM public.users u
	LEFT JOIN review_agg r ON r.user_id = u.id
	LEFT JOIN vote_agg v ON v.user_id = u.id
	LEFT JOIN ref_agg ref ON ref.user_id = u.id
	LEFT JOIN public.user_visits uv ON uv.user_id = u.id
	WHERE u.email_verified = TRUE
	ORDER BY
		COALESCE(ref.referrals_count, 0) DESC,
		COALESCE(r.reviews_count, 0) DESC,
		COALESCE(v.votes_cast, 0) DESC,
		COALESCE(uv.visit_count, 0) DESC
	LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 10), 100));
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_activity_leaderboard(INTEGER) TO authenticated;

CREATE OR REPLACE FUNCTION public.start_mystery_countdown(
	p_duration_days INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
	now_utc TIMESTAMPTZ := (NOW() AT TIME ZONE 'utc');
	duration_int INTEGER;
BEGIN
	IF NOT public.is_admin() THEN
		RAISE EXCEPTION 'admin_only';
	END IF;

	duration_int := GREATEST(1, LEAST(COALESCE(p_duration_days, 15), 365));

	INSERT INTO public.app_settings (key, value, updated_at)
	VALUES ('mystery_countdown_start', now_utc::text, now_utc)
	ON CONFLICT (key)
	DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at;

	INSERT INTO public.app_settings (key, value, updated_at)
	VALUES ('mystery_countdown_duration_days', duration_int::text, now_utc)
	ON CONFLICT (key)
	DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at;

	INSERT INTO public.app_settings (key, value, updated_at)
	VALUES ('points_countdown_start', now_utc::text, now_utc)
	ON CONFLICT (key)
	DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at;

	DELETE FROM public.app_settings WHERE key = 'global_announcement';

	UPDATE public.users
	SET points = 0
	WHERE email_verified = TRUE;

	RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.start_mystery_countdown(INTEGER) TO authenticated;
