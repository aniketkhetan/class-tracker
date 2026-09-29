# class-tracker

A PWA for tutors who are bad at writing things down. Set a weekly schedule, get
nudged after each class, confirm it in one tap and keep a running total of what
you're owed. In daily use by me and another tutor at the centre where I teach.

Built for my own tutoring, and because I wanted a proper reason to build a PWA
with push notifications. Plenty of better apps exist. This one solves my
specific bad habit.

**There's no public demo.** It's deployed and running, but it holds real income
records, so sign-in is gated to an allowlist of emails I approve. Signing in
with anything else succeeds and then shows you an empty database. Running your
own takes about ten minutes, see below.

<!-- TODO: screenshots. Dashboard with a pending queue, plus the notification. -->

## Features

- Weekly schedule per course, with the queue only showing classes that have
  actually started
- One tap to confirm or skip, with optional notes per class
- Multiple courses per student, each with its own schedule and rate, feeding one
  balance
- Running balance with a per-course breakdown, payments recorded as events
- Daily push notification at 4pm, only when something is waiting
- Confirm straight from the notification on Android and desktop, without opening
  the app
- Extra classes outside the usual schedule
- Installable on iOS and Android as a home screen app

## Stack

Next.js App Router, TypeScript, Tailwind, Supabase for Postgres and auth, Vercel
for hosting and cron. Row Level Security on every table, keyed to the signed-in
user.

Confirming a class is a plain form post, so it works with JavaScript off. The
only client components are the notes box and the reminders toggle.

## How it works

You set a weekly schedule per course. Once a class has started it turns up in a
queue asking whether it happened. Confirmed classes add to the balance at that
course's rate, and recording a payment brings it back down.

At 4pm a Vercel cron job works out what's still unconfirmed for each person and
sends one notification, but only if something is actually waiting.

## Design notes

The decisions that were not obvious.

**The balance isn't stored.** Payments are append-only events and the balance is
a view over them: `sum(confirmed sessions) - sum(payments)`. An `amount_owed`
column you zero out loses the answer to "when did they last pay" and leaves a
number that can drift from the rows it summarises.

**Nothing writes future classes to the database.** A row only appears once you
say a class happened or didn't. Anything the schedule implies but has no row is
pending, worked out on read. No cron generating rows, and changing your schedule
needs no cleanup, because untouched classes were never rows.

**The rate is copied onto the session when you confirm it.** Not looked up live.
Otherwise raising your rate would make every class you have ever taught worth
more, including ones already paid for.

**Schedules are versioned, not edited.** Changing a day closes the old rule with
an `active_until` date and adds a new one, so changing your schedule doesn't
rewrite your history.

**Times are compared as local wall-clock strings.** "Has 3pm on the 13th gone
past here" is a question about local dates and clock times, not instants.
Comparing `"2026-08-13"` and `"15:00:00"` as strings answers it exactly and
skips a family of UTC offset bugs. One function, `localNow`, touches a real
timezone.

**Nothing is ever confirmed automatically.** An unconfirmed class stays
unconfirmed. A tool built for someone forgetful should not invent income when
they forget.

**Multi-step writes are Postgres functions, not app code.** supabase-js speaks
PostgREST, where every call is its own statement, so a multi-step write can fail
halfway. Changing a schedule closes old rules, deletes ones that never applied
and inserts new ones. That runs as one transaction or not at all.

## Recent changes

**Courses** (September 2026). A student can be taught more than one thing, each with
its own schedule and rate, all feeding one balance. Shook out two latent bugs:
the unique index assumed one class per student per day, and pending classes were
keyed by date alone, so confirming Tuesday's maths would have hidden Tuesday's
physics.

**Multi-tenant** (September 2026). A colleague at the centre wanted to use it,
which meant it could no longer assume one person. Ownership moved onto the data
and the policies were rewritten around it, so tutors sharing a deployment see
only their own students. The nudge sends each person their own count to their
own devices.

**Schedule changes** (September 2026). The weekly schedule is editable from the app
rather than by hand in SQL.

**First working version** (August 2026). Schema, the confirm loop, balance and
payments, GitHub auth and the PWA with its daily nudge.

## Running your own

```bash
git clone https://github.com/aniketkhetan/class-tracker
cd class-tracker
npm install
cp .env.example .env.local
```

1. Make a [Supabase](https://supabase.com) project and run everything in
   `supabase/migrations/` in filename order, in the SQL editor.
2. Add yourself to the allowlist. Without this you can sign in and will then see
   an empty database.
   ```sql
   insert into app_access (email) values ('you@example.com');
   ```
3. Make a [GitHub OAuth app](https://github.com/settings/developers). Its
   callback URL is Supabase's, `https://<project-ref>.supabase.co/auth/v1/callback`,
   not your app's. This catches everyone out once. Put the client ID and secret
   into Supabase under Authentication, Providers, GitHub.
4. Under Authentication, URL Configuration, allow
   `http://localhost:3000/auth/callback`.
5. Fill in `.env.local` from Supabase's API settings. Push keys come from
   `npx web-push generate-vapid-keys`.

```bash
npm run dev
```

`npm test` runs the derivation tests, where the timezone and schedule
versioning edge cases are pinned down.

## Deploying

Push to Vercel, set the same env vars and add your deployed URL to Supabase's
redirect allowlist. `vercel.json` registers the daily cron. Give `CRON_SECRET` a
real value, because that endpoint sits outside the auth middleware on purpose.

Run migrations before deploying. The app calls Postgres functions that a stale
schema won't have.

On iPhone, add the site to your Home Screen before turning on reminders. iOS
only delivers web push to installed PWAs, never to a Safari tab.
