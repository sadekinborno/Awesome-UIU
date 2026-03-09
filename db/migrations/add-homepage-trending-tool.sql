-- ============================================
-- Homepage "Trending Now" badge admin control
--
-- Allows admins to select one homepage tool card to show
-- the Trending Now badge, or clear it entirely.
-- ============================================

CREATE OR REPLACE FUNCTION public.set_homepage_trending_tool(
	p_tool_key TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
	now_utc TIMESTAMPTZ := (NOW() AT TIME ZONE 'utc');
	tool_key TEXT := lower(trim(coalesce(p_tool_key, '')));
BEGIN
	IF NOT public.is_admin() THEN
		RAISE EXCEPTION 'admin_only';
	END IF;

	IF tool_key = '' OR tool_key = 'none' THEN
		DELETE FROM public.app_settings WHERE key = 'homepage_trending_tool';
		RETURN TRUE;
	END IF;

	IF tool_key NOT IN (
		'teacher-reviews',
		'goal-planner',
		'cgpa-calculator',
		'academic-calendar',
		'scholarship-checker'
	) THEN
		RAISE EXCEPTION 'invalid_tool_key';
	END IF;

	INSERT INTO public.app_settings (key, value, updated_at)
	VALUES ('homepage_trending_tool', tool_key, now_utc)
	ON CONFLICT (key)
	DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at;

	RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_homepage_trending_tool(TEXT) TO authenticated;
