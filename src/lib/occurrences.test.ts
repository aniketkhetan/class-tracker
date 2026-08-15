import { describe, expect, it } from "vitest";

import {
  addDays,
  derivePending,
  localNow,
  normalizeTime,
  weekdayOf,
  type ScheduleRule,
} from "./occurrences";

const IST = "Asia/Kolkata";

// August 2026: the 1st is a Saturday.
//   Tuesdays   4, 11, 18, 25
//   Thursdays  6, 13, 20, 27
//   Saturdays  1,  8, 15, 22, 29
const TUE = 2;
const THU = 4;
const SAT = 6;

function rule(overrides: Partial<ScheduleRule> = {}): ScheduleRule {
  return {
    id: 1,
    studentId: 1,
    weekday: TUE,
    startTime: "15:00",
    activeFrom: "2026-08-01",
    activeUntil: null,
    ...overrides,
  };
}

const datesOf = (occurrences: { date: string }[]) =>
  occurrences.map((o) => o.date);

describe("calendar helpers", () => {
  it("adds days across a month boundary", () => {
    expect(addDays("2026-08-30", 3)).toBe("2026-09-02");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("reads weekdays with Sunday as 0", () => {
    expect(weekdayOf("2026-08-01")).toBe(SAT);
    expect(weekdayOf("2026-08-13")).toBe(THU);
  });

  it("pads times so they compare lexicographically", () => {
    expect(normalizeTime("15:00")).toBe("15:00:00");
    expect(normalizeTime("9:5")).toBe("09:05:00");
    expect(normalizeTime("15:00:00")).toBe("15:00:00");
  });
});

describe("localNow", () => {
  it("reports the local date, not the UTC one", () => {
    // 20:00 UTC is already 01:30 the next day in IST.
    expect(localNow(new Date("2026-08-13T20:00:00Z"), IST)).toEqual({
      date: "2026-08-14",
      time: "01:30:00",
    });
  });

  it("agrees with UTC when asked for UTC", () => {
    expect(localNow(new Date("2026-08-13T20:00:00Z"), "UTC")).toEqual({
      date: "2026-08-13",
      time: "20:00:00",
    });
  });
});

describe("derivePending", () => {
  const schedules = [
    rule({ id: 1, weekday: TUE }),
    rule({ id: 2, weekday: THU }),
    rule({ id: 3, weekday: SAT }),
  ];

  // 12:00 UTC on Thursday 13 Aug is 17:30 IST, after that day's 15:00 class.
  const thursdayEvening = new Date("2026-08-13T12:00:00Z");

  it("returns every started class, most recent first", () => {
    const pending = derivePending({
      schedules,
      resolvedDates: [],
      now: thursdayEvening,
      timeZone: IST,
    });

    expect(datesOf(pending)).toEqual([
      "2026-08-13",
      "2026-08-11",
      "2026-08-08",
      "2026-08-06",
      "2026-08-04",
      "2026-08-01",
    ]);
  });

  it("excludes a class that has not started yet", () => {
    // 08:00 UTC is 13:30 IST, two hours before the 15:00 class.
    const pending = derivePending({
      schedules,
      resolvedDates: [],
      now: new Date("2026-08-13T08:00:00Z"),
      timeZone: IST,
    });

    expect(datesOf(pending)).not.toContain("2026-08-13");
    expect(datesOf(pending)[0]).toBe("2026-08-11");
  });

  it("judges start times in local time, not UTC", () => {
    // 23:00 IST on Thursday. At 18:00 UTC it is 23:30 IST, so the class has
    // started, even though 23:00 is still ahead of the UTC clock.
    const pending = derivePending({
      schedules: [rule({ weekday: THU, startTime: "23:00" })],
      resolvedDates: [],
      now: new Date("2026-08-13T18:00:00Z"),
      timeZone: IST,
    });

    expect(datesOf(pending)).toContain("2026-08-13");
  });

  it("drops dates that already have a session row", () => {
    const pending = derivePending({
      schedules,
      resolvedDates: ["2026-08-13", "2026-08-11", "2026-08-01"],
      now: thursdayEvening,
      timeZone: IST,
    });

    expect(datesOf(pending)).toEqual([
      "2026-08-08",
      "2026-08-06",
      "2026-08-04",
    ]);
  });

  it("honours a schedule that has been superseded", () => {
    // Tuesdays until the 12th, Wednesdays from the 13th.
    const versioned = [
      rule({ id: 1, weekday: TUE, activeUntil: "2026-08-12" }),
      rule({ id: 2, weekday: 3, activeFrom: "2026-08-13" }),
    ];

    const pending = derivePending({
      schedules: versioned,
      resolvedDates: [],
      now: new Date("2026-08-20T12:00:00Z"),
      timeZone: IST,
    });

    // Wednesday the 19th under the new rule; Tuesdays the 4th and 11th still
    // stand under the old one. No Tuesday on or after the 18th.
    expect(datesOf(pending)).toEqual([
      "2026-08-19",
      "2026-08-11",
      "2026-08-04",
    ]);
  });

  it("stops looking back past the lookback window", () => {
    const pending = derivePending({
      schedules: [rule({ weekday: TUE, activeFrom: "2026-01-01" })],
      resolvedDates: [],
      now: thursdayEvening,
      timeZone: IST,
      lookbackDays: 10,
    });

    // Window opens 2026-08-03, so only the 4th and 11th survive.
    expect(datesOf(pending)).toEqual(["2026-08-11", "2026-08-04"]);
  });

  it("ignores classes before the schedule started", () => {
    const pending = derivePending({
      schedules: [rule({ weekday: TUE, activeFrom: "2026-08-10" })],
      resolvedDates: [],
      now: thursdayEvening,
      timeZone: IST,
    });

    expect(datesOf(pending)).toEqual(["2026-08-11"]);
  });

  it("returns nothing when the schedule has not begun", () => {
    const pending = derivePending({
      schedules: [rule({ activeFrom: "2026-09-01" })],
      resolvedDates: [],
      now: thursdayEvening,
      timeZone: IST,
    });

    expect(pending).toEqual([]);
  });
});
