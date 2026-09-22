
alter table students
  add column owner_id uuid references auth.users (id) on delete cascade;

alter table push_subscriptions
  add column owner_id uuid references auth.users (id) on delete cascade;

-- Existing rows belong to the first account that ever signed in. Resolved at
-- run time rather than hardcoded, so a fork works the same way.
do $$
declare
  v_owner uuid;
begin
  select id into v_owner from auth.users order by created_at limit 1;

  if v_owner is null
     and (exists (select 1 from students)
          or exists (select 1 from push_subscriptions)) then
    raise exception 'there is data to migrate but no auth user to own it';
  end if;

  update students           set owner_id = v_owner where owner_id is null;
  update push_subscriptions set owner_id = v_owner where owner_id is null;
end
$$;

alter table students           alter column owner_id set not null;
alter table push_subscriptions alter column owner_id set not null;

create index students_owner_idx           on students (owner_id);
create index push_subscriptions_owner_idx on push_subscriptions (owner_id);

-- Ownership lives on students only, and the child tables reach it through
-- student_id. Denormalising an owner onto every table would be faster to check
-- but gives ownership two sources of truth that can drift apart.
create or replace function public.owns_student(p_student_id integer)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.students
    where id = p_student_id and owner_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------------
-- Policies
-- ---------------------------------------------------------------------------

drop policy "allowed users" on students;
drop policy "allowed users" on schedules;
drop policy "allowed users" on sessions;
drop policy "allowed users" on payments;
drop policy "allowed users" on push_subscriptions;

create policy "own students" on students
  for all to authenticated
  using (is_allowed() and owner_id = auth.uid())
  with check (is_allowed() and owner_id = auth.uid());

create policy "own schedules" on schedules
  for all to authenticated
  using (is_allowed() and owns_student(student_id))
  with check (is_allowed() and owns_student(student_id));

create policy "own sessions" on sessions
  for all to authenticated
  using (is_allowed() and owns_student(student_id))
  with check (is_allowed() and owns_student(student_id));

create policy "own payments" on payments
  for all to authenticated
  using (is_allowed() and owns_student(student_id))
  with check (is_allowed() and owns_student(student_id));

create policy "own push subscriptions" on push_subscriptions
  for all to authenticated
  using (is_allowed() and owner_id = auth.uid())
  with check (is_allowed() and owner_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Writes that touch more than one row
--
-- supabase-js speaks PostgREST, where every call is its own statement, so a
-- multi-step write from the app can fail halfway and leave the data wrong.
-- These run as one transaction each. They are security invoker, so the
-- policies above still apply inside them; the explicit ownership checks are
-- there to fail loudly rather than silently affecting zero rows.
-- ---------------------------------------------------------------------------

create or replace function public.create_setup(
  p_name       text,
  p_rate_paise integer,
  p_timezone   text,
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
  v_student_id integer;
begin
  if coalesce(array_length(p_weekdays, 1), 0) = 0 then
    raise exception 'pick at least one day';
  end if;

  insert into students (name, rate_paise, timezone, owner_id)
  values (p_name, p_rate_paise, p_timezone, auth.uid())
  returning id into v_student_id;

  insert into schedules (student_id, weekday, start_time, active_from)
  select v_student_id, w, p_start_time, p_from
  from unnest(p_weekdays) as w;

  return v_student_id;
end;
$$;

create or replace function public.change_schedule(
  p_student_id integer,
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
  if not owns_student(p_student_id) then
    raise exception 'not your student';
  end if;

  if coalesce(array_length(p_weekdays, 1), 0) = 0 then
    raise exception 'pick at least one day';
  end if;

  -- Rules that already governed a date get closed the day before the new ones
  -- start.
  update schedules
     set active_until = p_from - 1
   where student_id = p_student_id
     and active_until is null
     and active_from < p_from;

  -- Rules that never governed anything, from changing twice in one day, are
  -- deleted instead. Closing them would put active_until before active_from,
  -- which the table rejects.
  delete from schedules
   where student_id = p_student_id
     and active_until is null
     and active_from >= p_from;

  insert into schedules (student_id, weekday, start_time, active_from)
  select p_student_id, w, p_start_time, p_from
  from unnest(p_weekdays) as w;
end;
$$;

-- The rate is read and written in the same statement, so it cannot change
-- between the app reading it and the row being inserted.
create or replace function public.resolve_class(
  p_student_id  integer,
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
  if not owns_student(p_student_id) then
    raise exception 'not your student';
  end if;

  insert into sessions (student_id, schedule_id, date, status, rate_paise)
  select p_student_id,
         p_schedule_id,
         p_date,
         p_status,
         case when p_status = 'confirmed' then s.rate_paise end
    from students s
   where s.id = p_student_id
  on conflict (student_id, date) where schedule_id is not null
  do nothing;
end;
$$;

-- Clearing a backlog. Takes [{ "date": "...", "scheduleId": n }, ...] so the
-- whole batch lands or none of it does.
create or replace function public.resolve_many(
  p_student_id integer,
  p_rows       jsonb,
  p_status     session_status
)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_inserted integer;
begin
  if not owns_student(p_student_id) then
    raise exception 'not your student';
  end if;

  insert into sessions (student_id, schedule_id, date, status, rate_paise)
  select p_student_id,
         nullif(r ->> 'scheduleId', '')::integer,
         (r ->> 'date')::date,
         p_status,
         case when p_status = 'confirmed' then s.rate_paise end
    from jsonb_array_elements(p_rows) as r
    cross join students s
   where s.id = p_student_id
  on conflict (student_id, date) where schedule_id is not null
  do nothing;

  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$$;

-- One statement, so two tabs cannot read the same status and both flip it.
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
                        else st.rate_paise
                      end
    from students st
   where s.id = p_session_id
     and st.id = s.student_id;

  if not found then
    raise exception 'no such session';
  end if;
end;
$$;

grant execute on function public.owns_student(integer)                                    to authenticated;
grant execute on function public.create_setup(text, integer, text, integer[], time, date) to authenticated;
grant execute on function public.change_schedule(integer, integer[], time, date)          to authenticated;
grant execute on function public.resolve_class(integer, integer, date, session_status)    to authenticated;
grant execute on function public.resolve_many(integer, jsonb, session_status)             to authenticated;
grant execute on function public.toggle_session(integer)                                  to authenticated;
