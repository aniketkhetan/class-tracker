import { createSetup } from "@/app/actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatWeekday } from "@/lib/format";

import { SubmitButton } from "./submit-button";
import { Section } from "./ui";

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 0];

export function SetupForm() {
  return (
    <Section title="Set up">
      <p className="mb-4 text-sm text-muted-foreground">
        Your weekly schedule for one course. You can add more courses, and
        change any of this later, without disturbing anything already logged.
      </p>

      <form action={createSetup} className="space-y-4">
        <div className="flex gap-3">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="name">Student</Label>
            <Input id="name" name="name" required />
          </div>
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="courseName">Course</Label>
            <Input
              id="courseName"
              name="courseName"
              placeholder="Maths"
              required
            />
          </div>
        </div>

        <div className="flex gap-3">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="rupees">Rate per class (₹)</Label>
            <Input id="rupees" name="rupees" inputMode="decimal" required />
          </div>
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="startTime">Start time</Label>
            <Input
              id="startTime"
              type="time"
              name="startTime"
              defaultValue="15:00"
              required
            />
          </div>
        </div>

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
                  className="accent-primary"
                />
                {formatWeekday(day).slice(0, 3)}
              </label>
            ))}
          </div>
        </fieldset>

        <input type="hidden" name="timezone" value="Asia/Kolkata" />

        <SubmitButton className="h-10 w-full" pendingLabel="Setting up">
          Start tracking
        </SubmitButton>
      </form>
    </Section>
  );
}
