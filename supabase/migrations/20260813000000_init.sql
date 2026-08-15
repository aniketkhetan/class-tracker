-- Money is integer paise throughout.

create type session_status as enum ('confirmed', 'cancelled');

-- Sign in with GitHub means anyone with a GitHub account can sign in, so every
-- policy below checks this table. RLS on with no policies, so it's only
-- reachable from the SQL editor.
create table app_access (
  email text primary key,
  note  text
);

alter table app_access enable row level security;

create or replace function public.is_allowed()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.app_access
    where email = auth.jwt() ->> 'email'
  );
$$;

create table students (
  id          serial primary key,
  name        text not null,
  rate_paise  integer not null,
  timezone    text not null default 'Asia/Kolkata',
  archived_at timestamptz,
  created_at  timestamptz not null default now()
);

-- Versioned, not edited. Changing a day closes the current row with
-- active_until and inserts a new one, so past classes still derive from the
-- rule that was in force then.
create table schedules (
  id           serial primary key,
  student_id   integer not null references students (id) on delete cascade,
  weekday      integer not null check (weekday between 0 and 6), -- 0 = Sunday
  start_time   time not null,
  active_from  date not null,
  active_until date, -- null means currently in force
  created_at   timestamptz not null default now(),
  check (active_until is null or active_until >= active_from)
);

create index schedules_student_idx on schedules (student_id, active_from);

-- Only resolved classes get a row. Anything the schedule implies but has no
-- row here is pending, worked out on read.
create table sessions (
  id          serial primary key,
  student_id  integer not null references students (id) on delete cascade,
  schedule_id integer references schedules (id) on delete set null, -- null = ad-hoc
  date        date not null, -- local calendar date, deliberately not timestamptz
  status      session_status not null,
  -- Copied from the student on confirm. A live lookup would rewrite the value
  -- of every past class the day the rate changes.
  rate_paise  integer,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check (status <> 'confirmed' or rate_paise is not null),
  check (status <> 'cancelled' or rate_paise is null)
);

-- A scheduled class resolves once, so a double tap or a dashboard/notification
-- race can't make two rows. Ad-hoc classes are excluded, so two extras on the
-- same day are still fine.
create unique index sessions_scheduled_once_idx
  on sessions (student_id, date)
  where schedule_id is not null;

create index sessions_student_date_idx on sessions (student_id, date desc);

-- Events, not a counter that gets reset.
create table payments (
  id           serial primary key,
  student_id   integer not null references students (id) on delete cascade,
  date         date not null,
  amount_paise integer not null check (amount_paise > 0),
  note         text,
  created_at   timestamptz not null default now()
);

create index payments_student_date_idx on payments (student_id, date desc);

create table push_subscriptions (
  id         serial primary key,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now()
);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger sessions_touch_updated_at
  before update on sessions
  for each row execute function public.touch_updated_at();

-- Balance is derived, never stored. security_invoker so the view respects the
-- caller's RLS rather than the owner's.
create view student_balances with (security_invoker = on) as
select
  s.id                                                    as student_id,
  coalesce(e.earned_paise, 0)                             as earned_paise,
  coalesce(p.paid_paise, 0)                               as paid_paise,
  coalesce(e.earned_paise, 0) - coalesce(p.paid_paise, 0) as owed_paise,
  coalesce(e.confirmed_classes, 0)                        as confirmed_classes
from students s
left join (
  select student_id,
         sum(rate_paise)::int as earned_paise,
         count(*)::int        as confirmed_classes
  from sessions
  where status = 'confirmed'
  group by student_id
) e on e.student_id = s.id
left join (
  select student_id, sum(amount_paise)::int as paid_paise
  from payments
  group by student_id
) p on p.student_id = s.id;

-- An account that isn't in app_access signs in fine and then sees nothing.
alter table students           enable row level security;
alter table schedules          enable row level security;
alter table sessions           enable row level security;
alter table payments           enable row level security;
alter table push_subscriptions enable row level security;

create policy "allowed users" on students
  for all to authenticated using (is_allowed()) with check (is_allowed());

create policy "allowed users" on schedules
  for all to authenticated using (is_allowed()) with check (is_allowed());

create policy "allowed users" on sessions
  for all to authenticated using (is_allowed()) with check (is_allowed());

create policy "allowed users" on payments
  for all to authenticated using (is_allowed()) with check (is_allowed());

create policy "allowed users" on push_subscriptions
  for all to authenticated using (is_allowed()) with check (is_allowed());

grant select on student_balances to authenticated;
grant execute on function public.is_allowed() to authenticated;
