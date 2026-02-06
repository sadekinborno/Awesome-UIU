// Track and display page visits
(async function () {
    const visitElement = document.getElementById('globalVisitCount');
    const studentsElement = document.getElementById('scholarshipSubmissions');

    const setPlaceholder = (value) => {
        if (visitElement) visitElement.textContent = value;
        if (studentsElement) studentsElement.textContent = value;
    };

    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    const loadScript = (src) =>
        new Promise((resolve, reject) => {
            const existing = document.querySelector(`script[src="${src}"]`);
            if (existing) {
                resolve();
                return;
            }
            const script = document.createElement('script');
            script.src = src;
            script.async = true;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
            document.head.appendChild(script);
        });

    const ensureSupabaseClient = async () => {
        let sdkSource = null;

        // If config already initialized successfully, use it.
        if (window.supabasePublicClient) return window.supabasePublicClient;
        if (window.supabaseClient) return window.supabaseClient;

        // Wait briefly in case scripts are still loading.
        for (let i = 0; i < 20; i++) {
            if (window.supabasePublicClient) return window.supabasePublicClient;
            if (window.supabaseClient) return window.supabaseClient;
            await sleep(100);
        }

        // If the SDK is missing (blocked CDN / privacy), try loading from an alternate CDN.
        if (!window.supabase || typeof window.supabase.createClient !== 'function') {
            const sdkSources = [
                'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
                'https://unpkg.com/@supabase/supabase-js@2/dist/umd/supabase.js'
            ];

            for (const src of sdkSources) {
                try {
                    await loadScript(src);
                    if (window.supabase && typeof window.supabase.createClient === 'function') {
                        sdkSource = src;
                        break;
                    }
                } catch (e) {
                    // try next source
                }
            }
        }

        if (!sdkSource && window.supabase && typeof window.supabase.createClient === 'function') {
            sdkSource = 'already-present';
        }
        if (sdkSource) {
            window.__SUPABASE_SDK_SOURCE__ = sdkSource;
            console.log('[stats] Supabase SDK source:', sdkSource);
        }

        if (!window.supabase || typeof window.supabase.createClient !== 'function') {
            throw new Error('Supabase SDK unavailable');
        }

        // As a last resort, self-initialize a non-persistent (public) client.
        const config = window.__SUPABASE_CONFIG__;
        const url = config?.url || 'https://azvjlmywcrjwivcewgta.supabase.co';
        const anonKey =
            config?.anonKey ||
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF6dmpsbXl3Y3Jqd2l2Y2V3Z3RhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQzOTY5MzEsImV4cCI6MjA3OTk3MjkzMX0.AOJ60jgcJBYwvkVfyEnOZ4Zv_hu4bFSz9zdibL2AJRU';

        window.supabasePublicClient = window.supabase.createClient(url, anonKey, {
            auth: {
                persistSession: false,
                autoRefreshToken: false,
                detectSessionInUrl: false
            }
        });
        return window.supabasePublicClient;
    };

    try {
        // Avoid leaving the default "0" which looks like a real value.
        setPlaceholder('...');

        const client = await ensureSupabaseClient();
        const pageName = 'homepage';

        // Atomic increment via RPC (requires add-page-visits-table.sql)
        const { data: rpcData, error: rpcError } = await client.rpc('increment_page_visit', {
            p_page_name: pageName
        });

        if (rpcError) throw rpcError;

        const newCount = rpcData?.visit_count ?? 0;
        if (visitElement) visitElement.textContent = newCount.toLocaleString();

        // Count verified users without downloading the full table
        const { count, error: countError } = await client
            .from('users')
            .select('id', { count: 'exact', head: true })
            .eq('email_verified', true);

        if (countError) throw countError;
        if (studentsElement) studentsElement.textContent = (count ?? 0).toLocaleString();
    } catch (error) {
        console.error('Error tracking visit:', error);
        setPlaceholder('---');
    }
})();
