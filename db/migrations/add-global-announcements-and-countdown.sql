-- ============================================
-- Global announcements + configurable mystery countdown (Admin-only)
--
-- Goals:
-- - Admin can publish a homepage announcement (new features + upcoming features)
-- - Admin can set next countdown duration and start it
-- - Homepage reads via anon/public (SELECT-only) from app_settings
-- - Announcement remains visible until the next countdown starts (start clears it)
-- ============================================

-- 1) Ensure app_settings exists (some environments may already have it)
CREATE TABLE IF NOT EXISTS public.app_settings (
	key TEXT PRIMARY KEY,
	value TEXT,
	updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.app_settings
	ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 2) RLS: allow public read (homepage needs it)
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access to app_settings" ON public.app_settings;
CREATE POLICY "Allow public read access to app_settings"
ON public.app_settings FOR SELECT
TO public
USING (true);


-- 3) Admin-only RPCs

-- v2: includes winners + gift notice

CREATE OR REPLACE FUNCTION public.publish_global_announcement_v2(
	p_new_features TEXT,
	p_upcoming_features TEXT,
	p_winners TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
	now_utc TIMESTAMPTZ := (NOW() AT TIME ZONE 'utc');
	new_items TEXT[];
	upcoming_items TEXT[];
	winner_items TEXT[];
	payload JSONB;
BEGIN
	IF NOT public.is_admin() THEN
		RAISE EXCEPTION 'admin_only';
	END IF;

	winner_items := ARRAY(
		SELECT trim(x)
		FROM unnest(regexp_split_to_array(coalesce(p_winners, ''), E'\r?\n')) AS x
		WHERE trim(x) <> ''
	);

	new_items := ARRAY(
		SELECT trim(x)
		FROM unnest(regexp_split_to_array(coalesce(p_new_features, ''), E'\r?\n')) AS x
		WHERE trim(x) <> ''
	);

	upcoming_items := ARRAY(
		SELECT trim(x)
		FROM unnest(regexp_split_to_array(coalesce(p_upcoming_features, ''), E'\r?\n')) AS x
		WHERE trim(x) <> ''
	);

	payload := jsonb_build_object(
		'published_at', to_char(now_utc, 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
		'gift_notice', 'Mystery gifts were sent to the winners.',
		'winners', coalesce(to_jsonb(winner_items), '[]'::jsonb),
		'new_features', coalesce(to_jsonb(new_items), '[]'::jsonb),
		'upcoming_features', coalesce(to_jsonb(upcoming_items), '[]'::jsonb)
	);

	INSERT INTO public.app_settings (key, value, updated_at)
	VALUES ('global_announcement', payload::text, now_utc)
	ON CONFLICT (key)
	DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at;

	RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.publish_global_announcement_v2(TEXT, TEXT, TEXT) TO authenticated;

-- Backwards compatible wrapper (no winners)
CREATE OR REPLACE FUNCTION public.publish_global_announcement(
	p_new_features TEXT,
	p_upcoming_features TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
	RETURN public.publish_global_announcement_v2(p_new_features, p_upcoming_features, '');
END;
$$;

GRANT EXECUTE ON FUNCTION public.publish_global_announcement(TEXT, TEXT) TO authenticated;


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

	-- (Re)start countdown
	INSERT INTO public.app_settings (key, value, updated_at)
	VALUES ('mystery_countdown_start', now_utc::text, now_utc)
	ON CONFLICT (key)
	DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at;

	INSERT INTO public.app_settings (key, value, updated_at)
	VALUES ('mystery_countdown_duration_days', duration_int::text, now_utc)
	ON CONFLICT (key)
	DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at;

	-- Announcement is only valid until the next countdown starts.
	DELETE FROM public.app_settings WHERE key = 'global_announcement';

	RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.start_mystery_countdown(INTEGER) TO authenticated;
