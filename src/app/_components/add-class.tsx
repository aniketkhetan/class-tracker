import { addAdHocClass } from "@/app/actions";
import type { CourseRow } from "@/lib/database.types";

import { buttonStyles, Card, inputStyles } from "./ui";

export function AddClass({
  today,
  courses,
}: {
  today: string;
  courses: CourseRow[];
}) {
  if (courses.length === 0) return null;

  return (
    <Card title="Extra class">
      <form action={addAdHocClass} className="flex gap-2">
        {courses.length > 1 ? (
          <select className={inputStyles} name="courseId" aria-label="Course">
            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.name}
              </option>
            ))}
          </select>
        ) : (
          <input type="hidden" name="courseId" value={courses[0].id} />
        )}
        <input
          className={inputStyles}
          type="date"
          name="date"
          defaultValue={today}
          max={today}
          aria-label="Date of the extra class"
        />
        <button className={buttonStyles.primary} type="submit">
          Add
        </button>
      </form>
    </Card>
  );
}
