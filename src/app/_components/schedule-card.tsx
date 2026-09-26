import { addCourse, changeSchedule, setCourseRate } from "@/app/actions";
import type { CourseRow, ScheduleRow } from "@/lib/database.types";
import { formatTime, formatWeekday } from "@/lib/format";
import { paiseToRupeeInput } from "@/lib/money";

import { buttonStyles, Card, inputStyles } from "./ui";

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 0];

function DayCheckboxes({ active }: { active: Set<number> }) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">Days</legend>
      <div className="flex flex-wrap gap-2">
        {WEEKDAYS.map((day) => (
          <label
            key={day}
            className="flex cursor-pointer items-center gap-2 rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700"
          >
            <input
              type="checkbox"
              name="weekdays"
              value={day}
              defaultChecked={active.has(day)}
            />
            {formatWeekday(day).slice(0, 3)}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function CourseCard({
  course,
  schedules,
  today,
}: {
  course: CourseRow;
  schedules: ScheduleRow[];
  today: string;
}) {
  const mine = schedules.filter((s) => s.course_id === course.id);
  const active = new Set(mine.map((s) => s.weekday));
  const startTime = mine[0]?.start_time.slice(0, 5) ?? "15:00";
  const summary = mine.length
    ? `${mine
        .map((s) => formatWeekday(s.weekday).slice(0, 3))
        .join(" · ")} at ${formatTime(mine[0].start_time)}`
    : "No schedule set";

  return (
    <Card title={course.name}>
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
          <span className="text-sm">{summary}</span>
          <span className={buttonStyles.quiet}>
            <span className="group-open:hidden">Change</span>
            <span className="hidden group-open:inline">Cancel</span>
          </span>
        </summary>

        <form action={changeSchedule} className="mt-4 space-y-4">
          <input type="hidden" name="courseId" value={course.id} />
          <DayCheckboxes active={active} />

          <div className="flex gap-3">
            <label className="block flex-1 space-y-1">
              <span className="text-sm font-medium">Start time</span>
              <input
                className={inputStyles}
                type="time"
                name="startTime"
                defaultValue={startTime}
                required
              />
            </label>
            <label className="block flex-1 space-y-1">
              <span className="text-sm font-medium">From</span>
              <input
                className={inputStyles}
                type="date"
                name="from"
                defaultValue={today}
                required
              />
            </label>
          </div>

          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Classes before this date keep the old schedule. Anything already
            logged stays exactly as it is.
          </p>

          <button className={`${buttonStyles.primary} w-full`} type="submit">
            Save schedule
          </button>
        </form>

        <form action={setCourseRate} className="mt-4 flex items-end gap-2">
          <input type="hidden" name="courseId" value={course.id} />
          <label className="block flex-1 space-y-1">
            <span className="text-sm font-medium">Rate per class (₹)</span>
            <input
              className={inputStyles}
              name="rupees"
              inputMode="decimal"
              defaultValue={paiseToRupeeInput(course.rate_paise)}
              required
            />
          </label>
          <button className={buttonStyles.reject} type="submit">
            Save rate
          </button>
        </form>
      </details>
    </Card>
  );
}

export function AddCourse({ today }: { today: string }) {
  return (
    <Card title="Another course">
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
          <span className="text-sm text-neutral-500 dark:text-neutral-400">
            Teaching them something else as well?
          </span>
          <span className={buttonStyles.quiet}>
            <span className="group-open:hidden">Add</span>
            <span className="hidden group-open:inline">Cancel</span>
          </span>
        </summary>

        <form action={addCourse} className="mt-4 space-y-4">
          <div className="flex gap-3">
            <label className="block flex-1 space-y-1">
              <span className="text-sm font-medium">Course</span>
              <input
                className={inputStyles}
                name="name"
                placeholder="Physics"
                required
              />
            </label>
            <label className="block flex-1 space-y-1">
              <span className="text-sm font-medium">Rate per class (₹)</span>
              <input
                className={inputStyles}
                name="rupees"
                inputMode="decimal"
                required
              />
            </label>
          </div>

          <DayCheckboxes active={new Set()} />

          <div className="flex gap-3">
            <label className="block flex-1 space-y-1">
              <span className="text-sm font-medium">Start time</span>
              <input
                className={inputStyles}
                type="time"
                name="startTime"
                defaultValue="15:00"
                required
              />
            </label>
            <label className="block flex-1 space-y-1">
              <span className="text-sm font-medium">From</span>
              <input
                className={inputStyles}
                type="date"
                name="from"
                defaultValue={today}
                required
              />
            </label>
          </div>

          <button className={`${buttonStyles.primary} w-full`} type="submit">
            Add course
          </button>
        </form>
      </details>
    </Card>
  );
}
