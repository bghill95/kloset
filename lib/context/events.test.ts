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
    expect(beach.start.startsWith("2026-06-12")).toBe(true);
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
});
