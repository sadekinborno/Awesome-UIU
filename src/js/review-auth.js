// ============================================
// Teacher Review System - Authentication Logic
// Handles OTP generation, verification, and session management
// ============================================

// Session storage keys
const REVIEW_SESSION_KEY = 'review_session';
const REVIEW_USER_KEY = 'review_user';

// ============================================
// Utility Functions
// ============================================

function showAlert(message, type = 'info') {
    const alertContainer = document.getElementById('alertContainer');
    if (!alertContainer) {
        alert(message);
        return;
    }
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} show`;
    alertDiv.textContent = message;
    alertContainer.appendChild(alertDiv);
    
    setTimeout(() => {
        alertDiv.classList.remove('show');
        setTimeout(() => alertDiv.remove(), 300);
    }, 5000);
}

function validateEmail(email) {
    // Accept any UIU email subdomain
    const emailRegex = /^[^\s@]+@([a-z]+\.)?uiu\.ac\.bd$/i;
    return emailRegex.test(email);
}

function validateStudentId(id) {
    const digitsOnly = id.replace(/\D/g, '');
    if (digitsOnly.length !== 9 && digitsOnly.length !== 10) {
        return false;
    }
    const pattern = /^\d{3}-?\d{3}-?\d{3,4}$/;
    return pattern.test(id) || /^\d{9,10}$/.test(digitsOnly);
}

function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

function getClientIP() {
    return 'client_ip_' + Date.now();
}

// ============================================
// Session Management
// ============================================

function saveSession(userData) {
    const sessionData = {
        userId: userData.id,
        email: userData.email,
        studentId: userData.student_id,
        verifiedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days
    };
    localStorage.setItem(REVIEW_SESSION_KEY, JSON.stringify(sessionData));
    localStorage.setItem(REVIEW_USER_KEY, JSON.stringify(userData));
    
    // Also save in scholarship auth format for cross-compatibility
    const scholarshipSessionData = {
        userId: userData.id,
        email: userData.email,
        studentId: userData.student_id,
        verifiedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    };
    localStorage.setItem('scholarship_session', JSON.stringify(scholarshipSessionData));
    localStorage.setItem('scholarship_user', JSON.stringify(userData));
}

function getSession() {
    try {
        const session = localStorage.getItem(REVIEW_SESSION_KEY);
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
        const userData = localStorage.getItem(REVIEW_USER_KEY);
        return userData ? JSON.parse(userData) : null;
    } catch (error) {
        console.error('Error reading user data:', error);
        return null;
    }
}

function clearSession() {
    localStorage.removeItem(REVIEW_SESSION_KEY);
    localStorage.removeItem(REVIEW_USER_KEY);
    // Also clear scholarship auth for cross-compatibility
    localStorage.removeItem('scholarship_session');
    localStorage.removeItem('scholarship_user');
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
        
        const { data, error } = await supabase
            .from('rate_limits')
            .select('*')
            .eq('ip_address', ip)
            .eq('action_type', actionType)
            .gte('window_start', oneHourAgo);
        
        if (error) {
            console.warn('Rate limit check failed, allowing:', error);
            return { allowed: true };
        }
        
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
    const { data: existing } = await supabase
        .from('rate_limits')
        .select('*')
        .eq('ip_address', ip)
        .eq('action_type', actionType)
        .gte('window_start', new Date(Date.now() - 3600000).toISOString())
        .single();
    
    if (existing) {
        await supabase
            .from('rate_limits')
            .update({ attempts: existing.attempts + 1 })
            .eq('id', existing.id);
    } else {
        await supabase
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
        if (!validateEmail(email)) {
            throw new Error('Please enter a valid UIU email address (@uiu.ac.bd)');
        }
        
        if (!validateStudentId(studentId)) {
            throw new Error('Please enter a valid Student ID (9-10 digits)');
        }
        
        const clientIP = getClientIP();
        const rateCheck = await checkRateLimit(clientIP, 'review_otp');
        if (!rateCheck.allowed) {
            throw new Error(rateCheck.message);
        }
        
        const otp = generateOTP();
        const expiresAtMs = Date.now() + 5 * 60 * 1000; // 5 minutes from now in milliseconds
        const cleanStudentId = studentId.replace(/\D/g, '');
        const cleanEmail = email.toLowerCase();
        
        // Delete any existing OTP for this email first
        await supabase
            .from('email_verifications')
            .delete()
            .eq('email', cleanEmail);
        
        // Insert new OTP
        const { error: insertError } = await supabase
            .from('email_verifications')
            .insert({
                email: cleanEmail,
                student_id: cleanStudentId,
                otp: otp,
                expires_at: expiresAtMs,
                attempts: 0,
                verified: false
            });
        
        if (insertError) {
            console.error('Insert error details:', insertError);
            throw new Error('Failed to create verification request. Please try again.');
        }
        
        // Send OTP email via Edge Function
        const { data: emailData, error: emailError } = await supabase.functions.invoke('send-otp-email', {
            body: {
                email: cleanEmail,
                otp: otp,
                studentId: cleanStudentId
            }
        });
        
        if (emailError) {
            console.error('Email sending failed:', emailError);
            // Don't fail completely if email service is down - OTP is still in DB
            console.warn('⚠️ Email service unavailable. OTP stored in database.');
            
            // Show OTP in alert as fallback
            alert(`⚠️ Email service is temporarily unavailable.\n\nYour OTP code is: ${otp}\n\nPlease use this code to verify your email.`);
            
            await incrementRateLimit(clientIP, 'review_otp');
            
            return { 
                success: true, 
                message: `OTP: ${otp} (Email service unavailable)`,
                fallback: true,
                otp: otp
            };
        }
        
        await incrementRateLimit(clientIP, 'review_otp');
        
        return { success: true, message: 'OTP sent to your email!' };
    } catch (error) {
        console.error('Send OTP error:', error);
        throw error;
    }
}

// ============================================
// Verify OTP
// ============================================

async function verifyOTP(email, studentId, otp) {
    try {
        const normalizedEmail = email.toLowerCase();
        const normalizedStudentId = studentId.replace(/\D/g, '');
        
        // Get verification record
        const { data: verification, error: fetchError } = await supabase
            .from('email_verifications')
            .select('*')
            .eq('email', normalizedEmail)
            .eq('student_id', normalizedStudentId)
            .eq('verified', false)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
        
        if (fetchError || !verification) {
            throw new Error('No pending verification found. Please request a new OTP.');
        }
        
        // Check if expired (expires_at is stored as bigint milliseconds)
        if (verification.expires_at < Date.now()) {
            throw new Error('OTP has expired. Please request a new one.');
        }
        
        // Check attempts
        if (verification.attempts >= 5) {
            throw new Error('Too many failed attempts. Please request a new OTP.');
        }
        
        // Verify OTP
        if (verification.otp !== otp) {
            // Increment attempts
            await supabase
                .from('email_verifications')
                .update({ attempts: verification.attempts + 1 })
                .eq('id', verification.id);
            
            throw new Error(`Invalid OTP. ${4 - verification.attempts} attempts remaining.`);
        }
        
        // Mark as verified
        await supabase
            .from('email_verifications')
            .update({ 
                verified: true,
                attempts: verification.attempts + 1 
            })
            .eq('id', verification.id);
        
        // Create or update user
        const { data: existingUser } = await supabase
            .from('users')
            .select('*')
            .eq('email', normalizedEmail)
            .single();
        
        let userData;
        
        if (existingUser) {
            // Update existing user
            const { data: updated, error: updateError } = await supabase
                .from('users')
                .update({ 
                    email_verified: true,
                    verified_at: new Date().toISOString()
                })
                .eq('id', existingUser.id)
                .select()
                .single();
            
            if (updateError) throw updateError;
            userData = updated;
        } else {
            // Create new user
            const { data: newUser, error: insertError } = await supabase
                .from('users')
                .insert({
                    email: normalizedEmail,
                    student_id: normalizedStudentId,
                    email_verified: true,
                    verified_at: new Date().toISOString()
                })
                .select()
                .single();
            
            if (insertError) throw insertError;
            userData = newUser;
        }
        
        // Save session
        saveSession(userData);
        
        return { success: true, userData };
    } catch (error) {
        console.error('Verify OTP error:', error);
        throw error;
    }
}

// ============================================
// Logout
// ============================================

function logout() {
    clearSession();
    window.location.href = 'review-login.html';
}

// ============================================
// Auth Check for Protected Pages
// ============================================

function requireAuth() {
    if (!isLoggedIn()) {
        const currentPage = window.location.pathname.split('/').pop();
        window.location.href = `review-login.html?redirect=${encodeURIComponent(currentPage + window.location.search)}`;
        return false;
    }
    return true;
}

// Export for use in other files
if (typeof window !== 'undefined') {
    window.reviewAuth = {
        sendOTP,
        verifyOTP,
        logout,
        isLoggedIn,
        getSession,
        getUserData,
        requireAuth,
        saveSession,
        clearSession
    };
}
