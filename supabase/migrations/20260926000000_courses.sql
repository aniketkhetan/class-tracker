-- Courses.
--
-- A student can be taught more than one thing, each with its own weekly
-- schedule and its own rate, all owed to you as one balance. That needs a level
-- between student and schedule, so schedules and sessions now hang off a course
-- and reach the student through it. The rate moves from the student to the
-- course, which is the point of the exercise.
--
-- Payments stay on the student, so two courses feed one balance.

create table courses (
  id          serial primary key,
  student_id  integer not null references students (id) on delete cascade,
  name        text not null,
  rate_paise  integer not null,
  archived_at timestamptz,
  created_at  timestamptz not null default now()
);

create index courses_student_idx on courses (student_id);
alter table courses enable row level security;

-- Every existing student gets one course carrying their current rate. Named
-- neutrally because a fork has no way of knowing what is being taught.
insert into courses (student_id, name, rate_paise)
select id, 'Classes', rate_paise from students;

-- ---------------------------------------------------------------------------
-- Repoint schedules and sessions
-- ---------------------------------------------------------------------------

-- These name student_id on schedules and sessions, so they have to come down
-- before the column does. Rebuilt further below against course_id.
drop view student_balances;
drop policy "own schedules" on schedules;
drop policy "own sessions" on sessions;

alter table schedules add column course_id integer references courses (id) on delete cascade;
update schedules s set course_id = c.id from courses c where c.student_id = s.student_id;
alter table schedules alter column course_id set not null;

drop index schedules_student_idx;
alter table schedules drop column student_id;
create index schedules_course_idx on schedules (course_id, active_from);

alter table sessions add column course_id integer references courses (id) on delete cascade;
update sessions s set course_id = c.id from courses c where c.student_id = s.student_id;
alter table sessions alter column course_id set not null;

-- The old index said one scheduled class per student per day, which blocks
-- maths at 3pm and physics at 5pm on the same Tuesday. Keying on the schedule
-- is what was actually meant: one resolution per slot per date. It also allows
-- the same course twice in a day at different times.
drop index sessions_scheduled_once_idx;
drop index sessions_student_date_idx;
alter table sessions drop column student_id;

create unique index sessions_scheduled_once_idx
  on sessions (schedule_id, date)
  where schedule_id is not null;

create index sessions_course_date_idx on sessions (course_id, date desc);

-- The rate lives on the course now.
alter table students drop column rate_paise;

-- ---------------------------------------------------------------------------
-- Ownership
-- ---------------------------------------------------------------------------

create or replace function public.owns_course(p_course_id integer)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.courses c
    join public.students s on s.id = c.student_id
    where c.id = p_course_id and s.owner_id = auth.uid()
  );
$$;

create policy "own courses" on courses
  for all to authenticated
  using (is_allowed() and owns_student(student_id))
  with check (is_allowed() and owns_student(student_id));

create policy "own schedules" on schedules
  for all to authenticated
  using (is_allowed() and owns_course(course_id))
  with check (is_allowed() and owns_course(course_id));

create policy "own sessions" on sessions
  for all to authenticated
  using (is_allowed() and owns_course(course_id))
  with check (is_allowed() and owns_course(course_id));

-- ---------------------------------------------------------------------------
-- Derived figures
-- ---------------------------------------------------------------------------

create view course_earnings with (security_invoker = on) as
select c.id                                                             as course_id,
       c.student_id,
       c.name,
       c.rate_paise,
       coalesce(sum(s.rate_paise) filter (where s.status = 'confirmed'), 0)::int as earned_paise,
       coalesce(count(*) filter (where s.status = 'confirmed'), 0)::int          as confirmed_classes
from courses c
left join sessions s on s.course_id = c.id
group by c.id;

-- Still one balance per student. Two courses, one number owed.
create view student_balances with (security_invoker = on) as
select st.id                                                   as student_id,
       coalesce(e.earned_paise, 0)                              as earned_paise,
       coalesce(p.paid_paise, 0)                                as paid_paise,
       coalesce(e.earned_paise, 0) - coalesce(p.paid_paise, 0)  as owed_paise,
       coalesce(e.confirmed_classes, 0)                         as confirmed_classes
from students st
left join (
  select student_id,
         sum(earned_paise)::int      as earned_paise,
         sum(confirmed_classes)::int as confirmed_classes
  from course_earnings
  group by student_id
) e on e.student_id = st.id
left join (
  select student_id, sum(amount_paise)::int as paid_paise
  from payments
  group by student_id
) p on p.student_id = st.id;

grant select on course_earnings  to authenticated;
grant select on student_balances to authenticated;

-- ---------------------------------------------------------------------------
-- Transactional writes, rebuilt around courses
-- ---------------------------------------------------------------------------

drop function public.create_setup(text, integer, text, integer[], time, date);
drop function public.change_schedule(integer, integer[], time, date);
drop function public.resolve_class(integer, integer, date, session_status);
drop function public.resolve_many(integer, jsonb, session_status);

create or replace function public.create_setup(
  p_student_name text,
  p_course_name  text,
  p_rate_paise   integer,
  p_timezone     text,
  p_weekdays     integer[],
  p_start_time   time,
  p_from         date
)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_student_id integer;
  v_course_id  integer;
begin
  -- The dashboard only offers this form when you have no student, but a back
  -- button or a double submit walks past that. Two accounts have already ended
  -- up with a duplicate student this way, invisible in the UI and counted by
  -- the nudge. Adding a second student later gets its own function.
  if exists (
    select 1 from students where owner_id = auth.uid() and archived_at is null
  ) then
    raise exception 'you already have a student set up';
  end if;

  if coalesce(array_length(p_weekdays, 1), 0) = 0 then
    raise exception 'pick at least one day';
  end if;

  insert into students (name, timezone, owner_id)
  values (p_student_name, p_timezone, auth.uid())
  returning id into v_student_id;

  insert into courses (student_id, name, rate_paise)
  values (v_student_id, p_course_name, p_rate_paise)
  returning id into v_course_id;

  insert into schedules (course_id, weekday, start_time, active_from)
  select v_course_id, w, p_start_time, p_from
  from unnest(p_weekdays) as w;

  return v_student_id;
end;
$$;

create or replace function public.add_course(
  p_student_id integer,
  p_name       text,
  p_rate_paise integer,
  p_weekdays   integer[],
  p_start_time time,
  p_from       date
)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_course_id integer;
begin
  if not owns_student(p_student_id) then
    raise exception 'not your student';
  end if;

  if coalesce(array_length(p_weekdays, 1), 0) = 0 then
    raise exception 'pick at least one day';
  end if;

  insert into courses (student_id, name, rate_paise)
  values (p_student_id, p_name, p_rate_paise)
  returning id into v_course_id;

  insert into schedules (course_id, weekday, start_time, active_from)
  select v_course_id, w, p_start_time, p_from
  from unnest(p_weekdays) as w;

  return v_course_id;
end;
$$;

-- The rate changes going forward only. Past sessions keep the rate they were
-- confirmed at, which is the whole reason it is snapshotted onto the row.
create or replace function public.set_course_rate(
  p_course_id  integer,
  p_rate_paise integer
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if not owns_course(p_course_id) then
    raise exception 'not your course';
  end if;

  update courses set rate_paise = p_rate_paise where id = p_course_id;
end;
$$;

create or replace function public.change_schedule(
  p_course_id  integer,
  p_weekdays   integer[],
  p_start_time time,
  p_from       date
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if not owns_course(p_course_id) then
    raise exception 'not your course';
  end if;

  if coalesce(array_length(p_weekdays, 1), 0) = 0 then
    raise exception 'pick at least one day';
  end if;

  update schedules
     set active_until = p_from - 1
   where course_id = p_course_id
     and active_until is null
     and active_from < p_from;

  delete from schedules
   where course_id = p_course_id
     and active_until is null
     and active_from >= p_from;

  insert into schedules (course_id, weekday, start_time, active_from)
  select p_course_id, w, p_start_time, p_from
  from unnest(p_weekdays) as w;
end;
$$;

create or replace function public.resolve_class(
  p_course_id   integer,
  p_schedule_id integer,
  p_date        date,
  p_status      session_status
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if not owns_course(p_course_id) then
    raise exception 'not your course';
  end if;

  insert into sessions (course_id, schedule_id, date, status, rate_paise)
  select p_course_id,
         p_schedule_id,
         p_date,
         p_status,
         case when p_status = 'confirmed' then c.rate_paise end
    from courses c
   where c.id = p_course_id
  on conflict (schedule_id, date) where schedule_id is not null
  do nothing;
end;
$$;

-- Clearing a backlog that can now span several courses. Takes
-- [{ "courseId": n, "scheduleId": n, "date": "..." }, ...].
create or replace function public.resolve_many(
  p_rows   jsonb,
  p_status session_status
)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_inserted integer;
begin
  if exists (
    select 1 from jsonb_array_elements(p_rows) as r
    where not owns_course((r ->> 'courseId')::integer)
  ) then
    raise exception 'not your course';
  end if;

  insert into sessions (course_id, schedule_id, date, status, rate_paise)
  select (r ->> 'courseId')::integer,
         nullif(r ->> 'scheduleId', '')::integer,
         (r ->> 'date')::date,
         p_status,
         case when p_status = 'confirmed' then c.rate_paise end
    from jsonb_array_elements(p_rows) as r
    join courses c on c.id = (r ->> 'courseId')::integer
  on conflict (schedule_id, date) where schedule_id is not null
  do nothing;

  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$$;

create or replace function public.toggle_session(p_session_id integer)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  update sessions s
     set status = case
                    when s.status = 'confirmed' then 'cancelled'::session_status
                    else 'confirmed'::session_status
                  end,
         rate_paise = case
                        when s.status = 'confirmed' then null
                        else c.rate_paise
                      end
    from courses c
   where s.id = p_session_id
     and c.id = s.course_id;

  if not found then
    raise exception 'no such session';
  end if;
end;
$$;

grant execute on function public.owns_course(integer)                                          to authenticated;
grant execute on function public.create_setup(text, text, integer, text, integer[], time, date) to authenticated;
grant execute on function public.add_course(integer, text, integer, integer[], time, date)      to authenticated;
grant execute on function public.set_course_rate(integer, integer)                              to authenticated;
grant execute on function public.change_schedule(integer, integer[], time, date)                to authenticated;
grant execute on function public.resolve_class(integer, integer, date, session_status)          to authenticated;
grant execute on function public.resolve_many(jsonb, session_status)                            to authenticated;
grant execute on function public.toggle_session(integer)                                        to authenticated;
