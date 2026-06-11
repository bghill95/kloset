# M2 — Closet Guided Capture & Catalog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scan clothes with a guided in-app camera (per-category outline), run them through an OpenAI cutout + tagging pipeline (fully mocked under `MOCK_AI=1`), confirm, and manage them in a filterable closet grid with an editable detail view.

**Architecture:** A full-screen `/scan` flow (client state machine: capture → processing → confirm) posts the photo to `POST /api/ingest`, which uploads to Vercel Blob and calls OpenAI for a transparent-background cutout plus structured-JSON tags — or returns static fixtures when `MOCK_AI=1`. Confirmed items are saved via `POST /api/items` into a new Drizzle `items` table; the Closet tab becomes a server-component grid reading the DB directly, with a detail page for edit/delete.

**Tech Stack:** Next.js 16 App Router (TS, Tailwind v4), Drizzle + Neon, Vercel Blob (`@vercel/blob`), OpenAI SDK (`openai`, gpt-image-1 + gpt-4.1-mini), Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-06-11-m2-closet-capture-design.md`

**Out of scope:** avatar capture (slice 2), calendar/weather (slice 3), batch ingestion, wear tracking (M5).

---

## File structure

```
lib/
  closet/
    categories.ts            # CATEGORIES const, Category type, labels, isCategory guard
    types.ts                 # ClosetItem shared type
    suggestion.ts            # validateSuggestion, mismatchWarning, deriveName, cleanStrings (TDD)
    suggestion.test.ts
    item-validation.ts       # validateNewItem, validateItemPatch, UUID_RE (TDD)
    item-validation.test.ts
    filter.ts                # filterItems, distinctColors (TDD)
    filter.test.ts
  ai/
    openai.ts                # lazy OpenAI client getter (learned rule: no module-scope clients)
    ingest.ts                # runIngestPipeline: MOCK_AI fixtures or Blob+OpenAI; IngestResult type
    ingest.test.ts           # mock-path unit test
  storage/
    blob.ts                  # putImage, deleteImages (skips non-Blob URLs)
  db/
    schema.ts                # MODIFY: add items table
app/
  api/
    ingest/route.ts          # POST: photo+category → cutout/tags (never 500s on AI failure)
    items/route.ts           # POST: save confirmed item
    items/[id]/route.ts      # PATCH edit, DELETE (row + blobs)
  scan/page.tsx              # full-screen scan flow (outside (tabs) layout, behind middleware)
  (tabs)/closet/page.tsx     # MODIFY: placeholder → filterable grid
  (tabs)/closet/[id]/page.tsx# item detail (server) → ItemDetailForm
components/
  scan/
    ScanFlow.tsx             # client state machine: capture → processing → confirm → error
    CaptureScreen.tsx        # getUserMedia viewfinder + outline + shutter + library fallback
    ConfirmSheet.tsx         # editable name/category/colors/tags, warning, save actions
    CategoryChips.tsx        # shared category radio chips (capture + confirm + detail)
    TagChips.tsx             # editable chip list (colors, style tags)
    outlines.tsx             # five SVG outline shapes + hints, data-testid per category
    downscale.ts             # client-side resize to ≤1500px JPEG (falls back to original blob)
  closet/
    ItemDetailForm.tsx       # client edit/delete form
public/fixtures/
  cutout-top.svg             # MOCK_AI cutout fixture (text asset, no binaries)
  original-top.svg           # MOCK_AI original fixture
e2e/
  fixtures/garment.svg       # upload fixture for setInputFiles
  closet.spec.ts             # runs after auth-flow.spec.ts alphabetically (learned rule)
  global-setup.ts            # MODIFY: wipe items table too
playwright.config.ts         # MODIFY: fake-camera flags, MOCK_AI=1 for webServer
.env.example                 # MODIFY: OPENAI_API_KEY, MOCK_AI, BLOB_READ_WRITE_TOKEN
CLAUDE.md                    # MODIFY: stack line Gemini→OpenAI, current-plan pointer
```

**Conventions used throughout:**
- All git commands quote paths containing `(tabs)`.
- Client components import server-touching types with `import type` ONLY (e.g. `import type { IngestResult } from "@/lib/ai/ingest"`) — a value import would bundle the OpenAI/Blob SDKs into the client.
- Plain `<img>` tags, not `next/image` (Blob-hosted remote URLs would need remotePatterns config; YAGNI for a single-user PWA).

---

### Task 1: Dependencies, env vars, docs

**Files:**
- Modify: `.env.example`, `.env.local`, `CLAUDE.md`

- [ ] **Step 1: Install dependencies**

```bash
npm install openai @vercel/blob
```

- [ ] **Step 2: Replace the reserved block in `.env.example`** — the file currently ends with a `# --- reserved for M2+ ---` block mentioning `GEMINI_API_KEY`. Replace that whole block so the file reads:

```
# Neon Postgres connection string
DATABASE_URL=
# 32+ random bytes, base64 — sessions are signed with this
SESSION_SECRET=
# OpenAI API key — server-side only, used for cutouts + tagging (and renders/stylist later)
OPENAI_API_KEY=
# Set to 1 to serve canned AI fixtures instead of calling OpenAI/Blob (dev + all tests)
MOCK_AI=
# Vercel Blob read-write token (auto-set on Vercel; locally: npx vercel env pull .env.local)
BLOB_READ_WRITE_TOKEN=
```

- [ ] **Step 3: Append to `.env.local`** (developer machine only, gitignored):

```
MOCK_AI=1
```

This keeps every local dev server and test run on fixtures by default. (Note: the dev server must be restarted to pick up `.env.local` changes.)

- [ ] **Step 4: Update `CLAUDE.md`**

In the Stack section, replace the line:

```
Vercel Blob (wired in M2) · Gemini API (all AI, from M2) · jose sessions + bcryptjs passcode.
```

with:

```
Vercel Blob · OpenAI API (all AI; superseded Gemini per the M2 spec) · jose sessions + bcryptjs passcode.
Dev/tests always run with MOCK_AI=1 (canned fixtures, no OpenAI/Blob calls).
```

And replace the `- Current plan:` line with:

```
- Current plan: docs/superpowers/plans/2026-06-11-m2-closet-capture.md
```

- [ ] **Step 5: Verify `.env.local` is not staged, then commit**

```bash
git status --short   # must NOT list .env.local
git add package.json package-lock.json .env.example CLAUDE.md
git commit -m "chore: add openai + vercel blob deps, M2 env vars, OpenAI stack docs"
```

---

### Task 2: `items` table + e2e wipe

**Files:**
- Modify: `lib/db/schema.ts`, `e2e/global-setup.ts`

- [ ] **Step 1: Add the items table to `lib/db/schema.ts`** (append below `settings`; add the imports shown):

```ts
import { sql } from "drizzle-orm";
import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export const items = pgTable("items", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  // Keep in sync with CATEGORIES in lib/closet/categories.ts
  category: text("category", {
    enum: ["top", "bottom", "jacket", "shoes", "hat"],
  }).notNull(),
  colors: text("colors").array().notNull().default(sql`'{}'::text[]`),
  styleTags: text("style_tags").array().notNull().default(sql`'{}'::text[]`),
  imageUrl: text("image_url").notNull(),
  originalImageUrl: text("original_image_url").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
```

- [ ] **Step 2: Push the schema to Neon**

Run: `npm run db:push`
Expected: reports the `items` table created, exit 0.

- [ ] **Step 3: Update `e2e/global-setup.ts`** to wipe items as well (full file):

```ts
import { config } from "dotenv";
config({ path: ".env.local" });

export default async function globalSetup() {
  const { neon } = await import("@neondatabase/serverless");
  const sql = neon(process.env.DATABASE_URL!);
  await sql`CREATE TABLE IF NOT EXISTS settings (key text PRIMARY KEY, value text NOT NULL)`;
  await sql`CREATE TABLE IF NOT EXISTS items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    category text NOT NULL,
    colors text[] NOT NULL DEFAULT '{}',
    style_tags text[] NOT NULL DEFAULT '{}',
    image_url text NOT NULL,
    original_image_url text NOT NULL,
    created_at timestamp NOT NULL DEFAULT now()
  )`;
  await sql`DELETE FROM settings`;
  await sql`DELETE FROM items`;
}
```

- [ ] **Step 4: Verify nothing broke, commit**

Run: `npm test && npm run typecheck` → all green, exit 0.

```bash
git add lib/db/schema.ts e2e/global-setup.ts
git commit -m "feat: items table schema, e2e wipes items"
```

---

### Task 3: Categories + suggestion validator (TDD)

**Files:**
- Create: `lib/closet/categories.ts`, `lib/closet/types.ts`, `lib/closet/suggestion.ts`
- Test: `lib/closet/suggestion.test.ts`

- [ ] **Step 1: Write `lib/closet/categories.ts`** (no test — pure constants):

```ts
export const CATEGORIES = ["top", "bottom", "jacket", "shoes", "hat"] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  top: "Top",
  bottom: "Bottom",
  jacket: "Jacket",
  shoes: "Shoes",
  hat: "Hat",
};

export function isCategory(value: unknown): value is Category {
  return (
    typeof value === "string" &&
    (CATEGORIES as readonly string[]).includes(value)
  );
}
```

- [ ] **Step 2: Write `lib/closet/types.ts`**:

```ts
import type { Category } from "./categories";

export type ClosetItem = {
  id: string;
  name: string;
  category: Category;
  colors: string[];
  styleTags: string[];
  imageUrl: string;
  originalImageUrl: string;
  createdAt: Date;
};
```

- [ ] **Step 3: Write the failing test `lib/closet/suggestion.test.ts`**:

```ts
import { describe, expect, it } from "vitest";
import {
  deriveName,
  mismatchWarning,
  validateSuggestion,
} from "./suggestion";

describe("validateSuggestion", () => {
  it("accepts a well-formed suggestion and normalizes strings", () => {
    const s = validateSuggestion({
      name: "  Light blue oxford shirt  ",
      colors: [" Light Blue ", "WHITE"],
      styleTags: ["Smart Casual"],
      detectedCategory: "top",
    });
    expect(s).toEqual({
      name: "Light blue oxford shirt",
      colors: ["light blue", "white"],
      styleTags: ["smart casual"],
      detectedCategory: "top",
    });
  });

  it("rejects non-objects and missing names", () => {
    expect(validateSuggestion(null)).toBeNull();
    expect(validateSuggestion("nope")).toBeNull();
    expect(validateSuggestion({ colors: ["red"] })).toBeNull();
    expect(validateSuggestion({ name: "   " })).toBeNull();
  });

  it("caps name length and array sizes, drops junk entries", () => {
    const s = validateSuggestion({
      name: "x".repeat(200),
      colors: ["red", 5, "", "blue", "green", "grey", "navy", "tan", "pink"],
      styleTags: Array.from({ length: 20 }, (_, i) => `tag${i}`),
      detectedCategory: "sock",
    });
    expect(s?.name).toHaveLength(80);
    expect(s?.colors).toEqual(["red", "blue", "green", "grey", "navy", "tan"]);
    expect(s?.styleTags).toHaveLength(10);
    expect(s?.detectedCategory).toBeNull();
  });
});

describe("mismatchWarning", () => {
  const base = { name: "Shirt", colors: [], styleTags: [] };

  it("is null when categories agree or detection is missing", () => {
    expect(mismatchWarning(null, "top")).toBeNull();
    expect(
      mismatchWarning({ ...base, detectedCategory: null }, "top"),
    ).toBeNull();
    expect(
      mismatchWarning({ ...base, detectedCategory: "top" }, "top"),
    ).toBeNull();
  });

  it("describes the mismatch otherwise", () => {
    expect(
      mismatchWarning({ ...base, detectedCategory: "jacket" }, "top"),
    ).toBe("This looks more like a jacket than a top.");
  });
});

describe("deriveName", () => {
  it("uses the first color when available", () => {
    expect(deriveName("top", ["light blue", "white"])).toBe("Light blue top");
  });

  it("falls back to a generic name", () => {
    expect(deriveName("shoes", [])).toBe("New shoes");
  });
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `npx vitest run lib/closet/suggestion.test.ts`
Expected: FAIL — `Cannot find module './suggestion'`

- [ ] **Step 5: Write `lib/closet/suggestion.ts`**:

```ts
import { type Category, isCategory } from "./categories";

export type Suggestion = {
  name: string;
  colors: string[];
  styleTags: string[];
  detectedCategory: Category | null;
};

const MAX_NAME = 80;
const MAX_COLORS = 6;
const MAX_TAGS = 10;
const MAX_TAG_LENGTH = 40;

export function cleanStrings(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is string => typeof v === "string")
    .map((v) => v.trim().toLowerCase())
    .filter((v) => v.length > 0 && v.length <= MAX_TAG_LENGTH)
    .slice(0, max);
}

export function validateSuggestion(raw: unknown): Suggestion | null {
  if (typeof raw !== "object" || raw === null) return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.name !== "string" || o.name.trim().length === 0) return null;
  return {
    name: o.name.trim().slice(0, MAX_NAME),
    colors: cleanStrings(o.colors, MAX_COLORS),
    styleTags: cleanStrings(o.styleTags, MAX_TAGS),
    detectedCategory: isCategory(o.detectedCategory) ? o.detectedCategory : null,
  };
}

export function mismatchWarning(
  suggestion: Suggestion | null,
  chosen: Category,
): string | null {
  if (!suggestion?.detectedCategory) return null;
  if (suggestion.detectedCategory === chosen) return null;
  return `This looks more like a ${suggestion.detectedCategory} than a ${chosen}.`;
}

export function deriveName(category: Category, colors: string[]): string {
  const color = colors[0]?.trim();
  if (!color) return `New ${category}`;
  return `${color[0].toUpperCase()}${color.slice(1)} ${category}`;
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx vitest run lib/closet/suggestion.test.ts`
Expected: PASS (all tests)

- [ ] **Step 7: Commit**

```bash
git add lib/closet/categories.ts lib/closet/types.ts lib/closet/suggestion.ts lib/closet/suggestion.test.ts
git commit -m "feat: garment categories and AI suggestion validator (TDD)"
```

---

### Task 4: Item payload validation (TDD)

**Files:**
- Create: `lib/closet/item-validation.ts`
- Test: `lib/closet/item-validation.test.ts`

- [ ] **Step 1: Write the failing test `lib/closet/item-validation.test.ts`**:

```ts
import { describe, expect, it } from "vitest";
import { validateItemPatch, validateNewItem } from "./item-validation";

const valid = {
  name: "Light blue oxford shirt",
  category: "top",
  colors: ["light blue"],
  styleTags: ["smart casual"],
  imageUrl: "https://blob.example.com/cutout.png",
  originalImageUrl: "/fixtures/original-top.svg",
};

describe("validateNewItem", () => {
  it("accepts a valid payload", () => {
    const r = validateNewItem(valid);
    expect(r).toEqual({ ok: true, value: valid });
  });

  it("defaults missing arrays to empty", () => {
    const { colors: _c, styleTags: _s, ...rest } = valid;
    const r = validateNewItem(rest);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.colors).toEqual([]);
      expect(r.value.styleTags).toEqual([]);
    }
  });

  it.each([
    ["missing name", { ...valid, name: "  " }],
    ["bad category", { ...valid, category: "sock" }],
    ["bad imageUrl", { ...valid, imageUrl: "javascript:alert(1)" }],
    ["bad originalImageUrl", { ...valid, originalImageUrl: "" }],
    ["non-object", "nope"],
  ])("rejects %s", (_label, payload) => {
    expect(validateNewItem(payload).ok).toBe(false);
  });
});

describe("validateItemPatch", () => {
  it("accepts a partial update", () => {
    const r = validateItemPatch({ name: "Renamed", category: "jacket" });
    expect(r).toEqual({
      ok: true,
      value: { name: "Renamed", category: "jacket" },
    });
  });

  it("rejects an empty patch", () => {
    expect(validateItemPatch({}).ok).toBe(false);
  });

  it("rejects invalid fields even when others are valid", () => {
    expect(validateItemPatch({ name: "ok", category: "sock" }).ok).toBe(false);
  });

  it("normalizes colors and styleTags", () => {
    const r = validateItemPatch({ colors: [" Red ", ""], styleTags: ["WARM"] });
    expect(r).toEqual({
      ok: true,
      value: { colors: ["red"], styleTags: ["warm"] },
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/closet/item-validation.test.ts`
Expected: FAIL — `Cannot find module './item-validation'`

- [ ] **Step 3: Write `lib/closet/item-validation.ts`**:

```ts
import { type Category, isCategory } from "./categories";
import { cleanStrings } from "./suggestion";

export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type NewItem = {
  name: string;
  category: Category;
  colors: string[];
  styleTags: string[];
  imageUrl: string;
  originalImageUrl: string;
};

export type ItemPatch = Partial<
  Pick<NewItem, "name" | "category" | "colors" | "styleTags">
>;

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

const MAX_NAME = 120;

function cleanName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= MAX_NAME ? trimmed : null;
}

// Blob URLs are https; MOCK_AI fixtures are root-relative paths.
function isImageUrl(value: unknown): value is string {
  return (
    typeof value === "string" &&
    (value.startsWith("https://") || value.startsWith("/"))
  );
}

export function validateNewItem(raw: unknown): Result<NewItem> {
  if (typeof raw !== "object" || raw === null) {
    return { ok: false, error: "Body must be an object." };
  }
  const o = raw as Record<string, unknown>;
  const name = cleanName(o.name);
  if (!name) return { ok: false, error: "Name is required (max 120 chars)." };
  if (!isCategory(o.category)) return { ok: false, error: "Invalid category." };
  if (!isImageUrl(o.imageUrl)) return { ok: false, error: "Invalid imageUrl." };
  if (!isImageUrl(o.originalImageUrl)) {
    return { ok: false, error: "Invalid originalImageUrl." };
  }
  return {
    ok: true,
    value: {
      name,
      category: o.category,
      colors: cleanStrings(o.colors, 6),
      styleTags: cleanStrings(o.styleTags, 10),
      imageUrl: o.imageUrl,
      originalImageUrl: o.originalImageUrl,
    },
  };
}

export function validateItemPatch(raw: unknown): Result<ItemPatch> {
  if (typeof raw !== "object" || raw === null) {
    return { ok: false, error: "Body must be an object." };
  }
  const o = raw as Record<string, unknown>;
  const patch: ItemPatch = {};
  if ("name" in o) {
    const name = cleanName(o.name);
    if (!name) return { ok: false, error: "Invalid name." };
    patch.name = name;
  }
  if ("category" in o) {
    if (!isCategory(o.category)) {
      return { ok: false, error: "Invalid category." };
    }
    patch.category = o.category;
  }
  if ("colors" in o) patch.colors = cleanStrings(o.colors, 6);
  if ("styleTags" in o) patch.styleTags = cleanStrings(o.styleTags, 10);
  if (Object.keys(patch).length === 0) {
    return { ok: false, error: "No editable fields provided." };
  }
  return { ok: true, value: patch };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run lib/closet/item-validation.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/closet/item-validation.ts lib/closet/item-validation.test.ts
git commit -m "feat: item create/patch payload validation (TDD)"
```

---

### Task 5: Grid filter logic (TDD)

**Files:**
- Create: `lib/closet/filter.ts`
- Test: `lib/closet/filter.test.ts`

- [ ] **Step 1: Write the failing test `lib/closet/filter.test.ts`**:

```ts
import { describe, expect, it } from "vitest";
import { distinctColors, filterItems } from "./filter";

const items = [
  { category: "top", colors: ["white", "blue"] },
  { category: "top", colors: ["red"] },
  { category: "shoes", colors: ["white"] },
];

describe("filterItems", () => {
  it("returns everything with no filters", () => {
    expect(filterItems(items, {})).toHaveLength(3);
  });

  it("filters by category", () => {
    expect(filterItems(items, { category: "top" })).toHaveLength(2);
  });

  it("filters by color", () => {
    expect(filterItems(items, { color: "white" })).toHaveLength(2);
  });

  it("combines category and color", () => {
    expect(filterItems(items, { category: "top", color: "white" })).toEqual([
      items[0],
    ]);
  });
});

describe("distinctColors", () => {
  it("returns sorted unique colors", () => {
    expect(distinctColors(items)).toEqual(["blue", "red", "white"]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/closet/filter.test.ts`
Expected: FAIL — `Cannot find module './filter'`

- [ ] **Step 3: Write `lib/closet/filter.ts`**:

```ts
export type Filterable = { category: string; colors: string[] };

export function filterItems<T extends Filterable>(
  items: T[],
  filters: { category?: string; color?: string },
): T[] {
  return items.filter(
    (item) =>
      (!filters.category || item.category === filters.category) &&
      (!filters.color || item.colors.includes(filters.color)),
  );
}

export function distinctColors(items: Filterable[]): string[] {
  return [...new Set(items.flatMap((item) => item.colors))].sort();
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run lib/closet/filter.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/closet/filter.ts lib/closet/filter.test.ts
git commit -m "feat: closet grid filter logic (TDD)"
```

---

### Task 6: Fixtures, Blob wrapper, OpenAI client, ingest pipeline

**Files:**
- Create: `public/fixtures/cutout-top.svg`, `public/fixtures/original-top.svg`, `e2e/fixtures/garment.svg`, `lib/storage/blob.ts`, `lib/ai/openai.ts`, `lib/ai/ingest.ts`
- Test: `lib/ai/ingest.test.ts`

- [ ] **Step 1: Write `public/fixtures/cutout-top.svg`** (SVG = text asset, no binaries in git; transparent background like a real cutout):

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 180" width="400" height="360">
  <path d="M70 20 Q100 35 130 20 L165 40 L150 75 L135 65 L135 160 L65 160 L65 65 L50 75 L35 40 Z" fill="#7aa2c4"/>
</svg>
```

- [ ] **Step 2: Write `public/fixtures/original-top.svg`** (same shirt on a grey "photo" background):

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 180" width="400" height="360">
  <rect width="200" height="180" fill="#d8d4cf"/>
  <path d="M70 20 Q100 35 130 20 L165 40 L150 75 L135 65 L135 160 L65 160 L65 65 L50 75 L35 40 Z" fill="#7aa2c4"/>
</svg>
```

- [ ] **Step 3: Write `e2e/fixtures/garment.svg`** (upload fixture for Playwright `setInputFiles`):

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
  <rect width="100" height="100" fill="#b8c4d0"/>
</svg>
```

- [ ] **Step 4: Write `lib/storage/blob.ts`**:

```ts
import { del, put } from "@vercel/blob";

export async function putImage(
  path: string,
  data: Buffer,
  contentType: string,
): Promise<string> {
  const { url } = await put(path, data, {
    access: "public",
    contentType,
    addRandomSuffix: true,
  });
  return url;
}

// Best-effort cleanup. MOCK_AI fixture URLs are root-relative — skip those.
export async function deleteImages(urls: Array<string | null>): Promise<void> {
  const blobUrls = urls.filter(
    (u): u is string => !!u && u.startsWith("https://"),
  );
  if (blobUrls.length === 0) return;
  try {
    await del(blobUrls);
  } catch {
    // Orphaned blobs are preferable to a failed delete request.
  }
}
```

- [ ] **Step 5: Write `lib/ai/openai.ts`**:

```ts
import OpenAI from "openai";

let _client: OpenAI | undefined;

export function getOpenAI(): OpenAI {
  // Lazy: constructed at call time, not import time (learned rule — module-scope
  // clients crash `next build` when the env var is missing).
  if (!_client) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY is not set");
    _client = new OpenAI({ apiKey });
  }
  return _client;
}
```

- [ ] **Step 6: Write the failing test `lib/ai/ingest.test.ts`** (mock path only — the real path is smoke-tested manually at the milestone boundary):

```ts
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runIngestPipeline } from "./ingest";

describe("runIngestPipeline with MOCK_AI=1", () => {
  const previous = process.env.MOCK_AI;
  beforeEach(() => {
    process.env.MOCK_AI = "1";
  });
  afterEach(() => {
    process.env.MOCK_AI = previous;
  });

  it("returns fixture urls and a suggestion without touching OpenAI/Blob", async () => {
    const result = await runIngestPipeline(
      Buffer.from("not-a-real-image"),
      "image/jpeg",
      "shoes",
    );
    expect(result.originalUrl).toBe("/fixtures/original-top.svg");
    expect(result.cutoutUrl).toBe("/fixtures/cutout-top.svg");
    expect(result.suggestion?.name).toBe("Light blue oxford shirt");
    expect(result.suggestion?.detectedCategory).toBe("shoes");
    expect(result.warning).toBeNull();
  });
});
```

- [ ] **Step 7: Run the test to verify it fails**

Run: `npx vitest run lib/ai/ingest.test.ts`
Expected: FAIL — `Cannot find module './ingest'`

- [ ] **Step 8: Write `lib/ai/ingest.ts`**:

```ts
import { toFile } from "openai";
import { CATEGORIES, type Category } from "@/lib/closet/categories";
import {
  mismatchWarning,
  type Suggestion,
  validateSuggestion,
} from "@/lib/closet/suggestion";
import { putImage } from "@/lib/storage/blob";
import { getOpenAI } from "./openai";

export type IngestResult = {
  originalUrl: string;
  cutoutUrl: string | null;
  suggestion: Suggestion | null;
  warning: string | null;
};

const IMAGE_MODEL = "gpt-image-1";
const VISION_MODEL = "gpt-4.1-mini";

function isMockAi(): boolean {
  return process.env.MOCK_AI === "1";
}

export async function runIngestPipeline(
  photo: Buffer,
  mime: string,
  category: Category,
): Promise<IngestResult> {
  if (isMockAi()) {
    const suggestion: Suggestion = {
      name: "Light blue oxford shirt",
      colors: ["light blue"],
      styleTags: ["smart casual", "all-season"],
      detectedCategory: category,
    };
    return {
      originalUrl: "/fixtures/original-top.svg",
      cutoutUrl: "/fixtures/cutout-top.svg",
      suggestion,
      warning: null,
    };
  }

  const ext = mime === "image/png" ? "png" : "jpg";
  // If even the original upload fails there is nothing to confirm — let it throw;
  // the route maps it to 502. AI failures below degrade to partial results.
  const originalUrl = await putImage(`items/original.${ext}`, photo, mime);
  const [cutoutUrl, suggestion] = await Promise.all([
    cutout(photo, mime).catch(() => null),
    tag(photo, mime, category).catch(() => null),
  ]);
  return {
    originalUrl,
    cutoutUrl,
    suggestion,
    warning: mismatchWarning(suggestion, category),
  };
}

async function cutout(photo: Buffer, mime: string): Promise<string | null> {
  const res = await getOpenAI().images.edit({
    model: IMAGE_MODEL,
    image: await toFile(photo, "garment", { type: mime }),
    prompt:
      "Remove the background completely. Keep only the clothing item, " +
      "unaltered and centered, on a fully transparent background.",
    background: "transparent",
    size: "1024x1024",
  });
  const b64 = res.data?.[0]?.b64_json;
  if (!b64) return null;
  return putImage("items/cutout.png", Buffer.from(b64, "base64"), "image/png");
}

async function tag(
  photo: Buffer,
  mime: string,
  category: Category,
): Promise<Suggestion | null> {
  const res = await getOpenAI().chat.completions.create({
    model: VISION_MODEL,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "garment_tags",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          required: ["name", "colors", "styleTags", "detectedCategory"],
          properties: {
            name: { type: "string" },
            colors: { type: "array", items: { type: "string" } },
            styleTags: { type: "array", items: { type: "string" } },
            detectedCategory: { type: "string", enum: [...CATEGORIES] },
          },
        },
      },
    },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text:
              `Catalog this garment for a personal closet. The user filed it as a "${category}". ` +
              `Return: name (short and descriptive, e.g. "Light blue oxford shirt"); ` +
              `colors (1-4 lowercase color names); ` +
              `styleTags (2-6 lowercase tags covering formality, season, warmth); ` +
              `detectedCategory (what the photo actually shows).`,
          },
          {
            type: "image_url",
            image_url: { url: `data:${mime};base64,${photo.toString("base64")}` },
          },
        ],
      },
    ],
  });
  const text = res.choices[0]?.message?.content;
  if (!text) return null;
  return validateSuggestion(JSON.parse(text));
}
```

- [ ] **Step 9: Run the test to verify it passes**

Run: `npx vitest run lib/ai/ingest.test.ts`
Expected: PASS

- [ ] **Step 10: Typecheck and commit**

Run: `npm run typecheck` → exit 0

```bash
git add public/fixtures e2e/fixtures lib/storage/blob.ts lib/ai
git commit -m "feat: ingest pipeline - blob wrapper, openai client, MOCK_AI fixtures"
```

---

### Task 7: `POST /api/ingest` route

**Files:**
- Create: `app/api/ingest/route.ts`

- [ ] **Step 1: Write `app/api/ingest/route.ts`**:

```ts
import { NextRequest, NextResponse } from "next/server";
import { runIngestPipeline } from "@/lib/ai/ingest";
import { isCategory } from "@/lib/closet/categories";

// Cutout + tagging can take a while on a slow day.
export const maxDuration = 60;

const MAX_BYTES = 10 * 1024 * 1024;

export async function POST(req: NextRequest) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data." }, { status: 400 });
  }

  const photo = form.get("photo");
  const category = form.get("category");
  if (!(photo instanceof File) || photo.size === 0) {
    return NextResponse.json({ error: "A photo is required." }, { status: 400 });
  }
  if (!isCategory(category)) {
    return NextResponse.json({ error: "Invalid category." }, { status: 400 });
  }
  if (photo.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "Photo too large (max 10 MB)." },
      { status: 413 },
    );
  }

  try {
    const buffer = Buffer.from(await photo.arrayBuffer());
    const result = await runIngestPipeline(
      buffer,
      photo.type || "image/jpeg",
      category,
    );
    return NextResponse.json(result);
  } catch {
    // Only infrastructure (the original Blob upload) throws — AI failures
    // come back as partial results from the pipeline.
    return NextResponse.json(
      { error: "Upload failed — try again." },
      { status: 502 },
    );
  }
}
```

- [ ] **Step 2: Typecheck and commit** (e2e coverage lands with the scan page in Task 12)

Run: `npm run typecheck` → exit 0

```bash
git add app/api/ingest/route.ts
git commit -m "feat: ingest API route - photo to cutout and suggested tags"
```

---

### Task 8: Items CRUD routes

**Files:**
- Create: `app/api/items/route.ts`, `app/api/items/[id]/route.ts`

- [ ] **Step 1: Write `app/api/items/route.ts`**:

```ts
import { NextRequest, NextResponse } from "next/server";
import { validateNewItem } from "@/lib/closet/item-validation";
import { getDb } from "@/lib/db/client";
import { items } from "@/lib/db/schema";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const parsed = validateNewItem(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const [item] = await getDb().insert(items).values(parsed.value).returning();
  return NextResponse.json({ item }, { status: 201 });
}
```

- [ ] **Step 2: Write `app/api/items/[id]/route.ts`** (Next 16: `params` is a Promise):

```ts
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import {
  UUID_RE,
  validateItemPatch,
} from "@/lib/closet/item-validation";
import { getDb } from "@/lib/db/client";
import { items } from "@/lib/db/schema";
import { deleteImages } from "@/lib/storage/blob";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const parsed = validateItemPatch(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const [item] = await getDb()
    .update(items)
    .set(parsed.value)
    .where(eq(items.id, id))
    .returning();
  if (!item) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json({ item });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  const [item] = await getDb()
    .delete(items)
    .where(eq(items.id, id))
    .returning();
  if (!item) return NextResponse.json({ error: "Not found." }, { status: 404 });
  // Spec: no orphan storage — remove the Blob images with the row.
  await deleteImages([item.imageUrl, item.originalImageUrl]);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Typecheck and commit**

Run: `npm run typecheck` → exit 0

```bash
git add app/api/items
git commit -m "feat: items CRUD routes - create, patch, delete with blob cleanup"
```

---

### Task 9: Shared chips + ConfirmSheet components

**Files:**
- Create: `components/scan/CategoryChips.tsx`, `components/scan/TagChips.tsx`, `components/scan/ConfirmSheet.tsx`

- [ ] **Step 1: Write `components/scan/CategoryChips.tsx`**:

```tsx
"use client";

import {
  CATEGORIES,
  CATEGORY_LABELS,
  type Category,
} from "@/lib/closet/categories";

export default function CategoryChips({
  value,
  onChange,
  dark = false,
}: {
  value: Category;
  onChange: (category: Category) => void;
  dark?: boolean;
}) {
  return (
    <div className="flex flex-wrap justify-center gap-2" role="radiogroup" aria-label="Category">
      {CATEGORIES.map((category) => {
        const active = category === value;
        const activeClass = dark
          ? "bg-white text-neutral-900"
          : "bg-neutral-900 text-white";
        const idleClass = dark
          ? "bg-neutral-700 text-neutral-300"
          : "bg-neutral-200 text-neutral-600";
        return (
          <button
            key={category}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(category)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium ${active ? activeClass : idleClass}`}
          >
            {CATEGORY_LABELS[category]}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Write `components/scan/TagChips.tsx`**:

```tsx
"use client";

import { useState } from "react";

export default function TagChips({
  label,
  values,
  onChange,
}: {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
}) {
  const [draft, setDraft] = useState("");

  function add() {
    const value = draft.trim().toLowerCase();
    if (value && !values.includes(value)) onChange([...values, value]);
    setDraft("");
  }

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
        {label}
      </p>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        {values.map((value) => (
          <span
            key={value}
            className="flex items-center gap-1 rounded-full bg-neutral-200 px-3 py-1 text-sm"
          >
            {value}
            <button
              type="button"
              aria-label={`Remove ${value}`}
              onClick={() => onChange(values.filter((v) => v !== value))}
            >
              ×
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          onBlur={add}
          placeholder={`+ add ${label.toLowerCase()}`}
          aria-label={`Add ${label.toLowerCase()}`}
          className="w-36 rounded-full border border-dashed border-neutral-400 px-3 py-1 text-sm"
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Write `components/scan/ConfirmSheet.tsx`** — note the `import type` for `IngestResult` (a value import would pull the OpenAI/Blob SDKs into the client bundle):

```tsx
"use client";

import { useState } from "react";
import type { IngestResult } from "@/lib/ai/ingest";
import type { Category } from "@/lib/closet/categories";
import { deriveName, mismatchWarning } from "@/lib/closet/suggestion";
import CategoryChips from "./CategoryChips";
import TagChips from "./TagChips";

export default function ConfirmSheet({
  result,
  initialCategory,
  onSaved,
  onRetake,
}: {
  result: IngestResult;
  initialCategory: Category;
  onSaved: (mode: "done" | "another") => void;
  onRetake: () => void;
}) {
  const suggestion = result.suggestion;
  const [category, setCategory] = useState(initialCategory);
  const [name, setName] = useState(
    suggestion?.name ?? deriveName(initialCategory, suggestion?.colors ?? []),
  );
  const [colors, setColors] = useState<string[]>(suggestion?.colors ?? []);
  const [styleTags, setStyleTags] = useState<string[]>(
    suggestion?.styleTags ?? [],
  );
  const [busy, setBusy] = useState<"done" | "another" | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Recomputed live so switching the category chip clears the warning (spec §3.2).
  const warning = mismatchWarning(suggestion, category);

  async function save(mode: "done" | "another") {
    setBusy(mode);
    setError(null);
    const res = await fetch("/api/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        category,
        colors,
        styleTags,
        imageUrl: result.cutoutUrl ?? result.originalUrl,
        originalImageUrl: result.originalUrl,
      }),
    });
    setBusy(null);
    if (!res.ok) {
      setError("Couldn't save — try again.");
      return;
    }
    onSaved(mode);
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 p-4">
      <div
        className="flex h-56 items-center justify-center rounded-xl"
        style={{
          background:
            "repeating-conic-gradient(#e8e8e8 0% 25%, #fff 0% 50%) 0 0 / 16px 16px",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={result.cutoutUrl ?? result.originalUrl}
          alt="Scanned garment"
          className="max-h-full max-w-full object-contain"
        />
      </div>

      {!suggestion && (
        <p className="text-sm text-neutral-500">
          AI tagging wasn’t available — fill in the details yourself.
        </p>
      )}
      {warning && (
        <p role="status" className="rounded-lg bg-amber-100 px-3 py-2 text-sm text-amber-900">
          ⚠️ {warning}
        </p>
      )}

      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        aria-label="Name"
        className="rounded-xl border border-neutral-300 p-3 text-lg"
      />
      <CategoryChips value={category} onChange={setCategory} />
      <TagChips label="Colors" values={colors} onChange={setColors} />
      <TagChips label="Style tags" values={styleTags} onChange={setStyleTags} />

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => save("done")}
          className="flex-1 rounded-xl bg-neutral-900 p-3 font-semibold text-white disabled:opacity-50"
        >
          {busy === "done" ? "…" : "Save"}
        </button>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => save("another")}
          className="flex-1 rounded-xl bg-neutral-700 p-3 font-semibold text-white disabled:opacity-50"
        >
          {busy === "another" ? "…" : "Save & scan another"}
        </button>
      </div>
      <button
        type="button"
        onClick={onRetake}
        className="text-sm text-neutral-500 underline"
      >
        ↻ Retake
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Typecheck and commit**

Run: `npm run typecheck` → exit 0

```bash
git add components/scan/CategoryChips.tsx components/scan/TagChips.tsx components/scan/ConfirmSheet.tsx
git commit -m "feat: confirm sheet with editable category, color and style chips"
```

---

### Task 10: Outlines, downscale, CaptureScreen

**Files:**
- Create: `components/scan/outlines.tsx`, `components/scan/downscale.ts`, `components/scan/CaptureScreen.tsx`

- [ ] **Step 1: Write `components/scan/outlines.tsx`** (decorative dashed guides; exact shapes are not load-bearing):

```tsx
import type { Category } from "@/lib/closet/categories";

const PATHS: Record<Category, string> = {
  top: "M70 20 Q100 35 130 20 L165 40 L150 75 L135 65 L135 160 L65 160 L65 65 L50 75 L35 40 Z",
  bottom: "M68 20 L132 20 L140 160 L108 160 L100 70 L92 160 L60 160 Z",
  jacket:
    "M70 15 Q100 28 130 15 L168 38 L152 78 L138 66 L138 165 L104 152 L96 152 L62 165 L62 66 L48 78 L32 38 Z",
  shoes:
    "M30 110 Q30 88 52 86 L92 82 Q122 80 142 100 L170 112 Q177 117 172 127 L32 127 Q28 120 30 110 Z",
  hat: "M60 100 Q60 52 100 52 Q140 52 140 100 L172 102 Q178 108 170 112 L40 112 Q32 108 38 102 Z",
};

export const OUTLINE_HINTS: Record<Category, string> = {
  top: "Lay the top flat inside the outline",
  bottom: "Lay the bottoms flat inside the outline",
  jacket: "Lay the jacket flat inside the outline",
  shoes: "Place the shoes side-on inside the outline",
  hat: "Place the hat inside the outline",
};

export function Outline({ category }: { category: Category }) {
  return (
    <svg
      viewBox="0 0 200 180"
      data-testid={`outline-${category}`}
      className="h-auto w-3/4 opacity-80"
    >
      <path
        d={PATHS[category]}
        fill="none"
        stroke="#ffd166"
        strokeWidth="3"
        strokeDasharray="8 6"
        strokeLinejoin="round"
      />
    </svg>
  );
}
```

- [ ] **Step 2: Write `components/scan/downscale.ts`**:

```ts
// Resize a photo to ≤ maxEdge px (longest side) as JPEG, per spec §7.1.
// Falls back to the original blob for formats the browser can't decode
// (e.g. SVG test fixtures) — the server accepts either.
export async function downscalePhoto(
  source: Blob,
  maxEdge = 1500,
): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(source);
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.85),
    );
    return blob ?? source;
  } catch {
    return source;
  }
}
```

- [ ] **Step 3: Write `components/scan/CaptureScreen.tsx`**:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import type { Category } from "@/lib/closet/categories";
import CategoryChips from "./CategoryChips";
import { downscalePhoto } from "./downscale";
import { Outline, OUTLINE_HINTS } from "./outlines";

export default function CaptureScreen({
  category,
  onCategoryChange,
  onPhoto,
  onCancel,
}: {
  category: Category;
  onCategoryChange: (category: Category) => void;
  onPhoto: (photo: Blob) => void;
  onCancel: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraError, setCameraError] = useState(false);

  useEffect(() => {
    let stream: MediaStream | undefined;
    let cancelled = false;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
      } catch {
        setCameraError(true);
      }
    })();
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  async function snap() {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")!.drawImage(video, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.9),
    );
    if (blob) onPhoto(await downscalePhoto(blob));
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) onPhoto(await downscalePhoto(file));
    e.target.value = "";
  }

  return (
    <div className="flex min-h-dvh flex-col gap-4 bg-neutral-950 p-4">
      <CategoryChips value={category} onChange={onCategoryChange} dark />

      <div className="relative flex flex-1 items-center justify-center overflow-hidden rounded-2xl bg-neutral-800">
        {cameraError ? (
          <p className="max-w-xs text-center text-sm text-neutral-300">
            Camera unavailable — use “Choose from library” below to add a photo
            instead.
          </p>
        ) : (
          <>
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video
              ref={videoRef}
              playsInline
              muted
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <Outline category={category} />
            </div>
            <p className="absolute bottom-3 w-full text-center text-xs text-neutral-200">
              {OUTLINE_HINTS[category]}
            </p>
          </>
        )}
      </div>

      <div className="flex items-center justify-between px-4 pb-2">
        <label className="cursor-pointer text-sm text-neutral-300">
          🖼️ Choose from library
          <input
            type="file"
            accept="image/*"
            onChange={onFile}
            className="hidden"
          />
        </label>
        <button
          type="button"
          aria-label="Take photo"
          onClick={snap}
          disabled={cameraError}
          className="h-16 w-16 rounded-full border-4 border-neutral-400 bg-white disabled:opacity-30"
        />
        <button
          type="button"
          onClick={onCancel}
          className="text-sm text-neutral-300"
        >
          ✕ Cancel
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Typecheck and commit**

Run: `npm run typecheck` → exit 0

```bash
git add components/scan/outlines.tsx components/scan/downscale.ts components/scan/CaptureScreen.tsx
git commit -m "feat: guided capture screen - viewfinder, per-category outlines, library fallback"
```

---

### Task 11: Closet grid page

**Files:**
- Modify: `app/(tabs)/closet/page.tsx`
- Create: `e2e/closet.spec.ts` (empty-state test only; the rest accumulates in Tasks 12–13)

- [ ] **Step 1: Replace `app/(tabs)/closet/page.tsx`**:

```tsx
import { desc } from "drizzle-orm";
import Link from "next/link";
import {
  CATEGORIES,
  CATEGORY_LABELS,
  isCategory,
} from "@/lib/closet/categories";
import { distinctColors, filterItems } from "@/lib/closet/filter";
import { getDb } from "@/lib/db/client";
import { items } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

function chipClass(active: boolean) {
  return `rounded-full px-3 py-1 text-sm ${
    active ? "bg-neutral-900 text-white" : "bg-neutral-200 text-neutral-600"
  }`;
}

function href(category?: string, color?: string) {
  const params = new URLSearchParams();
  if (category) params.set("category", category);
  if (color) params.set("color", color);
  const qs = params.toString();
  return qs ? `/closet?${qs}` : "/closet";
}

export default async function ClosetPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; color?: string }>;
}) {
  const params = await searchParams;
  const category = isCategory(params.category) ? params.category : undefined;
  const color = params.color || undefined;

  // Single-user scale: fetch all, filter in memory (unit-tested pure logic).
  const all = await getDb().select().from(items).orderBy(desc(items.createdAt));
  const visible = filterItems(all, { category, color });
  const colors = distinctColors(all);

  return (
    <>
      <h1 className="text-2xl font-semibold">Closet</h1>

      <div className="mt-3 flex flex-wrap gap-2">
        <Link href={href(undefined, color)} className={chipClass(!category)}>
          All
        </Link>
        {CATEGORIES.map((c) => (
          <Link key={c} href={href(c, color)} className={chipClass(category === c)}>
            {CATEGORY_LABELS[c]}s
          </Link>
        ))}
      </div>

      {colors.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          <Link href={href(category)} className={chipClass(!color)}>
            Any color
          </Link>
          {colors.map((c) => (
            <Link key={c} href={href(category, c)} className={chipClass(color === c)}>
              {c}
            </Link>
          ))}
        </div>
      )}

      {all.length === 0 && (
        <p className="mt-6 text-neutral-500">
          Your closet is empty — scan your first item.
        </p>
      )}

      <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
        <Link
          href="/scan"
          className="flex h-36 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-neutral-300 text-sm font-semibold text-neutral-500"
        >
          📷 Scan item
        </Link>
        {visible.map((item) => (
          <Link
            key={item.id}
            href={`/closet/${item.id}`}
            className="flex h-36 flex-col items-center justify-center gap-1 rounded-xl bg-white p-2 shadow-sm"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={item.imageUrl}
              alt={item.name}
              className="min-h-0 flex-1 object-contain"
            />
            <span className="max-w-full truncate text-xs text-neutral-600">
              {item.name}
            </span>
          </Link>
        ))}
      </div>
    </>
  );
}
```

- [ ] **Step 2: Write `e2e/closet.spec.ts`** (first test only — more are appended in Tasks 12–13):

```ts
import { expect, test, type Page } from "@playwright/test";

const PASSCODE = "test-1234";

async function unlock(page: Page) {
  await page.goto("/login");
  if (page.url().endsWith("/setup")) {
    await page.getByLabel("Passcode", { exact: true }).fill(PASSCODE);
    await page.getByLabel("Confirm passcode").fill(PASSCODE);
    await page.getByRole("button", { name: "Create passcode" }).click();
  } else {
    await page.getByLabel("Passcode", { exact: true }).fill(PASSCODE);
    await page.getByRole("button", { name: "Unlock" }).click();
  }
  await expect(page).toHaveURL(/\/closet$/);
}

test.describe.serial("closet", () => {
  test("empty closet shows the scan tile and empty state", async ({ page }) => {
    await unlock(page);
    await expect(page.getByText("Your closet is empty")).toBeVisible();
    await expect(page.getByRole("link", { name: /Scan item/ })).toBeVisible();
  });
});
```

- [ ] **Step 3: Run e2e to verify**

Run: `npm run test:e2e`
Expected: all pass, including "empty closet shows the scan tile" (the `/scan` link 404s if followed — the page arrives in Task 12; this test only asserts the link renders).

- [ ] **Step 4: Typecheck and commit**

Run: `npm run typecheck` → exit 0

```bash
git add "app/(tabs)/closet/page.tsx" e2e/closet.spec.ts
git commit -m "feat: closet grid with category and color filters"
```

---

### Task 12: Scan page wiring + fake camera + scan e2e

**Files:**
- Create: `components/scan/ScanFlow.tsx`, `app/scan/page.tsx`
- Modify: `playwright.config.ts`, `e2e/closet.spec.ts`

- [ ] **Step 1: Write `components/scan/ScanFlow.tsx`**:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { IngestResult } from "@/lib/ai/ingest";
import { CATEGORY_LABELS, type Category } from "@/lib/closet/categories";
import CaptureScreen from "./CaptureScreen";
import ConfirmSheet from "./ConfirmSheet";

type Phase = "capture" | "processing" | "confirm" | "error";

export default function ScanFlow() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("capture");
  const [category, setCategory] = useState<Category>("top");
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [result, setResult] = useState<IngestResult | null>(null);

  async function ingest(blob: Blob) {
    setPhase("processing");
    const form = new FormData();
    form.append("photo", blob, "photo.jpg");
    form.append("category", category);
    try {
      const res = await fetch("/api/ingest", { method: "POST", body: form });
      if (!res.ok) throw new Error(String(res.status));
      setResult((await res.json()) as IngestResult);
      setPhase("confirm");
    } catch {
      setPhase("error");
    }
  }

  function handlePhoto(blob: Blob) {
    setPhoto(blob);
    void ingest(blob);
  }

  if (phase === "capture") {
    return (
      <CaptureScreen
        category={category}
        onCategoryChange={setCategory}
        onPhoto={handlePhoto}
        onCancel={() => router.push("/closet")}
      />
    );
  }

  if (phase === "processing") {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 p-6">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-neutral-300 border-t-neutral-900" />
        <p className="text-neutral-600">
          Analyzing your {CATEGORY_LABELS[category].toLowerCase()}…
        </p>
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6">
        <p className="text-neutral-700">Couldn’t process the photo.</p>
        <button
          type="button"
          onClick={() => photo && ingest(photo)}
          className="rounded-xl bg-neutral-900 px-6 py-3 font-semibold text-white"
        >
          Try again
        </button>
        <button
          type="button"
          onClick={() => setPhase("capture")}
          className="text-sm text-neutral-500 underline"
        >
          Back to camera
        </button>
      </div>
    );
  }

  return (
    <ConfirmSheet
      result={result!}
      initialCategory={category}
      onSaved={(mode) => {
        if (mode === "done") {
          router.push("/closet");
          router.refresh();
        } else {
          setResult(null);
          setPhoto(null);
          setPhase("capture");
        }
      }}
      onRetake={() => setPhase("capture")}
    />
  );
}
```

- [ ] **Step 2: Write `app/scan/page.tsx`** (outside `(tabs)` so the tab bar and padding don't constrain the viewfinder; still passcode-gated by middleware):

```tsx
import ScanFlow from "@/components/scan/ScanFlow";

export default function ScanPage() {
  return <ScanFlow />;
}
```

- [ ] **Step 3: Update `playwright.config.ts`** — fake camera for the viewfinder, `MOCK_AI=1` belt-and-braces for the spawned dev server (full file):

```ts
import { defineConfig } from "@playwright/test";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  workers: 1,
  use: {
    baseURL: BASE,
    launchOptions: {
      // Auto-grant camera permission and feed a synthetic test pattern so the
      // viewfinder works headlessly.
      args: [
        "--use-fake-ui-for-media-stream",
        "--use-fake-device-for-media-stream",
      ],
    },
  },
  webServer: {
    command: "npm run dev",
    url: BASE,
    reuseExistingServer: !process.env.CI,
    env: { ...process.env, MOCK_AI: "1" } as Record<string, string>,
  },
});
```

**Gotcha:** with `reuseExistingServer`, an already-running dev server is used as-is — it must have been started with `MOCK_AI=1` (which `.env.local` now guarantees unless someone removed it).

- [ ] **Step 4: Append scan tests to `e2e/closet.spec.ts`** (inside the `test.describe.serial("closet", ...)` block, after the empty-state test):

```ts
  test("viewfinder renders with the category outline", async ({ page }) => {
    await unlock(page);
    await page.goto("/scan");
    await expect(page.getByTestId("outline-top")).toBeVisible();
    await expect(page.locator("video")).toBeVisible();
    await page.getByRole("radio", { name: "Shoes" }).click();
    await expect(page.getByTestId("outline-shoes")).toBeVisible();
  });

  test("scan via library: ingest, confirm, save, appears in grid", async ({
    page,
  }) => {
    await unlock(page);
    await page.goto("/scan");
    await page
      .locator('input[type="file"]')
      .setInputFiles("e2e/fixtures/garment.svg");
    // Mock pipeline fills the sheet with the fixture suggestion.
    await expect(page.getByLabel("Name")).toHaveValue(
      "Light blue oxford shirt",
      { timeout: 15_000 },
    );
    await page.getByLabel("Name").fill("My test shirt");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page).toHaveURL(/\/closet$/);
    await expect(page.getByText("My test shirt")).toBeVisible();
  });

  test("save & scan another returns to the camera", async ({ page }) => {
    await unlock(page);
    await page.goto("/scan");
    await page
      .locator('input[type="file"]')
      .setInputFiles("e2e/fixtures/garment.svg");
    await expect(page.getByLabel("Name")).toHaveValue(
      "Light blue oxford shirt",
      { timeout: 15_000 },
    );
    await page
      .getByRole("button", { name: "Save & scan another" })
      .click();
    await expect(page.getByTestId("outline-top")).toBeVisible();
  });

  test("category filter narrows the grid", async ({ page }) => {
    await unlock(page);
    await page.goto("/closet?category=shoes");
    await expect(page.getByText("My test shirt")).not.toBeVisible();
    await page.goto("/closet?category=top");
    await expect(page.getByText("My test shirt")).toBeVisible();
  });
```

- [ ] **Step 5: Run e2e to verify**

Run: `npm run test:e2e`
Expected: all pass (auth-flow, closet × 5, tabs). The "save & scan another" test leaves a second item ("Light blue oxford shirt") in the grid — expected; the wipe happens per-run, not per-test.

- [ ] **Step 6: Typecheck and commit**

Run: `npm run typecheck` → exit 0

```bash
git add components/scan/ScanFlow.tsx app/scan/page.tsx playwright.config.ts e2e/closet.spec.ts
git commit -m "feat: scan flow - capture to confirm to closet, e2e with fake camera"
```

---

### Task 13: Item detail page

**Files:**
- Create: `app/(tabs)/closet/[id]/page.tsx`, `components/closet/ItemDetailForm.tsx`
- Modify: `e2e/closet.spec.ts`

- [ ] **Step 1: Write `components/closet/ItemDetailForm.tsx`**:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ClosetItem } from "@/lib/closet/types";
import CategoryChips from "@/components/scan/CategoryChips";
import TagChips from "@/components/scan/TagChips";

export default function ItemDetailForm({ item }: { item: ClosetItem }) {
  const router = useRouter();
  const [name, setName] = useState(item.name);
  const [category, setCategory] = useState(item.category);
  const [colors, setColors] = useState(item.colors);
  const [styleTags, setStyleTags] = useState(item.styleTags);
  const [status, setStatus] = useState<"idle" | "busy" | "saved" | "error">(
    "idle",
  );

  async function save() {
    setStatus("busy");
    const res = await fetch(`/api/items/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, category, colors, styleTags }),
    });
    setStatus(res.ok ? "saved" : "error");
    if (res.ok) router.refresh();
  }

  async function remove() {
    if (!window.confirm(`Delete "${item.name}" from your closet?`)) return;
    setStatus("busy");
    const res = await fetch(`/api/items/${item.id}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/closet");
      router.refresh();
    } else {
      setStatus("error");
    }
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4">
      <div
        className="flex h-64 items-center justify-center rounded-xl"
        style={{
          background:
            "repeating-conic-gradient(#e8e8e8 0% 25%, #fff 0% 50%) 0 0 / 16px 16px",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.imageUrl}
          alt={item.name}
          className="max-h-full max-w-full object-contain"
        />
      </div>

      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        aria-label="Name"
        className="rounded-xl border border-neutral-300 p-3 text-lg"
      />
      <CategoryChips value={category} onChange={setCategory} />
      <TagChips label="Colors" values={colors} onChange={setColors} />
      <TagChips label="Style tags" values={styleTags} onChange={setStyleTags} />

      {status === "saved" && (
        <p role="status" className="text-sm text-green-700">
          Saved.
        </p>
      )}
      {status === "error" && (
        <p role="alert" className="text-sm text-red-600">
          Something went wrong — try again.
        </p>
      )}

      <button
        type="button"
        disabled={status === "busy"}
        onClick={save}
        className="rounded-xl bg-neutral-900 p-3 font-semibold text-white disabled:opacity-50"
      >
        {status === "busy" ? "…" : "Save"}
      </button>
      <button
        type="button"
        disabled={status === "busy"}
        onClick={remove}
        className="text-sm text-red-600 underline"
      >
        Delete item
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Write `app/(tabs)/closet/[id]/page.tsx`**:

```tsx
import { eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import ItemDetailForm from "@/components/closet/ItemDetailForm";
import { UUID_RE } from "@/lib/closet/item-validation";
import { getDb } from "@/lib/db/client";
import { items } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export default async function ItemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const [item] = await getDb().select().from(items).where(eq(items.id, id));
  if (!item) notFound();

  return (
    <>
      <Link href="/closet" className="text-sm text-neutral-500">
        ← Closet
      </Link>
      <h1 className="mt-1 mb-4 text-2xl font-semibold">{item.name}</h1>
      <ItemDetailForm item={item} />
    </>
  );
}
```

- [ ] **Step 3: Append detail tests to `e2e/closet.spec.ts`** (still inside the serial block, after the filter test — they reuse the "My test shirt" item created in Task 12's tests):

```ts
  test("item detail edits persist", async ({ page }) => {
    await unlock(page);
    await page.getByRole("link", { name: /My test shirt/ }).click();
    await expect(page.getByLabel("Name")).toHaveValue("My test shirt");
    await page.getByLabel("Name").fill("Renamed shirt");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.locator("p[role='status']")).toContainText("Saved");
    await page.goto("/closet");
    await expect(page.getByText("Renamed shirt")).toBeVisible();
  });

  test("deleting an item removes it from the grid", async ({ page }) => {
    await unlock(page);
    await page.getByRole("link", { name: /Renamed shirt/ }).click();
    page.on("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Delete item" }).click();
    await expect(page).toHaveURL(/\/closet$/);
    await expect(page.getByText("Renamed shirt")).not.toBeVisible();
  });
```

(Note: `p[role='status']` is a precise locator — Next 16's route announcer makes broad `getByRole` queries ambiguous, per the learned rule about `role="alert"`; the same caution applies here.)

- [ ] **Step 4: Run e2e to verify**

Run: `npm run test:e2e`
Expected: all pass.

- [ ] **Step 5: Typecheck and commit**

Run: `npm run typecheck` → exit 0

```bash
git add "app/(tabs)/closet/[id]/page.tsx" components/closet/ItemDetailForm.tsx e2e/closet.spec.ts
git commit -m "feat: item detail - edit tags, delete with blob cleanup, e2e"
```

---

### Task 14: Full verification + ship

**Files:** none created locally (verification, Vercel, user actions)

- [ ] **Step 1: Run the full gate**

Run: `npm test && npm run typecheck && npm run test:e2e`
Expected: every suite green. Show the output before claiming done (CLAUDE.md rule).

- [ ] **Step 2 (USER ACTION — pause and ask):** Create the OpenAI API key

Ask the user to:
1. Sign in at https://platform.openai.com → API keys → create a key for this app.
2. Add it to `.env.local` as `OPENAI_API_KEY=...` (keep `MOCK_AI=1` for dev).
3. Add `OPENAI_API_KEY` to the Vercel project env (Production + Preview). Do **not** set `MOCK_AI` on Vercel — production runs real AI.
4. Confirm the Blob store from M1 Task 10 exists and `BLOB_READ_WRITE_TOKEN` is present in the Vercel env; pull it locally with `npx vercel env pull .env.local` if local real-mode testing is wanted (note: re-add `MOCK_AI=1` if the pull overwrites the file).

- [ ] **Step 3: Local real-mode smoke test (one item)**

Temporarily set `MOCK_AI=` (empty) in `.env.local`, restart the dev server, scan one real garment photo via the library path, confirm: original + cutout land in the Blob store, tags look sane, item saves. Then restore `MOCK_AI=1` and restart. Report the observed cost from the OpenAI usage dashboard.

- [ ] **Step 4: Push and deploy**

Use the `/commit-push-pr` flow (verify → branch → push → PR). After merge, Vercel deploys `main` automatically.

- [ ] **Step 5 (USER ACTION):** On the iPad: open the deployed app → Closet → Scan item → grant camera permission → scan a real garment end-to-end. Confirm the outline guide, processing state, tag suggestions, and the item appearing in the grid.

## M2 acceptance checklist

- [ ] `npm test`, `npm run typecheck`, `npm run test:e2e` all green locally
- [ ] Scan → confirm → save works on the iPad with the real camera over HTTPS
- [ ] Real-mode smoke: cutout + tags from OpenAI on at least one garment; cost observed
- [ ] Camera-denied path: blocking camera permission still allows adding via library
- [ ] Grid filters by category and color; detail edit + delete work
- [ ] `.env.local` absent from git history; `OPENAI_API_KEY` only in env vars

## Deferred

- Avatar guided capture → slice 2 (next brainstorm)
- Calendar + weather status bar → slice 3
- Batch ingestion — revisit if bulk cataloging feels slow in practice
