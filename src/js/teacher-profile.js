// Teacher Profile Page Logic
let teacherId = null;
let teacherData = null;
let allReviews = [];
let currentReviewPage = 1;
const REVIEWS_PAGE_SIZE = 5;
const PROFILE_STATE_KEY = 'teacherProfileViewState';
const PROFILE_STATE_MAX_AGE_MS = 1000 * 60 * 30;

let pendingDeleteReviewId = null;

let myVotesByReviewId = {};

function toLowerTrim(value) {
    return String(value ?? '').trim().toLowerCase();
}

function getLoggedInUser() {
    try {
        return window.reviewAuth?.getUserData?.() || null;
    } catch {
        return null;
    }
}

function isReviewByUser(review, user) {
    if (!review || !user) return false;

    // Deterministic identity: teacher_reviews.student_id is the author key.
    const reviewStudentId = String(review.student_id ?? '').trim();
    return Boolean(reviewStudentId && user.id && reviewStudentId === String(user.id));
}

function getRedirectTarget() {
    const file = (window.location.pathname.split('/').pop() || 'teacher-profile.html');
    return `${file}${window.location.search || ''}`;
}

function getDbClient() {
    return window.supabasePublicClient || window.supabaseClient;
}

function saveTeacherProfileState() {
    try {
        const state = {
            teacherId,
            currentReviewPage,
            scrollY: window.scrollY || 0,
            savedAt: Date.now()
        };
        sessionStorage.setItem(PROFILE_STATE_KEY, JSON.stringify(state));
    } catch (error) {
        console.warn('Could not save teacher profile state:', error);
    }
}

function loadTeacherProfileState() {
    try {
        const raw = sessionStorage.getItem(PROFILE_STATE_KEY);
        if (!raw) return null;

        const state = JSON.parse(raw);
        const age = Date.now() - Number(state?.savedAt || 0);
        if (!state || age > PROFILE_STATE_MAX_AGE_MS) {
            sessionStorage.removeItem(PROFILE_STATE_KEY);
            return null;
        }

        return state;
    } catch (error) {
        console.warn('Could not read teacher profile state:', error);
        return null;
    }
}

function restoreTeacherProfileStateIfNeeded() {
    const savedState = loadTeacherProfileState();
    const returnedFromAddReview = document.referrer?.includes('add-review.html');

    if (!savedState || !returnedFromAddReview) {
        return;
    }

    if (!savedState.teacherId || String(savedState.teacherId) !== String(teacherId)) {
        return;
    }

    const totalPages = Math.ceil(allReviews.length / REVIEWS_PAGE_SIZE) || 1;
    const targetPage = Number(savedState.currentReviewPage || 1);
    currentReviewPage = Math.min(Math.max(targetPage, 1), totalPages);
    renderReviewsPage();

    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            window.scrollTo({ top: Number(savedState.scrollY || 0), behavior: 'auto' });
            sessionStorage.removeItem(PROFILE_STATE_KEY);
        });
    });
}

function setVoteFeedback(container, message) {
    if (!container) return;
    let el = container.querySelector('.vote-feedback');
    if (!el) {
        el = document.createElement('div');
        el.className = 'vote-feedback';
        el.style.marginTop = '0.5rem';
        el.style.fontSize = '0.85rem';
        el.style.color = 'var(--text-muted)';
        container.appendChild(el);
    }
    el.textContent = message || '';
    el.style.display = message ? 'block' : 'none';
}

async function loadMyVotesForReviews(reviewIds) {
    const user = getLoggedInUser();
    if (!user?.id || !Array.isArray(reviewIds) || reviewIds.length === 0) return {};

    try {
        const { data, error } = await getDbClient()
            .from('review_votes')
            .select('review_id, vote_type')
            .eq('voter_user_id', user.id)
            .in('review_id', reviewIds);

        if (error) throw error;

        const map = {};
        (data || []).forEach((row) => {
            if (!row?.review_id) return;
            map[String(row.review_id)] = row?.vote_type;
        });
        return map;
    } catch {
        // If the column/function isn't installed yet, don't break the page.
        return {};
    }
}

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
    restoreTeacherProfileStateIfNeeded();
    setupEventListeners();
});

// Setup event listeners
function setupEventListeners() {
    [
        document.getElementById('addReviewBtn'),
        document.getElementById('addReviewBtnInReviews')
    ]
        .filter(Boolean)
        .forEach((btn) => {
            btn.addEventListener('click', () => {
                saveTeacherProfileState();
                const currentFile = window.location.pathname.split('/').pop() || 'teacher-profile.html';
                const returnTo = encodeURIComponent(`${currentFile}${window.location.search || ''}`);
                window.location.href = `add-review.html?teacher=${teacherId}&return=${returnTo}`;
            });
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

    const confirmBackdrop = document.getElementById('confirmDialogBackdrop');
    const confirmCancel = document.getElementById('confirmDialogCancel');
    const confirmDelete = document.getElementById('confirmDialogDelete');

    if (confirmCancel) {
        confirmCancel.addEventListener('click', () => closeConfirmDialog());
    }

    if (confirmBackdrop) {
        confirmBackdrop.addEventListener('click', (e) => {
            if (e.target === confirmBackdrop) closeConfirmDialog();
        });
    }

    if (confirmDelete) {
        confirmDelete.addEventListener('click', async () => {
            if (!pendingDeleteReviewId) return;
            const reviewId = pendingDeleteReviewId;
            pendingDeleteReviewId = null;
            closeConfirmDialog();
            await deleteOwnReviewById(reviewId);
        });
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeConfirmDialog();
    });
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

        const loggedInUser = getLoggedInUser();
        const sortedReviews = (reviewsWithCourses || []).slice().sort((a, b) => {
            const aMine = isReviewByUser(a, loggedInUser);
            const bMine = isReviewByUser(b, loggedInUser);
            if (aMine !== bMine) return aMine ? -1 : 1;
            // keep newest first otherwise
            return new Date(b.created_at) - new Date(a.created_at);
        });

        // Preload my vote state so buttons can reflect it.
        myVotesByReviewId = await loadMyVotesForReviews((sortedReviews || []).map(r => r.id));

        // Display profile
        displayProfile(teacher, sortedReviews);
        displayCourses(teacher.course_teachers);

        allReviews = sortedReviews;
        currentReviewPage = 1;
        updateReviewButtons();
        renderReviewsPage();

    } catch (error) {
        console.error('Error loading profile:', error);
        alert('Failed to load teacher profile. Redirecting...');
        window.location.href = 'teacher-reviews.html';
    }
}

function updateReviewButtons() {
    const loggedInUser = getLoggedInUser();
    const hasReview = (allReviews || []).some((r) => isReviewByUser(r, loggedInUser));

    const label = hasReview ? 'Update Review' : 'Write a Review';
    ['addReviewBtn', 'addReviewBtnInReviews']
        .map((id) => document.getElementById(id))
        .filter(Boolean)
        .forEach((btn) => {
            btn.textContent = ` ${label}`;
        });
}

function openConfirmDialog({ title, message, reviewId }) {
    const backdrop = document.getElementById('confirmDialogBackdrop');
    const titleEl = document.getElementById('confirmDialogTitle');
    const messageEl = document.getElementById('confirmDialogMessage');
    const deleteBtn = document.getElementById('confirmDialogDelete');

    pendingDeleteReviewId = reviewId || null;
    if (titleEl) titleEl.textContent = title || 'Confirm action';
    if (messageEl) messageEl.textContent = message || '';
    if (deleteBtn) deleteBtn.disabled = !pendingDeleteReviewId;

    if (backdrop) {
        backdrop.style.display = 'flex';
        const cancelBtn = document.getElementById('confirmDialogCancel');
        if (cancelBtn) cancelBtn.focus();
    }
}

function closeConfirmDialog() {
    const backdrop = document.getElementById('confirmDialogBackdrop');
    if (backdrop) backdrop.style.display = 'none';
    pendingDeleteReviewId = null;
}

async function deleteOwnReviewById(reviewId) {
    const loggedInUser = getLoggedInUser();
    if (!loggedInUser?.id) return;

    try {
        const { error } = await window.supabaseClient
            .from('teacher_reviews')
            .delete()
            .eq('id', reviewId)
            .eq('teacher_id', teacherId)
            .eq('student_id', String(loggedInUser.id));

        if (error) throw error;

        allReviews = (allReviews || []).filter((r) => String(r.id) !== String(reviewId));
        currentReviewPage = 1;
        updateReviewButtons();
        updateReviewCounts();
        updateRatingSummaryFromReviews();
        renderReviewsPage();
    } catch (error) {
        console.error('Error deleting review:', error);
        alert('Failed to delete your review. Please try again.');
    }
}

function updateReviewCounts() {
    const count = (allReviews || []).length;
    const totalReviewsEl = document.getElementById('totalReviews');
    const reviewCountEl = document.getElementById('reviewCount');
    if (totalReviewsEl) totalReviewsEl.textContent = String(count);
    if (reviewCountEl) reviewCountEl.textContent = String(count);
}

function updateRatingSummaryFromReviews() {
    const reviews = allReviews || [];
    const count = reviews.length;

    const safeNumber = (value) => {
        const numberValue = Number(value);
        return Number.isFinite(numberValue) ? numberValue : 0;
    };

    const averageOf = (field) => {
        if (!count) return 0;
        const sum = reviews.reduce((acc, r) => acc + safeNumber(r?.[field]), 0);
        return sum / count;
    };

    const overallAvg = averageOf('overall_rating');

    const avgRatingEl = document.getElementById('avgRating');
    const overallRatingEl = document.getElementById('overallRating');
    const overallStarsEl = document.getElementById('overallStars');

    if (avgRatingEl) avgRatingEl.textContent = overallAvg.toFixed(1);
    if (overallRatingEl) overallRatingEl.textContent = overallAvg.toFixed(1);
    if (overallStarsEl) overallStarsEl.innerHTML = createStarsLarge(overallAvg);

    const computedTeacher = {
        teaching_quality_avg: averageOf('teaching_quality'),
        fair_grading_avg: averageOf('fair_grading'),
        approachability_avg: averageOf('approachability'),
        punctuality_avg: averageOf('punctuality')
    };
    displayCategoryRatings(computedTeacher);
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

    const loggedInUser = getLoggedInUser();
    const isMine = isReviewByUser(review, loggedInUser);
    const reviewText = String(review.review_text ?? '').trim();

    const myVote = myVotesByReviewId?.[String(review.id)] || null;
    const helpfulVotedClass = myVote === 'helpful' ? ' voted' : '';
    const notHelpfulVotedClass = myVote === 'not_helpful' ? ' voted' : '';

    card.innerHTML = `
        <div class="review-main">
            <div class="review-header">
                <div class="review-author">
                    <div class="reviewer-name">${reviewerName}</div>
                    <div class="review-date">${date}</div>
                </div>
                <div class="review-rating">
                    <div class="review-stars">${stars}</div>
                    ${isMine ? `
                        <button type="button" class="review-delete-btn" aria-label="Delete your review" title="Delete your review" data-review-id="${review.id}">
                            <i class="fas fa-trash"></i>
                            <span>Delete</span>
                        </button>
                    ` : ''}
                </div>
            </div>
            ${reviewText ? `<div class="review-content">${reviewText}</div>` : ''}
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
                <button class="vote-btn${helpfulVotedClass}" data-review-id="${review.id}" data-vote="helpful">
                    <i class="fas fa-thumbs-up"></i>
                    <span>Helpful (${review.helpful_count || 0})</span>
                </button>
                <button class="vote-btn${notHelpfulVotedClass}" data-review-id="${review.id}" data-vote="not-helpful">
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

    const deleteBtn = card.querySelector('.review-delete-btn');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', () => {
            const reviewId = deleteBtn.getAttribute('data-review-id');
            openConfirmDialog({
                title: 'Delete review?',
                message: 'This will permanently delete your review for this teacher. This cannot be undone.',
                reviewId
            });
        });
    }

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
    const user = getLoggedInUser();
    if (!user?.id) {
        const redirect = encodeURIComponent(getRedirectTarget());
        window.location.href = `review-login.html?redirect=${redirect}`;
        return;
    }

    const reviewId = button.dataset.reviewId;
    const voteType = button.dataset.vote === 'helpful' ? 'helpful' : 'not_helpful';

    const container = button.closest('.review-votes');
    setVoteFeedback(container, '');
    const helpfulBtn = container?.querySelector('[data-vote="helpful"]');
    const notHelpfulBtn = container?.querySelector('[data-vote="not-helpful"]');

    const prevHelpfulVoted = helpfulBtn?.classList.contains('voted');
    const prevNotHelpfulVoted = notHelpfulBtn?.classList.contains('voted');

    if (helpfulBtn) helpfulBtn.disabled = true;
    if (notHelpfulBtn) notHelpfulBtn.disabled = true;

    try {
        const { data, error } = await getDbClient()
            .rpc('toggle_review_vote', {
                p_review_id: reviewId,
                p_voter_user_id: user.id,
                p_vote_type: voteType
            });

        if (error) throw error;

        const row = Array.isArray(data) ? data[0] : data;
        const helpfulCount = Number(row?.helpful_count ?? 0);
        const notHelpfulCount = Number(row?.not_helpful_count ?? 0);
        const currentVoteType = row?.current_vote_type || null;

        // Persist my vote state locally for this page.
        if (currentVoteType) {
            myVotesByReviewId[String(reviewId)] = currentVoteType;
        } else {
            delete myVotesByReviewId[String(reviewId)];
        }

        // Update button voted state
        if (helpfulBtn) helpfulBtn.classList.toggle('voted', currentVoteType === 'helpful');
        if (notHelpfulBtn) notHelpfulBtn.classList.toggle('voted', currentVoteType === 'not_helpful');

        // Update counts in the UI
        if (helpfulBtn) {
            const span = helpfulBtn.querySelector('span');
            if (span) span.textContent = `Helpful (${helpfulCount})`;
        }
        if (notHelpfulBtn) {
            const span = notHelpfulBtn.querySelector('span');
            if (span) span.textContent = `Not Helpful (${notHelpfulCount})`;
        }

        // Keep in-memory review list in sync (used by pagination re-render)
        const idx = (allReviews || []).findIndex(r => String(r.id) === String(reviewId));
        if (idx >= 0) {
            allReviews[idx] = {
                ...allReviews[idx],
                helpful_count: helpfulCount,
                not_helpful_count: notHelpfulCount
            };
        }
    } catch (error) {
        // Revert UI state on failure
        if (helpfulBtn) helpfulBtn.classList.toggle('voted', Boolean(prevHelpfulVoted));
        if (notHelpfulBtn) notHelpfulBtn.classList.toggle('voted', Boolean(prevNotHelpfulVoted));
        console.error('Error voting:', error);
        const msg = String(error?.message || error || '').toLowerCase();
        if (msg.includes('toggle_review_vote') || msg.includes('function') || msg.includes('rpc')) {
            setVoteFeedback(container, 'Voting is not available yet (DB vote function not installed). Run add-review-vote-rpc.sql in Supabase.');
        } else {
            setVoteFeedback(container, 'Vote failed. Please try again.');
        }
    } finally {
        if (helpfulBtn) helpfulBtn.disabled = false;
        if (notHelpfulBtn) notHelpfulBtn.disabled = false;
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
