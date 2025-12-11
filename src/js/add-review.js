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
        const { data: teacher, error } = await supabase
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
        const { data: teachers, error } = await supabase
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
        const { data: courseTeachers, error: ctError } = await supabase
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
        const { data: courses, error: coursesError } = await supabase
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

        // Debug: Log all values with types
        console.log('Review values:', {
            teacherId,
            overallRating: `${overallRating} (${typeof overallRating})`,
            teachingQuality: `${teachingQuality} (${typeof teachingQuality})`,
            gradingFairness: `${gradingFairness} (${typeof gradingFairness})`,
            approachability: `${approachability} (${typeof approachability})`,
            punctuality: `${punctuality} (${typeof punctuality})`,
            courseCode,
            reviewText
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
        
        // Insert review
        const { data, error } = await supabase
            .from('teacher_reviews')
            .insert([{
                teacher_id: teacherId,
                student_id: userData.id,
                student_email: userData.email,
                course_code: courseCode,
                overall_rating: overallRating,
                teaching_quality: teachingQuality,
                fair_grading: gradingFairness,
                approachability: approachability,
                punctuality: punctuality,
                review_text: reviewText
            }])
            .select();

        if (error) throw error;

        showAlert('Review submitted successfully!', 'success');
        
        // Redirect to teacher profile after 2 seconds
        setTimeout(() => {
            window.location.href = `teacher-profile.html?id=${teacherId}`;
        }, 2000);

    } catch (error) {
        console.error('Error submitting review:', error);
        showAlert(error.message || 'Failed to submit review', 'error');
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Submit Review';
    }
}

// Show alert message
function showAlert(message, type) {
    const alertBox = document.getElementById('alertBox');
    alertBox.className = `alert ${type}`;
    alertBox.textContent = message;
    alertBox.style.display = 'block';

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });

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
