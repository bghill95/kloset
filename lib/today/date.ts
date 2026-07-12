// Local calendar date, not toISOString(): UTC would roll the date
// mid-afternoon for western timezones (same reasoning as TodayCard's dateKey).
export function localDateKey(now: Date = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}
