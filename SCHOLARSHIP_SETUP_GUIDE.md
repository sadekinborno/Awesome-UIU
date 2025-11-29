# 🚀 Scholarship Probability Checker - Setup Guide

## ✅ What's Been Created

### Files Created:
1. **database-schema.sql** - Complete database schema for Supabase
2. **src/js/supabase-config.js** - Supabase configuration with your API keys
3. **src/scholarship-checker.html** - Main scholarship checker page
4. **src/js/scholarship-auth.js** - Email verification logic (OTP)
5. **src/js/scholarship-checker.js** - GPA submission and ranking logic
6. **src/index.html** - Updated with scholarship checker link

---

## 📋 Setup Steps (For You to Complete)

### Step 1: Run Database Schema in Supabase ⚠️ **REQUIRED**

1. Go to your Supabase project dashboard
2. Click **"SQL Editor"** in the left sidebar
3. Click **"New Query"**
4. Open `database-schema.sql` from this project
5. **Copy ALL the SQL code**
6. **Paste it into the Supabase SQL Editor**
7. Click **"Run"** (or press Ctrl+Enter)
8. You should see: **"Success. No rows returned"**

This creates 6 tables:
- ✅ users
- ✅ email_verifications
- ✅ scholarship_submissions
- ✅ department_stats
- ✅ rate_limits
- ✅ flagged_submissions

### Step 2: Verify Tables Were Created

1. Click **"Table Editor"** in Supabase sidebar
2. You should see all 6 tables listed
3. Click on each table to verify structure

### Step 3: Test Locally

1. Open the project in VS Code
2. Use Live Server to view `src/scholarship-checker.html`
3. Fill in email and Student ID
4. Click "Send Verification Code"
5. **Check browser console** - you'll see the OTP code printed (for testing)
6. Enter the OTP code
7. Fill in GPA details
8. Submit and see results!

**Test Email Format:** `yourname@uiu.ac.bd`  
**Test Student ID:** `011-221-042`

---

## 🧪 Testing Checklist

### Email Verification:
- [ ] Enter UIU email (ends with @uiu.ac.bd)
- [ ] Enter Student ID (format: XXX-XXX-XXX)
- [ ] OTP appears in console (6 digits)
- [ ] OTP verification works
- [ ] Invalid OTP shows error
- [ ] Expired OTP shows error (wait 5 minutes)
- [ ] Resend OTP works

### GPA Submission:
- [ ] Select department
- [ ] Select trimester
- [ ] Enter Last Trimester GPA (0-4.0)
- [ ] Enter Overall CGPA (0-4.0)
- [ ] Submit shows loading state
- [ ] Results display correctly

### Results Display:
- [ ] Rank percentage shows (e.g., "Top 4.2%")
- [ ] Position shows (e.g., "#6 out of 142")
- [ ] Scholarship tier shows (100%, 50%, 25%, or 0%)
- [ ] Department stats show
- [ ] Thresholds display correctly
- [ ] Update submission button works
- [ ] Share button copies text

---

## 🐛 Known Limitations (TEST MODE)

### Email Sending:
⚠️ **OTP emails are NOT actually sent yet!**

The OTP code is printed to the browser console for testing.

To see the OTP:
1. Open browser DevTools (F12)
2. Go to "Console" tab
3. Look for: `🔐 TEST OTP: 123456`

### Why?
Supabase's built-in email service requires additional configuration for custom email templates. For now, we're using console logging for testing.

### Production Solution:
When ready to launch, we'll set up one of these:
- **Option A:** Configure Supabase custom SMTP
- **Option B:** Use SendGrid API
- **Option C:** Use Supabase Edge Functions for emails

---

## 📦 Deployment Steps

### When Ready to Deploy:

```bash
# 1. Stage all changes
git add .

# 2. Commit
git commit -m "feat: Add Scholarship Probability Checker with email verification"

# 3. Push to GitHub
git push origin main
```

Netlify will automatically deploy!

---

## 🎯 How It Works

### User Flow:
```
1. User visits scholarship-checker.html
   ↓
2. Enters UIU email + Student ID
   ↓
3. Receives 6-digit OTP (console for now)
   ↓
4. Enters OTP to verify email
   ↓
5. Email verified → Account created
   ↓
6. Session saved (stays logged in for 30 days)
   ↓
7. Enters Department, Trimester, Last GPA, CGPA
   ↓
8. System calculates rank:
   - Primary sort: Last Trimester GPA (descending)
   - Tie-breaker 1: Overall CGPA (descending)
   - Tie-breaker 2: Submission time (earlier = higher)
   ↓
9. Shows results:
   - Percentile rank (e.g., "Top 4.2%")
   - Position (#6 out of 142)
   - Scholarship tier (100%, 50%, 25%, 0%)
   - Department statistics
   - Tier thresholds
   ↓
10. User can update submission or share results
```

### Ranking Algorithm:
```javascript
// Example with 3 students:
Student A: Last GPA 3.85, CGPA 3.72, submitted 10:00 AM
Student B: Last GPA 3.85, CGPA 3.80, submitted 10:30 AM
Student C: Last GPA 3.90, CGPA 3.50, submitted 11:00 AM

Rankings:
#1 - Student C (highest Last GPA: 3.90)
#2 - Student B (tied Last GPA, but higher CGPA: 3.80)
#3 - Student A (tied Last GPA, lower CGPA: 3.72)
```

### Scholarship Tiers:
- **Top 2%** → 100% scholarship (🟢 Green)
- **Top 2-6%** → 50% scholarship (🟡 Yellow)
- **Top 6-10%** → 25% scholarship (🟠 Orange)
- **Below 10%** → No scholarship (⚪ Gray)

---

## 🔒 Security Features

### Implemented:
- ✅ UIU email validation (@uiu.ac.bd only)
- ✅ Student ID format validation (XXX-XXX-XXX)
- ✅ OTP expiration (5 minutes)
- ✅ Maximum OTP attempts (5 per code)
- ✅ Rate limiting (5 OTP requests per hour per IP)
- ✅ Session management (30-day expiration)
- ✅ One submission per user per trimester
- ✅ Row Level Security (RLS) enabled on all tables

### Anti-Spam:
- ✅ IP-based rate limiting
- ✅ Duplicate Student ID detection
- ✅ Suspicious GPA pattern flagging (reserved for future)

---

## 📊 Database Structure

### Users Table:
```
id (UUID) - Primary key
email (TEXT) - UIU email (unique)
student_id (TEXT) - Student ID (unique)
email_verified (BOOLEAN)
verified_at (TIMESTAMP)
```

### Scholarship Submissions Table:
```
id (UUID)
user_id (UUID) → references users
department (TEXT)
trimester (TEXT)
last_trimester_gpa (DECIMAL 4,2)
overall_cgpa (DECIMAL 4,2)
percentile_rank (DECIMAL 5,2)
scholarship_tier (INTEGER)
position (INTEGER)
UNIQUE(user_id, trimester, department)
```

### Email Verifications Table:
```
id (UUID)
email (TEXT)
student_id (TEXT)
otp (TEXT)
expires_at (TIMESTAMP)
attempts (INTEGER)
verified (BOOLEAN)
```

---

## 🎨 Features Included

### Phase 1 (MVP - DONE ✅):
- [x] UIU email verification (OTP)
- [x] Student ID validation
- [x] Department selection
- [x] Trimester selection
- [x] Last Trimester GPA input
- [x] Overall CGPA input
- [x] Ranking algorithm with tie-breaking
- [x] Scholarship tier calculation (2%, 6%, 10%)
- [x] Basic results display
- [x] Department statistics
- [x] Threshold displays
- [x] Session management
- [x] Update submission
- [x] Share results
- [x] Anti-spam measures
- [x] Responsive design

### Phase 2 (Coming Soon):
- [ ] Actual email sending (not console logs)
- [ ] GPA distribution chart
- [ ] Historical comparisons
- [ ] Confidence scoring
- [ ] "What-if" calculator
- [ ] Email notifications

---

## 🆘 Troubleshooting

### "Tables not found" error:
→ Run `database-schema.sql` in Supabase SQL Editor

### "Invalid API key" error:
→ Check `supabase-config.js` has correct URL and anon key

### OTP not working:
→ Check browser console for the 6-digit code

### Can't submit GPA:
→ Make sure email is verified first

### Results not showing:
→ Check if there are other submissions in the same department/trimester

### Want to test with multiple users:
→ Clear localStorage or use incognito mode for each new user

---

## 📝 Next Steps for Production

### Before Launch:
1. Set up actual email service (SendGrid/custom SMTP)
2. Remove OTP console logging
3. Add email templates with UIU branding
4. Test with real UIU students (beta testing)
5. Add analytics tracking
6. Create admin dashboard for monitoring
7. Add data export functionality

### Marketing:
1. Announce on UIU Facebook groups
2. Share on class WhatsApp groups
3. Create demo video
4. Get feedback from students
5. Iterate based on feedback

---

## 🎉 You're All Set!

The Scholarship Probability Checker is ready to test locally!

**Next Action:** Run the database schema in Supabase SQL Editor, then test the complete flow.

Good luck! 🚀
