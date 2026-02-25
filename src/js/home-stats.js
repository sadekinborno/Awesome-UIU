// Homepage stats loader (renamed to avoid adblock rules that block "tracker" scripts)
// Track and display page visits
(async function () {
	const visitElement = document.getElementById('globalVisitCount');
	const studentsElement = document.getElementById('scholarshipSubmissions');
	const teacherReviewsCountElement = document.getElementById('teacherReviewsCount');
	const mysteryCountdownEl = document.getElementById('mysteryCountdown');
	const mysteryCountdownTextEl = document.getElementById('mysteryCountdownText');
	const globalAnnouncementModal = document.getElementById('globalAnnouncementModal');
	const globalAnnouncementPublishedAt = document.getElementById('globalAnnouncementPublishedAt');
	const globalAnnouncementCountdownEnded = document.getElementById('globalAnnouncementCountdownEnded');
	const globalAnnouncementGiftNotice = document.getElementById('globalAnnouncementGiftNotice');
	const globalAnnouncementGiftNoticeText = document.getElementById('globalAnnouncementGiftNoticeText');
	const globalAnnouncementWinners = document.getElementById('globalAnnouncementWinners');
	const globalAnnouncementWinnersList = document.getElementById('globalAnnouncementWinnersList');
	const globalAnnouncementNew = document.getElementById('globalAnnouncementNew');
	const globalAnnouncementNewList = document.getElementById('globalAnnouncementNewList');

	let countdownIntervalId = null;
	let cachedGlobalAnnouncement = null;

	const setPlaceholder = (value) => {
		if (visitElement) visitElement.textContent = value;
		if (studentsElement) studentsElement.textContent = value;
		if (teacherReviewsCountElement) teacherReviewsCountElement.textContent = value;
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

	const parseSupabaseTimestamp = (value) => {
		if (!value) return null;
		if (value instanceof Date) return value;
		const str = String(value).trim();
		if (!str) return null;
		const hasTz = /[zZ]$|[+-]\d\d:\d\d$/.test(str);
		const d = new Date(hasTz ? str : `${str}Z`);
		return Number.isNaN(d.getTime()) ? null : d;
	};

	const setCountdownVisible = (visible) => {
		if (!mysteryCountdownEl) return;
		mysteryCountdownEl.style.display = visible ? 'flex' : 'none';
	};

	const setCountdownParts = ({ days, hours, minutes, seconds }) => {
		if (!mysteryCountdownTextEl) return;
		mysteryCountdownTextEl.textContent = `${days}d ${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;
	};

	const startCountdown = ({ startMs, durationDays }) => {
		if (!mysteryCountdownEl) return;
		if (countdownIntervalId) {
			window.clearInterval(countdownIntervalId);
			countdownIntervalId = null;
		}

		const endMs = startMs + durationDays * 24 * 60 * 60 * 1000;
		const tick = () => {
			const remainingMs = Math.max(0, endMs - Date.now());
			const totalSeconds = Math.floor(remainingMs / 1000);
			const days = Math.floor(totalSeconds / 86400);
			const hours = Math.floor((totalSeconds % 86400) / 3600);
			const minutes = Math.floor((totalSeconds % 3600) / 60);
			const seconds = totalSeconds % 60;
			setCountdownParts({ days, hours, minutes, seconds });
			if (remainingMs <= 0) {
				// Countdown ended: hide the UI.
				setCountdownVisible(false);
			}
			if (remainingMs <= 0 && countdownIntervalId) {
				window.clearInterval(countdownIntervalId);
				countdownIntervalId = null;
			}
		};

		setCountdownVisible(true);
		tick();
		countdownIntervalId = window.setInterval(tick, 1000);
	};

	const shouldShowAnnouncementNow = ({ publishedAt }) => {
		if (!publishedAt) return false;
		try {
			const keySeenAt = 'home_announcement_last_seen_at';
			const keySeenPublished = 'home_announcement_last_seen_published_at';
			const lastSeenAt = parseInt(localStorage.getItem(keySeenAt) || '0', 10) || 0;
			const lastSeenPublished = localStorage.getItem(keySeenPublished) || '';

			// Show immediately if this is a new publish.
			if (String(lastSeenPublished) !== String(publishedAt)) return true;

			// Otherwise, only show "first time in a while".
			const COOLDOWN_MS = 6 * 60 * 60 * 1000; // 6 hours
			return Date.now() - lastSeenAt > COOLDOWN_MS;
		} catch {
			return false;
		}
	};

	const markAnnouncementSeen = ({ publishedAt }) => {
		try {
			localStorage.setItem('home_announcement_last_seen_at', String(Date.now()));
			if (publishedAt) {
				localStorage.setItem('home_announcement_last_seen_published_at', String(publishedAt));
			}
		} catch {
			// ignore
		}
	};

	const renderAnnouncement = (announcement) => {
		if (!globalAnnouncementModal) return;
		const escapeHtml = (value) =>
			String(value ?? '')
				.replace(/&/g, '&amp;')
				.replace(/</g, '&lt;')
				.replace(/>/g, '&gt;')
				.replace(/"/g, '&quot;')
				.replace(/'/g, '&#039;');

		const giftNotice = announcement?.gift_notice || null;
		const winners = Array.isArray(announcement?.winners) ? announcement.winners : [];
		const newFeatures = Array.isArray(announcement?.new_features) ? announcement.new_features : [];
		const publishedAt = announcement?.published_at || null;

		if (globalAnnouncementPublishedAt) {
			globalAnnouncementPublishedAt.textContent = '';
			globalAnnouncementPublishedAt.style.display = 'none';
		}

		if (globalAnnouncementGiftNotice) {
			const text = giftNotice ? String(giftNotice) : '';
			globalAnnouncementGiftNotice.style.display = text ? 'block' : 'none';
			if (globalAnnouncementGiftNoticeText) {
				globalAnnouncementGiftNoticeText.textContent = text;
			} else {
				globalAnnouncementGiftNotice.textContent = text;
			}
		}

		if (globalAnnouncementCountdownEnded) {
			globalAnnouncementCountdownEnded.style.display = 'none';
		}

		if (globalAnnouncementWinners && globalAnnouncementWinnersList) {
			globalAnnouncementWinners.style.display = winners.length ? 'block' : 'none';
			globalAnnouncementWinnersList.innerHTML = winners.map((x) => `<li>${escapeHtml(String(x))}</li>`).join('');
		}

		if (globalAnnouncementNew && globalAnnouncementNewList) {
			globalAnnouncementNew.style.display = newFeatures.length ? 'block' : 'none';
			globalAnnouncementNewList.innerHTML = newFeatures.map((x) => `<li>${escapeHtml(String(x))}</li>`).join('');
		}

		globalAnnouncementModal.style.display = 'flex';
		markAnnouncementSeen({ publishedAt });
	};

	const openAnnouncementOnDemand = async () => {
		try {
			if (!globalAnnouncementModal) return false;

			let announcement = cachedGlobalAnnouncement;
			if (!announcement) {
				const client = await ensureSupabaseClient();
				const { data, error } = await client
					.from('app_settings')
					.select('value')
					.eq('key', 'global_announcement')
					.maybeSingle();

				if (error) throw error;
				if (!data?.value) return false;
				announcement = JSON.parse(String(data.value));
				cachedGlobalAnnouncement = announcement;
			}

			renderAnnouncement(announcement);
			return true;
		} catch (e) {
			console.warn('[stats] Could not open announcement on demand:', e);
			return false;
		}
	};

	window.showMysteryResultsModal = openAnnouncementOnDemand;

	try {
		// Avoid leaving the default "0" which looks like a real value.
		setPlaceholder('...');

		const client = await ensureSupabaseClient();
		const pageName = 'homepage';

		// Global Mystery Countdown (15 days, same for everyone)
		try {
			const { data: settingsRows, error: settingsError } = await client
				.from('app_settings')
				.select('key,value')
				.in('key', ['mystery_countdown_start', 'mystery_countdown_duration_days', 'global_announcement']);

			if (settingsError) throw settingsError;
			const map = {};
			(settingsRows || []).forEach((r) => {
				if (!r?.key) return;
				map[String(r.key)] = r?.value;
			});

			const startDate = parseSupabaseTimestamp(map?.mystery_countdown_start);
			const durationDays = Math.max(1, Math.min(parseInt(map?.mystery_countdown_duration_days || '15', 10) || 15, 365));

			let countdownRunning = false;
			if (startDate) {
				const startMs = startDate.getTime();
				const endMs = startMs + durationDays * 24 * 60 * 60 * 1000;
				countdownRunning = Date.now() < endMs;
				if (countdownRunning) {
					startCountdown({ startMs, durationDays });
				} else {
					setCountdownVisible(false);
				}
			} else {
				setCountdownVisible(false);
			}

			// Announcement: show only when countdown is not running.
			if (!countdownRunning && map?.global_announcement && globalAnnouncementModal) {
				try {
					const announcement = JSON.parse(String(map.global_announcement));
					cachedGlobalAnnouncement = announcement;
					if (shouldShowAnnouncementNow({ publishedAt: announcement?.published_at })) {
						renderAnnouncement(announcement);
					}
				} catch (e) {
					// ignore invalid JSON
				}
			}
		} catch (e) {
			// Keep the homepage clean if the setting isn't available.
			console.warn('[stats] Mystery countdown unavailable:', e);
			setCountdownVisible(false);
		}

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

		// Count total teacher reviews (public-facing signal on the homepage)
		if (teacherReviewsCountElement) {
			const { count: reviewsCount, error: reviewsCountError } = await client
				.from('teacher_reviews')
				.select('id', { count: 'exact', head: true });

			if (reviewsCountError) {
				console.warn('[stats] Could not load teacher review count:', reviewsCountError);
				teacherReviewsCountElement.textContent = '—';
			} else {
				teacherReviewsCountElement.textContent = (reviewsCount ?? 0).toLocaleString();
			}
		}
	} catch (error) {
		console.error('Error tracking visit:', error);
		setPlaceholder('---');
		setCountdownVisible(false);
	}
})();
