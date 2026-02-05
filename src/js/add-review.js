// Add Review Page Logic
let selectedTeacherId = null;
let selectedCourseCode = null;

// Initialize page
document.addEventListener('DOMContentLoaded', async () => {
    // Check if teacher ID is in URL (coming from profile page)
    const urlParams = new URLSearchParams(window.location.search);
    const teacherIdFromUrl = urlParams.get('teacher');
    
    if (teacherIdFromUrl) {
        await preloadTeacher(teacherIdFromUrl);
    }

    setupEventListeners();
});

// Preload teacher if coming from profile
async function preloadTeacher(teacherId) {
    try {
        const { data: teacher, error } = await window.supabaseClient
            .from('teachers')
            .select('id, name, department')
            .eq('id', teacherId)
            .single();

        if (error) throw error;

        // Set department and load teachers
        document.getElementById('departmentSelect').value = teacher.department;
        await loadTeachersForDepartment(teacher.department);
        
        // Select the teacher
        document.getElementById('teacherSelect').value = teacherId;
        selectedTeacherId = teacherId;
        
        // Load courses for this teacher
        await loadCoursesForTeacher(teacherId);
        
        // Show preview
        showTeacherPreview(teacher.name, teacher.department);

    } catch (error) {
        console.error('Error preloading teacher:', error);
    }
}

// Setup event listeners
function setupEventListeners() {
    // Department selection
    document.getElementById('departmentSelect').addEventListener('change', async (e) => {
        const department = e.target.value;
        if (department) {
            await loadTeachersForDepartment(department);
        } else {
            document.getElementById('teacherSelect').disabled = true;
            document.getElementById('teacherSelect').innerHTML = '<option value="">Select department first</option>';
            document.getElementById('courseSelect').disabled = true;
            document.getElementById('courseSelect').innerHTML = '<option value="">Select teacher first</option>';
            hideTeacherPreview();
        }
    });

    // Teacher selection
    document.getElementById('teacherSelect').addEventListener('change', async (e) => {
        selectedTeacherId = e.target.value;
        if (selectedTeacherId) {
            await loadCoursesForTeacher(selectedTeacherId);
            const teacherName = e.target.options[e.target.selectedIndex].text;
            const department = document.getElementById('departmentSelect').value;
            showTeacherPreview(teacherName, department);
        } else {
            document.getElementById('courseSelect').disabled = true;
            document.getElementById('courseSelect').innerHTML = '<option value="">Select teacher first</option>';
            hideTeacherPreview();
        }
    });

    // Course selection
    document.getElementById('courseSelect').addEventListener('change', (e) => {
        selectedCourseCode = e.target.value;
    });

    // Slider updates
    ['teaching', 'grading', 'approachability', 'punctuality'].forEach(category => {
        const slider = document.getElementById(`${category}Slider`);
        const valueDisplay = document.getElementById(`${category}Value`);
        slider.addEventListener('input', (e) => {
            valueDisplay.textContent = e.target.value;
        });
    });

    // Character count
    document.getElementById('reviewText').addEventListener('input', (e) => {
        document.getElementById('charCount').textContent = e.target.value.length;
    });

    // Form submission
    document.getElementById('reviewForm').addEventListener('submit', handleSubmit);
}

// Load teachers for selected department
async function loadTeachersForDepartment(department) {
    try {
        const { data: teachers, error } = await window.supabaseClient
            .from('teachers')
            .select('id, name')
            .eq('department', department)
            .order('name');

        if (error) throw error;

        const select = document.getElementById('teacherSelect');
        select.disabled = false;
        select.innerHTML = '<option value="">Select a teacher</option>';

        teachers.forEach(teacher => {
            const option = document.createElement('option');
            option.value = teacher.id;
            option.textContent = teacher.name;
            select.appendChild(option);
        });

    } catch (error) {
        console.error('Error loading teachers:', error);
        showAlert('Failed to load teachers', 'error');
    }
}

// Load courses for selected teacher
async function loadCoursesForTeacher(teacherId) {
    try {
        // First, get course codes for this teacher
        const { data: courseTeachers, error: ctError } = await window.supabaseClient
            .from('course_teachers')
            .select('course_code')
            .eq('teacher_id', teacherId);

        if (ctError) throw ctError;

        const select = document.getElementById('courseSelect');
        select.disabled = false;
        
        if (courseTeachers.length === 0) {
            select.innerHTML = '<option value="">No courses found for this teacher</option>';
            return;
        }

        // Get course codes
        const courseCodes = courseTeachers.map(ct => ct.course_code);

        // Fetch course details
        const { data: courses, error: coursesError } = await window.supabaseClient
            .from('courses')
            .select('code, name')
            .in('code', courseCodes)
            .order('code');

        if (coursesError) throw coursesError;

        select.innerHTML = '<option value="">Select a course (optional)</option>';

        courses.forEach(course => {
            const option = document.createElement('option');
            option.value = course.code;
            option.textContent = `${course.code} - ${course.name}`;
            select.appendChild(option);
        });

    } catch (error) {
        console.error('Error loading courses:', error);
        showAlert('Failed to load courses', 'error');
    }
}

// Show teacher preview
function showTeacherPreview(name, department) {
    document.getElementById('previewName').textContent = name;
    document.getElementById('previewDept').textContent = formatDepartmentName(department);
    document.getElementById('teacherPreview').style.display = 'block';
}

// Hide teacher preview
function hideTeacherPreview() {
    document.getElementById('teacherPreview').style.display = 'none';
}

// Handle form submission
async function handleSubmit(e) {
    e.preventDefault();

    const submitBtn = document.getElementById('submitBtn');
    setLoading(true, 'Submitting your review…');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';

    try {
        // Get form values
        const teacherId = selectedTeacherId;
        const courseCode = selectedCourseCode || null; // Course is optional
        
        // Check if overall rating is selected
        const overallRatingElement = document.querySelector('input[name="overall"]:checked');
        if (!overallRatingElement) {
            throw new Error('Please select an overall rating (stars)');
        }
        const overallRating = parseInt(overallRatingElement.value);
        
        const teachingQuality = parseInt(document.getElementById('teachingSlider').value);
        const gradingFairness = parseInt(document.getElementById('gradingSlider').value);
        const approachability = parseInt(document.getElementById('approachabilitySlider').value);
        const punctuality = parseInt(document.getElementById('punctualitySlider').value);
        const reviewText = document.getElementById('reviewText').value.trim() || null; // Review text is optional
        const isAnonymous = document.getElementById('anonymousToggle')?.checked || false;

        // Debug: Log all values with types
        console.log('Review values:', {
            teacherId,
            overallRating: `${overallRating} (${typeof overallRating})`,
            teachingQuality: `${teachingQuality} (${typeof teachingQuality})`,
            gradingFairness: `${gradingFairness} (${typeof gradingFairness})`,
            approachability: `${approachability} (${typeof approachability})`,
            punctuality: `${punctuality} (${typeof punctuality})`,
            courseCode,
            reviewText,
            isAnonymous
        });

        // Validate - teacher is required
        if (!teacherId) {
            throw new Error('Please select a teacher');
        }

        // Get authenticated user data
        const userData = reviewAuth.getUserData();
        if (!userData) {
            throw new Error('Please log in to submit a review');
        }
        
        await insertTeacherReview({
            teacherId,
            userId: userData.id,
            userEmail: userData.email,
            courseCode,
            overallRating,
            teachingQuality,
            gradingFairness,
            approachability,
            punctuality,
            reviewText,
            isAnonymous
        });

        // Go back immediately once submission completes
        window.location.href = `teacher-profile.html?id=${teacherId}`;

    } catch (error) {
        console.error('Error submitting review:', error);
        showAlert(formatSubmitError(error), 'error');
        setLoading(false);
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Submit Review';
    }
}

function getDbClient() {
    // Prefer a client that does NOT attach Supabase Auth sessions.
    // This avoids weird RLS behavior when an admin session exists in the browser.
    return window.supabasePublicClient || window.supabaseClient;
}

function setLoading(isLoading, message = 'Loading…') {
    const overlay = document.getElementById('loadingOverlay');
    const title = document.getElementById('loadingTitle');
    if (!overlay) return;

    if (title) title.textContent = message;
    overlay.style.display = isLoading ? 'flex' : 'none';
    overlay.setAttribute('aria-hidden', isLoading ? 'false' : 'true');
}

function compactObject(obj) {
    const out = {};
    Object.entries(obj).forEach(([key, value]) => {
        if (value !== undefined) out[key] = value;
    });
    return out;
}

function isMissingColumnError(err) {
    const code = String(err?.code ?? '');
    const msg = String(err?.message ?? '').toLowerCase();
    // PostgREST schema-cache missing column errors often show as PGRST204.
    return code === 'PGRST204' || msg.includes('schema cache') || msg.includes("could not find the '") || msg.includes('column') && msg.includes('does not exist');
}

function getMissingColumnName(err) {
    const msg = String(err?.message ?? '');

    // Example: "Could not find the 'is_anonymous' column of 'teacher_reviews' in the schema cache"
    const schemaCacheMatch = msg.match(/could not find the '([^']+)' column/i);
    if (schemaCacheMatch?.[1]) return schemaCacheMatch[1];

    // Example: "column \"is_anonymous\" does not exist"
    const doesNotExistMatch = msg.match(/column\s+"([^"]+)"\s+does\s+not\s+exist/i);
    if (doesNotExistMatch?.[1]) return doesNotExistMatch[1];

    return null;
}

function formatSubmitError(err) {
    const msg = String(err?.message ?? '').trim();
    const details = String(err?.details ?? '').trim();
    const code = String(err?.code ?? '').trim();

    // Hint for common RLS failure
    if (code === '42501' || msg.toLowerCase().includes('row-level security')) {
        return 'Submission blocked by database security (RLS). Run teacher-review-rls-policies.sql in Supabase, then try again.';
    }

    if (!msg && !details) return 'Failed to submit review. Please try again.';
    if (details && details !== msg) return `${msg}${code ? ` (code: ${code})` : ''} — ${details}`;
    return `${msg}${code ? ` (code: ${code})` : ''}`;
}

async function insertTeacherReview({
    teacherId,
    userId,
    userEmail,
    courseCode,
    overallRating,
    teachingQuality,
    gradingFairness,
    approachability,
    punctuality,
    reviewText,
    isAnonymous
}) {
    const db = getDbClient();

    const base = {
        teacher_id: teacherId,
        course_code: courseCode,
        overall_rating: overallRating,
        teaching_quality: teachingQuality,
        approachability,
        punctuality,
        review_text: reviewText,
        is_anonymous: isAnonymous
    };

    // Try likely schemas in order (project schema has changed over time).
    const attempts = [
        // Current UI code expectation
        compactObject({
            ...base,
            fair_grading: gradingFairness,
            student_id: userId,
            student_email: userEmail
        }),
        // Alternate column name from SQL schema
        compactObject({
            ...base,
            grading_fairness: gradingFairness,
            student_id: userId,
            student_email: userEmail
        }),
        // If student columns don't exist in DB, retry without them
        compactObject({
            ...base,
            fair_grading: gradingFairness
        }),
        compactObject({
            ...base,
            grading_fairness: gradingFairness
        })
    ];

    let lastError = null;
    for (const originalPayload of attempts) {
        // Clone so we can delete missing keys between retries.
        let payload = { ...originalPayload };
        let retriesLeft = 4;

        while (retriesLeft-- > 0) {
            const { error } = await db
                .from('teacher_reviews')
                .insert([payload]);

            if (!error) return;

            lastError = error;
            if (!isMissingColumnError(error)) {
                throw error;
            }

            const missing = getMissingColumnName(error);
            if (!missing || !(missing in payload)) {
                // Can't safely mutate payload further.
                break;
            }

            delete payload[missing];
        }
    }

    throw lastError || new Error('Failed to submit review');
}

// Show alert message
function showAlert(message, type) {
    const alertBox = document.getElementById('alertBox');
    alertBox.className = `alert ${type}`;
    alertBox.textContent = message;
    alertBox.style.display = 'block';

    // Auto-hide after 5 seconds
    setTimeout(() => {
        alertBox.style.display = 'none';
    }, 5000);
}

// Format department name
function formatDepartmentName(dept) {
    const deptMap = {
        'BSCSE': 'BSc in Computer Science & Engineering',
        'BSDS': 'BSc in Data Science',
        'EEE': 'Electrical & Electronic Engineering',
        'CE': 'Civil Engineering',
        'BBA': 'Business Administration',
        'English': 'English',
        'Economics': 'Economics',
        'Law': 'Law',
        'Pharmacy': 'Pharmacy'
    };
    return deptMap[dept] || dept;
}
