// Exam Routine & Seat Plan lookup
// Uses Supabase public read policies

(function () {
    if (typeof window.trackToolUsage === 'function') {
        window.trackToolUsage('Exam Seatplan');
    }

    const PAGE_STATUS_ID = 'pageStatus';

    function $(id) {
        return document.getElementById(id);
    }

    function getDbClient() {
        return window.supabasePublicClient || window.supabaseClient || null;
    }

    function setText(id, text) {
        const el = $(id);
        if (el) el.textContent = text;
    }

    function setVisible(id, show) {
        const el = $(id);
        if (el) el.style.display = show ? '' : 'none';
    }

    function clearSelect(selectEl, placeholderLabel) {
        if (!selectEl) return;
        selectEl.innerHTML = '';
        const opt = document.createElement('option');
        opt.value = '';
        opt.textContent = placeholderLabel;
        selectEl.appendChild(opt);
    }

    function fillSelect(selectEl, options) {
        if (!selectEl) return;
        for (const { value, label } of options) {
            const opt = document.createElement('option');
            opt.value = value;
            opt.textContent = label;
            selectEl.appendChild(opt);
        }
    }

    function normalizeStudentId(rawValue) {
        const digitsOnly = String(rawValue ?? '').replace(/\D/g, '');
        if (digitsOnly.length < 9 || digitsOnly.length > 10) return null;
        const asNumber = Number(digitsOnly);
        if (!Number.isFinite(asNumber)) return null;
        return asNumber;
    }

    function formatDate(dateStr) {
        if (!dateStr) return '—';
        const d = new Date(`${dateStr}T00:00:00`);
        if (Number.isNaN(d.getTime())) return String(dateStr);
        return new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: '2-digit' }).format(d);
    }

    function formatTimeRange(startTimeStr, endTimeStr) {
        function toDate(timeStr) {
            const t = String(timeStr || '').slice(0, 8);
            const d = new Date(`1970-01-01T${t}`);
            return Number.isNaN(d.getTime()) ? null : d;
        }

        const start = toDate(startTimeStr);
        const end = toDate(endTimeStr);

        const fmt = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' });
        if (start && end) return `${fmt.format(start)} - ${fmt.format(end)}`;
        if (start) return fmt.format(start);
        return '—';
    }

    function toast(message, type = 'info') {
        const div = document.createElement('div');
        div.className = `alert alert-${type}`;
        div.textContent = message;
        document.body.appendChild(div);

        // trigger transition
        requestAnimationFrame(() => div.classList.add('show'));

        setTimeout(() => {
            div.classList.remove('show');
            setTimeout(() => div.remove(), 300);
        }, 4500);
    }

    function renderResult({ sessionName, exam, allocation }) {
        const resultCard = $('resultCard');
        const resultBody = $('resultBody');
        if (!resultCard || !resultBody) return;

        const courseTitle = (exam.course_title || '').trim();
        const courseLine = courseTitle
            ? `${exam.course_code} — ${courseTitle}`
            : String(exam.course_code || '');

        const examDate = formatDate(exam.exam_date);
        const timeRange = formatTimeRange(exam.start_time, exam.end_time);

        const roomLabel = allocation?.room_label || allocation?.room_number || '—';

        setText('resultSub', sessionName ? `Session: ${sessionName}` : '—');

        resultBody.innerHTML = `
            <div class="seatplan-result-grid">
                <div class="seatplan-result-tile">
                    <div class="seatplan-result-label">Course</div>
                    <div class="seatplan-result-value">${escapeHtml(courseLine)}</div>
                </div>
                <div class="seatplan-result-tile">
                    <div class="seatplan-result-label">Section</div>
                    <div class="seatplan-result-value">${escapeHtml(exam.section || '—')}</div>
                </div>
                <div class="seatplan-result-tile">
                    <div class="seatplan-result-label">Exam Date</div>
                    <div class="seatplan-result-value">${escapeHtml(examDate)}</div>
                </div>
                <div class="seatplan-result-tile">
                    <div class="seatplan-result-label">Exam Time</div>
                    <div class="seatplan-result-value">${escapeHtml(timeRange)}</div>
                </div>
                <div class="seatplan-result-tile" style="grid-column: 1 / -1;">
                    <div class="seatplan-result-label">Room</div>
                    <div class="seatplan-result-value seatplan-room">${escapeHtml(roomLabel)}</div>
                </div>
            </div>
        `;

        resultCard.style.display = '';
        resultCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function renderNotFound(sessionName, contextMessage) {
        const resultCard = $('resultCard');
        const resultBody = $('resultBody');
        if (!resultCard || !resultBody) return;

        setText('resultSub', sessionName ? `Session: ${sessionName}` : '—');
        resultBody.innerHTML = `
            <div class="seatplan-result-tile">
                <div class="seatplan-result-label">Not found</div>
                <div class="seatplan-result-value">${escapeHtml(contextMessage || 'No matching room found for this input.')}</div>
                <div class="seatplan-hint" style="margin-top: 0.65rem;">
                    Double-check session, course code, section, and student ID.
                </div>
            </div>
        `;
        resultCard.style.display = '';
        resultCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

        async function run() {
        const db = getDbClient();
        const sessionSelect = $('sessionSelect');
        const departmentSelect = $('departmentSelect');
        const courseInput = $('courseCodeInput');
        const courseDropdown = $('courseDropdown');
        const courseAutocompleteContainer = $('courseAutocompleteContainer');
        const courseHint = $('courseHint');
        const sectionSelect = $('sectionSelect');
        const studentIdInput = $('studentIdInput');
        const form = $('seatPlanForm');
        const findBtn = $('findBtn');

        function setPageStatus(msg) {
            setText(PAGE_STATUS_ID, msg || '');
        }

        if (!db) {
            setPageStatus('Supabase is not available in this browser/session.');
            toast('Supabase SDK not loaded.', 'error');
            if (findBtn) findBtn.disabled = true;
            return;
        }

        let sessionExams = [];
        let sessions = [];
        let currentSessionId = null;
        let coursesByCode = new Map();

        function setFormDisabled(disabled) {
            if (sessionSelect) sessionSelect.disabled = disabled;
            if (departmentSelect) departmentSelect.disabled = disabled;
            if (courseInput) courseInput.disabled = disabled;
            if (sectionSelect) sectionSelect.disabled = disabled;
            if (findBtn) findBtn.disabled = disabled;
        }

        function setControlsForState() {
            if (!departmentSelect || !courseInput || !sectionSelect) return;
            departmentSelect.disabled = !sessionExams.length;
            courseInput.disabled = !departmentSelect.value;
            sectionSelect.disabled = !courseInput.value;
        }

        function computeDepartments() {
            const uniq = new Set();
            for (const e of sessionExams) {
                if (e.department) uniq.add(String(e.department));
            }
            return Array.from(uniq).sort((a, b) => a.localeCompare(b));
        }

        function computeCourses(dept) {
            const uniq = new Map();
            coursesByCode = new Map();

            for (const e of sessionExams) {
                if (String(e.department) !== String(dept)) continue;
                const code = String(e.course_code || '').trim();
                if (!code) continue;

                const title = String(e.course_title || '').trim();
                if (!uniq.has(code)) {
                    uniq.set(code, { code, title });
                } else {
                    // Prefer a non-empty title if we have one
                    const existing = uniq.get(code);
                    if (!existing.title && title) existing.title = title;
                }
            }

            const list = Array.from(uniq.values()).sort((a, b) => a.code.localeCompare(b.code));
            for (const item of list) {
                coursesByCode.set(item.code, item);
            }
            return list;
        }

        function computeSections(dept, courseCode) {
            const uniq = new Set();
            for (const e of sessionExams) {
                if (String(e.department) !== String(dept)) continue;
                if (String(e.course_code || '').trim() !== String(courseCode || '').trim()) continue;
                if (e.section) uniq.add(String(e.section));
            }
            return Array.from(uniq).sort((a, b) => a.localeCompare(b));
        }

        function refreshCourseHint() {
            if (!courseHint) return;
            const code = String(courseInput?.value || '').trim();
            if (!code) {
                courseHint.textContent = '';
                return;
            }
            const info = coursesByCode.get(code);
            if (info?.title) {
                courseHint.textContent = info.title;
            } else {
                courseHint.textContent = '';
            }
        }

        async function loadSessions() {
            setPageStatus('Loading sessions…');
            const { data, error } = await db
                .from('exam_sessions')
                .select('id,name,exam_type,term,published_at,is_active')
                .eq('is_active', true)
                .order('published_at', { ascending: false });

            if (error) throw error;
            sessions = Array.isArray(data) ? data : [];

            clearSelect(sessionSelect, 'Select session');
            fillSelect(
                sessionSelect,
                sessions.map((s) => ({
                    value: s.id,
                    label: s.term ? `${s.name} (${s.term})` : s.name
                }))
            );

            if (sessions.length) {
                sessionSelect.value = sessions[0].id;
            }
        }

        async function loadExamsForSession(sessionId) {
            currentSessionId = sessionId || null;
            sessionExams = [];

            if (!sessionId) {
                clearSelect(departmentSelect, 'Select department');
                if (courseInput) courseInput.value = '';
                if (courseDropdown) courseDropdown.innerHTML = '';
                clearSelect(sectionSelect, 'Select section');
                setControlsForState();
                setPageStatus('');
                return;
            }

            setPageStatus('Loading routine…');

            const { data, error } = await db
                .from('exam_exams')
                .select('id,department,course_code,course_title,section,teacher,exam_date,start_time,end_time')
                .eq('session_id', sessionId);

            if (error) throw error;

            sessionExams = Array.isArray(data) ? data : [];

            const departments = computeDepartments();
            clearSelect(departmentSelect, 'Select department');
            fillSelect(departmentSelect, departments.map((d) => ({ value: d, label: d })));

            // Reset downstream
            departmentSelect.value = '';
            if (courseInput) courseInput.value = '';
            if (courseDropdown) courseDropdown.innerHTML = '';
            clearSelect(sectionSelect, 'Select section');
            refreshCourseHint();

            setControlsForState();

            if (!sessionExams.length) {
                setPageStatus('No exams found for this session yet.');
            } else {
                setPageStatus('');
            }
        }

        function getSelectedSessionName() {
            const id = sessionSelect?.value;
            const s = sessions.find((x) => x.id === id);
            return s?.name || '';
        }

        function findExamForSelection(dept, courseCode, section) {
            const list = sessionExams.filter((e) =>
                String(e.department) === String(dept) &&
                String(e.course_code || '').trim() === String(courseCode || '').trim() &&
                String(e.section) === String(section)
            );

            if (!list.length) return null;

            list.sort((a, b) => {
                const ad = String(a.exam_date || '');
                const bd = String(b.exam_date || '');
                if (ad !== bd) return ad.localeCompare(bd);
                return String(a.start_time || '').localeCompare(String(b.start_time || ''));
            });

            return list[0];
        }

        async function findAllocationForExam(examId, studentIdNumber) {
            const { data, error } = await db
                .from('exam_seat_allocations')
                .select('room_label,room_number,student_id_start,student_id_end')
                .eq('exam_id', examId);

            if (error) throw error;
            const rows = Array.isArray(data) ? data : [];

            const ranged = rows.filter((r) => r.student_id_start !== null && r.student_id_end !== null);
            const match = ranged.find((r) => studentIdNumber >= Number(r.student_id_start) && studentIdNumber <= Number(r.student_id_end));
            if (match) return match;

            if (rows.length === 1) return rows[0];
            return null;
        }

        function setWorking(isWorking) {
            if (findBtn) {
                findBtn.disabled = isWorking;
                findBtn.innerHTML = isWorking
                    ? '<i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i> Searching…'
                    : '<i class="fa-solid fa-location-dot" aria-hidden="true"></i> Find Room';
            }
        }

        // Event wiring
        sessionSelect?.addEventListener('change', async () => {
            try {
                setVisible('resultCard', false);
                await loadExamsForSession(sessionSelect.value);
            } catch (e) {
                console.warn('loadExamsForSession failed:', e);
                toast('Could not load routine for this session.', 'error');
                setPageStatus('Could not load routine for this session.');
            }
        });

        function renderCourseDropdown() {
            if (!courseDropdown || !courseAutocompleteContainer) return;
            const dept = departmentSelect?.value;
            const query = String(courseInput.value || '').trim().toLowerCase();
            
            if (!dept) {
                courseAutocompleteContainer.classList.remove('active');
                return;
            }

            const courses = computeCourses(dept);
            let matches = courses;
            if (query) {
                matches = courses.filter(c => 
                    c.code.toLowerCase().includes(query) || 
                    (c.title && c.title.toLowerCase().includes(query))
                );
            }

            courseDropdown.innerHTML = '';
            
            if (!matches.length) {
                const noRes = document.createElement('div');
                noRes.className = 'autocomplete-item no-results';
                noRes.textContent = 'No matching courses found';
                courseDropdown.appendChild(noRes);
                courseAutocompleteContainer.classList.add('active');
                return;
            }

            for (const c of matches) {
                const item = document.createElement('div');
                item.className = 'autocomplete-item';
                
                const cCode = document.createElement('div');
                cCode.className = 'autocomplete-course-code';
                cCode.textContent = c.code;
                item.appendChild(cCode);
                
                if (c.title) {
                    const cTitle = document.createElement('div');
                    cTitle.className = 'autocomplete-course-title';
                    cTitle.textContent = c.title;
                    item.appendChild(cTitle);
                }

                item.addEventListener('click', () => {
                    courseInput.value = c.code;
                    courseAutocompleteContainer.classList.remove('active');
                    refreshCourseHint();
                    
                    const sections = computeSections(dept, c.code);
                    clearSelect(sectionSelect, 'Select section');
                    fillSelect(sectionSelect, sections.map((s) => ({ value: s, label: s })));
                    if (sectionSelect) sectionSelect.disabled = !sections.length;
                    setControlsForState();
                });
                
                courseDropdown.appendChild(item);
            }
            
            courseAutocompleteContainer.classList.add('active');
        }

        // Hide dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (courseAutocompleteContainer && !courseAutocompleteContainer.contains(e.target)) {
                courseAutocompleteContainer.classList.remove('active');
            }
        });

        courseInput?.addEventListener('focus', () => {
            if (courseInput.value || departmentSelect?.value) {
                renderCourseDropdown();
            }
        });

        departmentSelect?.addEventListener('change', () => {
            setVisible('resultCard', false);
            if (!courseDropdown) return;

            if (!departmentSelect.value) {
                courseDropdown.innerHTML = '';
                if (courseInput) courseInput.value = '';
                clearSelect(sectionSelect, 'Select section');
                refreshCourseHint();
                setControlsForState();
                return;
            }

            if (courseInput) courseInput.value = '';
            clearSelect(sectionSelect, 'Select section');
            refreshCourseHint();
            setControlsForState();
            
            // Optionally auto-open dropdown if they just picked a department
            if (document.activeElement === departmentSelect && courseInput) {
                courseInput.focus();
            }
        });

        courseInput?.addEventListener('input', () => {
            setVisible('resultCard', false);
            renderCourseDropdown();
            refreshCourseHint();

            const dept = departmentSelect?.value;
            const code = String(courseInput.value || '').trim();

            clearSelect(sectionSelect, 'Select section');

            if (!dept || !code) {
                setControlsForState();
                return;
            }

            // Only populate sections if the typed code is exact match
            if (coursesByCode.has(code)) {
                const sections = computeSections(dept, code);
                fillSelect(sectionSelect, sections.map((s) => ({ value: s, label: s })));
                sectionSelect.disabled = !sections.length;
            }
            setControlsForState();
        });

        form?.addEventListener('submit', async (ev) => {
            ev.preventDefault();
            setVisible('resultCard', false);

            const sessionId = sessionSelect?.value;
            const dept = departmentSelect?.value;
            const courseCode = String(courseInput?.value || '').trim();
            const section = sectionSelect?.value;
            const studentIdNum = normalizeStudentId(studentIdInput?.value);

            if (!sessionId || !dept || !courseCode || !section) {
                toast('Please fill in session, department, course, and section.', 'warning');
                return;
            }

            if (!studentIdNum) {
                toast('Enter a valid student ID (9–10 digits).', 'warning');
                return;
            }

            const sessionName = getSelectedSessionName();
            const exam = findExamForSelection(dept, courseCode, section);
            if (!exam) {
                renderNotFound(sessionName, 'No matching exam found for the selected course/section.');
                return;
            }

            try {
                setWorking(true);
                setPageStatus('Searching seat plan…');

                const allocation = await findAllocationForExam(exam.id, studentIdNum);
                if (!allocation) {
                    renderNotFound(sessionName, 'No matching room found for this student ID.');
                    return;
                }

                renderResult({ sessionName, exam, allocation });
            } catch (e) {
                console.warn('Seat plan lookup failed:', e);
                toast('Seat plan lookup failed. Please try again.', 'error');
                setPageStatus('Seat plan lookup failed.');
            } finally {
                setWorking(false);
                setPageStatus('');
            }
        });

        // Initial load
        try {
            setFormDisabled(true);
            await loadSessions();
            await loadExamsForSession(sessionSelect?.value);
            setFormDisabled(false);
            setControlsForState();
        } catch (e) {
            console.warn('Initialization failed:', e);
            toast('Could not initialize seat plan page.', 'error');
            setPageStatus('Could not initialize seat plan page.');
            setFormDisabled(true);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', run);
    } else {
        run();
    }
})();
