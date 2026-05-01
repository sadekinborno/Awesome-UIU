-- ============================================
-- Tool Daily Visits (Analytics)
-- Run this in Supabase SQL Editor
-- ============================================

CREATE TABLE IF NOT EXISTS tool_daily_visits (
  visit_date DATE NOT NULL DEFAULT CURRENT_DATE,
  tool_name TEXT NOT NULL,
  visit_count INTEGER NOT NULL DEFAULT 0,
  action_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (visit_date, tool_name)
);

-- In case the table already exists, add the action_count column
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tool_daily_visits' AND column_name='action_count') THEN 
    ALTER TABLE tool_daily_visits ADD COLUMN action_count INTEGER NOT NULL DEFAULT 0; 
  END IF; 
END $$;

ALTER TABLE tool_daily_visits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read on tool_daily_visits" ON tool_daily_visits;
CREATE POLICY "Allow public read on tool_daily_visits"
ON tool_daily_visits FOR SELECT TO anon, authenticated USING (true);

-- No public insert/update policy needed if we use SECURITY DEFINER function

CREATE OR REPLACE FUNCTION increment_tool_visit(p_tool_name TEXT, p_is_action BOOLEAN DEFAULT false)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_is_action THEN
    INSERT INTO tool_daily_visits (visit_date, tool_name, visit_count, action_count)
    VALUES (CURRENT_DATE, p_tool_name, 0, 1)
    ON CONFLICT (visit_date, tool_name)
    DO UPDATE SET action_count = tool_daily_visits.action_count + 1;
  ELSE
    INSERT INTO tool_daily_visits (visit_date, tool_name, visit_count, action_count)
    VALUES (CURRENT_DATE, p_tool_name, 1, 0)
    ON CONFLICT (visit_date, tool_name)
    DO UPDATE SET visit_count = tool_daily_visits.visit_count + 1;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION increment_tool_visit(TEXT) TO anon, authenticated;
