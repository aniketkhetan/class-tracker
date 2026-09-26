import { NextResponse } from "next/server";

import { getActiveStudent, getCourses, getPending } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";

// Called from a notification action with the app closed, so it can't be a
// Server Action. Middleware has already checked the session cookie, and
// resolve_class checks the course is yours.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const date = typeof body?.date === "string" ? body.date : null;
  const courseId = typeof body?.courseId === "number" ? body.courseId : null;
  const status = body?.status === "cancelled" ? "cancelled" : "confirmed";
  const scheduleId =
    typeof body?.scheduleId === "number" ? body.scheduleId : null;

  if (!date || courseId === null) {
    return NextResponse.json(
      { error: "date and courseId are required" },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("resolve_class", {
    p_course_id: courseId,
    p_schedule_id: scheduleId,
    p_date: date,
    p_status: status,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const student = await getActiveStudent();
  if (!student) return NextResponse.json({ pending: 0 });

  const courses = await getCourses(student.id);
  const pending = await getPending(
    courses.map((c) => c.id),
    student.timezone,
  );

  return NextResponse.json({ pending: pending.length });
}
