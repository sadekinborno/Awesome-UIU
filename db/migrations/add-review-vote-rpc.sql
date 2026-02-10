-- ============================================
-- Review voting (per logged-in user)
--
-- Adds voter_user_id to review_votes and provides an atomic RPC
-- to toggle/switch votes while keeping helpful_count/not_helpful_count
-- in sync.
--
-- Frontend calls: public.toggle_review_vote(review_id, voter_user_id, vote_type)
-- ============================================

-- Ensure teacher_reviews has vote count columns (older schemas may be missing one/both)
ALTER TABLE public.teacher_reviews
	ADD COLUMN IF NOT EXISTS helpful_count INTEGER DEFAULT 0;

ALTER TABLE public.teacher_reviews
	ADD COLUMN IF NOT EXISTS not_helpful_count INTEGER DEFAULT 0;

-- 1) Ensure review_votes exists (base schema may already have it)
CREATE TABLE IF NOT EXISTS public.review_votes (
	id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
	review_id UUID NOT NULL REFERENCES public.teacher_reviews(id) ON DELETE CASCADE,
	voter_ip TEXT NOT NULL,
	vote_type TEXT NOT NULL CHECK (vote_type IN ('helpful', 'not_helpful')),
	created_at TIMESTAMP DEFAULT NOW(),
	UNIQUE(review_id, voter_ip)
);

-- If review_votes already existed (older schema), it may not have voter_ip.
-- Keep this migration backward compatible by adding it if missing.
ALTER TABLE public.review_votes
	ADD COLUMN IF NOT EXISTS voter_ip TEXT;

-- Normalize existing vote_type values (some legacy schemas used 'not helpful' or 'not-helpful')
UPDATE public.review_votes
SET vote_type = CASE
	WHEN lower(trim(vote_type)) = 'helpful' THEN 'helpful'
	WHEN replace(replace(lower(trim(vote_type)), '-', '_'), ' ', '_') = 'not_helpful' THEN 'not_helpful'
	ELSE vote_type
END
WHERE vote_type IS NOT NULL;

-- Ensure vote_type check constraint allows canonical values.
-- (Some projects shipped different CHECKs; drop common names if present and add our canonical one.)
ALTER TABLE public.review_votes DROP CONSTRAINT IF EXISTS review_votes_vote_type_check;
ALTER TABLE public.review_votes DROP CONSTRAINT IF EXISTS review_votes_vote_type_check1;

DO $do$
BEGIN
	-- Add the canonical check if no existing check constraint for vote_type is present.
	IF NOT EXISTS (
		SELECT 1
		FROM pg_constraint c
		WHERE c.conrelid = 'public.review_votes'::regclass
		  AND c.contype = 'c'
		  AND pg_get_constraintdef(c.oid) ILIKE '%vote_type%'
	) THEN
		EXECUTE 'ALTER TABLE public.review_votes '
			|| 'ADD CONSTRAINT review_votes_vote_type_check '
			|| 'CHECK (vote_type IN (''helpful'', ''not_helpful''))';
	END IF;
END
$do$;

-- Some older schemas store voter identity as student_email and may require it.
-- If present, relax NOT NULL so voter_user_id can be the primary identity.
DO $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM information_schema.columns
		WHERE table_schema = 'public'
		  AND table_name = 'review_votes'
		  AND column_name = 'student_email'
	) THEN
		BEGIN
			EXECUTE 'ALTER TABLE public.review_votes ALTER COLUMN student_email DROP NOT NULL';
		EXCEPTION WHEN others THEN
			-- If this fails for any reason, continue; the RPC below will try to populate student_email.
		END;
	END IF;
END $$;

-- 2) Add voter_user_id for verified-student voting
ALTER TABLE public.review_votes
	ADD COLUMN IF NOT EXISTS voter_user_id UUID;

CREATE INDEX IF NOT EXISTS idx_review_votes_voter_user_id ON public.review_votes(voter_user_id);

-- Unique per review per user (when voter_user_id is present)
CREATE UNIQUE INDEX IF NOT EXISTS uq_review_votes_review_user
	ON public.review_votes (review_id, voter_user_id)
	WHERE voter_user_id IS NOT NULL;


-- 3) RPC: Toggle vote (add/remove/switch) + update counts atomically
CREATE OR REPLACE FUNCTION public.toggle_review_vote(
	p_review_id UUID,
	p_voter_user_id UUID,
	p_vote_type TEXT
)
RETURNS TABLE (
	helpful_count INTEGER,
	not_helpful_count INTEGER,
	action TEXT,
	current_vote_type TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
	existing_id UUID;
	existing_type TEXT;
	new_type TEXT;
	voter_email TEXT;
	delta_helpful INTEGER := 0;
	delta_not_helpful INTEGER := 0;
	updated_helpful INTEGER;
	updated_not_helpful INTEGER;
	result_action TEXT;
BEGIN
	IF p_review_id IS NULL OR p_voter_user_id IS NULL THEN
		RAISE EXCEPTION 'invalid_input';
	END IF;

	new_type := replace(replace(lower(trim(coalesce(p_vote_type, ''))), '-', '_'), ' ', '_');
	IF new_type NOT IN ('helpful', 'not_helpful') THEN
		RAISE EXCEPTION 'invalid_vote_type';
	END IF;

	SELECT u.email
	INTO voter_email
	FROM public.users u
	WHERE u.id = p_voter_user_id
	LIMIT 1;

	SELECT rv.id, rv.vote_type
	INTO existing_id, existing_type
	FROM public.review_votes rv
	WHERE rv.review_id = p_review_id
	  AND rv.voter_user_id = p_voter_user_id
	LIMIT 1;

	IF existing_id IS NULL THEN
		-- Add
		IF EXISTS (
			SELECT 1
			FROM information_schema.columns
			WHERE table_schema = 'public'
			  AND table_name = 'review_votes'
			  AND column_name = 'student_email'
		) THEN
			EXECUTE 'INSERT INTO public.review_votes (review_id, voter_ip, vote_type, voter_user_id, student_email) VALUES ($1, $2, $3, $4, $5)'
			USING p_review_id, ('user:' || p_voter_user_id::text), new_type, p_voter_user_id, voter_email;
		ELSE
			INSERT INTO public.review_votes (review_id, voter_ip, vote_type, voter_user_id)
			VALUES (p_review_id, 'user:' || p_voter_user_id::text, new_type, p_voter_user_id);
		END IF;

		IF new_type = 'helpful' THEN
			delta_helpful := 1;
		ELSE
			delta_not_helpful := 1;
		END IF;
		result_action := 'added';
	ELSIF existing_type = new_type THEN
		-- Remove
		DELETE FROM public.review_votes WHERE id = existing_id;
		IF new_type = 'helpful' THEN
			delta_helpful := -1;
		ELSE
			delta_not_helpful := -1;
		END IF;
		result_action := 'removed';
	ELSE
		-- Switch
		UPDATE public.review_votes SET vote_type = new_type WHERE id = existing_id;
		IF existing_type = 'helpful' THEN
			delta_helpful := -1;
		ELSE
			delta_not_helpful := -1;
		END IF;
		IF new_type = 'helpful' THEN
			delta_helpful := delta_helpful + 1;
		ELSE
			delta_not_helpful := delta_not_helpful + 1;
		END IF;
		result_action := 'switched';
	END IF;

	-- Recompute counts from review_votes to avoid drift/double-counting across schema variations.
	SELECT
		COUNT(*) FILTER (WHERE vote_type = 'helpful')::int,
		COUNT(*) FILTER (WHERE vote_type IN ('not_helpful', 'not-helpful', 'not helpful'))::int
	INTO updated_helpful, updated_not_helpful
	FROM public.review_votes
	WHERE review_id = p_review_id;

	UPDATE public.teacher_reviews tr
	SET
		helpful_count = COALESCE(updated_helpful, 0),
		not_helpful_count = COALESCE(updated_not_helpful, 0)
	WHERE tr.id = p_review_id;

	RETURN QUERY
	SELECT
		updated_helpful,
		updated_not_helpful,
		result_action,
		CASE WHEN result_action = 'removed' THEN NULL ELSE new_type END;
END;
$$;

-- Backfill existing teacher_reviews counts from current review_votes
WITH agg AS (
	SELECT
		review_id,
		COUNT(*) FILTER (WHERE vote_type = 'helpful')::int AS helpful_count,
		COUNT(*) FILTER (WHERE vote_type IN ('not_helpful', 'not-helpful', 'not helpful'))::int AS not_helpful_count
	FROM public.review_votes
	GROUP BY review_id
)
UPDATE public.teacher_reviews tr
SET
	helpful_count = COALESCE(agg.helpful_count, 0),
	not_helpful_count = COALESCE(agg.not_helpful_count, 0)
FROM agg
WHERE tr.id = agg.review_id;

GRANT EXECUTE ON FUNCTION public.toggle_review_vote(UUID, UUID, TEXT) TO anon, authenticated;
