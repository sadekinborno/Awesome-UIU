// Track and display page visits
(async function() {
    try {
        // Check if supabase is available
        if (typeof window.supabaseClient === 'undefined') {
            console.error('Supabase not initialized');
            return;
        }

        const pageName = 'homepage';

        // Increment visit count
        const { data: currentData, error: fetchError } = await window.supabaseClient
            .from('page_visits')
            .select('visit_count')
            .eq('page_name', pageName)
            .single();

        if (fetchError && fetchError.code !== 'PGRST116') {
            throw fetchError;
        }

        const newCount = (currentData?.visit_count || 0) + 1;

        // Update visit count
        const { error: updateError } = await window.supabaseClient
            .from('page_visits')
            .update({ 
                visit_count: newCount,
                last_updated: new Date().toISOString()
            })
            .eq('page_name', pageName);

        if (updateError) throw updateError;

        // Display immediately without animation
        const visitElement = document.getElementById('globalVisitCount');
        if (visitElement) {
            visitElement.textContent = newCount.toLocaleString();
        }

        // Load unique registered students count
        const { data: registeredStudents, error: countError } = await window.supabaseClient
            .from('scholarship_submissions')
            .select('user_id');

        if (!countError && registeredStudents) {
            // Count unique students
            const uniqueStudents = new Set(registeredStudents.map(s => s.user_id)).size;
            
            const studentsElement = document.getElementById('scholarshipSubmissions');
            if (studentsElement) {
                studentsElement.textContent = uniqueStudents.toLocaleString();
            }
        }

    } catch (error) {
        console.error('Error tracking visit:', error);
        // Display static placeholder on error
        const visitElement = document.getElementById('globalVisitCount');
        const submissionsElement = document.getElementById('scholarshipSubmissions');
        if (visitElement) visitElement.textContent = '---';
        if (submissionsElement) submissionsElement.textContent = '---';
    }
})();
