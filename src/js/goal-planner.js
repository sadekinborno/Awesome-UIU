// ============================================
// CGPA Goal Planner - JavaScript
// ============================================

// ============================================
// UIU Grading System
// ============================================
const gradeSystem = {
    'A': { point: 4.0, range: '90-100' },
    'A-': { point: 3.67, range: '86-89' },
    'B+': { point: 3.33, range: '82-85' },
    'B': { point: 3.0, range: '78-81' },
    'B-': { point: 2.67, range: '74-77' },
    'C+': { point: 2.33, range: '70-73' },
    'C': { point: 2.0, range: '66-69' },
    'C-': { point: 1.67, range: '62-65' },
    'D+': { point: 1.33, range: '58-61' },
    'D': { point: 1.0, range: '55-57' },
    'F': { point: 0.0, range: 'Below 55' }
};

// ============================================
// State Management
// ============================================
let currentState = {
    department: '',
    totalCredits: 0,
    currentCGPA: 0,
    completedCredits: 0,
    targetCGPA: 0,
    remainingCredits: 0,
    requiredGPA: 0,
    difficulty: '',
    retakeCourses: []
};

let retakeCourseCount = 0;

// ============================================
// DOM Elements
// ============================================
const elements = {
    // Form inputs
    department: document.getElementById('department'),
    currentCGPA: document.getElementById('currentCGPA'),
    completedCredits: document.getElementById('completedCredits'),
    targetCGPA: document.getElementById('targetCGPA'),
    calculateBtn: document.getElementById('calculateBtn'),
    
    // Results section
    resultsSection: document.getElementById('resultsSection'),
    remainingCredits: document.getElementById('remainingCredits'),
    requiredGPA: document.getElementById('requiredGPA'),
    difficultyLevel: document.getElementById('difficultyLevel'),
    meterFill: document.getElementById('meterFill'),
    resultMessage: document.getElementById('resultMessage'),
    actionButtons: document.getElementById('actionButtons'),
    
    // Retake section
    retakeSection: document.getElementById('retakeSection'),
    retakeForm: document.getElementById('retakeForm'),
    addRetakeBtn: document.getElementById('addRetakeBtn'),
    simulateRetakesBtn: document.getElementById('simulateRetakesBtn'),
    retakeResults: document.getElementById('retakeResults'),
    
    // GIF section
    gifSection: document.getElementById('gifSection'),
    gifContainer: document.getElementById('gifContainer'),
    closeGifBtn: document.getElementById('closeGifBtn'),
    
    // Audio
    gigachadAudio: document.getElementById('gigachadAudio'),
    dripgokuAudio: document.getElementById('dripgokuAudio'),
    therockAudio: document.getElementById('therockAudio'),
    
    // Start over
    startOverContainer: document.getElementById('startOverContainer'),
    startOverBtn: document.getElementById('startOverBtn')
};

// ============================================
// Tenor GIF Pools
// ============================================
const HARD_MODE_YES_GIFS = [
    {
        postId: '15830436',
        aspectRatio: '0.99375',
        href: 'https://tenor.com/view/gym-dance-workout-treadmill-gif-15830436',
        title: 'Gym Dance GIF',
        searchHref: 'https://tenor.com/search/gym-gifs',
        searchTitle: 'Gym GIFs'
    },
    {
        postId: '2441191202035217238',
        aspectRatio: '1.13402',
        href: 'https://tenor.com/view/tom-and-jerry-tom-strong-jerry-strong-tom-gym-gif-2441191202035217238',
        title: 'Tom And Jerry Tom Strong GIF',
        searchHref: 'https://tenor.com/search/tom+and+jerry-gifs',
        searchTitle: 'Tom And Jerry GIFs'
    }
];

function pickRandomItem(items) {
    return items[Math.floor(Math.random() * items.length)];
}

// ============================================
// Event Listeners
// ============================================
elements.calculateBtn.addEventListener('click', handleCalculate);
elements.addRetakeBtn.addEventListener('click', addRetakeCourse);
elements.simulateRetakesBtn.addEventListener('click', handleSimulateRetakes);
elements.closeGifBtn.addEventListener('click', closeGif);
elements.startOverBtn.addEventListener('click', startOver);

// Preload audio files when page loads
document.addEventListener('DOMContentLoaded', function() {
    elements.gigachadAudio.load();
    elements.dripgokuAudio.load();
    elements.therockAudio.load();
});

// ============================================
// Retake Course Management
// ============================================
function createGradeOptions() {
    let options = '<option value="">Original Grade</option>';
    for (const [grade, data] of Object.entries(gradeSystem)) {
        options += `<option value="${data.point}">${grade} (${data.point.toFixed(2)})</option>`;
    }
    return options;
}

function addRetakeCourse() {
    retakeCourseCount++;
    const courseNumber = document.querySelectorAll('.retake-course').length + 1;
    
    const courseHTML = `
        <div class="retake-course" data-course-id="${retakeCourseCount}">
            <div class="retake-course-header">
                <h3>Course ${courseNumber}</h3>
                ${courseNumber > 1 ? `
                    <button class="remove-course-btn" onclick="removeRetakeCourse(${retakeCourseCount})">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                        Remove
                    </button>
                ` : ''}
            </div>
            <div class="retake-inputs">
                <input type="text" placeholder="Course Name(Optional)" class="input-field retake-name">
                <input type="number" placeholder="Credits" class="input-field retake-credits" step="0.5" min="0.5">
                <select class="input-field retake-grade">
                    ${createGradeOptions()}
                </select>
            </div>
        </div>
    `;
    
    elements.retakeForm.insertAdjacentHTML('beforeend', courseHTML);
    updateCourseNumbers();
}

function removeRetakeCourse(courseId) {
    const course = document.querySelector(`[data-course-id="${courseId}"]`);
    if (course) {
        course.remove();
        updateCourseNumbers();
    }
}

function updateCourseNumbers() {
    const courses = document.querySelectorAll('.retake-course');
    courses.forEach((course, index) => {
        const header = course.querySelector('.retake-course-header h3');
        if (header) {
            header.textContent = `Course ${index + 1}`;
        }
    });
}

function initializeRetakeCourses() {
    elements.retakeForm.innerHTML = '';
    retakeCourseCount = 0;
    // Add 2 default courses
    addRetakeCourse();
    addRetakeCourse();
}

// Make removeRetakeCourse globally accessible
window.removeRetakeCourse = removeRetakeCourse;

// ============================================
// Main Calculation Function
// ============================================
function handleCalculate() {
    // Validate inputs
    if (!validateInputs()) {
        return;
    }
    
    // Get values
    currentState.department = elements.department.value;
    currentState.totalCredits = parseFloat(elements.department.value);
    currentState.currentCGPA = parseFloat(elements.currentCGPA.value);
    currentState.completedCredits = parseFloat(elements.completedCredits.value);
    currentState.targetCGPA = parseFloat(elements.targetCGPA.value);
    
    // Calculate remaining credits
    currentState.remainingCredits = currentState.totalCredits - currentState.completedCredits;
    
    // Calculate current grade points
    const currentGradePoints = currentState.currentCGPA * currentState.completedCredits;
    
    // Calculate required grade points for target
    const targetGradePoints = currentState.targetCGPA * currentState.totalCredits;
    
    // Calculate required grade points from remaining credits
    const requiredGradePoints = targetGradePoints - currentGradePoints;
    
    // Calculate required GPA for remaining credits
    currentState.requiredGPA = requiredGradePoints / currentState.remainingCredits;
    
    // Determine difficulty
    analyzeDifficulty();
    
    // Display results
    displayResults();
}

// ============================================
// Input Validation
// ============================================
function validateInputs() {
    const dept = elements.department.value;
    const current = parseFloat(elements.currentCGPA.value);
    const completed = parseFloat(elements.completedCredits.value);
    const target = parseFloat(elements.targetCGPA.value);
    
    if (!dept) {
        alert('Please select your department');
        return false;
    }
    
    if (isNaN(current) || current < 0 || current > 4) {
        alert('Please enter a valid current CGPA (0-4)');
        return false;
    }
    
    if (isNaN(completed) || completed <= 0) {
        alert('Please enter valid completed credits');
        return false;
    }
    
    if (isNaN(target) || target < 0 || target > 4) {
        alert('Please enter a valid target CGPA (0-4)');
        return false;
    }
    
    if (completed >= parseFloat(dept)) {
        alert('Completed credits cannot exceed or equal total credits for your department');
        return false;
    }
    
    if (target <= current) {
        alert('Target CGPA must be higher than current CGPA');
        return false;
    }
    
    return true;
}

// ============================================
// Difficulty Analysis
// ============================================
function analyzeDifficulty() {
    const required = currentState.requiredGPA;
    
    if (required > 4.00) {
        currentState.difficulty = 'impossible';
    } else if (required >= 3.80) {
        // Check if 90%+ need 4.00
        const perfectCreditsNeeded = (currentState.requiredGPA - 3.00) / (4.00 - 3.00) * currentState.remainingCredits;
        const percentageNeeded = (perfectCreditsNeeded / currentState.remainingCredits) * 100;
        
        if (percentageNeeded >= 90) {
            currentState.difficulty = 'beast';
        } else {
            currentState.difficulty = 'hard';
        }
    } else if (required >= 3.50) {
        currentState.difficulty = 'hard';
    } else if (required >= 3.20) {
        currentState.difficulty = 'moderate';
    } else {
        currentState.difficulty = 'easy';
    }
}

// ============================================
// Display Results
// ============================================
function displayResults() {
    // Update stats
    elements.remainingCredits.textContent = currentState.remainingCredits.toFixed(1);
    elements.requiredGPA.textContent = currentState.requiredGPA.toFixed(2);
    elements.difficultyLevel.textContent = getDifficultyEmoji();
    
    // Update meter
    updateDifficultyMeter();
    
    // Display message based on difficulty
    displayResultMessage();
    
    // Show results section
    elements.resultsSection.classList.remove('hidden');
    elements.startOverContainer.classList.remove('hidden');
    
    // Scroll to results
    elements.resultsSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ============================================
// Difficulty Meter
// ============================================
function updateDifficultyMeter() {
    let percentage = 0;
    
    switch (currentState.difficulty) {
        case 'easy':
            percentage = 20;
            break;
        case 'moderate':
            percentage = 40;
            break;
        case 'hard':
            percentage = 60;
            break;
        case 'beast':
            percentage = 80;
            break;
        case 'impossible':
            percentage = 100;
            break;
    }
    
    elements.meterFill.style.width = percentage + '%';
}

// ============================================
// Difficulty Emoji
// ============================================
function getDifficultyEmoji() {
    const emojis = {
        easy: '🟢 Easy Peasy',
        moderate: '🟡 Moderate',
        hard: '🟠 Hard Mode',
        beast: '🔴 BEAST MODE',
        impossible: '⚫ Impossible'
    };
    
    return emojis[currentState.difficulty] || '-';
}

// ============================================
// Result Messages
// ============================================
function displayResultMessage() {
    const { difficulty, requiredGPA, remainingCredits, targetCGPA } = currentState;
    
    let messageHTML = '';
    let messageClass = '';
    let buttons = '';
    
    switch (difficulty) {
        case 'easy':
            messageClass = 'success';
            messageHTML = `
                <h3>✅ Excellent News!</h3>
                <p>Your target CGPA of <strong>${targetCGPA.toFixed(2)}</strong> is very achievable!</p>
                <p>You need an average GPA of <strong>${requiredGPA.toFixed(2)}</strong> in your remaining ${remainingCredits.toFixed(1)} credits.</p>
                <p>💡 <strong>Strategy:</strong> Stay consistent with your current performance and you'll reach your goal!</p>
            `;
            buttons = `
                <button class="secondary-btn" onclick="startOver()">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
                        <path d="M21 3v5h-5"/>
                    </svg>
                    Try Another Goal
                </button>
            `;
            break;
            
        case 'moderate':
            messageClass = 'warning';
            messageHTML = `
                <h3>⚠️ Challenging But Doable!</h3>
                <p>Your target CGPA of <strong>${targetCGPA.toFixed(2)}</strong> requires solid effort.</p>
                <p>You need an average GPA of <strong>${requiredGPA.toFixed(2)}</strong> in your remaining ${remainingCredits.toFixed(1)} credits.</p>
                <p>💡 <strong>Strategy:</strong> Focus on your studies, manage your time well, and aim for B+ or higher in most courses.</p>
            `;
            buttons = `
                <button class="secondary-btn" onclick="startOver()">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
                        <path d="M21 3v5h-5"/>
                    </svg>
                    Try Another Goal
                </button>
            `;
            break;
            
        case 'hard':
            messageClass = 'warning';
            messageHTML = `
                <h3>🔥 Hard Mode Activated!</h3>
                <p>Your target CGPA of <strong>${targetCGPA.toFixed(2)}</strong> will require exceptional performance.</p>
                <p>You need an average GPA of <strong>${requiredGPA.toFixed(2)}</strong> in your remaining ${remainingCredits.toFixed(1)} credits.</p>
                <p>💡 <strong>Strategy:</strong> You'll need mostly A- and A grades.</p>
                <p><strong>Can you handle the HARD MODE challenge?</strong></p>
            `;
            buttons = `
                <button class="primary-btn" onclick="showHardModeYes()">
                    💪 YES, I CAN DO IT!
                </button>
                <button class="secondary-btn" onclick="showHardModeNo()">
                    😰 NO, IT'S TOO HARD
                </button>
                <button class="secondary-btn" onclick="showRetakeSection()">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
                    </svg>
                    Explore Retake Options
                </button>
            `;
            break;
            
        case 'beast':
            messageClass = 'danger';
            const perfectPercentage = calculatePerfectPercentage();
            messageHTML = `
                <h3>💪 BEAST MODE REQUIRED!</h3>
                <p>Your target CGPA of <strong>${targetCGPA.toFixed(2)}</strong> requires LEGENDARY performance!</p>
                <p>You need an average GPA of <strong>${requiredGPA.toFixed(2)}</strong> in your remaining ${remainingCredits.toFixed(1)} credits.</p>
                <p>⚠️ This means getting 4.00 (A) in approximately <strong>${perfectPercentage.toFixed(0)}%</strong> of your remaining courses!</p>
                <p><strong>Are you ready to go full GIGACHAD mode?</strong></p>
            `;
            buttons = `
                <button class="primary-btn" onclick="showGigaChadChallenge()">
                    💪 YES, I'M BUILT DIFFERENT
                </button>
                <button class="secondary-btn" onclick="showRetakeSection()">
                    Maybe Try Retakes First
                </button>
            `;
            break;
            
        case 'impossible':
            messageClass = 'danger';
            messageHTML = `
                <h3>❌ Mathematically Impossible</h3>
                <p>Unfortunately, reaching a CGPA of <strong>${targetCGPA.toFixed(2)}</strong> is not possible with your current standing.</p>
                <p>Even if you get 4.00 (A) in ALL remaining ${remainingCredits.toFixed(1)} credits, you can only reach a maximum CGPA of <strong>${calculateMaxCGPA().toFixed(2)}</strong>.</p>
                <p>💡 <strong>But don't give up!</strong> Let's see if retaking some courses can help...</p>
            `;
            buttons = `
                <button class="primary-btn" onclick="showRetakeSection()">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
                    </svg>
                    Try Retake Simulation
                </button>
                <button class="secondary-btn" onclick="startOver()">Try Lower Target</button>
            `;
            break;
    }
    
    elements.resultMessage.className = `result-message ${messageClass}`;
    elements.resultMessage.innerHTML = messageHTML;
    elements.actionButtons.innerHTML = buttons;
}

// ============================================
// Helper Functions
// ============================================
function calculateMaxCGPA() {
    const currentGradePoints = currentState.currentCGPA * currentState.completedCredits;
    const maxFuturePoints = 4.00 * currentState.remainingCredits;
    return (currentGradePoints + maxFuturePoints) / currentState.totalCredits;
}

function calculatePerfectPercentage() {
    // Calculate what percentage of remaining credits need 4.00
    const currentGradePoints = currentState.currentCGPA * currentState.completedCredits;
    const targetGradePoints = currentState.targetCGPA * currentState.totalCredits;
    const neededPoints = targetGradePoints - currentGradePoints;
    
    // Assume rest get 3.00 (B-)
    const perfectCreditsNeeded = (neededPoints - (3.00 * currentState.remainingCredits)) / (4.00 - 3.00);
    return (perfectCreditsNeeded / currentState.remainingCredits) * 100;
}

// ============================================
// Show GigaChad Challenge
// ============================================
function showGigaChadChallenge() {
    const gigachadGIF = `
        <div class="gif-media-container">
            <div class="tenor-gif-embed" data-postid="7357305683300335917" data-share-method="host" data-aspect-ratio="0.594595" data-width="100%">
                <a href="https://tenor.com/view/tarkov-gif-7357305683300335917">Tarkov GIF</a> from 
                <a href="https://tenor.com/search/tarkov-gifs">Tarkov GIFs</a>
            </div>
        </div>
        <h2 class="gif-title">
            RESPECT! YOU'RE A GIGACHAD!
        </h2>
    `;
    
    elements.gifContainer.innerHTML = gigachadGIF;
    elements.gifSection.classList.remove('hidden');
    
    // Reload Tenor embed script to initialize new GIF
    if (window.TenorEmbed) {
        window.TenorEmbed.init();
    } else {
        const script = document.createElement('script');
        script.type = 'text/javascript';
        script.async = true;
        script.src = 'https://tenor.com/embed.js';
        document.body.appendChild(script);
    }
    
    // Wait for GIF to load and render before playing audio
    setTimeout(() => {
        elements.gigachadAudio.currentTime = 0;
        elements.gigachadAudio.play().catch(err => {
            console.log('Audio play failed:', err);
        });
    }, 500);
    
    // Auto-close when audio ends
    elements.gigachadAudio.onended = () => {
        closeGif();
    };
}

// ============================================
// Show Hard Mode Yes Challenge (Gym Dance)
// ============================================
function showHardModeYes() {
    const selectedGif = pickRandomItem(HARD_MODE_YES_GIFS);

    const hardModeYesGIF = `
        <div class="gif-media-container">
            <div class="tenor-gif-embed" data-postid="${selectedGif.postId}" data-share-method="host" data-aspect-ratio="${selectedGif.aspectRatio}" data-width="100%">
                <a href="${selectedGif.href}">${selectedGif.title}</a> from 
                <a href="${selectedGif.searchHref}">${selectedGif.searchTitle}</a>
            </div>
        </div>
        <h2 class="gif-title">
            LET'S GO! TIME TO GRIND! 💪
        </h2>
    `;
    
    elements.gifContainer.innerHTML = hardModeYesGIF;
    elements.gifSection.classList.remove('hidden');
    
    // Reload Tenor embed script to initialize new GIF
    if (window.TenorEmbed) {
        window.TenorEmbed.init();
    } else {
        const script = document.createElement('script');
        script.type = 'text/javascript';
        script.async = true;
        script.src = 'https://tenor.com/embed.js';
        document.body.appendChild(script);
    }
    
    // Wait for GIF to load and render before playing audio
    setTimeout(() => {
        elements.therockAudio.currentTime = 0;
        elements.therockAudio.play().catch(err => {
            console.log('Audio play failed:', err);
        });
    }, 500);
    
    // Auto-close when audio ends
    elements.therockAudio.onended = () => {
        closeGif();
    };
}

// ============================================
// Show Hard Mode No Challenge (Giving Up)
// ============================================
function showHardModeNo() {
    // First GIF: Shocked reaction
    const shockedGIF = `
        <div class="gif-media-container">
            <div class="tenor-gif-embed" data-postid="2264217522034830192" data-share-method="host" data-aspect-ratio="1.76596" data-width="100%">
                <a href="https://tenor.com/view/black-guy-black-shocked-shocked-black-man-black-gif-2264217522034830192">Black Guy Black Shocked GIF</a> from 
                <a href="https://tenor.com/search/black+guy-gifs">Black Guy GIFs</a>
            </div>
        </div>
        <h2 class="gif-title">
            WAIT, WHAT?! 😱
        </h2>
    `;
    
    elements.gifContainer.innerHTML = shockedGIF;
    elements.gifSection.classList.remove('hidden');
    
    // Reload Tenor embed script to initialize new GIF
    if (window.TenorEmbed) {
        window.TenorEmbed.init();
    } else {
        const script = document.createElement('script');
        script.type = 'text/javascript';
        script.async = true;
        script.src = 'https://tenor.com/embed.js';
        document.body.appendChild(script);
    }
    
    // Wait for GIF to load and render before playing audio
    setTimeout(() => {
        elements.dripgokuAudio.currentTime = 0;
        elements.dripgokuAudio.play().catch(err => {
            console.log('Audio play failed:', err);
        });
    }, 500);
    
    // Auto-close when audio ends
    elements.dripgokuAudio.onended = () => {
        closeGif();
    };
}

// ============================================
// Show Retake Section
// ============================================
function showRetakeSection() {
    initializeRetakeCourses();
    elements.retakeSection.classList.remove('hidden');
    elements.retakeSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ============================================
// Handle Retake Simulation
// ============================================
function handleSimulateRetakes() {
    // Get retake course data
    const retakeCourses = [];
    const courseElements = document.querySelectorAll('.retake-course');
    
    courseElements.forEach((courseEl, index) => {
        const name = courseEl.querySelector('.retake-name').value.trim() || `Course ${index + 1}`;
        const credits = parseFloat(courseEl.querySelector('.retake-credits').value);
        const grade = parseFloat(courseEl.querySelector('.retake-grade').value);
        
        if (!isNaN(credits) && !isNaN(grade) && credits > 0) {
            retakeCourses.push({ name, credits, grade });
        }
    });
    
    if (retakeCourses.length === 0) {
        alert('Please enter at least one course with credits and grade');
        return;
    }
    
    // Simulate retakes
    simulateRetakes(retakeCourses);
}

// ============================================
// Simulate Retakes
// ============================================
function simulateRetakes(courses) {
    const numRetakes = courses.length;
    let resultsHTML = `<h3>📊 Retake Simulation Results (${numRetakes} course${numRetakes > 1 ? 's' : ''})</h3>`;
    
    // Start with current grade points
    let currentGradePoints = currentState.currentCGPA * currentState.completedCredits;
    let simulatedCGPA = currentState.currentCGPA;
    let goalReached = false;
    
    // Sort courses by grade (worst first)
    courses.sort((a, b) => a.grade - b.grade);
    
    courses.forEach((course, index) => {
        // Calculate the impact of retaking this course
        // Remove old grade points and add new grade points (4.00)
        const oldPoints = course.grade * course.credits;
        const newPoints = 4.00 * course.credits;
        
        // Update total points by removing old and adding new
        currentGradePoints = currentGradePoints - oldPoints + newPoints;
        
        // Calculate new CGPA (credits stay the same, just points change)
        simulatedCGPA = currentGradePoints / currentState.completedCredits;
        
        // Check if we've reached the target already
        if (simulatedCGPA >= currentState.targetCGPA && !goalReached) {
            goalReached = true;
        }
        
        // Find grade letter from point
        let oldGradeLetter = 'F';
        for (const [letter, data] of Object.entries(gradeSystem)) {
            if (Math.abs(data.point - course.grade) < 0.01) {
                oldGradeLetter = letter;
                break;
            }
        }
        
        const stepClass = (simulatedCGPA >= currentState.targetCGPA) ? 'success' : 'warning';
        const statusIcon = (simulatedCGPA >= currentState.targetCGPA) ? '✅' : '⚠️';
        
        resultsHTML += `
            <div class="retake-step ${stepClass}">
                <strong>After Retake ${index + 1}:</strong> ${course.name} (${oldGradeLetter} ${course.grade.toFixed(2)} → A 4.00, ${course.credits} credits)
                <br>
                <span style="color: var(--text-secondary);">New CGPA: <strong style="color: ${simulatedCGPA >= currentState.targetCGPA ? 'var(--success-green)' : 'var(--warning-yellow)'};">${simulatedCGPA.toFixed(2)}</strong> ${statusIcon} ${simulatedCGPA >= currentState.targetCGPA ? 'Target achieved!' : 'Still below target of ' + currentState.targetCGPA.toFixed(2)}</span>
            </div>
        `;
    });
    
    // Calculate maximum achievable CGPA with perfect grades in remaining credits
    const maxPossiblePoints = currentGradePoints + (currentState.remainingCredits * 4.00);
    const maxPossibleCGPA = maxPossiblePoints / currentState.totalCredits;
    
    // Use a small tolerance for floating point comparison
    const tolerance = 0.005;
    
    // Final verdict
    if (goalReached) {
        resultsHTML += `
            <div class="final-analysis">
                <h4>🎉 Great News!</h4>
                <div class="final-stats">
                    <div class="final-stat-row">
                        <span class="final-stat-label">CGPA After Retakes:</span>
                        <span class="final-stat-value success-gradient">${simulatedCGPA.toFixed(2)}</span>
                    </div>
                    <div class="final-stat-row">
                        <span class="final-stat-label">Your Target:</span>
                        <span class="final-stat-value success-gradient">${currentState.targetCGPA.toFixed(2)} ✅</span>
                    </div>
                </div>
                <p style="color: var(--text-secondary); text-align: center; margin-top: 1rem;">You've already reached your target CGPA with these retakes! Focus on getting those retakes and you're all set! 💪</p>
            </div>
        `;
    } else if (maxPossibleCGPA >= currentState.targetCGPA - tolerance) {
        // Target is achievable with remaining credits
        
        // Calculate percentage of 4.00s needed
        const neededGradePoints = (currentState.targetCGPA * currentState.totalCredits) - currentGradePoints;
        const percentageNeeded = (neededGradePoints / (currentState.remainingCredits * 4.0)) * 100;
        
        resultsHTML += `
            <div class="final-analysis">
                <h4>📈 Final Analysis</h4>
                <div class="final-stats">
                    <div class="final-stat-row">
                        <span class="final-stat-label">After ${numRetakes} Perfect Retake${numRetakes > 1 ? 's' : ''}:</span>
                        <span class="final-stat-value">${simulatedCGPA.toFixed(2)}</span>
                    </div>
                    <div class="final-stat-row">
                        <span class="final-stat-label">Remaining Credits:</span>
                        <span class="final-stat-value">${currentState.remainingCredits.toFixed(1)}</span>
                    </div>
                    <div class="final-stat-row">
                        <span class="final-stat-label">Maximum Achievable CGPA:</span>
                        <span class="final-stat-value success-gradient">${maxPossibleCGPA.toFixed(2)} ✅</span>
                    </div>
                    <div class="final-stat-row">
                        <span class="final-stat-label">Your Target:</span>
                        <span class="final-stat-value success-gradient">${currentState.targetCGPA.toFixed(2)} ✅</span>
                    </div>
                </div>
        `;
        
        if (percentageNeeded >= 90) {
            // BEAST MODE
            resultsHTML += `
                <div class="beast-mode-banner">
                    <div class="beast-mode-grid">
                        <div class="beast-mode-left">
                            <div class="beast-icon">💪</div>
                            <h4>BEAST<br>MODE</h4>
                        </div>
                        <div class="beast-mode-right">
                            <div class="beast-stat">
                                <span class="beast-number">${percentageNeeded.toFixed(0)}%</span>
                                <span class="beast-label">of your remaining courses need A (4.00)</span>
                            </div>
                            <p style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 0.5rem;">
                                Requires legendary focus 🔥
                            </p>
                        </div>
                    </div>
                    <p class="beast-mode-question">Do you think you can do it?</p>
                    <div class="gigachad-buttons">
                        <button class="gigachad-yes" onclick="showGigaChadChallenge()">
                            💪 LET'S GO!
                        </button>
                        <button class="gigachad-no" onclick="elements.retakeResults.classList.add('hidden')">
                            🤔 MAYBE NOT
                        </button>
                    </div>
                </div>
            `;
        } else {
            resultsHTML += `
                <p style="color: var(--text-secondary); text-align: center; margin-top: 1rem;">✅ Your target is achievable! You need to maintain approximately <strong>${percentageNeeded.toFixed(0)}%</strong> A grades in your remaining ${currentState.remainingCredits.toFixed(1)} credits. Stay focused and you can reach your goal! 🎯</p>
            `;
        }
        
        resultsHTML += `</div>`;
    } else {
        resultsHTML += `
            <div class="final-analysis" style="background: linear-gradient(135deg, rgba(255, 107, 107, 0.1), rgba(255, 152, 0, 0.1)); border-color: var(--danger-red);">
                <h4>😢 Reality Check</h4>
                <div class="final-stats">
                    <div class="final-stat-row">
                        <span class="final-stat-label">After ${numRetakes} Perfect Retake${numRetakes > 1 ? 's' : ''}:</span>
                        <span class="final-stat-value">${simulatedCGPA.toFixed(2)}</span>
                    </div>
                    <div class="final-stat-row">
                        <span class="final-stat-label">Remaining Credits:</span>
                        <span class="final-stat-value">${currentState.remainingCredits.toFixed(1)}</span>
                    </div>
                    <div class="final-stat-row">
                        <span class="final-stat-label">Maximum Achievable CGPA:</span>
                        <span class="final-stat-value">${maxPossibleCGPA.toFixed(2)}</span>
                    </div>
                    <div class="final-stat-row">
                        <span class="final-stat-label">Your Target:</span>
                        <span class="final-stat-value" style="color: var(--danger-red);">${currentState.targetCGPA.toFixed(2)} ❌</span>
                    </div>
                </div>
                <p style="margin-top: 1rem; color: var(--text-secondary);">💡 <strong>Consider:</strong></p>
                <ul style="margin-left: 1.5rem; color: var(--text-secondary); text-align: left;">
                    <li>Retaking more courses with lower grades</li>
                    <li>Adjusting your target CGPA to ${maxPossibleCGPA.toFixed(2)}</li>
                </ul>
                <button class="primary-btn" onclick="showGiveUpGif()" style="margin-top: 1rem;">
                    I Understand 😔
                </button>
            </div>
        `;
    }
    
    elements.retakeResults.innerHTML = resultsHTML;
    elements.retakeResults.classList.remove('hidden');
}

// ============================================
// Show Give Up GIF
// ============================================
function showGiveUpGif() {
    const giveUpGIF = `
        <img src="https://media.giphy.com/media/26FPCXdkvDbKBbgOI/giphy.gif" 
             alt="Give Up" 
             style="max-width: 100%; border-radius: 16px;">
        <h2 style="margin-top: 20px; font-size: 2rem; text-align: center;">
            Sometimes We Need to Be Realistic 💭
        </h2>
        <p style="text-align: center; margin-top: 10px; font-size: 1.2rem; color: var(--text-secondary);">
            But hey, CGPA isn't everything! Focus on learning and skills. 💪<br>
            Set a more achievable target and crush it!
        </p>
    `;
    
    elements.gifContainer.innerHTML = giveUpGIF;
    elements.gifSection.classList.remove('hidden');
}

// ============================================
// Close GIF
// ============================================
function closeGif() {
    elements.gifSection.classList.add('hidden');
    
    // Pause and reset all audio elements
    elements.gigachadAudio.pause();
    elements.gigachadAudio.currentTime = 0;
    
    elements.dripgokuAudio.pause();
    elements.dripgokuAudio.currentTime = 0;
    
    elements.therockAudio.pause();
    elements.therockAudio.currentTime = 0;
}

// ============================================
// Start Over
// ============================================
function startOver() {
    // Reset form
    elements.department.value = '';
    elements.currentCGPA.value = '';
    elements.completedCredits.value = '';
    elements.targetCGPA.value = '';
    
    // Hide sections
    elements.resultsSection.classList.add('hidden');
    elements.retakeSection.classList.add('hidden');
    elements.startOverContainer.classList.add('hidden');
    elements.retakeResults.classList.add('hidden');
    
    // Reset retake form
    elements.retakeForm.innerHTML = '';
    retakeCourseCount = 0;
    
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ============================================
// Initialize
// ============================================
console.log('CGPA Goal Planner initialized! 🚀');
initializeRetakeCourses();
