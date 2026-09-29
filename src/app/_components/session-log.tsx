import { X } from "lucide-react";

import { deleteSession, toggleSessionStatus } from "@/app/actions";
import { Badge } from "@/components/ui/badge";
import type { CourseRow, SessionRow } from "@/lib/database.types";
import { formatClassDate } from "@/lib/format";
import { formatPaise } from "@/lib/money";
import { cn } from "@/lib/utils";

import { NotesField } from "./notes-field";
import { SubmitButton } from "./submit-button";
import { Empty, Section } from "./ui";

export function SessionLog({
  sessions,
  courses,
}: {
  sessions: SessionRow[];
  courses: CourseRow[];
}) {
  const nameOf = new Map(courses.map((c) => [c.id, c.name]));
  const showCourse = courses.length > 1;

  return (
    <Section
      title="Log"
      className="min-[900px]:flex min-[900px]:min-h-0 min-[900px]:w-full min-[900px]:flex-col"
      contentClassName="min-[900px]:flex min-[900px]:min-h-0 min-[900px]:flex-1 min-[900px]:flex-col"
    >
      {sessions.length === 0 ? (
        <Empty>No classes logged yet.</Empty>
      ) : (
        // Scrolls inside the card on desktop so the heading stays put.
        <ul className="divide-y min-[900px]:min-h-0 min-[900px]:flex-1 min-[900px]:overflow-y-auto">
          {sessions.map((session) => {
            const cancelled = session.status === "cancelled";

            return (
              <li key={session.id} className="py-3 first:pt-0 last:pb-0">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p
                      className={cn(
                        "font-medium",
                        cancelled && "text-muted-foreground line-through",
                      )}
                    >
                      {formatClassDate(session.date)}
                    </p>
                    <p className="flex items-center gap-1.5 truncate text-sm text-muted-foreground">
                      {showCourse && (
                        <Badge variant="secondary">
                          {nameOf.get(session.course_id)}
                        </Badge>
                      )}
                      {cancelled
                        ? "Didn't happen"
                        : formatPaise(session.rate_paise ?? 0)}
                      {session.schedule_id === null && !cancelled && " · extra"}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    <form action={toggleSessionStatus}>
                      <input type="hidden" name="sessionId" value={session.id} />
                      <SubmitButton variant="ghost" size="sm">
                        {cancelled ? "Undo" : "Mark missed"}
                      </SubmitButton>
                    </form>
                    <form action={deleteSession}>
                      <input type="hidden" name="sessionId" value={session.id} />
                      <SubmitButton
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Delete this entry"
                      >
                        <X />
                      </SubmitButton>
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
    </Section>
  );
}
