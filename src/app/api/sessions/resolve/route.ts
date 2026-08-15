import { NextResponse } from "next/server";

import { getActiveStudent, getPending } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";

const UNIQUE_VIOLATION = "23505";

// Called from a notification action with the app closed, so it can't be a
// Server Action. Middleware has already checked the session cookie.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const date = typeof body?.date === "string" ? body.date : null;
  const status = body?.status === "cancelled" ? "cancelled" : "confirmed";
  const scheduleId =
    typeof body?.scheduleId === "number" ? body.scheduleId : null;

  if (!date) {
    return NextResponse.json({ error: "date is required" }, { status: 400 });
  }

  const student = await getActiveStudent();
  if (!student) {
    return NextResponse.json({ error: "no student" }, { status: 404 });
  }

  const supabase = await createClient();
  const { error } = await supabase.from("sessions").insert({
    student_id: student.id,
    schedule_id: scheduleId,
    date,
    status,
    rate_paise: status === "confirmed" ? student.rate_paise : null,
  });

  // Already resolved. The dashboard got there first.
  if (error && error.code !== UNIQUE_VIOLATION) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const pending = await getPending(student.id, student.timezone);
  return NextResponse.json({ pending: pending.length });
}
