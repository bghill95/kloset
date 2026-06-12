import ical from "node-ical";
import type { ContextEvent } from "./types";

const MAX_EVENTS = 20;

// Expand an ICS feed into concrete events overlapping [from, to).
// Defensive throughout: a malformed feed yields [] rather than throwing —
// context is allowed to fail, the app isn't.
export function windowEvents(icsText: string, from: Date, to: Date): ContextEvent[] {
  let parsed: ical.CalendarResponse;
  try {
    parsed = ical.sync.parseICS(icsText);
  } catch {
    return [];
  }

  const out: ContextEvent[] = [];
  for (const key of Object.keys(parsed)) {
    const item = parsed[key];
    if (!item || item.type !== "VEVENT") continue;
    const ev = item as ical.VEvent;
    const title = typeof ev.summary === "string" ? ev.summary : "Untitled";
    const allDay =
      (ev as unknown as { datetype?: string }).datetype === "date";
    const start = ev.start instanceof Date ? ev.start : null;
    const end = ev.end instanceof Date ? ev.end : start;
    if (!start || !end) continue;
    const durationMs = end.getTime() - start.getTime();

    if (ev.rrule) {
      // Recurring: expand occurrences that start inside the window.
      let occurrences: Date[];
      try {
        occurrences = ev.rrule.between(from, to, true);
      } catch {
        continue;
      }
      for (const occ of occurrences) {
        out.push({
          title,
          start: occ.toISOString(),
          end: new Date(occ.getTime() + durationMs).toISOString(),
          allDay,
        });
        if (out.length >= MAX_EVENTS * 2) break;
      }
    } else {
      // Single: include when it overlaps the window.
      if (end.getTime() > from.getTime() && start.getTime() < to.getTime()) {
        out.push({
          title,
          start: start.toISOString(),
          end: end.toISOString(),
          allDay,
        });
      }
    }
  }

  return out
    .sort((a, b) => a.start.localeCompare(b.start))
    .slice(0, MAX_EVENTS);
}
