import { addAdHocClass } from "@/app/actions";
import { Input } from "@/components/ui/input";
import type { CourseRow } from "@/lib/database.types";

import { SubmitButton } from "./submit-button";
import { Section } from "./ui";

export function AddClass({
  today,
  courses,
}: {
  today: string;
  courses: CourseRow[];
}) {
  if (courses.length === 0) return null;

  return (
    <Section title="Extra class">
      <form action={addAdHocClass} className="flex gap-2">
        {courses.length > 1 ? (
          // Native select on purpose: it posts without JavaScript and gives
          // the platform picker on a phone.
          <select
            name="courseId"
            aria-label="Course"
            className="h-10 rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.name}
              </option>
            ))}
          </select>
        ) : (
          <input type="hidden" name="courseId" value={courses[0].id} />
        )}
        <Input
          type="date"
          name="date"
          defaultValue={today}
          max={today}
          aria-label="Date of the extra class"
          className="h-10"
        />
        <SubmitButton className="h-10 px-4" pendingLabel="Adding">
          Add
        </SubmitButton>
      </form>
    </Section>
  );
}
