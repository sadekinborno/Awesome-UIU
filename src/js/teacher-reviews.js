// Teacher Reviews List Page Logic
const PAGE_SIZE = 24;
let allTeachers = [];
let filteredTeachers = [];
let currentSort = 'rating';
let currentPage = 0;
let hasMore = true;
let isLoading = false;
let totalTeachersCount = 0;

// Initialize page
document.addEventListener('DOMContentLoaded', async () => {
    setupEventListeners();
    await loadTeachersPage(true);
});

// Setup event listeners
function setupEventListeners() {
    // Search input
    document.getElementById('searchInput').addEventListener('input', filterTeachers);
    
    // Department filter
    document.getElementById('departmentFilter').addEventListener('change', filterTeachers);
    
    // Rating filter
    document.getElementById('ratingFilter').addEventListener('change', filterTeachers);
    
    // Sort buttons
    document.querySelectorAll('.sort-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            currentSort = e.target.dataset.sort;
            sortAndDisplayTeachers();
        });
    });

    // Load more button
    const loadMoreBtn = document.getElementById('loadMoreBtn');
    if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', async () => {
            await loadTeachersPage(false);
        });
    }
}

// Load one page of teachers with their stats (used on page load and "Load More")
async function loadTeachersPage(reset = false) {
    try {
        if (isLoading) return;

        if (reset) {
            currentPage = 0;
            hasMore = true;
            allTeachers = [];
            filteredTeachers = [];

            const grid = document.getElementById('teachersGrid');
            if (grid) grid.innerHTML = '';

            const noResults = document.getElementById('noResults');
            if (noResults) noResults.style.display = 'none';

            const spinner = document.getElementById('loadingSpinner');
            if (spinner) spinner.style.display = 'block';
        }

        if (!hasMore) return;
        isLoading = true;

        const start = currentPage * PAGE_SIZE;
        const end = start + PAGE_SIZE - 1;

        console.log('Loading teachers page', currentPage + 1, 'range', start, end);

        const { data: teachers, error, count } = await window.supabaseClient
            .from('teachers')
            .select('*', { count: 'exact' })
            .order('name')
            .range(start, end);

        if (error) {
            console.error('Supabase error:', error);
            throw error;
        }

        if (typeof count === 'number') {
            totalTeachersCount = count;
        }

        if (!teachers || teachers.length === 0) {
            hasMore = false;
            if (currentPage === 0) {
                displayTeachers();
            }
            return;
        }

        const teachersWithCourses = await Promise.all(
            teachers.map(async (teacher) => {
                const { data: courseLinks } = await window.supabaseClient
                    .from('course_teachers')
                    .select('course_code')
                    .eq('teacher_id', teacher.id);

                const courseCodes = courseLinks?.map(ct => ct.course_code) || [];

                let courses = [];
                if (courseCodes.length > 0) {
                    const { data: courseData } = await window.supabaseClient
                        .from('courses')
                        .select('code, name')
                        .in('code', courseCodes);
                    courses = courseData || [];
                }

                return {
                    id: teacher.id,
                    name: teacher.name,
                    department: teacher.department,
                    totalReviews: teacher.total_reviews || 0,
                    avgRating: teacher.overall_rating || 0,
                    avgTeaching: teacher.teaching_quality_avg || 0,
                    avgGrading: teacher.fair_grading_avg || 0,
                    avgApproachability: teacher.approachability_avg || 0,
                    avgPunctuality: teacher.punctuality_avg || 0,
                    courses
                };
            })
        );

        allTeachers = allTeachers.concat(teachersWithCourses);

        if (currentPage === 0) {
            await updateStats();
        }

        filteredTeachers = [...allTeachers];
        filterTeachers();

        currentPage++;
        if (teachers.length < PAGE_SIZE) {
            hasMore = false;
        }

        const loadMoreContainer = document.getElementById('loadMoreContainer');
        const loadMoreBtn = document.getElementById('loadMoreBtn');
        if (loadMoreContainer && loadMoreBtn) {
            loadMoreContainer.style.display = hasMore ? 'block' : 'none';
            loadMoreBtn.disabled = !hasMore;
        }

    } catch (error) {
        console.error('Error loading teachers:', error);
        showError('Failed to load teachers. Please refresh the page.');
    } finally {
        isLoading = false;
    }
}

// Update header stats
async function updateStats() {
    try {
        // Get total courses count
        const { count: coursesCount } = await window.supabaseClient
            .from('courses')
            .select('*', { count: 'exact', head: true });

        // Get total reviews count
        const { count: reviewsCount } = await window.supabaseClient
            .from('teacher_reviews')
            .select('*', { count: 'exact', head: true });

        document.getElementById('totalTeachers').textContent =
            totalTeachersCount || allTeachers.length;
        document.getElementById('totalReviews').textContent = reviewsCount || 0;
        document.getElementById('totalCourses').textContent = coursesCount || 0;
        
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

// Filter/search teachers
async function filterTeachers() {
    const searchInput = document.getElementById('searchInput');
    const departmentSelect = document.getElementById('departmentFilter');
    const ratingSelect = document.getElementById('ratingFilter');

    const searchTerm = (searchInput?.value || '').trim().toLowerCase();
    const department = departmentSelect?.value || '';
    const minRating = parseFloat(ratingSelect?.value || '0');

    // If there is a search term, query Supabase directly so we search ALL teachers
    if (searchTerm.length > 0) {
        try {
            let query = window.supabaseClient
                .from('teachers')
                .select('*')
                .order('name');

            // Name search
            query = query.ilike('name', `%${searchTerm}%`);

            // Department filter
            if (department) {
                query = query.eq('department', department);
            }

            // Minimum rating filter (approximate using overall_rating column)
            if (!Number.isNaN(minRating) && minRating > 0) {
                query = query.gte('overall_rating', minRating);
            }

            const { data: teachers, error } = await query;

            if (error) {
                console.error('Supabase search error:', error);
                throw error;
            }

            // Fetch courses for these teachers
            const teachersWithCourses = await Promise.all(
                (teachers || []).map(async (teacher) => {
                    const { data: courseLinks } = await window.supabaseClient
                        .from('course_teachers')
                        .select('course_code')
                        .eq('teacher_id', teacher.id);

                    const courseCodes = courseLinks?.map(ct => ct.course_code) || [];

                    let courses = [];
                    if (courseCodes.length > 0) {
                        const { data: courseData } = await window.supabaseClient
                            .from('courses')
                            .select('code, name')
                            .in('code', courseCodes);
                        courses = courseData || [];
                    }

                    return {
                        id: teacher.id,
                        name: teacher.name,
                        department: teacher.department,
                        totalReviews: teacher.total_reviews || 0,
                        avgRating: teacher.overall_rating || 0,
                        avgTeaching: teacher.teaching_quality_avg || 0,
                        avgGrading: teacher.fair_grading_avg || 0,
                        avgApproachability: teacher.approachability_avg || 0,
                        avgPunctuality: teacher.punctuality_avg || 0,
                        courses,
                    };
                })
            );

            // In search mode, we just show results and hide "Load More"
            filteredTeachers = teachersWithCourses;

            const loadMoreContainer = document.getElementById('loadMoreContainer');
            const loadMoreBtn = document.getElementById('loadMoreBtn');
            if (loadMoreContainer && loadMoreBtn) {
                loadMoreContainer.style.display = 'none';
                loadMoreBtn.disabled = true;
            }

            sortAndDisplayTeachers();
            return;
        } catch (error) {
            console.error('Error searching teachers:', error);
            showError('Failed to search teachers. Please try again.');
            return;
        }
    }

    // No search term: filter already-loaded teachers (paginated list)
    filteredTeachers = allTeachers.filter(teacher => {
        const matchesSearch = teacher.name.toLowerCase().includes(searchTerm);
        const matchesDept = !department || teacher.department === department;
        const matchesRating = teacher.avgRating >= minRating;
        return matchesSearch && matchesDept && matchesRating;
    });

    const loadMoreContainer = document.getElementById('loadMoreContainer');
    const loadMoreBtn = document.getElementById('loadMoreBtn');
    if (loadMoreContainer && loadMoreBtn) {
        loadMoreContainer.style.display = hasMore ? 'block' : 'none';
        loadMoreBtn.disabled = !hasMore;
    }

    sortAndDisplayTeachers();
}

// Sort and display teachers
function sortAndDisplayTeachers() {
    // Sort teachers
    filteredTeachers.sort((a, b) => {
        switch (currentSort) {
            case 'rating':
                return b.avgRating - a.avgRating;
            case 'reviews':
                return b.totalReviews - a.totalReviews;
            case 'name':
                return a.name.localeCompare(b.name);
            default:
                return 0;
        }
    });

    displayTeachers();
}

// Display teachers in grid
function displayTeachers() {
    const grid = document.getElementById('teachersGrid');
    const noResults = document.getElementById('noResults');
    const loading = document.getElementById('loadingSpinner');
    const visibleCountEl = document.getElementById('visibleTeachersCount');

    loading.style.display = 'none';
    
    if (filteredTeachers.length === 0) {
        grid.style.display = 'none';
        noResults.style.display = 'block';
        if (visibleCountEl) {
            visibleCountEl.textContent = 'Showing 0 teachers on this page';
        }
        return;
    }

    noResults.style.display = 'none';
    grid.style.display = 'grid';
    grid.innerHTML = '';

    filteredTeachers.forEach(teacher => {
        const card = createTeacherCard(teacher);
        grid.appendChild(card);
    });

    if (visibleCountEl) {
        visibleCountEl.textContent = `Showing ${filteredTeachers.length} teachers on this page`;
    }
}

// Create teacher card element
function createTeacherCard(teacher) {
    const card = document.createElement('div');
    card.className = 'teacher-card';
    card.onclick = () => {
        window.location.href = `teacher-profile.html?id=${teacher.id}`;
    };

    // Get initials for avatar
    const initials = teacher.name
        .split(' ')
        .map(n => n[0])
        .join('')
        .substring(0, 2)
        .toUpperCase();

    // Create stars
    const stars = createStars(teacher.avgRating);

    // Format department name
    const deptName = formatDepartmentName(teacher.department);

    // Create course tags (show max 3)
    const courseTags = teacher.courses.slice(0, 3).map(course => 
        `<span class="course-tag">${course.code}</span>`
    ).join('');

    const moreCoursesText = teacher.courses.length > 3 
        ? `<span class="course-tag">+${teacher.courses.length - 3} more</span>` 
        : '';

    card.innerHTML = `
        <div class="teacher-info">
            <div class="teacher-avatar">${initials}</div>
            <div class="teacher-details">
                <div class="teacher-name">${teacher.name}</div>
                <div class="teacher-dept">${deptName}</div>
            </div>
        </div>
        
        <div class="rating-display">
            <div class="stars">${stars}</div>
            <span class="rating-score">${teacher.avgRating.toFixed(1)}</span>
        </div>
        <div class="review-count">${teacher.totalReviews} review${teacher.totalReviews !== 1 ? 's' : ''}</div>
        
        <div class="rating-categories">
            <div class="category-badge">
                <span class="category-name">Teaching</span>
                <span class="category-score">${teacher.avgTeaching.toFixed(1)}</span>
            </div>
            <div class="category-badge">
                <span class="category-name">Grading</span>
                <span class="category-score">${teacher.avgGrading.toFixed(1)}</span>
            </div>
            <div class="category-badge">
                <span class="category-name">Approachable</span>
                <span class="category-score">${teacher.avgApproachability.toFixed(1)}</span>
            </div>
            <div class="category-badge">
                <span class="category-name">Punctuality</span>
                <span class="category-score">${teacher.avgPunctuality.toFixed(1)}</span>
            </div>
        </div>
        
        ${teacher.courses.length > 0 ? `
            <div class="teacher-courses">
                <div class="courses-label">Teaches:</div>
                <div class="course-tags">
                    ${courseTags}
                    ${moreCoursesText}
                </div>
            </div>
        ` : ''}
    `;

    return card;
}

// Create star rating HTML
function createStars(rating) {
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    let stars = '';

    for (let i = 0; i < 5; i++) {
        if (i < fullStars) {
            stars += '<i class="fas fa-star star"></i>';
        } else if (i === fullStars && hasHalfStar) {
            stars += '<i class="fas fa-star-half-alt star"></i>';
        } else {
            stars += '<i class="fas fa-star star empty"></i>';
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

// Show error message
function showError(message) {
    const grid = document.getElementById('teachersGrid');
    const loading = document.getElementById('loadingSpinner');
    
    loading.style.display = 'none';
    grid.style.display = 'none';
    
    const noResults = document.getElementById('noResults');
    noResults.style.display = 'block';
    noResults.innerHTML = `
        <i class="fas fa-exclamation-triangle"></i>
        <h3>Error</h3>
        <p>${message}</p>
    `;
}
