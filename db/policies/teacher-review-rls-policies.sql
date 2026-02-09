-- ============================================
-- RLS POLICIES FOR TEACHER REVIEW SYSTEM
-- ============================================
-- Run this in Supabase SQL Editor to enable public read access

-- Enable RLS on all tables (if not already enabled)
ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_votes ENABLE ROW LEVEL SECURITY;

-- ============================================
-- PUBLIC READ ACCESS POLICIES
-- ============================================

-- Teachers: Allow anyone to read
DROP POLICY IF EXISTS "Allow public read access to teachers" ON teachers;
CREATE POLICY "Allow public read access to teachers"
ON teachers FOR SELECT
TO public
USING (true);

-- Courses: Allow anyone to read
DROP POLICY IF EXISTS "Allow public read access to courses" ON courses;
CREATE POLICY "Allow public read access to courses"
ON courses FOR SELECT
TO public
USING (true);

-- Course Teachers: Allow anyone to read
DROP POLICY IF EXISTS "Allow public read access to course_teachers" ON course_teachers;
CREATE POLICY "Allow public read access to course_teachers"
ON course_teachers FOR SELECT
TO public
USING (true);

-- Teacher Reviews: Allow anyone to read
DROP POLICY IF EXISTS "Allow public read access to teacher_reviews" ON teacher_reviews;
CREATE POLICY "Allow public read access to teacher_reviews"
ON teacher_reviews FOR SELECT
TO public
USING (true);

-- Teacher Reviews: Allow anyone to insert (anonymous reviews)
DROP POLICY IF EXISTS "Allow public insert to teacher_reviews" ON teacher_reviews;
CREATE POLICY "Allow public insert to teacher_reviews"
ON teacher_reviews FOR INSERT
TO public
WITH CHECK (true);

-- Teacher Reviews: Allow anyone to update vote counts
DROP POLICY IF EXISTS "Allow public update to teacher_reviews" ON teacher_reviews;
CREATE POLICY "Allow public update to teacher_reviews"
ON teacher_reviews FOR UPDATE
TO public
USING (true)
WITH CHECK (true);

-- Review Votes: Allow anyone to read
DROP POLICY IF EXISTS "Allow public read access to review_votes" ON review_votes;
CREATE POLICY "Allow public read access to review_votes"
ON review_votes FOR SELECT
TO public
USING (true);

-- Review Votes: Allow anyone to insert
DROP POLICY IF EXISTS "Allow public insert to review_votes" ON review_votes;
CREATE POLICY "Allow public insert to review_votes"
ON review_votes FOR INSERT
TO public
WITH CHECK (true);

-- ============================================
-- VERIFICATION
-- ============================================
-- Run these queries to verify policies are active:

-- Check teachers policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'teachers';

-- Check courses policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'courses';

-- Check teacher_reviews policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'teacher_reviews';
