import { changeSchedule } from "@/app/actions";
import type { ScheduleRow } from "@/lib/database.types";
import { formatTime, formatWeekday } from "@/lib/format";

import { buttonStyles, Card, inputStyles } from "./ui";

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 0];

export function ScheduleCard({
  schedules,
  today,
}: {
  schedules: ScheduleRow[];
  today: string;
}) {
  const active = new Set(schedules.map((s) => s.weekday));
  const startTime = schedules[0]?.start_time.slice(0, 5) ?? "15:00";
  const summary = schedules.length
    ? `${schedules
        .map((s) => formatWeekday(s.weekday).slice(0, 3))
        .join(" · ")} at ${formatTime(schedules[0].start_time)}`
    : "No schedule set";

  return (
    <Card title="Schedule">
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
          <span className="text-sm">{summary}</span>
          <span className={buttonStyles.quiet}>
            <span className="group-open:hidden">Change</span>
            <span className="hidden group-open:inline">Cancel</span>
          </span>
        </summary>

        <form action={changeSchedule} className="mt-4 space-y-4">
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
      </details>
    </Card>
  );
}
