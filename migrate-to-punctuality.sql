-- Migration: Replace course_difficulty with punctuality
-- Run this in Supabase SQL Editor

-- 1. Drop trimester column (not needed)
ALTER TABLE teacher_reviews 
DROP COLUMN IF EXISTS trimester;

-- 2. Add new punctuality column to teacher_reviews
ALTER TABLE teacher_reviews 
ADD COLUMN IF NOT EXISTS punctuality INTEGER CHECK (punctuality >= 1 AND punctuality <= 10);

-- 3. Drop old course_difficulty column (if it exists)
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'teacher_reviews' AND column_name = 'course_difficulty'
    ) THEN
        -- Copy data from course_difficulty to punctuality before dropping
        EXECUTE 'UPDATE teacher_reviews SET punctuality = course_difficulty WHERE course_difficulty IS NOT NULL AND punctuality IS NULL';
        -- Drop the old column
        ALTER TABLE teacher_reviews DROP COLUMN course_difficulty;
    END IF;
END $$;

-- 4. Add punctuality column to teachers table
ALTER TABLE teachers 
ADD COLUMN IF NOT EXISTS avg_punctuality DECIMAL(4,2) DEFAULT 0;

-- 5. Drop old avg_course_difficulty column (if it exists)
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'teachers' AND column_name = 'avg_course_difficulty'
    ) THEN
        ALTER TABLE teachers DROP COLUMN avg_course_difficulty;
    END IF;
END $$;

-- 6. Make course_code and review_text nullable (optional fields)
DO $$ 
BEGIN
    -- Make course_code nullable
    BEGIN
        ALTER TABLE teacher_reviews ALTER COLUMN course_code DROP NOT NULL;
    EXCEPTION 
        WHEN others THEN NULL; -- Ignore if already nullable
    END;
    
    -- Make review_text nullable
    BEGIN
        ALTER TABLE teacher_reviews ALTER COLUMN review_text DROP NOT NULL;
    EXCEPTION 
        WHEN others THEN NULL; -- Ignore if already nullable
    END;
END $$;

-- 7. Recreate the trigger function with correct column names
-- Matches actual database schema: overall_rating, teaching_quality_avg, fair_grading_avg, etc.
CREATE OR REPLACE FUNCTION update_teacher_stats()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE teachers
    SET 
        total_reviews = (
            SELECT COUNT(*) 
            FROM teacher_reviews 
            WHERE teacher_id = COALESCE(NEW.teacher_id, OLD.teacher_id)
        ),
        overall_rating = (
            SELECT COALESCE(AVG(overall_rating), 0)
            FROM teacher_reviews 
            WHERE teacher_id = COALESCE(NEW.teacher_id, OLD.teacher_id)
        ),
        teaching_quality_avg = (
            SELECT COALESCE(AVG(teaching_quality), 0)
            FROM teacher_reviews 
            WHERE teacher_id = COALESCE(NEW.teacher_id, OLD.teacher_id)
        ),
        fair_grading_avg = (
            SELECT COALESCE(AVG(fair_grading), 0)
            FROM teacher_reviews 
            WHERE teacher_id = COALESCE(NEW.teacher_id, OLD.teacher_id)
        ),
        approachability_avg = (
            SELECT COALESCE(AVG(approachability), 0)
            FROM teacher_reviews 
            WHERE teacher_id = COALESCE(NEW.teacher_id, OLD.teacher_id)
        ),
        punctuality_avg = (
            SELECT COALESCE(AVG(punctuality), 0)
            FROM teacher_reviews 
            WHERE teacher_id = COALESCE(NEW.teacher_id, OLD.teacher_id)
        ),
        avg_punctuality = (
            SELECT COALESCE(AVG(punctuality), 0)
            FROM teacher_reviews 
            WHERE teacher_id = COALESCE(NEW.teacher_id, OLD.teacher_id)
        ),
        updated_at = NOW()
    WHERE id = COALESCE(NEW.teacher_id, OLD.teacher_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- 8. Verify the changes
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'teacher_reviews'
AND column_name IN ('punctuality', 'course_code', 'review_text')
ORDER BY column_name;

SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'teachers'
AND column_name = 'avg_punctuality';

-- Success message
DO $$ 
BEGIN 
    RAISE NOTICE '✅ Migration completed: course_difficulty replaced with punctuality';
    RAISE NOTICE '✅ course_code and review_text are now optional';
END $$;
