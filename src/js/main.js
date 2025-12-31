class CGPACalculatorApp {
    constructor() {
        this.courses = [];
        this.courseCount = 0;
        this.initializeElements();
        this.attachEventListeners();
        const hasSavedCourses = this.loadSavedData();
        if (!hasSavedCourses) {
            this.addInitialCourses();
        }
    }

    initializeElements() {
        // Input elements
        this.totalCreditsInput = document.getElementById('total-credits');
        this.currentCgpaInput = document.getElementById('current-cgpa');
        
        // Containers
        this.coursesContainer = document.getElementById('courses-container');
        
        // Buttons
        this.addCourseBtn = document.getElementById('add-course-btn');
        this.addRetakeBtn = document.getElementById('add-retake-btn');
        this.calculateBtn = document.getElementById('calculate-btn');
        this.resetBtn = document.getElementById('reset-btn');
        
        // Result elements
        this.resultSection = document.getElementById('result-section');
        this.resultDisplay = document.getElementById('result-display');
    }

    attachEventListeners() {
        // Add course button
        this.addCourseBtn.addEventListener('click', () => {
            this.addCourseSlot();
        });

        // Add retake button
        this.addRetakeBtn.addEventListener('click', () => {
            this.addRetakeSlot();
        });

        // Calculate button
        this.calculateBtn.addEventListener('click', () => {
            this.calculateResults();
        });

        // Reset button
        this.resetBtn.addEventListener('click', () => {
            this.resetAll();
        });

        // Auto-save
        this.totalCreditsInput.addEventListener('input', () => this.autoSave());
        this.currentCgpaInput.addEventListener('input', () => this.autoSave());
    }

    addInitialCourses() {
        // Add 5 initial course slots
        for (let i = 0; i < 5; i++) {
            this.addCourseSlot();
        }
    }

    addCourseSlot() {
        this.courseCount++;
        const courseItem = document.createElement('div');
        courseItem.className = 'course-item';
        courseItem.setAttribute('data-type', 'regular');
        courseItem.innerHTML = `
            <div class="course-header">
                <div class="course-info">
                    <div class="course-number">Course ${this.courseCount}</div>
                    <div class="course-type">Regular Course</div>
                </div>
            </div>
            <button class="remove-course" onclick="app.removeCourseSlot(this)" title="Remove Course">×</button>
            <div class="course-inputs">
                <div class="course-field">
                    <label>Credits</label>
                    <select class="course-credit" data-placeholder="Credit">
                        <option value="">Select Credits</option>
                        <option value="1">1.0</option>
                        <option value="2">2.0</option>
                        <option value="3" selected>3.0</option>
                        <option value="4.5">4.5</option>
                    </select>
                </div>
                <div class="course-field">
                    <label>Grade</label>
                    <select class="course-grade" data-placeholder="Grade">
                        <option value="">Select Grade</option>
                        <option value="A" selected>A (4.0)</option>
                        <option value="A-">A- (3.67)</option>
                        <option value="B+">B+ (3.33)</option>
                        <option value="B">B (3.0)</option>
                        <option value="B-">B- (2.67)</option>
                        <option value="C+">C+ (2.33)</option>
                        <option value="C">C (2.0)</option>
                        <option value="C-">C- (1.67)</option>
                        <option value="D+">D+ (1.33)</option>
                        <option value="D">D (1.0)</option>
                        <option value="F">F (0.0)</option>
                    </select>
                </div>
            </div>
        `;
        
        this.coursesContainer.appendChild(courseItem);
        this.updateEmptyState();
        this.autoSave();
    }

    addRetakeSlot() {
        this.courseCount++;
        const courseItem = document.createElement('div');
        courseItem.className = 'course-item retake-course';
        courseItem.setAttribute('data-type', 'retake');
        courseItem.innerHTML = `
            <div class="course-header">
                <div class="course-info">
                    <div class="course-number">Retake ${this.getRetakeCount() + 1}</div>
                    <div class="course-type retake">Retake Course</div>
                </div>
            </div>
            <button class="remove-course" onclick="app.removeCourseSlot(this)" title="Remove Retake">×</button>
            <div class="retake-inputs">
                <div class="course-field">
                    <label>Credits</label>
                    <select class="course-credit" data-placeholder="Credit">
                        <option value="">Select Credits</option>
                        <option value="1">1.0</option>
                        <option value="2">2.0</option>
                        <option value="3" selected>3.0</option>
                        <option value="4.5">4.5</option>
                    </select>
                </div>
                <div class="course-field">
                    <label>Previous Grade</label>
                    <select class="old-grade" data-placeholder="Old Grade">
                        <option value="">Previous Grade</option>
                        <option value="A">A (4.0)</option>
                        <option value="A-">A- (3.67)</option>
                        <option value="B+">B+ (3.33)</option>
                        <option value="B">B (3.0)</option>
                        <option value="B-">B- (2.67)</option>
                        <option value="C+">C+ (2.33)</option>
                        <option value="C">C (2.0)</option>
                        <option value="C-">C- (1.67)</option>
                        <option value="D+">D+ (1.33)</option>
                        <option value="D">D (1.0)</option>
                        <option value="F" selected>F (0.0)</option>
                    </select>
                </div>
                <div class="course-field">
                    <label>Expected Grade</label>
                    <select class="new-grade" data-placeholder="New Grade">
                        <option value="">Expected Grade</option>
                        <option value="A" selected>A (4.0)</option>
                        <option value="A-">A- (3.67)</option>
                        <option value="B+">B+ (3.33)</option>
                        <option value="B">B (3.0)</option>
                        <option value="B-">B- (2.67)</option>
                        <option value="C+">C+ (2.33)</option>
                        <option value="C">C (2.0)</option>
                        <option value="C-">C- (1.67)</option>
                        <option value="D+">D+ (1.33)</option>
                        <option value="D">D (1.0)</option>
                        <option value="F">F (0.0)</option>
                    </select>
                </div>
            </div>
        `;
        
        this.coursesContainer.appendChild(courseItem);
        this.renumberCourses();
        this.updateEmptyState();
        this.autoSave();
        this.showAlert('Added retake course slot', 'success');
    }

    getRetakeCount() {
        return this.coursesContainer.querySelectorAll('.course-item[data-type="retake"]').length;
    }

    removeCourseSlot(button) {
        const courseItem = button.closest('.course-item');
        courseItem.remove();
        this.renumberCourses();
        this.updateEmptyState();
        this.autoSave();
    }

    renumberCourses() {
        const regularCourses = this.coursesContainer.querySelectorAll('.course-item[data-type="regular"]');
        const retakeCourses = this.coursesContainer.querySelectorAll('.course-item[data-type="retake"]');
        
        regularCourses.forEach((item, index) => {
            item.querySelector('.course-number').textContent = `Course ${index + 1}`;
        });
        
        retakeCourses.forEach((item, index) => {
            item.querySelector('.course-number').textContent = `Retake ${index + 1}`;
        });
        
        this.courseCount = regularCourses.length + retakeCourses.length;
    }

    updateEmptyState() {
        const courseItems = this.coursesContainer.querySelectorAll('.course-item');
        if (courseItems.length === 0) {
            this.coursesContainer.innerHTML = `
                <div class="empty-state">
                    <span class="empty-state-icon">📚</span>
                    <div class="empty-state-text">No courses added yet</div>
                    <div class="empty-state-subtext">Click "Add Course" or "Add Retake" to start</div>
                </div>
            `;
        }
    }

    resetAll() {
        if (confirm('Are you sure you want to reset everything? This will clear all your data.')) {
            // Clear inputs
            this.totalCreditsInput.value = '';
            this.currentCgpaInput.value = '';
            
            // Clear courses
            this.coursesContainer.innerHTML = '';
            this.courseCount = 0;
            
            // Hide results
            this.resultSection.style.display = 'none';
            
            // Add initial courses
            this.addInitialCourses();
            
            // Clear storage
            if (isStorageAvailable()) {
                clearStorage();
            }
            
            this.showAlert('All data has been reset', 'info');
        }
    }

    calculateResults() {
        // Get current academic status
        const totalCredits = parseFloat(this.totalCreditsInput.value) || 0;
        const currentCgpa = parseFloat(this.currentCgpaInput.value) || 0;

        if (totalCredits < 0 || currentCgpa < 0 || currentCgpa > 4) {
            this.showAlert('Please enter valid academic information', 'error');
            return;
        }

        // Get regular courses and retakes from UI
        const newCourses = [];
        const retakeCourses = [];
        const courseItems = this.coursesContainer.querySelectorAll('.course-item');
        
        courseItems.forEach((item, index) => {
            const courseType = item.getAttribute('data-type');
            
            if (courseType === 'regular') {
                const creditSelect = item.querySelector('.course-credit');
                const gradeSelect = item.querySelector('.course-grade');
                
                const credits = parseFloat(creditSelect.value);
                const grade = gradeSelect.value;

                if (credits && grade) {
                    const course = {
                        name: `Course ${newCourses.length + 1}`,
                        credits: credits,
                        grade: grade,
                        gradePoints: getGradePoints(grade)
                    };
                    newCourses.push(course);
                }
            } else if (courseType === 'retake') {
                const creditSelect = item.querySelector('.course-credit');
                const oldGradeSelect = item.querySelector('.old-grade');
                const newGradeSelect = item.querySelector('.new-grade');
                
                const credits = parseFloat(creditSelect.value);
                const oldGrade = oldGradeSelect.value;
                const newGrade = newGradeSelect.value;

                if (credits && oldGrade && newGrade) {
                    const retake = {
                        name: `Retake ${retakeCourses.length + 1}`,
                        credits: credits,
                        oldGrade: oldGrade,
                        newGrade: newGrade,
                        oldGradePoints: getGradePoints(oldGrade),
                        newGradePoints: getGradePoints(newGrade),
                        improvement: getGradePoints(newGrade) - getGradePoints(oldGrade)
                    };
                    retakeCourses.push(retake);
                }
            }
        });

        if (newCourses.length === 0 && retakeCourses.length === 0) {
            this.showAlert('Please add at least one course or retake', 'warning');
            return;
        }

        // Calculate results
        const results = this.calculateDetailedResults(totalCredits, currentCgpa, newCourses, retakeCourses);
        this.displayResults(results);
        this.resultSection.style.display = 'block';
        this.resultSection.scrollIntoView({ behavior: 'smooth' });
        this.autoSave();
    }

    calculateDetailedResults(totalCredits, currentCgpa, newCourses, retakeCourses) {
        // Current semester GPA
        const currentSemesterGPA = newCourses.length > 0 ? calculateCGPA(newCourses, 0) : 0;
        
        // Calculate potential CGPA
        const currentGradePoints = totalCredits * currentCgpa;
        
        // Grade points from new courses
        let newCoursesGradePoints = 0;
        let newCoursesCredits = 0;
        newCourses.forEach(course => {
            newCoursesGradePoints += course.gradePoints * course.credits;
            newCoursesCredits += course.credits;
        });

        // Grade points improvement from retakes
        let retakeImprovementPoints = 0;
        retakeCourses.forEach(retake => {
            retakeImprovementPoints += retake.improvement * retake.credits;
        });

        const totalFutureCredits = totalCredits + newCoursesCredits;
        const totalGradePoints = currentGradePoints + newCoursesGradePoints + retakeImprovementPoints;
        
        const potentialCGPA = totalFutureCredits > 0 ? totalGradePoints / totalFutureCredits : 0;
        const cgpaChange = potentialCGPA - currentCgpa;

        return {
            currentCGPA: currentCgpa,
            currentSemesterGPA: currentSemesterGPA,
            potentialCGPA: potentialCGPA,
            totalCompletedCredits: totalCredits,
            newCoursesCredits: newCoursesCredits,
            totalFutureCredits: totalFutureCredits,
            coursesCount: newCourses.length,
            retakesCount: retakeCourses.length,
            cgpaChange: cgpaChange,
            retakeImprovement: retakeImprovementPoints
        };
    }

    displayResults(results) {
        const cgpaChange = results.cgpaChange;
        const changeText = cgpaChange > 0 ? `+${cgpaChange.toFixed(3)}` : cgpaChange.toFixed(3);
        const changeColor = cgpaChange > 0 ? '#10b981' : cgpaChange < 0 ? '#ef4444' : '#6b7280';

        this.resultDisplay.innerHTML = `
            <div class="result-grid">
                <div class="result-card">
                    <div class="result-label">Current Semester GPA</div>
                    <div class="result-value">${results.currentSemesterGPA.toFixed(2)}</div>
                    <div class="result-description">${results.coursesCount} courses</div>
                </div>
                
                <div class="result-card">
                    <div class="result-label">Potential CGPA</div>
                    <div class="result-value">${results.potentialCGPA.toFixed(2)}</div>
                    <div class="result-description" style="color: ${changeColor};">
                        ${changeText} change
                    </div>
                </div>
                
                <div class="result-card">
                    <div class="result-label">Total Credits</div>
                    <div class="result-value">${results.totalFutureCredits}</div>
                    <div class="result-description">
                        +${results.newCoursesCredits} new credits
                    </div>
                </div>
                
                ${results.retakesCount > 0 ? `
                <div class="result-card">
                    <div class="result-label">Retake Improvement</div>
                    <div class="result-value">+${results.retakeImprovement.toFixed(2)}</div>
                    <div class="result-description">${results.retakesCount} retakes</div>
                </div>
                ` : ''}
            </div>
        `;
    }

    autoSave() {
        if (isStorageAvailable()) {
            const data = {
                totalCredits: this.totalCreditsInput.value,
                currentCGPA: this.currentCgpaInput.value,
                courses: this.getCoursesFromUI()
            };
            saveToStorage(data);
        }
    }

    getCoursesFromUI() {
        const courses = [];
        const courseItems = this.coursesContainer.querySelectorAll('.course-item');
        
        courseItems.forEach((item, index) => {
            const courseType = item.getAttribute('data-type');
            
            if (courseType === 'regular') {
                const creditSelect = item.querySelector('.course-credit');
                const gradeSelect = item.querySelector('.course-grade');
                
                courses.push({
                    type: 'regular',
                    credits: creditSelect.value,
                    grade: gradeSelect.value
                });
            } else if (courseType === 'retake') {
                const creditSelect = item.querySelector('.course-credit');
                const oldGradeSelect = item.querySelector('.old-grade');
                const newGradeSelect = item.querySelector('.new-grade');
                
                courses.push({
                    type: 'retake',
                    credits: creditSelect.value,
                    oldGrade: oldGradeSelect.value,
                    newGrade: newGradeSelect.value
                });
            }
        });
        
        return courses;
    }

    loadSavedData() {
        if (!isStorageAvailable()) {
            return false;
        }

        const savedData = loadFromStorage();
        if (!savedData) {
            return false;
        }

        this.totalCreditsInput.value = savedData.totalCredits || '';
        this.currentCgpaInput.value = savedData.currentCGPA || '';

        const hasSavedCourses = !!(savedData.courses && savedData.courses.length > 0);

        if (hasSavedCourses) {
            // Clear any initial markup
            this.coursesContainer.innerHTML = '';
            this.courseCount = 0;

            // Add saved courses
            savedData.courses.forEach(course => {
                if (course.type === 'retake') {
                    this.addRetakeSlot();
                    const lastItem = this.coursesContainer.lastElementChild;
                    if (course.credits) {
                        lastItem.querySelector('.course-credit').value = course.credits;
                    }
                    if (course.oldGrade) {
                        lastItem.querySelector('.old-grade').value = course.oldGrade;
                    }
                    if (course.newGrade) {
                        lastItem.querySelector('.new-grade').value = course.newGrade;
                    }
                } else {
                    this.addCourseSlot();
                    const lastItem = this.coursesContainer.lastElementChild;
                    if (course.credits) {
                        lastItem.querySelector('.course-credit').value = course.credits;
                    }
                    if (course.grade) {
                        lastItem.querySelector('.course-grade').value = course.grade;
                    }
                }
            });

            // Ensure at least 5 regular courses
            const regularCount = this.coursesContainer.querySelectorAll('.course-item[data-type="regular"]').length;
            for (let i = regularCount; i < 5; i++) {
                this.addCourseSlot();
            }
        }

        return hasSavedCourses;
    }

    showAlert(message, type = 'info') {
        const alert = document.createElement('div');
        alert.className = `alert alert-${type}`;
        alert.textContent = message;
        
        document.body.appendChild(alert);
        
        setTimeout(() => alert.classList.add('show'), 100);
        
        setTimeout(() => {
            alert.classList.remove('show');
            setTimeout(() => {
                if (alert.parentNode) {
                    alert.parentNode.removeChild(alert);
                }
            }, 300);
        }, 3000);
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    window.app = new CGPACalculatorApp();
});