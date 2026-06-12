import { describe, expect, it } from "vitest";
import { windowEvents } from "./events";

const FROM = new Date("2026-06-11T00:00:00.000Z");
const TO = new Date("2026-06-13T00:00:00.000Z");

const ICS = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//test//EN
BEGIN:VEVENT
UID:in-window@test
DTSTART:20260611T170000Z
DTEND:20260611T180000Z
SUMMARY:Coffee with Sam
END:VEVENT
BEGIN:VEVENT
UID:out-of-window@test
DTSTART:20260620T170000Z
DTEND:20260620T180000Z
SUMMARY:Far future
END:VEVENT
BEGIN:VEVENT
UID:all-day@test
DTSTART;VALUE=DATE:20260612
DTEND;VALUE=DATE:20260613
SUMMARY:Beach day
END:VEVENT
BEGIN:VEVENT
UID:weekly@test
DTSTART:20260604T090000Z
DTEND:20260604T093000Z
RRULE:FREQ=WEEKLY
SUMMARY:Standup
END:VEVENT
END:VCALENDAR
`;

describe("windowEvents", () => {
  it("returns sorted events inside the window, expanding recurrence", () => {
    const events = windowEvents(ICS, FROM, TO);
    expect(events.map((e) => e.title)).toEqual([
      "Standup",
      "Coffee with Sam",
      "Beach day",
    ]);
    const standup = events[0];
    expect(standup.start).toBe("2026-06-11T09:00:00.000Z");
    expect(standup.end).toBe("2026-06-11T09:30:00.000Z");
    expect(standup.allDay).toBe(false);
    const beach = events[2];
    expect(beach.allDay).toBe(true);
    // Fix 1: all-day events must be UTC midnight of the literal date
    expect(beach.start).toBe("2026-06-12T00:00:00.000Z");
    expect(beach.end).toBe("2026-06-13T00:00:00.000Z");
  });

  it("returns [] for garbage input", () => {
    expect(windowEvents("not an ics file", FROM, TO)).toEqual([]);
  });

  it("caps results at 20", () => {
    const events = windowEvents(
      ICS.replace("FREQ=WEEKLY", "FREQ=HOURLY"),
      FROM,
      TO,
    );
    expect(events.length).toBeLessThanOrEqual(20);
  });

  // Fix 2: half-open recurrence window
  it("treats the window as half-open for recurrences", () => {
    const ics = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:daily@test
DTSTART:20260611T000000Z
DTEND:20260611T003000Z
RRULE:FREQ=DAILY
SUMMARY:Daily
END:VEVENT
END:VCALENDAR
`;
    const events = windowEvents(ics, FROM, TO);
    expect(events.map((e) => e.start)).toEqual([
      "2026-06-11T00:00:00.000Z",
      "2026-06-12T00:00:00.000Z",
    ]);
  });

  it("converts TZID events to correct UTC instants", () => {
    const ics = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:tzid-single@test
DTSTART;TZID=America/New_York:20260611T090000
DTEND;TZID=America/New_York:20260611T100000
SUMMARY:NY Meeting
END:VEVENT
END:VCALENDAR
`;
    const events = windowEvents(ics, FROM, TO);
    expect(events).toHaveLength(1);
    expect(events[0].start).toBe("2026-06-11T13:00:00.000Z"); // 9am EDT
  });

  it("expands recurring TZID events at correct UTC instants", () => {
    const ics = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:tzid-recurring@test
DTSTART;TZID=America/New_York:20260604T090000
DTEND;TZID=America/New_York:20260604T100000
RRULE:FREQ=WEEKLY
SUMMARY:NY Standup
END:VEVENT
END:VCALENDAR
`;
    const events = windowEvents(ics, FROM, TO);
    expect(events.map((e) => e.start)).toEqual(["2026-06-11T13:00:00.000Z"]);
  });

  // Fix 3: EXDATE cancelled occurrences
  it("skips EXDATE-cancelled occurrences", () => {
    const ics = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:cancelled@test
DTSTART:20260604T090000Z
DTEND:20260604T093000Z
RRULE:FREQ=WEEKLY
EXDATE:20260611T090000Z
SUMMARY:Standup
END:VEVENT
END:VCALENDAR
`;
    expect(windowEvents(ics, FROM, TO)).toEqual([]);
  });
});
