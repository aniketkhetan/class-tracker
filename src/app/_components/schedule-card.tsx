import { addCourse, changeSchedule, setCourseRate } from "@/app/actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CourseRow, ScheduleRow } from "@/lib/database.types";
import { formatTime, formatWeekday } from "@/lib/format";
import { paiseToRupeeInput } from "@/lib/money";

import { CollapseOnDone } from "./collapse-on-done";
import { SubmitButton } from "./submit-button";
import { Section } from "./ui";

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 0];

// Native checkboxes on purpose: they post without JavaScript, which is what
// keeps the whole app usable as plain forms.
function DayCheckboxes({ active }: { active: Set<number> }) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">Days</legend>
      <div className="flex flex-wrap gap-1.5">
        {WEEKDAYS.map((day) => (
          <label
            key={day}
            className="flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors has-checked:border-primary has-checked:bg-muted"
          >
            <input
              type="checkbox"
              name="weekdays"
              value={day}
              defaultChecked={active.has(day)}
              className="accent-primary"
            />
            {formatWeekday(day).slice(0, 3)}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function FromAndTime({
  today,
  startTime = "15:00",
}: {
  today: string;
  startTime?: string;
}) {
  return (
    <div className="flex gap-3">
      <div className="flex-1 space-y-1.5">
        <Label htmlFor="startTime">Start time</Label>
        <Input
          id="startTime"
          type="time"
          name="startTime"
          defaultValue={startTime}
          required
        />
      </div>
      <div className="flex-1 space-y-1.5">
        <Label htmlFor="from">From</Label>
        <Input
          id="from"
          type="date"
          name="from"
          defaultValue={today}
          required
        />
      </div>
    </div>
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
    <Section title={course.name}>
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
          <span className="text-sm">{summary}</span>
          <span className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
            <span className="group-open:hidden">Change</span>
            <span className="hidden group-open:inline">Cancel</span>
          </span>
        </summary>

        <form action={changeSchedule} className="mt-4 space-y-4">
          <input type="hidden" name="courseId" value={course.id} />
          <DayCheckboxes active={active} />
          <FromAndTime today={today} startTime={startTime} />

          <p className="text-sm text-muted-foreground">
            Classes before this date keep the old schedule. Anything already
            logged stays exactly as it is.
          </p>

          <SubmitButton className="h-10 w-full" pendingLabel="Saving">
            Save schedule
          </SubmitButton>
          <CollapseOnDone />
        </form>

        <form action={setCourseRate} className="mt-4 flex items-end gap-2">
          <input type="hidden" name="courseId" value={course.id} />
          <div className="flex-1 space-y-1.5">
            <Label htmlFor={`rate-${course.id}`}>Rate per class (₹)</Label>
            <Input
              id={`rate-${course.id}`}
              name="rupees"
              inputMode="decimal"
              defaultValue={paiseToRupeeInput(course.rate_paise)}
              required
            />
          </div>
          <SubmitButton variant="outline" pendingLabel="Saving">
            Save rate
          </SubmitButton>
          <CollapseOnDone />
        </form>
      </details>
    </Section>
  );
}

export function AddCourse({ today }: { today: string }) {
  return (
    <Section title="Another course">
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
          <span className="text-sm text-muted-foreground">
            Teaching them something else as well?
          </span>
          <span className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
            <span className="group-open:hidden">Add</span>
            <span className="hidden group-open:inline">Cancel</span>
          </span>
        </summary>

        <form action={addCourse} className="mt-4 space-y-4">
          <div className="flex gap-3">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="courseName">Course</Label>
              <Input id="courseName" name="name" placeholder="Physics" required />
            </div>
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="courseRate">Rate per class (₹)</Label>
              <Input
                id="courseRate"
                name="rupees"
                inputMode="decimal"
                required
              />
            </div>
          </div>

          <DayCheckboxes active={new Set()} />
          <FromAndTime today={today} />

          <SubmitButton className="h-10 w-full" pendingLabel="Adding">
            Add course
          </SubmitButton>
          <CollapseOnDone />
        </form>
      </details>
    </Section>
  );
}
