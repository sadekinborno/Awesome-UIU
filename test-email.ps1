# Test Email Sending Edge Function

# ⚙️ Configuration
# Replace these with your actual values:
$SUPABASE_URL = "https://azvjlmywcrjwivcewgta.supabase.co"
$SUPABASE_ANON_KEY = "YOUR_ANON_KEY_HERE"  # Get from Supabase Dashboard → Settings → API
$TEST_EMAIL = "your.email@uiu.ac.bd"  # Your UIU email to receive test

# 🧪 Test OTP code
$TEST_OTP = "123456"

Write-Host "🧪 Testing Email Sending Edge Function..." -ForegroundColor Cyan
Write-Host ""

# Prepare request
$url = "$SUPABASE_URL/functions/v1/send-otp-email"
$headers = @{
    "Content-Type" = "application/json"
    "Authorization" = "Bearer $SUPABASE_ANON_KEY"
    "apikey" = "$SUPABASE_ANON_KEY"
}
$body = @{
    email = $TEST_EMAIL
    otp = $TEST_OTP
} | ConvertTo-Json

Write-Host "📤 Sending request to: $url" -ForegroundColor Yellow
Write-Host "📧 Test email: $TEST_EMAIL" -ForegroundColor Yellow
Write-Host "🔑 Test OTP: $TEST_OTP" -ForegroundColor Yellow
Write-Host ""

try {
    # Send request
    $response = Invoke-RestMethod -Uri $url -Method POST -Headers $headers -Body $body
    
    Write-Host "✅ SUCCESS!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Response:" -ForegroundColor Cyan
    $response | ConvertTo-Json -Depth 3
    Write-Host ""
    Write-Host "📬 Check your email inbox (and spam folder)!" -ForegroundColor Green
    Write-Host "Expected: Email with OTP code $TEST_OTP" -ForegroundColor Green
    
} catch {
    Write-Host "❌ FAILED!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Error:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host ""
    
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "Response body:" -ForegroundColor Yellow
        Write-Host $responseBody -ForegroundColor Yellow
    }
    
    Write-Host ""
    Write-Host "💡 Troubleshooting tips:" -ForegroundColor Cyan
    Write-Host "  1. Verify SUPABASE_ANON_KEY is correct (from Supabase Dashboard)" -ForegroundColor Gray
    Write-Host "  2. Check if edge function is deployed: supabase functions list" -ForegroundColor Gray
    Write-Host "  3. Verify RESEND_API_KEY is set in Supabase secrets" -ForegroundColor Gray
    Write-Host "  4. Check edge function logs: supabase functions logs send-otp-email" -ForegroundColor Gray
}

Write-Host ""
Write-Host "────────────────────────────────────────" -ForegroundColor Gray
Write-Host ""

# Instructions for getting anon key
Write-Host "📝 How to get your SUPABASE_ANON_KEY:" -ForegroundColor Cyan
Write-Host "  1. Go to https://supabase.com/dashboard/project/azvjlmywcrjwivcewgta" -ForegroundColor Gray
Write-Host "  2. Click Settings (left sidebar)" -ForegroundColor Gray
Write-Host "  3. Click API" -ForegroundColor Gray
Write-Host "  4. Copy 'anon' 'public' key" -ForegroundColor Gray
Write-Host "  5. Paste it in line 5 of this script" -ForegroundColor Gray
Write-Host ""
