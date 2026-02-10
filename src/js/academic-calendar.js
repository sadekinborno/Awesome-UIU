/* global supabasePublicClient */

(function () {
	'use strict';

	const els = {
		termSelect: document.getElementById('termSelect'),
		prevMonthBtn: document.getElementById('prevMonthBtn'),
		nextMonthBtn: document.getElementById('nextMonthBtn'),
		todayBtn: document.getElementById('todayBtn'),
		monthLabel: document.getElementById('monthLabel'),
		monthGrid: document.getElementById('monthGrid'),
		calendarStatus: document.getElementById('calendarStatus'),
		dayModal: document.getElementById('dayModal'),
		dayModalBackdrop: document.getElementById('dayModalBackdrop'),
		dayModalCloseBtn: document.getElementById('dayModalCloseBtn'),
		selectedDateTitle: document.getElementById('selectedDateTitle'),
		selectedDateSub: document.getElementById('selectedDateSub'),
		dayEvents: document.getElementById('dayEvents'),
		upcomingEvents: document.getElementById('upcomingEvents'),
		copyLinkBtn: null
	};

	const state = {
		term: null,
		allEvents: [],
		monthCursor: startOfMonth(new Date()),
		selectedDate: startOfDay(new Date())
	};

	const CATEGORIES = {
		deadline: { label: 'Deadline', dot: 'dot-high' },
		exam: { label: 'Exam', dot: 'dot-mid' },
		holiday: { label: 'Holiday', dot: 'dot-low' },
		registration: { label: 'Registration', dot: 'dot-reg' },
		payment: { label: 'Payment', dot: 'dot-high' },
		classes: { label: 'Classes', dot: 'dot-low' },
		advising: { label: 'Advising', dot: 'dot-mid' },
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

	function normalizeCategory(raw) {
		const c = String(raw || '').trim().toLowerCase();
		return CATEGORIES[c] ? c : 'general';
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

	function isModalOpen() {
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
		document.body.classList.remove('ac-modal-open');
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
			const chips = [
				`<span class="pill"><span class="dot ${categoryDotClass(cat)}" aria-hidden="true"></span>${escapeHtml(categoryLabel(cat))}</span>`,
				evt?.audience && evt.audience !== 'all' ? `<span class="pill">${escapeHtml(evt.audience)}</span>` : '',
				evt?.importance === 3 ? `<span class="pill pill-high">High</span>` : ''
			].filter(Boolean).join(' ');

			return `
				<div class="event">
					<div class="event-head">
						<div class="event-title">${escapeHtml(evt?.title || '')}</div>
						<div class="event-range ac-muted">${escapeHtml(eventRangeLabel(evt))}</div>
					</div>
					${chips ? `<div class="event-meta">${chips}</div>` : ''}
					${evt?.description ? `<div class="event-desc">${escapeHtml(evt.description)}</div>` : ''}
				</div>
			`;
		}).join('');
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

	function setSelectedDate(date, opts) {
		state.selectedDate = startOfDay(date);
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
			state.allEvents = await fetchEventsForTerm(state.term);

			const urlDate = parseYMD(urlState.date);
			if (urlDate) {
				state.selectedDate = startOfDay(urlDate);
				state.monthCursor = startOfMonth(urlDate);
			}

			renderMonth();
			renderDayPanel();
			renderUpcoming();
			renderStatus(state.allEvents.length ? '' : 'No events for this term.');

			els.dayModalCloseBtn?.addEventListener('click', closeDayModal);
			els.dayModalBackdrop?.addEventListener('click', closeDayModal);
			document.addEventListener('keydown', (e) => {
				if (e.key === 'Escape' && isModalOpen()) closeDayModal();
			});

			els.termSelect?.addEventListener('change', async () => {
				const next = els.termSelect.value;
				if (!next || next === state.term) return;
				state.term = next;
				setUrlState({ term: state.term, date: toYMD(state.selectedDate) });
				state.allEvents = await fetchEventsForTerm(state.term);
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
