# M2 — Closet: Guided Capture & Catalog — Design Spec

**Date:** 2026-06-11
**Status:** Approved section-by-section in brainstorming; pending final user review
**Parent spec:** `2026-06-10-virtual-closet-design.md` (§3.1, §5, §6.1, §9 M2). This spec
details M2 and **supersedes the parent's AI-provider decision** (see §2).

## 1. Purpose

First of three feature slices agreed on 2026-06-11 (closet capture → avatar guided
capture → calendar/weather status bar). The user catalogs real clothes by scanning
them with the camera: a guided capture screen shows a garment outline matched to the
chosen category, AI removes the background and suggests tags, the user confirms, and
items land in a filterable closet grid with an editable detail view.

## 2. Decisions

| Decision | Choice |
|---|---|
| Capture UX | In-app live viewfinder (`getUserMedia`), not the native camera — required for the outline overlay |
| Outline | Category chosen first (Top / Bottom / Jacket / Shoes / Hat); dashed flat-lay outline swaps per category (tee / pants / jacket / shoes / cap SVGs) |
| Categorization | User-selected category is authoritative; AI verifies and warns on mismatch, never overrides |
| Ingest model | Synchronous wait-then-confirm (~5–15s progress state); nothing persists until the user confirms |
| AI provider | **OpenAI for everything — supersedes "Gemini for everything" in the parent spec.** Cutouts via image edit (transparent background), tagging via vision with structured JSON. M3 renders and M4 stylist default to OpenAI unless their brainstorms force a revisit. |
| Local models | Considered (user preference): viable only for background removal; tagging/renders/stylist have no practical local path on iPad Safari or Vercel. Rejected in favor of a single vendor. |
| Mock mode | `MOCK_AI=1` short-circuits **both OpenAI and Blob**; fixture URLs serve static files from `/public/fixtures/` |
| Library fallback | Picking an existing photo from the library is always available alongside the camera |

## 3. UX flows

### 3.1 Capture screen
- Entry: "📷 Scan item" tile in the Closet grid.
- Category chips across the top; selecting one swaps the dashed outline overlay and
  hint text ("Lay the top flat inside the outline").
- Full-screen live viewfinder, shutter button, Library picker, Cancel.
- Camera permission denied or `getUserMedia` unavailable → screen degrades to the
  Library picker path; adding items always works.

### 3.2 Confirm sheet
- Opens after the snap with a progress state while ingestion runs.
- Shows: cutout preview (original photo if cutout failed), AI-suggested editable name,
  category chip (pre-set from capture, editable), editable color and style-tag chips,
  "+ add tag".
- Mismatch warning chip when AI's detected category differs from the user's choice;
  switching the category chip clears the warning.
- Actions: **Save** (returns to grid), **Save & scan another** (returns to the
  viewfinder with the same category preselected), **Retake**.
- AI failure never blocks saving: original photo + manual tags is always a valid path.

### 3.3 Closet grid
- Server component reading Drizzle directly; filter chips for category and color via
  `?category=&color=` search params.
- Grid of cutout thumbnails plus the "Scan item" tile; replaces the M1 placeholder page.

### 3.4 Item detail
- Tap an item → larger cutout, edit name/category/colors/tags, delete (with confirm).
- Wear counts arrive with Lookbook (M5), not here.

## 4. Architecture

```
CameraCapture (client)                      Server
  category chips + SVG outline    ──────►  POST /api/ingest
  getUserMedia viewfinder                    1. original photo → Vercel Blob
  snap → canvas → resize ~1500px             2. OpenAI image edit → transparent-bg cutout → Blob
                                             3. OpenAI vision → name/colors/styleTags/detectedCategory
ConfirmSheet (client)            ◄──────     returns { originalUrl, cutoutUrl, suggestion, warning? }
  edit fields → Save             ──────►  POST /api/items  → items table
                                          PATCH/DELETE /api/items/[id]  (detail view)
Closet grid (server component)   ◄──────  reads items via Drizzle directly (no GET route)
```

- `/api/ingest` is pure processing — it writes nothing to the DB, so abandoning the
  confirm sheet leaves no junk rows. Extended `maxDuration: 60`.
- OpenAI client in `lib/ai/` behind a lazy getter (learned rule: no module-scope
  clients or env reads).
- Outlines are five inline SVG shapes; pure presentation.
- All routes sit behind the existing passcode middleware.
- New env vars: `OPENAI_API_KEY`, `BLOB_READ_WRITE_TOKEN`, `MOCK_AI` — documented in
  `.env.example`, never exposed client-side. Implementation also updates the CLAUDE.md
  stack line (Gemini → OpenAI).

## 5. Data model

One new table, `items` (as sketched in the parent spec §5):

| column | type | notes |
|---|---|---|
| id | uuid pk | `defaultRandom()` |
| name | text, not null | e.g. "Light blue oxford shirt" |
| category | text, not null | `top \| bottom \| jacket \| shoes \| hat` |
| colors | text[], not null, default `{}` | grid filter |
| styleTags | text[], not null, default `{}` | feeds the M4 stylist (formality, season, warmth) |
| imageUrl | text, not null | cutout in Blob; original if cutout failed |
| originalImageUrl | text, not null | always kept |
| createdAt | timestamp, default now | |

## 6. API

| Route | Behavior |
|---|---|
| `POST /api/ingest` | Multipart photo + category → `{ originalUrl, cutoutUrl \| null, suggestion \| null, warning? }`. Never 500s on AI failure — partial results instead. Server-side body-size cap (413 above 10 MB). |
| `POST /api/items` | Saves the confirmed item; validates category enum and field shapes. |
| `PATCH /api/items/[id]` | Partial update of name/category/colors/styleTags. |
| `DELETE /api/items/[id]` | Deletes the row **and** its Blob images (no orphan storage). |

All `await req.json()` / form parsing wrapped with 400 on malformed bodies (learned rule).

## 7. AI pipeline

1. Client resizes the snap to ~1500px longest edge before upload.
2. Cutout: OpenAI image edit, prompt contract "isolate the garment on a transparent
   background", PNG output → Blob.
3. Tagging: OpenAI vision with structured JSON output —
   `{ name, colors, styleTags, detectedCategory }` — given the user's chosen category.
4. Server validates the response (category in enum, arrays of strings, length caps);
   invalid output is treated as tagging failure, not surfaced raw.
5. `MOCK_AI=1`: fixture cutout + canned JSON from `/public/fixtures/`, no OpenAI, no
   Blob. Real OpenAI + Blob are smoke-tested manually at the milestone boundary.
6. Cost estimate: ~$0.03–0.08 per scanned item (one image edit + one vision call).

## 8. Error handling

Theme unchanged from the parent spec: **AI is allowed to fail; the app isn't.**

| Failure | Behavior |
|---|---|
| Camera permission denied / unavailable | Library file-picker fallback |
| Cutout fails | Confirm sheet uses original photo; item still saves |
| Tagging fails | Manual fields; auto-name from category ("New top") |
| AI category ≠ user category | Warning chip; user's choice stands |
| Network error during ingest | Snap kept in client memory; retry without re-shooting |
| Oversized upload | Client resize + server 413 cap |
| Malformed request body | 400 |
| Blob/DB error | Error state + retry; nothing partially saved |

## 9. Testing

- **Vitest (TDD, pure logic in `lib/`):** suggestion validator/sanitizer, auto-name
  derivation, filter logic.
- **Playwright (`MOCK_AI=1`):** `closet.spec.ts` — named to run after
  `auth-flow.spec.ts` alphabetically (learned rule). Covers: scan entry → category
  pick → photo via Library path (`setInputFiles` fixture, since CI has no camera) →
  confirm sheet edit → save → item in grid → detail edit → delete. Viewfinder render
  test uses Chromium fake-camera flags.
- **e2e global-setup** wipes `items` alongside `settings`.
- Definition of done per task: `npm test && npm run typecheck && npm run test:e2e` green.

## 10. Out of scope (this slice)

- Avatar guided capture (slice 2) and calendar/weather status bar (slice 3)
- Batch/background ingestion ("scan now, review later") — revisit if bulk cataloging
  feels slow in practice
- Live auto-detect outlines (real-time AI on camera frames)
- Wear tracking and stats (M5)
- AI overriding the user's category choice

## 11. Follow-on slices agreed in this brainstorm

1. **Avatar guided capture** (pre-M3): set-the-device-down flow with a framing guide
   so base photos are consistent for renders; reuses this slice's viewfinder component.
2. **Calendar + weather + status bar** (M4 material): iCloud shared-ICS link (a PWA
   cannot read the on-device iOS Calendar) + Open-Meteo weather; the user wants a
   persistent status bar at the top of the page — its placement and behavior get
   decided in that slice's brainstorm.
