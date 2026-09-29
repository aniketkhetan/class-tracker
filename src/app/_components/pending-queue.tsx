import { cancelClass, confirmAll, confirmClass } from "@/app/actions";
import type { CourseRow } from "@/lib/database.types";
import { formatClassDate, formatTime } from "@/lib/format";
import type { PendingOccurrence } from "@/lib/occurrences";

import { SubmitButton } from "./submit-button";
import { Empty, Section } from "./ui";

export function PendingQueue({
  pending,
  courses,
}: {
  pending: PendingOccurrence[];
  courses: CourseRow[];
}) {
  const nameOf = new Map(courses.map((c) => [c.id, c.name]));
  const showCourse = courses.length > 1;

  return (
    <Section
      title={pending.length ? `Unconfirmed (${pending.length})` : "Unconfirmed"}
      action={
        pending.length > 1 ? (
          <form action={confirmAll}>
            <input
              type="hidden"
              name="occurrences"
              value={JSON.stringify(
                pending.map((o) => ({
                  courseId: o.courseId,
                  scheduleId: o.scheduleId,
                  date: o.date,
                })),
              )}
            />
            <SubmitButton variant="ghost" size="sm" pendingLabel="Confirming">
              Confirm all
            </SubmitButton>
          </form>
        ) : null
      }
    >
      {pending.length === 0 ? (
        <Empty>Nothing to confirm. You&rsquo;re up to date.</Empty>
      ) : (
        <ul className="divide-y">
          {pending.map((occurrence) => {
            // Two forms rather than one with two submit buttons, so each
            // button gets its own pending state instead of both spinning.
            const fields = (
              <>
                <input type="hidden" name="date" value={occurrence.date} />
                <input
                  type="hidden"
                  name="courseId"
                  value={occurrence.courseId}
                />
                <input
                  type="hidden"
                  name="scheduleId"
                  value={occurrence.scheduleId}
                />
              </>
            );

            return (
              <li
                key={`${occurrence.scheduleId}-${occurrence.date}`}
                className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div className="min-w-0">
                  <p className="font-medium">
                    {formatClassDate(occurrence.date)}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">
                    {showCourse && `${nameOf.get(occurrence.courseId)} · `}
                    {formatTime(occurrence.startTime)}
                  </p>
                </div>

                <div className="flex shrink-0 gap-2">
                  <form action={confirmClass}>
                    {fields}
                    <SubmitButton className="h-10 px-4" pendingLabel="Saving">
                      Happened
                    </SubmitButton>
                  </form>
                  <form action={cancelClass}>
                    {fields}
                    <SubmitButton variant="outline" className="h-10 px-4">
                      No
                    </SubmitButton>
                  </form>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}
