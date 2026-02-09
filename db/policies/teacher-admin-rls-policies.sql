-- ============================================
-- Teacher Reviews: Admin Write Policies (OPTIONAL)
-- Run this in Supabase SQL Editor
-- ============================================

-- SECURITY NOTE
-- This script assumes you have run admin-auth-setup.sql (creates public.admin_roles + public.is_admin()).
-- Write actions are restricted to authenticated admins only.

-- Teachers
ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow admin insert to teachers" ON teachers;
DROP POLICY IF EXISTS "Allow admin update to teachers" ON teachers;
DROP POLICY IF EXISTS "Allow admin delete to teachers" ON teachers;

CREATE POLICY "Allow admin insert to teachers"
ON teachers FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

CREATE POLICY "Allow admin update to teachers"
ON teachers FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "Allow admin delete to teachers"
ON teachers FOR DELETE
TO authenticated
USING (public.is_admin());

-- Courses
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow admin insert to courses" ON courses;
DROP POLICY IF EXISTS "Allow admin update to courses" ON courses;
DROP POLICY IF EXISTS "Allow admin delete to courses" ON courses;

CREATE POLICY "Allow admin insert to courses"
ON courses FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

CREATE POLICY "Allow admin update to courses"
ON courses FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "Allow admin delete to courses"
ON courses FOR DELETE
TO authenticated
USING (public.is_admin());

-- Course-Teacher Links
ALTER TABLE course_teachers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow admin insert to course_teachers" ON course_teachers;
DROP POLICY IF EXISTS "Allow admin delete to course_teachers" ON course_teachers;

CREATE POLICY "Allow admin insert to course_teachers"
ON course_teachers FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

CREATE POLICY "Allow admin delete to course_teachers"
ON course_teachers FOR DELETE
TO authenticated
USING (public.is_admin());

-- Reviews (moderation)
ALTER TABLE teacher_reviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow admin delete to teacher_reviews" ON teacher_reviews;

CREATE POLICY "Allow admin delete to teacher_reviews"
ON teacher_reviews FOR DELETE
TO authenticated
USING (public.is_admin());
