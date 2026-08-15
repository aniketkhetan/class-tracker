# class-tracker

A class tracker for tutors who are bad at writing things down.

I tutor three times a week. The schedule moves around constantly and I was
never any good at noting down which classes actually happened, so working out
what I was owed at the end of a month meant reconstructing the whole thing from
memory.

At the time I also wanted to play around with building a PWA that could work on both my phone and laptop, so I started this project as something to play around with in my free time.

I built a local version of this earlier in 2026 and have been using it for some time. This is a rebuild, and its an expansion of what the original did. It sits on my phone, nudges me after each class and keeps a running total
of what I'm owed.

There are better apps for this. I wrote my own because as I said earlier it was an excuse to build a PWA properly, service workers, push notifications, VAPID keys and all. The problem turned out to suit that unusually well.


Still adding to it.




## How it works

You set a weekly schedule once. Say Tuesday, Thursday and Saturday at 3pm. Once
a class has started it turns up in a queue asking whether it happened. One tap
logs it. Notes are optional and you can add them later, or not at all.

Confirmed classes add to a balance. Recording a payment brings it back down.
Anything outside the usual schedule gets added by hand.

At 4pm a cron job sends one notification, but only if something is actually
waiting. On Android and desktop you can answer straight from the notification
without opening the app.

## Design notes

The bits worth explaining.

**The balance isn't stored anywhere.** The obvious approach is an `amount_owed`
column you zero out when you get paid. That loses the answer to "when did they
last pay", "how much" and "what did June actually earn", and it leaves you with
a number that can quietly stop matching the rows it's meant to summarise. So
payments are just events, and the balance is a view over them:
`sum(confirmed sessions) - sum(payments)`. Nothing to reset. Nothing to
corrupt.

**Nothing writes future classes to the database.** A row only appears once
you've said a class happened or didn't. Anything the schedule implies but has no
row is pending, worked out when the page loads. No cron job generating rows, and
changing your schedule needs no cleanup at all, because the classes you haven't
touched yet were never rows to begin with.

**The rate gets copied onto the session when you confirm it.** Not looked up
live. Otherwise the day you put your rate up, every class you've ever taught
becomes worth more, including ones you were already paid for. One column now
versus an unfixable mess later.

**Schedules get versioned rather than edited.** Moving Tuesday to Wednesday
closes off the old row with an `active_until` date and adds a new one. Classes
from before the change still work off the rule that was actually in force then,
so changing your schedule doesn't rewrite your history.

**Times are compared as plain local strings.** The question the app asks is "has
3pm on the 13th gone past, here", which is about local dates and clock times
rather than instants. Comparing `"2026-08-13"` and `"15:00:00"` as strings
answers it exactly and skips a whole family of UTC offset bugs, the sort where a
late class lands on the wrong day. Only one function, `localNow`, touches a real
timezone.

**Nothing is ever confirmed automatically.** An unconfirmed class stays
unconfirmed. It never turns into money on its own. If you've been away, you
clear the backlog with select-all instead. A tool built for someone forgetful
really should not be inventing income when they forget.

**Confirming twice does nothing the second time.** There's a partial unique
index on `(student_id, date) where schedule_id is not null`, so a double tap, or
the dashboard and a notification racing each other, can't produce two rows.
Ad-hoc classes sit outside that constraint, so two extra classes on one day are
still fine.

## Stack

Next.js App Router, TypeScript, Supabase for Postgres and auth, Tailwind, hosted
on Vercel. Row Level Security on every table, checked against an allowlist. If
you sign in with an account that isn't on it, you get in and then find an empty
database.

Confirming a class is a plain form post, so it works with JavaScript off. The
only client components are the notes box and the reminders toggle.

## Running your own

```bash
git clone https://github.com/aniketkhetan/class-tracker
cd class-tracker
npm install
cp .env.example .env.local
```

1. Make a [Supabase](https://supabase.com) project and run
   `supabase/migrations/20260813000000_init.sql` in the SQL editor.
2. Add yourself to the allowlist:
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

`npm test` runs the derivation tests. That's where the timezone and schedule
versioning edge cases are pinned down, and it's the file I'd read first.

## Deploying

Push to Vercel, set the same env vars, add your deployed URL to Supabase's
redirect allowlist. `vercel.json` sets up the daily cron. Give `CRON_SECRET` a
real value, because that endpoint sits outside the auth middleware on purpose
and the shared secret is the only thing guarding it.

On iPhone, add the site to your Home Screen before turning on reminders. iOS
only delivers web push to installed PWAs, never to a Safari tab.
