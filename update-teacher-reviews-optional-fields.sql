-- Make course_code and review_text optional in teacher_reviews table
-- Run this in your Supabase SQL Editor

-- Make course_code nullable
ALTER TABLE teacher_reviews 
ALTER COLUMN course_code DROP NOT NULL;

-- Make review_text nullable
ALTER TABLE teacher_reviews 
ALTER COLUMN review_text DROP NOT NULL;

-- Verify the changes
SELECT column_name, is_nullable, data_type 
FROM information_schema.columns 
WHERE table_name = 'teacher_reviews' 
AND column_name IN ('course_code', 'review_text');
