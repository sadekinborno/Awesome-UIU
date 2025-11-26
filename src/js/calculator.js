function addCourse(courses, courseName, credits, grade) {
    const gradePoints = getGradePoints(grade);
    const course = {
        name: courseName,
        credits: credits,
        grade: grade,
        gradePoints: gradePoints
    };
    courses.push(course);
    return courses;
}

function calculateCGPA(courses, totalCredits) {
    let totalGradePoints = 0;
    let totalCourseCredits = 0;

    courses.forEach(course => {
        totalGradePoints += course.gradePoints * course.credits;
        totalCourseCredits += course.credits;
    });

    const currentCGPA = totalCourseCredits > 0 ? (totalGradePoints / totalCourseCredits) : 0;
    return currentCGPA;
}

function calculatePotentialCGPA(courses, totalCredits, newCourses) {
    let totalGradePoints = 0;
    let totalCourseCredits = 0;

    courses.forEach(course => {
        totalGradePoints += course.gradePoints * course.credits;
        totalCourseCredits += course.credits;
    });

    newCourses.forEach(course => {
        totalGradePoints += course.gradePoints * course.credits;
        totalCourseCredits += course.credits;
    });

    const potentialCGPA = (totalGradePoints / (totalCredits + totalCourseCredits));
    return potentialCGPA;
}

function handleRetakeCourse(courses, courseName, newGrade) {
    const courseIndex = courses.findIndex(course => course.name === courseName);
    if (courseIndex !== -1) {
        const credits = courses[courseIndex].credits;
        const newGradePoints = getGradePoints(newGrade);
        courses[courseIndex].gradePoints = newGradePoints;
        courses[courseIndex].grade = newGrade;
    }
    return courses;
}