# 🔧 Email OTP Setup - Quick Fix Guide

## ❌ Current Issues:
1. **500 Error** - Supabase Edge Function failing
2. **RESEND_API_KEY not configured** in Supabase environment

## ✅ Solution Steps:

### 1️⃣ Get Resend API Key (Free)

1. Go to [resend.com](https://resend.com)
2. Sign up for free account
3. Go to **API Keys** section
4. Click **Create API Key**
5. Copy the key (starts with `re_...`)

### 2️⃣ Configure Supabase Edge Function

1. Go to your Supabase Dashboard
2. Navigate to **Edge Functions** → **Configuration**
3. Add environment variable:
   - **Name:** `RESEND_API_KEY`
   - **Value:** Your Resend API key (from step 1)
4. Click **Save**

### 3️⃣ Deploy Updated Edge Function

```bash
# From project root
cd supabase/functions
supabase functions deploy send-otp-email

# Or deploy with secret directly:
supabase secrets set RESEND_API_KEY=your_key_here
supabase functions deploy send-otp-email
```

### 4️⃣ Test the Function

```bash
# Test locally
supabase functions serve send-otp-email

# Or test directly:
curl -i --location --request POST 'https://azvjlmywcrjwivcewgta.supabase.co/functions/v1/send-otp-email' \
  --header 'Authorization: Bearer YOUR_ANON_KEY' \
  --header 'Content-Type: application/json' \
  --data '{"email":"test@uiu.ac.bd","otp":"123456"}'
```

## 🔄 What I Fixed in Code:

### ✅ `review-auth.js` Changes:
- Changed **INSERT** → **UPSERT** (auto-registers new users)
- Added fallback for when email service is down
- Better error messages
- OTP still works even if email fails (stored in database)

### ✅ `send-otp-email/index.ts` Changes:
- Added proper CORS headers for all methods
- Better error logging
- Handles missing API key gracefully

## 🎯 Alternative: Skip Email for Now

If you want to test without email:

1. Manually check the `email_verifications` table in Supabase
2. Copy the OTP from the database
3. Enter it in the login form

**To view OTP in Supabase:**
```sql
SELECT email, otp, expires_at 
FROM email_verifications 
WHERE email = 'your-email@uiu.ac.bd' 
ORDER BY created_at DESC 
LIMIT 1;
```

## 📋 Verification Checklist:

- [ ] Resend account created
- [ ] API key copied
- [ ] Supabase environment variable set
- [ ] Edge function redeployed
- [ ] Code changes committed
- [ ] Test login on local/deployed site
- [ ] Check Supabase logs for errors

## 🚨 Common Issues:

### "RESEND_API_KEY is not configured"
→ Environment variable not set in Supabase

### "500 Internal Server Error"
→ Edge function needs redeployment

### "406 Not Acceptable"
→ CORS issue or missing headers (now fixed)

### "Email failed but OTP generated"
→ Expected behavior with new fallback system

## 📞 Need Help?

Check Supabase Edge Function logs:
1. Dashboard → Edge Functions → send-otp-email
2. View **Logs** tab for errors

---

**Status After Fix:**
- ✅ Auto-registration for new users (UPSERT)
- ✅ Graceful email fallback
- ✅ Better error messages
- ✅ CORS headers fixed
- ⏳ Needs Resend API key configuration
