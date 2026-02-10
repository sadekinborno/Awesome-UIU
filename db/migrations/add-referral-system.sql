-- ============================================
-- Referral System (OTP-based, no Supabase Auth)
-- Adds:
-- - users.referral_code (unique)
-- - users.referred_by_user_id (set once)
-- - RPCs: ensure_referral_code(email), apply_referral(referred_user_id, ref_code)
-- ============================================

-- Needed for gen_random_bytes
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1) Columns
ALTER TABLE IF EXISTS public.users
	ADD COLUMN IF NOT EXISTS referral_code TEXT,
	ADD COLUMN IF NOT EXISTS referred_by_user_id UUID;

-- FK (may fail if column already has a constraint with same name; IF NOT EXISTS not supported)
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1
		FROM pg_constraint
		WHERE conname = 'users_referred_by_user_id_fkey'
	) THEN
		ALTER TABLE public.users
			ADD CONSTRAINT users_referred_by_user_id_fkey
			FOREIGN KEY (referred_by_user_id)
			REFERENCES public.users(id);
	END IF;
END $$;

-- 2) Indexes
CREATE UNIQUE INDEX IF NOT EXISTS users_referral_code_unique
	ON public.users (referral_code)
	WHERE referral_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS users_referred_by_user_id_idx
	ON public.users (referred_by_user_id);

-- 3) Generate a referral code (loop until unused)
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
	candidate TEXT;
	attempts INT := 0;
BEGIN
	LOOP
		attempts := attempts + 1;
		candidate := upper(substr(encode(gen_random_bytes(8), 'hex'), 1, 10));

		IF NOT EXISTS (
			SELECT 1 FROM public.users WHERE referral_code = candidate
		) THEN
			RETURN candidate;
		END IF;

		IF attempts >= 20 THEN
			RAISE EXCEPTION 'Could not generate unique referral code';
		END IF;
	END LOOP;
END;
$$;

-- 4) Auto-set referral code on insert
CREATE OR REPLACE FUNCTION public.users_set_referral_code()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
	IF NEW.referral_code IS NULL OR length(trim(NEW.referral_code)) = 0 THEN
		NEW.referral_code := public.generate_referral_code();
	END IF;
	RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_users_set_referral_code ON public.users;
CREATE TRIGGER trg_users_set_referral_code
BEFORE INSERT ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.users_set_referral_code();

-- 5) Prevent changing referral fields after they are set
CREATE OR REPLACE FUNCTION public.users_lock_referral_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
	-- referral_code can be set once (NULL/blank -> value), then becomes immutable
	IF NEW.referral_code IS DISTINCT FROM OLD.referral_code THEN
		IF (OLD.referral_code IS NULL OR length(trim(OLD.referral_code)) = 0)
			AND (NEW.referral_code IS NOT NULL AND length(trim(NEW.referral_code)) > 0) THEN
			-- allow first-time set
		ELSE
			RAISE EXCEPTION 'referral_code is immutable';
		END IF;
	END IF;

	-- referred_by_user_id can only be set once (NULL -> value)
	IF OLD.referred_by_user_id IS NOT NULL
		AND NEW.referred_by_user_id IS DISTINCT FROM OLD.referred_by_user_id THEN
		RAISE EXCEPTION 'referred_by_user_id is immutable';
	END IF;

	RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_users_lock_referral_fields ON public.users;
CREATE TRIGGER trg_users_lock_referral_fields
BEFORE UPDATE OF referral_code, referred_by_user_id ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.users_lock_referral_fields();

-- 6) Backfill referral_code for existing users (row-by-row to avoid unique collisions)
DO $$
DECLARE
	r RECORD;
	new_code TEXT;
BEGIN
	FOR r IN (
		SELECT id
		FROM public.users
		WHERE referral_code IS NULL OR length(trim(referral_code)) = 0
		ORDER BY created_at ASC
	) LOOP
		new_code := public.generate_referral_code();
		UPDATE public.users
		SET referral_code = new_code
		WHERE id = r.id
			AND (referral_code IS NULL OR length(trim(referral_code)) = 0);
	END LOOP;
END $$;

-- 7) RPC: ensure referral code exists for a user (by email)
CREATE OR REPLACE FUNCTION public.ensure_referral_code(p_user_email TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
	code TEXT;
BEGIN
	SELECT referral_code
	INTO code
	FROM public.users
	WHERE lower(email) = lower(p_user_email)
	LIMIT 1;

	IF code IS NOT NULL AND length(trim(code)) > 0 THEN
		RETURN code;
	END IF;

	code := public.generate_referral_code();

	UPDATE public.users
	SET referral_code = code
	WHERE lower(email) = lower(p_user_email)
		AND (referral_code IS NULL OR length(trim(referral_code)) = 0);

	RETURN code;
END;
$$;

-- 8) RPC: apply referral for a newly-created user
-- Rule: only counts for first-time registration (new user), enforced by requiring created_at within 15 minutes
-- and referred_by_user_id IS NULL.
CREATE OR REPLACE FUNCTION public.apply_referral(
	p_referred_user_id UUID,
	p_ref_code TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
	referrer_id UUID;
	referred_created_at TIMESTAMP;
	referred_verified BOOLEAN;
	referred_by UUID;
BEGIN
	IF p_referred_user_id IS NULL OR p_ref_code IS NULL OR length(trim(p_ref_code)) = 0 THEN
		RETURN FALSE;
	END IF;

	SELECT created_at, email_verified, referred_by_user_id
	INTO referred_created_at, referred_verified, referred_by
	FROM public.users
	WHERE id = p_referred_user_id
	LIMIT 1;

	IF referred_created_at IS NULL THEN
		RETURN FALSE;
	END IF;

	IF referred_by IS NOT NULL THEN
		RETURN FALSE;
	END IF;

	-- Only allow claiming near registration time
	IF referred_created_at < (now() - interval '15 minutes') THEN
		RETURN FALSE;
	END IF;

	-- Must be verified (your OTP flow sets this true)
	IF referred_verified IS DISTINCT FROM TRUE THEN
		RETURN FALSE;
	END IF;

	SELECT id
	INTO referrer_id
	FROM public.users
	WHERE referral_code = upper(trim(p_ref_code))
		AND email_verified = TRUE
	LIMIT 1;

	IF referrer_id IS NULL THEN
		RETURN FALSE;
	END IF;

	IF referrer_id = p_referred_user_id THEN
		RETURN FALSE;
	END IF;

	UPDATE public.users
	SET referred_by_user_id = referrer_id
	WHERE id = p_referred_user_id
		AND referred_by_user_id IS NULL;

	RETURN TRUE;
END;
$$;

-- 9) Permissions (explicit)
GRANT EXECUTE ON FUNCTION public.generate_referral_code() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_referral_code(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_referral(UUID, TEXT) TO anon, authenticated;
