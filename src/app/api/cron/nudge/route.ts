import { NextResponse } from "next/server";
import webpush from "web-push";

import type { PushSubscriptionRow, StudentRow } from "@/lib/database.types";
import { formatClassDate } from "@/lib/format";
import { addDays, derivePending, localNow } from "@/lib/occurrences";
import { createAdminClient } from "@/lib/supabase/admin";

// web-push is a Node library.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LOOKBACK_DAYS = 90;

// The browser has thrown the subscription away.
const DEAD_SUBSCRIPTION = [404, 410];

function groupByOwner<T extends { owner_id: string }>(rows: T[]) {
  const grouped = new Map<string, T[]>();
  for (const row of rows) {
    const existing = grouped.get(row.owner_id);
    if (existing) existing.push(row);
    else grouped.set(row.owner_id, [row]);
  }
  return grouped;
}

export async function GET(request: Request) {
  // Outside the middleware gate, so it checks the shared secret itself.
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) {
    return NextResponse.json({ error: "VAPID keys not set" }, { status: 500 });
  }

  // Runs with the secret key, so RLS does not apply here. Everything below
  // keeps tenants apart by grouping on owner_id explicitly: one person's count
  // must never reach another person's phone.
  const supabase = createAdminClient();

  const [{ data: students, error: studentsError }, { data: subscriptions }] =
    await Promise.all([
      supabase.from("students").select("*").is("archived_at", null),
      supabase.from("push_subscriptions").select("*"),
    ]);

  if (studentsError) {
    return NextResponse.json({ error: studentsError.message }, { status: 500 });
  }

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? "mailto:nobody@example.com",
    publicKey,
    privateKey,
  );

  const now = new Date();
  const devicesByOwner = groupByOwner<PushSubscriptionRow>(subscriptions ?? []);
  const sends: Promise<unknown>[] = [];
  const targets: PushSubscriptionRow[] = [];
  let pendingOverall = 0;

  for (const [ownerId, owned] of groupByOwner<StudentRow>(students ?? [])) {
    let pendingForOwner = 0;
    let mostRecent: { date: string; scheduleId: number } | null = null;

    for (const student of owned) {
      const { date: today } = localNow(now, student.timezone);

      const [{ data: rules }, { data: resolved }] = await Promise.all([
        supabase.from("schedules").select("*").eq("student_id", student.id),
        supabase
          .from("sessions")
          .select("date")
          .eq("student_id", student.id)
          .gte("date", addDays(today, -LOOKBACK_DAYS)),
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

      pendingForOwner += pending.length;
      // derivePending returns most recent first.
      if (!mostRecent && pending[0]) {
        mostRecent = { date: pending[0].date, scheduleId: pending[0].scheduleId };
      }
    }

    pendingOverall += pendingForOwner;

    // Never send "nothing to confirm". That is how the app gets muted.
    if (pendingForOwner === 0) continue;

    const devices = devicesByOwner.get(ownerId) ?? [];
    const payload = JSON.stringify({
      title:
        pendingForOwner === 1
          ? "One class to confirm"
          : `${pendingForOwner} classes to confirm`,
      body: mostRecent
        ? `Did ${formatClassDate(mostRecent.date)} happen?`
        : "Open to confirm.",
      pending: pendingForOwner,
      date: mostRecent?.date,
      scheduleId: mostRecent?.scheduleId,
    });

    for (const device of devices) {
      targets.push(device);
      sends.push(
        webpush.sendNotification(
          {
            endpoint: device.endpoint,
            keys: { p256dh: device.p256dh, auth: device.auth },
          },
          payload,
        ),
      );
    }
  }

  const results = await Promise.allSettled(sends);

  // Prune dead endpoints so they stop failing every day.
  const stale = targets
    .filter((_, i) => {
      const result = results[i];
      return (
        result.status === "rejected" &&
        DEAD_SUBSCRIPTION.includes(result.reason?.statusCode)
      );
    })
    .map((device) => device.endpoint);

  if (stale.length) {
    await supabase.from("push_subscriptions").delete().in("endpoint", stale);
  }

  return NextResponse.json({
    pending: pendingOverall,
    sent: results.filter((r) => r.status === "fulfilled").length,
    pruned: stale.length,
  });
}
