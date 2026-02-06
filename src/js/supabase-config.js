// ============================================
// Supabase Configuration
// ============================================

(function () {
	const SUPABASE_URL = 'https://azvjlmywcrjwivcewgta.supabase.co';
	const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF6dmpsbXl3Y3Jqd2l2Y2V3Z3RhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQzOTY5MzEsImV4cCI6MjA3OTk3MjkzMX0.AOJ60jgcJBYwvkVfyEnOZ4Zv_hu4bFSz9zdibL2AJRU';

	// Expose config so other scripts can self-initialize if needed.
	window.__SUPABASE_CONFIG__ = {
		url: SUPABASE_URL,
		anonKey: SUPABASE_ANON_KEY
	};

	// If the Supabase SDK is blocked (adblock/privacy), avoid throwing here.
	// Downstream scripts can handle fallback UI and/or load an alternative SDK URL.
	if (!window.supabase || typeof window.supabase.createClient !== 'function') {
		console.error('Supabase SDK not loaded; skipping client initialization');
		return;
	}

	try {
		// Initialize Supabase client (default). This client will attach a Supabase Auth session
		// automatically if one exists in localStorage.
		const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

		// Initialize a "public" Supabase client that never persists/uses auth sessions.
		// This is critical for pages that rely on anon RLS policies (e.g., client-side OTP tables)
		// because an existing admin/auth session would otherwise switch the DB role to `authenticated`.
		const supabasePublicClient = window.supabase.createClient(
			SUPABASE_URL,
			SUPABASE_ANON_KEY,
			{
				auth: {
					// Use a distinct storage key to avoid multiple GoTrueClient instances
					// fighting over the same key in the same browser context.
					storageKey: 'sb-public-auth-token',
					persistSession: false,
					autoRefreshToken: false,
					detectSessionInUrl: false
				}
			}
		);

		// Export for use in other files without clashing with global "supabase" from the SDK
		window.supabaseClient = supabaseClient;
		window.supabasePublicClient = supabasePublicClient;
	} catch (error) {
		console.error('Supabase client initialization failed:', error);
	}
})();
