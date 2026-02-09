# Email Verification Setup Guide

## 🎯 Goal
Set up Resend email service to send OTP verification codes to students.

## 📋 Prerequisites
- Supabase account with access to your project
- Supabase CLI installed (`npm install -g supabase`)
- Resend account (free tier available)

---

## Step 1: Install Supabase CLI

```powershell
# Check if already installed
supabase --version

# If not installed:
npm install -g supabase
```

---

## Step 2: Create Resend Account

1. Go to **https://resend.com**
2. Sign up with your email
3. Verify your email address
4. Complete account setup

---

## Step 3: Get Resend API Key

1. Log in to Resend dashboard
2. Navigate to **API Keys** section
3. Click **Create API Key**
4. Name it: `The Awesome UIU - Production`
5. Copy the API key (starts with `re_...`)
6. **⚠️ IMPORTANT**: Save it somewhere safe - you won't see it again!

---

## Step 4: Add API Key to Supabase

### Option A: Using Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard
2. Navigate to **Settings** → **Edge Functions**
3. Find **Secrets** section
4. Click **Add New Secret**
5. Enter:
   - **Name**: `RESEND_API_KEY`
   - **Value**: Your Resend API key (paste the `re_...` key)
6. Click **Save**

### Option B: Using Supabase CLI

```powershell
# Login to Supabase
supabase login

# Link to your project (if not already linked)
supabase link --project-ref azvjlmywcrjwivcewgta

# Set the secret
supabase secrets set RESEND_API_KEY=re_your_actual_api_key_here
```

---

## Step 5: Configure Sender Email in Resend

### For Testing (Free Tier)
Resend allows sending to **any email** on free tier, but from a default domain.

### For Production (Custom Domain - Optional)
1. In Resend dashboard, go to **Domains**
2. Click **Add Domain**
3. Add your domain (e.g., `theawesomeuiu.com`)
4. Follow DNS configuration instructions
5. Wait for verification

**Note**: You can launch with the default Resend domain and add custom domain later.

---

## Step 6: Deploy Edge Function

```powershell
# Navigate to project root
cd e:\Codes_Stuff\Projects\Awesome-UIU-main

# Login to Supabase (if not already)
supabase login

# Link project (if not already linked)
supabase link --project-ref azvjlmywcrjwivcewgta

# Deploy the function
supabase functions deploy send-otp-email

# Verify deployment
supabase functions list
```

---

## Step 7: Test Email Delivery

### Method 1: Direct Test with PowerShell

```powershell
# Replace with your actual Supabase URL and anon key
$url = "https://azvjlmywcrjwivcewgta.supabase.co/functions/v1/send-otp-email"
$headers = @{
    "Content-Type" = "application/json"
    "Authorization" = "Bearer YOUR_SUPABASE_ANON_KEY"
}
$body = @{
    email = "your.email@uiu.ac.bd"
    otp = "123456"
} | ConvertTo-Json

Invoke-RestMethod -Uri $url -Method POST -Headers $headers -Body $body
```

### Method 2: Test through Scholarship Checker

1. Open `scholarship-checker.html` in browser
2. Click **Verify Your UIU Email**
3. Enter your UIU email
4. Click **Send OTP**
5. Check your email inbox (and spam folder)
6. Verify OTP arrives within 1 minute

---

## Step 8: Update Sender Email (If Using Custom Domain)

If you configured a custom domain, update the sender email in the edge function:

**File**: `supabase/functions/send-otp-email/index.ts`

**Line 36**: Change
```typescript
from: 'The Awesome UIU <noreply@theawesomeuiu.com>',
```

To your verified domain:
```typescript
from: 'The Awesome UIU <noreply@yourdomain.com>',
```

Then redeploy:
```powershell
supabase functions deploy send-otp-email
```

---

## Step 9: Verify Everything Works

### ✅ Checklist:
- [ ] Supabase CLI installed
- [ ] Resend account created
- [ ] API key obtained and saved
- [ ] API key added to Supabase secrets
- [ ] Edge function deployed successfully
- [ ] Test email received in inbox
- [ ] OTP code is readable and correct
- [ ] Email design looks good (check on mobile too)
- [ ] Email doesn't go to spam

---

## 🚀 Step 10: Launch Scholarship Checker

Once emails are working:

1. **Remove coming soon mode**:
   - File: `src/scholarship-checker.html`
   - Line 1234: Change `COMING_SOON_MODE = true` to `COMING_SOON_MODE = false`

2. **Update index.html**:
   - File: `src/index.html`
   - Remove `tool-card-coming-soon` class from scholarship checker card
   - Remove `<div class="coming-soon-badge">Coming Soon</div>`

3. **Final testing**:
   - Test complete flow: Email → OTP → GPA submission → Results
   - Test with different UIU email addresses
   - Verify data appears in admin panel

4. **Monitor first submissions**:
   - Check admin panel for incoming data
   - Watch for any error reports
   - Verify department statistics update correctly

---

## 🔍 Troubleshooting

### Email not arriving?
- Check spam folder
- Verify API key is correct in Supabase secrets
- Check edge function logs: `supabase functions logs send-otp-email`
- Verify Resend account is active (check Resend dashboard)

### "Email service unavailable" error?
- Check browser console for error details
- Verify edge function is deployed: `supabase functions list`
- Check Supabase function logs for errors
- Ensure CORS is working (preflight OPTIONS request)

### OTP still showing in console?
- This is the fallback behavior (development mode)
- Check if edge function call is actually succeeding
- Look for error message before the console OTP

### Rate limiting issues?
- Resend free tier: 100 emails/day, 3,000/month
- Upgrade Resend plan if needed
- Consider implementing frontend rate limiting

---

## 📊 Monitoring

### Check edge function logs:
```powershell
# Real-time logs
supabase functions logs send-otp-email --follow

# Last 100 lines
supabase functions logs send-otp-email --tail 100
```

### Monitor Resend dashboard:
- Track email delivery rates
- Check bounce/spam rates
- Monitor API usage

---

## 🔐 Security Notes

- **Never commit API keys** to Git
- API key is stored securely in Supabase secrets
- Edge function runs on Supabase's secure infrastructure
- OTP expires after 5 minutes (enforced in scholarship-auth.js)
- Rate limiting prevents spam (already implemented)

---

## 💰 Cost Breakdown

### Resend Free Tier:
- 3,000 emails/month
- 100 emails/day
- Good for: ~100 students/day checking scholarships

### When to Upgrade:
- More than 3,000 verifications/month
- Need custom domain immediately
- Want dedicated IP address
- Resend Pro: $20/month (50,000 emails)

---

## 🎉 You're Done!

After completing these steps:
- ✅ Students can receive OTP codes via email
- ✅ Email verification system is production-ready
- ✅ Scholarship checker is ready to launch
- ✅ You can monitor email delivery and edge function logs

**Next**: Toggle coming soon mode off and launch! 🚀
