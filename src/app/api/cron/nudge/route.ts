import { NextResponse } from "next/server";
import webpush from "web-push";

import { formatClassDate } from "@/lib/format";
import { addDays, derivePending, localNow } from "@/lib/occurrences";
import { createAdminClient } from "@/lib/supabase/admin";

// web-push is a Node library.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LOOKBACK_DAYS = 90;

// The browser has thrown the subscription away.
const DEAD_SUBSCRIPTION = [404, 410];

export async function GET(request: Request) {
  // Outside the middleware gate, so it checks the shared secret itself.
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  const { data: students, error: studentsError } = await supabase
    .from("students")
    .select("*")
    .is("archived_at", null);

  if (studentsError) {
    return NextResponse.json({ error: studentsError.message }, { status: 500 });
  }

  const now = new Date();
  let pendingTotal = 0;
  let mostRecent: { date: string; scheduleId: number } | null = null;

  for (const student of students ?? []) {
    const { date: today } = localNow(now, student.timezone);
    const windowStart = addDays(today, -LOOKBACK_DAYS);

    const [{ data: rules }, { data: resolved }] = await Promise.all([
      supabase.from("schedules").select("*").eq("student_id", student.id),
      supabase
        .from("sessions")
        .select("date")
        .eq("student_id", student.id)
        .gte("date", windowStart),
    ]);

    const pending = derivePending({
      schedules: (rules ?? []).map((r) => ({
        id: r.id,
        studentId: r.student_id,
        weekday: r.weekday,
        startTime: r.start_time,
        activeFrom: r.active_from,
        activeUntil: r.active_until,
      })),
      resolvedDates: (resolved ?? []).map((r) => r.date),
      now,
      timeZone: student.timezone,
      lookbackDays: LOOKBACK_DAYS,
    });

    pendingTotal += pending.length;
    if (!mostRecent && pending[0]) {
      mostRecent = { date: pending[0].date, scheduleId: pending[0].scheduleId };
    }
  }

  // Never send "nothing to confirm". That is how the app gets muted.
  if (pendingTotal === 0) {
    return NextResponse.json({ pending: 0, sent: 0 });
  }

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) {
    return NextResponse.json({ error: "VAPID keys not set" }, { status: 500 });
  }

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? "mailto:nobody@example.com",
    publicKey,
    privateKey,
  );

  const { data: subscriptions } = await supabase
    .from("push_subscriptions")
    .select("*");

  const payload = JSON.stringify({
    title: pendingTotal === 1 ? "One class to confirm" : `${pendingTotal} classes to confirm`,
    body: mostRecent
      ? `Did ${formatClassDate(mostRecent.date)} happen?`
      : "Open to confirm.",
    pending: pendingTotal,
    date: mostRecent?.date,
    scheduleId: mostRecent?.scheduleId,
  });

  const results = await Promise.allSettled(
    (subscriptions ?? []).map((sub) =>
      webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        payload,
      ),
    ),
  );

  // Prune dead endpoints so they stop failing every day.
  const stale = (subscriptions ?? [])
    .filter((_, i) => {
      const result = results[i];
      return (
        result.status === "rejected" &&
        DEAD_SUBSCRIPTION.includes(result.reason?.statusCode)
      );
    })
    .map((sub) => sub.endpoint);

  if (stale.length) {
    await supabase.from("push_subscriptions").delete().in("endpoint", stale);
  }

  return NextResponse.json({
    pending: pendingTotal,
    sent: results.filter((r) => r.status === "fulfilled").length,
    pruned: stale.length,
  });
}
