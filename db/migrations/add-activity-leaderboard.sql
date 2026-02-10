-- ============================================
-- Activity Score + Leaderboard (Admin-only)
--
-- Ranking rules (as requested):
-- 1) Most reviews provided
-- 2) Review votes (measured as votes CAST by a verified user)
-- 3) Successful referrals (count of users referred)
-- Tie-breaker: user_visits.visit_count
--
-- NOTE: This function is admin-only via public.is_admin().
-- ============================================

-- Postgres cannot CREATE OR REPLACE when the OUT/return row type changes.
-- Drop first so this migration is rerunnable across schema iterations.
DROP FUNCTION IF EXISTS public.get_activity_leaderboard(INTEGER);

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
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
	IF NOT public.is_admin() THEN
		RAISE EXCEPTION 'admin_only';
	END IF;

	RETURN QUERY
	WITH review_agg AS (
		SELECT
			tr.student_id::uuid AS user_id,
			COUNT(*)::bigint AS reviews_count
		FROM public.teacher_reviews tr
		WHERE tr.student_id IS NOT NULL
		GROUP BY tr.student_id::uuid
	),
	vote_agg AS (
		SELECT
			rv.voter_user_id AS user_id,
			COUNT(*)::bigint AS votes_cast
		FROM public.review_votes rv
		WHERE rv.voter_user_id IS NOT NULL
		GROUP BY rv.voter_user_id
	),
	ref_agg AS (
		SELECT
			u.referred_by_user_id AS user_id,
			COUNT(*)::bigint AS referrals_count
		FROM public.users u
		WHERE u.referred_by_user_id IS NOT NULL
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
		(
			COALESCE(r.reviews_count, 0)
			+ COALESCE(v.votes_cast, 0)
			+ COALESCE(ref.referrals_count, 0)
		)::bigint AS score
	FROM public.users u
	LEFT JOIN review_agg r ON r.user_id = u.id
	LEFT JOIN vote_agg v ON v.user_id = u.id
	LEFT JOIN ref_agg ref ON ref.user_id = u.id
	LEFT JOIN public.user_visits uv ON uv.user_id = u.id
	WHERE u.email_verified = TRUE
	ORDER BY
		COALESCE(r.reviews_count, 0) DESC,
		COALESCE(v.votes_cast, 0) DESC,
		COALESCE(ref.referrals_count, 0) DESC,
		COALESCE(uv.visit_count, 0) DESC,
		u.created_at ASC
	LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 10), 100));
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_activity_leaderboard(INTEGER) TO authenticated;
