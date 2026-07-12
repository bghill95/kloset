# Kloset P3 — Stylist + Wears Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** AI Stylist tab (inspiration feed + occasion prompt), wear logging (`wears` table + "Wearing this today" everywhere), Lookbook wear history/detail/delete, and live wear actions on Today.

**Architecture:** One `POST /api/stylist` route sends a compact text inventory of the closet to the existing OpenAI chat model (strict JSON schema) and returns validated outfit combos; MOCK_AI returns deterministic combos composed from real DB items. A `wears` table (plain uuid refs, no FK — house pattern) records worn dates; unsaved combos are auto-saved as `outfits` rows (new `source` column) on first action. A shared `OutfitActions` client component (Save / Wearing this today / Open in Studio) is mounted on Stylist cards, Today's pick, and the new Lookbook detail page.

**Tech Stack:** Next.js 16 App Router, Drizzle 0.45 + Neon, OpenAI chat completions (`gpt-4.1-mini`, same as ingest), Vitest, Playwright.

## Global Constraints

- Dev/tests always run `MOCK_AI=1`; no network calls in tests.
- Done bar per repo CLAUDE.md: `npm test && npm run typecheck && npm run test:e2e` all green — run them, show output, then claim done.
- All AI calls go through server routes; never expose keys client-side.
- Always wrap `await req.json()` in try/catch → 400. No module-scope env reads or clients.
- UI uses DESIGN.md tokens only (`bg-card`, `text-ink`, `text-mute`, `bg-pink`, `text-error`, `rounded-card`, `font-script`). Pink is never decorative; selected states use ink; **one pink ACTION pill per screen**.
- e2e spec files run alphabetically with a single DB wipe up front; Playwright retries must stay 0 (serial suites re-seed). New spec order: … `studio` < `stylist` < `today` < `wears`.
- Playwright: use precise locators (`p[role='alert']` issue — Next 16 injects a route announcer).
- Work on branch `kloset-p3` off `main` (50bd6ed). Commit after every task.
- `npm run db:push` re-emits no-op `SET DEFAULT '{}'::text[]` statements for text-array columns — ignore them (learned rule).

---

### Task 1: Schema — `wears` table + `outfits.source`

**Files:**
- Modify: `lib/db/schema.ts`
- Modify: `e2e/global-setup.ts`

**Interfaces:**
- Produces: `wears` table export `{ id: uuid, outfitId: uuid, wornOn: date-string "YYYY-MM-DD" }` with `UNIQUE (outfit_id, worn_on)`; `outfits.source` text enum `"studio" | "stylist" | "today"` default `"studio"`. Drizzle `date()` columns read/write plain `"YYYY-MM-DD"` strings.

- [ ] **Step 1: Create the branch**

```bash
git checkout -b kloset-p3
```

- [ ] **Step 2: Extend the schema**

In `lib/db/schema.ts`, change the pg-core import and the `outfits` table, and append `wears`:

```ts
import { sql } from "drizzle-orm";
import { boolean, date, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
```

Add to `outfits` after `renderUrl`:

```ts
  source: text("source", { enum: ["studio", "stylist", "today"] })
    .notNull()
    .default("studio"),
```

Append at the end of the file:

```ts
export const wears = pgTable(
  "wears",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Plain id, no FK (house pattern) — DELETE /api/outfits/[id] sweeps its wears.
    outfitId: uuid("outfit_id").notNull(),
    // date column ⇒ "YYYY-MM-DD" strings, matching the client's local dateKey.
    wornOn: date("worn_on").notNull(),
  },
  // Same outfit + same day is a toggle, never a duplicate.
  (t) => [unique().on(t.outfitId, t.wornOn)],
);
```

- [ ] **Step 3: Sync the e2e bootstrap**

In `e2e/global-setup.ts`: add `source` to the outfits `CREATE TABLE` (after `render_url text`):

```sql
    source text NOT NULL DEFAULT 'studio',
```

Add after the outfits block (keep the `-- Keep in sync with lib/db/schema.ts` comment style):

```ts
  // Keep in sync with lib/db/schema.ts
  await sql`CREATE TABLE IF NOT EXISTS wears (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    outfit_id uuid NOT NULL,
    worn_on date NOT NULL,
    UNIQUE (outfit_id, worn_on)
  )`;
```

And add to the wipe list at the bottom:

```ts
  await sql`DELETE FROM wears`;
```

- [ ] **Step 4: Push the schema**

Run: `npm run db:push`
Expected: creates `wears`, adds `outfits.source` (plus the known no-op `SET DEFAULT '{}'::text[]` noise — ignore).

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add lib/db/schema.ts e2e/global-setup.ts
git commit -m "feat(p3): wears table + outfits.source column"
```

---

### Task 2: `outfits.source` validation + DELETE /api/outfits/[id]

**Files:**
- Modify: `lib/outfits/validation.ts`
- Modify: `lib/outfits/validation.test.ts` (create if absent — vitest picks up `lib/**/*.test.ts`)
- Create: `app/api/outfits/[id]/route.ts`

**Interfaces:**
- Consumes: `outfits`, `wears` from Task 1; `Result`, `UUID_RE` from `@/lib/closet/item-validation`; `deleteImages` from `@/lib/storage/blob`.
- Produces: `export const OUTFIT_SOURCES = ["studio", "stylist", "today"] as const`, `export type OutfitSource`, `NewOutfit` gains `source: OutfitSource`; `DELETE /api/outfits/:id` → `{ ok: true }` or 404. The existing `POST /api/outfits` route needs **no change** — it inserts `parsed.value` wholesale, which now carries `source`.

- [ ] **Step 1: Write the failing tests**

Append to `lib/outfits/validation.test.ts` (create the file with the imports if it doesn't exist):

```ts
import { describe, expect, it } from "vitest";
import { validateNewOutfit } from "./validation";

const UUID = "6f1c2ad0-0000-4000-8000-000000000001";

describe("validateNewOutfit source", () => {
  const base = { name: "Look", itemIds: [UUID], renderUrl: null };

  it("defaults source to studio", () => {
    const r = validateNewOutfit(base);
    expect(r.ok && r.value.source).toBe("studio");
  });

  it("accepts stylist and today", () => {
    for (const source of ["stylist", "today"]) {
      const r = validateNewOutfit({ ...base, source });
      expect(r.ok && r.value.source).toBe(source);
    }
  });

  it("rejects unknown sources", () => {
    const r = validateNewOutfit({ ...base, source: "closet" });
    expect(r.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run lib/outfits/validation.test.ts`
Expected: FAIL — `value.source` is `undefined` / TS error on unknown property.

- [ ] **Step 3: Implement**

In `lib/outfits/validation.ts`:

```ts
export const OUTFIT_SOURCES = ["studio", "stylist", "today"] as const;
export type OutfitSource = (typeof OUTFIT_SOURCES)[number];

export type NewOutfit = {
  name: string;
  itemIds: string[];
  renderUrl: string | null;
  source: OutfitSource;
};
```

In `validateNewOutfit`, after the `renderUrl` check and before the return:

```ts
  const source = (o.source ?? "studio") as string;
  if (!(OUTFIT_SOURCES as readonly string[]).includes(source)) {
    return { ok: false, error: "Invalid source." };
  }
```

And in the returned value: `source: source as OutfitSource,`

- [ ] **Step 4: Run tests**

Run: `npx vitest run lib/outfits/validation.test.ts`
Expected: PASS.

- [ ] **Step 5: Create the DELETE route**

Create `app/api/outfits/[id]/route.ts`:

```ts
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { UUID_RE } from "@/lib/closet/item-validation";
import { getDb } from "@/lib/db/client";
import { outfits, wears } from "@/lib/db/schema";
import { deleteImages } from "@/lib/storage/blob";

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  const db = getDb();
  const [gone] = await db.delete(outfits).where(eq(outfits.id, id)).returning();
  if (!gone) return NextResponse.json({ error: "Not found." }, { status: 404 });
  // Orphan cleanup: wears reference outfits without an FK.
  await db.delete(wears).where(eq(wears.outfitId, id));
  await deleteImages([gone.renderUrl]);
  return NextResponse.json({ ok: true });
}
```

(`deleteImages` already skips non-`https://` fixture URLs and swallows Blob failures.)

- [ ] **Step 6: Full unit suite + typecheck**

Run: `npm test && npm run typecheck`
Expected: green.

- [ ] **Step 7: Commit**

```bash
git add lib/outfits/validation.ts lib/outfits/validation.test.ts "app/api/outfits/[id]/route.ts"
git commit -m "feat(p3): outfit source field + DELETE /api/outfits/[id]"
```

---

### Task 3: Wear validation + /api/wears (toggle POST, GET by day)

**Files:**
- Create: `lib/wears/validation.ts`
- Create: `lib/wears/validation.test.ts`
- Create: `app/api/wears/route.ts`

**Interfaces:**
- Consumes: `Result`, `UUID_RE` from `@/lib/closet/item-validation`; `wears`, `outfits` from schema.
- Produces: `export const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/`; `validateNewWear(raw): Result<{ outfitId: string; wornOn: string }>`; `POST /api/wears {outfitId, wornOn}` → 200 `{ worn: boolean }` (toggle; 404 unknown outfit); `GET /api/wears?on=YYYY-MM-DD` → 200 `{ wears: [{ outfitId, wornOn, itemIds }] }` (orphaned wears filtered out).

- [ ] **Step 1: Write the failing tests**

Create `lib/wears/validation.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { validateNewWear } from "./validation";

const UUID = "6f1c2ad0-0000-4000-8000-000000000001";

describe("validateNewWear", () => {
  it("accepts a uuid + date key", () => {
    const r = validateNewWear({ outfitId: UUID, wornOn: "2026-07-11" });
    expect(r.ok && r.value).toEqual({ outfitId: UUID, wornOn: "2026-07-11" });
  });

  it("rejects a non-uuid outfitId", () => {
    expect(validateNewWear({ outfitId: "nope", wornOn: "2026-07-11" }).ok).toBe(false);
  });

  it("rejects malformed dates", () => {
    for (const wornOn of ["2026-7-1", "July 11", "2026-07-11T00:00:00Z", 20260711]) {
      expect(validateNewWear({ outfitId: UUID, wornOn }).ok).toBe(false);
    }
  });

  it("rejects non-objects", () => {
    expect(validateNewWear(null).ok).toBe(false);
    expect(validateNewWear("x").ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run lib/wears/validation.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement validation**

Create `lib/wears/validation.ts`:

```ts
import { type Result, UUID_RE } from "@/lib/closet/item-validation";

export const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

export type NewWear = { outfitId: string; wornOn: string };

export function validateNewWear(raw: unknown): Result<NewWear> {
  if (typeof raw !== "object" || raw === null) {
    return { ok: false, error: "Body must be an object." };
  }
  const o = raw as Record<string, unknown>;
  if (typeof o.outfitId !== "string" || !UUID_RE.test(o.outfitId)) {
    return { ok: false, error: "outfitId must be an outfit UUID." };
  }
  if (typeof o.wornOn !== "string" || !DATE_KEY_RE.test(o.wornOn)) {
    return { ok: false, error: "wornOn must be a YYYY-MM-DD date." };
  }
  return { ok: true, value: { outfitId: o.outfitId, wornOn: o.wornOn } };
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run lib/wears/validation.test.ts`
Expected: PASS.

- [ ] **Step 5: Create the route**

Create `app/api/wears/route.ts`:

```ts
import { and, eq, inArray } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { outfits, wears } from "@/lib/db/schema";
import { DATE_KEY_RE, validateNewWear } from "@/lib/wears/validation";

// Toggle: logging the same outfit for the same day twice un-logs it.
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const parsed = validateNewWear(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const { outfitId, wornOn } = parsed.value;
  const db = getDb();
  const [outfit] = await db
    .select({ id: outfits.id })
    .from(outfits)
    .where(eq(outfits.id, outfitId));
  if (!outfit) {
    return NextResponse.json({ error: "Outfit not found." }, { status: 404 });
  }
  const removed = await db
    .delete(wears)
    .where(and(eq(wears.outfitId, outfitId), eq(wears.wornOn, wornOn)))
    .returning({ id: wears.id });
  if (removed.length > 0) return NextResponse.json({ worn: false });
  await db.insert(wears).values({ outfitId, wornOn });
  return NextResponse.json({ worn: true });
}

// GET /api/wears?on=YYYY-MM-DD → that day's wears with their outfits' itemIds,
// so Today can match its pick against what's already logged.
export async function GET(req: NextRequest) {
  const on = req.nextUrl.searchParams.get("on");
  if (!on || !DATE_KEY_RE.test(on)) {
    return NextResponse.json({ error: "on must be a YYYY-MM-DD date." }, { status: 400 });
  }
  const db = getDb();
  const rows = await db.select().from(wears).where(eq(wears.wornOn, on));
  const outfitRows = rows.length
    ? await db
        .select({ id: outfits.id, itemIds: outfits.itemIds })
        .from(outfits)
        .where(inArray(outfits.id, rows.map((w) => w.outfitId)))
    : [];
  const byId = new Map(outfitRows.map((o) => [o.id, o.itemIds]));
  return NextResponse.json({
    wears: rows.flatMap((w) => {
      const itemIds = byId.get(w.outfitId);
      return itemIds ? [{ outfitId: w.outfitId, wornOn: w.wornOn, itemIds }] : [];
    }),
  });
}
```

- [ ] **Step 6: Full unit suite + typecheck**

Run: `npm test && npm run typecheck`
Expected: green.

- [ ] **Step 7: Commit**

```bash
git add lib/wears app/api/wears
git commit -m "feat(p3): wears validation + toggle/read API"
```

---

### Task 4: Weather forecast for a specific date

**Files:**
- Modify: `lib/context/weather.ts:44-53` (`buildForecastUrl`)
- Modify: `lib/context/weather.test.ts`

**Interfaces:**
- Produces: `buildForecastUrl(lat: number, lon: number, date?: string)` — with `date` ("YYYY-MM-DD") it emits `start_date`/`end_date` params instead of `forecast_days=1`; `summarizeForecast` already reads index 0, which is correct for a single-day range. Existing caller (`app/api/context/route.ts`) is untouched.

- [ ] **Step 1: Write the failing tests**

Append to `lib/context/weather.test.ts`:

```ts
describe("buildForecastUrl with a date", () => {
  it("requests exactly that day", () => {
    const url = new URL(buildForecastUrl(40, -70, "2026-07-18"));
    expect(url.searchParams.get("start_date")).toBe("2026-07-18");
    expect(url.searchParams.get("end_date")).toBe("2026-07-18");
    expect(url.searchParams.get("forecast_days")).toBeNull();
  });

  it("keeps forecast_days=1 when no date is given", () => {
    const url = new URL(buildForecastUrl(40, -70));
    expect(url.searchParams.get("forecast_days")).toBe("1");
    expect(url.searchParams.get("start_date")).toBeNull();
  });
});
```

(Reuse the file's existing imports; add `describe`/`it`/`expect` only if not already imported.)

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run lib/context/weather.test.ts`
Expected: FAIL — 3-arg call / `start_date` null.

- [ ] **Step 3: Implement**

Replace `buildForecastUrl`:

```ts
export function buildForecastUrl(lat: number, lon: number, date?: string): string {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    daily: "weathercode,temperature_2m_max,temperature_2m_min",
    timezone: "auto",
  });
  // A specific day (stylist occasions, ≤16 days out) vs. today (forecast_days).
  if (date) {
    params.set("start_date", date);
    params.set("end_date", date);
  } else {
    params.set("forecast_days", "1");
  }
  return `https://api.open-meteo.com/v1/forecast?${params}`;
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run lib/context/weather.test.ts`
Expected: PASS (including all pre-existing cases).

- [ ] **Step 5: Commit**

```bash
git add lib/context/weather.ts lib/context/weather.test.ts
git commit -m "feat(p3): single-day forecast URLs for occasion styling"
```

---

### Task 5: Stylist engine (`lib/ai/stylist.ts`)

**Files:**
- Create: `lib/ai/stylist.ts`
- Create: `lib/ai/stylist.test.ts`

**Interfaces:**
- Consumes: `getOpenAI` from `./openai`; `ClosetItem`, `Category`, `WeatherSummary` types; `Result` from `@/lib/closet/item-validation`; `DATE_KEY_RE` from `@/lib/wears/validation`.
- Produces:
  - `type StylistCombo = { name: string; reason: string; itemIds: string[] }`
  - `suggestOutfits(items: ClosetItem[], opts: { count: number; occasion?: string; date?: string; weather?: WeatherSummary | null }): Promise<StylistCombo[]>`
  - `validateCombos(raw: unknown, items: ClosetItem[]): StylistCombo[]` (exported for tests)
  - `mockCombos(items: ClosetItem[], count: number): StylistCombo[]` (deterministic MOCK_AI path)
  - `closetCanDress(items: ClosetItem[]): boolean`
  - `validateStylistBody(raw: unknown): Result<{ count: number; occasion?: string; date?: string }>` (count defaults 6, int 1–10; occasion trimmed ≤200 chars, empty → undefined; date must match `DATE_KEY_RE`)

- [ ] **Step 1: Write the failing tests**

Create `lib/ai/stylist.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Category } from "@/lib/closet/categories";
import type { ClosetItem } from "@/lib/closet/types";
import {
  closetCanDress,
  mockCombos,
  suggestOutfits,
  validateCombos,
  validateStylistBody,
} from "./stylist";

function item(id: string, category: Category, name = id): ClosetItem {
  return {
    id,
    name,
    category,
    colors: ["blue"],
    styleTags: [],
    imageUrl: `/i/${id}.png`,
    originalImageUrl: `/o/${id}.png`,
    createdAt: new Date(0),
  };
}

const CLOSET = [item("t1", "top"), item("t2", "top"), item("b1", "bottom"), item("s1", "shoes")];

describe("closetCanDress", () => {
  it("needs a dress, or a top and a bottom", () => {
    expect(closetCanDress(CLOSET)).toBe(true);
    expect(closetCanDress([item("d1", "dress")])).toBe(true);
    expect(closetCanDress([item("t1", "top"), item("s1", "shoes")])).toBe(false);
    expect(closetCanDress([])).toBe(false);
  });
});

describe("validateCombos", () => {
  const good = { name: "Look", reason: "why", itemIds: ["t1", "b1"] };

  it("keeps valid combos and trims text", () => {
    const combos = validateCombos(
      { outfits: [{ ...good, name: `  ${"x".repeat(200)}  ` }] },
      CLOSET,
    );
    expect(combos).toHaveLength(1);
    expect(combos[0].name.length).toBeLessThanOrEqual(120);
    expect(combos[0].itemIds).toEqual(["t1", "b1"]);
  });

  it("drops combos with hallucinated ids", () => {
    expect(validateCombos({ outfits: [{ ...good, itemIds: ["t1", "ghost"] }] }, CLOSET)).toEqual([]);
  });

  it("drops duplicate-category and unwearable combos", () => {
    expect(validateCombos({ outfits: [{ ...good, itemIds: ["t1", "t2"] }] }, CLOSET)).toEqual([]);
    expect(validateCombos({ outfits: [{ ...good, itemIds: ["s1"] }] }, CLOSET)).toEqual([]);
  });

  it("returns [] for malformed payloads", () => {
    expect(validateCombos(null, CLOSET)).toEqual([]);
    expect(validateCombos({ outfits: "no" }, CLOSET)).toEqual([]);
  });
});

describe("mockCombos", () => {
  it("is deterministic and wearable", () => {
    const a = mockCombos(CLOSET, 6);
    const b = mockCombos(CLOSET, 6);
    expect(a).toEqual(b);
    expect(a).toHaveLength(6);
    expect(a[0].itemIds).toEqual(["t1", "b1", "s1"]);
    expect(a[1].itemIds).toEqual(["t2", "b1", "s1"]);
    expect(a[0].name).toBe("Mock look 1");
  });

  it("falls back to dresses and stops when nothing is wearable", () => {
    expect(mockCombos([item("d1", "dress")], 2)).toHaveLength(2);
    expect(mockCombos([item("s1", "shoes")], 3)).toEqual([]);
  });
});

describe("suggestOutfits with MOCK_AI=1", () => {
  const previous = process.env.MOCK_AI;
  beforeEach(() => {
    process.env.MOCK_AI = "1";
  });
  afterEach(() => {
    if (previous === undefined) delete process.env.MOCK_AI;
    else process.env.MOCK_AI = previous;
  });

  it("returns mock combos without touching OpenAI", async () => {
    const combos = await suggestOutfits(CLOSET, { count: 3 });
    expect(combos).toEqual(mockCombos(CLOSET, 3));
  });

  it("returns [] when the closet can't dress", async () => {
    expect(await suggestOutfits([item("s1", "shoes")], { count: 3 })).toEqual([]);
  });
});

describe("validateStylistBody", () => {
  it("defaults count to 6", () => {
    const r = validateStylistBody({});
    expect(r.ok && r.value).toEqual({ count: 6, occasion: undefined, date: undefined });
  });

  it("accepts occasion + date, trimming the occasion", () => {
    const r = validateStylistBody({ count: 3, occasion: "  interview ", date: "2026-07-18" });
    expect(r.ok && r.value).toEqual({ count: 3, occasion: "interview", date: "2026-07-18" });
  });

  it("treats an empty occasion as absent", () => {
    const r = validateStylistBody({ occasion: "   " });
    expect(r.ok && r.value.occasion).toBeUndefined();
  });

  it("rejects bad counts and dates", () => {
    expect(validateStylistBody({ count: 0 }).ok).toBe(false);
    expect(validateStylistBody({ count: 11 }).ok).toBe(false);
    expect(validateStylistBody({ count: 2.5 }).ok).toBe(false);
    expect(validateStylistBody({ date: "next friday" }).ok).toBe(false);
    expect(validateStylistBody(null).ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run lib/ai/stylist.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `lib/ai/stylist.ts`:

```ts
import type { Category } from "@/lib/closet/categories";
import { type Result } from "@/lib/closet/item-validation";
import type { ClosetItem } from "@/lib/closet/types";
import type { WeatherSummary } from "@/lib/context/types";
import { DATE_KEY_RE } from "@/lib/wears/validation";
import { getOpenAI } from "./openai";

// Same chat model ingest tagging uses.
const STYLIST_MODEL = "gpt-4.1-mini";
const MAX_NAME = 120;
const MAX_REASON = 200;
const MAX_OCCASION = 200;
const MAX_COUNT = 10;

export type StylistCombo = { name: string; reason: string; itemIds: string[] };

export type StylistOptions = {
  count: number;
  occasion?: string;
  date?: string; // YYYY-MM-DD, prompt context only
  weather?: WeatherSummary | null;
};

function isMockAi(): boolean {
  return process.env.MOCK_AI === "1";
}

// An outfit is wearable with a dress, or a top and a bottom.
export function closetCanDress(items: ClosetItem[]): boolean {
  const cats = new Set(items.map((i) => i.category));
  return cats.has("dress") || (cats.has("top") && cats.has("bottom"));
}

function isWearable(cats: Category[]): boolean {
  return cats.includes("dress") || (cats.includes("top") && cats.includes("bottom"));
}

// Drop hallucinated ids, duplicate categories, and unwearable combos.
export function validateCombos(raw: unknown, items: ClosetItem[]): StylistCombo[] {
  if (typeof raw !== "object" || raw === null) return [];
  const list = (raw as { outfits?: unknown }).outfits;
  if (!Array.isArray(list)) return [];
  const byId = new Map(items.map((i) => [i.id, i]));
  const combos: StylistCombo[] = [];
  for (const entry of list) {
    if (typeof entry !== "object" || entry === null) continue;
    const o = entry as Record<string, unknown>;
    if (typeof o.name !== "string" || o.name.trim().length === 0) continue;
    if (!Array.isArray(o.itemIds)) continue;
    const ids = [...new Set(o.itemIds.filter((v): v is string => typeof v === "string"))];
    const found = ids.flatMap((id) => {
      const match = byId.get(id);
      return match ? [match] : [];
    });
    if (found.length !== ids.length || found.length === 0) continue;
    const cats = found.map((i) => i.category);
    if (new Set(cats).size !== cats.length) continue;
    if (!isWearable(cats)) continue;
    combos.push({
      name: o.name.trim().slice(0, MAX_NAME).trimEnd(),
      reason: typeof o.reason === "string" ? o.reason.trim().slice(0, MAX_REASON) : "",
      itemIds: ids,
    });
  }
  return combos;
}

// Deterministic offline combos: rotate each category by index.
export function mockCombos(items: ClosetItem[], count: number): StylistCombo[] {
  const byCat = (c: Category) => items.filter((i) => i.category === c);
  const tops = byCat("top");
  const bottoms = byCat("bottom");
  const dresses = byCat("dress");
  const shoes = byCat("shoes");
  const combos: StylistCombo[] = [];
  for (let i = 0; i < count; i++) {
    const ids: string[] = [];
    if (tops.length > 0 && bottoms.length > 0 && (dresses.length === 0 || i % 2 === 0)) {
      ids.push(tops[i % tops.length].id, bottoms[i % bottoms.length].id);
    } else if (dresses.length > 0) {
      ids.push(dresses[i % dresses.length].id);
    } else {
      break;
    }
    if (shoes.length > 0) ids.push(shoes[i % shoes.length].id);
    combos.push({
      name: `Mock look ${i + 1}`,
      reason: "Deterministic MOCK_AI pairing from your closet.",
      itemIds: ids,
    });
  }
  return combos;
}

function inventoryLines(items: ClosetItem[]): string {
  return items
    .map(
      (i) =>
        `- ${i.id} | ${i.category} | ${i.name} | colors: ${i.colors.join(", ") || "n/a"} | tags: ${i.styleTags.join(", ") || "n/a"}`,
    )
    .join("\n");
}

export async function suggestOutfits(
  items: ClosetItem[],
  opts: StylistOptions,
): Promise<StylistCombo[]> {
  if (!closetCanDress(items)) return [];
  if (isMockAi()) return mockCombos(items, opts.count);

  const contextLines = [
    opts.occasion
      ? `Occasion: ${opts.occasion}${opts.date ? ` on ${opts.date}` : ""}.`
      : "General inspiration — varied, everyday looks.",
    opts.weather
      ? `Weather that day: ${opts.weather.tempMin}–${opts.weather.tempMax}°, ${opts.weather.label}.`
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  const res = await getOpenAI().chat.completions.create({
    model: STYLIST_MODEL,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "stylist_outfits",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          required: ["outfits"],
          properties: {
            outfits: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                required: ["name", "reason", "itemIds"],
                properties: {
                  name: { type: "string" },
                  reason: { type: "string" },
                  itemIds: { type: "array", items: { type: "string" } },
                },
              },
            },
          },
        },
      },
    },
    messages: [
      {
        role: "user",
        content:
          `You are a personal stylist. Compose ${opts.count} distinct outfits using ONLY items from this closet, referenced by their exact ids:\n` +
          `${inventoryLines(items)}\n\n${contextLines}\n\n` +
          `Rules: every outfit needs either a dress, or a top and a bottom. At most one item per category. ` +
          `Add shoes/jacket/hat/accessory only when they suit the look. ` +
          `Give each outfit a short evocative name and a one-sentence reason.`,
      },
    ],
  });
  const text = res.choices[0]?.message?.content;
  if (!text) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return [];
  }
  return validateCombos(parsed, items).slice(0, opts.count);
}

export type StylistBody = { count: number; occasion?: string; date?: string };

export function validateStylistBody(raw: unknown): Result<StylistBody> {
  if (typeof raw !== "object" || raw === null) {
    return { ok: false, error: "Body must be an object." };
  }
  const o = raw as Record<string, unknown>;
  let count = 6;
  if (o.count != null) {
    if (typeof o.count !== "number" || !Number.isInteger(o.count) || o.count < 1 || o.count > MAX_COUNT) {
      return { ok: false, error: `count must be an integer between 1 and ${MAX_COUNT}.` };
    }
    count = o.count;
  }
  let occasion: string | undefined;
  if (o.occasion != null) {
    if (typeof o.occasion !== "string") {
      return { ok: false, error: "occasion must be a string." };
    }
    const trimmed = o.occasion.trim().slice(0, MAX_OCCASION);
    occasion = trimmed.length > 0 ? trimmed : undefined;
  }
  let date: string | undefined;
  if (o.date != null) {
    if (typeof o.date !== "string" || !DATE_KEY_RE.test(o.date)) {
      return { ok: false, error: "date must be a YYYY-MM-DD date." };
    }
    date = o.date;
  }
  return { ok: true, value: { count, occasion, date } };
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run lib/ai/stylist.test.ts`
Expected: PASS.

- [ ] **Step 5: Full unit suite + typecheck**

Run: `npm test && npm run typecheck`
Expected: green.

- [ ] **Step 6: Commit**

```bash
git add lib/ai/stylist.ts lib/ai/stylist.test.ts
git commit -m "feat(p3): stylist combo engine with MOCK_AI path"
```

---

### Task 6: POST /api/stylist route

**Files:**
- Create: `app/api/stylist/route.ts`

**Interfaces:**
- Consumes: `suggestOutfits`, `validateStylistBody` (Task 5); `buildForecastUrl` 3-arg (Task 4); `FIXTURE_WEATHER` from `@/lib/context/fixtures`; `getSetting` from `@/lib/db/settings`.
- Produces: `POST /api/stylist` body `{ count?, occasion?, date? }` → 200 `{ outfits: [{ name, reason, items: ClosetItem[] }] }` (items fully resolved for the client); 400 invalid body; 502 AI failure. Weather degrades to null silently (context-route pattern). MOCK_AI uses `FIXTURE_WEATHER`.

- [ ] **Step 1: Create the route**

Create `app/api/stylist/route.ts`:

```ts
import { desc } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { suggestOutfits, validateStylistBody } from "@/lib/ai/stylist";
import { FIXTURE_WEATHER } from "@/lib/context/fixtures";
import type { WeatherSummary } from "@/lib/context/types";
import { buildForecastUrl, summarizeForecast } from "@/lib/context/weather";
import { getDb } from "@/lib/db/client";
import { items } from "@/lib/db/schema";
import { getSetting } from "@/lib/db/settings";

const REVALIDATE_SECONDS = 900;

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const parsed = validateStylistBody(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const { count, occasion, date } = parsed.value;

  const all = await getDb().select().from(items).orderBy(desc(items.createdAt));

  // Weather degrades to null; styling still works without it.
  let weather: WeatherSummary | null = null;
  if (date) {
    if (process.env.MOCK_AI === "1") {
      weather = FIXTURE_WEATHER;
    } else {
      try {
        const locationRaw = await getSetting("weatherLocation");
        if (locationRaw) {
          const location = JSON.parse(locationRaw) as { lat: number; lon: number };
          const res = await fetch(buildForecastUrl(location.lat, location.lon, date), {
            next: { revalidate: REVALIDATE_SECONDS },
            signal: AbortSignal.timeout(10_000),
          });
          if (res.ok) weather = summarizeForecast(await res.json());
        }
      } catch (err) {
        console.error("[stylist] weather fetch failed:", err);
      }
    }
  }

  let combos;
  try {
    combos = await suggestOutfits(all, { count, occasion, date, weather });
  } catch (err) {
    console.error("[stylist] suggestion failed:", err);
    return NextResponse.json({ error: "Styling failed — try again." }, { status: 502 });
  }

  const byId = new Map(all.map((i) => [i.id, i]));
  return NextResponse.json({
    outfits: combos.map((c) => ({
      name: c.name,
      reason: c.reason,
      // validateCombos guarantees every id resolves.
      items: c.itemIds.map((id) => byId.get(id)!),
    })),
  });
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: clean. (The route sits behind passcode auth, so no curl smoke here — it is exercised end-to-end by `e2e/stylist.spec.ts` in Task 9.)

- [ ] **Step 3: Commit**

```bash
git add app/api/stylist
git commit -m "feat(p3): stylist API route with per-date weather context"
```

---

### Task 7: `localDateKey` helper + shared `OutfitActions` component

**Files:**
- Create: `lib/today/date.ts`
- Create: `lib/today/date.test.ts`
- Create: `components/outfits/OutfitActions.tsx`

**Interfaces:**
- Consumes: `OutfitSource` from `@/lib/outfits/validation` (Task 2); `POST /api/outfits` (existing); `POST /api/wears` (Task 3).
- Produces:
  - `localDateKey(now?: Date): string` — local "YYYY-MM-DD".
  - `<OutfitActions name itemIds source? savedOutfitId? initialWorn? showSave? />` — client component; Save auto-creates the outfit (`renderUrl: null`), "Wearing this today" auto-saves then toggles the wear (button text: `Wearing this today` ↔ `Wearing today ✓`), "Open in Studio" links to `/studio?items=<comma-joined ids>`. Calls `router.refresh()` after successful actions so server-rendered wear lists stay fresh. Save button label becomes `Saved ✓` (disabled) once an id exists; hidden entirely with `showSave={false}`.

- [ ] **Step 1: Write the failing test**

Create `lib/today/date.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { localDateKey } from "./date";

describe("localDateKey", () => {
  it("formats the local date with zero padding", () => {
    expect(localDateKey(new Date(2026, 0, 5))).toBe("2026-01-05");
    expect(localDateKey(new Date(2026, 11, 31))).toBe("2026-12-31");
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run lib/today/date.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the helper**

Create `lib/today/date.ts`:

```ts
// Local calendar date, not toISOString(): UTC would roll the date
// mid-afternoon for western timezones (same reasoning as TodayCard's dateKey).
export function localDateKey(now: Date = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run lib/today/date.test.ts`
Expected: PASS.

- [ ] **Step 5: Create OutfitActions**

Create `components/outfits/OutfitActions.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { OutfitSource } from "@/lib/outfits/validation";
import { localDateKey } from "@/lib/today/date";

type Props = {
  name: string;
  itemIds: string[];
  source?: OutfitSource;
  // Set when the combo is already an outfit row (Lookbook detail, or Today's
  // pick matched an existing wear). Unsaved combos auto-save on first action.
  savedOutfitId?: string | null;
  initialWorn?: boolean;
  // Lookbook detail hides Save — the outfit is saved by definition.
  showSave?: boolean;
};

function pillClass(active: boolean) {
  return `rounded-full px-4 py-2 text-sm font-bold ${
    active ? "bg-ink text-white" : "bg-card text-ink"
  }`;
}

export default function OutfitActions({
  name,
  itemIds,
  source = "studio",
  savedOutfitId = null,
  initialWorn = false,
  showSave = true,
}: Props) {
  const router = useRouter();
  const [outfitId, setOutfitId] = useState<string | null>(savedOutfitId);
  const [worn, setWorn] = useState(initialWorn);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function ensureSaved(): Promise<string> {
    if (outfitId) return outfitId;
    const res = await fetch("/api/outfits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, itemIds, renderUrl: null, source }),
    });
    const data = (await res.json().catch(() => null)) as
      | { outfit?: { id: string }; error?: string }
      | null;
    if (!res.ok || !data?.outfit) {
      throw new Error(data?.error ?? "Save failed — try again.");
    }
    setOutfitId(data.outfit.id);
    return data.outfit.id;
  }

  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await action();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong — try again.");
    } finally {
      setBusy(false);
    }
  }

  const save = () =>
    run(async () => {
      await ensureSaved();
    });

  const wearToday = () =>
    run(async () => {
      const id = await ensureSaved();
      const res = await fetch("/api/wears", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outfitId: id, wornOn: localDateKey() }),
      });
      const data = (await res.json().catch(() => null)) as
        | { worn?: boolean; error?: string }
        | null;
      if (!res.ok || data?.worn == null) {
        throw new Error(data?.error ?? "Couldn't log the wear — try again.");
      }
      setWorn(data.worn);
    });

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Outfit actions">
        {showSave && (
          <button
            type="button"
            onClick={save}
            disabled={busy || outfitId !== null}
            className={pillClass(false)}
          >
            {outfitId ? "Saved ✓" : "Save"}
          </button>
        )}
        <button
          type="button"
          onClick={wearToday}
          disabled={busy}
          aria-pressed={worn}
          className={pillClass(worn)}
        >
          {worn ? "Wearing today ✓" : "Wearing this today"}
        </button>
        <Link href={`/studio?items=${itemIds.join(",")}`} className={pillClass(false)}>
          Open in Studio
        </Link>
      </div>
      {error && <p className="text-sm text-error">{error}</p>}
    </div>
  );
}
```

(Per DESIGN.md: selected state uses ink, never pink; these are secondary card pills.)

- [ ] **Step 6: Full unit suite + typecheck**

Run: `npm test && npm run typecheck`
Expected: green. (Component behavior is covered by the Playwright specs in Tasks 9–11.)

- [ ] **Step 7: Commit**

```bash
git add lib/today/date.ts lib/today/date.test.ts components/outfits
git commit -m "feat(p3): shared OutfitActions (save / wear toggle / open in studio)"
```

---

### Task 8: Studio preload via `?items=`

**Files:**
- Modify: `app/(tabs)/studio/page.tsx`
- Modify: `components/studio/StudioBuilder.tsx:26-30` (props + `selected`/`active` init)

**Interfaces:**
- Consumes: existing `StudioBuilder`, `ClosetItem`, `Category`.
- Produces: `/studio?items=id1,id2` pre-fills the builder slots. `StudioBuilder` gains optional prop `initialSelected?: Partial<Record<Category, ClosetItem>>` (default `{}`). Unknown ids drop silently; first item per category wins. Covered by e2e in Task 9 (clicking "Open in Studio" on a stylist card).

- [ ] **Step 1: Rework the studio page**

Replace `app/(tabs)/studio/page.tsx` with:

```tsx
import { desc } from "drizzle-orm";
import PageHeader from "@/components/shell/PageHeader";
import StudioBuilder from "@/components/studio/StudioBuilder";
import type { Category } from "@/lib/closet/categories";
import type { ClosetItem } from "@/lib/closet/types";
import { getDb } from "@/lib/db/client";
import { items } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export default async function StudioPage({
  searchParams,
}: {
  searchParams: Promise<{ items?: string }>;
}) {
  const all = await getDb().select().from(items).orderBy(desc(items.createdAt));
  // ?items=id1,id2 pre-fills the builder ("Open in Studio" everywhere).
  // Unknown ids drop silently; first item per category wins.
  const { items: preload } = await searchParams;
  const wanted = new Set((preload ?? "").split(",").filter(Boolean));
  const initialSelected: Partial<Record<Category, ClosetItem>> = {};
  for (const item of all) {
    if (wanted.has(item.id) && !initialSelected[item.category]) {
      initialSelected[item.category] = item;
    }
  }
  return (
    <>
      <PageHeader title="Studio" />
      <StudioBuilder items={all} initialSelected={initialSelected} />
    </>
  );
}
```

- [ ] **Step 2: Accept the prop in StudioBuilder**

In `components/studio/StudioBuilder.tsx`, change the signature and the two `useState` initializers:

```tsx
export default function StudioBuilder({
  items,
  initialSelected = {},
}: {
  items: ClosetItem[];
  initialSelected?: Partial<Record<Category, ClosetItem>>;
}) {
  const [selected, setSelected] =
    useState<Partial<Record<Category, ClosetItem>>>(initialSelected);
  const [active, setActive] = useState<Category>(
    () =>
      CATEGORIES.find((c) => initialSelected[c]) ??
      CATEGORIES.find((c) => items.some((i) => i.category === c)) ??
      "top",
  );
```

Everything else in the component stays untouched.

- [ ] **Step 3: Typecheck + existing e2e still green**

Run: `npm run typecheck && npm run test:e2e -- studio.spec.ts`
Expected: clean; studio suite passes unchanged (no `?items` → empty preload → old behavior).

- [ ] **Step 4: Commit**

```bash
git add "app/(tabs)/studio/page.tsx" components/studio/StudioBuilder.tsx
git commit -m "feat(p3): studio preload via ?items= query param"
```

---

### Task 9: Stylist tab UI + e2e

**Files:**
- Create: `components/stylist/StylistTab.tsx`
- Modify: `app/(tabs)/stylist/page.tsx`
- Create: `e2e/stylist.spec.ts`

**Interfaces:**
- Consumes: `POST /api/stylist` (Task 6) → `{ outfits: [{ name, reason, items }] }`; `OutfitActions` (Task 7); `OutfitCollage`; `localDateKey` (Task 7).
- Produces: Stylist tab with occasion form (text input labeled "Style an occasion", native date input labeled "On", pink "Style me" submit — the screen's single pink ACTION) and Inspiration feed (h2 "Inspiration", "Shuffle" button, cards `data-testid="suggestion-card"`). Feed batch cached in `sessionStorage` key `kloset-stylist-feed`; Shuffle refetches; occasion results (h2 "For the occasion", count 3) are never cached.

- [ ] **Step 1: Create StylistTab**

Create `components/stylist/StylistTab.tsx`:

```tsx
"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useState } from "react";
import OutfitActions from "@/components/outfits/OutfitActions";
import OutfitCollage from "@/components/studio/OutfitCollage";
import type { ClosetItem } from "@/lib/closet/types";
import { localDateKey } from "@/lib/today/date";

type StylistOutfit = { name: string; reason: string; items: ClosetItem[] };

const FEED_CACHE_KEY = "kloset-stylist-feed";
const FEED_COUNT = 6;
const OCCASION_COUNT = 3;
const MAX_DATE_OFFSET_DAYS = 15; // open-meteo forecast horizon

async function fetchOutfits(body: {
  count: number;
  occasion?: string;
  date?: string;
}): Promise<StylistOutfit[]> {
  const res = await fetch("/api/stylist", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => null)) as
    | { outfits?: StylistOutfit[]; error?: string }
    | null;
  if (!res.ok || !data?.outfits) {
    throw new Error(data?.error ?? "Styling failed — try again.");
  }
  return data.outfits;
}

function SuggestionCard({ outfit }: { outfit: StylistOutfit }) {
  return (
    <div className="flex flex-col gap-3" data-testid="suggestion-card">
      <OutfitCollage items={outfit.items} />
      <div>
        <p className="font-bold text-ink">{outfit.name}</p>
        {outfit.reason && <p className="text-sm text-mute">{outfit.reason}</p>}
      </div>
      <OutfitActions
        name={outfit.name}
        itemIds={outfit.items.map((i) => i.id)}
        source="stylist"
      />
    </div>
  );
}

export default function StylistTab() {
  const [feed, setFeed] = useState<StylistOutfit[] | null>(null);
  const [feedLoading, setFeedLoading] = useState(false);
  const [feedError, setFeedError] = useState<string | null>(null);

  const [occasion, setOccasion] = useState("");
  const [date, setDate] = useState(() => localDateKey());
  const [results, setResults] = useState<StylistOutfit[] | null>(null);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [resultsError, setResultsError] = useState<string | null>(null);

  async function loadFeed() {
    setFeedLoading(true);
    setFeedError(null);
    try {
      const outfits = await fetchOutfits({ count: FEED_COUNT });
      setFeed(outfits);
      sessionStorage.setItem(FEED_CACHE_KEY, JSON.stringify(outfits));
    } catch (err) {
      setFeedError(err instanceof Error ? err.message : "Styling failed — try again.");
    } finally {
      setFeedLoading(false);
    }
  }

  // The batch is cached per session: navigating away and back shows the same
  // looks instantly; Shuffle explicitly spends a fresh AI call.
  useEffect(() => {
    try {
      const cached = sessionStorage.getItem(FEED_CACHE_KEY);
      if (cached) {
        setFeed(JSON.parse(cached) as StylistOutfit[]);
        return;
      }
    } catch {
      // Bad cache — fall through to a fresh fetch.
    }
    void loadFeed();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function styleOccasion(e: FormEvent) {
    e.preventDefault();
    if (resultsLoading || occasion.trim().length === 0) return;
    setResultsLoading(true);
    setResultsError(null);
    try {
      setResults(
        await fetchOutfits({ count: OCCASION_COUNT, occasion: occasion.trim(), date }),
      );
    } catch (err) {
      setResultsError(err instanceof Error ? err.message : "Styling failed — try again.");
    } finally {
      setResultsLoading(false);
    }
  }

  const minDate = localDateKey();
  const maxDate = localDateKey(
    new Date(Date.now() + MAX_DATE_OFFSET_DAYS * 24 * 60 * 60 * 1000),
  );

  return (
    <div className="mt-4 flex flex-col gap-8">
      <form onSubmit={styleOccasion} className="flex flex-col gap-2 rounded-card bg-card p-4">
        <label htmlFor="occasion" className="font-bold text-ink">
          Style an occasion
        </label>
        <input
          id="occasion"
          value={occasion}
          onChange={(e) => setOccasion(e.target.value)}
          maxLength={200}
          placeholder="Interview, dinner date, gallery opening…"
          className="rounded-full bg-canvas px-4 py-3 text-ink placeholder:text-mute"
        />
        <div className="flex items-center gap-2">
          <label htmlFor="occasion-date" className="text-sm text-body">
            On
          </label>
          <input
            id="occasion-date"
            type="date"
            value={date}
            min={minDate}
            max={maxDate}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-full bg-canvas px-4 py-2 text-sm text-ink"
          />
          <button
            type="submit"
            disabled={resultsLoading || occasion.trim().length === 0}
            className="ml-auto rounded-full bg-pink px-5 py-3 text-sm font-bold text-white active:bg-pink-deep disabled:opacity-50"
          >
            Style me
          </button>
        </div>
      </form>

      {resultsLoading && (
        <p role="status" className="text-sm text-mute">
          Styling your occasion…
        </p>
      )}
      {resultsError && <p className="text-sm text-error">{resultsError}</p>}
      {results && !resultsLoading && (
        <section aria-label="Occasion looks" className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <h2 className="font-script text-3xl text-ink">For the occasion</h2>
            <button
              type="button"
              onClick={() => setResults(null)}
              className="text-sm text-mute underline"
            >
              Clear
            </button>
          </div>
          {results.length === 0 ? (
            <p className="text-mute">Couldn&apos;t style that — try rewording it.</p>
          ) : (
            results.map((o, i) => <SuggestionCard key={`${o.name}-${i}`} outfit={o} />)
          )}
        </section>
      )}

      <section aria-label="Inspiration feed" className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h2 className="font-script text-3xl text-ink">Inspiration</h2>
          <button
            type="button"
            onClick={() => void loadFeed()}
            disabled={feedLoading}
            className="rounded-full bg-card px-4 py-2 text-sm font-bold text-ink disabled:opacity-50"
          >
            Shuffle
          </button>
        </div>
        {feedLoading && (
          <p role="status" className="text-sm text-mute">
            Styling your closet…
          </p>
        )}
        {feedError && <p className="text-sm text-error">{feedError}</p>}
        {feed && !feedLoading && feed.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <p className="font-script text-3xl text-ink">Not enough to style yet</p>
            <p className="text-mute">Scan a few tops and bottoms (or a dress) first.</p>
            <Link
              href="/scan"
              className="rounded-full bg-ink px-5 py-3 text-sm font-bold text-white"
            >
              Scan an item
            </Link>
          </div>
        )}
        {feed &&
          !feedLoading &&
          feed.length > 0 &&
          feed.map((o, i) => <SuggestionCard key={`${o.name}-${i}`} outfit={o} />)}
      </section>
    </div>
  );
}
```

(The Scan link is ink, not pink — "Style me" is this screen's one pink ACTION pill.)

- [ ] **Step 2: Wire the page**

Replace `app/(tabs)/stylist/page.tsx`:

```tsx
import PageHeader from "@/components/shell/PageHeader";
import StylistTab from "@/components/stylist/StylistTab";

export default function StylistPage() {
  return (
    <>
      <PageHeader title="Stylist" />
      <StylistTab />
    </>
  );
}
```

- [ ] **Step 3: Write the e2e spec**

Create `e2e/stylist.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import { unlock } from "./helpers";

// Runs after studio.spec (alphabetical), so the closet already holds the
// studio seed items (tee/jeans/sneakers) plus closet.spec's leftover top —
// enough for MOCK_AI's deterministic combos ("Mock look N").
test.describe.serial("stylist", () => {
  test("inspiration feed renders mock combos with actions", async ({ page }) => {
    await unlock(page);
    await page.goto("/stylist");
    await expect(page.getByRole("heading", { level: 1, name: "Stylist" })).toBeVisible();
    const first = page.getByTestId("suggestion-card").first();
    await expect(first).toBeVisible();
    await expect(first.getByText("Mock look 1")).toBeVisible();
    await expect(first.getByRole("button", { name: "Save", exact: true })).toBeVisible();
    await expect(first.getByRole("button", { name: "Wearing this today" })).toBeVisible();
    await expect(first.getByRole("link", { name: "Open in Studio" })).toBeVisible();
  });

  test("occasion prompt returns dated looks", async ({ page }) => {
    await unlock(page);
    await page.goto("/stylist");
    await page.getByLabel("Style an occasion").fill("Interview");
    await page.getByRole("button", { name: "Style me" }).click();
    await expect(page.getByRole("heading", { name: "For the occasion" })).toBeVisible();
    await expect(
      page.getByLabel("Occasion looks").getByTestId("suggestion-card").first(),
    ).toBeVisible();
  });

  test("open in studio preloads the combo", async ({ page }) => {
    await unlock(page);
    await page.goto("/stylist");
    const first = page.getByTestId("suggestion-card").first();
    await first.getByRole("link", { name: "Open in Studio" }).click();
    await expect(page).toHaveURL(/\/studio\?items=/);
    // Mock look 1 = top + bottom + shoes → three preloaded collage layers.
    await expect(page.getByTestId("outfit-collage").locator("img")).toHaveCount(3);
  });

  test("saving a suggestion lands it in the lookbook", async ({ page }) => {
    await unlock(page);
    await page.goto("/stylist");
    const first = page.getByTestId("suggestion-card").first();
    await first.getByRole("button", { name: "Save", exact: true }).click();
    await expect(first.getByRole("button", { name: "Saved ✓" })).toBeDisabled();
    await page.goto("/lookbook");
    await expect(page.getByText("Mock look 1").first()).toBeVisible();
  });
});
```

- [ ] **Step 4: Run the new spec**

Run: `npm run test:e2e -- stylist.spec.ts`
Expected: 4 passed. (If the collage count assertion flakes on image load, assert on `locator("img")` count only — it counts DOM nodes, not loaded pixels; no waiting needed.)

- [ ] **Step 5: Full check**

Run: `npm test && npm run typecheck && npm run test:e2e`
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add components/stylist "app/(tabs)/stylist/page.tsx" e2e/stylist.spec.ts
git commit -m "feat(p3): stylist tab — inspiration feed + occasion prompt"
```

---

### Task 10: Today — wear actions go live

**Files:**
- Create: `lib/today/worn.ts`
- Create: `lib/today/worn.test.ts`
- Modify: `components/today/TodayCard.tsx`
- Modify: `e2e/today.spec.ts`

**Interfaces:**
- Consumes: `GET /api/wears?on=` (Task 3); `OutfitActions` (Task 7); `localDateKey` (Task 7).
- Produces: `findWornMatch(wears: { outfitId: string; itemIds: string[] }[], pickIds: string[]): string | null` (set-equality match). TodayCard renders `OutfitActions` under the outfit grid once the day's wears have loaded, with `source="today"` and a date-derived name.

- [ ] **Step 1: Write the failing tests**

Create `lib/today/worn.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { findWornMatch } from "./worn";

describe("findWornMatch", () => {
  const wear = { outfitId: "o1", itemIds: ["a", "b", "c"] };

  it("matches regardless of order", () => {
    expect(findWornMatch([wear], ["c", "a", "b"])).toBe("o1");
  });

  it("rejects subsets and supersets", () => {
    expect(findWornMatch([wear], ["a", "b"])).toBeNull();
    expect(findWornMatch([wear], ["a", "b", "c", "d"])).toBeNull();
  });

  it("returns null with no wears", () => {
    expect(findWornMatch([], ["a"])).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run lib/today/worn.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `lib/today/worn.ts`:

```ts
export type DayWear = { outfitId: string; itemIds: string[] };

// Exact set equality: the logged outfit is precisely today's pick.
export function findWornMatch(wears: DayWear[], pickIds: string[]): string | null {
  const want = new Set(pickIds);
  for (const w of wears) {
    if (w.itemIds.length === want.size && w.itemIds.every((id) => want.has(id))) {
      return w.outfitId;
    }
  }
  return null;
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run lib/today/worn.test.ts`
Expected: PASS.

- [ ] **Step 5: Wire TodayCard**

In `components/today/TodayCard.tsx`:

a. Add imports:

```tsx
import OutfitActions from "@/components/outfits/OutfitActions";
import { localDateKey } from "@/lib/today/date";
import { type DayWear, findWornMatch } from "@/lib/today/worn";
```

b. Replace the inline dateKey computation body (keep the existing comment block) with the helper:

```tsx
  useEffect(() => {
    setDateKey(localDateKey());
  }, []);
```

c. Add the day's-wears fetch after the `dateKey` effect:

```tsx
  // Today's logged wears, so the action row can reflect "already worn".
  const [dayWears, setDayWears] = useState<DayWear[] | null>(null);
  useEffect(() => {
    if (!dateKey) return;
    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetch(`/api/wears?on=${dateKey}`, { signal: controller.signal });
        if (res.ok) {
          const data = (await res.json()) as { wears: DayWear[] };
          setDayWears(data.wears);
        } else {
          setDayWears([]);
        }
      } catch {
        setDayWears([]); // Actions still work; state just starts unworn.
      }
    })();
    return () => controller.abort();
  }, [dateKey]);
```

d. Inside `<section aria-label="Today's outfit">`, after the closing `</div>` of the picks grid, add:

```tsx
          {dayWears !== null &&
            (() => {
              const pickIds = outfit.picks.map((p) => p.item.id);
              const matchId = findWornMatch(dayWears, pickIds);
              return (
                <div className="mt-3">
                  <OutfitActions
                    // Remount if the pick changes (weather arrives async).
                    key={`${pickIds.join(",")}-${matchId ?? "none"}`}
                    name={new Date().toLocaleDateString([], {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                    })}
                    itemIds={pickIds}
                    source="today"
                    savedOutfitId={matchId}
                    initialWorn={matchId !== null}
                  />
                </div>
              );
            })()}
```

- [ ] **Step 6: Extend the e2e spec**

Append to `e2e/today.spec.ts`:

```ts
test("wearing today toggles and survives reload", async ({ page }) => {
  await unlock(page);
  // Runs after studio.spec's seed, so a pick always renders.
  await expect(page.getByLabel("Today's outfit")).toBeVisible();
  await page.getByRole("button", { name: "Wearing this today" }).click();
  await expect(page.getByRole("button", { name: "Wearing today ✓" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "Wearing today ✓" })).toBeVisible();
  // Toggle back off so later specs start with a clean day.
  await page.getByRole("button", { name: "Wearing today ✓" }).click();
  await expect(page.getByRole("button", { name: "Wearing this today" })).toBeVisible();
});
```

- [ ] **Step 7: Run the spec**

Run: `npm run test:e2e -- today.spec.ts`
Expected: both today tests pass. (This leaves one auto-saved `source: "today"` outfit row behind — harmless; wears.spec asserts only on its own seeded names.)

- [ ] **Step 8: Full unit suite + typecheck**

Run: `npm test && npm run typecheck`
Expected: green.

- [ ] **Step 9: Commit**

```bash
git add lib/today components/today/TodayCard.tsx e2e/today.spec.ts
git commit -m "feat(p3): today's wearing-it action goes live"
```

---

### Task 11: Lookbook — badges, detail page, delete + e2e

**Files:**
- Modify: `app/(tabs)/lookbook/page.tsx`
- Create: `app/(tabs)/lookbook/[id]/page.tsx`
- Create: `components/lookbook/DeleteOutfitButton.tsx`
- Create: `e2e/wears.spec.ts`

**Interfaces:**
- Consumes: `wears` schema, `DELETE /api/outfits/:id` (Task 2), `OutfitActions` (`showSave={false}`, Task 7), `OutfitCollage`, `localDateKey`, `CATEGORIES`/`CATEGORY_LABELS`.
- Produces: grid cards link to `/lookbook/[id]` with a "Worn N×" badge; detail page shows render/collage, action row, "Pieces" links, "Worn N×" history, and a two-tap delete.

- [ ] **Step 1: Grid — links + badges**

In `app/(tabs)/lookbook/page.tsx`:

a. Update imports: add `count` to the drizzle import and `wears` to the schema import:

```tsx
import { count, desc } from "drizzle-orm";
import { items, outfits, wears } from "@/lib/db/schema";
```

b. Extend the parallel fetch:

```tsx
  const [allOutfits, allItems, wearCounts] = await Promise.all([
    db.select().from(outfits).orderBy(desc(outfits.createdAt)),
    db.select().from(items),
    db.select({ outfitId: wears.outfitId, n: count() }).from(wears).groupBy(wears.outfitId),
  ]);
  const byId = new Map(allItems.map((i) => [i.id, i]));
  const wornTimes = new Map(wearCounts.map((w) => [w.outfitId, w.n]));
```

c. Change the masonry container's child selector (cards become `<a>`):

```tsx
        <div className="mt-4 columns-2 gap-2 sm:columns-3 md:columns-4 [&>a]:mb-2">
```

d. Replace the card `<div>` with a `Link` and add the badge after the name pill:

```tsx
            return (
              <Link
                key={outfit.id}
                href={`/lookbook/${outfit.id}`}
                className="relative block break-inside-avoid overflow-hidden rounded-card bg-card"
              >
                {outfit.renderUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={outfit.renderUrl} alt={outfit.name} className="w-full" />
                ) : (
                  <OutfitCollage items={resolved} />
                )}
                <span className="absolute bottom-2 left-2 max-w-[85%] truncate rounded-full bg-canvas px-3 py-1 text-xs font-bold text-ink">
                  {outfit.name}
                </span>
                {(wornTimes.get(outfit.id) ?? 0) > 0 && (
                  <span className="absolute right-2 top-2 rounded-full bg-canvas px-3 py-1 text-xs font-bold text-ink">
                    Worn {wornTimes.get(outfit.id)}×
                  </span>
                )}
              </Link>
            );
```

- [ ] **Step 2: Create the delete button**

Create `components/lookbook/DeleteOutfitButton.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function DeleteOutfitButton({ outfitId }: { outfitId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function del() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/outfits/${outfitId}`, { method: "DELETE" });
      if (!res.ok) {
        setError("Delete failed — try again.");
        return;
      }
      router.push("/lookbook");
      router.refresh();
    } catch {
      setError("Delete failed — try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="self-start text-sm font-bold text-error underline"
      >
        Delete outfit
      </button>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="text-sm text-body">Delete this look?</span>
      <button
        type="button"
        onClick={del}
        disabled={busy}
        className="rounded-full bg-error px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
      >
        Delete
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        disabled={busy}
        className="text-sm text-ink underline"
      >
        Keep
      </button>
      {error && <p className="w-full text-sm text-error">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 3: Create the detail page**

Create `app/(tabs)/lookbook/[id]/page.tsx`:

```tsx
import { desc, eq, inArray } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import DeleteOutfitButton from "@/components/lookbook/DeleteOutfitButton";
import OutfitActions from "@/components/outfits/OutfitActions";
import PageHeader from "@/components/shell/PageHeader";
import OutfitCollage from "@/components/studio/OutfitCollage";
import { CATEGORIES, CATEGORY_LABELS } from "@/lib/closet/categories";
import { UUID_RE } from "@/lib/closet/item-validation";
import { getDb } from "@/lib/db/client";
import { items, outfits, wears } from "@/lib/db/schema";
import { localDateKey } from "@/lib/today/date";

export const dynamic = "force-dynamic";

function formatWorn(wornOn: string): string {
  // Anchor to local midnight — bare date strings would parse as UTC.
  return new Date(`${wornOn}T00:00:00`).toLocaleDateString([], {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default async function OutfitPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const db = getDb();
  const [outfit] = await db.select().from(outfits).where(eq(outfits.id, id));
  if (!outfit) notFound();
  const [resolved, history] = await Promise.all([
    outfit.itemIds.length
      ? db.select().from(items).where(inArray(items.id, outfit.itemIds))
      : Promise.resolve([]),
    db.select().from(wears).where(eq(wears.outfitId, id)).orderBy(desc(wears.wornOn)),
  ]);
  const ordered = CATEGORIES.flatMap((c) => resolved.filter((i) => i.category === c));
  // Server-local date: worst case the toggle starts stale near midnight and
  // corrects itself on first tap (the POST response is authoritative).
  const wornToday = history.some((w) => w.wornOn === localDateKey());

  return (
    <>
      <Link href="/lookbook" className="text-sm text-mute">
        ← Lookbook
      </Link>
      <PageHeader title={outfit.name} />
      <div className="flex flex-col gap-6">
        {outfit.renderUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={outfit.renderUrl}
            alt={outfit.name}
            className="w-full overflow-hidden rounded-card bg-card"
          />
        ) : (
          <OutfitCollage items={ordered} />
        )}

        <OutfitActions
          name={outfit.name}
          itemIds={ordered.map((i) => i.id)}
          savedOutfitId={outfit.id}
          initialWorn={wornToday}
          showSave={false}
        />

        <section aria-label="Pieces" className="flex flex-col gap-2">
          <h2 className="font-script text-3xl text-ink">Pieces</h2>
          {ordered.map((item) => (
            <Link
              key={item.id}
              href={`/closet/${item.id}`}
              className="flex items-center gap-3 rounded-card bg-card p-2"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.imageUrl} alt="" className="h-12 w-12 object-contain" />
              <span className="font-bold text-ink">{item.name}</span>
              <span className="ml-auto pr-2 text-sm text-mute">
                {CATEGORY_LABELS[item.category]}
              </span>
            </Link>
          ))}
          {ordered.length === 0 && (
            <p className="text-mute">The pieces in this look are no longer in your closet.</p>
          )}
        </section>

        <section aria-label="Wear history" className="flex flex-col gap-2">
          <h2 className="font-script text-3xl text-ink">Worn {history.length}×</h2>
          {history.length === 0 ? (
            <p className="text-mute">Not worn yet.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {history.map((w) => (
                <li key={w.id} className="text-sm text-body">
                  {formatWorn(w.wornOn)}
                </li>
              ))}
            </ul>
          )}
        </section>

        <DeleteOutfitButton outfitId={outfit.id} />
      </div>
    </>
  );
}
```

- [ ] **Step 4: Write the e2e spec**

Create `e2e/wears.spec.ts` (alphabetically last — runs after every other spec):

```ts
import { expect, test } from "@playwright/test";
import { unlock } from "./helpers";

// Seeds its own items/outfit/wear via the API — no dependence on leftovers.
// NOTE: retries must stay 0 for this serial suite — a retry re-runs the seed.
test.describe.serial("wear history", () => {
  let outfitId: string;

  test("seed: outfit saved and worn via the API", async ({ page }) => {
    await unlock(page);
    const ids: string[] = [];
    for (const [name, category] of [
      ["Wear-test tee", "top"],
      ["Wear-test jeans", "bottom"],
    ] as const) {
      const res = await page.request.post("/api/items", {
        data: {
          name,
          category,
          colors: ["red"],
          styleTags: [],
          imageUrl: "/fixtures/cutout-top.svg",
          originalImageUrl: "/fixtures/original-top.svg",
        },
      });
      expect(res.status()).toBe(201);
      ids.push((await res.json()).item.id);
    }
    const outfitRes = await page.request.post("/api/outfits", {
      data: { name: "Wear-test look", itemIds: ids, renderUrl: null, source: "stylist" },
    });
    expect(outfitRes.status()).toBe(201);
    outfitId = (await outfitRes.json()).outfit.id;
    const wearRes = await page.request.post("/api/wears", {
      data: { outfitId, wornOn: "2026-07-01" },
    });
    expect(wearRes.status()).toBe(200);
    expect((await wearRes.json()).worn).toBe(true);
  });

  test("lookbook shows the badge; detail shows history and actions", async ({ page }) => {
    await unlock(page);
    await page.goto("/lookbook");
    const card = page.getByRole("link", { name: /Wear-test look/ });
    await expect(card.getByText("Worn 1×")).toBeVisible();
    await card.click();
    await expect(page.getByRole("heading", { level: 1, name: "Wear-test look" })).toBeVisible();
    await expect(
      page.getByLabel("Wear history").getByRole("heading", { name: "Worn 1×" }),
    ).toBeVisible();
    await expect(page.getByText("Wednesday, July 1, 2026")).toBeVisible();
    await expect(page.getByRole("button", { name: "Wearing this today" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Open in Studio" })).toBeVisible();
    // Pieces link back to the closet.
    await expect(
      page.getByLabel("Pieces").getByRole("link", { name: /Wear-test tee/ }),
    ).toBeVisible();
  });

  test("deleting the outfit removes it and its wears", async ({ page }) => {
    await unlock(page);
    await page.goto(`/lookbook/${outfitId}`);
    await page.getByRole("button", { name: "Delete outfit" }).click();
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(page).toHaveURL(/\/lookbook$/);
    await expect(page.getByRole("link", { name: /Wear-test look/ })).toHaveCount(0);
  });
});
```

- [ ] **Step 5: Run the spec**

Run: `npm run test:e2e -- wears.spec.ts`
Expected: 3 passed.

- [ ] **Step 6: Full check**

Run: `npm test && npm run typecheck && npm run test:e2e`
Expected: all green (the full e2e run validates cross-spec ordering).

- [ ] **Step 7: Commit**

```bash
git add "app/(tabs)/lookbook" components/lookbook e2e/wears.spec.ts
git commit -m "feat(p3): lookbook wear badges, detail page with history + delete"
```

---

### Task 12: Docs, design audit, final verification

**Files:**
- Modify: `CLAUDE.md` (repo root)
- Modify: `DESIGN.md` (only if the audit produces a new ruling)

- [ ] **Step 1: Update repo docs**

In `CLAUDE.md`:
- `Current plan:` line → `docs/superpowers/plans/2026-07-11-kloset-p3-stylist-wears.md`
- Both e2e wipe mentions (`## Commands` note and `## Rules` bullet): add `outfits and wears` → "wipes the settings, items, base_photos, outfits and wears tables".

- [ ] **Step 2: Design audit of the new screens**

Run `/impeccable audit` (or a manual DESIGN.md pass if impeccable is unavailable in the session) over: Stylist tab, Lookbook grid + detail, Today action row. Checklist: tokens only; one pink ACTION pill per screen (Stylist = "Style me"; Lookbook detail = none — delete is error-red text, wear toggle is ink); cursive only for headings; phone viewport (390px) — action pills wrap, date input doesn't overflow.

- [ ] **Step 3: Full verification (repo done bar)**

Run: `npm test && npm run typecheck && npm run test:e2e`
Expected: all green — paste the output summary.

Then drive it manually: `npm run dev` (port 8000, MOCK_AI=1), phone viewport:
1. Stylist → feed shows 6 mock cards; Shuffle refetches; navigate away/back → same batch (sessionStorage).
2. Occasion "interview" + date → 3 cards under "For the occasion".
3. Card → Save → appears in Lookbook. Card → Open in Studio → slots pre-filled.
4. Today → "Wearing this today" → toggles ✓; reload → still ✓; Lookbook shows the auto-saved look with "Worn 1×".
5. Lookbook card → detail: pieces link to closet, history lists dates, delete (two-tap) returns to grid.

- [ ] **Step 4: Commit + push the branch**

```bash
git add CLAUDE.md DESIGN.md
git commit -m "docs(p3): current-plan pointer + e2e wipe list"
git push -u origin kloset-p3
```

- [ ] **Step 5: Owner smoke (manual, post-merge ok)**

Real-AI stylist smoke needs only `OPENAI_API_KEY` (text-only — NOT blocked on the missing `BLOB_READ_WRITE_TOKEN`): run dev without MOCK_AI, open Stylist, confirm a real batch styles actual closet items. Render/ingest smoke remains blocked on the Blob token (unchanged from P2).

---

## Deliberate simplifications (agreed during grilling)

- Save-button dedup is in-session only: after a reload, re-saving the same unsaved combo creates a second outfit row. Delete exists; add matching-on-itemIds if it annoys.
- Stylist feed cache has no TTL — it lives for the browser session by design.
- No "currently wearing X" banner on Today; the toggle reflects only Today's own pick.
- Lookbook detail's initial worn-state uses the server's local date; a stale toggle near midnight self-corrects on first tap.
- LLM may return fewer than `count` valid combos after validation — the UI just renders fewer cards.
