-- ============================================
-- User Visits / Activity Tracking
-- Run this in Supabase SQL Editor
-- ============================================

-- Tracks per-user visit counts and last seen time.
-- NOTE: This project uses client-side sessions (no Supabase Auth).
-- With anon key + permissive RLS, this data is best-effort analytics, not tamper-proof.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS user_visits (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  visit_count INTEGER NOT NULL DEFAULT 0,
  first_visited_at TIMESTAMPTZ DEFAULT NOW(),
  last_visited_at TIMESTAMPTZ DEFAULT NOW(),
  last_page TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- If the table already existed with TIMESTAMP (no timezone), migrate safely.
-- We assume previously stored values represent UTC.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'user_visits'
      AND column_name = 'last_visited_at'
      AND data_type = 'timestamp without time zone'
  ) THEN
    ALTER TABLE user_visits
      ALTER COLUMN first_visited_at TYPE TIMESTAMPTZ USING first_visited_at AT TIME ZONE 'UTC',
      ALTER COLUMN last_visited_at TYPE TIMESTAMPTZ USING last_visited_at AT TIME ZONE 'UTC',
      ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_user_visits_last_visited ON user_visits(last_visited_at DESC);

ALTER TABLE user_visits ENABLE ROW LEVEL SECURITY;

-- Drop & recreate policies (idempotent)
DROP POLICY IF EXISTS "Allow public read on user_visits" ON user_visits;
DROP POLICY IF EXISTS "Allow public insert on user_visits" ON user_visits;
DROP POLICY IF EXISTS "Allow public update on user_visits" ON user_visits;
DROP POLICY IF EXISTS "Allow public delete on user_visits" ON user_visits;

-- Public read for dashboards
CREATE POLICY "Allow public read on user_visits"
ON user_visits FOR SELECT
TO anon, authenticated
USING (true);

-- Allow the site to create an entry for the current user
CREATE POLICY "Allow public insert on user_visits"
ON user_visits FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Allow the site to update visit_count / last_visited_at
CREATE POLICY "Allow public update on user_visits"
ON user_visits FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- Optional cleanup
CREATE POLICY "Allow public delete on user_visits"
ON user_visits FOR DELETE
TO anon, authenticated
USING (true);
