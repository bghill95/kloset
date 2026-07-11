# Kloset

Personal virtual closet PWA (Kloset): catalog clothes by photo, Today screen
with weather/calendar-aware outfit, build outfits on AI photoreal renders,
AI stylist suggestions. Single user, passcode-gated.

- Spec: docs/superpowers/specs/2026-06-10-virtual-closet-design.md
- Current plan: docs/superpowers/plans/2026-07-11-kloset-p1-identity-shell-closet-today.md

## Stack

Next.js App Router (TS, Tailwind v4) on Vercel · Neon Postgres via Drizzle ·
Vercel Blob · OpenAI API (all AI; superseded Gemini per the M2 spec) · jose sessions + bcryptjs passcode.
Dev/tests always run with MOCK_AI=1 (mocks ALL external services — OpenAI, Blob;
canned fixtures, no network calls).
Currently resolved to Next 16 / React 19 / TS 6 (see package-lock.json).

## Commands

- `npm run dev` — dev server on :8000
- `npm test` — Vitest unit tests (patterns in vitest.config.ts: lib/**/*.test.ts and lib/**/*.spec.ts)
- `npm run test:e2e` — Playwright (creates + wipes the settings, items and base_photos tables on each run!)
- `npm run typecheck` — tsc --noEmit
- `npm run db:push` — push Drizzle schema to Neon

## Rules

- TDD for logic: failing test first, then implement. UI flows get Playwright specs.
- A task is done only when `npm test && npm run typecheck && npm run test:e2e`
  are all green — run them, show output, then claim done.
- All AI calls go through server routes; never expose keys client-side.
  From M2 on, develop and test against MOCK_AI=1.
- `.env.local` is never committed. New env vars also go in `.env.example`.
- e2e wipes the settings, items and base_photos tables — never point DATABASE_URL at data
  you care about when running tests.
- UI work follows DESIGN.md (root) — tokens only, no ad-hoc colors/radii.

## Learned rules

(Append a rule here every time Claude makes a mistake in this repo.)

- Never read env vars or construct external clients at module scope — it crashes
  `next build` when the var is missing. Use a lazy getter (see lib/db/client.ts).
- Always wrap `await req.json()` in try/catch and return 400 — malformed bodies
  otherwise 500 (see app/api/auth/*/route.ts).
- Next 16 uses the `proxy.ts` convention (renamed from `middleware.ts` in M2);
  the exported function is `proxy`, semantics unchanged.
- Next 16 injects a route announcer with role="alert" — Playwright must use
  precise locators (e.g., `p[role='alert']`), not `getByRole("alert")`.
- e2e spec files run alphabetically with a single DB wipe up front: auth-flow
  creates the passcode that tabs.spec relies on. Name new spec files accordingly.
- Don't commit `tsconfig.tsbuildinfo` (build cache — gitignored).
- Next dev blocks its own dev assets for origins not in `allowedDevOrigins`
  (next.config.ts). Symptom: pages load via a LAN/tailnet IP but never hydrate,
  so forms fall back to native GET submits (`GET /login?` in the dev log).
- `npm run db:push` always re-emits `ALTER ... SET DEFAULT '{}'::text[]` for
  text-array columns — a drizzle-kit diffing quirk, not schema drift. The
  statements are no-ops; don't "fix" the schema in response.
