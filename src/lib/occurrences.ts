// Works on local wall-clock strings rather than instants. "Has 3pm on the 13th
// gone past here" is a question about local dates and times, and comparing
// "2026-08-13" / "15:00:00" lexicographically answers it without any UTC offset
// maths. localNow is the only thing here that touches a real timezone.

const DAY_MS = 86_400_000;

export type ScheduleRule = {
  id: number;
  courseId: number;
  weekday: number; // 0 = Sunday
  startTime: string;
  activeFrom: string;
  activeUntil: string | null;
};

export type PendingOccurrence = {
  courseId: number;
  scheduleId: number;
  date: string;
  startTime: string;
};

export function localNow(
  now: Date,
  timeZone: string,
): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  })
    .formatToParts(now)
    .reduce<Record<string, string>>((acc, p) => {
      acc[p.type] = p.value;
      return acc;
    }, {});

  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}:${parts.second}`,
  };
}

// "15:00" -> "15:00:00", so times compare as strings.
export function normalizeTime(time: string): string {
  const [h = "00", m = "00", s = "00"] = time.split(":");
  return `${h.padStart(2, "0")}:${m.padStart(2, "0")}:${s.padStart(2, "0")}`;
}

// UTC internally so the host machine's timezone can't shift the date.
export function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const shifted = new Date(Date.UTC(y, m - 1, d) + days * DAY_MS);
  return shifted.toISOString().slice(0, 10);
}

export function weekdayOf(isoDate: string): number {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

const maxDate = (a: string, b: string) => (a > b ? a : b);
const minDate = (a: string, b: string) => (a < b ? a : b);

// Keyed by slot rather than by date. A student can be taught two courses that
// both meet on a Tuesday, and confirming one must not make the other vanish.
// Ad-hoc classes carry no schedule, so they suppress nothing.
const slot = (scheduleId: number, date: string) => `${scheduleId}|${date}`;

export type ResolvedSlot = { scheduleId: number | null; date: string };

export type DerivePendingArgs = {
  schedules: ScheduleRule[];
  resolved: Iterable<ResolvedSlot>;
  now: Date;
  timeZone: string;
  // Older classes drop off the queue instead of haunting it. They're never
  // auto-confirmed, they just stop being asked about.
  lookbackDays?: number;
};

// Expected classes that have started, minus the ones already resolved.
// Most recent first.
export function derivePending({
  schedules,
  resolved,
  now,
  timeZone,
  lookbackDays = 90,
}: DerivePendingArgs): PendingOccurrence[] {
  const { date: today, time: nowTime } = localNow(now, timeZone);
  const windowStart = addDays(today, -lookbackDays);
  const taken = new Set<string>();
  for (const r of resolved) {
    if (r.scheduleId !== null) taken.add(slot(r.scheduleId, r.date));
  }
  const found: PendingOccurrence[] = [];

  for (const rule of schedules) {
    const startTime = normalizeTime(rule.startTime);
    const from = maxDate(rule.activeFrom, windowStart);
    const until = minDate(rule.activeUntil ?? today, today);
    if (from > until) continue;

    const offset = (rule.weekday - weekdayOf(from) + 7) % 7;
    for (
      let date = addDays(from, offset);
      date <= until;
      date = addDays(date, 7)
    ) {
      if (date === today && startTime > nowTime) continue;
      if (taken.has(slot(rule.id, date))) continue;

      found.push({
        courseId: rule.courseId,
        scheduleId: rule.id,
        date,
        startTime,
      });
    }
  }

  return found.sort(
    (a, b) => b.date.localeCompare(a.date) || b.startTime.localeCompare(a.startTime),
  );
}
