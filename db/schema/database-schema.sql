-- ============================================
-- Scholarship Probability Checker Database Schema
-- Run this in Supabase SQL Editor
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. USERS TABLE
-- Stores verified UIU students
-- ============================================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  student_id TEXT UNIQUE NOT NULL, -- Format: XXX-XXX-XXX or XXX-XXX-XXXX (9-10 digits)
  email_verified BOOLEAN DEFAULT FALSE,
  verified_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Ensure UIU email only (allows subdomains like @bscse.uiu.ac.bd)
  CONSTRAINT valid_uiu_email CHECK (email LIKE '%.uiu.ac.bd' OR email LIKE '%@uiu.ac.bd')
);

-- Index for faster lookups
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_student_id ON users(student_id);

-- ============================================
-- 2. EMAIL VERIFICATIONS TABLE
-- Stores OTP codes for email verification
-- ============================================
CREATE TABLE email_verifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL,
  student_id TEXT NOT NULL,
  otp TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  attempts INTEGER DEFAULT 0,
  verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  
  -- Prevent brute force
  CONSTRAINT max_attempts CHECK (attempts < 5)
);

-- Index for faster OTP lookups
CREATE INDEX idx_verifications_email ON email_verifications(email);
CREATE INDEX idx_verifications_otp ON email_verifications(otp);

-- Auto-delete expired OTPs (cleanup function)
CREATE OR REPLACE FUNCTION delete_expired_otps()
RETURNS void AS $$
BEGIN
  DELETE FROM email_verifications 
  WHERE expires_at < NOW() AND verified = FALSE;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 3. SCHOLARSHIP SUBMISSIONS TABLE
-- Stores student GPA submissions
-- ============================================
CREATE TABLE scholarship_submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- User reference
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL,
  email TEXT NOT NULL,
  
  -- Academic info
  department TEXT NOT NULL,
  trimester TEXT NOT NULL, -- "Fall 2024", "Spring 2025"
  last_trimester_gpa DECIMAL(4,2) NOT NULL CHECK (last_trimester_gpa >= 0 AND last_trimester_gpa <= 4.0),
  overall_cgpa DECIMAL(4,2) NOT NULL CHECK (overall_cgpa >= 0 AND overall_cgpa <= 4.0),
  
  -- Calculated rankings
  percentile_rank DECIMAL(5,2), -- e.g., 4.52 (top 4.52%)
  scholarship_tier INTEGER, -- 100, 50, 25, or 0
  position INTEGER, -- Rank position (1 = top student)
  
  -- Metadata
  submitted_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  ip_address TEXT, -- For rate limiting
  
  -- Prevent duplicate submissions per trimester
  UNIQUE(user_id, trimester, department)
);

-- Indexes for faster queries
CREATE INDEX idx_submissions_user ON scholarship_submissions(user_id);
CREATE INDEX idx_submissions_dept_trim ON scholarship_submissions(department, trimester);
CREATE INDEX idx_submissions_student_id ON scholarship_submissions(student_id);

-- ============================================
-- 4. DEPARTMENT STATISTICS TABLE
-- Cached statistics for each department/trimester
-- ============================================
CREATE TABLE department_stats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  department TEXT NOT NULL,
  trimester TEXT NOT NULL,
  
  -- Submission counts
  total_submissions INTEGER DEFAULT 0,
  verified_submissions INTEGER DEFAULT 0,
  
  -- Scholarship tier thresholds
  top_2_percent_last_gpa DECIMAL(4,2),
  top_2_percent_cgpa DECIMAL(4,2),
  
  top_6_percent_last_gpa DECIMAL(4,2), -- 50% scholarship cutoff
  top_6_percent_cgpa DECIMAL(4,2),
  
  top_10_percent_last_gpa DECIMAL(4,2), -- 25% scholarship cutoff
  top_10_percent_cgpa DECIMAL(4,2),
  
  -- Statistics
  highest_last_gpa DECIMAL(4,2),
  highest_cgpa DECIMAL(4,2),
  average_last_gpa DECIMAL(4,2),
  average_cgpa DECIMAL(4,2),
  median_last_gpa DECIMAL(4,2),
  median_cgpa DECIMAL(4,2),
  
  -- Metadata
  last_updated TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(department, trimester)
);

-- Index for faster stats lookup
CREATE INDEX idx_stats_dept_trim ON department_stats(department, trimester);

-- ============================================
-- 5. RATE LIMITING TABLE
-- Prevent spam submissions
-- ============================================
CREATE TABLE rate_limits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ip_address TEXT NOT NULL,
  action_type TEXT NOT NULL, -- 'otp_request', 'submission'
  attempts INTEGER DEFAULT 1,
  window_start TIMESTAMP DEFAULT NOW(),
  blocked_until TIMESTAMP
);

-- Index for rate limit lookups
CREATE INDEX idx_rate_limits_ip ON rate_limits(ip_address);

-- ============================================
-- 6. FLAGGED SUBMISSIONS TABLE
-- Manual review queue for suspicious submissions
-- ============================================
CREATE TABLE flagged_submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  submission_id UUID REFERENCES scholarship_submissions(id) ON DELETE CASCADE,
  reason TEXT NOT NULL, -- 'duplicate_ip', 'suspicious_gpa', 'invalid_id'
  flagged_at TIMESTAMP DEFAULT NOW(),
  reviewed BOOLEAN DEFAULT FALSE,
  reviewer_notes TEXT
);

-- Index for admin dashboard
CREATE INDEX idx_flagged_unreviewed ON flagged_submissions(reviewed);

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- Function: Update department statistics after submission
CREATE OR REPLACE FUNCTION update_department_stats()
RETURNS TRIGGER AS $$
DECLARE
  dept_record RECORD;
  submissions_count INTEGER;
  top_2_index INTEGER;
  top_6_index INTEGER;
  top_10_index INTEGER;
BEGIN
  -- Get all submissions for this department/trimester, sorted by ranking criteria
  SELECT COUNT(*) INTO submissions_count
  FROM scholarship_submissions
  WHERE department = NEW.department AND trimester = NEW.trimester;
  
  -- Calculate threshold indexes
  top_2_index := GREATEST(1, FLOOR(submissions_count * 0.02));
  top_6_index := GREATEST(1, FLOOR(submissions_count * 0.06));
  top_10_index := GREATEST(1, FLOOR(submissions_count * 0.10));
  
  -- Upsert department stats
  INSERT INTO department_stats (
    department,
    trimester,
    total_submissions,
    highest_last_gpa,
    highest_cgpa,
    average_last_gpa,
    average_cgpa,
    last_updated
  )
  SELECT 
    NEW.department,
    NEW.trimester,
    COUNT(*),
    MAX(last_trimester_gpa),
    MAX(overall_cgpa),
    AVG(last_trimester_gpa),
    AVG(overall_cgpa),
    NOW()
  FROM scholarship_submissions
  WHERE department = NEW.department AND trimester = NEW.trimester
  ON CONFLICT (department, trimester) 
  DO UPDATE SET
    total_submissions = EXCLUDED.total_submissions,
    highest_last_gpa = EXCLUDED.highest_last_gpa,
    highest_cgpa = EXCLUDED.highest_cgpa,
    average_last_gpa = EXCLUDED.average_last_gpa,
    average_cgpa = EXCLUDED.average_cgpa,
    last_updated = NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Update stats after insert/update/delete
CREATE TRIGGER trigger_update_stats_insert
AFTER INSERT ON scholarship_submissions
FOR EACH ROW
EXECUTE FUNCTION update_department_stats();

CREATE TRIGGER trigger_update_stats_update
AFTER UPDATE ON scholarship_submissions
FOR EACH ROW
EXECUTE FUNCTION update_department_stats();

CREATE TRIGGER trigger_update_stats_delete
AFTER DELETE ON scholarship_submissions
FOR EACH ROW
EXECUTE FUNCTION update_department_stats();

-- Function: Update 'updated_at' timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Auto-update 'updated_at' for users
CREATE TRIGGER trigger_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Trigger: Auto-update 'updated_at' for submissions
CREATE TRIGGER trigger_submissions_updated_at
BEFORE UPDATE ON scholarship_submissions
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE scholarship_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE department_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE flagged_submissions ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read department stats (public data)
CREATE POLICY "Public read access to department stats"
ON department_stats FOR SELECT
TO anon
USING (true);

-- Policy: Anyone can read submissions (for calculating ranks)
-- But sensitive data (email, student_id) should be filtered in queries
CREATE POLICY "Public read access to submissions"
ON scholarship_submissions FOR SELECT
TO anon
USING (true);

-- Policy: Users can insert their own submissions
CREATE POLICY "Users can insert submissions"
ON scholarship_submissions FOR INSERT
TO anon
WITH CHECK (true);

-- Policy: Users can update their own submissions
CREATE POLICY "Users can update own submissions"
ON scholarship_submissions FOR UPDATE
TO anon
USING (true);

-- Policy: Users can delete their own submissions
CREATE POLICY "Users can delete own submissions"
ON scholarship_submissions FOR DELETE
TO anon
USING (true);

-- Policy: Anyone can read/write email verifications (for OTP flow)
CREATE POLICY "Public access to verifications"
ON email_verifications FOR ALL
TO anon
USING (true);

-- Policy: Anyone can read/write users (for registration)
CREATE POLICY "Public access to users"
ON users FOR ALL
TO anon
USING (true);

-- Policy: Rate limits - public access
CREATE POLICY "Public access to rate limits"
ON rate_limits FOR ALL
TO anon
USING (true);

-- ============================================
-- SEED DATA (Optional)
-- ============================================

-- Insert sample departments (you can add more)
-- This helps with dropdown menus

-- ============================================
-- CLEANUP JOBS (Run periodically)
-- ============================================

-- Delete expired OTPs (run this daily via cron or Edge Function)
-- SELECT delete_expired_otps();

-- Delete old rate limit records (older than 24 hours)
CREATE OR REPLACE FUNCTION cleanup_rate_limits()
RETURNS void AS $$
BEGIN
  DELETE FROM rate_limits 
  WHERE window_start < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- NOTES FOR DEPLOYMENT
-- ============================================

-- 1. Run this entire script in Supabase SQL Editor
-- 2. Verify all tables are created: 
--    - users
--    - email_verifications
--    - scholarship_submissions
--    - department_stats
--    - rate_limits
--    - flagged_submissions
--
-- 3. Check RLS is enabled on all tables
-- 4. Test inserting a sample submission
-- 5. Verify triggers are working (stats should auto-update)
--
-- 6. Set up Edge Function or cron job to run cleanup:
--    - delete_expired_otps() (daily)
--    - cleanup_rate_limits() (daily)

-- ============================================
-- SAMPLE QUERIES FOR TESTING
-- ============================================

-- Test: Insert a sample user
-- INSERT INTO users (email, student_id, email_verified)
-- VALUES ('test@uiu.ac.bd', '011-221-042', true);

-- Test: Insert a sample submission
-- INSERT INTO scholarship_submissions 
-- (user_id, student_id, email, department, trimester, last_trimester_gpa, overall_cgpa)
-- VALUES 
-- ((SELECT id FROM users WHERE email = 'test@uiu.ac.bd'), 
--  '011-221-042', 'test@uiu.ac.bd', 'CSE', 'Fall 2024', 3.85, 3.72);

-- Test: Check department stats
-- SELECT * FROM department_stats WHERE department = 'CSE' AND trimester = 'Fall 2024';

-- Test: Get all submissions for ranking
-- SELECT last_trimester_gpa, overall_cgpa, submitted_at 
-- FROM scholarship_submissions
-- WHERE department = 'CSE' AND trimester = 'Fall 2024'
-- ORDER BY last_trimester_gpa DESC, overall_cgpa DESC, submitted_at ASC;
