-- Fix teacher_reviews table structure
-- Run this in Supabase SQL Editor

-- First, check what columns actually exist
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'teacher_reviews'
ORDER BY ordinal_position;

-- If course_difficulty doesn't exist, add it
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'teacher_reviews' AND column_name = 'course_difficulty'
    ) THEN
        ALTER TABLE teacher_reviews 
        ADD COLUMN course_difficulty INTEGER CHECK (course_difficulty >= 1 AND course_difficulty <= 10);
        
        RAISE NOTICE 'Added course_difficulty column';
    END IF;
END $$;

-- Make course_code nullable (if not already)
ALTER TABLE teacher_reviews 
ALTER COLUMN course_code DROP NOT NULL;

-- Make review_text nullable (if not already)
ALTER TABLE teacher_reviews 
ALTER COLUMN review_text DROP NOT NULL;

-- Add is_anonymous column if missing
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'teacher_reviews' AND column_name = 'is_anonymous'
    ) THEN
        ALTER TABLE teacher_reviews 
        ADD COLUMN is_anonymous BOOLEAN NOT NULL DEFAULT FALSE;
        RAISE NOTICE 'Added is_anonymous column';
    END IF;
END $$;

-- Verify all columns exist with correct properties
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'teacher_reviews'
ORDER BY ordinal_position;
