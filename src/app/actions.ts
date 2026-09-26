"use server";

import { revalidatePath } from "next/cache";

import type { SessionStatus } from "@/lib/database.types";
import { parseRupeesToPaise } from "@/lib/money";
import { localNow, normalizeTime } from "@/lib/occurrences";
import { getActiveStudent, unwrap } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";

async function requireStudent() {
  const student = await getActiveStudent();
  if (!student) throw new Error("No student set up yet");
  return student;
}

// An RPC returns { data, error } like anything else, but a raise inside the
// function surfaces as an error rather than a partial write.
function check(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

async function resolve(formData: FormData, status: SessionStatus) {
  const scheduleIdRaw = formData.get("scheduleId");
  const supabase = await createClient();

  const { error } = await supabase.rpc("resolve_class", {
    p_course_id: Number(formData.get("courseId")),
    p_schedule_id: scheduleIdRaw ? Number(scheduleIdRaw) : null,
    p_date: String(formData.get("date")),
    p_status: status,
  });

  check(error);
  revalidatePath("/");
}

export async function confirmClass(formData: FormData) {
  await resolve(formData, "confirmed");
}

export async function cancelClass(formData: FormData) {
  await resolve(formData, "cancelled");
}

// Clears a whole backlog in one transaction, so it all lands or none of it does.
export async function confirmAll(formData: FormData) {
  const rows = JSON.parse(String(formData.get("occurrences") ?? "[]")) as {
    courseId: number;
    scheduleId: number | null;
    date: string;
  }[];
  if (rows.length === 0) return;

  const supabase = await createClient();

  const { error } = await supabase.rpc("resolve_many", {
    p_rows: rows,
    p_status: "confirmed",
  });

  check(error);
  revalidatePath("/");
}

// Saved separately from the confirmation, which has already happened by now.
export async function saveNotes(formData: FormData) {
  const notes = String(formData.get("notes") ?? "").trim();
  const supabase = await createClient();

  unwrap(
    await supabase
      .from("sessions")
      .update({ notes: notes || null })
      .eq("id", Number(formData.get("sessionId")))
      .select("id"),
  );

  revalidatePath("/");
}

// Unscheduled class: a session with no schedule behind it.
export async function addAdHocClass(formData: FormData) {
  const student = await requireStudent();
  const supabase = await createClient();

  const { error } = await supabase.rpc("resolve_class", {
    p_course_id: Number(formData.get("courseId")),
    p_schedule_id: null,
    p_date:
      String(formData.get("date") ?? "") ||
      localNow(new Date(), student.timezone).date,
    p_status: "confirmed",
  });

  check(error);
  revalidatePath("/");
}

// For fixing a misclick. One statement, so two tabs cannot both flip it.
export async function toggleSessionStatus(formData: FormData) {
  const supabase = await createClient();

  const { error } = await supabase.rpc("toggle_session", {
    p_session_id: Number(formData.get("sessionId")),
  });

  check(error);
  revalidatePath("/");
}

// Puts the date back in the pending queue.
export async function deleteSession(formData: FormData) {
  const supabase = await createClient();

  unwrap(
    await supabase
      .from("sessions")
      .delete()
      .eq("id", Number(formData.get("sessionId")))
      .select("id"),
  );

  revalidatePath("/");
}

export async function recordPayment(formData: FormData) {
  const student = await requireStudent();
  const supabase = await createClient();
  const amountPaise = parseRupeesToPaise(String(formData.get("rupees") ?? ""));
  if (amountPaise === null || amountPaise <= 0) {
    throw new Error("Payment amount must be a positive number");
  }

  const note = String(formData.get("note") ?? "").trim();

  unwrap(
    await supabase
      .from("payments")
      .insert({
        student_id: student.id,
        date:
          String(formData.get("date") ?? "") ||
          localNow(new Date(), student.timezone).date,
        amount_paise: amountPaise,
        note: note || null,
      })
      .select("id"),
  );

  revalidatePath("/");
}

export async function deletePayment(formData: FormData) {
  const supabase = await createClient();

  unwrap(
    await supabase
      .from("payments")
      .delete()
      .eq("id", Number(formData.get("paymentId")))
      .select("id"),
  );

  revalidatePath("/");
}

function readWeekdays(formData: FormData): number[] {
  const weekdays = [...new Set(formData.getAll("weekdays").map(Number))].sort(
    (a, b) => a - b,
  );
  if (weekdays.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) {
    throw new Error("Bad weekday");
  }
  if (weekdays.length === 0) throw new Error("Pick at least one day");
  return weekdays;
}

// First run: student, rate, weekly slots. One transaction, so a failure part
// way through cannot leave a student with no schedule.
export async function createSetup(formData: FormData) {
  const supabase = await createClient();
  const name = String(formData.get("name") ?? "").trim();
  const ratePaise = parseRupeesToPaise(String(formData.get("rupees") ?? ""));
  const timezone = String(formData.get("timezone") ?? "Asia/Kolkata");

  if (!name) throw new Error("Name is required");
  if (ratePaise === null || ratePaise <= 0) {
    throw new Error("Rate must be a positive number");
  }

  const { error } = await supabase.rpc("create_setup", {
    p_student_name: name,
    p_course_name: String(formData.get("courseName") ?? "").trim() || "Classes",
    p_rate_paise: ratePaise,
    p_timezone: timezone,
    p_weekdays: readWeekdays(formData),
    p_start_time: normalizeTime(String(formData.get("startTime") || "15:00")),
    p_from: localNow(new Date(), timezone).date,
  });

  check(error);
  revalidatePath("/");
}

// Closes the rules in force and opens new ones, rather than editing in place,
// so classes before the change still derive from the rule that applied then.
export async function changeSchedule(formData: FormData) {
  const student = await requireStudent();
  const supabase = await createClient();

  const { error } = await supabase.rpc("change_schedule", {
    p_course_id: Number(formData.get("courseId")),
    p_weekdays: readWeekdays(formData),
    p_start_time: normalizeTime(String(formData.get("startTime") || "15:00")),
    p_from:
      String(formData.get("from") || "") ||
      localNow(new Date(), student.timezone).date,
  });

  check(error);
  revalidatePath("/");
}

// A second thing you teach the same student, with its own schedule and rate.
export async function addCourse(formData: FormData) {
  const student = await requireStudent();
  const supabase = await createClient();
  const name = String(formData.get("name") ?? "").trim();
  const ratePaise = parseRupeesToPaise(String(formData.get("rupees") ?? ""));

  if (!name) throw new Error("Give the course a name");
  if (ratePaise === null || ratePaise <= 0) {
    throw new Error("Rate must be a positive number");
  }

  const { error } = await supabase.rpc("add_course", {
    p_student_id: student.id,
    p_name: name,
    p_rate_paise: ratePaise,
    p_weekdays: readWeekdays(formData),
    p_start_time: normalizeTime(String(formData.get("startTime") || "15:00")),
    p_from:
      String(formData.get("from") || "") ||
      localNow(new Date(), student.timezone).date,
  });

  check(error);
  revalidatePath("/");
}

// Changes what you charge from now on. Past classes keep the rate they were
// confirmed at.
export async function setCourseRate(formData: FormData) {
  const supabase = await createClient();
  const ratePaise = parseRupeesToPaise(String(formData.get("rupees") ?? ""));
  if (ratePaise === null || ratePaise <= 0) {
    throw new Error("Rate must be a positive number");
  }

  const { error } = await supabase.rpc("set_course_rate", {
    p_course_id: Number(formData.get("courseId")),
    p_rate_paise: ratePaise,
  });

  check(error);
  revalidatePath("/");
}
