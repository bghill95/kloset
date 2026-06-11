# Virtual Closet Styling App — Design Spec

**Date:** 2026-06-10
**Status:** Approved section-by-section in brainstorming; pending final user review
**Owner:** bghill01@outlook.com (sole user)

## 1. Purpose

A personal virtual closet app. The user catalogs their real clothes by photographing them, builds outfits by swiping through clothing rails around a center avatar, and generates photoreal AI renders of themselves wearing the selected items. An AI stylist suggests outfits using the closet, the weather, and the user's iCloud calendar events.

Dual goal: the project also serves as the user's sandbox for practicing professional Claude Code workflows (spec-first development, verification loops, agent orchestration — see `docs/research/2026-06-10-claude-code-workflows.md`).

## 2. Decisions summary

| Decision | Choice |
|---|---|
| Platform | Mobile-style web app (PWA), iPad-first |
| Try-on approach | Photoreal AI renders, triggered explicitly — never during swiping |
| Studio layout | "Rails right": avatar left, six swipeable category rails right |
| Categories | Hair, Hats, Tops, Jackets, Bottoms, Shoes (clothing categories in DB: top/bottom/jacket/shoes/hat; hair is a built-in static list) |
| Adding clothes | Photo + AI background removal + AI auto-tagging, user confirms |
| Suggestions | AI stylist (LLM over closet tags); occasion-, weather-, and calendar-aware |
| Calendar | Apple iCloud Calendar via shared ICS link (read-only) |
| Users / auth | Single user; passcode gate (no account system) |
| Hosting | Cloud (Approach 3): Next.js on Vercel free tier — must work when the user's PC is off |
| Storage | Neon Postgres (Drizzle ORM) + Vercel Blob for images |
| AI provider | Google Gemini for everything (renders, cutouts, tagging, stylist) — one API key |
| V1 extras | Lookbook (saved outfits), occasion & weather context, wear tracking, calendar-driven suggestions |

## 3. Product & UX

Five screens on a bottom tab bar.

### 3.1 Closet
- Thumbnail grid of background-removed garment cutouts; filter by category and color.
- **Add item flow:** camera/upload → AI cleanup + suggested tags → user confirms or edits → saved.
- Item detail: edit tags, view wear count, delete.

### 3.2 Studio (outfit builder)
- **Layout A — Rails right:** avatar occupies the left ~44% of the screen; six horizontally swipeable rails (Hair, Hats, Tops, Jackets, Bottoms, Shoes) stacked on the right, all visible at once.
- The avatar shows the primary base photo, or the most recent render.
- Tapping a rail thumbnail selects it (highlight on the rail). **Selection never triggers a render.** One selection max per category; tapping again deselects.
- **"✨ Render outfit"** button generates the photoreal image (10–20s progress state) and replaces the avatar.
- **"💾 Save to lookbook"** persists the render with its item selections.
- **"Re-render"** regenerates with the same selections (handles AI artifacts).
- Hairstyles: built-in static list (name, render description, preview thumbnail) plus default "keep my current hair" — hairstyles are not user-owned items.

### 3.3 Stylist (suggestions)
- Top strip: today's calendar events + weather forecast.
- Occasion picker (free text + presets like "casual Friday", "date night").
- Scrollable suggestion cards: cutout collage of the outfit + title + one-line reason referencing context (event, weather, occasion).
- **"Open in Studio"** preselects the suggested items in the Studio rails.
- Refresh button fetches a new batch; last batch is cached.

### 3.4 Lookbook
- Saved renders, newest first; each shows its constituent items.
- **"Wore this"** logs a dated wear for the outfit; per-item wear stats derive from outfit→item joins.
- Stats view: most-worn and least-worn items.

### 3.5 Settings
- Passcode management.
- Avatar base photos: upload 1–3 full-body photos, mark one primary.
- iCloud calendar ICS link (paste once) + "test connection" button.
- Weather location.

### 3.6 First-run flow
Set passcode → upload base photo(s) → optionally paste ICS link → optionally set weather location → land in empty Closet.

## 4. Architecture

```
iPad Safari PWA ("Add to Home Screen", no secrets on device)
        │ HTTPS + signed httpOnly session cookie
        ▼
Vercel — Next.js App Router (TypeScript, Tailwind)
  • UI + API routes; middleware enforces passcode session on all routes
  • Secrets: GEMINI_API_KEY as env var; passcode hash + ICS URL in the
    settings table (set via the app UI, server-side only, never sent to client)
  • Rate limit + configurable daily cap on /api/render
        │
        ├── Neon Postgres (Drizzle ORM) — closet, outfits, wears, settings
        ├── Vercel Blob — garment originals + cutouts, base photos, renders
        │
        └── Server-side external calls only:
              • Gemini API — renders, cutouts, tagging, stylist
              • iCloud ICS feed — read-only events
              • Open-Meteo — weather, free, no key
```

- **Auth:** passcode → server verifies against hash → signed httpOnly cookie. Exponential backoff on failed attempts.
- **PWA:** manifest + iOS meta tags for standalone home-screen launch. Offline support is limited to an offline notice (the app is online-dependent by nature).
- **Render function:** extended `maxDuration` (60s) to accommodate slow generations.
- **Client-side image handling:** resize/compress photos to ~1500px longest edge before upload.

## 5. Data model

Five tables (Drizzle/Postgres):

- **items** — id, name, category (`top|bottom|jacket|shoes|hat`), colors[], styleTags[], imageUrl (cutout), originalImageUrl, createdAt
- **outfits** — id, renderImageUrl, itemIds[], hairstyleId (nullable), occasion (nullable), createdAt
- **wears** — id, outfitId, wornOn (date)
- **basePhotos** — id, imageUrl, isPrimary
- **settings** — key-value rows: passcodeHash, icsUrl, weatherLocation (lat/lon + label)

Hairstyles: static config in code (id, name, renderDescription, previewImage) — not a table.

## 6. AI pipelines (all Gemini, all server-side)

### 6.1 Garment ingestion (~$0.04/item)
1. Upload original → Blob.
2. Gemini image model → background-removed cutout → Blob.
3. Gemini vision → suggested name, category, colors, style tags (formality, season, warmth).
4. User confirms/edits → item saved.
- **Fallback:** cutout or tagging failure → keep original photo, manual tags; ingestion is never blocked by AI failure.

### 6.2 Try-on render (~$0.04–0.08/render)
- Input: primary base photo + selected cutouts (max one per category) + hairstyle render description.
- Prompt contract: preserve identity/face, dress the person in *exactly* these garments, full body, clean studio background.
- Output stored in Blob; persisted as an outfit only on "Save to lookbook".
- Guards: selection validation, rate limit, daily cap, retry button.

### 6.3 AI stylist (~$0.01/batch of 5–8)
- Prompt assembles: full closet inventory (ids + tags — fits in one prompt at single-user scale), today's events (parsed ICS), today's forecast, optional occasion, recent wear history (bias toward less-recently-worn).
- Output: structured JSON `[{itemIds, hairstyleId?, title, reason}]`.
- **Hallucination guard:** server validates every itemId against the DB; invalid suggestions are dropped.
- Cards reuse cutout images — no image generation while browsing.

## 7. Error handling

Theme: **AI is allowed to fail; the app isn't.**

| Failure | Behavior |
|---|---|
| Gemini cutout/tagging | Fall back to original photo + manual tags |
| Gemini render error/timeout | Clear error + retry; nothing persisted |
| Gemini stylist error | Show cached last batch + "couldn't refresh" note |
| ICS unreachable/expired | Stylist proceeds without calendar; warning chip; Settings "test connection" |
| Weather API down | Stylist proceeds without weather |
| Oversized upload | Client-side resize/compress before upload |
| Render abuse | Rate limit + daily cap; selections validated server-side |
| Passcode brute force | Exponential backoff |
| DB/Blob errors | Error boundaries; toast + retry |

## 8. Testing & verification

- **Mock-AI mode** (`MOCK_AI=1`): canned cutouts, renders, and stylist responses — development and tests run free, fast, deterministic.
- **Vitest** unit tests: ICS parsing, stylist JSON validation + ID guard, wear-stat derivation, selection rules.
- **Playwright** e2e per flow (add garment, build & render, suggestions, save & wear) against the dev server in mock mode.
- **Definition of done per task:** typecheck + lint + unit tests + relevant Playwright spec green before claiming completion.
- Real-Gemini smoke tests manually at milestone boundaries only.

## 9. Dev workflow & milestones

- Git + GitHub from day one; Vercel auto-deploys `main`; preview deployment per branch (verifiable on the actual iPad pre-merge).
- CLAUDE.md created at project start; every Claude mistake becomes a rule. Repeated chores become `.claude/commands/` slash commands (first: commit-push-PR).
- Subagents for research/review; parallel agents only for file-disjoint tasks.

Build order (each milestone independently verifiable on the iPad):
1. **M1 — Walking skeleton:** Next.js app, passcode gate, tab shell, DB/Blob wired, deployed to Vercel.
2. **M2 — Closet:** ingestion pipeline (mock + real), grid, item detail.
3. **M3 — Studio:** rails UI, selection logic, render pipeline, re-render.
4. **M4 — Stylist:** ICS + weather integration, stylist pipeline, suggestion cards, open-in-Studio.
5. **M5 — Lookbook:** save renders, wear tracking, stats.

## 10. Out of scope (v1)

- Multi-user accounts, sharing, or social features
- Native app / app store distribution (PWA only)
- Importing clothes from store URLs
- 3D avatar or AR try-on
- Outfit calendar planning (assigning outfits to future dates)
- Push notifications
- Two-way calendar integration (write events)
