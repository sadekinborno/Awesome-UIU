// ============================================
// User Activity Tracking (best-effort analytics)
// Requires: window.supabaseClient and a localStorage session from review-auth or scholarship-auth
// ============================================

(function () {
    const SESSION_KEYS = ['review_session', 'scholarship_session'];

    function getActiveSession() {
        for (const key of SESSION_KEYS) {
            try {
                const raw = localStorage.getItem(key);
                if (!raw) continue;
                const session = JSON.parse(raw);
                if (!session?.userId) continue;

                const expiresAt = session.expiresAt ? new Date(session.expiresAt) : null;
                if (expiresAt && expiresAt < new Date()) continue;

                return session;
            } catch {
                // ignore
            }
        }
        return null;
    }

    async function upsertVisit(userId, pagePath) {
        if (!window.supabaseClient) return;

        const nowIso = new Date().toISOString();

        // Read current count (PGRST116 means no row)
        const { data: existing, error: fetchError } = await window.supabaseClient
            .from('user_visits')
            .select('visit_count')
            .eq('user_id', userId)
            .single();

        const rowMissing = fetchError && fetchError.code === 'PGRST116';
        if (fetchError && !rowMissing) {
            console.warn('user_visits fetch error:', fetchError);
            return;
        }

        const nextCount = (existing?.visit_count || 0) + 1;

        if (rowMissing) {
            const { error: insertError } = await window.supabaseClient
                .from('user_visits')
                .insert({
                    user_id: userId,
                    visit_count: nextCount,
                    first_visited_at: nowIso,
                    last_visited_at: nowIso,
                    last_page: pagePath,
                    updated_at: nowIso
                });

            if (insertError) {
                console.warn('user_visits insert error:', insertError);
            }

            return;
        }

        const { error: updateError } = await window.supabaseClient
            .from('user_visits')
            .update({
                visit_count: nextCount,
                last_visited_at: nowIso,
                last_page: pagePath,
                updated_at: nowIso
            })
            .eq('user_id', userId);

        if (updateError) {
            console.warn('user_visits update error:', updateError);
        }
    }

    async function run() {
        try {
            if (!window.supabaseClient) return;
            const session = getActiveSession();
            if (!session) return;

            const pathName = typeof location !== 'undefined' ? (location.pathname || '') : '';
            const fileName = pathName.split('/').filter(Boolean).pop() || 'index.html';
            const query = typeof location !== 'undefined' ? (location.search || '') : '';
            let pagePath = `${fileName}${query}`;
            if (pagePath.length > 180) pagePath = pagePath.slice(0, 180);

            await upsertVisit(session.userId, pagePath);
        } catch (e) {
            console.warn('user activity tracking failed:', e);
        }
    }

    // Run after DOM is ready (and after supabase-config.js loads)
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', run);
    } else {
        run();
    }
})();
