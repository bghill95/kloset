import ical from "node-ical";
import type { ContextEvent } from "./types";

const MAX_EVENTS = 20;

// node-ical parses VALUE=DATE at server-local midnight; rebuild at UTC
// midnight of the literal calendar date so dev and prod emit identical
// instants regardless of server timezone.
const dateOnlyUtc = (d: Date) =>
  new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));

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

      // Fix 3: build exdate set to skip EXDATE-cancelled occurrences.
      // node-ical exposes exdate as a keyed map of Dates.
      const exdates = new Set(
        Object.values(
          (ev as unknown as { exdate?: Record<string, Date> }).exdate ?? {},
        ).map((d) => d.getTime()),
      );

      // TODO: RECURRENCE-ID overrides (moved instances) still render at their
      // original time — revisit when a real feed misbehaves (spec deferral).

      // Fix 4a: cap per-event slice rather than using a shared counter + break.
      for (const occ of occurrences.slice(0, MAX_EVENTS)) {
        // Fix 2: treat window as half-open — skip occurrences at exactly `to`.
        if (occ.getTime() >= to.getTime()) continue;
        // Fix 3: skip EXDATE-cancelled occurrences.
        if (exdates.has(occ.getTime())) continue;
        const occStart = allDay ? dateOnlyUtc(occ) : occ;
        const occEnd = allDay
          ? dateOnlyUtc(new Date(occ.getTime() + durationMs))
          : new Date(occ.getTime() + durationMs);
        out.push({
          title,
          start: occStart.toISOString(),
          end: occEnd.toISOString(),
          allDay,
        });
      }
    } else {
      // Single: include when it overlaps the window.
      if (end.getTime() > from.getTime() && start.getTime() < to.getTime()) {
        // Fix 1: normalize all-day dates to UTC midnight of the literal date.
        const evStart = allDay ? dateOnlyUtc(start) : start;
        const evEnd = allDay ? dateOnlyUtc(end) : end;
        out.push({
          title,
          start: evStart.toISOString(),
          end: evEnd.toISOString(),
          allDay,
        });
      }
    }
  }

  return out
    .sort((a, b) => a.start.localeCompare(b.start))
    .slice(0, MAX_EVENTS);
}
