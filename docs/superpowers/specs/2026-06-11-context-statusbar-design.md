# Calendar + Weather Status Bar — Design Spec

**Date:** 2026-06-11
**Status:** Approved under the user's standing build-to-completion directive
(2026-06-11); slice 3 of 3 from the 2026-06-11 brainstorm.
**Parent spec:** `2026-06-10-virtual-closet-design.md` (§2 calendar decision, §3.5
settings, §4 external calls). This slice pulls the M4 context plumbing (ICS +
weather) forward and adds the user-requested persistent status bar; the M4 stylist
will consume the same `lib/context` modules later.

## 1. Purpose

Surface the user's day — weather and upcoming calendar events — as a slim status
bar at the top of every tab screen, fed by a read-only iCloud shared-calendar ICS
link and Open-Meteo (free, keyless). A PWA cannot read the on-device iOS Calendar;
the ICS link is the supported route (parent spec §2).

## 2. Decisions

| Decision | Choice |
|---|---|
| Status bar placement | Top of all five tab screens (rendered in the `(tabs)` layout), above the page content; hidden entirely until at least one source is configured |
| Bar content | One line: weather emoji + today's min–max temp, then up to the next 2 events in the window ("10:00 Standup · 19:00 Dinner"); all-day events render as "All day · Title" |
| Event window | Client computes it: local midnight → +48h, sent as `from`/`to` ISO params — the server never guesses the user's timezone (Vercel runs UTC) |
| ICS parsing | `node-ical` dependency (handles TZID and RRULE recurrence expansion — hand-rolling RRULE is a known tarpit) |
| Weather | Open-Meteo forecast API (daily min/max + weathercode), no key; location set once in Settings via Open-Meteo's geocoding search |
| Caching | Outbound ICS + weather fetches use Next's data cache with `revalidate: 900` (15 min) — refreshes are cheap and rate-limit friendly |
| Failure posture | Same as parent spec: context is allowed to fail, the app isn't. Unreachable ICS/weather → that half is omitted; the bar renders what it has; the API never 500s for upstream failures |
| Mock mode | `MOCK_AI=1` short-circuits all three upstreams: fixture events ("Coffee with Sam" 10:00, "Dinner with Alex" 19:00 within the requested window), fixture weather (18–24°, partly cloudy), geocode returns "Mock City"; `configured` reports true |
| Storage | Existing `settings` key-value table: `icsUrl` (string), `weatherLocation` (JSON `{lat, lon, label}`) — no new tables |

## 3. UX flows

### 3.1 Settings → Calendar section
- Paste field for the iCloud shared-calendar ICS URL (`webcal://` accepted and
  normalized to `https://`), **Save & test** button: server fetches + parses, reports
  event count found ("Connected — 12 events this week") or a clear failure; saved
  only on success. **Remove** clears it.
- Help text explains where to find the link (iCloud Calendar → share → public link).

### 3.2 Settings → Weather section
- City search box → **Set location**: server geocodes via Open-Meteo, stores the
  top match, echoes the label ("Weather location: Carlsbad, California"). **Remove**
  clears it.

### 3.3 Status bar (all tab screens)
- Slim fixed-height bar under the page top, e.g.: `⛅ 18–24° · 10:00 Coffee with
  Sam · 19:00 Dinner with Alex`, truncating gracefully on overflow.
- Unconfigured (neither source) → renders nothing. While loading → renders nothing
  (no skeleton; it appears when ready).
- Tapping the bar navigates to `/settings` (where the sources are managed).
- Data fetched client-side from `GET /api/context` on mount per tab layout load.

## 4. Architecture & API

```
StatusBar (client, in (tabs)/layout) ──► GET /api/context?from=ISO&to=ISO
                                            ├─ settings: icsUrl, weatherLocation
                                            ├─ fetch ICS (revalidate 900) → node-ical → windowEvents(from,to)
                                            ├─ fetch Open-Meteo forecast (revalidate 900) → summarize
                                            └─ { events[], weather|null, configured: {calendar, weather} }
Settings sections (client) ──► POST/DELETE /api/settings/calendar   {icsUrl}
                               POST/DELETE /api/settings/weather    {query}
```

- `GET /api/context` — validates `from`/`to` (ISO instants, `to` after `from`, span
  ≤ 7 days → else 400). Upstream failures degrade per §2; response shape:
  `{ events: [{title, start, end, allDay}], weather: {tempMin, tempMax, code, label} | null, configured: {...} }`.
  Events sorted by start, capped at 20.
- `POST /api/settings/calendar` — body `{icsUrl}`; validates scheme (`https`/`webcal`),
  fetches + parses before saving; 400 with reason on failure. `DELETE` removes the key.
- `POST /api/settings/weather` — body `{query}` (non-empty string ≤ 100 chars);
  geocodes, stores `{lat, lon, label}`, returns it; 404-style 400 ("No match") when
  geocoding finds nothing. `DELETE` removes the key.
- All new modules live in `lib/context/` (`events.ts`, `weather.ts`, `fixtures.ts`)
  and are pure where possible; no module-scope env reads (learned rule).

## 5. Error handling

| Failure | Behavior |
|---|---|
| ICS unreachable / unparsable at read time | `events: []`, `configured.calendar` stays true; bar shows weather half only |
| Weather API down | `weather: null`; bar shows events half only |
| Both halves empty but configured | Bar hidden (nothing useful to show) |
| Save & test with bad URL/feed | 400 with a human reason; nothing saved |
| Geocode no match | 400 "No match for that city." |
| Malformed bodies / params | 400 (learned rule) |
| `/api/context` upstream errors | Never 500s; degrades per row 1–2 |

## 6. Testing

- **Vitest (TDD):** `windowEvents` against fixture ICS strings (timed event in/out
  of window, all-day event, weekly RRULE expanding into the window, TZID handling);
  weather-code → label/emoji mapping; Open-Meteo response summarization; ISO
  param validation helper.
- **Playwright (`e2e/statusbar.spec.ts`** — alphabetically after `settings`, before
  `tabs`): with mock fixtures, the bar renders on /closet with the fixture event
  and temperature; tapping navigates to /settings; calendar Save & test succeeds in
  mock mode and shows the connected state; weather Set location stores "Mock City";
  Remove clears each.
- Done = full gate green.

## 7. Out of scope

- The AI stylist itself (M4) — it will reuse `lib/context`
- Two-way calendar write, multiple calendars, event detail views
- Forecast beyond today / hourly breakdowns; auto-located weather (no geolocation
  permission dance — typed city search only)
- Push/refresh of the bar beyond per-navigation fetch
