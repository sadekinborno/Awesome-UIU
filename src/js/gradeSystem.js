// Grade system based on the provided grading table
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

function getGradePoint(grade) {
    return gradeSystem[grade] ? gradeSystem[grade].point : 0;
}

function getGradeRange(grade) {
    return gradeSystem[grade] ? gradeSystem[grade].range : 'Unknown';
}

function isValidGrade(grade) {
    return gradeSystem.hasOwnProperty(grade);
}

function getAllGrades() {
    return Object.keys(gradeSystem);
}

// For compatibility with your calculator.js
function getGradePoints(grade) {
    return getGradePoint(grade);
}