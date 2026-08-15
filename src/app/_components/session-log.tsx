import { deleteSession, toggleSessionStatus } from "@/app/actions";
import type { SessionRow } from "@/lib/database.types";
import { formatClassDate } from "@/lib/format";
import { formatPaise } from "@/lib/money";

import { NotesField } from "./notes-field";
import { buttonStyles, Card, Empty } from "./ui";

export function SessionLog({ sessions }: { sessions: SessionRow[] }) {
  return (
    <Card title="Log">
      {sessions.length === 0 ? (
        <Empty>No classes logged yet.</Empty>
      ) : (
        <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
          {sessions.map((session) => {
            const cancelled = session.status === "cancelled";

            return (
              <li key={session.id} className="py-3 first:pt-0 last:pb-0">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p
                      className={`font-medium ${
                        cancelled
                          ? "text-neutral-400 line-through dark:text-neutral-600"
                          : ""
                      }`}
                    >
                      {formatClassDate(session.date)}
                    </p>
                    <p className="text-sm text-neutral-500 dark:text-neutral-400">
                      {cancelled
                        ? "Didn't happen"
                        : formatPaise(session.rate_paise ?? 0)}
                      {session.schedule_id === null && !cancelled && " · extra"}
                    </p>
                  </div>

                  <div className="flex gap-1">
                    <form action={toggleSessionStatus}>
                      <input
                        type="hidden"
                        name="sessionId"
                        value={session.id}
                      />
                      <button className={buttonStyles.quiet} type="submit">
                        {cancelled ? "Undo" : "Mark missed"}
                      </button>
                    </form>
                    <form action={deleteSession}>
                      <input
                        type="hidden"
                        name="sessionId"
                        value={session.id}
                      />
                      <button
                        className={buttonStyles.quiet}
                        type="submit"
                        aria-label="Delete this entry"
                      >
                        ✕
                      </button>
                    </form>
                  </div>
                </div>

                {!cancelled && (
                  <NotesField sessionId={session.id} notes={session.notes} />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
