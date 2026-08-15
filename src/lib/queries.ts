import "server-only";

import type { PostgrestError } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";

import { addDays, derivePending, localNow } from "./occurrences";

const LOOKBACK_DAYS = 90;

// These index into the result type rather than being generic in the row type.
// A supabase result is a union of { data, error: null } and { data: null, error },
// and inferring a row type across both arms collapses it to never.
type SupabaseResult = { data: unknown; error: PostgrestError | null };

export function unwrap<R extends SupabaseResult>(
  result: R,
): NonNullable<R["data"]> {
  if (result.error) throw new Error(result.error.message);
  if (result.data == null) throw new Error("Expected a row, got none");
  return result.data as NonNullable<R["data"]>;
}

// For maybeSingle(), where no row is a valid answer.
export function unwrapMaybe<R extends SupabaseResult>(result: R): R["data"] {
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

// RLS already makes an unlisted account harmless. This just lets the UI say so.
export async function isAllowed() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("is_allowed");
  return !error && data === true;
}

// Single tutor for now, so "the student" is the first active one.
export async function getActiveStudent() {
  const supabase = await createClient();

  return unwrapMaybe(
    await supabase
      .from("students")
      .select("*")
      .is("archived_at", null)
      .order("id")
      .limit(1)
      .maybeSingle(),
  );
}

export async function getPending(studentId: number, timeZone: string) {
  const supabase = await createClient();
  const now = new Date();
  const { date: today } = localNow(now, timeZone);
  const windowStart = addDays(today, -LOOKBACK_DAYS);

  // All schedules, superseded ones included. A class from before a schedule
  // change still needs judging by the rule that applied at the time.
  const [rules, resolved] = await Promise.all([
    supabase.from("schedules").select("*").eq("student_id", studentId),
    supabase
      .from("sessions")
      .select("date")
      .eq("student_id", studentId)
      .gte("date", windowStart),
  ]);

  return derivePending({
    schedules: unwrap(rules).map((r) => ({
      id: r.id,
      studentId: r.student_id,
      weekday: r.weekday,
      startTime: r.start_time,
      activeFrom: r.active_from,
      activeUntil: r.active_until,
    })),
    resolvedDates: unwrap(resolved).map((r) => r.date),
    now,
    timeZone,
    lookbackDays: LOOKBACK_DAYS,
  });
}

export async function getBalance(studentId: number) {
  const supabase = await createClient();

  const row = unwrapMaybe(
    await supabase
      .from("student_balances")
      .select("*")
      .eq("student_id", studentId)
      .maybeSingle(),
  );

  return (
    row ?? {
      student_id: studentId,
      earned_paise: 0,
      paid_paise: 0,
      owed_paise: 0,
      confirmed_classes: 0,
    }
  );
}

export async function getRecentSessions(studentId: number, limit = 30) {
  const supabase = await createClient();

  return unwrap(
    await supabase
      .from("sessions")
      .select("*")
      .eq("student_id", studentId)
      .order("date", { ascending: false })
      .order("id", { ascending: false })
      .limit(limit),
  );
}

export async function getPayments(studentId: number, limit = 20) {
  const supabase = await createClient();

  return unwrap(
    await supabase
      .from("payments")
      .select("*")
      .eq("student_id", studentId)
      .order("date", { ascending: false })
      .order("id", { ascending: false })
      .limit(limit),
  );
}

export async function getActiveSchedules(studentId: number) {
  const supabase = await createClient();

  return unwrap(
    await supabase
      .from("schedules")
      .select("*")
      .eq("student_id", studentId)
      .is("active_until", null)
      .order("weekday"),
  );
}

export async function getDashboard() {
  const student = await getActiveStudent();
  if (!student) return null;

  const [pending, balance, recent, paymentHistory, activeSchedules] =
    await Promise.all([
      getPending(student.id, student.timezone),
      getBalance(student.id),
      getRecentSessions(student.id),
      getPayments(student.id),
      getActiveSchedules(student.id),
    ]);

  return { student, pending, balance, recent, paymentHistory, activeSchedules };
}
