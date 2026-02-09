# Database Schema - Column Names Reference

This document lists all actual column names in the database to prevent mismatches in code.

## teachers
- id
- name
- department
- email
- total_reviews
- overall_rating
- teaching_quality_avg
- fair_grading_avg
- punctuality_avg
- approachability_avg
- created_at
- updated_at
- avg_punctuality

## teacher_reviews
- id
- teacher_id
- course_code
- student_email
- student_id
- teaching_quality
- fair_grading
- punctuality
- approachability
- overall_rating
- review_text
- tags
- helpful_count
- unhelpful_count
- is_approved
- is_flagged
- flag_reason
- created_at
- updated_at

## courses
- id
- code
- name
- department
- credit_hours
- teachers_count
- reviews_count
- avg_rating
- created_at
- updated_at

## course_teachers
- id
- course_code
- teacher_id
- avg_rating
- reviews_count
- created_at
- updated_at

## users
- id
- email
- student_id
- email_verified
- verified_at
- created_at
- updated_at

## email_verifications
- id
- email
- student_id
- otp
- expires_at
- attempts
- verified
- created_at

## scholarship_submissions
- id
- user_id
- student_id
- email
- department
- trimester
- last_trimester_gpa
- overall_cgpa
- percentile_rank
- scholarship_tier
- position
- submitted_at
- updated_at
- ip_address

## department_stats
- id
- department
- trimester
- total_submissions
- verified_submissions
- top_2_percent_last_gpa
- top_2_percent_cgpa
- top_6_percent_last_gpa
- top_6_percent_cgpa
- top_10_percent_last_gpa
- top_10_percent_cgpa
- highest_last_gpa
- highest_cgpa
- average_last_gpa
- average_cgpa
- median_last_gpa
- median_cgpa
- last_updated

## review_votes
- id
- review_id
- student_email
- vote_type
- created_at

## flagged_submissions
- id
- submission_id
- reason
- flagged_at
- reviewed
- reviewer_notes

## page_visits
- id
- page_name
- visit_count
- last_updated

## rate_limits
- id
- ip_address
- action_type
- attempts
- window_start
- blocked_until

## app_settings
- key
- value
- updated_at

---

## Important Notes for Developers

### Common Mismatches to Avoid:
1. ✅ `fair_grading` (NOT `grading_fairness`)
2. ✅ `overall_rating` in teachers table (NOT `average_rating`)
3. ✅ All category ratings in teacher_reviews are 1-5 range (NOT 1-10)
4. ✅ `student_id` and `student_email` are required in teacher_reviews
5. ✅ Stats columns in teachers table use `_avg` suffix: `teaching_quality_avg`, `fair_grading_avg`, `punctuality_avg`, `approachability_avg`

### Authentication System:
✅ **Login Required** - Users must login with UIU email and OTP verification
- Login page: `review-login.html`
- Auth script: `js/review-auth.js`
- Session stored in localStorage with 30-day expiration
- Real student data used: `users.id` → `teacher_reviews.student_id`
- Email from verified user: `users.email` → `teacher_reviews.student_email`
