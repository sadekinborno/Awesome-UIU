-- ============================================
-- Fix RLS Policies for Scholarship Checker
-- Run this in Supabase SQL Editor
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Public read access to department stats" ON department_stats;
DROP POLICY IF EXISTS "Public read access to submissions" ON scholarship_submissions;
DROP POLICY IF EXISTS "Users can insert submissions" ON scholarship_submissions;
DROP POLICY IF EXISTS "Users can update own submissions" ON scholarship_submissions;
DROP POLICY IF EXISTS "Users can delete own submissions" ON scholarship_submissions;

-- ============================================
-- DEPARTMENT STATS POLICIES
-- ============================================

-- Allow public read access
CREATE POLICY "Allow public read on department_stats"
ON department_stats FOR SELECT
TO anon, authenticated
USING (true);

-- Allow triggers to insert/update (bypass RLS for service role)
CREATE POLICY "Allow service role full access to department_stats"
ON department_stats FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Allow anon users to insert/update via triggers
CREATE POLICY "Allow anon insert on department_stats"
ON department_stats FOR INSERT
TO anon
WITH CHECK (true);

CREATE POLICY "Allow anon update on department_stats"
ON department_stats FOR UPDATE
TO anon
USING (true)
WITH CHECK (true);

-- ============================================
-- SCHOLARSHIP SUBMISSIONS POLICIES
-- ============================================

-- Allow public read (for calculating ranks)
CREATE POLICY "Allow public read on submissions"
ON scholarship_submissions FOR SELECT
TO anon, authenticated
USING (true);

-- Allow anyone to insert submissions
CREATE POLICY "Allow public insert on submissions"
ON scholarship_submissions FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Allow anyone to update submissions (for upsert)
CREATE POLICY "Allow public update on submissions"
ON scholarship_submissions FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- Allow anyone to delete submissions (optional, for cleanup)
CREATE POLICY "Allow public delete on submissions"
ON scholarship_submissions FOR DELETE
TO anon, authenticated
USING (true);

-- ============================================
-- VERIFICATION COMPLETE
-- ============================================

-- Test: Try inserting a test submission
-- INSERT INTO scholarship_submissions 
-- (user_id, student_id, email, department, trimester, last_trimester_gpa, overall_cgpa)
-- VALUES 
-- ((SELECT id FROM users LIMIT 1), 
--  '011-223-042', 'test@bscse.uiu.ac.bd', 'CSE', 'Fall 2024', 3.85, 3.72);

-- Check if department_stats was updated automatically
-- SELECT * FROM department_stats WHERE department = 'CSE' AND trimester = 'Fall 2024';
