-- ============================================
-- TEACHER REVIEW SYSTEM - COMPLETE DATABASE SCHEMA
-- Run this in Supabase SQL Editor
-- ============================================

-- ============================================
-- 1. COURSES TABLE
-- Stores all UIU courses
-- ============================================
CREATE TABLE IF NOT EXISTS courses (
    code TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    department TEXT NOT NULL,
    credits INTEGER DEFAULT 3,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_courses_department ON courses(department);

-- ============================================
-- 2. TEACHERS TABLE
-- Stores all UIU teachers/faculty
-- ============================================
CREATE TABLE IF NOT EXISTS teachers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    department TEXT NOT NULL,
    
    -- Auto-calculated statistics (updated by triggers)
    total_reviews INTEGER DEFAULT 0,
    average_rating DECIMAL(3,2) DEFAULT 0,
    avg_teaching_quality DECIMAL(4,2) DEFAULT 0,
    avg_grading_fairness DECIMAL(4,2) DEFAULT 0,
    avg_approachability DECIMAL(4,2) DEFAULT 0,
    avg_punctuality DECIMAL(4,2) DEFAULT 0,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(name, department)
);

CREATE INDEX IF NOT EXISTS idx_teachers_department ON teachers(department);
CREATE INDEX IF NOT EXISTS idx_teachers_name ON teachers(name);

-- ============================================
-- 3. COURSE_TEACHERS JUNCTION TABLE
-- Links teachers to courses they teach
-- ============================================
CREATE TABLE IF NOT EXISTS course_teachers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    course_code TEXT NOT NULL REFERENCES courses(code) ON DELETE CASCADE,
    teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(course_code, teacher_id)
);

CREATE INDEX IF NOT EXISTS idx_course_teachers_course ON course_teachers(course_code);
CREATE INDEX IF NOT EXISTS idx_course_teachers_teacher ON course_teachers(teacher_id);

-- ============================================
-- 4. TEACHER_REVIEWS TABLE
-- Student reviews of teachers
-- ============================================
CREATE TABLE IF NOT EXISTS teacher_reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
    course_code TEXT REFERENCES courses(code) ON DELETE CASCADE,
    
    -- Ratings (1-5 stars for overall, 1-10 for categories)
    overall_rating INTEGER NOT NULL CHECK (overall_rating >= 1 AND overall_rating <= 5),
    teaching_quality INTEGER NOT NULL CHECK (teaching_quality >= 1 AND teaching_quality <= 10),
    grading_fairness INTEGER NOT NULL CHECK (grading_fairness >= 1 AND grading_fairness <= 10),
    approachability INTEGER NOT NULL CHECK (approachability >= 1 AND approachability <= 10),
    punctuality INTEGER NOT NULL CHECK (punctuality >= 1 AND punctuality <= 10),
    
    -- Written review (optional)
    review_text TEXT,

    -- Privacy
    is_anonymous BOOLEAN NOT NULL DEFAULT FALSE,
    
    -- Vote counts
    helpful_count INTEGER DEFAULT 0,
    not_helpful_count INTEGER DEFAULT 0,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reviews_teacher ON teacher_reviews(teacher_id);
CREATE INDEX IF NOT EXISTS idx_reviews_course ON teacher_reviews(course_code);
CREATE INDEX IF NOT EXISTS idx_reviews_created ON teacher_reviews(created_at DESC);

-- ============================================
-- 5. REVIEW_VOTES TABLE
-- Track who voted on reviews (prevent duplicate votes)
-- ============================================
CREATE TABLE IF NOT EXISTS review_votes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    review_id UUID NOT NULL REFERENCES teacher_reviews(id) ON DELETE CASCADE,
    voter_ip TEXT NOT NULL,
    vote_type TEXT NOT NULL CHECK (vote_type IN ('helpful', 'not_helpful')),
    created_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(review_id, voter_ip)
);

CREATE INDEX IF NOT EXISTS idx_votes_review ON review_votes(review_id);

-- ============================================
-- TRIGGERS TO AUTO-UPDATE TEACHER STATISTICS
-- ============================================

-- Function to update teacher statistics
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
        average_rating = (
            SELECT COALESCE(AVG(overall_rating), 0)
            FROM teacher_reviews 
            WHERE teacher_id = COALESCE(NEW.teacher_id, OLD.teacher_id)
        ),
        avg_teaching_quality = (
            SELECT COALESCE(AVG(teaching_quality), 0)
            FROM teacher_reviews 
            WHERE teacher_id = COALESCE(NEW.teacher_id, OLD.teacher_id)
        ),
        avg_grading_fairness = (
            SELECT COALESCE(AVG(grading_fairness), 0)
            FROM teacher_reviews 
            WHERE teacher_id = COALESCE(NEW.teacher_id, OLD.teacher_id)
        ),
        avg_approachability = (
            SELECT COALESCE(AVG(approachability), 0)
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

-- Trigger on INSERT
DROP TRIGGER IF EXISTS trigger_update_teacher_stats_insert ON teacher_reviews;
CREATE TRIGGER trigger_update_teacher_stats_insert
AFTER INSERT ON teacher_reviews
FOR EACH ROW
EXECUTE FUNCTION update_teacher_stats();

-- Trigger on UPDATE
DROP TRIGGER IF EXISTS trigger_update_teacher_stats_update ON teacher_reviews;
CREATE TRIGGER trigger_update_teacher_stats_update
AFTER UPDATE ON teacher_reviews
FOR EACH ROW
EXECUTE FUNCTION update_teacher_stats();

-- Trigger on DELETE
DROP TRIGGER IF EXISTS trigger_update_teacher_stats_delete ON teacher_reviews;
CREATE TRIGGER trigger_update_teacher_stats_delete
AFTER DELETE ON teacher_reviews
FOR EACH ROW
EXECUTE FUNCTION update_teacher_stats();

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

-- Enable RLS on all tables
ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_votes ENABLE ROW LEVEL SECURITY;

-- Teachers: Allow public read access
DROP POLICY IF EXISTS "Allow public read access to teachers" ON teachers;
CREATE POLICY "Allow public read access to teachers"
ON teachers FOR SELECT
TO public
USING (true);

-- Courses: Allow public read access
DROP POLICY IF EXISTS "Allow public read access to courses" ON courses;
CREATE POLICY "Allow public read access to courses"
ON courses FOR SELECT
TO public
USING (true);

-- Course Teachers: Allow public read access
DROP POLICY IF EXISTS "Allow public read access to course_teachers" ON course_teachers;
CREATE POLICY "Allow public read access to course_teachers"
ON course_teachers FOR SELECT
TO public
USING (true);

-- Teacher Reviews: Allow public read access
DROP POLICY IF EXISTS "Allow public read access to teacher_reviews" ON teacher_reviews;
CREATE POLICY "Allow public read access to teacher_reviews"
ON teacher_reviews FOR SELECT
TO public
USING (true);

-- Teacher Reviews: Allow public insert (anonymous reviews)
DROP POLICY IF EXISTS "Allow public insert to teacher_reviews" ON teacher_reviews;
CREATE POLICY "Allow public insert to teacher_reviews"
ON teacher_reviews FOR INSERT
TO public
WITH CHECK (true);

-- Teacher Reviews: Allow public update (for vote counts)
DROP POLICY IF EXISTS "Allow public update to teacher_reviews" ON teacher_reviews;
CREATE POLICY "Allow public update to teacher_reviews"
ON teacher_reviews FOR UPDATE
TO public
USING (true)
WITH CHECK (true);

-- Review Votes: Allow public access
DROP POLICY IF EXISTS "Allow public access to review_votes" ON review_votes;
CREATE POLICY "Allow public access to review_votes"
ON review_votes FOR ALL
TO public
USING (true)
WITH CHECK (true);

-- ============================================
-- SAMPLE DATA (Optional - for testing)
-- ============================================

-- You can uncomment these to add sample data for testing:

/*
-- Sample Courses
INSERT INTO courses (code, name, department, credits) VALUES
('CSE 1111', 'Structured Programming Language', 'BSCSE', 3),
('CSE 2215', 'Data Structures', 'BSCSE', 3),
('CSE 3411', 'Database Management Systems', 'BSCSE', 3)
ON CONFLICT (code) DO NOTHING;

-- Sample Teachers
INSERT INTO teachers (name, department) VALUES
('Dr. John Smith', 'BSCSE'),
('Prof. Sarah Johnson', 'BSCSE'),
('Dr. Ahmed Khan', 'BSCSE')
ON CONFLICT (name, department) DO NOTHING;

-- Sample Course-Teacher Links
INSERT INTO course_teachers (course_code, teacher_id)
SELECT 'CSE 1111', id FROM teachers WHERE name = 'Dr. John Smith' LIMIT 1
ON CONFLICT DO NOTHING;
*/

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Check if tables were created
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('teachers', 'courses', 'course_teachers', 'teacher_reviews', 'review_votes')
ORDER BY table_name;

-- Check RLS policies
SELECT tablename, policyname, permissive, roles, cmd 
FROM pg_policies 
WHERE schemaname = 'public'
AND tablename IN ('teachers', 'courses', 'course_teachers', 'teacher_reviews', 'review_votes')
ORDER BY tablename, policyname;

-- Show table counts
SELECT 
    (SELECT COUNT(*) FROM courses) as courses_count,
    (SELECT COUNT(*) FROM teachers) as teachers_count,
    (SELECT COUNT(*) FROM course_teachers) as course_teachers_count,
    (SELECT COUNT(*) FROM teacher_reviews) as reviews_count;
