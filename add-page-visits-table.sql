-- ============================================
-- Page Visits / Simple Traffic Counter
-- Run this in Supabase SQL Editor
-- ============================================

-- Tracks anonymous page hits (best-effort analytics).
-- NOTE: This project currently uses an anon key in the frontend.
-- Any public write policy or RPC callable by anon users is not tamper-proof.

CREATE TABLE IF NOT EXISTS page_visits (
  page_name TEXT PRIMARY KEY,
  visit_count BIGINT NOT NULL DEFAULT 0,
  last_updated TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_page_visits_count ON page_visits(visit_count DESC);

ALTER TABLE page_visits ENABLE ROW LEVEL SECURITY;

-- Drop & recreate policies (idempotent)
DROP POLICY IF EXISTS "Allow public read on page_visits" ON page_visits;
DROP POLICY IF EXISTS "Allow public insert on page_visits" ON page_visits;
DROP POLICY IF EXISTS "Allow public update on page_visits" ON page_visits;

CREATE POLICY "Allow public read on page_visits"
ON page_visits FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Allow public insert on page_visits"
ON page_visits FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Allow public update on page_visits"
ON page_visits FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- Safer/atomic increment helper (prevents read-modify-write races)
-- Called from the frontend via: supabaseClient.rpc('increment_page_visit', { p_page_name: 'homepage' })

CREATE OR REPLACE FUNCTION increment_page_visit(p_page_name TEXT)
RETURNS page_visits
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO page_visits(page_name, visit_count, last_updated)
  VALUES (p_page_name, 1, NOW())
  ON CONFLICT (page_name)
  DO UPDATE SET
    visit_count = page_visits.visit_count + 1,
    last_updated = NOW()
  RETURNING *;
$$;

GRANT EXECUTE ON FUNCTION increment_page_visit(TEXT) TO anon, authenticated;
