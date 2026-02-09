-- Enforce: one teacher review per student per teacher
-- Run in Supabase SQL Editor
--
-- This creates a UNIQUE index on (teacher_id, student_id).
-- NOTE: This will FAIL if duplicate rows already exist.

-- 1) Check duplicates first
SELECT teacher_id, student_id, COUNT(*) AS review_count
FROM teacher_reviews
GROUP BY teacher_id, student_id
HAVING COUNT(*) > 1
ORDER BY review_count DESC;

-- 2) Cleanup duplicates (keeps the newest review per (teacher_id, student_id))
-- WARNING: This deletes data (older duplicates). Review the duplicate list above first.
WITH ranked AS (
	SELECT
		id,
		teacher_id,
		student_id,
		created_at,
		updated_at,
		ROW_NUMBER() OVER (
			PARTITION BY teacher_id, student_id
			ORDER BY COALESCE(updated_at, created_at) DESC NULLS LAST, id DESC
		) AS rn
	FROM teacher_reviews
)
DELETE FROM teacher_reviews tr
USING ranked r
WHERE tr.id = r.id
	AND r.rn > 1;

-- 2b) Verify duplicates are gone
SELECT teacher_id, student_id, COUNT(*) AS review_count
FROM teacher_reviews
GROUP BY teacher_id, student_id
HAVING COUNT(*) > 1
ORDER BY review_count DESC;

-- 3) Enforce uniqueness
CREATE UNIQUE INDEX IF NOT EXISTS idx_teacher_reviews_teacher_student_unique
ON teacher_reviews (teacher_id, student_id);
