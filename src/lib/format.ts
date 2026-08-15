const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

// Parsed as UTC so the host clock can't shift the date.
export function formatClassDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const at = new Date(Date.UTC(y, m - 1, d));
  return `${WEEKDAY_NAMES[at.getUTCDay()].slice(0, 3)} ${d} ${MONTHS[m - 1]}`;
}

export function formatWeekday(weekday: number): string {
  return WEEKDAY_NAMES[weekday] ?? "?";
}

export function formatTime(time: string): string {
  const [hRaw, m] = time.split(":");
  const h = Number(hRaw);
  const suffix = h >= 12 ? "pm" : "am";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${m}${suffix}`;
}
