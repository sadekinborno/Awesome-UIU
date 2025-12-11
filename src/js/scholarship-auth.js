// ============================================
// Scholarship Checker - Authentication Logic
// Handles OTP generation, verification, and session management
// ============================================

// Session storage keys
const SESSION_KEY = 'scholarship_session';
const USER_DATA_KEY = 'scholarship_user';

// ============================================
// Utility Functions
// ============================================

function showAlert(message, type = 'info') {
    const alertContainer = document.getElementById('alertContainer');
    const alert = document.createElement('div');
    alert.className = `alert alert-${type} show`;
    alert.textContent = message;
    alertContainer.appendChild(alert);
    
    setTimeout(() => {
        alert.classList.remove('show');
        setTimeout(() => alert.remove(), 300);
    }, 5000);
}

function validateEmail(email) {
    // Accept any UIU email subdomain (@uiu.ac.bd, @bscse.uiu.ac.bd, @mba.uiu.ac.bd, etc.)
    const emailRegex = /^[^\s@]+@([a-z]+\.)?uiu\.ac\.bd$/i;
    return emailRegex.test(email);
}

function validateStudentId(id) {
    // Remove all non-digits
    const digitsOnly = id.replace(/\D/g, '');
    
    // Must be exactly 9 or 10 digits
    if (digitsOnly.length !== 9 && digitsOnly.length !== 10) {
        return false;
    }
    
    // Format: XXX-XXX-XXX or XXX-XXX-XXXX
    const pattern = /^\d{3}-?\d{3}-?\d{3,4}$/;
    return pattern.test(id) || /^\d{9,10}$/.test(digitsOnly);
}

function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

function getClientIP() {
    // In production, you'd get this from server-side
    // For now, use a placeholder
    return 'client_ip_' + Date.now();
}

// ============================================
// Session Management
// ============================================

function saveSession(userData) {
    localStorage.setItem(SESSION_KEY, JSON.stringify({
        userId: userData.id,
        email: userData.email,
        studentId: userData.student_id,
        verifiedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days
    }));
    localStorage.setItem(USER_DATA_KEY, JSON.stringify(userData));
}

function getSession() {
    try {
        const session = localStorage.getItem(SESSION_KEY);
        if (!session) return null;
        
        const sessionData = JSON.parse(session);
        const expiresAt = new Date(sessionData.expiresAt);
        
        if (expiresAt < new Date()) {
            clearSession();
            return null;
        }
        
        return sessionData;
    } catch (error) {
        console.error('Error reading session:', error);
        return null;
    }
}

function getUserData() {
    try {
        const userData = localStorage.getItem(USER_DATA_KEY);
        return userData ? JSON.parse(userData) : null;
    } catch (error) {
        console.error('Error reading user data:', error);
        return null;
    }
}

function clearSession() {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(USER_DATA_KEY);
}

function isLoggedIn() {
    return getSession() !== null;
}

// ============================================
// Rate Limiting
// ============================================

async function checkRateLimit(ip, actionType) {
    try {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
        
        const { data, error } = await window.supabaseClient
            .from('rate_limits')
            .select('*')
            .eq('ip_address', ip)
            .eq('action_type', actionType)
            .gte('window_start', oneHourAgo);
        
        // If query fails, allow the action (fail open)
        if (error) {
            console.warn('Rate limit check failed, allowing:', error);
            return { allowed: true };
        }
        
        // Count attempts in the last hour
        const attempts = data?.length || 0;
        
        if (attempts >= 5) {
            return { 
                allowed: false, 
                message: 'Too many attempts. Please try again in 1 hour.' 
            };
        }
        
        return { allowed: true };
    } catch (error) {
        console.warn('Rate limit error, allowing:', error);
        return { allowed: true };
    }
}

async function incrementRateLimit(ip, actionType) {
    const { data: existing } = await window.supabaseClient
        .from('rate_limits')
        .select('*')
        .eq('ip_address', ip)
        .eq('action_type', actionType)
        .gte('window_start', new Date(Date.now() - 3600000).toISOString())
        .single();
    
    if (existing) {
        await window.supabaseClient
            .from('rate_limits')
            .update({ attempts: existing.attempts + 1 })
            .eq('id', existing.id);
    } else {
        await window.supabaseClient
            .from('rate_limits')
            .insert({
                ip_address: ip,
                action_type: actionType,
                attempts: 1,
                window_start: new Date().toISOString()
            });
    }
}

// ============================================
// Send OTP
// ============================================

async function sendOTP(email, studentId) {
    try {
        // Validate inputs
        if (!validateEmail(email)) {
            throw new Error('Please enter a valid UIU email address');
        }
        
        if (!validateStudentId(studentId)) {
            throw new Error('Please enter a valid Student ID (9-10 digits)');
        }
        
        // Check rate limit
        const clientIP = getClientIP();
        const rateCheck = await checkRateLimit(clientIP, 'otp_request');
        if (!rateCheck.allowed) {
            throw new Error(rateCheck.message);
        }
        
        // Generate OTP
        const otp = generateOTP();
        const expiresAtMs = Date.now() + (5 * 60 * 1000); // 5 minutes from now in milliseconds
        
        console.log('Creating OTP:', {
            otp,
            expiresAtMs,
            expiresAtDate: new Date(expiresAtMs).toISOString(),
            currentTime: Date.now(),
            diffMinutes: (expiresAtMs - Date.now()) / 60000
        });
        
        // Save OTP to database with BIGINT timestamp
        const { error: otpError } = await window.supabaseClient
            .from('email_verifications')
            .insert({
                email: email,
                student_id: studentId,
                otp: otp,
                expires_at: expiresAtMs // Store as BIGINT (milliseconds)
            });
        
        if (otpError) {
            console.error('OTP save error:', otpError);
            throw new Error('Failed to send verification code. Please try again.');
        }
        
        // Send email via Supabase Edge Function
        await sendOTPEmail(email, otp);
        
        // Increment rate limit
        await incrementRateLimit(clientIP, 'otp_request');
        
        return { success: true };
    } catch (error) {
        console.error('Send OTP error:', error);
        throw error;
    }
}

async function sendOTPEmail(email, otp) {
    try {
        // Call Supabase Edge Function to send email via Resend
        const { data, error } = await window.supabaseClient.functions.invoke('send-otp-email', {
            body: {
                email: email,
                otp: otp
            }
        });
        
        if (error) {
            console.error('Email sending error:', error);
            throw new Error('Email service is unavailable. Please try again later.');
        }
        
        console.log('✅ Email sent successfully to:', email);
        return { success: true };
        
    } catch (error) {
        console.error('Failed to send email:', error);
        throw new Error('Failed to send verification email. Please check if the edge function is deployed and RESEND_API_KEY is set.');
    }
}

// ============================================
// Verify OTP
// ============================================

async function verifyOTP(email, studentId, otp) {
    try {
        console.log('Verifying OTP:', { email, studentId, otp });
        
        // Find the OTP record
        const { data: otpData, error: otpError } = await window.supabaseClient
            .from('email_verifications')
            .select('*')
            .eq('email', email)
            .eq('student_id', studentId)
            .eq('otp', otp)
            .eq('verified', false)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
        
        if (otpError || !otpData) {
            console.error('OTP not found:', otpError);
            throw new Error('Invalid verification code');
        }
        
        // Check if OTP is expired (compare BIGINT timestamps directly)
        const currentTimeMs = Date.now();
        const expiresAtMs = otpData.expires_at; // Already a number (BIGINT from database)
        const diffMinutes = (expiresAtMs - currentTimeMs) / 60000;
        
        console.log('OTP expiry check:', {
            expiresAtMs,
            expiresAtDate: new Date(expiresAtMs).toISOString(),
            currentTimeMs,
            currentDate: new Date(currentTimeMs).toISOString(),
            diffMinutes: diffMinutes.toFixed(2)
        });
        
        // If difference is negative, OTP has expired
        if (currentTimeMs > expiresAtMs) {
            const expiredMinutesAgo = Math.abs(diffMinutes).toFixed(2);
            console.error(`OTP expired ${expiredMinutesAgo} minutes ago`);
            throw new Error('Verification code has expired. Please request a new one.');
        }
        
        console.log(`✅ OTP valid for ${diffMinutes.toFixed(2)} more minutes`);
        
        // Check attempts
        if (otpData.attempts >= 5) {
            throw new Error('Too many failed attempts. Please request a new code.');
        }
        
        // Mark OTP as verified
        await window.supabaseClient
            .from('email_verifications')
            .update({ verified: true })
            .eq('id', otpData.id);
        
        // Create or update user
        const { data: existingUser } = await window.supabaseClient
            .from('users')
            .select('*')
            .eq('email', email)
            .single();
        
        let userData;
        
        if (existingUser) {
            // Update existing user
            const { data: updated, error: updateError } = await window.supabaseClient
                .from('users')
                .update({
                    email_verified: true,
                    verified_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })
                .eq('id', existingUser.id)
                .select()
                .single();
            
            if (updateError) throw updateError;
            userData = updated;
        } else {
            // Create new user
            const { data: newUser, error: createError } = await window.supabaseClient
                .from('users')
                .insert({
                    email: email,
                    student_id: studentId,
                    email_verified: true,
                    verified_at: new Date().toISOString()
                })
                .select()
                .single();
            
            if (createError) throw createError;
            userData = newUser;
        }
        
        // Save session
        saveSession(userData);
        
        return { success: true, user: userData };
    } catch (error) {
        console.error('Verify OTP error:', error);
        
        // Increment failed attempts
        try {
            // Get current attempts first
            const { data: currentOtp } = await window.supabaseClient
                .from('email_verifications')
                .select('attempts')
                .eq('email', email)
                .eq('otp', otp)
                .single();
            
            if (currentOtp) {
                await window.supabaseClient
                    .from('email_verifications')
                    .update({ attempts: (currentOtp.attempts || 0) + 1 })
                    .eq('email', email)
                    .eq('otp', otp);
            }
        } catch (e) {
            console.warn('Failed to increment attempts:', e);
        }
        
        throw error;
    }
}

// ============================================
// Resend OTP
// ============================================

async function resendOTP(email, studentId) {
    // Mark old OTPs as expired
    await window.supabaseClient
        .from('email_verifications')
        .update({ verified: true }) // Mark as used so they can't be reused
        .eq('email', email)
        .eq('verified', false);
    
    // Send new OTP
    return await sendOTP(email, studentId);
}

// ============================================
// Logout
// ============================================

function logout() {
    clearSession();
    
    // Use replace instead of reload to avoid navigation issues
    // This will reset the page to the email verification step
    window.location.href = window.location.href.split('?')[0].split('#')[0];
}

// ============================================
// Export Functions
// ============================================

window.scholarshipAuth = {
    sendOTP,
    verifyOTP,
    resendOTP,
    isLoggedIn,
    getSession,
    getUserData,
    logout,
    validateEmail,
    validateStudentId,
    showAlert
};
