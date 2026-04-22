/* global supabasePublicClient */

(function () {
	'use strict';

	const els = {
		termSelect: document.getElementById('termSelect'),
		openReminderModalBtn: document.getElementById('openReminderModalBtn'),
		prevMonthBtn: document.getElementById('prevMonthBtn'),
		nextMonthBtn: document.getElementById('nextMonthBtn'),
		todayBtn: document.getElementById('todayBtn'),
		monthLabel: document.getElementById('monthLabel'),
		monthGrid: document.getElementById('monthGrid'),
		calendarStatus: document.getElementById('calendarStatus'),
		dayModal: document.getElementById('dayModal'),
		dayModalBackdrop: document.getElementById('dayModalBackdrop'),
		dayModalCloseBtn: document.getElementById('dayModalCloseBtn'),
		openAddDayReminderBtn: document.getElementById('openAddDayReminderBtn'),
		selectedDateTitle: document.getElementById('selectedDateTitle'),
		selectedDateSub: document.getElementById('selectedDateSub'),
		dayEvents: document.getElementById('dayEvents'),
		addDayReminderModal: document.getElementById('addDayReminderModal'),
		addDayReminderBackdrop: document.getElementById('addDayReminderBackdrop'),
		addDayReminderCloseBtn: document.getElementById('addDayReminderCloseBtn'),
		addDayReminderForm: document.getElementById('addDayReminderForm'),
		dayReminderTitle: document.getElementById('dayReminderTitle'),
		dayReminderDate: document.getElementById('dayReminderDate'),
		dayReminderDaysBefore: document.getElementById('dayReminderDaysBefore'),
		dayReminderTime: document.getElementById('dayReminderTime'),
		dayReminderDescription: document.getElementById('dayReminderDescription'),
		dayReminderStatus: document.getElementById('dayReminderStatus'),
		addDayReminderSubmitBtn: document.getElementById('addDayReminderSubmitBtn'),
		dayReminderLimitInfo: document.getElementById('dayReminderLimitInfo'),
		reminderModal: document.getElementById('reminderModal'),
		reminderModalBackdrop: document.getElementById('reminderModalBackdrop'),
		reminderModalCloseBtn: document.getElementById('reminderModalCloseBtn'),
		reminderRequestFormWrap: document.getElementById('reminderRequestFormWrap'),
		reminderRequestForm: document.getElementById('reminderRequestForm'),
		reminderDaysBefore: document.getElementById('reminderDaysBefore'),
		remTypeRegistration: document.getElementById('remTypeRegistration'),
		remTypeInstallment: document.getElementById('remTypeInstallment'),
		remTypeExams: document.getElementById('remTypeExams'),
		remTypeDrop: document.getElementById('remTypeDrop'),
		remTypeHoliday: document.getElementById('remTypeHoliday'),
		submitReminderRequestBtn: document.getElementById('submitReminderRequestBtn'),
		reminderFormStatus: document.getElementById('reminderFormStatus'),
		reminderPendingView: document.getElementById('reminderPendingView'),
		reminderPendingTitle: document.getElementById('reminderPendingTitle'),
		reminderPendingText: document.getElementById('reminderPendingText'),
		reminderPendingNote: document.getElementById('reminderPendingNote'),
		reminderPendingActionBtn: document.getElementById('reminderPendingActionBtn'),
		upcomingEvents: document.getElementById('upcomingEvents'),
		copyLinkBtn: null
	};

	const state = {
		term: null,
		academicEvents: [],
		studentReminders: [],
		allEvents: [],
		studentReminderLimit: 5,
		studentReminderActiveCount: 0,
		monthCursor: startOfMonth(new Date()),
		selectedDate: startOfDay(new Date())
	};

	const CATEGORIES = {
		deadline: { label: 'Deadline', dot: 'dot-high' },
		exam: { label: 'Exam', dot: 'dot-mid' },
		holiday: { label: 'Holiday', dot: 'dot-reg' },
		registration: { label: 'Registration', dot: 'dot-low' },
		payment: { label: 'Payment', dot: 'dot-high' },
		classes: { label: 'Classes', dot: 'dot-low' },
		advising: { label: 'Advising', dot: 'dot-mid' },
		student_reminder: { label: 'My Reminder', dot: 'dot-reminder' },
		general: { label: 'Other', dot: 'dot-low' }
	};

	function escapeHtml(value) {
		return String(value ?? '')
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&#039;');
	}

	function toYMD(date) {
		const y = date.getFullYear();
		const m = String(date.getMonth() + 1).padStart(2, '0');
		const d = String(date.getDate()).padStart(2, '0');
		return `${y}-${m}-${d}`;
	}

	function parseYMD(value) {
		const str = String(value || '').trim();
		if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return null;
		const dt = new Date(`${str}T00:00:00`);
		return Number.isNaN(dt.getTime()) ? null : dt;
	}

	function startOfDay(d) {
		const dt = new Date(d);
		dt.setHours(0, 0, 0, 0);
		return dt;
	}

	function startOfMonth(d) {
		const dt = new Date(d);
		dt.setDate(1);
		dt.setHours(0, 0, 0, 0);
		return dt;
	}

	function addDays(d, days) {
		const dt = new Date(d);
		dt.setDate(dt.getDate() + days);
		return dt;
	}

	function formatLongDate(d) {
		return d.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
	}

	function formatMonth(d) {
		return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long' });
	}

	function formatTimeHM(isoString) {
		const dt = new Date(String(isoString || ''));
		if (Number.isNaN(dt.getTime())) return '';
		return dt.toLocaleTimeString(undefined, {
			hour: 'numeric',
			minute: '2-digit'
		});
	}

	function subtractDaysYMD(ymd, daysBefore) {
		const base = parseYMD(ymd);
		if (!base) return '';
		base.setDate(base.getDate() - Number(daysBefore || 0));
		return toYMD(base);
	}

	function normalizeCategory(raw) {
		const c = String(raw || '').trim().toLowerCase();
		return CATEGORIES[c] ? c : 'general';
	}

	function normalizeEmail(rawValue) {
		return String(rawValue || '').trim().toLowerCase();
	}

	function isValidUiuEmail(email) {
		return /^[^\s@]+@([a-z0-9-]+\.)*uiu\.ac\.bd$/i.test(String(email || '').trim());
	}

	function categoryDotClass(category) {
		return CATEGORIES[normalizeCategory(category)]?.dot || 'dot-low';
	}

	function categoryLabel(category) {
		return CATEGORIES[normalizeCategory(category)]?.label || 'Other';
	}

	function isSameDay(a, b) {
		return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
	}

	function dateInEventRange(date, evt) {
		const s = parseYMD(evt?.start_date);
		const e = parseYMD(evt?.end_date);
		if (!s || !e) return false;
		const t = startOfDay(date).getTime();
		return t >= s.getTime() && t <= e.getTime();
	}

	function eventRangeLabel(evt) {
		const s = parseYMD(evt?.start_date);
		const e = parseYMD(evt?.end_date);
		if (!s || !e) return '';
		const same = isSameDay(s, e);
		if (same) return s.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
		return `${s.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${e.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
	}

	function getUrlState() {
		const url = new URL(window.location.href);
		return {
			term: url.searchParams.get('term'),
			date: url.searchParams.get('date')
		};
	}

	function setUrlState(next) {
		const url = new URL(window.location.href);
		if (next?.term) url.searchParams.set('term', next.term);
		if (next?.date) url.searchParams.set('date', next.date);
		window.history.replaceState({}, '', url.toString());
	}

	function renderStatus(msg) {
		if (!els.calendarStatus) return;
		els.calendarStatus.textContent = msg || '';
	}

	function renderTermOptions(terms, selected) {
		if (!els.termSelect) return;
		els.termSelect.innerHTML = '';
		(terms || []).forEach((t) => {
			const opt = document.createElement('option');
			opt.value = t;
			opt.textContent = t;
			if (t === selected) opt.selected = true;
			els.termSelect.appendChild(opt);
		});
	}

	async function fetchAvailableTerms() {
		if (!window.supabasePublicClient) throw new Error('Supabase is not available.');
		const { data, error } = await window.supabasePublicClient
			.from('academic_calendar_events')
			.select('term')
			.limit(10000);
		if (error) throw error;
		const set = new Set((data || []).map(r => String(r?.term || '').trim()).filter(Boolean));
		const terms = Array.from(set);
		terms.sort((a, b) => a.localeCompare(b));
		return terms;
	}

	async function fetchEventsForTerm(term) {
		if (!window.supabasePublicClient) throw new Error('Supabase is not available.');
		renderStatus('Loading events…');
		const { data, error } = await window.supabasePublicClient
			.from('academic_calendar_events')
			.select('id,term,title,category,audience,importance,start_date,end_date,all_day,description,updated_at')
			.eq('term', term)
			.order('start_date', { ascending: true })
			.limit(10000);
		if (error) throw error;
		renderStatus('');
		return data || [];
	}

	function mergeCalendarEvents() {
		const reminderEvents = (state.studentReminders || []).map((rem) => {
			const daysBefore = Number(rem?.days_before || 0);
			const reminderTime = formatTimeHM(rem?.remind_at);
			const scheduleText = daysBefore > 0
				? `Email reminder: ${daysBefore} day${daysBefore === 1 ? '' : 's'} before at ${reminderTime || 'selected time'}`
				: `Email reminder: on event day at ${reminderTime || 'selected time'}`;
			return {
				id: `student-reminder-${rem.id}`,
				term: state.term,
				title: rem?.title || 'My Reminder',
				category: 'student_reminder',
				audience: 'my reminder',
				importance: 2,
				start_date: rem?.reminder_date,
				end_date: rem?.reminder_date,
				all_day: false,
				description: rem?.description ? `${rem.description}\n\n${scheduleText}` : scheduleText,
				updated_at: rem?.created_at || null,
				is_student_reminder: true,
				remind_at: rem?.remind_at || null,
				days_before: daysBefore
			};
		});

		state.allEvents = [...(state.academicEvents || []), ...reminderEvents];
	}

	function setDayReminderStatus(msg, isError) {
		if (!els.dayReminderStatus) return;
		els.dayReminderStatus.textContent = msg || '';
		els.dayReminderStatus.classList.remove('is-error', 'is-success');
		if (!msg) return;
		els.dayReminderStatus.classList.add(isError ? 'is-error' : 'is-success');
	}

	function renderReminderLimitInfo() {
		if (!els.dayReminderLimitInfo) return;
		const limit = Number(state.studentReminderLimit || 5);
		const count = Number(state.studentReminderActiveCount || 0);
		els.dayReminderLimitInfo.textContent = `Active reminders: ${count}/${limit}`;
	}

	async function fetchStudentRemindersForCurrentTerm() {
		const identity = getLoggedInIdentity();
		const email = normalizeEmail(identity?.email);

		if (!window.supabasePublicClient || !email || !isValidUiuEmail(email)) {
			state.studentReminders = [];
			state.studentReminderActiveCount = 0;
			state.studentReminderLimit = 5;
			mergeCalendarEvents();
			renderReminderLimitInfo();
			return;
		}

		try {
			const { data, error } = await window.supabasePublicClient.functions.invoke('student-calendar-reminders', {
				body: {
					action: 'list',
					email,
					term: state.term
				}
			});

			if (error) throw error;

			state.studentReminders = Array.isArray(data?.reminders) ? data.reminders : [];
			state.studentReminderActiveCount = Number(data?.activeCount || 0);
			state.studentReminderLimit = Number(data?.limit || 5);
			mergeCalendarEvents();
			renderReminderLimitInfo();
		} catch (err) {
			console.warn('Unable to load student reminders:', err);
			state.studentReminders = [];
			state.studentReminderActiveCount = 0;
			state.studentReminderLimit = 5;
			mergeCalendarEvents();
			renderReminderLimitInfo();
		}
	}

	function getEventsForDate(date) {
		return (state.allEvents || [])
			.filter(evt => dateInEventRange(date, evt))
			.sort((a, b) => {
				const sa = String(a?.start_date || '');
				const sb = String(b?.start_date || '');
				if (sa !== sb) return sa.localeCompare(sb);
				return String(a?.title || '').localeCompare(String(b?.title || ''));
			});
	}

	function renderMonth() {
		if (!els.monthLabel || !els.monthGrid) return;
		els.monthLabel.textContent = formatMonth(state.monthCursor);

		const first = startOfMonth(state.monthCursor);
		const firstDow = first.getDay(); // 0=Sun
		const gridStart = addDays(first, -firstDow);

		els.monthGrid.innerHTML = '';
		for (let i = 0; i < 42; i++) {
			const day = addDays(gridStart, i);
			const ymd = toYMD(day);
			const inMonth = day.getMonth() === state.monthCursor.getMonth();
			const isToday = isSameDay(day, startOfDay(new Date()));
			const isSelected = isSameDay(day, state.selectedDate);
			const events = getEventsForDate(day);
			const count = events.length;

			const cell = document.createElement('button');
			cell.type = 'button';
			cell.className = `day${inMonth ? '' : ' outside'}${isToday ? ' today' : ''}${isSelected ? ' selected' : ''}`;
			cell.setAttribute('role', 'gridcell');
			cell.setAttribute('data-date', ymd);
			cell.setAttribute('aria-label', `${formatLongDate(day)}${count ? `, ${count} event${count === 1 ? '' : 's'}` : ''}`);

			const dots = (events || [])
				.slice(0, 6)
				.map((evt) => {
					const cat = normalizeCategory(evt?.category);
					return `<span class="dot ${categoryDotClass(cat)}" title="${escapeHtml(categoryLabel(cat))}" aria-hidden="true"></span>`;
				})
				.join('');

			const snippets = (events || [])
				.slice(0, 2)
				.map((evt) => {
					const cat = normalizeCategory(evt?.category);
					return `
						<div class="day-item" title="${escapeHtml(evt?.title || '')}">
							<span class="dot ${categoryDotClass(cat)}" aria-hidden="true"></span>
							<span class="day-item-text">${escapeHtml(evt?.title || '')}</span>
						</div>
					`;
				})
				.join('');

			const more = count > 2 ? `<div class="day-more">+${count - 2} more</div>` : '';

			cell.innerHTML = `
				<div class="day-top">
					<div class="day-num">${day.getDate()}</div>
				</div>
				${count > 0 ? `<div class="day-items" aria-hidden="true">${snippets}${more}</div>` : ''}
				${count > 0 ? `<div class="dots" aria-hidden="true">${dots}</div>` : ''}
			`;

			cell.addEventListener('click', () => {
				setSelectedDate(day, { openModal: true });
			});
			els.monthGrid.appendChild(cell);
		}
	}

	function isDayModalOpen() {
		return Boolean(els.dayModal && !els.dayModal.hasAttribute('hidden'));
	}

	function openDayModal() {
		if (!els.dayModal) return;
		els.dayModal.removeAttribute('hidden');
		document.body.classList.add('ac-modal-open');
		els.dayModalCloseBtn?.focus?.();
	}

	function closeDayModal() {
		if (!els.dayModal) return;
		els.dayModal.setAttribute('hidden', '');
		if (!isReminderModalOpen() && !isAddDayReminderModalOpen()) document.body.classList.remove('ac-modal-open');
	}

	function isAddDayReminderModalOpen() {
		return Boolean(els.addDayReminderModal && !els.addDayReminderModal.hasAttribute('hidden'));
	}

	function openAddDayReminderModal() {
		if (!els.addDayReminderModal) return;
		const identity = getLoggedInIdentity();
		const email = normalizeEmail(identity?.email);
		if (!email || !isValidUiuEmail(email)) {
			setDayReminderStatus('Please log in with your UIU email to add reminders.', true);
			return;
		}

		setDayReminderStatus('', false);
		if (els.dayReminderDate) els.dayReminderDate.value = toYMD(state.selectedDate);
		if (els.dayReminderDaysBefore) els.dayReminderDaysBefore.value = '0';
		if (els.dayReminderTime && !els.dayReminderTime.value) {
			const now = new Date();
			now.setMinutes(now.getMinutes() + 30);
			els.dayReminderTime.value = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
		}
		renderReminderLimitInfo();

		els.addDayReminderModal.removeAttribute('hidden');
		document.body.classList.add('ac-modal-open');
		els.dayReminderTitle?.focus?.();
	}

	function closeAddDayReminderModal() {
		if (!els.addDayReminderModal) return;
		els.addDayReminderModal.setAttribute('hidden', '');
		if (!isReminderModalOpen() && !isDayModalOpen()) document.body.classList.remove('ac-modal-open');
	}

	function isReminderModalOpen() {
		return Boolean(els.reminderModal && !els.reminderModal.hasAttribute('hidden'));
	}

	function showReminderRequestForm() {
		if (els.reminderRequestFormWrap) els.reminderRequestFormWrap.hidden = false;
		if (els.reminderPendingView) els.reminderPendingView.hidden = true;
	}

	function showReminderPendingView(title, message, actionLabel, actionHandler, noteText) {
		if (els.reminderRequestFormWrap) els.reminderRequestFormWrap.hidden = true;
		if (els.reminderPendingView) els.reminderPendingView.hidden = false;
		if (els.reminderPendingTitle) {
			els.reminderPendingTitle.textContent = title || 'Request Under Review';
		}
		if (els.reminderPendingText) {
			els.reminderPendingText.textContent = message || 'Your reminder request is currently pending admin approval.';
		}
		if (els.reminderPendingNote) {
			if (noteText) {
				els.reminderPendingNote.hidden = false;
				els.reminderPendingNote.textContent = `Admin note: ${noteText}`;
			} else {
				els.reminderPendingNote.hidden = true;
				els.reminderPendingNote.textContent = '';
			}
		}
		if (els.reminderPendingActionBtn) {
			if (actionLabel && typeof actionHandler === 'function') {
				els.reminderPendingActionBtn.hidden = false;
				els.reminderPendingActionBtn.textContent = actionLabel;
				els.reminderPendingActionBtn.onclick = actionHandler;
			} else {
				els.reminderPendingActionBtn.hidden = true;
				els.reminderPendingActionBtn.onclick = null;
			}
		}
	}

	function reminderPendingCacheKey(email, term) {
		return `ac_reminder_pending_${String(email || '').toLowerCase()}_${String(term || '').toLowerCase()}`;
	}

	function markReminderPendingCached(email, term) {
		if (!email || !term) return;
		try {
			localStorage.setItem(reminderPendingCacheKey(email, term), '1');
		} catch {
			// ignore storage errors
		}
	}

	function isReminderPendingCached(email, term) {
		if (!email || !term) return false;
		try {
			return localStorage.getItem(reminderPendingCacheKey(email, term)) === '1';
		} catch {
			return false;
		}
	}

	function clearReminderPendingCached(email, term) {
		if (!email || !term) return;
		try {
			localStorage.removeItem(reminderPendingCacheKey(email, term));
		} catch {
			// ignore storage errors
		}
	}

	async function hasPendingReminderRequest(identity) {
		if (!window.supabasePublicClient || !identity?.email || !state.term) return false;

		const { data, error } = await window.supabasePublicClient
			.from('academic_calendar_reminder_requests')
			.select('id,requested_at,academic_calendar_events!inner(term)')
			.eq('request_email', identity.email)
			.eq('status', 'pending')
			.eq('is_active', true)
			.eq('academic_calendar_events.term', state.term)
			.order('requested_at', { ascending: false })
			.limit(1);

		if (error) {
			console.warn('Reminder pending check failed:', error);
			return false;
		}

		return Array.isArray(data) && data.length > 0;
	}

	async function fetchReminderPendingStatus(identity) {
		if (!window.supabasePublicClient || !identity?.email || !state.term) {
			return { pending: false, requestedAt: null, latestStatus: null, latestReviewNote: null, latestReviewedAt: null, approvedEvents: [] };
		}

		const { data, error } = await window.supabasePublicClient.functions.invoke('get-calendar-reminder-status', {
			body: {
				email: identity.email,
				term: state.term
			}
		});

		if (error) throw error;
		return {
			pending: Boolean(data?.pending),
			requestedAt: data?.requestedAt || null,
			latestStatus: data?.latestStatus || null,
			latestReviewNote: data?.latestReviewNote || null,
			latestReviewedAt: data?.latestReviewedAt || null,
			approvedEvents: Array.isArray(data?.approvedEvents) ? data.approvedEvents : []
		};
	}

	function rejectedMessageFromStatus(status) {
		const note = String(status?.latestReviewNote || '').trim();
		const reviewedAt = status?.latestReviewedAt ? new Date(status.latestReviewedAt) : null;
		const reviewedLabel = reviewedAt && !Number.isNaN(reviewedAt.getTime())
			? reviewedAt.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
			: null;
		if (note && reviewedLabel) {
			return {
				message: `Your previous reminder request was not approved on ${reviewedLabel}.`,
				note
			};
		}
		if (note) {
			return {
				message: 'Your previous reminder request was not approved.',
				note
			};
		}
		if (reviewedLabel) {
			return {
				message: `Your previous reminder request was not approved on ${reviewedLabel}. You can submit a new request now.`,
				note: null
			};
		}
		return {
			message: 'Your previous reminder request was not approved. You can submit a new request now.',
			note: null
		};
	}

	function approvedMessageFromStatus(status) {
		const note = String(status?.latestReviewNote || '').trim();
		const reviewedAt = status?.latestReviewedAt ? new Date(status.latestReviewedAt) : null;
		const reviewedLabel = reviewedAt && !Number.isNaN(reviewedAt.getTime())
			? reviewedAt.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
			: null;

		const events = Array.isArray(status?.approvedEvents) ? status.approvedEvents : [];
		const categorySet = new Set();

		events.forEach((evt) => {
			const title = String(evt?.title || '').toLowerCase();
			if (!title) return;
			if (/reg|registration|advising/.test(title)) categorySet.add('Registration Deadlines');
			if (/installment|tuition|payment/.test(title)) categorySet.add('Installment Deadlines');
			if (/exam/.test(title)) categorySet.add('Exams');
			if (/\bdrop\b/.test(title)) categorySet.add('Drop Deadlines');
			if (/holiday|eid|ashura|new year|puja|break/.test(title)) categorySet.add('Holidays');
		});

		const preferredOrder = ['Registration Deadlines', 'Installment Deadlines', 'Exams', 'Drop Deadlines', 'Holidays'];
		const categories = preferredOrder.filter((c) => categorySet.has(c));

		const eventText = categories.length
			? `You will receive reminder emails for: ${categories.join(', ')}.`
			: 'You will receive reminder emails for your approved selected reminder categories.';

		if (reviewedLabel) {
			return {
				message: `Approved on ${reviewedLabel}. ${eventText}`,
				note: note || null
			};
		}
		return {
			message: eventText,
			note: note || null
		};
	}

	function pendingMessageWithDate(requestedAt) {
		if (!requestedAt) {
			return 'Your previous reminder request is still pending admin review. You can submit another one after a decision is made.';
		}
		const dt = new Date(requestedAt);
		if (Number.isNaN(dt.getTime())) {
			return 'Your previous reminder request is still pending admin review. You can submit another one after a decision is made.';
		}
		return `Your previous reminder request is still pending admin review (submitted on ${dt.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}). You can submit another one after a decision is made.`;
	}

	function createRequestGroupId() {
		try {
			if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
				return crypto.randomUUID();
			}
		} catch {
			// ignore
		}
		return `grp_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
	}

	async function openReminderModal() {
		if (!els.reminderModal) return;
		setReminderStatus('', false);
		els.reminderModal.removeAttribute('hidden');
		document.body.classList.add('ac-modal-open');
		showReminderPendingView('Checking Status', 'Please wait while we check your existing reminder request.');

		const identity = getLoggedInIdentity();
		const email = normalizeEmail(identity?.email);
		if (!email || !isValidUiuEmail(email)) {
			showReminderPendingView('Login Required', 'Please log in to request reminder emails for academic events.');
			return;
		}

		const hasCachedPending = isReminderPendingCached(email, state.term);
		if (hasCachedPending) {
			showReminderPendingView('Request Under Review', 'Checking latest status of your previous reminder request...');
		}

		try {
			const status = await fetchReminderPendingStatus(identity);
			if (status.pending) {
				markReminderPendingCached(email, state.term);
				showReminderPendingView('Request Under Review', pendingMessageWithDate(status.requestedAt));
				return;
			}
			clearReminderPendingCached(email, state.term);
			if (String(status.latestStatus || '').toLowerCase() === 'approved') {
				const approved = approvedMessageFromStatus(status);
				showReminderPendingView('Request Approved', approved.message, null, null, approved.note);
				return;
			}
			if (String(status.latestStatus || '').toLowerCase() === 'rejected') {
				const rejected = rejectedMessageFromStatus(status);
				showReminderPendingView('Request Not Approved', rejected.message, 'Create New Request', () => {
					showReminderRequestForm();
					els.reminderDaysBefore?.focus?.();
				}, rejected.note);
				return;
			}
		} catch (err) {
			console.warn('Reminder status function failed; falling back to direct query.', err);
			const isPending = await hasPendingReminderRequest(identity);
			if (isPending) {
				markReminderPendingCached(email, state.term);
				showReminderPendingView('Request Under Review', 'Your previous reminder request is still pending admin review. You can submit another one after a decision is made.');
				return;
			}
			if (hasCachedPending) {
				// If both checks fail while cache existed, keep safe UX until next open.
				showReminderPendingView('Request Under Review', 'We could not confirm a status update right now. Please try reopening in a moment.');
				return;
			}
			clearReminderPendingCached(email, state.term);
		}

		showReminderRequestForm();
		els.reminderDaysBefore?.focus?.();
	}

	function closeReminderModal() {
		if (!els.reminderModal) return;
		els.reminderModal.setAttribute('hidden', '');
		if (!isDayModalOpen()) document.body.classList.remove('ac-modal-open');
	}

	function renderDayPanel() {
		if (!els.dayEvents || !els.selectedDateTitle || !els.selectedDateSub) return;
		els.selectedDateTitle.textContent = 'Selected day';
		els.selectedDateSub.textContent = formatLongDate(state.selectedDate);

		const events = getEventsForDate(state.selectedDate);
		if (!events.length) {
			els.dayEvents.innerHTML = '<div class="ac-muted">No events for this date.</div>';
			return;
		}

		els.dayEvents.innerHTML = events.map((evt) => {
			const cat = normalizeCategory(evt?.category);
			const daysBefore = Number(evt?.days_before || 0);
			const reminderId = evt?.is_student_reminder
				? String(evt?.id || '').replace(/^student-reminder-/, '')
				: '';
			const reminderTimeChip = evt?.is_student_reminder && evt?.remind_at
				? `<span class="pill">At ${escapeHtml(formatTimeHM(evt.remind_at))}</span>`
				: '';
			const reminderBeforeChip = evt?.is_student_reminder
				? `<span class="pill">${daysBefore > 0 ? `${daysBefore} day${daysBefore === 1 ? '' : 's'} before` : 'On event day'}</span>`
				: '';
			const chips = [
				`<span class="pill"><span class="dot ${categoryDotClass(cat)}" aria-hidden="true"></span>${escapeHtml(categoryLabel(cat))}</span>`,
				evt?.audience && evt.audience !== 'all' ? `<span class="pill">${escapeHtml(evt.audience)}</span>` : '',
				reminderBeforeChip,
				reminderTimeChip,
				evt?.importance === 3 && !evt?.is_student_reminder ? `<span class="pill pill-high">High</span>` : ''
			].filter(Boolean).join(' ');

			return `
				<div class="event">
					<div class="event-head">
						<div class="event-title">${escapeHtml(evt?.title || '')}</div>
						<div class="event-range ac-muted">${escapeHtml(eventRangeLabel(evt))}</div>
					</div>
					${chips ? `<div class="event-meta">${chips}</div>` : ''}
					${evt?.description ? `<div class="event-desc">${escapeHtml(evt.description)}</div>` : ''}
					${evt?.is_student_reminder && reminderId ? `
						<div class="event-student-actions">
							<button class="event-remove-btn" type="button" data-remove-reminder-id="${escapeHtml(reminderId)}">Remove Reminder</button>
						</div>
					` : ''}
				</div>
			`;
		}).join('');

		els.dayEvents.querySelectorAll('[data-remove-reminder-id]')?.forEach((btn) => {
			btn.addEventListener('click', async () => {
				const reminderId = String(btn.getAttribute('data-remove-reminder-id') || '').trim();
				if (!reminderId) return;

				const identity = getLoggedInIdentity();
				const email = normalizeEmail(identity?.email);
				if (!email || !isValidUiuEmail(email)) {
					setDayReminderStatus('Please log in to remove reminders.', true);
					return;
				}

				btn.disabled = true;
				try {
					const { data, error } = await window.supabasePublicClient.functions.invoke('student-calendar-reminders', {
						body: {
							action: 'remove',
							email,
							reminderId
						}
					});

					if (error) throw error;
					if (!data?.success) {
						setDayReminderStatus(`Could not remove reminder: ${data?.error || 'Unknown error'}`, true);
						return;
					}

					state.studentReminderActiveCount = Number(data?.activeCount || 0);
					await fetchStudentRemindersForCurrentTerm();
					renderMonth();
					renderDayPanel();
					setDayReminderStatus('Reminder removed.', false);
				} catch (err) {
					setDayReminderStatus(`Could not remove reminder: ${err?.message || String(err)}`, true);
				} finally {
					btn.disabled = false;
				}
			});
		});
	}

	function renderUpcoming() {
		if (!els.upcomingEvents) return;
		const start = startOfDay(new Date());
		const end = addDays(start, 14);

		const upcoming = (state.allEvents || [])
			.filter((evt) => {
				const s = parseYMD(evt?.start_date);
				const e = parseYMD(evt?.end_date);
				if (!s || !e) return false;
				return e.getTime() >= start.getTime() && s.getTime() <= end.getTime();
			})
			.sort((a, b) => {
				const sa = String(a?.start_date || '');
				const sb = String(b?.start_date || '');
				if (sa !== sb) return sa.localeCompare(sb);
				return String(a?.title || '').localeCompare(String(b?.title || ''));
			})
			.slice(0, 12);

		if (!upcoming.length) {
			els.upcomingEvents.innerHTML = '<div class="ac-muted">No upcoming events.</div>';
			return;
		}

		els.upcomingEvents.innerHTML = upcoming.map((evt) => {
			const cat = normalizeCategory(evt?.category);
			return `
				<div class="event" role="button" tabindex="0" data-jump="${escapeHtml(evt?.start_date || '')}">
					<div class="event-head">
						<div class="event-title">${escapeHtml(evt?.title || '')}</div>
						<div class="event-range ac-muted">${escapeHtml(eventRangeLabel(evt))}</div>
					</div>
					<div class="event-meta"><span class="pill"><span class="dot ${categoryDotClass(cat)}" aria-hidden="true"></span>${escapeHtml(categoryLabel(cat))}</span></div>
				</div>
			`;
		}).join('');

		els.upcomingEvents.querySelectorAll('[data-jump]')?.forEach((node) => {
			const jump = node.getAttribute('data-jump');
			const jumpDate = parseYMD(jump);
			if (!jumpDate) return;
			const go = () => {
				state.monthCursor = startOfMonth(jumpDate);
				setSelectedDate(jumpDate);
				renderMonth();
			};
			node.addEventListener('click', go);
			node.addEventListener('keydown', (e) => {
				if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault();
					go();
				}
			});
		});
	}

	function setReminderStatus(msg, isError) {
		if (!els.reminderFormStatus) return;
		els.reminderFormStatus.textContent = msg || '';
		els.reminderFormStatus.classList.remove('is-error', 'is-success');
		if (!msg) return;
		els.reminderFormStatus.classList.add(isError ? 'is-error' : 'is-success');
	}

	function getLoggedInIdentity() {
		const keys = ['review_user', 'scholarship_user'];
		for (const key of keys) {
			try {
				const raw = localStorage.getItem(key);
				if (!raw) continue;
				const user = JSON.parse(raw);
				if (user?.email) {
					return {
						email: normalizeEmail(user.email),
						studentId: String(user?.student_id || '').trim()
					};
				}
			} catch {
				// ignore malformed session
			}
		}

		const sessionKeys = ['review_session', 'scholarship_session'];
		for (const key of sessionKeys) {
			try {
				const raw = localStorage.getItem(key);
				if (!raw) continue;
				const session = JSON.parse(raw);
				if (session?.email) {
					return {
						email: normalizeEmail(session.email),
						studentId: String(session?.studentId || '').trim()
					};
				}
			} catch {
				// ignore malformed session
			}
		}

		return null;
	}

	function selectedReminderTypes() {
		const map = [
			{ el: els.remTypeRegistration, type: 'registration' },
			{ el: els.remTypeInstallment, type: 'installment' },
			{ el: els.remTypeExams, type: 'exams' },
			{ el: els.remTypeDrop, type: 'drop' },
			{ el: els.remTypeHoliday, type: 'holiday' }
		];
		return map.filter((item) => Boolean(item.el?.checked)).map((item) => item.type);
	}

	function examBlockStartEvents(allEvents) {
		const exams = (allEvents || [])
			.filter((evt) => normalizeCategory(evt?.category) === 'exam' && parseYMD(evt?.start_date))
			.sort((a, b) => String(a?.start_date || '').localeCompare(String(b?.start_date || '')));

		let prevEnd = null;
		const starts = [];

		exams.forEach((evt) => {
			const start = parseYMD(evt?.start_date);
			const end = parseYMD(evt?.end_date) || start;
			if (!start || !end) return;

			const isNewBlock = !prevEnd || start.getTime() > addDays(prevEnd, 1).getTime();
			if (isNewBlock) starts.push(evt);

			if (!prevEnd || end.getTime() > prevEnd.getTime()) prevEnd = end;
		});

		return starts;
	}

	function reminderEventsForType(type) {
		const events = state.academicEvents || [];
		if (type === 'registration') {
			return events.filter((evt) => normalizeCategory(evt?.category) === 'registration');
		}
		if (type === 'installment') {
			return events.filter((evt) => {
				const title = String(evt?.title || '').toLowerCase();
				return normalizeCategory(evt?.category) === 'payment' || /installment|tuition|payment/.test(title);
			});
		}
		if (type === 'exams') {
			return examBlockStartEvents(events);
		}
		if (type === 'drop') {
			return events.filter((evt) => /\bdrop\b/i.test(String(evt?.title || '')));
		}
		if (type === 'holiday') {
			return events.filter((evt) => normalizeCategory(evt?.category) === 'holiday');
		}
		return [];
	}

	async function submitReminderRequests(e) {
		e.preventDefault();
		if (!window.supabasePublicClient) {
			setReminderStatus('Supabase is not available right now. Please try again later.', true);
			return;
		}

		const identity = getLoggedInIdentity();
		const email = normalizeEmail(identity?.email);
		const studentId = String(identity?.studentId || '').trim();
		const daysBefore = parseInt(String(els.reminderDaysBefore?.value || '0'), 10);
		const types = selectedReminderTypes();

		if (!email || !isValidUiuEmail(email)) {
			setReminderStatus('Please log in first to request reminders.', true);
			return;
		}

		if (!Number.isInteger(daysBefore) || daysBefore < 1 || daysBefore > 30) {
			setReminderStatus('Please choose a valid reminder day value.', true);
			els.reminderDaysBefore?.focus?.();
			return;
		}

		if (!types.length) {
			setReminderStatus('Select at least one reminder type.', true);
			return;
		}

		try {
			const pendingStatus = await fetchReminderPendingStatus(identity);
			if (pendingStatus.pending) {
				markReminderPendingCached(email, state.term);
				showReminderPendingView('Request Under Review', pendingMessageWithDate(pendingStatus.requestedAt));
				return;
			}
		} catch (statusErr) {
			console.warn('Could not verify pending status before submit:', statusErr);
		}

		const eventIdSet = new Set();
		types.forEach((type) => {
			reminderEventsForType(type).forEach((evt) => {
				if (evt?.id) eventIdSet.add(evt.id);
			});
		});

		const eventIds = Array.from(eventIdSet);
		if (!eventIds.length) {
			setReminderStatus('No matching events found for selected reminder types in this term.', true);
			return;
		}

		const requestGroupId = createRequestGroupId();
		const payload = eventIds.map((eventId) => ({
			event_id: eventId,
			request_group_id: requestGroupId,
			request_term: state.term,
			requested_types: types,
			request_email: email,
			request_student_id: studentId || null,
			days_before: daysBefore,
			status: 'pending',
			is_active: true
		}));

		try {
			setReminderStatus('Submitting request…', false);
			if (els.submitReminderRequestBtn) els.submitReminderRequestBtn.disabled = true;

			const { error } = await window.supabasePublicClient
				.from('academic_calendar_reminder_requests')
				.insert(payload);

			if (error) throw error;

			setReminderStatus('Your reminder request has been submitted successfully. Admin will review and approve or reject it shortly.', false);
			markReminderPendingCached(email, state.term);
			showReminderPendingView('Request Submitted', 'Your reminder request has been submitted and is now pending admin review.');
			[els.remTypeRegistration, els.remTypeInstallment, els.remTypeExams, els.remTypeDrop, els.remTypeHoliday].forEach((node) => {
				if (node) node.checked = false;
			});
		} catch (err) {
			console.error('Reminder request submit failed:', err);
			const msg = String(err?.message || '').toLowerCase();
			if (msg.includes('pending_reminder_request_exists')) {
				markReminderPendingCached(email, state.term);
				showReminderPendingView('Request Under Review', 'Your previous reminder request is still pending admin review. You can submit another one after a decision is made.');
				return;
			}
			setReminderStatus(`Unable to submit requests: ${err?.message || String(err)}`, true);
		} finally {
			if (els.submitReminderRequestBtn) els.submitReminderRequestBtn.disabled = false;
		}
	}

	async function submitDayReminder(e) {
		e.preventDefault();
		if (!window.supabasePublicClient) {
			setDayReminderStatus('Supabase is not available right now. Please try again later.', true);
			return;
		}

		const identity = getLoggedInIdentity();
		const email = normalizeEmail(identity?.email);
		const studentId = String(identity?.studentId || '').trim();
		const title = String(els.dayReminderTitle?.value || '').trim();
		const reminderDate = String(els.dayReminderDate?.value || '').trim();
		const daysBefore = parseInt(String(els.dayReminderDaysBefore?.value || '0'), 10);
		const reminderTime = String(els.dayReminderTime?.value || '').trim();
		const description = String(els.dayReminderDescription?.value || '').trim();

		if (!email || !isValidUiuEmail(email)) {
			setDayReminderStatus('Please log in with your UIU email to add reminders.', true);
			return;
		}

		if (!title) {
			setDayReminderStatus('Please enter a reminder title.', true);
			els.dayReminderTitle?.focus?.();
			return;
		}

		if (!parseYMD(reminderDate)) {
			setDayReminderStatus('Please choose a valid reminder date.', true);
			els.dayReminderDate?.focus?.();
			return;
		}

		if (!Number.isInteger(daysBefore) || daysBefore < 0 || daysBefore > 30) {
			setDayReminderStatus('Please choose a valid "days before" value.', true);
			els.dayReminderDaysBefore?.focus?.();
			return;
		}

		const sendDate = subtractDaysYMD(reminderDate, daysBefore);
		if (!sendDate) {
			setDayReminderStatus('Could not calculate reminder schedule. Please recheck date.', true);
			return;
		}

		if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(reminderTime)) {
			setDayReminderStatus('Please choose a valid reminder time.', true);
			els.dayReminderTime?.focus?.();
			return;
		}

		const maxAllowed = Number(state.studentReminderLimit || 5);
		if (Number(state.studentReminderActiveCount || 0) >= maxAllowed) {
			setDayReminderStatus(`Reminder limit is ${maxAllowed}. Delete or wait for an old reminder date to pass.`, true);
			return;
		}

		try {
			setDayReminderStatus('Saving reminder…', false);
			if (els.addDayReminderSubmitBtn) els.addDayReminderSubmitBtn.disabled = true;

			const { data, error } = await window.supabasePublicClient.functions.invoke('student-calendar-reminders', {
				body: {
					action: 'create',
					email,
					studentId,
					term: state.term,
					title,
					description,
					reminderDate,
					daysBefore,
					reminderTime
				}
			});

			if (error) throw error;

			if (!data?.success) {
				if (String(data?.error || '').toLowerCase() === 'reminder_limit_reached') {
					const limit = Number(data?.limit || 5);
					setDayReminderStatus(`Reminder limit is ${limit}. You cannot add a 6th reminder.`, true);
					state.studentReminderActiveCount = Number(data?.activeCount || state.studentReminderActiveCount || limit);
					renderReminderLimitInfo();
					return;
				}
				if (String(data?.error || '').toLowerCase() === 'duplicate_reminder_for_event') {
					setDayReminderStatus('You already added a reminder for this event title and date.', true);
					return;
				}
				setDayReminderStatus(`Could not save reminder: ${data?.error || 'Unknown error'}`, true);
				return;
			}

			const beforeLabel = daysBefore > 0
				? `${daysBefore} day${daysBefore === 1 ? '' : 's'} before`
				: 'on event day';
			setDayReminderStatus(`Reminder added. Email will be sent ${beforeLabel} at ${reminderTime}.`, false);
			if (els.addDayReminderForm) els.addDayReminderForm.reset();
			await fetchStudentRemindersForCurrentTerm();
			renderMonth();
			renderDayPanel();
			setTimeout(() => closeAddDayReminderModal(), 500);
		} catch (err) {
			const errMsg = String(err?.message || err || '').toLowerCase();
			if (errMsg.includes('reminder_limit_reached')) {
				setDayReminderStatus('Reminder limit is 5. You cannot add a 6th reminder.', true);
				return;
			}
			if (errMsg.includes('duplicate_reminder_for_event')) {
				setDayReminderStatus('You already added a reminder for this event title and date.', true);
				return;
			}
			setDayReminderStatus(`Could not save reminder: ${err?.message || String(err)}`, true);
		} finally {
			if (els.addDayReminderSubmitBtn) els.addDayReminderSubmitBtn.disabled = false;
		}
	}

	function bindReminderActions() {
		if (!els.reminderRequestForm) return;

		els.openReminderModalBtn?.addEventListener('click', openReminderModal);
		els.reminderModalCloseBtn?.addEventListener('click', closeReminderModal);
		els.reminderModalBackdrop?.addEventListener('click', closeReminderModal);
		els.reminderRequestForm.addEventListener('submit', submitReminderRequests);
		els.openAddDayReminderBtn?.addEventListener('click', openAddDayReminderModal);
		els.addDayReminderCloseBtn?.addEventListener('click', closeAddDayReminderModal);
		els.addDayReminderBackdrop?.addEventListener('click', closeAddDayReminderModal);
		els.addDayReminderForm?.addEventListener('submit', submitDayReminder);
	}

	function setSelectedDate(date, opts) {
		state.selectedDate = startOfDay(date);
		if (els.dayReminderDate) {
			els.dayReminderDate.value = toYMD(state.selectedDate);
		}
		setUrlState({ term: state.term, date: toYMD(state.selectedDate) });
		renderMonth();
		renderDayPanel();
		if (opts?.openModal) openDayModal();
	}

	async function init() {
		try {
			renderStatus('Loading calendar…');
			const urlState = getUrlState();
			const terms = await fetchAvailableTerms();
			if (!terms.length) {
				renderStatus('No academic calendar events found yet.');
				if (els.termSelect) {
					els.termSelect.innerHTML = '<option value="">No terms</option>';
				}
				return;
			}

			state.term = (urlState.term && terms.includes(urlState.term)) ? urlState.term : terms[terms.length - 1];
			renderTermOptions(terms, state.term);
			state.academicEvents = await fetchEventsForTerm(state.term);
			await fetchStudentRemindersForCurrentTerm();

			const urlDate = parseYMD(urlState.date);
			if (urlDate) {
				state.selectedDate = startOfDay(urlDate);
				state.monthCursor = startOfMonth(urlDate);
			}

			renderMonth();
			renderDayPanel();
			renderUpcoming();
			renderStatus(state.academicEvents.length ? '' : 'No events for this term.');
			bindReminderActions();

			els.dayModalCloseBtn?.addEventListener('click', closeDayModal);
			els.dayModalBackdrop?.addEventListener('click', closeDayModal);
			document.addEventListener('keydown', (e) => {
				if (e.key !== 'Escape') return;
				if (isDayModalOpen()) closeDayModal();
				if (isReminderModalOpen()) closeReminderModal();
				if (isAddDayReminderModalOpen()) closeAddDayReminderModal();
			});

			els.termSelect?.addEventListener('change', async () => {
				const next = els.termSelect.value;
				if (!next || next === state.term) return;
				state.term = next;
				setUrlState({ term: state.term, date: toYMD(state.selectedDate) });
				state.academicEvents = await fetchEventsForTerm(state.term);
				await fetchStudentRemindersForCurrentTerm();
				renderMonth();
				renderDayPanel();
				renderUpcoming();
			});

			els.prevMonthBtn?.addEventListener('click', () => {
				state.monthCursor = new Date(state.monthCursor.getFullYear(), state.monthCursor.getMonth() - 1, 1);
				renderMonth();
			});

			els.nextMonthBtn?.addEventListener('click', () => {
				state.monthCursor = new Date(state.monthCursor.getFullYear(), state.monthCursor.getMonth() + 1, 1);
				renderMonth();
			});

			els.todayBtn?.addEventListener('click', () => {
				const today = startOfDay(new Date());
				state.monthCursor = startOfMonth(today);
				setSelectedDate(today, { openModal: false });
			});

			// Copy-link button removed from modal.
		} catch (e) {
			console.error('Academic calendar init failed:', e);
			renderStatus(`Unable to load calendar: ${e?.message || String(e)}`);
		}
	}

	init();
})();
