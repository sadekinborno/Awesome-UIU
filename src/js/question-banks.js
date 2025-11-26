// Question Banks Configuration
const CONFIG = {
    // GitHub Repository
    GITHUB_REPO_URL: 'https://github.com/nurulalamador/UIUQuestionBank',
    GITHUB_API_BASE: 'https://api.github.com/repos/nurulalamador/UIUQuestionBank/contents',
    
    // Question Bank Website (Nurul Alam Ador's UIU Question Bank)
    WEBSITE_URL: 'http://nurulalamador.github.io/UIUQuestionBank/courses.html',
    BASE_URL: 'http://nurulalamador.github.io/UIUQuestionBank',
    
    // Featured courses - manually curated popular courses
    FEATURED_COURSES: [
        {
            code: 'CSE 1115',
            name: 'Object Oriented Programming',
            department: 'CSE',
            files: 15,
            popular: true
        },
        {
            code: 'CSE 2217',
            name: 'Data Structures',
            department: 'CSE',
            files: 12,
            popular: true
        },
        {
            code: 'MAT 1205',
            name: 'Differential Calculus & Coordinate Geometry',
            department: 'MAT',
            files: 18,
            popular: true
        },
        {
            code: 'PHY 1101',
            name: 'Physics I',
            department: 'PHY',
            files: 10,
            popular: false
        },
        {
            code: 'EEE 2113',
            name: 'Circuit Analysis',
            department: 'EEE',
            files: 14,
            popular: true
        },
        {
            code: 'BBA 2101',
            name: 'Principles of Management',
            department: 'BBA',
            files: 8,
            popular: false
        }
    ],
    
    // Department folder mappings
    DEPARTMENTS: {
        'CSE': 'CSE',
        'EEE': 'EEE',
        'CIVIL': 'Civil',
        'BBA': 'BBA',
        'GENERAL': '' // Root or general courses
    }
};

// Initialize page
document.addEventListener('DOMContentLoaded', () => {
    initializePage();
    setupEventListeners();
});

function initializePage() {
    loadFeaturedCourses();
    setupDepartmentCounts();
}

function setupEventListeners() {
    // Search functionality
    const searchInput = document.getElementById('course-search');
    if (searchInput) {
        searchInput.addEventListener('input', handleSearch);
    }
    
    // Main browse button in hero
    const browseMainBtn = document.getElementById('browse-main-btn');
    if (browseMainBtn) {
        browseMainBtn.addEventListener('click', (e) => {
            e.preventDefault();
            window.open(CONFIG.WEBSITE_URL, '_blank');
        });
    }
    
    // GitHub button in hero
    const githubBtn = document.getElementById('github-btn');
    if (githubBtn) {
        githubBtn.addEventListener('click', (e) => {
            e.preventDefault();
            window.open(CONFIG.GITHUB_REPO_URL, '_blank');
        });
    }
    
    // Contribute button (kept for backwards compatibility)
    const contributeBtn = document.getElementById('contribute-btn');
    if (contributeBtn) {
        contributeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            window.open(CONFIG.GITHUB_REPO_URL, '_blank');
        });
    }
}

function loadFeaturedCourses() {
    const container = document.getElementById('featured-courses');
    if (!container) return;
    
    // Clear loading state
    container.innerHTML = '';
    
    // Display featured courses
    CONFIG.FEATURED_COURSES.forEach(course => {
        const courseCard = createCourseCard(course);
        container.appendChild(courseCard);
    });
}

function createCourseCard(course) {
    const card = document.createElement('a');
    card.href = '#';
    card.className = 'course-card';
    card.dataset.course = course.code;
    
    card.innerHTML = `
        <div class="course-header">
            <div class="course-code">${course.code}</div>
            ${course.popular ? '<div class="course-badge">Popular</div>' : ''}
        </div>
        <div class="course-name">${course.name}</div>
        <div class="course-meta">
            <div class="meta-item">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
                    <polyline points="13 2 13 9 20 9"></polyline>
                </svg>
                ${course.files} files
            </div>
            <div class="meta-item">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                </svg>
                ${course.department}
            </div>
        </div>
    `;
    
    card.addEventListener('click', (e) => {
        e.preventDefault();
        // Open the main question bank website
        window.open(CONFIG.WEBSITE_URL, '_blank');
    });
    
    return card;
}

function setupDepartmentCounts() {
    // Count courses per department from featured list
    const counts = {};
    
    CONFIG.FEATURED_COURSES.forEach(course => {
        counts[course.department] = (counts[course.department] || 0) + 1;
    });
    
    // Update department counts (you can modify these manually or fetch from API)
    updateDepartmentCount('cse', counts['CSE'] || 25);
    updateDepartmentCount('eee', counts['EEE'] || 18);
    updateDepartmentCount('civil', counts['CIVIL'] || 15);
    updateDepartmentCount('bba', counts['BBA'] || 20);
    updateDepartmentCount('general', counts['MAT'] + counts['PHY'] || 30);
}

function updateDepartmentCount(deptId, count) {
    const element = document.getElementById(`${deptId}-count`);
    if (element) {
        element.textContent = count;
    }
}

function handleDepartmentClick(e) {
    e.preventDefault();
    const dept = this.dataset.dept;
    
    if (!dept) return;
    
    // Open the question bank website
    window.open(CONFIG.WEBSITE_URL, '_blank');
}

function handleSearch(e) {
    const searchTerm = e.target.value.toLowerCase().trim();
    
    if (!searchTerm) {
        // Show all courses
        document.querySelectorAll('.course-card').forEach(card => {
            card.style.display = '';
        });
        return;
    }
    
    // Filter courses
    document.querySelectorAll('.course-card').forEach(card => {
        const courseCode = card.dataset.course?.toLowerCase() || '';
        const courseName = card.querySelector('.course-name')?.textContent.toLowerCase() || '';
        
        const matches = courseCode.includes(searchTerm) || courseName.includes(searchTerm);
        card.style.display = matches ? '' : 'none';
    });
}

// Optional: Fetch real data from GitHub API
async function fetchDepartmentData(department) {
    try {
        const path = CONFIG.DEPARTMENTS[department];
        const url = `${CONFIG.GITHUB_API_BASE}/${path}`;
        
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch');
        
        const data = await response.json();
        
        // Filter for folders only (courses)
        const courses = data.filter(item => item.type === 'dir');
        
        return courses;
    } catch (error) {
        console.error('Error fetching department data:', error);
        return [];
    }
}

// Optional: Advanced - Load all courses from GitHub API
async function loadAllCoursesFromGitHub() {
    const container = document.getElementById('featured-courses');
    if (!container) return;
    
    container.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Loading courses from GitHub...</p></div>';
    
    try {
        // Fetch courses from all departments
        const allCourses = [];
        
        for (const [dept, path] of Object.entries(CONFIG.DEPARTMENTS)) {
            const courses = await fetchDepartmentData(dept);
            courses.forEach(course => {
                allCourses.push({
                    code: course.name,
                    name: course.name.replace(/_/g, ' '),
                    department: dept,
                    url: course.html_url,
                    files: 0 // Would need additional API call to count
                });
            });
        }
        
        // Display courses
        container.innerHTML = '';
        allCourses.slice(0, 6).forEach(course => {
            const card = createCourseCard(course);
            container.appendChild(card);
        });
        
    } catch (error) {
        console.error('Error loading courses:', error);
        container.innerHTML = '<div class="loading-state"><p>Failed to load courses. Please try again later.</p></div>';
    }
}

// Uncomment below to use GitHub API instead of manual featured courses
// document.addEventListener('DOMContentLoaded', () => {
//     loadAllCoursesFromGitHub();
// });
