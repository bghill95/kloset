# Kloset

Personal virtual closet PWA — single user, passcode-gated, phone-first.

Photograph your clothes and the AI names, tags, and cuts them out into a
Pinterest-style masonry closet. The **Today** screen greets you with the
weather, your calendar, and a deterministic daily outfit picked from your
closet. Coming next: the Studio (outfit collages + photoreal AI try-on
renders of you), the Stylist (inspiration feed + occasion styling), and the
Lookbook (saved outfits + wear history).

**Status:** Phase 1 complete — identity, shell, Closet, Today. Studio,
Stylist, and Lookbook are styled placeholders (Phases 2–4 in
`docs/superpowers/plans/`).

## Stack

Next.js 16 App Router · React 19 · TypeScript · Tailwind v4 (token system in
`app/globals.css`, documented in `DESIGN.md`) · Neon Postgres via Drizzle ·
Vercel Blob · OpenAI (server-side only) · deployed on Vercel.

## Run it

```bash
cp .env.example .env.local   # fill in DATABASE_URL
npm install
npm run db:push              # push schema to your Postgres
MOCK_AI=1 npm run dev        # http://localhost:8000
```

`MOCK_AI=1` serves canned AI fixtures (no OpenAI/Blob calls) — the default
for development and all tests.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | dev server on :8000 |
| `npm test` | Vitest unit tests |
| `npm run test:e2e` | Playwright e2e (**wipes** settings/items/base_photos — never point `DATABASE_URL` at data you care about) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:push` | push Drizzle schema |

## Design system

`DESIGN.md` at the repo root is the source of truth: white canvas, one pink
CTA per screen, black ink for contrast, Great Vibes script strictly for the
wordmark / page titles / menu, Inter for everything else. UI code uses the
tokens in `app/globals.css` only — no ad-hoc colors or radii.
