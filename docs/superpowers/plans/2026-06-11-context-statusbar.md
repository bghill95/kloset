# Calendar + Weather Status Bar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A status bar on every tab screen showing today's weather and the next calendar events, fed by an iCloud ICS link + Open-Meteo, configured in Settings, fully mocked under `MOCK_AI=1`.

**Architecture:** Pure `lib/context/` modules (ICS windowing via node-ical, weather summarization, fixtures) behind `GET /api/context?from&to` (client supplies the local-midnight window — server never guesses timezones). Settings routes save/test `icsUrl` and `weatherLocation` in the existing key-value table. A client `StatusBar` in the `(tabs)` layout fetches once per mount and hides itself when there's nothing to show.

**Tech Stack:** adds `node-ical` (TZID + RRULE handling). Open-Meteo forecast + geocoding, keyless, cached via Next data cache (`revalidate: 900`).

**Spec:** `docs/superpowers/specs/2026-06-11-context-statusbar-design.md`
**Branch:** `context-statusbar` (stacked on `avatar-capture`)

---

## File structure

```
lib/context/window.ts        # validateWindow(from,to) — ISO parsing + span rules (TDD)
lib/context/window.test.ts
lib/context/events.ts        # windowEvents(icsText, from, to) via node-ical (TDD)
lib/context/events.test.ts
lib/context/weather.ts       # WMO code map, summarizeForecast, geocode helpers (TDD)
lib/context/weather.test.ts
lib/context/fixtures.ts      # mock events/weather/geocode for MOCK_AI=1
lib/context/types.ts         # ContextEvent, WeatherSummary, ContextResponse
app/api/context/route.ts     # GET — assemble events+weather, degrade on upstream failure
app/api/settings/calendar/route.ts  # POST save&test, DELETE clear
app/api/settings/weather/route.ts   # POST geocode+save, DELETE clear
components/context/StatusBar.tsx    # client bar, links to /settings
components/context/CalendarSection.tsx
components/context/WeatherSection.tsx
app/(tabs)/layout.tsx        # MODIFY: render <StatusBar/> above main
app/(tabs)/settings/page.tsx # MODIFY: add the two sections (reads settings rows)
e2e/statusbar.spec.ts        # after settings.spec, before tabs.spec
.env.example                 # no change (no new env vars)
```

Conventions: as previous plans (quoted `(tabs)` paths; client fetches in try/catch, never assume JSON error bodies; no module-scope env reads; commits end with the Claude trailer). If `node-ical`'s TypeScript types reject a listed usage, make the minimal type-level adjustment that preserves runtime behavior and report it.

---

### Task 1: Dependency + window validation (TDD)

- [ ] **Step 1:** `npm install node-ical`

- [ ] **Step 2:** Failing test `lib/context/window.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { validateWindow } from "./window";

describe("validateWindow", () => {
  it("accepts a sane window", () => {
    const r = validateWindow("2026-06-11T07:00:00.000Z", "2026-06-13T07:00:00.000Z");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.from.toISOString()).toBe("2026-06-11T07:00:00.000Z");
      expect(r.to.toISOString()).toBe("2026-06-13T07:00:00.000Z");
    }
  });

  it.each([
    ["missing from", null, "2026-06-13T07:00:00.000Z"],
    ["garbage", "yesterday", "2026-06-13T07:00:00.000Z"],
    ["reversed", "2026-06-13T07:00:00.000Z", "2026-06-11T07:00:00.000Z"],
    ["over 7 days", "2026-06-01T00:00:00.000Z", "2026-06-09T00:00:01.000Z"],
  ])("rejects %s", (_label, from, to) => {
    expect(validateWindow(from, to).ok).toBe(false);
  });
});
```

- [ ] **Step 3:** Observe failure, then `lib/context/window.ts`:

```ts
const MAX_SPAN_MS = 7 * 24 * 60 * 60 * 1000;

export type WindowResult =
  | { ok: true; from: Date; to: Date }
  | { ok: false; error: string };

export function validateWindow(
  fromRaw: unknown,
  toRaw: unknown,
): WindowResult {
  if (typeof fromRaw !== "string" || typeof toRaw !== "string") {
    return { ok: false, error: "from and to are required ISO timestamps." };
  }
  const from = new Date(fromRaw);
  const to = new Date(toRaw);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return { ok: false, error: "from/to must be valid ISO timestamps." };
  }
  if (to.getTime() <= from.getTime()) {
    return { ok: false, error: "to must be after from." };
  }
  if (to.getTime() - from.getTime() > MAX_SPAN_MS) {
    return { ok: false, error: "Window may span at most 7 days." };
  }
  return { ok: true, from, to };
}
```

- [ ] **Step 4:** Tests pass; typecheck; commit `feat: context window validation (TDD), add node-ical`.

---

### Task 2: ICS event windowing (TDD)

- [ ] **Step 1:** `lib/context/types.ts`:

```ts
export type ContextEvent = {
  title: string;
  start: string; // ISO instant; for all-day events, midnight UTC of the date
  end: string;
  allDay: boolean;
};

export type WeatherSummary = {
  tempMin: number;
  tempMax: number;
  code: number;
  label: string;
  emoji: string;
};

export type ContextResponse = {
  events: ContextEvent[];
  weather: WeatherSummary | null;
  configured: { calendar: boolean; weather: boolean };
};
```

- [ ] **Step 2:** Failing test `lib/context/events.test.ts` (fixture ICS inline):

```ts
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
```

Note: the sorted order asserts Standup (09:00) before Coffee (17:00) on the 11th,
and the all-day Beach day on the 12th last. If node-ical's actual RRULE expansion
emits times that legitimately differ from these expectations, STOP and report —
do not bend assertions to wrong behavior without flagging it.

- [ ] **Step 3:** Observe failure, then `lib/context/events.ts`:

```ts
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
    if (item.type !== "VEVENT") continue;
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
```

- [ ] **Step 4:** Tests pass (investigate honestly if node-ical's expansion
  disagrees — see Step 2 note); typecheck; commit `feat: ICS event windowing via node-ical (TDD)`.

---

### Task 3: Weather + geocode helpers (TDD)

- [ ] **Step 1:** Failing test `lib/context/weather.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  buildForecastUrl,
  buildGeocodeUrl,
  parseGeocode,
  summarizeForecast,
  weatherLabel,
} from "./weather";

describe("weatherLabel", () => {
  it.each([
    [0, "Clear", "☀️"],
    [2, "Partly cloudy", "⛅"],
    [3, "Overcast", "☁️"],
    [61, "Rain", "🌧️"],
    [71, "Snow", "❄️"],
    [95, "Thunderstorm", "⛈️"],
    [999, "Unknown", "🌡️"],
  ])("maps code %i", (code, label, emoji) => {
    expect(weatherLabel(code)).toEqual({ label, emoji });
  });
});

describe("summarizeForecast", () => {
  it("summarizes an Open-Meteo daily payload", () => {
    expect(
      summarizeForecast({
        daily: {
          temperature_2m_min: [17.6],
          temperature_2m_max: [23.9],
          weathercode: [2],
        },
      }),
    ).toEqual({
      tempMin: 18,
      tempMax: 24,
      code: 2,
      label: "Partly cloudy",
      emoji: "⛅",
    });
  });

  it("returns null for malformed payloads", () => {
    expect(summarizeForecast(null)).toBeNull();
    expect(summarizeForecast({ daily: { temperature_2m_min: [] } })).toBeNull();
  });
});

describe("parseGeocode", () => {
  it("returns the top match with a friendly label", () => {
    expect(
      parseGeocode({
        results: [
          { name: "Carlsbad", admin1: "California", latitude: 33.16, longitude: -117.35 },
        ],
      }),
    ).toEqual({ lat: 33.16, lon: -117.35, label: "Carlsbad, California" });
  });

  it("returns null when there are no results", () => {
    expect(parseGeocode({})).toBeNull();
    expect(parseGeocode(null)).toBeNull();
  });
});

describe("urls", () => {
  it("builds forecast and geocode urls", () => {
    expect(buildForecastUrl(33.16, -117.35)).toContain("latitude=33.16");
    expect(buildGeocodeUrl("Carlsbad")).toContain("name=Carlsbad");
  });
});
```

- [ ] **Step 2:** Observe failure, then `lib/context/weather.ts`:

```ts
import type { WeatherSummary } from "./types";

// WMO weather interpretation codes → display label/emoji.
const CODE_MAP: Array<[number[], string, string]> = [
  [[0], "Clear", "☀️"],
  [[1, 2], "Partly cloudy", "⛅"],
  [[3], "Overcast", "☁️"],
  [[45, 48], "Fog", "🌫️"],
  [[51, 53, 55, 56, 57], "Drizzle", "🌦️"],
  [[61, 63, 65, 66, 67], "Rain", "🌧️"],
  [[71, 73, 75, 77, 85, 86], "Snow", "❄️"],
  [[80, 81, 82], "Showers", "🌦️"],
  [[95, 96, 99], "Thunderstorm", "⛈️"],
];

export function weatherLabel(code: number): { label: string; emoji: string } {
  for (const [codes, label, emoji] of CODE_MAP) {
    if (codes.includes(code)) return { label, emoji };
  }
  return { label: "Unknown", emoji: "🌡️" };
}

export function summarizeForecast(raw: unknown): WeatherSummary | null {
  if (typeof raw !== "object" || raw === null) return null;
  const daily = (raw as { daily?: unknown }).daily;
  if (typeof daily !== "object" || daily === null) return null;
  const d = daily as Record<string, unknown>;
  const min = Array.isArray(d.temperature_2m_min) ? d.temperature_2m_min[0] : null;
  const max = Array.isArray(d.temperature_2m_max) ? d.temperature_2m_max[0] : null;
  const code = Array.isArray(d.weathercode) ? d.weathercode[0] : null;
  if (typeof min !== "number" || typeof max !== "number" || typeof code !== "number") {
    return null;
  }
  const { label, emoji } = weatherLabel(code);
  return {
    tempMin: Math.round(min),
    tempMax: Math.round(max),
    code,
    label,
    emoji,
  };
}

export function buildForecastUrl(lat: number, lon: number): string {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    daily: "weathercode,temperature_2m_max,temperature_2m_min",
    timezone: "auto",
    forecast_days: "1",
  });
  return `https://api.open-meteo.com/v1/forecast?${params}`;
}

export function buildGeocodeUrl(query: string): string {
  const params = new URLSearchParams({ name: query, count: "1" });
  return `https://geocoding-api.open-meteo.com/v1/search?${params}`;
}

export type GeoLocation = { lat: number; lon: number; label: string };

export function parseGeocode(raw: unknown): GeoLocation | null {
  if (typeof raw !== "object" || raw === null) return null;
  const results = (raw as { results?: unknown }).results;
  if (!Array.isArray(results) || results.length === 0) return null;
  const top = results[0] as Record<string, unknown>;
  if (typeof top.latitude !== "number" || typeof top.longitude !== "number") {
    return null;
  }
  const name = typeof top.name === "string" ? top.name : "Unknown";
  const admin = typeof top.admin1 === "string" ? `, ${top.admin1}` : "";
  return { lat: top.latitude, lon: top.longitude, label: `${name}${admin}` };
}
```

- [ ] **Step 3:** Tests pass; typecheck; commit `feat: weather summarization and geocode parsing (TDD)`.

---

### Task 4: Fixtures + GET /api/context

- [ ] **Step 1:** `lib/context/fixtures.ts`:

```ts
import type { ContextEvent, WeatherSummary } from "./types";

// Mock-mode fixtures derive from the requested window so the status bar always
// has content in dev/e2e regardless of wall-clock time.
export function fixtureEvents(from: Date): ContextEvent[] {
  const at = (hours: number, minutes = 0) => {
    const d = new Date(from);
    d.setUTCHours(hours, minutes, 0, 0);
    if (d.getTime() < from.getTime()) d.setUTCDate(d.getUTCDate() + 1);
    return d;
  };
  const coffee = at(10, 0);
  const dinner = at(19, 0);
  return [
    {
      title: "Coffee with Sam",
      start: coffee.toISOString(),
      end: new Date(coffee.getTime() + 60 * 60 * 1000).toISOString(),
      allDay: false,
    },
    {
      title: "Dinner with Alex",
      start: dinner.toISOString(),
      end: new Date(dinner.getTime() + 90 * 60 * 1000).toISOString(),
      allDay: false,
    },
  ];
}

export const FIXTURE_WEATHER: WeatherSummary = {
  tempMin: 18,
  tempMax: 24,
  code: 2,
  label: "Partly cloudy",
  emoji: "⛅",
};

export const FIXTURE_LOCATION = {
  lat: 33.16,
  lon: -117.35,
  label: "Mock City",
};
```

- [ ] **Step 2:** `app/api/context/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { getSetting } from "@/lib/db/settings";
import { windowEvents } from "@/lib/context/events";
import { FIXTURE_WEATHER, fixtureEvents } from "@/lib/context/fixtures";
import type { ContextResponse, WeatherSummary } from "@/lib/context/types";
import { buildForecastUrl, summarizeForecast } from "@/lib/context/weather";
import { validateWindow } from "@/lib/context/window";

const REVALIDATE_SECONDS = 900;

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const window = validateWindow(searchParams.get("from"), searchParams.get("to"));
  if (!window.ok) {
    return NextResponse.json({ error: window.error }, { status: 400 });
  }

  if (process.env.MOCK_AI === "1") {
    const body: ContextResponse = {
      events: fixtureEvents(window.from),
      weather: FIXTURE_WEATHER,
      configured: { calendar: true, weather: true },
    };
    return NextResponse.json(body);
  }

  const [icsUrl, locationRaw] = await Promise.all([
    getSetting("icsUrl"),
    getSetting("weatherLocation"),
  ]);

  // Context is allowed to fail; the app isn't. Each half degrades alone.
  let events: ContextResponse["events"] = [];
  if (icsUrl) {
    try {
      const res = await fetch(icsUrl, {
        next: { revalidate: REVALIDATE_SECONDS },
      });
      if (res.ok) {
        events = windowEvents(await res.text(), window.from, window.to);
      }
    } catch (err) {
      console.error("[context] ICS fetch failed:", err);
    }
  }

  let weather: WeatherSummary | null = null;
  if (locationRaw) {
    try {
      const location = JSON.parse(locationRaw) as { lat: number; lon: number };
      const res = await fetch(buildForecastUrl(location.lat, location.lon), {
        next: { revalidate: REVALIDATE_SECONDS },
      });
      if (res.ok) weather = summarizeForecast(await res.json());
    } catch (err) {
      console.error("[context] weather fetch failed:", err);
    }
  }

  const body: ContextResponse = {
    events,
    weather,
    configured: { calendar: Boolean(icsUrl), weather: Boolean(locationRaw) },
  };
  return NextResponse.json(body);
}
```

- [ ] **Step 3:** Typecheck + `npm test`; commit `feat: context API - windowed events + weather with graceful degradation`.

---

### Task 5: Settings routes (calendar, weather)

- [ ] **Step 1:** `app/api/settings/calendar/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { windowEvents } from "@/lib/context/events";
import { deleteSetting, setSetting } from "@/lib/db/settings";

// iCloud hands out webcal:// links; they're https underneath.
function normalizeIcsUrl(raw: string): string | null {
  const url = raw.trim().replace(/^webcal:\/\//i, "https://");
  if (!/^https:\/\//i.test(url)) return null;
  try {
    new URL(url);
  } catch {
    return null;
  }
  return url;
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const raw = (body as { icsUrl?: unknown })?.icsUrl;
  if (typeof raw !== "string" || raw.trim().length === 0) {
    return NextResponse.json({ error: "icsUrl is required." }, { status: 400 });
  }
  const icsUrl = normalizeIcsUrl(raw);
  if (!icsUrl) {
    return NextResponse.json(
      { error: "That doesn't look like a webcal:// or https:// link." },
      { status: 400 },
    );
  }

  if (process.env.MOCK_AI === "1") {
    await setSetting("icsUrl", icsUrl);
    return NextResponse.json({ ok: true, eventCount: 2 });
  }

  try {
    const res = await fetch(icsUrl, {
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: `Calendar URL responded with ${res.status}.` },
        { status: 400 },
      );
    }
    const text = await res.text();
    const from = new Date();
    const to = new Date(from.getTime() + 7 * 24 * 60 * 60 * 1000);
    const events = windowEvents(text, from, to);
    if (!text.includes("BEGIN:VCALENDAR")) {
      return NextResponse.json(
        { error: "That URL doesn't serve an ICS calendar." },
        { status: 400 },
      );
    }
    await setSetting("icsUrl", icsUrl);
    return NextResponse.json({ ok: true, eventCount: events.length });
  } catch (err) {
    console.error("[settings/calendar] test failed:", err);
    return NextResponse.json(
      { error: "Couldn't reach that URL." },
      { status: 400 },
    );
  }
}

export async function DELETE() {
  await deleteSetting("icsUrl");
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2:** `app/api/settings/weather/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { FIXTURE_LOCATION } from "@/lib/context/fixtures";
import { buildGeocodeUrl, parseGeocode } from "@/lib/context/weather";
import { deleteSetting, setSetting } from "@/lib/db/settings";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const query = (body as { query?: unknown })?.query;
  if (
    typeof query !== "string" ||
    query.trim().length === 0 ||
    query.length > 100
  ) {
    return NextResponse.json(
      { error: "Enter a city name (max 100 chars)." },
      { status: 400 },
    );
  }

  if (process.env.MOCK_AI === "1") {
    await setSetting("weatherLocation", JSON.stringify(FIXTURE_LOCATION));
    return NextResponse.json({ ok: true, location: FIXTURE_LOCATION });
  }

  try {
    const res = await fetch(buildGeocodeUrl(query.trim()), {
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(String(res.status));
    const location = parseGeocode(await res.json());
    if (!location) {
      return NextResponse.json(
        { error: "No match for that city." },
        { status: 400 },
      );
    }
    await setSetting("weatherLocation", JSON.stringify(location));
    return NextResponse.json({ ok: true, location });
  } catch (err) {
    console.error("[settings/weather] geocode failed:", err);
    return NextResponse.json(
      { error: "Couldn't look that up — try again." },
      { status: 400 },
    );
  }
}

export async function DELETE() {
  await deleteSetting("weatherLocation");
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3:** Typecheck + `npm test`; commit `feat: calendar and weather settings routes with save-and-test`.

---

### Task 6: StatusBar + Settings sections + layout wiring

- [ ] **Step 1:** `components/context/StatusBar.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ContextResponse } from "@/lib/context/types";

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export default function StatusBar() {
  const [context, setContext] = useState<ContextResponse | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    const to = new Date(from.getTime() + 48 * 60 * 60 * 1000);
    (async () => {
      try {
        const params = new URLSearchParams({
          from: from.toISOString(),
          to: to.toISOString(),
        });
        const res = await fetch(`/api/context?${params}`, {
          signal: controller.signal,
        });
        if (res.ok) setContext((await res.json()) as ContextResponse);
      } catch {
        // The bar simply doesn't render — never block the page on context.
      }
    })();
    return () => controller.abort();
  }, []);

  if (!context) return null;
  const { events, weather, configured } = context;
  if (!configured.calendar && !configured.weather) return null;
  if (events.length === 0 && !weather) return null;

  const upcoming = events.slice(0, 2);

  return (
    <Link
      href="/settings"
      aria-label="Today's weather and events — manage in Settings"
      className="block overflow-hidden border-b border-neutral-200 bg-white px-4 py-1.5 text-sm whitespace-nowrap text-ellipsis text-neutral-700"
    >
      {weather && (
        <span>
          {weather.emoji} {weather.tempMin}–{weather.tempMax}°
        </span>
      )}
      {upcoming.map((event) => (
        <span key={event.start + event.title}>
          {" · "}
          {event.allDay ? "All day" : formatTime(event.start)} {event.title}
        </span>
      ))}
    </Link>
  );
}
```

- [ ] **Step 2:** Modify `app/(tabs)/layout.tsx` — current file wraps children in a div with `<main>` + `<TabBar/>`; add the bar above main:

```tsx
import StatusBar from "@/components/context/StatusBar";
import TabBar from "@/components/TabBar";

export default function TabsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-dvh pb-20">
      <StatusBar />
      <main className="mx-auto max-w-5xl p-4">{children}</main>
      <TabBar />
    </div>
  );
}
```

- [ ] **Step 3:** `components/context/CalendarSection.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function CalendarSection({
  currentUrl,
}: {
  currentUrl: string | null;
}) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/settings/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ icsUrl: url }),
      });
      const data = (await res.json().catch(() => null)) as {
        error?: string;
        eventCount?: number;
      } | null;
      if (!res.ok) {
        setError(data?.error ?? "Couldn't save — try again.");
      } else {
        setMessage(`Connected — ${data?.eventCount ?? 0} events this week.`);
        setUrl("");
        router.refresh();
      }
    } catch {
      setError("Couldn't save — try again.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/settings/calendar", { method: "DELETE" });
      if (!res.ok) setError("Couldn't remove — try again.");
      else router.refresh();
    } catch {
      setError("Couldn't remove — try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-label="Calendar">
      <h2 className="text-lg font-semibold">Calendar</h2>
      <p className="mt-1 text-sm text-neutral-500">
        Paste your iCloud shared-calendar link (iCloud Calendar → share →
        public link). Events show in the status bar and feed outfit
        suggestions later.
      </p>
      {currentUrl ? (
        <div className="mt-2 flex items-center gap-3">
          <p className="text-sm text-neutral-700">✅ Calendar connected</p>
          <button
            type="button"
            disabled={busy}
            onClick={remove}
            className="text-xs text-red-600 underline disabled:opacity-50"
          >
            Remove
          </button>
        </div>
      ) : (
        <div className="mt-2 flex gap-2">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="webcal://… or https://…"
            aria-label="Calendar link"
            className="flex-1 rounded-xl border border-neutral-300 p-2 text-sm"
          />
          <button
            type="button"
            disabled={busy || url.trim().length === 0}
            onClick={save}
            className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy ? "…" : "Save & test"}
          </button>
        </div>
      )}
      {message && (
        <p role="status" className="mt-2 text-sm text-green-700">
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {error}
        </p>
      )}
    </section>
  );
}
```

- [ ] **Step 4:** `components/context/WeatherSection.tsx` (same skeleton):

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function WeatherSection({
  currentLabel,
}: {
  currentLabel: string | null;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/weather", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const data = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!res.ok) setError(data?.error ?? "Couldn't save — try again.");
      else {
        setQuery("");
        router.refresh();
      }
    } catch {
      setError("Couldn't save — try again.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/weather", { method: "DELETE" });
      if (!res.ok) setError("Couldn't remove — try again.");
      else router.refresh();
    } catch {
      setError("Couldn't remove — try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-label="Weather">
      <h2 className="text-lg font-semibold">Weather</h2>
      <p className="mt-1 text-sm text-neutral-500">
        Set a location for the daily forecast in the status bar.
      </p>
      {currentLabel ? (
        <div className="mt-2 flex items-center gap-3">
          <p className="text-sm text-neutral-700">
            📍 Weather location: {currentLabel}
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={remove}
            className="text-xs text-red-600 underline disabled:opacity-50"
          >
            Remove
          </button>
        </div>
      ) : (
        <div className="mt-2 flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="City, e.g. Carlsbad"
            aria-label="City"
            className="flex-1 rounded-xl border border-neutral-300 p-2 text-sm"
          />
          <button
            type="button"
            disabled={busy || query.trim().length === 0}
            onClick={save}
            className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy ? "…" : "Set location"}
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {error}
        </p>
      )}
    </section>
  );
}
```

- [ ] **Step 5:** Modify `app/(tabs)/settings/page.tsx` — fetch the two settings
  and render the new sections between Avatar and Passcode:

```tsx
import { asc } from "drizzle-orm";
import AvatarSection from "@/components/avatar/AvatarSection";
import CalendarSection from "@/components/context/CalendarSection";
import WeatherSection from "@/components/context/WeatherSection";
import { getDb } from "@/lib/db/client";
import { basePhotos } from "@/lib/db/schema";
import { getSetting } from "@/lib/db/settings";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [photos, icsUrl, weatherLocationRaw] = await Promise.all([
    getDb().select().from(basePhotos).orderBy(asc(basePhotos.createdAt)),
    getSetting("icsUrl"),
    getSetting("weatherLocation"),
  ]);

  let weatherLabel: string | null = null;
  if (weatherLocationRaw) {
    try {
      weatherLabel = (JSON.parse(weatherLocationRaw) as { label?: string })
        .label ?? null;
    } catch {
      weatherLabel = null;
    }
  }

  return (
    <>
      <h1 className="text-2xl font-semibold">Settings</h1>
      <div className="mt-6 flex flex-col gap-8">
        <AvatarSection photos={photos} />
        <CalendarSection currentUrl={icsUrl} />
        <WeatherSection currentLabel={weatherLabel} />
        <section aria-label="Passcode">
          <h2 className="text-lg font-semibold">Passcode</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Passcode management arrives in a later milestone.
          </p>
        </section>
      </div>
    </>
  );
}
```

- [ ] **Step 6:** Typecheck + `npm test` + quick e2e sanity (`npm run test:e2e`)
  — the bar now renders in mock mode on every tab page; existing specs assert
  headings/links that remain unique. If any existing spec breaks on ambiguity,
  fix the LOCATOR precision per learned rules, never the feature. Commit
  `feat: status bar + calendar/weather settings sections`.

---

### Task 7: e2e + ship

- [ ] **Step 1:** `e2e/statusbar.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import { unlock } from "./helpers";

test.describe.serial("context status bar", () => {
  test("status bar shows fixture weather and events on closet", async ({
    page,
  }) => {
    await unlock(page);
    const bar = page.getByRole("link", {
      name: /weather and events/i,
    });
    await expect(bar).toBeVisible();
    await expect(bar).toContainText("18–24°");
    await expect(bar).toContainText("Coffee with Sam");
  });

  test("tapping the bar opens settings", async ({ page }) => {
    await unlock(page);
    await page
      .getByRole("link", { name: /weather and events/i })
      .click();
    await expect(page).toHaveURL(/\/settings$/);
  });

  test("calendar save & test connects in mock mode", async ({ page }) => {
    await unlock(page);
    await page.goto("/settings");
    await page
      .getByLabel("Calendar link")
      .fill("webcal://p01-caldav.icloud.com/published/2/test");
    await page.getByRole("button", { name: "Save & test" }).click();
    await expect(page.locator("p[role='status']")).toContainText("Connected");
    await expect(page.getByText("✅ Calendar connected")).toBeVisible();
  });

  test("weather location sets and clears", async ({ page }) => {
    await unlock(page);
    await page.goto("/settings");
    await page.getByLabel("City").fill("Carlsbad");
    await page.getByRole("button", { name: "Set location" }).click();
    await expect(page.getByText("Weather location: Mock City")).toBeVisible();
    await page
      .getByRole("button", { name: "Remove" })
      .last()
      .click();
    await expect(page.getByLabel("City")).toBeVisible();
  });

  test("calendar removes cleanly", async ({ page }) => {
    await unlock(page);
    await page.goto("/settings");
    await page.getByRole("button", { name: "Remove" }).click();
    await expect(page.getByLabel("Calendar link")).toBeVisible();
  });
});
```

(Note: "Remove" appears once per configured section; the weather test removes
weather while calendar is still connected, so `.last()` targets weather's button
— calendar's Remove renders first in DOM order. The final test then has exactly
one Remove left. If ambiguity bites, scope locators with
`page.locator("section[aria-label='Weather']")` etc.)

- [ ] **Step 2:** Full gate `npm test && npm run typecheck && npm run test:e2e`
  → expect 26 e2e (auth 5, closet 7, settings 6, statusbar 5, tabs 3). Commit
  `test: status bar and context settings e2e`.

- [ ] **Step 3:** `npm run build` clean; push `context-statusbar`;
  `gh pr create --base avatar-capture` (stacked) with summary + test plan.

## Acceptance checklist

- [ ] Full gate + build green; bar visible on all tabs in mock mode
- [ ] Settings can connect/test/remove both sources
- [ ] Real-feed verification (user's actual iCloud link + city) → final user checklist

## Deferred

- M4 stylist consumes lib/context
- Real ICS feed quirks (Google/Outlook exports) — revisit when a real feed misbehaves
