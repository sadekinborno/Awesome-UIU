// Track and display page visits
(async function() {
    try {
        // Check if supabase is available
        if (typeof window.supabaseClient === 'undefined') {
            console.error('Supabase not initialized');
            return;
        }

        const pageName = 'homepage';

        // Atomic increment via RPC (requires add-page-visits-table.sql)
        const { data: rpcData, error: rpcError } = await window.supabaseClient
            .rpc('increment_page_visit', { p_page_name: pageName });

        if (rpcError) throw rpcError;

        const newCount = rpcData?.visit_count ?? 0;

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
