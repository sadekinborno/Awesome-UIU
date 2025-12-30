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

        // Load total verified users count for "Students Registered" stat
        const { data: users, error: usersError } = await window.supabaseClient
            .from('users')
            .select('id, email_verified');

        if (!usersError && users) {
            const verifiedCount = users.filter(u => u.email_verified).length;
            const studentsElement = document.getElementById('scholarshipSubmissions');
            if (studentsElement) {
                studentsElement.textContent = verifiedCount.toLocaleString();
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
