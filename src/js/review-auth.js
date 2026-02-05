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
    const emailRegex = /^[^\s@]+@([a-z0-9-]+\.)*uiu\.ac\.bd$/i;
    return emailRegex.test(email);
}

function normalizeEmail(rawValue, defaultSuffix = '.uiu.ac.bd') {
    const raw = String(rawValue ?? '').trim().toLowerCase();
    if (!raw) return '';

    // If the user pasted something with multiple '@', keep first local-part and last domain.
    const atParts = raw.split('@').filter(Boolean);
    if (!raw.includes('@')) {
        // We can't safely infer the department/program part; return as-is and let validation explain.
        return raw;
    }

    const localPart = atParts[0] ?? '';
    const domainPart = atParts.length > 1 ? atParts[atParts.length - 1] : '';
    if (!localPart || !domainPart) return raw;

    // If they already provided a full UIU domain, keep it.
    if (/uiu\.ac\.bd$/.test(domainPart)) {
        return `${localPart}@${domainPart}`;
    }

    // If they typed only the subdomain (e.g., abc@bscse), append .uiu.ac.bd.
    const suffix = defaultSuffix.startsWith('.') ? defaultSuffix : `.${defaultSuffix}`;
    return `${localPart}@${domainPart}${suffix}`;
}

function extractStudentIdFromEmail(email) {
    const normalized = normalizeEmail(email);
    const localPart = normalized.split('@')[0] ?? '';
    const digits = localPart.replace(/\D/g, '');
    return digits.length ? digits : null;
}

function createUuid() {
    try {
        if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
            return crypto.randomUUID();
        }
    } catch {
        // ignore
    }
    // Fallback (non-crypto)
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

function toEpochMs(value) {
    if (value === null || value === undefined) return null;
    if (typeof value === 'number') return value;
    const parsed = Date.parse(String(value));
    return Number.isNaN(parsed) ? null : parsed;
}

function isRlsViolation(error) {
    const msg = String(error?.message ?? error?.error_description ?? '').toLowerCase();
    return msg.includes('row-level security') || msg.includes('rls') || String(error?.code ?? '') === '42501';
}

function validateStudentId(id) {
    const digitsOnly = id.replace(/\D/g, '');
    if (digitsOnly.length !== 9 && digitsOnly.length !== 10) {
        return false;
    }
    const pattern = /^\d{3}-?\d{3}-?\d{3,4}$/;
    return pattern.test(id) || /^\d{9,10}$/.test(digitsOnly);
}

function getLast3Digits(value) {
    const digitsOnly = String(value ?? '').replace(/\D/g, '');
    if (digitsOnly.length < 3) return null;
    return digitsOnly.slice(-3);
}

function validateEmailStudentIdLast3Match(email, studentId) {
    const localPart = String(email ?? '').split('@')[0] ?? '';
    const emailLast3 = getLast3Digits(localPart);
    const idLast3 = getLast3Digits(studentId);
    return emailLast3 !== null && idLast3 !== null && emailLast3 === idLast3;
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

function getDbClient() {
    // Prefer a client that does NOT attach Supabase Auth sessions.
    // If a user previously logged into the admin panel, the default client can send an
    // access token which changes the DB role to `authenticated` and can break anon-only RLS.
    return window.supabasePublicClient || window.supabaseClient;
}

async function checkRateLimit(ip, actionType) {
    try {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
        
        const { data, error } = await getDbClient()
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
    const { data: existing } = await getDbClient()
        .from('rate_limits')
        .select('*')
        .eq('ip_address', ip)
        .eq('action_type', actionType)
        .gte('window_start', new Date(Date.now() - 3600000).toISOString())
        .maybeSingle();
    
    if (existing) {
        await getDbClient()
            .from('rate_limits')
            .update({ attempts: existing.attempts + 1 })
            .eq('id', existing.id);
    } else {
        await getDbClient()
            .from('rate_limits')
            .insert({
                id: createUuid(),
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

async function sendOTP(email) {
    try {
        const normalizedEmail = normalizeEmail(email);

        if (!validateEmail(normalizedEmail)) {
            throw new Error('Please enter a valid UIU email address (ends with uiu.ac.bd)');
    }
    // Only email is required for OTP now
        const clientIP = getClientIP();
        const rateCheck = await checkRateLimit(clientIP, 'review_otp');
        if (!rateCheck.allowed) {
            throw new Error(rateCheck.message);
        }
        const otp = generateOTP();
        const expiresAtMs = Date.now() + 5 * 60 * 1000; // 5 minutes from now
        const expiresAtIso = new Date(expiresAtMs).toISOString();
        const cleanEmail = normalizedEmail.toLowerCase();

        const derivedStudentId = extractStudentIdFromEmail(cleanEmail);
        if (!derivedStudentId) {
            throw new Error('Your email must include your numeric student ID (e.g., name2430320@bscse.uiu.ac.bd).');
        }

        // Delete any existing OTP for this email first
        await getDbClient()
            .from('email_verifications')
            .delete()
            .eq('email', cleanEmail);

        // Insert new OTP (support both BIGINT and TIMESTAMP schemas)
        const insertPayloadBase = {
            id: createUuid(),
            email: cleanEmail,
            student_id: derivedStudentId,
            otp: otp,
            attempts: 0,
            verified: false
        };

        let insertError;
        // Try BIGINT first (this repo's live schema uses bigint milliseconds)
        ({ error: insertError } = await getDbClient()
            .from('email_verifications')
            .insert({ ...insertPayloadBase, expires_at: expiresAtMs }));

        if (insertError) {
            const msg = String(insertError?.message ?? '').toLowerCase();
            // If the column is TIMESTAMP, BIGINT insert can fail; retry with ISO.
            if (msg.includes('timestamp') || msg.includes('time zone') || msg.includes('date/time')) {
                ({ error: insertError } = await getDbClient()
                    .from('email_verifications')
                    .insert({ ...insertPayloadBase, expires_at: expiresAtIso }));
            }
        }

        if (insertError) {
            console.error('Insert error details:', insertError);
            if (isRlsViolation(insertError) || String(insertError?.status ?? '') === '403') {
                throw new Error('Database RLS/permissions blocked OTP creation. Admin: re-run fix-rls-policies.sql in Supabase SQL Editor (includes required GRANTs + policies).');
            }
            throw new Error('Failed to create verification request. Please try again.');
        }
        // Send OTP email via Edge Function
        const { data: emailData, error: emailError } = await getDbClient().functions.invoke('send-otp-email', {
            body: {
                email: cleanEmail,
                otp: otp
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

async function verifyOTP(email, otp) {
    try {
        const normalizedEmail = normalizeEmail(email);
    // Only email is required for OTP verification now
        if (!validateEmail(normalizedEmail)) {
            throw new Error('Please enter a valid UIU email address (ends with uiu.ac.bd)');
        }

        const derivedStudentId = extractStudentIdFromEmail(normalizedEmail);
        if (!derivedStudentId) {
            throw new Error('Could not extract Student ID from email. Please use an email that contains your numeric student ID (e.g., name2430320@bscse.uiu.ac.bd).');
        }

        // Get verification record
        const { data: verification, error: fetchError } = await getDbClient()
            .from('email_verifications')
            .select('*')
            .eq('email', normalizedEmail)
            .eq('student_id', derivedStudentId)
            .eq('verified', false)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
        if (fetchError || !verification) {
            throw new Error('No pending verification found. Please request a new OTP.');
        }

        // Check if expired (supports TIMESTAMP or BIGINT)
        const expiresAt = toEpochMs(verification.expires_at);
        if (expiresAt !== null && expiresAt < Date.now()) {
            throw new Error('OTP has expired. Please request a new one.');
        }
        // Check attempts
        if (verification.attempts >= 5) {
            throw new Error('Too many failed attempts. Please request a new OTP.');
        }
        // Verify OTP
        if (verification.otp !== otp) {
            // Increment attempts
            await getDbClient()
                .from('email_verifications')
                .update({ attempts: verification.attempts + 1 })
                .eq('id', verification.id);
            throw new Error(`Invalid OTP. ${4 - verification.attempts} attempts remaining.`);
        }
        // Mark as verified
        await getDbClient()
            .from('email_verifications')
            .update({ 
                verified: true,
                attempts: verification.attempts + 1 
            })
            .eq('id', verification.id);

        // Create or update user
        const { data: existingUser } = await getDbClient()
            .from('users')
            .select('*')
            .eq('email', normalizedEmail)
            .maybeSingle();
        let userData;
        if (existingUser) {
            // Update existing user
            const { data: updated, error: updateError } = await getDbClient()
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
            const { data: newUser, error: insertError } = await getDbClient()
                .from('users')
                .insert({
                    id: createUuid(),
                    email: normalizedEmail,
                    student_id: derivedStudentId,
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

        if (isRlsViolation(error)) {
            throw new Error(
                'Login blocked by database Row Level Security (RLS). Admin: run the updated RLS script (fix-rls-policies.sql) in Supabase SQL editor to allow anon access for users/rate_limits/email_verifications.'
            );
        }
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
        clearSession,
        normalizeEmail,
        extractStudentIdFromEmail
    };
}
