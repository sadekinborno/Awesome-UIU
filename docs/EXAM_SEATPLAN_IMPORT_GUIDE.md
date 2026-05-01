# Exam Routine & Seat Plan — Import Guide (Repeatable)

This guide is the repeatable process to import a **new term/session** (e.g., “Summer 2026 Final”) into Supabase for the **Exam Routine & Seat Plan** tool.

It assumes you already have the DB schema from the migration and you will import a batch of rows from Excel (XLSX) by exporting to CSV.

---

## What you will do (high level)

1) Confirm the schema exists (`exam_sessions`, `exam_exams`, `exam_seat_allocations`).
2) Create a new **session** row (the “term + mid/final” container).
3) Export your XLSX → CSV and make sure the **CSV headers match** the staging table.
4) Import the CSV into a **staging** table via Supabase Dashboard.
5) Run one SQL “transform” that:
   - upserts exams into `exam_exams`
   - inserts seat allocations into `exam_seat_allocations`
6) Verify counts and spot-check a few lookups.
7) Clear the staging table (optional) to keep things tidy.

---

## 0) Prerequisites / one-time setup

### 0.1 Run the migration (one time)

Run the migration SQL once in Supabase SQL Editor:

- `db/migrations/add-exam-seat-plan.sql`

It creates:
- `public.exam_sessions`
- `public.exam_exams`
- `public.exam_seat_allocations`

And applies RLS policies:
- Public can `SELECT`
- Only admins can `INSERT/UPDATE/DELETE` via `public.is_admin()`

### 0.2 Confirm tables exist (quick check)

```sql
select
  to_regclass('public.exam_sessions') as exam_sessions,
  to_regclass('public.exam_exams') as exam_exams,
  to_regclass('public.exam_seat_allocations') as exam_seat_allocations;
```

You should see all three as non-null.

---

## 1) Prepare your Excel (XLSX) data

Your data usually has columns like:
- Department (CSE, BBA, etc.)
- Course code
- Course title (optional but recommended)
- Section
- Teacher (optional)
- Exam date
- Exam time range
- Room cell that contains a room + student ID range in parentheses

### 1.1 Required format for the room cell

This import expects **one room allocation per row** in your CSV, where `room_text` looks like:

- `305 (0312520013-2212610006)`

Notes:
- `305` can be any text label (e.g., `AC-2`, `Room 305`, etc.).
- The ID range must be two numbers with a dash.

If your XLSX has multiple rooms in one cell, split them into separate rows before exporting.

### 1.2 Export to CSV

In Excel:
- File → Save As → `CSV UTF-8 (Comma delimited) (*.csv)`

---

## 2) Create the staging table (one-time)

You’ll import the CSV into a staging table first. Run this once in Supabase SQL Editor:

```sql
create table if not exists public.exam_seatplan_staging (
  school text,
  dept text,
  course_code text,
  course_title text,
  section text,
  teacher text,
  exam_date_text text,
  exam_time_text text,
  room_text text
);
```

Optional but recommended (keeps staging from being publicly readable):

```sql
alter table public.exam_seatplan_staging enable row level security;

drop policy if exists "Staging admin all" on public.exam_seatplan_staging;
create policy "Staging admin all"
on public.exam_seatplan_staging
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());
```

---

## 3) Make the CSV headers match the staging table (critical)

Your CSV header row MUST match the staging columns exactly:

```
school,dept,course_code,course_title,section,teacher,exam_date_text,exam_time_text,room_text
```

Common mistakes:
- `Department` instead of `dept`
- `Course Code` instead of `course_code`
- `Room` instead of `room_text`

If the headers don’t match, the Supabase CSV import will fail.

---

## 4) Create a new session for the new term

Pick a session name that you will reuse in queries and in the UI dropdown, for example:
- `Summer 2026 Mid`
- `Summer 2026 Final`

Run:

```sql
insert into public.exam_sessions (name, exam_type, term, is_active)
values ('Summer 2026 Mid', 'mid', 'Summer 2026', true)
on conflict (name) do update
set
  exam_type = excluded.exam_type,
  term = excluded.term,
  is_active = excluded.is_active;
```

Optional: make only one session active at a time:

```sql
update public.exam_sessions
set is_active = (name = 'Summer 2026 Mid');
```

---

## 5) Import the CSV into staging (Supabase Dashboard)

Supabase Dashboard → Table Editor → `exam_seatplan_staging`

- Click **Insert** / **Import data from CSV** (wording can vary)
- Choose your CSV
- Confirm mapping (should auto-map when headers match)
- Import

If you are re-importing for the same term, consider clearing staging first:

```sql
truncate table public.exam_seatplan_staging;
```

---

## 6) Transform staging → production tables (the main SQL)

Update the session name below and run this in Supabase SQL Editor.

This version is written for these common formats:
- `exam_date_text` like `18-Apr-26`
- `exam_time_text` like `09:00 AM - 11:00 AM`
- `room_text` like `305 (0312520013-2212610006)`

```sql
with
session as (
  select id as session_id
  from public.exam_sessions
  where name = 'Summer 2026 Mid'
  limit 1
),
parsed as (
  select
    s.session_id,
    trim(st.dept) as department,
    trim(st.course_code) as course_code,
    nullif(trim(st.course_title), '') as course_title,
    trim(st.section) as section,
    nullif(trim(st.teacher), '') as teacher,

    -- Date parsing: expects DD-Mon-YY like 18-Apr-26
    to_date(trim(st.exam_date_text), 'DD-Mon-YY') as exam_date,

    -- Time parsing: expects "09:00 AM - 11:00 AM"
    to_timestamp(trim(split_part(st.exam_time_text, '-', 1)), 'HH12:MI AM')::time as start_time,
    to_timestamp(trim(split_part(st.exam_time_text, '-', 2)), 'HH12:MI AM')::time as end_time,

    trim(st.room_text) as room_text
  from public.exam_seatplan_staging st
  cross join session s
  where coalesce(trim(st.dept), '') <> ''
    and coalesce(trim(st.course_code), '') <> ''
    and coalesce(trim(st.section), '') <> ''
    and coalesce(trim(st.exam_date_text), '') <> ''
    and coalesce(trim(st.exam_time_text), '') <> ''
),
upsert_exams as (
  insert into public.exam_exams (
    session_id,
    department,
    course_code,
    course_title,
    section,
    teacher,
    exam_date,
    start_time,
    end_time
  )
  select
    p.session_id,
    p.department,
    p.course_code,
    p.course_title,
    p.section,
    p.teacher,
    p.exam_date,
    p.start_time,
    p.end_time
  from parsed p
  group by
    p.session_id,
    p.department,
    p.course_code,
    p.course_title,
    p.section,
    p.teacher,
    p.exam_date,
    p.start_time,
    p.end_time
  on conflict (session_id, department, course_code, section, exam_date, start_time)
  do update set
    course_title = excluded.course_title,
    teacher = excluded.teacher,
    end_time = excluded.end_time
  returning id, session_id, department, course_code, section, exam_date, start_time
),
alloc_rows as (
  select
    e.id as exam_id,

    -- room label: text before '(' if present, else full text
    nullif(trim(split_part(p.room_text, '(', 1)), '') as room_label,

    -- numeric-ish room number (optional): first number found, else null
    nullif((regexp_match(p.room_text, '([0-9]+)'))[1], '') as room_number,

    -- id range parsing from (...) like (0312520013-2212610006)
    nullif((regexp_match(p.room_text, '\((\d+)\s*-\s*(\d+)\)'))[1], '')::bigint as student_id_start,
    nullif((regexp_match(p.room_text, '\((\d+)\s*-\s*(\d+)\)'))[2], '')::bigint as student_id_end
  from parsed p
  join public.exam_exams e
    on e.session_id = p.session_id
   and e.department = p.department
   and e.course_code = p.course_code
   and e.section = p.section
   and e.exam_date = p.exam_date
   and e.start_time = p.start_time
)
insert into public.exam_seat_allocations (
  exam_id,
  room_number,
  room_label,
  student_id_start,
  student_id_end
)
select
  a.exam_id,
  a.room_number,
  coalesce(a.room_label, 'Unknown') as room_label,
  a.student_id_start,
  a.student_id_end
from alloc_rows a
where a.room_label is not null
  and a.student_id_start is not null
  and a.student_id_end is not null;
```

### If your date format is different

If your CSV uses `YYYY-MM-DD` (e.g., `2026-04-18`), replace the date line with:

```sql
to_date(trim(st.exam_date_text), 'YYYY-MM-DD') as exam_date,
```

### If your time format is different

If you have 24-hour times like `09:00 - 11:00`, replace time parsing with:

```sql
to_timestamp(trim(split_part(st.exam_time_text, '-', 1)), 'HH24:MI')::time as start_time,
 to_timestamp(trim(split_part(st.exam_time_text, '-', 2)), 'HH24:MI')::time as end_time,
```

---

## 7) Verification queries (do these every time)

### 7.1 Check counts

```sql
select count(*) as sessions from public.exam_sessions;
select count(*) as exams from public.exam_exams;
select count(*) as allocations from public.exam_seat_allocations;
```

### 7.2 Check the new session has exams

```sql
select
  s.name,
  count(e.*) as exams
from public.exam_sessions s
left join public.exam_exams e on e.session_id = s.id
group by s.name
order by s.name;
```

### 7.3 Spot-check a specific course/section

```sql
select
  e.department,
  e.course_code,
  e.section,
  e.exam_date,
  e.start_time,
  e.end_time,
  a.room_label,
  a.student_id_start,
  a.student_id_end
from public.exam_exams e
join public.exam_seat_allocations a on a.exam_id = e.id
join public.exam_sessions s on s.id = e.session_id
where s.name = 'Summer 2026 Mid'
  and e.department = 'CSE'
  and e.course_code = 'CSE101'
  and e.section = 'A'
order by a.room_label;
```

---

## 8) Cleanup (recommended)

After a successful import:

```sql
truncate table public.exam_seatplan_staging;
```

---

## Troubleshooting

### “CSV import failed” / columns don’t match

- Confirm the CSV header row matches exactly:
  `school,dept,course_code,course_title,section,teacher,exam_date_text,exam_time_text,room_text`

### “Trailing junk after numeric literal” when using a UUID

- Don’t do `::015c2ccf...`.
- Correct is `'015c2ccf-....'::uuid`.
- Best approach is what this guide uses: session lookup by name.

### Zero allocations inserted

- Check `room_text` contains a range in parentheses, like `(0312520013-2212610006)`.
- Run this to see rows that failed parsing:

```sql
select room_text
from public.exam_seatplan_staging
where room_text is null
   or room_text !~ '\\(\\d+\\s*-\\s*\\d+\\)'
limit 50;
```

### Duplicate imports

If you rerun the transform SQL without clearing production tables, you may create duplicate allocations.

Simplest safe workflow:
- `truncate` staging
- re-import CSV
- delete existing allocations/exams for that session (only if you truly want a full replace)

Example full replace (be careful):

```sql
-- Deletes exams + allocations (cascade) for the session
with s as (
  select id
  from public.exam_sessions
  where name = 'Summer 2026 Mid'
  limit 1
)
delete from public.exam_exams e
using s
where e.session_id = s.id;
```

---

## Optional note: “School” column

The production schema does not require `school`.

If you later need multi-school separation, we can add `school` to `exam_exams` and include it in the unique constraint + indexes.
