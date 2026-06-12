# Avatar Guided Capture — Design Spec

**Date:** 2026-06-11
**Status:** Approved under the user's standing build-to-completion directive
(2026-06-11); design decisions derive from the 2026-06-11 brainstorm (slice 2 of 3)
and the parent spec.
**Parent spec:** `2026-06-10-virtual-closet-design.md` (§3.5 avatar base photos,
§5 basePhotos table). Slice 1 (`2026-06-11-m2-closet-capture-design.md`) is merged
context: this slice reuses its camera/downscale/storage plumbing and mock conventions.

## 1. Purpose

The user captures 1–3 full-body "base photos" that M3's photoreal try-on renders
will dress. Capture must be doable alone: set the device down, step back, and fit
yourself into an on-screen frame — consistency of framing is what makes renders
comparable across outfits. No AI runs in this slice; it is capture + storage +
management only.

## 2. Decisions

| Decision | Choice |
|---|---|
| Capture UX | Full-screen `/avatar-capture` route: live viewfinder, full-body dashed outline with head/feet markers, hint text ("Stand so your whole body fills the outline") |
| Self-timer | "10s timer" button → large countdown numerals overlaid on the viewfinder → auto-snap; tap anywhere cancels. "Take photo now" immediate shutter also available (and is what e2e uses) |
| Camera | Front camera default (`facingMode: "user"` — you watch yourself fit the frame); flip button toggles to rear for higher quality when someone else shoots |
| Preview gate | After the snap: full preview with **Use photo** / **Retake** — nothing uploads until accepted |
| Photo limit | Max 3 base photos; the API rejects a 4th with 409 |
| Primary semantics | First photo auto-becomes primary; "Make primary" demotes all others; deleting the primary promotes the oldest remaining photo |
| AI | None in this slice. Renders consume these photos in M3 |
| Mock mode | `MOCK_AI=1` short-circuits Blob upload → `/fixtures/base-photo.svg` (MOCK_AI now means "mock all external services", not just AI — documented in CLAUDE.md) |
| Resize | Client-side downscale ≤1500px JPEG before upload (reuses `downscalePhoto`) |
| Camera plumbing | Extract a shared `useCameraStream` hook from CaptureScreen (same lifecycle: cancelled flag, track cleanup, error fallback); both capture screens consume it |

## 3. UX flows

### 3.1 Settings → Avatar section
- The Settings placeholder page becomes a sectioned page; this slice implements the
  **Avatar** section (passcode management stays a placeholder; calendar/weather
  sections arrive in slice 3).
- Empty state: explainer ("Base photos are what outfits get rendered onto") +
  "📷 Capture base photo" button → `/avatar-capture`.
- With photos: grid of 1–3 thumbnails; primary badge on one; per-photo actions
  **Make primary** / **Delete** (confirm dialog); capture button hidden at 3 with
  a "3 of 3 — delete one to retake" note.

### 3.2 Capture screen (`/avatar-capture`)
- Live viewfinder (front camera default, flip toggle), full-body outline overlay,
  hint text. Camera denied/unavailable → library file-picker fallback (same
  degradation contract as the closet scanner).
- Controls: **10s timer**, **Take photo now**, **🖼️ Library**, **flip camera**, **Cancel**
  (back to Settings).
- Timer: large countdown numerals (10…1) over the viewfinder; tap anywhere cancels
  back to idle controls; snap fires at 0.
- After snap or library pick: preview phase — image fills the screen with
  **Use photo** (uploads, then returns to Settings) / **Retake**.
- Upload failure: error message with retry (photo kept in memory); 413 maps to a
  no-retry "too large" message (same pattern as ScanFlow).

## 4. Data model

`basePhotos` table (parent spec §5):

| column | type | notes |
|---|---|---|
| id | uuid pk | `defaultRandom()` |
| imageUrl | text, not null | Blob URL (or fixture path in mock mode) |
| isPrimary | boolean, not null, default false | exactly one true once any photos exist |
| createdAt | timestamp, default now | promotion order after primary deletion |

e2e global-setup creates-if-missing and wipes `base_photos` alongside the others.

## 5. API

| Route | Behavior |
|---|---|
| `POST /api/base-photos` | Multipart photo → Blob (or fixture) → insert row. Auto-primary if it is the first photo. 409 when 3 already exist. 400 malformed / missing photo; 413 over 10 MB. Returns 201 `{ photo }`. |
| `PATCH /api/base-photos/[id]` | Body `{ isPrimary: true }` only. Demotes all others, promotes this one. 404 unknown/invalid id; 400 anything else. |
| `DELETE /api/base-photos/[id]` | Deletes row + Blob image (best-effort, https-only — fixture paths skipped). If it was primary, promotes the oldest remaining photo. 404 unknown. |

Settings page reads the table directly via Drizzle (no GET route), matching the
closet grid pattern. The neon-http driver has no multi-statement transactions;
primary demote/promote runs as sequential statements — acceptable at single-user
scale, noted in code.

## 6. Error handling

| Failure | Behavior |
|---|---|
| Camera denied/unavailable | Library picker fallback; capture always possible |
| Upload network failure | Photo kept in memory; retry without re-shoot |
| Oversized upload | Client resize + server 413 → no-retry "too large" message |
| 4th photo attempt | 409 surfaced as "3 of 3" notice (UI also hides the button) |
| Blob delete failure | Row deletion wins; orphaned blob accepted (existing pattern) |
| Malformed bodies | 400 (learned rule) |

## 7. Testing

- **Vitest (TDD):** primary-promotion helper (`nextPrimary(photos, deletedId)`
  pure logic), base-photo patch validation.
- **Playwright (`e2e/settings.spec.ts`** — alphabetically after `closet`, before
  `tabs`, per the learned ordering rule): empty avatar section → capture via
  "Take photo now" with the fake camera → photo appears with primary badge →
  second photo via library fixture → "Make primary" flips the badge → countdown
  overlay appears and cancels cleanly → delete both (confirm dialogs), section
  returns to empty state.
- **Refactor guard:** the closet e2e suite must stay green after the
  `useCameraStream` extraction refactors CaptureScreen.
- Done = `npm test && npm run typecheck && npm run test:e2e` green.

## 8. Out of scope

- Any AI processing of base photos (M3 consumes them)
- Pose detection / auto-capture when the body fills the frame
- Cropping or editing tools; audio countdown beeps
- Passcode management and calendar/weather Settings sections (slice 3 for the
  latter)
