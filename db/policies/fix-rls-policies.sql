-- ============================================
-- Fix RLS Policies for Scholarship Checker
-- Run this in Supabase SQL Editor
-- ============================================

-- Ensure RLS is enabled on required tables
ALTER TABLE IF EXISTS users ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS email_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS scholarship_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS department_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS flagged_submissions ENABLE ROW LEVEL SECURITY;

-- Ensure anon role has the required table privileges for client-side flows.
-- RLS still applies after these GRANTs.
GRANT USAGE ON SCHEMA public TO anon;
GRANT SELECT, INSERT, UPDATE ON public.users TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_verifications TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rate_limits TO anon;

-- Drop ALL existing policies on critical OTP tables.
-- This avoids situations where a leftover RESTRICTIVE policy keeps blocking inserts.
DO $$
DECLARE
	pol RECORD;
BEGIN
	FOR pol IN (
		SELECT policyname, tablename
		FROM pg_policies
		WHERE schemaname = 'public'
			AND tablename IN ('users', 'email_verifications', 'rate_limits')
	) LOOP
		EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', pol.policyname, pol.tablename);
	END LOOP;
END $$;

-- Drop existing policies
DROP POLICY IF EXISTS "Public read access to department stats" ON department_stats;
DROP POLICY IF EXISTS "Allow public read on department_stats" ON department_stats;
DROP POLICY IF EXISTS "Allow service role full access to department_stats" ON department_stats;
DROP POLICY IF EXISTS "Allow anon insert on department_stats" ON department_stats;
DROP POLICY IF EXISTS "Allow anon update on department_stats" ON department_stats;

DROP POLICY IF EXISTS "Public read access to submissions" ON scholarship_submissions;
DROP POLICY IF EXISTS "Users can insert submissions" ON scholarship_submissions;
DROP POLICY IF EXISTS "Users can update own submissions" ON scholarship_submissions;
DROP POLICY IF EXISTS "Users can delete own submissions" ON scholarship_submissions;

DROP POLICY IF EXISTS "Allow public read on submissions" ON scholarship_submissions;
DROP POLICY IF EXISTS "Allow public insert on submissions" ON scholarship_submissions;
DROP POLICY IF EXISTS "Allow public update on submissions" ON scholarship_submissions;
DROP POLICY IF EXISTS "Allow public delete on submissions" ON scholarship_submissions;
DROP POLICY IF EXISTS "Allow admin delete on submissions" ON scholarship_submissions;

DROP POLICY IF EXISTS "Allow public read on flagged_submissions" ON flagged_submissions;
DROP POLICY IF EXISTS "Allow public insert on flagged_submissions" ON flagged_submissions;
DROP POLICY IF EXISTS "Allow public update on flagged_submissions" ON flagged_submissions;
DROP POLICY IF EXISTS "Allow public delete on flagged_submissions" ON flagged_submissions;
DROP POLICY IF EXISTS "Allow admin update on flagged_submissions" ON flagged_submissions;
DROP POLICY IF EXISTS "Allow admin delete on flagged_submissions" ON flagged_submissions;

-- Users table policies
-- database-schema.sql ships a legacy policy "Public access to users" (FOR ALL TO anon).
-- For security (and to support the new Supabase Auth admin panel), we replace it with:
-- - anon: select/insert/update only (OTP-based site flows)
-- - authenticated admin: select/update/delete (admin panel)
DROP POLICY IF EXISTS "Public access to users" ON users;
DROP POLICY IF EXISTS "Allow public read on users" ON users;
DROP POLICY IF EXISTS "Allow public insert on users" ON users;
DROP POLICY IF EXISTS "Allow public update on users" ON users;
DROP POLICY IF EXISTS "Allow admin read on users" ON users;
DROP POLICY IF EXISTS "Allow admin update on users" ON users;
DROP POLICY IF EXISTS "Allow admin delete on users" ON users;

-- OTP flow and client-side throttling also require these tables.
-- If they have RLS enabled but no anon policies, the site will fail with 403.
DROP POLICY IF EXISTS "Public access to verifications" ON email_verifications;
DROP POLICY IF EXISTS "Allow public access to verifications" ON email_verifications;
DROP POLICY IF EXISTS "Allow public insert for OTP" ON email_verifications;
DROP POLICY IF EXISTS "Allow public select for OTP" ON email_verifications;
DROP POLICY IF EXISTS "Allow public update for OTP" ON email_verifications;
DROP POLICY IF EXISTS "Allow public delete for OTP" ON email_verifications;
DROP POLICY IF EXISTS "Public access to rate limits" ON rate_limits;
DROP POLICY IF EXISTS "Allow public access to rate_limits" ON rate_limits;

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

-- Allow only admins to delete submissions (admin cleanup)
-- Requires admin-auth-setup.sql (public.is_admin())
CREATE POLICY "Allow admin delete on submissions"
ON scholarship_submissions FOR DELETE
TO authenticated
USING (public.is_admin());

-- ============================================
-- USERS POLICIES
-- ============================================

-- Public (anon) access needed by OTP-based flows (review-auth.js / scholarship-auth.js)
CREATE POLICY "Allow public read on users"
ON users FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Allow public insert on users"
ON users FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Allow public update on users"
ON users FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- ============================================
-- EMAIL VERIFICATIONS POLICIES (OTP)
-- ============================================

-- NOTE: This keeps the OTP flow client-side. For stronger security, move OTP verification into an Edge Function
-- and lock this table down.
CREATE POLICY "Allow public access to verifications"
ON email_verifications FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- ============================================
-- RATE LIMITS POLICIES
-- ============================================

-- NOTE: This is best-effort client-side rate limiting.
CREATE POLICY "Allow public access to rate_limits"
ON rate_limits FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- Admin panel access (Supabase Auth + admin_roles)
-- Requires admin-auth-setup.sql (public.is_admin())
CREATE POLICY "Allow admin read on users"
ON users FOR SELECT
TO authenticated
USING (public.is_admin());

CREATE POLICY "Allow admin update on users"
ON users FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "Allow admin delete on users"
ON users FOR DELETE
TO authenticated
USING (public.is_admin());

-- ============================================
-- FLAGGED SUBMISSIONS POLICIES
-- ============================================

-- Admin panel uses Supabase Auth + admin_roles.
-- Read is public (so the site can display/submit flags if needed), but moderation (update/delete)
-- is restricted to authenticated admins via public.is_admin().

CREATE POLICY "Allow public read on flagged_submissions"
ON flagged_submissions FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Allow public insert on flagged_submissions"
ON flagged_submissions FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Admin-only update/delete for moderation
-- Requires admin-auth-setup.sql (public.is_admin())
CREATE POLICY "Allow admin update on flagged_submissions"
ON flagged_submissions FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "Allow admin delete on flagged_submissions"
ON flagged_submissions FOR DELETE
TO authenticated
USING (public.is_admin());

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
