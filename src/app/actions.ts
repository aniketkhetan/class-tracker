"use server";

import { revalidatePath } from "next/cache";

import { parseRupeesToPaise } from "@/lib/money";
import { localNow } from "@/lib/occurrences";
import { getActiveStudent, unwrap } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";

// Postgres unique violation. A double tap is a no-op, not an error.
const UNIQUE_VIOLATION = "23505";

async function requireStudent() {
  const student = await getActiveStudent();
  if (!student) throw new Error("No student set up yet");
  return student;
}

export async function confirmClass(formData: FormData) {
  const date = String(formData.get("date"));
  const scheduleIdRaw = formData.get("scheduleId");
  const student = await requireStudent();
  const supabase = await createClient();

  const { error } = await supabase.from("sessions").insert({
    student_id: student.id,
    schedule_id: scheduleIdRaw ? Number(scheduleIdRaw) : null,
    date,
    status: "confirmed",
    rate_paise: student.rate_paise,
  });

  if (error && error.code !== UNIQUE_VIOLATION) throw new Error(error.message);

  revalidatePath("/");
}

export async function cancelClass(formData: FormData) {
  const date = String(formData.get("date"));
  const scheduleIdRaw = formData.get("scheduleId");
  const student = await requireStudent();
  const supabase = await createClient();

  const { error } = await supabase.from("sessions").insert({
    student_id: student.id,
    schedule_id: scheduleIdRaw ? Number(scheduleIdRaw) : null,
    date,
    status: "cancelled",
    rate_paise: null,
  });

  if (error && error.code !== UNIQUE_VIOLATION) throw new Error(error.message);

  revalidatePath("/");
}

// Clears a whole backlog in one go.
export async function confirmAll(formData: FormData) {
  const payload = String(formData.get("occurrences") ?? "[]");
  const occurrences = JSON.parse(payload) as {
    date: string;
    scheduleId: number | null;
  }[];
  if (occurrences.length === 0) return;

  const student = await requireStudent();
  const supabase = await createClient();

  const { error } = await supabase.from("sessions").insert(
    occurrences.map((o) => ({
      student_id: student.id,
      schedule_id: o.scheduleId,
      date: o.date,
      status: "confirmed" as const,
      rate_paise: student.rate_paise,
    })),
  );

  if (error && error.code !== UNIQUE_VIOLATION) throw new Error(error.message);

  revalidatePath("/");
}

// Saved separately from the confirmation, which has already happened by now.
export async function saveNotes(formData: FormData) {
  const sessionId = Number(formData.get("sessionId"));
  const notes = String(formData.get("notes") ?? "").trim();
  const supabase = await createClient();

  unwrap(
    await supabase
      .from("sessions")
      .update({ notes: notes || null })
      .eq("id", sessionId)
      .select("id"),
  );

  revalidatePath("/");
}

// Unscheduled class: a session with no schedule behind it.
export async function addAdHocClass(formData: FormData) {
  const student = await requireStudent();
  const supabase = await createClient();
  const date =
    String(formData.get("date") ?? "") ||
    localNow(new Date(), student.timezone).date;
  const notes = String(formData.get("notes") ?? "").trim();

  unwrap(
    await supabase
      .from("sessions")
      .insert({
        student_id: student.id,
        schedule_id: null,
        date,
        status: "confirmed",
        rate_paise: student.rate_paise,
        notes: notes || null,
      })
      .select("id"),
  );

  revalidatePath("/");
}

// For fixing a misclick.
export async function toggleSessionStatus(formData: FormData) {
  const sessionId = Number(formData.get("sessionId"));
  const student = await requireStudent();
  const supabase = await createClient();

  const current = unwrap(
    await supabase
      .from("sessions")
      .select("status")
      .eq("id", sessionId)
      .single(),
  );

  const nextStatus =
    current.status === "confirmed" ? ("cancelled" as const) : ("confirmed" as const);

  unwrap(
    await supabase
      .from("sessions")
      .update({
        status: nextStatus,
        rate_paise: nextStatus === "confirmed" ? student.rate_paise : null,
      })
      .eq("id", sessionId)
      .select("id"),
  );

  revalidatePath("/");
}

// Puts the date back in the pending queue.
export async function deleteSession(formData: FormData) {
  const sessionId = Number(formData.get("sessionId"));
  const supabase = await createClient();

  unwrap(
    await supabase.from("sessions").delete().eq("id", sessionId).select("id"),
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

  const date =
    String(formData.get("date") ?? "") ||
    localNow(new Date(), student.timezone).date;
  const note = String(formData.get("note") ?? "").trim();

  unwrap(
    await supabase
      .from("payments")
      .insert({
        student_id: student.id,
        date,
        amount_paise: amountPaise,
        note: note || null,
      })
      .select("id"),
  );

  revalidatePath("/");
}

export async function deletePayment(formData: FormData) {
  const paymentId = Number(formData.get("paymentId"));
  const supabase = await createClient();

  unwrap(
    await supabase.from("payments").delete().eq("id", paymentId).select("id"),
  );

  revalidatePath("/");
}

// First run: student, rate, weekly slots.
export async function createSetup(formData: FormData) {
  const supabase = await createClient();
  const name = String(formData.get("name") ?? "").trim();
  const ratePaise = parseRupeesToPaise(String(formData.get("rupees") ?? ""));
  const timezone = String(formData.get("timezone") ?? "Asia/Kolkata");
  const startTime = String(formData.get("startTime") ?? "15:00");
  const weekdays = formData
    .getAll("weekdays")
    .map(Number)
    .filter((d) => d >= 0 && d <= 6);

  if (!name) throw new Error("Name is required");
  if (ratePaise === null || ratePaise <= 0) {
    throw new Error("Rate must be a positive number");
  }
  if (weekdays.length === 0) throw new Error("Pick at least one day");

  const student = unwrap(
    await supabase
      .from("students")
      .insert({ name, rate_paise: ratePaise, timezone })
      .select("*")
      .single(),
  );

  const activeFrom = localNow(new Date(), timezone).date;

  unwrap(
    await supabase
      .from("schedules")
      .insert(
        weekdays.map((weekday) => ({
          student_id: student.id,
          weekday,
          start_time: startTime,
          active_from: activeFrom,
        })),
      )
      .select("id"),
  );

  revalidatePath("/");
}
