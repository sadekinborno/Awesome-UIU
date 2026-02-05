// Teacher Profile Page Logic
let teacherId = null;
let teacherData = null;
let allReviews = [];
let currentReviewPage = 1;
const REVIEWS_PAGE_SIZE = 5;

// Initialize page
document.addEventListener('DOMContentLoaded', async () => {
    // Get teacher ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    teacherId = urlParams.get('id');

    if (!teacherId) {
        window.location.href = 'teacher-reviews.html';
        return;
    }

    await loadTeacherProfile();
    setupEventListeners();
});

// Setup event listeners
function setupEventListeners() {
    document.getElementById('addReviewBtn').addEventListener('click', () => {
        window.location.href = `add-review.html?teacher=${teacherId}`;
    });

    const prevBtn = document.getElementById('prevReviewsPage');
    const nextBtn = document.getElementById('nextReviewsPage');
    if (prevBtn && nextBtn) {
        prevBtn.addEventListener('click', () => {
            if (currentReviewPage > 1) {
                currentReviewPage--;
                renderReviewsPage();
            }
        });

        nextBtn.addEventListener('click', () => {
            const totalPages = Math.ceil(allReviews.length / REVIEWS_PAGE_SIZE) || 1;
            if (currentReviewPage < totalPages) {
                currentReviewPage++;
                renderReviewsPage();
            }
        });
    }
}

// Load teacher profile data
async function loadTeacherProfile() {
    try {
        // Get teacher data
        const { data: teacher, error: teacherError } = await window.supabaseClient
            .from('teachers')
            .select('*')
            .eq('id', teacherId)
            .single();

        if (teacherError) throw teacherError;

        // Get courses for this teacher
        const { data: courseLinks } = await window.supabaseClient
            .from('course_teachers')
            .select('course_code')
            .eq('teacher_id', teacherId);

        const courseCodes = courseLinks?.map(ct => ct.course_code) || [];
        
        let courses = [];
        if (courseCodes.length > 0) {
            const { data: courseData } = await window.supabaseClient
                .from('courses')
                .select('code, name')
                .in('code', courseCodes);
            courses = courseData || [];
        }

        // Attach courses to teacher data
        teacher.course_teachers = courses.map(c => ({ courses: c }));
        teacherData = teacher;

        // Get all reviews for this teacher
        const { data: reviews, error: reviewsError } = await window.supabaseClient
            .from('teacher_reviews')
            .select('*')
            .eq('teacher_id', teacherId)
            .order('created_at', { ascending: false });

        if (reviewsError) throw reviewsError;

        // Get course information for each review
        const reviewsWithCourses = await Promise.all(
            (reviews || []).map(async (review) => {
                // Skip course fetch if course_code is null
                if (!review.course_code) {
                    return {
                        ...review,
                        courses: null
                    };
                }
                
                const { data: course } = await window.supabaseClient
                    .from('courses')
                    .select('code, name')
                    .eq('code', review.course_code)
                    .single();
                
                return {
                    ...review,
                    courses: course
                };
            })
        );

        // Display profile
        displayProfile(teacher, reviewsWithCourses);
        displayCourses(teacher.course_teachers);

        allReviews = reviewsWithCourses || [];
        currentReviewPage = 1;
        renderReviewsPage();

    } catch (error) {
        console.error('Error loading profile:', error);
        alert('Failed to load teacher profile. Redirecting...');
        window.location.href = 'teacher-reviews.html';
    }
}

// Display teacher profile header
function displayProfile(teacher, reviews) {
    // Set avatar initials
    const initials = teacher.name
        .split(' ')
        .map(n => n[0])
        .join('')
        .substring(0, 2)
        .toUpperCase();
    document.getElementById('profileAvatar').textContent = initials;

    // Set name and department
    document.getElementById('teacherName').textContent = teacher.name;
    document.getElementById('teacherDept').textContent = formatDepartmentName(teacher.department);

    // Set stats
    document.getElementById('totalReviews').textContent = teacher.total_reviews || reviews.length;
    document.getElementById('totalCourses').textContent = teacher.course_teachers?.length || 0;
    document.getElementById('avgRating').textContent = (teacher.overall_rating || 0).toFixed(1);

    // Set overall rating
    const avgRating = teacher.overall_rating || 0;
    document.getElementById('overallRating').textContent = avgRating.toFixed(1);
    document.getElementById('reviewCount').textContent = teacher.total_reviews || reviews.length;
    
    // Display stars
    const starsHtml = createStarsLarge(avgRating);
    document.getElementById('overallStars').innerHTML = starsHtml;

    // Display category ratings
    displayCategoryRatings(teacher);

    // Show content
    document.getElementById('loadingSpinner').style.display = 'none';
    document.getElementById('profileContent').style.display = 'block';
}

// Display category ratings
function displayCategoryRatings(teacher) {
    const categories = [
        { label: 'Teaching Quality', value: teacher.teaching_quality_avg || 0 },
        { label: 'Grading Fairness', value: teacher.fair_grading_avg || 0 },
        { label: 'Approachability', value: teacher.approachability_avg || 0 },
        { label: 'Punctuality', value: teacher.punctuality_avg || 0 }
    ];

    const container = document.getElementById('categoryRatings');
    container.innerHTML = '';

    categories.forEach(category => {
        const percentage = (category.value / 5) * 100; // Changed from /10 to /5 for 1-5 scale
        const categoryDiv = document.createElement('div');
        categoryDiv.className = 'category-rating';
        categoryDiv.innerHTML = `
            <div class="category-label">${category.label}</div>
            <div class="progress-bar">
                <div class="progress-fill" style="width: ${percentage}%"></div>
            </div>
            <div class="category-value">${category.value.toFixed(1)}/5</div>
        `;
        container.appendChild(categoryDiv);
    });
}

// Display courses
function displayCourses(courseTeachers) {
    const container = document.getElementById('courseList');
    container.innerHTML = '';

    if (!courseTeachers || courseTeachers.length === 0) {
        container.innerHTML = '<p style="color: var(--text-muted);">No courses assigned yet.</p>';
        return;
    }

    courseTeachers.forEach(ct => {
        const course = ct.courses;
        const courseDiv = document.createElement('div');
        courseDiv.className = 'course-item';
        courseDiv.innerHTML = `
            <div class="course-code">${course.code}</div>
            <div class="course-name">${course.name}</div>
        `;
        container.appendChild(courseDiv);
    });
}

// Render current reviews page with pagination
function renderReviewsPage() {
    const container = document.getElementById('reviewsList');
    const noReviews = document.getElementById('noReviews');
    const pagination = document.getElementById('reviewsPagination');
    const pageInfo = document.getElementById('reviewsPageInfo');

    if (!allReviews || allReviews.length === 0) {
        container.style.display = 'none';
        noReviews.style.display = 'block';
        if (pagination) pagination.style.display = 'none';
        return;
    }

    noReviews.style.display = 'none';
    container.style.display = 'block';
    container.innerHTML = '';

    const totalPages = Math.ceil(allReviews.length / REVIEWS_PAGE_SIZE) || 1;
    if (currentReviewPage > totalPages) currentReviewPage = totalPages;

    const start = (currentReviewPage - 1) * REVIEWS_PAGE_SIZE;
    const end = start + REVIEWS_PAGE_SIZE;
    const pageReviews = allReviews.slice(start, end);

    pageReviews.forEach(review => {
        const reviewCard = createReviewCard(review);
        container.appendChild(reviewCard);
    });

    if (pagination && pageInfo) {
        if (totalPages <= 1) {
            pagination.style.display = 'none';
        } else {
            pagination.style.display = 'flex';
            pageInfo.textContent = `Page ${currentReviewPage} of ${totalPages}`;

            const prevBtn = document.getElementById('prevReviewsPage');
            const nextBtn = document.getElementById('nextReviewsPage');
            if (prevBtn) prevBtn.disabled = currentReviewPage === 1;
            if (nextBtn) nextBtn.disabled = currentReviewPage === totalPages;
        }
    }
}

// Create review card element
function createReviewCard(review) {
    const card = document.createElement('div');
    card.className = 'review-card';

    const stars = createStars(review.overall_rating);
    const date = new Date(review.created_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });

    const reviewerName = getReviewerDisplayName(review);

    card.innerHTML = `
        <div class="review-main">
            <div class="review-header">
                <div class="review-author">
                    <div class="reviewer-name">${reviewerName}</div>
                    <div class="review-date">${date}</div>
                </div>
                <div class="review-rating">
                    <div class="review-stars">${stars}</div>
                </div>
            </div>
            <div class="review-content">${review.review_text}</div>
        </div>

        <button type="button" class="review-toggle">
            <span>View details</span>
            <i class="fas fa-chevron-down"></i>
        </button>

        <div class="review-extra">
            ${review.courses ? `
                <div class="review-course">${review.courses.code} - ${review.courses.name}</div>
            ` : ''}

            <div class="review-categories">
                <div class="review-category-item">
                    <span class="review-category-label">Teaching Quality</span>
                    <span class="review-category-score">${review.teaching_quality}/5</span>
                </div>
                <div class="review-category-item">
                    <span class="review-category-label">Grading Fairness</span>
                    <span class="review-category-score">${review.fair_grading}/5</span>
                </div>
                <div class="review-category-item">
                    <span class="review-category-label">Approachability</span>
                    <span class="review-category-score">${review.approachability}/5</span>
                </div>
                <div class="review-category-item">
                    <span class="review-category-label">Punctuality</span>
                    <span class="review-category-score">${review.punctuality}/5</span>
                </div>
            </div>
            
            <div class="review-votes">
                <button class="vote-btn" data-review-id="${review.id}" data-vote="helpful">
                    <i class="fas fa-thumbs-up"></i>
                    <span>Helpful (${review.helpful_count || 0})</span>
                </button>
                <button class="vote-btn" data-review-id="${review.id}" data-vote="not-helpful">
                    <i class="fas fa-thumbs-down"></i>
                    <span>Not Helpful (${review.not_helpful_count || 0})</span>
                </button>
            </div>
        </div>
    `;

    // Add vote button listeners
    card.querySelectorAll('.vote-btn').forEach(btn => {
        btn.addEventListener('click', () => handleVote(btn));
    });

    // Toggle extra details
    const toggleBtn = card.querySelector('.review-toggle');
    const extra = card.querySelector('.review-extra');
    if (toggleBtn && extra) {
        toggleBtn.addEventListener('click', () => {
            const isExpanded = card.classList.toggle('expanded');
            const labelSpan = toggleBtn.querySelector('span');
            if (labelSpan) {
                labelSpan.textContent = isExpanded ? 'Hide details' : 'View details';
            }
        });
    }

    return card;
}

function getReviewerDisplayName(review) {
    if (review?.is_anonymous) {
        return 'Anonymous Student';
    }

    const email = String(review?.student_email || '').trim();
    if (!email) {
        return 'Verified Student';
    }

    const localPart = email.split('@')[0] || email;
    return localPart;
}

// Handle voting on reviews
async function handleVote(button) {
    // In a full implementation, you would check if user already voted
    // For now, just increment the count
    button.classList.toggle('voted');
    
    const reviewId = button.dataset.reviewId;
    const voteType = button.dataset.vote === 'helpful';
    
    try {
        // Update vote count in database
        const field = voteType ? 'helpful_count' : 'not_helpful_count';
        
        const { data: review } = await window.supabaseClient
            .from('teacher_reviews')
            .select(field)
            .eq('id', reviewId)
            .single();

        const newCount = (review[field] || 0) + (button.classList.contains('voted') ? 1 : -1);

        await window.supabaseClient
            .from('teacher_reviews')
            .update({ [field]: newCount })
            .eq('id', reviewId);

        // Update button text
        const span = button.querySelector('span');
        const label = voteType ? 'Helpful' : 'Not Helpful';
        span.textContent = `${label} (${newCount})`;

    } catch (error) {
        console.error('Error voting:', error);
    }
}

// Create star rating HTML
function createStars(rating) {
    const fullStars = Math.floor(rating);
    let stars = '';

    for (let i = 0; i < 5; i++) {
        if (i < fullStars) {
            stars += '<i class="fas fa-star star"></i>';
        } else {
            stars += '<i class="fas fa-star star empty"></i>';
        }
    }

    return stars;
}

// Create large star rating HTML
function createStarsLarge(rating) {
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    let stars = '';

    for (let i = 0; i < 5; i++) {
        if (i < fullStars) {
            stars += '<i class="fas fa-star star-large"></i>';
        } else if (i === fullStars && hasHalfStar) {
            stars += '<i class="fas fa-star-half-alt star-large"></i>';
        } else {
            stars += '<i class="fas fa-star star-large empty"></i>';
        }
    }

    return stars;
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
