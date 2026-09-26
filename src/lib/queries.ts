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

// Single student for now, so "the student" is the first active one.
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

export async function getCourses(studentId: number) {
  const supabase = await createClient();

  return unwrap(
    await supabase
      .from("courses")
      .select("*")
      .eq("student_id", studentId)
      .is("archived_at", null)
      .order("id"),
  );
}

export async function getPending(courseIds: number[], timeZone: string) {
  if (courseIds.length === 0) return [];

  const supabase = await createClient();
  const now = new Date();
  const { date: today } = localNow(now, timeZone);
  const windowStart = addDays(today, -LOOKBACK_DAYS);

  // All schedules, superseded ones included. A class from before a schedule
  // change still needs judging by the rule that applied at the time.
  const [rules, resolved] = await Promise.all([
    supabase.from("schedules").select("*").in("course_id", courseIds),
    supabase
      .from("sessions")
      .select("schedule_id, date")
      .in("course_id", courseIds)
      .gte("date", windowStart),
  ]);

  return derivePending({
    schedules: unwrap(rules).map((r) => ({
      id: r.id,
      courseId: r.course_id,
      weekday: r.weekday,
      startTime: r.start_time,
      activeFrom: r.active_from,
      activeUntil: r.active_until,
    })),
    resolved: unwrap(resolved).map((r) => ({
      scheduleId: r.schedule_id,
      date: r.date,
    })),
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

// One balance per student, broken down by what each course has earned.
export async function getCourseEarnings(studentId: number) {
  const supabase = await createClient();

  return unwrap(
    await supabase
      .from("course_earnings")
      .select("*")
      .eq("student_id", studentId)
      .order("course_id"),
  );
}

export async function getRecentSessions(courseIds: number[], limit = 30) {
  if (courseIds.length === 0) return [];
  const supabase = await createClient();

  return unwrap(
    await supabase
      .from("sessions")
      .select("*")
      .in("course_id", courseIds)
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

export async function getActiveSchedules(courseIds: number[]) {
  if (courseIds.length === 0) return [];
  const supabase = await createClient();

  return unwrap(
    await supabase
      .from("schedules")
      .select("*")
      .in("course_id", courseIds)
      .is("active_until", null)
      .order("weekday"),
  );
}

export async function getDashboard() {
  const student = await getActiveStudent();
  if (!student) return null;

  const courses = await getCourses(student.id);
  const courseIds = courses.map((c) => c.id);

  const [pending, balance, earnings, recent, paymentHistory, activeSchedules] =
    await Promise.all([
      getPending(courseIds, student.timezone),
      getBalance(student.id),
      getCourseEarnings(student.id),
      getRecentSessions(courseIds),
      getPayments(student.id),
      getActiveSchedules(courseIds),
    ]);

  return {
    student,
    courses,
    pending,
    balance,
    earnings,
    recent,
    paymentHistory,
    activeSchedules,
  };
}
