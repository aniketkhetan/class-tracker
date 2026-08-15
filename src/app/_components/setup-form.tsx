import { createSetup } from "@/app/actions";
import { formatWeekday } from "@/lib/format";

import { buttonStyles, Card, inputStyles } from "./ui";

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 0];

export function SetupForm() {
  return (
    <Card title="Set up">
      <p className="mb-4 text-sm text-neutral-500 dark:text-neutral-400">
        Your weekly schedule. You can change it later without disturbing
        anything already logged.
      </p>

      <form action={createSetup} className="space-y-4">
        <label className="block space-y-1">
          <span className="text-sm font-medium">Student</span>
          <input className={inputStyles} name="name" required />
        </label>

        <div className="flex gap-3">
          <label className="block flex-1 space-y-1">
            <span className="text-sm font-medium">Rate per class (₹)</span>
            <input
              className={inputStyles}
              name="rupees"
              inputMode="decimal"
              required
            />
          </label>
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
        </div>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Days</legend>
          <div className="flex flex-wrap gap-2">
            {WEEKDAYS.map((day) => (
              <label
                key={day}
                className="flex cursor-pointer items-center gap-2 rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700"
              >
                <input type="checkbox" name="weekdays" value={day} />
                {formatWeekday(day).slice(0, 3)}
              </label>
            ))}
          </div>
        </fieldset>

        <input type="hidden" name="timezone" value="Asia/Kolkata" />

        <button className={`${buttonStyles.primary} w-full`} type="submit">
          Start tracking
        </button>
      </form>
    </Card>
  );
}
