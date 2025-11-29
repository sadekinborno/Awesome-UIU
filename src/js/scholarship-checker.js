// ============================================
// Scholarship Checker - Main Logic
// Handles GPA submission, ranking calculation, and results display
// ============================================

const auth = window.scholarshipAuth;

// Current user data
let currentUser = null;
let otpTimer = null;
let currentEmail = '';
let currentStudentId = '';

// ============================================
// Initialize Page
// ============================================

async function loadActiveTrimester() {
    try {
        const { data, error } = await window.supabaseClient
            .from('app_settings')
            .select('value')
            .eq('key', 'active_trimester')
            .single();
        
        if (error) throw error;
        
        const activeTrimester = data.value;
        
        // Update display
        document.getElementById('activeTrimesterDisplay').textContent = activeTrimester;
        
        // Store in hidden input for form submission
        document.getElementById('activeTrimesterValue').value = activeTrimester;
        
    } catch (error) {
        console.error('Error loading active trimester:', error);
        document.getElementById('activeTrimesterDisplay').textContent = 'Error loading trimester';
        auth.showAlert('Unable to load active trimester. Please refresh the page.', 'error');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // Load active trimester from database
    loadActiveTrimester();
    
    // Check if user is already logged in
    if (auth.isLoggedIn()) {
        currentUser = auth.getUserData();
        
        // Check if user has existing submission
        checkExistingSubmission();
    } else {
        showStep(1);
    }
    
    // Setup event listeners
    setupEventListeners();
});

// ============================================
// Event Listeners
// ============================================

function setupEventListeners() {
    // Step 1: Send OTP
    document.getElementById('sendOtpBtn').addEventListener('click', handleSendOTP);
    
    // Step 1b: Verify OTP
    document.getElementById('verifyOtpBtn').addEventListener('click', handleVerifyOTP);
    document.getElementById('resendOtpBtn').addEventListener('click', handleResendOTP);
    document.getElementById('changeEmailBtn').addEventListener('click', () => showStep(1));
    
    // OTP input auto-focus
    setupOTPInputs();
    
    // Step 2: Submit GPA
    document.getElementById('submitGpaBtn').addEventListener('click', handleSubmitGPA);
    
    // Step 3: Results actions
    document.getElementById('updateSubmissionBtn')?.addEventListener('click', () => showStep(2));
    document.getElementById('shareResultBtn')?.addEventListener('click', handleShareResult);
    
    // Student ID auto-formatting
    document.getElementById('studentIdInput').addEventListener('input', formatStudentId);
}

// ============================================
// Load Active Trimester
// ============================================

async function loadActiveTrimester() {
    try {
        const { data, error } = await window.supabaseClient
            .from('app_settings')
            .select('value')
            .eq('key', 'active_trimester')
            .single();
        
        if (error) {
            console.error('Error loading active trimester:', error);
            // Fallback to auto-detection
            const fallback = autoDetectTrimester();
            document.getElementById('activeTrimesterDisplay').textContent = fallback;
            return fallback;
        }
        
        const activeTrimester = data.value;
        
        // Update display in GPA form
        const displayElement = document.getElementById('activeTrimesterDisplay');
        if (displayElement) {
            displayElement.textContent = activeTrimester;
        }
        
        console.log('✅ Active trimester loaded:', activeTrimester);
        return activeTrimester;
        
    } catch (error) {
        console.error('Failed to load active trimester:', error);
        const fallback = autoDetectTrimester();
        const displayElement = document.getElementById('activeTrimesterDisplay');
        if (displayElement) {
            displayElement.textContent = fallback;
        }
        return fallback;
    }
}

// Helper function for fallback trimester detection
function autoDetectTrimester() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    
    if (month >= 0 && month <= 3) return `Spring ${year}`;
    else if (month >= 4 && month <= 7) return `Summer ${year}`;
    else return `Fall ${year}`;
}

function setupOTPInputs() {
    const otpInputs = document.querySelectorAll('.otp-input');
    
    otpInputs.forEach((input, index) => {
        input.addEventListener('input', (e) => {
            if (e.target.value.length === 1 && index < otpInputs.length - 1) {
                otpInputs[index + 1].focus();
            }
        });
        
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && e.target.value === '' && index > 0) {
                otpInputs[index - 1].focus();
            }
        });
        
        // Only allow numbers
        input.addEventListener('keypress', (e) => {
            if (!/[0-9]/.test(e.key)) {
                e.preventDefault();
            }
        });
    });
}

function formatStudentId(e) {
    let value = e.target.value.replace(/[^0-9]/g, '');
    
    // Format: XXX-XXX-XXX or XXX-XXX-XXXX
    // Department (3) - Semester (3) - ID (3 or 4)
    if (value.length > 3) value = value.slice(0, 3) + '-' + value.slice(3);
    if (value.length > 7) value = value.slice(0, 7) + '-' + value.slice(7);
    
    // Allow 9 or 10 digits total (3-3-3 or 3-3-4)
    if (value.length > 12) value = value.slice(0, 12); // Max: XXX-XXX-XXXX
    
    e.target.value = value;
}

// ============================================
// Step Navigation
// ============================================

function showStep(stepNumber) {
    // Update progress steps
    for (let i = 1; i <= 3; i++) {
        const step = document.getElementById(`step${i}Indicator`);
        if (i < stepNumber) {
            step.classList.add('completed');
            step.classList.remove('active');
        } else if (i === stepNumber) {
            step.classList.add('active');
            step.classList.remove('completed');
        } else {
            step.classList.remove('active', 'completed');
        }
    }
    
    // Hide all cards
    document.getElementById('emailVerificationCard').classList.add('hidden');
    document.getElementById('otpVerificationCard').classList.add('hidden');
    document.getElementById('gpaSubmissionCard').classList.add('hidden');
    document.getElementById('resultsCard').classList.add('hidden');
    
    // Show appropriate card
    switch (stepNumber) {
        case 1:
            document.getElementById('emailVerificationCard').classList.remove('hidden');
            break;
        case 2:
            document.getElementById('gpaSubmissionCard').classList.remove('hidden');
            if (currentUser) {
                document.getElementById('verifiedEmail').textContent = currentUser.email;
            }
            break;
        case 3:
            document.getElementById('resultsCard').classList.remove('hidden');
            break;
    }
}

// ============================================
// Handle Send OTP
// ============================================

async function handleSendOTP() {
    const email = document.getElementById('emailInput').value.trim();
    const studentId = document.getElementById('studentIdInput').value.trim();
    const btn = document.getElementById('sendOtpBtn');
    const btnText = document.getElementById('sendOtpText');
    const spinner = document.getElementById('sendOtpSpinner');
    
    // Clear previous errors
    document.getElementById('emailInput').classList.remove('error');
    document.getElementById('studentIdInput').classList.remove('error');
    
    // Validate
    if (!auth.validateEmail(email)) {
        document.getElementById('emailInput').classList.add('error');
        auth.showAlert('Please enter a valid UIU email address', 'error');
        return;
    }
    
    if (!auth.validateStudentId(studentId)) {
        document.getElementById('studentIdInput').classList.add('error');
        auth.showAlert('Please enter a valid Student ID (format: XXX-XXX-XXX)', 'error');
        return;
    }
    
    // Show loading
    btn.disabled = true;
    btnText.textContent = 'Sending...';
    spinner.classList.remove('hidden');
    
    try {
        const result = await auth.sendOTP(email, studentId);
        
        if (result.success) {
            currentEmail = email;
            currentStudentId = studentId;
            
            // Show OTP card
            document.getElementById('emailVerificationCard').classList.add('hidden');
            document.getElementById('otpVerificationCard').classList.remove('hidden');
            document.getElementById('sentToEmail').textContent = email;
            
            // Start timer
            startOTPTimer(300); // 5 minutes
            
            // Focus first OTP input
            document.getElementById('otp1').focus();
            
            auth.showAlert('Verification code sent! Check your email.', 'success');
            
            // For testing: show OTP in console
            if (result.otp) {
                console.log('🔐 TEST OTP:', result.otp);
                auth.showAlert(`TEST MODE: Your OTP is ${result.otp}`, 'info');
            }
        }
    } catch (error) {
        auth.showAlert(error.message || 'Failed to send verification code', 'error');
    } finally {
        btn.disabled = false;
        btnText.textContent = 'Send Verification Code';
        spinner.classList.add('hidden');
    }
}

// ============================================
// Handle Verify OTP
// ============================================

async function handleVerifyOTP() {
    const otp = Array.from({length: 6}, (_, i) => 
        document.getElementById(`otp${i + 1}`).value
    ).join('');
    
    if (otp.length !== 6) {
        auth.showAlert('Please enter the complete 6-digit code', 'error');
        return;
    }
    
    const btn = document.getElementById('verifyOtpBtn');
    const btnText = document.getElementById('verifyOtpText');
    const spinner = document.getElementById('verifyOtpSpinner');
    
    btn.disabled = true;
    btnText.textContent = 'Verifying...';
    spinner.classList.remove('hidden');
    
    try {
        const result = await auth.verifyOTP(currentEmail, currentStudentId, otp);
        
        if (result.success) {
            currentUser = result.user;
            
            // Stop timer
            if (otpTimer) clearInterval(otpTimer);
            
            auth.showAlert('Email verified successfully! ✅', 'success');
            
            // Wait a moment then show GPA form
            setTimeout(() => showStep(2), 1000);
        }
    } catch (error) {
        auth.showAlert(error.message || 'Invalid verification code', 'error');
        
        // Clear OTP inputs
        for (let i = 1; i <= 6; i++) {
            document.getElementById(`otp${i}`).value = '';
        }
        document.getElementById('otp1').focus();
    } finally {
        btn.disabled = false;
        btnText.textContent = 'Verify Code';
        spinner.classList.add('hidden');
    }
}

// ============================================
// Handle Resend OTP
// ============================================

async function handleResendOTP() {
    const btn = document.getElementById('resendOtpBtn');
    btn.disabled = true;
    btn.textContent = 'Sending...';
    
    try {
        await auth.resendOTP(currentEmail, currentStudentId);
        auth.showAlert('New verification code sent!', 'success');
        
        // Restart timer
        startOTPTimer(300);
        
        // Clear inputs
        for (let i = 1; i <= 6; i++) {
            document.getElementById(`otp${i}`).value = '';
        }
        document.getElementById('otp1').focus();
    } catch (error) {
        auth.showAlert(error.message || 'Failed to resend code', 'error');
    } finally {
        setTimeout(() => {
            btn.disabled = false;
            btn.textContent = "Didn't receive the code? Resend";
        }, 5000);
    }
}

// ============================================
// OTP Timer
// ============================================

function startOTPTimer(seconds) {
    if (otpTimer) clearInterval(otpTimer);
    
    let remaining = seconds;
    const timerDisplay = document.getElementById('timerDisplay');
    const timerElement = document.getElementById('otpTimer');
    
    const updateTimer = () => {
        const minutes = Math.floor(remaining / 60);
        const secs = remaining % 60;
        timerDisplay.textContent = `${minutes}:${secs.toString().padStart(2, '0')}`;
        
        if (remaining <= 60) {
            timerElement.classList.add('urgent');
        }
        
        if (remaining <= 0) {
            clearInterval(otpTimer);
            timerDisplay.textContent = 'Expired';
            auth.showAlert('Verification code expired. Please request a new one.', 'error');
        }
        
        remaining--;
    };
    
    updateTimer();
    otpTimer = setInterval(updateTimer, 1000);
}

// ============================================
// Check Existing Submission
// ============================================

async function checkExistingSubmission() {
    // Check if user has submitted for any trimester
    const { data, error } = await window.supabaseClient
        .from('scholarship_submissions')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('submitted_at', { ascending: false })
        .limit(1);
    
    if (data && data.length > 0) {
        // User has existing submission, show results
        await displayResults(data[0]);
        showStep(3);
    } else {
        // No submission, show GPA form
        showStep(2);
    }
}

// ============================================
// Handle Submit GPA
// ============================================

async function handleSubmitGPA() {
    const department = document.getElementById('departmentSelect').value;
    const trimester = document.getElementById('activeTrimesterDisplay')?.textContent?.trim();
    const lastGpa = parseFloat(document.getElementById('lastGpaInput').value);
    const cgpa = parseFloat(document.getElementById('cgpaInput').value);
    
    // Validate
    let hasError = false;
    
    if (!department) {
        auth.showAlert('Please select a department', 'error');
        hasError = true;
    }
    
    if (!trimester) {
        auth.showAlert('Active trimester not loaded. Please refresh the page.', 'error');
        hasError = true;
    }
    
    if (!lastGpa || lastGpa < 0 || lastGpa > 4.0) {
        document.getElementById('lastGpaInput').classList.add('error');
        hasError = true;
    }
    
    if (!cgpa || cgpa < 0 || cgpa > 4.0) {
        document.getElementById('cgpaInput').classList.add('error');
        hasError = true;
    }
    
    if (hasError) {
        auth.showAlert('Please fill in all fields correctly', 'error');
        return;
    }
    
    const btn = document.getElementById('submitGpaBtn');
    const btnText = document.getElementById('submitGpaText');
    const spinner = document.getElementById('submitGpaSpinner');
    
    btn.disabled = true;
    btnText.textContent = 'Calculating...';
    spinner.classList.remove('hidden');
    
    try {
        // Submit to database
        const { data: submission, error } = await window.supabaseClient
            .from('scholarship_submissions')
            .upsert({
                user_id: currentUser.id,
                student_id: currentUser.student_id,
                email: currentUser.email,
                department: department,
                trimester: trimester,
                last_trimester_gpa: lastGpa,
                overall_cgpa: cgpa,
                submitted_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'user_id,trimester,department'
            })
            .select()
            .single();
        
        if (error) throw error;
        
        // Calculate rank and display results
        await displayResults(submission);
        showStep(3);
        
        auth.showAlert('Scholarship calculated successfully! 🎉', 'success');
    } catch (error) {
        console.error('Submit GPA error:', error);
        auth.showAlert(error.message || 'Failed to submit GPA', 'error');
    } finally {
        btn.disabled = false;
        btnText.textContent = 'Calculate My Scholarship';
        spinner.classList.add('hidden');
    }
}

// ============================================
// Calculate Rank and Display Results
// ============================================

async function displayResults(submission) {
    // Get all submissions for this department/trimester
    const { data: allSubmissions, error } = await window.supabaseClient
        .from('scholarship_submissions')
        .select('last_trimester_gpa, overall_cgpa, submitted_at')
        .eq('department', submission.department)
        .eq('trimester', submission.trimester)
        .order('last_trimester_gpa', { ascending: false })
        .order('overall_cgpa', { ascending: false })
        .order('submitted_at', { ascending: true });
    
    if (error) {
        console.error('Fetch submissions error:', error);
        return;
    }
    
    const totalStudents = allSubmissions.length;
    
    // Calculate position (how many students are better)
    let betterStudents = 0;
    for (const student of allSubmissions) {
        if (student.last_trimester_gpa > submission.last_trimester_gpa) {
            betterStudents++;
        } else if (student.last_trimester_gpa === submission.last_trimester_gpa) {
            if (student.overall_cgpa > submission.overall_cgpa) {
                betterStudents++;
            } else if (student.overall_cgpa === submission.overall_cgpa) {
                if (new Date(student.submitted_at) < new Date(submission.submitted_at)) {
                    betterStudents++;
                }
            }
        }
    }
    
    const position = betterStudents + 1;
    let percentileRank = (betterStudents / totalStudents) * 100;
    
    // Handle edge case: if student is rank 1, show as "Top 0%" or very small percentage
    if (position === 1 && totalStudents === 1) {
        percentileRank = 0; // Only student, show as top
    } else if (position === 1) {
        percentileRank = (1 / totalStudents) * 100; // Show realistic top percentage
    }
    
    // Determine scholarship tier
    let scholarship = 0;
    let tierClass = 'tier-0';
    
    if (percentileRank < 2) {
        scholarship = 100;
        tierClass = 'tier-100';
    } else if (percentileRank < 6) {
        scholarship = 50;
        tierClass = 'tier-50';
    } else if (percentileRank < 10) {
        scholarship = 25;
        tierClass = 'tier-25';
    }
    
    // Get thresholds
    const top2Index = Math.max(0, Math.floor(totalStudents * 0.02) - 1);
    const top6Index = Math.max(0, Math.floor(totalStudents * 0.06) - 1);
    const top10Index = Math.max(0, Math.floor(totalStudents * 0.10) - 1);
    
    // Count students in each tier
    const tier100Count = Math.ceil(totalStudents * 0.02);
    const tier50Count = Math.ceil(totalStudents * 0.04);
    const tier25Count = Math.ceil(totalStudents * 0.04);
    const tier0Count = totalStudents - tier100Count - tier50Count - tier25Count;
    
    // Display hero section
    document.getElementById('resultDept').textContent = submission.department;
    document.getElementById('resultTrimester').textContent = submission.trimester;
    document.getElementById('totalSubmissions').textContent = totalStudents;
    
    // Display rank
    const rankText = percentileRank === 0 ? 'Top Student' : 
                     percentileRank < 1 ? `Top ${percentileRank.toFixed(2)}%` : 
                     `Top ${percentileRank.toFixed(1)}%`;
    document.getElementById('rankPercentage').textContent = rankText;
    document.getElementById('rankPosition').textContent = `#${position} out of ${totalStudents} students`;
    
    // Display scholarship card
    const scholarshipCard = document.getElementById('scholarshipCard');
    const scholarshipPercentEl = document.getElementById('scholarshipPercent');
    const scholarshipIconEl = document.getElementById('scholarshipIcon');
    
    if (scholarship === 0) {
        scholarshipPercentEl.textContent = 'No Scholarship';
        scholarshipPercentEl.style.fontSize = '1.75rem';
        if (scholarshipIconEl) scholarshipIconEl.textContent = '📚'; // Book icon for no scholarship
    } else {
        scholarshipPercentEl.textContent = `${scholarship}%`;
        scholarshipPercentEl.style.fontSize = '3rem';
        if (scholarshipIconEl) scholarshipIconEl.textContent = '🎓'; // Graduation cap for scholarship
    }
    
    scholarshipCard.className = `scholarship-card ${tierClass}`;
    
    // Update progress bar
    document.getElementById('progressBarFill').style.width = `${percentileRank}%`;
    document.getElementById('progressMarker').style.left = `${percentileRank}%`;
    
    // Statistics
    const avgLastGpa = allSubmissions.reduce((sum, s) => sum + parseFloat(s.last_trimester_gpa), 0) / totalStudents;
    const highestGpa = Math.max(...allSubmissions.map(s => parseFloat(s.last_trimester_gpa)));
    
    document.getElementById('yourLastGPA').textContent = parseFloat(submission.last_trimester_gpa).toFixed(2);
    document.getElementById('yourCGPA').textContent = parseFloat(submission.overall_cgpa).toFixed(2);
    document.getElementById('avgLastGPA').textContent = avgLastGpa.toFixed(2);
    document.getElementById('highestGPA').textContent = highestGpa.toFixed(2);
    
    // Tier breakdown
    document.getElementById('tier100Count').textContent = tier100Count;
    document.getElementById('tier50Count').textContent = tier50Count;
    document.getElementById('tier25Count').textContent = tier25Count;
    document.getElementById('tier0Count').textContent = tier0Count;
    
    document.getElementById('tier100Bar').style.width = `${(tier100Count / totalStudents) * 100}%`;
    document.getElementById('tier50Bar').style.width = `${(tier50Count / totalStudents) * 100}%`;
    document.getElementById('tier25Bar').style.width = `${(tier25Count / totalStudents) * 100}%`;
    document.getElementById('tier0Bar').style.width = `${(tier0Count / totalStudents) * 100}%`;
    
    // Highlight current tier
    document.querySelectorAll('.tier-item').forEach(item => item.classList.remove('current'));
    if (scholarship === 100) {
        document.getElementById('tier100').classList.add('current');
    } else if (scholarship === 50) {
        document.getElementById('tier50').classList.add('current');
    } else if (scholarship === 25) {
        document.getElementById('tier25').classList.add('current');
    } else {
        document.getElementById('tier0').classList.add('current');
    }
    
    // Update threshold details
    if (allSubmissions[top2Index]) {
        const threshold = allSubmissions[top2Index].last_trimester_gpa;
        document.getElementById('tier100Details').innerHTML = 
            `Last GPA ≥ <span class="threshold">${threshold}</span>`;
    }
    
    if (allSubmissions[top6Index]) {
        const threshold = allSubmissions[top6Index].last_trimester_gpa;
        document.getElementById('tier50Details').innerHTML = 
            `Last GPA ≥ <span class="threshold">${threshold}</span>`;
    }
    
    if (allSubmissions[top10Index]) {
        const threshold = allSubmissions[top10Index].last_trimester_gpa;
        document.getElementById('tier25Details').innerHTML = 
            `Last GPA ≥ <span class="threshold">${threshold}</span>`;
    }
}

// ============================================
// Handle Share Result
// ============================================

function handleShareResult() {
    const rankText = document.getElementById('rankPercentage').textContent;
    const scholarshipPercent = document.getElementById('scholarshipPercent').textContent;
    
    const shareText = `I just checked my scholarship probability at The Awesome UIU!\n\nMy rank: ${rankText}\nScholarship: ${scholarshipPercent}\n\nCheck yours at: https://theawesomeuiu.netlify.app/scholarship-checker.html`;
    
    if (navigator.share) {
        navigator.share({
            title: 'My UIU Scholarship Estimate',
            text: shareText
        });
    } else {
        navigator.clipboard.writeText(shareText);
        auth.showAlert('Result copied to clipboard!', 'success');
    }
}
