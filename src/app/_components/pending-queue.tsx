import { confirmAll, cancelClass, confirmClass } from "@/app/actions";
import { formatClassDate, formatTime } from "@/lib/format";
import type { PendingOccurrence } from "@/lib/occurrences";

import { buttonStyles, Card, Empty } from "./ui";

export function PendingQueue({ pending }: { pending: PendingOccurrence[] }) {
  return (
    <Card
      title={pending.length ? `Unconfirmed (${pending.length})` : "Unconfirmed"}
      action={
        pending.length > 1 ? (
          <form action={confirmAll}>
            <input
              type="hidden"
              name="occurrences"
              value={JSON.stringify(
                pending.map((o) => ({ date: o.date, scheduleId: o.scheduleId })),
              )}
            />
            <button className={buttonStyles.quiet} type="submit">
              Confirm all
            </button>
          </form>
        ) : null
      }
    >
      {pending.length === 0 ? (
        <Empty>Nothing to confirm. You&rsquo;re up to date.</Empty>
      ) : (
        <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
          {pending.map((occurrence) => (
            <li
              key={`${occurrence.scheduleId}-${occurrence.date}`}
              className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
            >
              <div>
                <p className="font-medium">{formatClassDate(occurrence.date)}</p>
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                  {formatTime(occurrence.startTime)}
                </p>
              </div>

              <form className="flex gap-2">
                <input type="hidden" name="date" value={occurrence.date} />
                <input
                  type="hidden"
                  name="scheduleId"
                  value={occurrence.scheduleId}
                />
                <button className={buttonStyles.confirm} formAction={confirmClass}>
                  Happened
                </button>
                <button className={buttonStyles.reject} formAction={cancelClass}>
                  No
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
