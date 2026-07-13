# Kloset Explore Page (Pinterest-style Inspiration Feed) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A new top-level `/explore` page: an infinite-scroll Pinterest-style masonry feed of real fashion photos from the Pexels API, personalized by queries seeded from the user's closet (`styleTags` + `colors`), with search, a pin lightbox (photographer credit + "Style this from my closet" via the existing AI stylist), and heart-to-save pins persisted in a new `pins` table with a For You / Saved toggle.

**Architecture:** Pure logic lives in `lib/explore/` (query builder, Pexels client + parser, masonry splitter, validation) — all unit-tested. Two thin API routes (`/api/explore` feed proxy, `/api/pins` save-toggle) keep the Pexels key server-side. One client component (`ExploreFeed`) renders the masonry grid with a JS shortest-column splitter (CSS `columns` would reflow existing pins on every infinite-scroll append), plus a `PinLightbox` dialog that reuses the stylist engine untouched. `SuggestionCard` is extracted from `StylistTab` so both surfaces share it.

**Tech Stack:** Next.js 16 App Router, React 19, TS 6, Tailwind v4 (DESIGN.md tokens), Drizzle + Neon Postgres, Pexels API v1, Vitest, Playwright.

## Global Constraints

- All work happens on branch `kloset-explore`, cut from `main` AFTER merging `kloset-dark` (Task 1). Every commit is also pushed (`git push`) — "commit" means commit AND push in this repo.
- Dev/tests always run `MOCK_AI=1` — it mocks ALL external services. The Pexels client MUST honor it (canned fixtures, zero network). `PEXELS_API_KEY` is only needed with `MOCK_AI` off (prod / real smoke).
- Never read env vars or construct external clients at module scope — lazy access at call time only (crashes `next build` otherwise).
- Always wrap `await req.json()` in try/catch and return 400.
- UI uses DESIGN.md (velvet-boudoir) token utilities ONLY: `bg-canvas`, `bg-card`, `bg-pink`, `bg-pink-deep`, `text-on-pink`, `text-ink`, `text-body`, `text-mute`, `text-error`, `bg-secondary`, `font-display`, `rounded-card`, `rounded-full`. No hand-rolled hex/radii. White/black alphas (`bg-black/50`, `text-white`) are sanctioned only as overlays ON photographs. Rose (`bg-pink`) = at most ONE primary CTA per screen; the active/selected state is the ink inversion (`bg-ink text-canvas`).
- Vitest only picks up `lib/**/*.test.ts` — logic that needs unit tests must live under `lib/`.
- e2e spec files run alphabetically with ONE DB wipe up front; later specs rely on earlier specs' seeds. The new spec is named `z-explore.spec.ts` so it runs LAST (needs studio.spec's tee/jeans/sneakers for mock stylist combos). e2e wipes settings, items, base_photos, outfits, wears, and (after Task 6) pins — never point `DATABASE_URL` at data you care about.
- A task is done only when `npm test && npm run typecheck && npm run test:e2e` are all green (UI tasks run all three; pure-lib tasks may defer e2e to the final sweep since they touch no routes/UI).
- `.env.local` is never committed. New env vars also go in `.env.example`.
- House DB pattern: plain id columns, no foreign keys.
- Next 16 quirks: route announcer has `role="alert"` (use precise Playwright locators); Turbopack may serve stale tokens/types — if weirdness, stop server, `rm -rf .next`, restart.

---

### Task 1: Branch setup — merge kloset-dark into main, cut kloset-explore

**Files:** none (git only)

**Interfaces:**
- Consumes: existing branches `main`, `kloset-dark` (verified green, pushed)
- Produces: branch `kloset-explore` (tracking origin) containing the Velvet Boudoir redesign — all later tasks commit here

- [ ] **Step 1: Verify clean tree and merge**

```bash
cd C:/Users/bghil/styling_app
git status --porcelain        # must be empty EXCEPT this untracked plan doc; stop and report otherwise
git checkout main
git pull
git merge kloset-dark
git push
```

Expected: fast-forward (or clean merge) — `kloset-dark` was cut from post-P3 main. If there are conflicts, STOP and report; do not resolve silently. (The untracked plan file `docs/superpowers/plans/2026-07-13-kloset-explore-pinterest-feed.md` rides along across checkouts — it is committed in Step 2.)

- [ ] **Step 2: Cut the feature branch and commit this plan**

```bash
git checkout -b kloset-explore
git add docs/superpowers/plans/2026-07-13-kloset-explore-pinterest-feed.md
git commit -m "docs: explore page implementation plan"
git push -u origin kloset-explore
```

Expected: `branch 'kloset-explore' set up to track 'origin/kloset-explore'`.

- [ ] **Step 3: Sanity-check the suite on the merged base**

Run: `npm test && npm run typecheck`
Expected: 115 unit tests pass, typecheck clean. (Full e2e was verified green on kloset-dark already; skip here.)

---

### Task 2: Feed query builder (`lib/explore/queries.ts`)

**Files:**
- Create: `lib/explore/queries.ts`
- Test: `lib/explore/queries.test.ts`

**Interfaces:**
- Consumes: `ClosetItem` fields `styleTags: string[]`, `colors: string[]` (from `@/lib/closet/types`)
- Produces:
  - `STAPLE_QUERIES: string[]` (5 fixed queries)
  - `closetQueries(items: Pick<ClosetItem, "styleTags" | "colors">[]): string[]` — up to 6 closet-derived queries, tags first
  - `buildFeedQueries(items: Pick<ClosetItem, "styleTags" | "colors">[], seed: number): string[]` — deterministic seeded shuffle of closet + staple queries; ALWAYS ≥ 5 entries (Task 7 relies on non-empty)

- [ ] **Step 1: Write the failing test**

```ts
// lib/explore/queries.test.ts
import { describe, expect, it } from "vitest";
import { buildFeedQueries, closetQueries, STAPLE_QUERIES } from "./queries";

const item = (styleTags: string[], colors: string[]) => ({ styleTags, colors });

describe("closetQueries", () => {
  it("derives tag queries first, then color queries, deduped case-insensitively", () => {
    const qs = closetQueries([
      item(["Minimalist", "y2k"], ["black"]),
      item(["minimalist"], ["black", "red"]),
    ]);
    expect(qs).toEqual([
      "minimalist outfit",
      "y2k outfit",
      "black outfit street style",
      "red outfit street style",
    ]);
  });

  it("caps at six queries", () => {
    expect(closetQueries([item(["a", "b", "c", "d", "e", "f", "g"], [])])).toHaveLength(6);
  });

  it("returns empty for an empty closet", () => {
    expect(closetQueries([])).toEqual([]);
  });
});

describe("buildFeedQueries", () => {
  it("is deterministic for a seed and contains closet + staple queries", () => {
    const items = [item(["boho"], ["white"])];
    const a = buildFeedQueries(items, 42);
    expect(buildFeedQueries(items, 42)).toEqual(a);
    expect(a).toHaveLength(2 + STAPLE_QUERIES.length);
    for (const s of STAPLE_QUERIES) expect(a).toContain(s);
  });

  it("different seeds reorder the pool", () => {
    const items = [item(["boho", "grunge", "prep"], ["white", "black", "red"])];
    const orders = new Set([1, 2, 3, 4, 5].map((s) => buildFeedQueries(items, s).join("|")));
    expect(orders.size).toBeGreaterThan(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/explore/queries.test.ts`
Expected: FAIL — cannot resolve `./queries`.

- [ ] **Step 3: Write the implementation**

```ts
// lib/explore/queries.ts
import type { ClosetItem } from "@/lib/closet/types";

export const STAPLE_QUERIES = [
  "street style fashion",
  "outfit inspiration",
  "fashion editorial",
  "casual chic outfit",
  "minimal wardrobe style",
];

const MAX_CLOSET_QUERIES = 6;

type Seedable = Pick<ClosetItem, "styleTags" | "colors">;

// Tags make better search queries than colors; colors pad if tags run short.
export function closetQueries(items: Seedable[]): string[] {
  const norm = (v: string) => v.trim().toLowerCase();
  const tags = [...new Set(items.flatMap((i) => i.styleTags.map(norm)))].filter(Boolean);
  const colors = [...new Set(items.flatMap((i) => i.colors.map(norm)))].filter(Boolean);
  return [
    ...tags.map((t) => `${t} outfit`),
    ...colors.map((c) => `${c} outfit street style`),
  ].slice(0, MAX_CLOSET_QUERIES);
}

// mulberry32 — tiny deterministic PRNG so a seed reproduces its shuffle.
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildFeedQueries(items: Seedable[], seed: number): string[] {
  const pool = [...closetQueries(items), ...STAPLE_QUERIES];
  const rand = rng(seed);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/explore/queries.test.ts`
Expected: 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/explore/queries.ts lib/explore/queries.test.ts
git commit -m "feat(explore): closet-seeded feed query builder"
git push
```

---

### Task 3: Pexels client + mock fixtures (`lib/explore/pexels.ts`)

**Files:**
- Create: `lib/explore/pexels.ts`
- Create: `public/fixtures/pin-1.svg`, `public/fixtures/pin-2.svg`, `public/fixtures/pin-3.svg`, `public/fixtures/pin-4.svg`
- Modify: `.env.example` (add `PEXELS_API_KEY`)
- Test: `lib/explore/pexels.test.ts`

**Interfaces:**
- Consumes: `process.env.MOCK_AI`, `process.env.PEXELS_API_KEY` (lazily, inside functions)
- Produces:
  - `type Pin = { pexelsId: number; width: number; height: number; alt: string; photographer: string; photographerUrl: string; pexelsUrl: string; imageUrl: string }`
  - `type SavedPin = Pin & { id: string }`
  - `type FeedPage = { pins: Pin[]; hasMore: boolean }`
  - `parsePexelsResponse(raw: unknown): FeedPage` (pure)
  - `mockPins(query: string, page: number, perPage: number): Pin[]` (pure, deterministic)
  - `searchPexels(query: string, page: number, perPage: number): Promise<FeedPage>` — honors MOCK_AI; throws on missing key / non-OK response

Pexels API facts (for reference): `GET https://api.pexels.com/v1/search?query={q}&page={n}&per_page={n}` with header `Authorization: <key>`. Response `{ photos: [{ id, width, height, url, photographer, photographer_url, alt, src: { large, ... } }], next_page? }`. `src.large` is ~940px wide — right for a grid column.

- [ ] **Step 1: Write the failing test**

```ts
// lib/explore/pexels.test.ts
import { describe, expect, it } from "vitest";
import { mockPins, parsePexelsResponse } from "./pexels";

const photo = (id: number, over: Record<string, unknown> = {}) => ({
  id,
  width: 800,
  height: 1200,
  url: `https://www.pexels.com/photo/${id}/`,
  photographer: "Ada",
  photographer_url: "https://www.pexels.com/@ada",
  alt: "A look",
  src: { large: `https://images.pexels.com/${id}-large.jpg` },
  ...over,
});

describe("parsePexelsResponse", () => {
  it("maps photos to pins and reads next_page as hasMore", () => {
    const { pins, hasMore } = parsePexelsResponse({
      photos: [photo(7)],
      next_page: "https://api.pexels.com/v1/search?page=2",
    });
    expect(pins).toEqual([
      {
        pexelsId: 7,
        width: 800,
        height: 1200,
        alt: "A look",
        photographer: "Ada",
        photographerUrl: "https://www.pexels.com/@ada",
        pexelsUrl: "https://www.pexels.com/photo/7/",
        imageUrl: "https://images.pexels.com/7-large.jpg",
      },
    ]);
    expect(hasMore).toBe(true);
  });

  it("drops malformed entries and reports hasMore=false without next_page", () => {
    const { pins, hasMore } = parsePexelsResponse({
      photos: [photo(1, { src: {} }), photo(2, { id: "nope" }), "junk", photo(3)],
    });
    expect(pins.map((p) => p.pexelsId)).toEqual([3]);
    expect(hasMore).toBe(false);
  });

  it("returns empty on garbage input", () => {
    expect(parsePexelsResponse(null)).toEqual({ pins: [], hasMore: false });
  });
});

describe("mockPins", () => {
  it("is deterministic, sized to perPage, and unique across pages and queries", () => {
    const a = mockPins("boho outfit", 1, 30);
    expect(mockPins("boho outfit", 1, 30)).toEqual(a);
    expect(a).toHaveLength(30);
    const b = mockPins("boho outfit", 2, 30);
    const other = mockPins("grunge outfit", 1, 30);
    const ids = new Set([...a, ...b, ...other].map((p) => p.pexelsId));
    expect(ids.size).toBe(90);
  });

  it("serves root-relative fixture images with positive dimensions and query-tagged alt", () => {
    const [first] = mockPins("parisian chic", 1, 4);
    expect(first.imageUrl).toMatch(/^\/fixtures\/pin-\d\.svg$/);
    expect(first.width).toBeGreaterThan(0);
    expect(first.height).toBeGreaterThan(0);
    expect(first.alt).toBe("Mock pin parisian chic 1");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/explore/pexels.test.ts`
Expected: FAIL — cannot resolve `./pexels`.

- [ ] **Step 3: Write the implementation**

```ts
// lib/explore/pexels.ts
export type Pin = {
  pexelsId: number;
  width: number;
  height: number;
  alt: string;
  photographer: string;
  photographerUrl: string;
  pexelsUrl: string;
  imageUrl: string;
};

// A pin row persisted in the pins table (id = our uuid).
export type SavedPin = Pin & { id: string };

export type FeedPage = { pins: Pin[]; hasMore: boolean };

const PEXELS_SEARCH_URL = "https://api.pexels.com/v1/search";

// Tolerant mapper: drop malformed entries instead of failing the page.
export function parsePexelsResponse(raw: unknown): FeedPage {
  if (typeof raw !== "object" || raw === null) return { pins: [], hasMore: false };
  const o = raw as Record<string, unknown>;
  const list = Array.isArray(o.photos) ? o.photos : [];
  const pins: Pin[] = [];
  for (const entry of list) {
    if (typeof entry !== "object" || entry === null) continue;
    const p = entry as Record<string, unknown>;
    const src = (typeof p.src === "object" && p.src !== null ? p.src : {}) as Record<
      string,
      unknown
    >;
    if (typeof p.id !== "number" || typeof p.width !== "number" || typeof p.height !== "number")
      continue;
    if (p.width <= 0 || p.height <= 0 || typeof src.large !== "string") continue;
    pins.push({
      pexelsId: p.id,
      width: p.width,
      height: p.height,
      alt: typeof p.alt === "string" ? p.alt : "",
      photographer: typeof p.photographer === "string" ? p.photographer : "",
      photographerUrl: typeof p.photographer_url === "string" ? p.photographer_url : "",
      pexelsUrl: typeof p.url === "string" ? p.url : "",
      imageUrl: src.large,
    });
  }
  return { pins, hasMore: typeof o.next_page === "string" && pins.length > 0 };
}

// Four placeholder shapes so the mock masonry has real height variety.
const MOCK_SHAPES = [
  { file: "/fixtures/pin-1.svg", width: 800, height: 1000 },
  { file: "/fixtures/pin-2.svg", width: 800, height: 1200 },
  { file: "/fixtures/pin-3.svg", width: 800, height: 800 },
  { file: "/fixtures/pin-4.svg", width: 800, height: 1400 },
];

// djb2 — stable per-query id block so client dedup never collides across queries.
function hashQuery(query: string): number {
  let h = 5381;
  for (let i = 0; i < query.length; i++) h = ((h * 33) ^ query.charCodeAt(i)) >>> 0;
  return h % 100_000;
}

export function mockPins(query: string, page: number, perPage: number): Pin[] {
  const base = hashQuery(query);
  return Array.from({ length: perPage }, (_, i) => {
    const n = (page - 1) * perPage + i;
    const shape = MOCK_SHAPES[n % MOCK_SHAPES.length];
    return {
      pexelsId: base * 10_000 + n,
      width: shape.width,
      height: shape.height,
      alt: `Mock pin ${query} ${n + 1}`,
      photographer: "Mock Photographer",
      photographerUrl: "https://www.pexels.com",
      pexelsUrl: "https://www.pexels.com",
      imageUrl: shape.file,
    };
  });
}

export async function searchPexels(
  query: string,
  page: number,
  perPage: number,
): Promise<FeedPage> {
  if (process.env.MOCK_AI === "1") return { pins: mockPins(query, page, perPage), hasMore: true };
  // Lazy env read — never at module scope (learned rule).
  const key = process.env.PEXELS_API_KEY;
  if (!key) throw new Error("PEXELS_API_KEY is not set");
  const url = `${PEXELS_SEARCH_URL}?query=${encodeURIComponent(query)}&page=${page}&per_page=${perPage}`;
  const res = await fetch(url, {
    headers: { Authorization: key },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Pexels search failed: ${res.status}`);
  return parsePexelsResponse(await res.json());
}
```

- [ ] **Step 4: Create the four fixture SVGs**

`public/fixtures/pin-1.svg`:
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 100" width="800" height="1000">
  <rect width="80" height="100" fill="#8a97a5"/>
  <circle cx="40" cy="38" r="14" fill="#cfd6dd"/>
  <rect x="24" y="58" width="32" height="30" rx="4" fill="#cfd6dd"/>
</svg>
```

`public/fixtures/pin-2.svg`:
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 120" width="800" height="1200">
  <rect width="80" height="120" fill="#a58a97"/>
  <circle cx="40" cy="42" r="14" fill="#ddd0d6"/>
  <rect x="24" y="66" width="32" height="38" rx="4" fill="#ddd0d6"/>
</svg>
```

`public/fixtures/pin-3.svg`:
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80" width="800" height="800">
  <rect width="80" height="80" fill="#97a58a"/>
  <circle cx="40" cy="30" r="12" fill="#d4ddd0"/>
  <rect x="26" y="48" width="28" height="22" rx="4" fill="#d4ddd0"/>
</svg>
```

`public/fixtures/pin-4.svg`:
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 140" width="800" height="1400">
  <rect width="80" height="140" fill="#8a91a5"/>
  <circle cx="40" cy="46" r="14" fill="#d0d4dd"/>
  <rect x="24" y="72" width="32" height="46" rx="4" fill="#d0d4dd"/>
</svg>
```

- [ ] **Step 5: Add the env var to `.env.example`**

Append after the `BLOB_READ_WRITE_TOKEN` block:

```
# Pexels API key — server-side only, powers the Explore inspiration feed.
# Free instant key at https://www.pexels.com/api/ — only needed when MOCK_AI is off.
PEXELS_API_KEY=
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run lib/explore/pexels.test.ts`
Expected: 5 tests PASS.

- [ ] **Step 7: Commit**

```bash
git add lib/explore/pexels.ts lib/explore/pexels.test.ts public/fixtures/pin-1.svg public/fixtures/pin-2.svg public/fixtures/pin-3.svg public/fixtures/pin-4.svg .env.example
git commit -m "feat(explore): pexels client with MOCK_AI fixtures"
git push
```

---

### Task 4: Masonry splitter (`lib/explore/masonry.ts`)

**Files:**
- Create: `lib/explore/masonry.ts`
- Test: `lib/explore/masonry.test.ts`

**Interfaces:**
- Consumes: `Pin` from `./pexels` (only `width`/`height` are read)
- Produces: `splitColumns(pins: Pin[], count: number): Pin[][]` — greedy shortest-column packing; sequential over an append-only list, so already-placed pins NEVER move when infinite scroll appends a page (the reason we don't use CSS `columns` here)

- [ ] **Step 1: Write the failing test**

```ts
// lib/explore/masonry.test.ts
import { describe, expect, it } from "vitest";
import { splitColumns } from "./masonry";
import type { Pin } from "./pexels";

const pin = (id: number, height: number): Pin => ({
  pexelsId: id,
  width: 800,
  height,
  alt: "",
  photographer: "",
  photographerUrl: "",
  pexelsUrl: "",
  imageUrl: "/fixtures/pin-1.svg",
});

describe("splitColumns", () => {
  it("packs each pin into the currently shortest column (ties go left)", () => {
    const cols = splitColumns([pin(1, 1600), pin(2, 800), pin(3, 800), pin(4, 800)], 2);
    expect(cols[0].map((p) => p.pexelsId)).toEqual([1, 4]);
    expect(cols[1].map((p) => p.pexelsId)).toEqual([2, 3]);
  });

  it("appending pins never moves earlier pins", () => {
    const first = [pin(1, 900), pin(2, 1300), pin(3, 700)];
    const more = [...first, pin(4, 1000), pin(5, 1100)];
    const a = splitColumns(first, 2);
    const b = splitColumns(more, 2);
    expect(b[0].slice(0, a[0].length)).toEqual(a[0]);
    expect(b[1].slice(0, a[1].length)).toEqual(a[1]);
  });

  it("a single column keeps feed order", () => {
    expect(splitColumns([pin(1, 500), pin(2, 900)], 1)[0].map((p) => p.pexelsId)).toEqual([1, 2]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/explore/masonry.test.ts`
Expected: FAIL — cannot resolve `./masonry`.

- [ ] **Step 3: Write the implementation**

```ts
// lib/explore/masonry.ts
import type { Pin } from "./pexels";

// Greedy shortest-column packing by aspect height (height/width, i.e. rendered
// height at equal column widths). Sequential over an append-only list, so
// pins already placed never move when a new page is appended — CSS `columns`
// would reflow them on every append.
export function splitColumns(pins: Pin[], count: number): Pin[][] {
  const heights = Array.from({ length: count }, () => 0);
  const cols: Pin[][] = Array.from({ length: count }, () => []);
  for (const pin of pins) {
    let target = 0;
    for (let i = 1; i < count; i++) {
      if (heights[i] < heights[target]) target = i;
    }
    cols[target].push(pin);
    heights[target] += pin.height / pin.width;
  }
  return cols;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/explore/masonry.test.ts`
Expected: 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/explore/masonry.ts lib/explore/masonry.test.ts
git commit -m "feat(explore): stable shortest-column masonry splitter"
git push
```

---

### Task 5: Feed-param + pin-body validation (`lib/explore/validation.ts`)

**Files:**
- Create: `lib/explore/validation.ts`
- Test: `lib/explore/validation.test.ts`

**Interfaces:**
- Consumes: `Result<T>` and `isImageUrl` from `@/lib/closet/item-validation` (isImageUrl accepts https:// or root-relative — exactly right: Blob/Pexels URLs are https, MOCK fixtures are root-relative); `Pin` from `./pexels`
- Produces:
  - `type FeedParams = { page: number; seed: number; q?: string }`
  - `validateFeedParams(params: URLSearchParams): Result<FeedParams>` — page defaults 1 (max 100), seed defaults 1 (non-negative int), q optional trimmed ≤ 100 chars
  - `validatePinBody(raw: unknown): Result<Pin>` — used by POST /api/pins

- [ ] **Step 1: Write the failing test**

```ts
// lib/explore/validation.test.ts
import { describe, expect, it } from "vitest";
import { validateFeedParams, validatePinBody } from "./validation";

const params = (o: Record<string, string>) => new URLSearchParams(o);

describe("validateFeedParams", () => {
  it("defaults page and seed, omits empty q", () => {
    expect(validateFeedParams(params({}))).toEqual({
      ok: true,
      value: { page: 1, seed: 1, q: undefined },
    });
  });

  it("accepts explicit values and trims q", () => {
    expect(validateFeedParams(params({ page: "3", seed: "99", q: "  parisian chic  " }))).toEqual({
      ok: true,
      value: { page: 3, seed: 99, q: "parisian chic" },
    });
  });

  it("rejects non-integer or out-of-range page and negative seed", () => {
    expect(validateFeedParams(params({ page: "0" })).ok).toBe(false);
    expect(validateFeedParams(params({ page: "1.5" })).ok).toBe(false);
    expect(validateFeedParams(params({ page: "101" })).ok).toBe(false);
    expect(validateFeedParams(params({ seed: "-1" })).ok).toBe(false);
  });
});

describe("validatePinBody", () => {
  const good = {
    pexelsId: 7,
    width: 800,
    height: 1200,
    alt: "A look",
    photographer: "Ada",
    photographerUrl: "https://www.pexels.com/@ada",
    pexelsUrl: "https://www.pexels.com/photo/7/",
    imageUrl: "https://images.pexels.com/7-large.jpg",
  };

  it("accepts a full pin, and root-relative mock images", () => {
    expect(validatePinBody(good)).toEqual({ ok: true, value: good });
    expect(validatePinBody({ ...good, imageUrl: "/fixtures/pin-1.svg" }).ok).toBe(true);
  });

  it("rejects bad ids, dimensions, and image urls", () => {
    expect(validatePinBody(null).ok).toBe(false);
    expect(validatePinBody({ ...good, pexelsId: "7" }).ok).toBe(false);
    expect(validatePinBody({ ...good, width: 0 }).ok).toBe(false);
    expect(validatePinBody({ ...good, imageUrl: "http://insecure.example/x.jpg" }).ok).toBe(false);
    expect(validatePinBody({ ...good, imageUrl: "//evil.example/x.jpg" }).ok).toBe(false);
  });

  it("blanks non-https credit links instead of failing", () => {
    const r = validatePinBody({ ...good, photographerUrl: "javascript:alert(1)" });
    expect(r.ok && r.value.photographerUrl).toBe("");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/explore/validation.test.ts`
Expected: FAIL — cannot resolve `./validation`.

- [ ] **Step 3: Write the implementation**

```ts
// lib/explore/validation.ts
import { isImageUrl, type Result } from "@/lib/closet/item-validation";
import type { Pin } from "./pexels";

const MAX_QUERY = 100;
const MAX_PAGE = 100;
const MAX_TEXT = 300;
const MAX_URL = 2048;

export type FeedParams = { page: number; seed: number; q?: string };

export function validateFeedParams(params: URLSearchParams): Result<FeedParams> {
  const page = Number(params.get("page") ?? "1");
  if (!Number.isInteger(page) || page < 1 || page > MAX_PAGE) {
    return { ok: false, error: `page must be an integer between 1 and ${MAX_PAGE}.` };
  }
  const seed = Number(params.get("seed") ?? "1");
  if (!Number.isInteger(seed) || seed < 0) {
    return { ok: false, error: "seed must be a non-negative integer." };
  }
  const rawQ = params.get("q");
  const q = rawQ ? rawQ.trim().slice(0, MAX_QUERY) : undefined;
  return { ok: true, value: { page, seed, q: q || undefined } };
}

// Credit links are display-only <a href>s — blank anything non-https rather
// than rejecting the save.
function httpsOrBlank(v: unknown): string {
  return typeof v === "string" && v.length <= MAX_URL && v.startsWith("https://") ? v : "";
}

function textOrBlank(v: unknown): string {
  return typeof v === "string" ? v.trim().slice(0, MAX_TEXT) : "";
}

export function validatePinBody(raw: unknown): Result<Pin> {
  if (typeof raw !== "object" || raw === null) {
    return { ok: false, error: "Body must be an object." };
  }
  const o = raw as Record<string, unknown>;
  if (typeof o.pexelsId !== "number" || !Number.isInteger(o.pexelsId) || o.pexelsId < 0) {
    return { ok: false, error: "pexelsId must be a non-negative integer." };
  }
  if (
    typeof o.width !== "number" ||
    typeof o.height !== "number" ||
    !Number.isInteger(o.width) ||
    !Number.isInteger(o.height) ||
    o.width < 1 ||
    o.height < 1
  ) {
    return { ok: false, error: "width and height must be positive integers." };
  }
  if (!isImageUrl(o.imageUrl)) {
    return { ok: false, error: "imageUrl must be an https or root-relative URL." };
  }
  return {
    ok: true,
    value: {
      pexelsId: o.pexelsId,
      width: o.width,
      height: o.height,
      alt: textOrBlank(o.alt),
      photographer: textOrBlank(o.photographer),
      photographerUrl: httpsOrBlank(o.photographerUrl),
      pexelsUrl: httpsOrBlank(o.pexelsUrl),
      imageUrl: o.imageUrl,
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/explore/validation.test.ts`
Expected: 6 tests PASS. Then run the whole unit suite + typecheck: `npm test && npm run typecheck` — all green.

- [ ] **Step 5: Commit**

```bash
git add lib/explore/validation.ts lib/explore/validation.test.ts
git commit -m "feat(explore): feed param and pin body validation"
git push
```

---

### Task 6: `pins` table (schema, e2e wipe, db push)

**Files:**
- Modify: `lib/db/schema.ts` (append table; extend the pg-core import)
- Modify: `e2e/global-setup.ts` (create + wipe pins)
- Modify: `CLAUDE.md` (the two lines listing wiped tables — add `pins`)

**Interfaces:**
- Consumes: drizzle `pgTable` helpers
- Produces: `pins` table export — columns `id: uuid PK`, `pexelsId: bigint(number) UNIQUE`, `imageUrl/alt/photographer/photographerUrl/pexelsUrl: text`, `width/height: integer`, `createdAt: timestamp`. Task 7's `/api/pins` and Task 10's page read it.

- [ ] **Step 1: Extend the schema**

In `lib/db/schema.ts`, change the import line to:

```ts
import { bigint, boolean, date, integer, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
```

Append at the end of the file:

```ts
// Saved Explore pins (external Pexels photos). Stored denormalized so the
// Saved view renders without re-querying Pexels; unique pexels_id makes the
// heart a clean save/unsave toggle.
export const pins = pgTable("pins", {
  id: uuid("id").primaryKey().defaultRandom(),
  pexelsId: bigint("pexels_id", { mode: "number" }).notNull().unique(),
  imageUrl: text("image_url").notNull(),
  alt: text("alt").notNull().default(""),
  photographer: text("photographer").notNull().default(""),
  photographerUrl: text("photographer_url").notNull().default(""),
  pexelsUrl: text("pexels_url").notNull().default(""),
  width: integer("width").notNull(),
  height: integer("height").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
```

- [ ] **Step 2: Mirror it in `e2e/global-setup.ts`**

After the `wears` CREATE TABLE block, add:

```ts
  // Keep in sync with lib/db/schema.ts
  await sql`CREATE TABLE IF NOT EXISTS pins (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    pexels_id bigint NOT NULL UNIQUE,
    image_url text NOT NULL,
    alt text NOT NULL DEFAULT '',
    photographer text NOT NULL DEFAULT '',
    photographer_url text NOT NULL DEFAULT '',
    pexels_url text NOT NULL DEFAULT '',
    width integer NOT NULL,
    height integer NOT NULL,
    created_at timestamp NOT NULL DEFAULT now()
  )`;
```

And add to the wipe block at the bottom:

```ts
  await sql`DELETE FROM pins`;
```

- [ ] **Step 3: Update CLAUDE.md's wipe warnings**

In `CLAUDE.md`, update both mentions of the wiped-table list ("creates + wipes the settings, items, base_photos, outfits and wears tables" under Commands, and "e2e wipes the settings, items, base_photos, outfits and wears tables" under Rules) to include `pins`.

- [ ] **Step 4: Push the schema to Neon**

Run: `npm run db:push`
Expected: `CREATE TABLE pins ...` executed. NOTE (learned rule): drizzle-kit will also re-emit no-op `ALTER ... SET DEFAULT '{}'::text[]` statements for existing text-array columns — expected quirk, do not "fix" the schema.

- [ ] **Step 5: Verify typecheck**

Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add lib/db/schema.ts e2e/global-setup.ts CLAUDE.md
git commit -m "feat(explore): pins table for saved inspiration"
git push
```

---

### Task 7: API routes — `/api/explore` and `/api/pins`

**Files:**
- Create: `app/api/explore/route.ts`
- Create: `app/api/pins/route.ts`

**Interfaces:**
- Consumes: `searchPexels`, `buildFeedQueries`, `validateFeedParams`, `validatePinBody`, `getDb`, `items`, `pins` (all from earlier tasks)
- Produces (Task 10's client calls these):
  - `GET /api/explore?page&seed&q` → 200 `{ pins: Pin[], hasMore: boolean }` | 400 `{ error }` | 502 `{ error }`
  - `GET /api/pins` → 200 `{ pins: SavedPin[] }` (newest first)
  - `POST /api/pins` (body = Pin) → toggle: 201 `{ saved: true, pin: SavedPin }` on save, 200 `{ saved: false }` on unsave | 400 `{ error }`

- [ ] **Step 1: Write the explore feed route**

```ts
// app/api/explore/route.ts
import { desc } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { items } from "@/lib/db/schema";
import { searchPexels } from "@/lib/explore/pexels";
import { buildFeedQueries } from "@/lib/explore/queries";
import { validateFeedParams } from "@/lib/explore/validation";

const PER_PAGE = 30;

// For You paging walks the seeded query list round-robin: feed page N uses
// query (N-1) % len at provider page floor((N-1)/len)+1. A search (?q=) pages
// the provider directly.
export async function GET(req: NextRequest) {
  const parsed = validateFeedParams(req.nextUrl.searchParams);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const { page, seed, q } = parsed.value;

  let query = q;
  let providerPage = page;
  if (!query) {
    const all = await getDb().select().from(items).orderBy(desc(items.createdAt));
    const queries = buildFeedQueries(all, seed); // never empty — staples guarantee ≥5
    query = queries[(page - 1) % queries.length];
    providerPage = Math.floor((page - 1) / queries.length) + 1;
  }

  try {
    const feed = await searchPexels(query, providerPage, PER_PAGE);
    return NextResponse.json(feed);
  } catch (err) {
    console.error("[explore] pexels search failed:", err);
    return NextResponse.json({ error: "Couldn't load inspiration — try again." }, { status: 502 });
  }
}
```

- [ ] **Step 2: Write the pins save-toggle route**

```ts
// app/api/pins/route.ts
import { desc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { pins } from "@/lib/db/schema";
import { validatePinBody } from "@/lib/explore/validation";

export async function GET() {
  const rows = await getDb().select().from(pins).orderBy(desc(pins.createdAt));
  return NextResponse.json({ pins: rows });
}

// Toggle, like /api/wears: posting an already-saved pexelsId unsaves it.
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const parsed = validatePinBody(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const pin = parsed.value;
  const db = getDb();
  const existing = await db.select().from(pins).where(eq(pins.pexelsId, pin.pexelsId));
  if (existing.length > 0) {
    await db.delete(pins).where(eq(pins.pexelsId, pin.pexelsId));
    return NextResponse.json({ saved: false });
  }
  const [row] = await db.insert(pins).values(pin).returning();
  return NextResponse.json({ saved: true, pin: row }, { status: 201 });
}
```

- [ ] **Step 3: Smoke the routes against the dev server**

```bash
npm run dev &   # or use the already-running dev server on :8000
curl -s "http://localhost:8000/api/explore?page=1&seed=7" | head -c 300
curl -s "http://localhost:8000/api/explore?page=0" 
curl -s -X POST http://localhost:8000/api/pins -H "Content-Type: application/json" -d '{"pexelsId":1,"width":800,"height":1000,"alt":"t","photographer":"","photographerUrl":"","pexelsUrl":"","imageUrl":"/fixtures/pin-1.svg"}'
curl -s -X POST http://localhost:8000/api/pins -H "Content-Type: application/json" -d '{"pexelsId":1,"width":800,"height":1000,"alt":"t","photographer":"","photographerUrl":"","pexelsUrl":"","imageUrl":"/fixtures/pin-1.svg"}'
curl -s http://localhost:8000/api/pins
```

Expected in order: `{"pins":[{"pexelsId":...` (30 mock pins, `hasMore":true`); `{"error":"page must be..."}`; `{"saved":true,...}`; `{"saved":false}`; `{"pins":[]}`. (Dev DB gets a stray toggle-then-untoggle — net zero rows.)

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add app/api/explore/route.ts app/api/pins/route.ts
git commit -m "feat(explore): feed and pin-toggle API routes"
git push
```

---

### Task 8: Extract `SuggestionCard` from `StylistTab`

**Files:**
- Create: `components/outfits/SuggestionCard.tsx`
- Modify: `components/stylist/StylistTab.tsx`

**Interfaces:**
- Consumes: `OutfitActions`, `OutfitCollage`, `ClosetItem` (existing)
- Produces (Task 9's lightbox imports these):
  - `type StylistOutfit = { name: string; reason: string; items: ClosetItem[] }`
  - `fetchStylistOutfits(body: { count: number; occasion?: string; date?: string }): Promise<StylistOutfit[]>`
  - `default SuggestionCard({ outfit }: { outfit: StylistOutfit })` — renders collage + name/reason + OutfitActions with `source="stylist"`, `data-testid="suggestion-card"` (existing e2e depends on this testid — keep it)

- [ ] **Step 1: Create the shared module**

```tsx
// components/outfits/SuggestionCard.tsx
import OutfitActions from "@/components/outfits/OutfitActions";
import OutfitCollage from "@/components/studio/OutfitCollage";
import type { ClosetItem } from "@/lib/closet/types";

export type StylistOutfit = { name: string; reason: string; items: ClosetItem[] };

export async function fetchStylistOutfits(body: {
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

export default function SuggestionCard({ outfit }: { outfit: StylistOutfit }) {
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
```

(No `"use client"` needed — it is only ever imported by client components.)

- [ ] **Step 2: Slim `StylistTab.tsx` to use it**

In `components/stylist/StylistTab.tsx`:
1. DELETE the local `StylistOutfit` type, the `fetchOutfits` function, and the local `SuggestionCard` component (lines 10, 17–51 in the current file).
2. DELETE the now-unused imports of `OutfitActions`, `OutfitCollage`, and `ClosetItem`.
3. ADD the import:

```tsx
import SuggestionCard, {
  fetchStylistOutfits,
  type StylistOutfit,
} from "@/components/outfits/SuggestionCard";
```

4. Replace both `fetchOutfits(` call sites (`loadFeed` and `styleOccasion`) with `fetchStylistOutfits(`.

Nothing else changes — same testids, same markup, same behavior.

- [ ] **Step 3: Verify — unit, types, and full e2e**

Run: `npm test && npm run typecheck && npm run test:e2e`
Expected: all green — especially `e2e/stylist.spec.ts` (proves the extraction is behavior-identical).

- [ ] **Step 4: Commit**

```bash
git add components/outfits/SuggestionCard.tsx components/stylist/StylistTab.tsx
git commit -m "refactor(stylist): extract shared SuggestionCard + fetchStylistOutfits"
git push
```

---

### Task 9: `PinLightbox` component

**Files:**
- Create: `components/explore/PinLightbox.tsx`

**Interfaces:**
- Consumes: `Pin` (Task 3), `SuggestionCard`/`fetchStylistOutfits`/`StylistOutfit` (Task 8), existing `/api/stylist` route
- Produces (Task 10 mounts it): `default PinLightbox({ pin, saved, onToggleSave, onClose }: { pin: Pin; saved: boolean; onToggleSave: () => void; onClose: () => void })` — full-screen dialog labelled "Pin detail"; Escape/backdrop/✕ close; photographer + Pexels credit links (the attribution home); "Style this from my closet" = the screen's single rose CTA; "Pin it" toggle uses the ink inversion when saved.

- [ ] **Step 1: Write the component**

```tsx
// components/explore/PinLightbox.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import SuggestionCard, {
  fetchStylistOutfits,
  type StylistOutfit,
} from "@/components/outfits/SuggestionCard";
import type { Pin } from "@/lib/explore/pexels";

const STYLE_COUNT = 3;

type Props = {
  pin: Pin;
  saved: boolean;
  onToggleSave: () => void;
  onClose: () => void;
};

export default function PinLightbox({ pin, saved, onToggleSave, onClose }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const [looks, setLooks] = useState<StylistOutfit[] | null>(null);
  const [styling, setStyling] = useState(false);
  const [styleError, setStyleError] = useState<string | null>(null);

  // Same dialog manners as the Menu overlay: lock scroll, focus the close button.
  useEffect(() => {
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  async function styleThis() {
    if (styling) return;
    setStyling(true);
    setStyleError(null);
    try {
      const occasion = pin.alt
        ? `Recreate this look: ${pin.alt}`
        : "Recreate this pinned street-style look";
      setLooks(await fetchStylistOutfits({ count: STYLE_COUNT, occasion }));
    } catch (err) {
      setStyleError(err instanceof Error ? err.message : "Styling failed — try again.");
    } finally {
      setStyling(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Pin detail"
      className="fixed inset-0 z-50 overflow-y-auto bg-canvas p-4"
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="mx-auto flex max-w-lg flex-col gap-4 pb-8">
        <div className="flex justify-end">
          <button
            ref={closeRef}
            type="button"
            aria-label="Close pin"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-card text-ink"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={pin.imageUrl}
          alt={pin.alt}
          width={pin.width}
          height={pin.height}
          className="h-auto w-full rounded-card bg-card"
        />
        {pin.alt && <p className="text-body">{pin.alt}</p>}
        <p className="text-sm text-mute">
          Photo by{" "}
          {pin.photographerUrl ? (
            <a className="underline" href={pin.photographerUrl} target="_blank" rel="noreferrer">
              {pin.photographer || "unknown"}
            </a>
          ) : (
            pin.photographer || "unknown"
          )}{" "}
          on{" "}
          <a
            className="underline"
            href={pin.pexelsUrl || "https://www.pexels.com"}
            target="_blank"
            rel="noreferrer"
          >
            Pexels
          </a>
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={styleThis}
            disabled={styling}
            className="rounded-full bg-pink px-5 py-3 text-sm font-bold text-on-pink active:bg-pink-deep disabled:opacity-50"
          >
            Style this from my closet
          </button>
          <button
            type="button"
            onClick={onToggleSave}
            aria-pressed={saved}
            className={`rounded-full px-5 py-3 text-sm font-bold ${
              saved ? "bg-ink text-canvas" : "bg-card text-ink"
            }`}
          >
            {saved ? "Pinned ✓" : "Pin it"}
          </button>
        </div>
        {styling && (
          <p role="status" className="text-sm text-mute">
            Styling your closet…
          </p>
        )}
        {styleError && <p className="text-sm text-error">{styleError}</p>}
        {looks && !styling && (
          <section aria-label="Looks from your closet" className="flex flex-col gap-6">
            <h2 className="font-display text-3xl text-ink">From your closet</h2>
            {looks.length === 0 ? (
              <p className="text-mute">
                Not enough in your closet to match this — scan a few more pieces.
              </p>
            ) : (
              looks.map((o, i) => <SuggestionCard key={`${o.name}-${i}`} outfit={o} />)
            )}
          </section>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: clean. (Not mounted anywhere yet — e2e coverage lands with Task 10.)

- [ ] **Step 3: Commit**

```bash
git add components/explore/PinLightbox.tsx
git commit -m "feat(explore): pin lightbox with credit and style-this"
git push
```

---

### Task 10: Explore page — feed, infinite scroll, search, hearts, saved view, nav

**Files:**
- Create: `components/explore/ExploreFeed.tsx`
- Create: `app/(tabs)/explore/page.tsx`
- Modify: `components/shell/Menu.tsx` (add link)
- Modify: `e2e/menu.spec.ts` (seven screens)
- Create: `e2e/z-explore.spec.ts`

**Interfaces:**
- Consumes: `splitColumns` (Task 4), `Pin`/`SavedPin` (Task 3), `PinLightbox` (Task 9), `GET /api/explore`, `GET|POST /api/pins` (Task 7), `PageHeader`, `getDb`/`pins` schema (Task 6)
- Produces: route `/explore`; menu entry "Explore" after Stylist; testids `pin-grid`, `saved-grid`, `pin-card`; button labels `Save pin`/`Unsave pin`, chips `For You`/`Saved`, `Shuffle`, search input labelled `Search inspiration`

- [ ] **Step 1: Write the feed component**

```tsx
// components/explore/ExploreFeed.tsx
"use client";

import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import PinLightbox from "@/components/explore/PinLightbox";
import { splitColumns } from "@/lib/explore/masonry";
import type { Pin, SavedPin } from "@/lib/explore/pexels";

const CACHE_KEY = "kloset-explore-feed";

type Cached = { seed: number; page: number; q: string; pins: Pin[]; hasMore: boolean };

function chipClass(active: boolean) {
  return `rounded-full px-4 py-2 text-sm font-bold ${
    active ? "bg-ink text-canvas" : "bg-card text-ink"
  }`;
}

function PinCard({
  pin,
  saved,
  onOpen,
  onToggleSave,
}: {
  pin: Pin;
  saved: boolean;
  onOpen: () => void;
  onToggleSave: () => void;
}) {
  return (
    <div className="relative" data-testid="pin-card">
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Open pin: ${pin.alt || "fashion photo"}`}
        className="block w-full overflow-hidden rounded-card bg-card"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={pin.imageUrl}
          alt={pin.alt}
          width={pin.width}
          height={pin.height}
          loading="lazy"
          decoding="async"
          className="h-auto w-full"
        />
      </button>
      <button
        type="button"
        aria-label={saved ? "Unsave pin" : "Save pin"}
        aria-pressed={saved}
        onClick={onToggleSave}
        className={`absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full ${
          saved ? "bg-ink text-canvas" : "bg-black/50 text-white"
        }`}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill={saved ? "currentColor" : "none"}
          aria-hidden="true"
        >
          <path
            d="M12 21s-7.5-4.6-10-9.3C.6 8 2.4 4.5 6 4.5c2.2 0 3.6 1.2 4.5 2.6.9-1.4 2.3-2.6 4.5-2.6 3.6 0 5.4 3.5 4 7.2-2.5 4.7-10 9.3-10 9.3z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  );
}

export default function ExploreFeed({ savedPins }: { savedPins: SavedPin[] }) {
  const [pins, setPins] = useState<Pin[]>([]);
  const [page, setPage] = useState(0); // last loaded feed page; 0 = none yet
  const [seed, setSeed] = useState<number | null>(null);
  const [q, setQ] = useState(""); // committed search query ("" = For You)
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState("");
  const [view, setView] = useState<"forYou" | "saved">("forYou");
  const [saved, setSaved] = useState<Map<number, SavedPin>>(
    () => new Map(savedPins.map((p) => [p.pexelsId, p])),
  );
  const [lightbox, setLightbox] = useState<Pin | null>(null);
  const [cols, setCols] = useState(2);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Column count tracks the closet grid's breakpoints (2 / sm:3 / md:4).
  useEffect(() => {
    const mqs = [window.matchMedia("(min-width: 768px)"), window.matchMedia("(min-width: 640px)")];
    const update = () => setCols(mqs[0].matches ? 4 : mqs[1].matches ? 3 : 2);
    update();
    for (const mq of mqs) mq.addEventListener("change", update);
    return () => {
      for (const mq of mqs) mq.removeEventListener("change", update);
    };
  }, []);

  const loadPage = useCallback(
    async (nextPage: number, nextSeed: number, nextQ: string, current: Pin[]) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ page: String(nextPage), seed: String(nextSeed) });
        if (nextQ) params.set("q", nextQ);
        const res = await fetch(`/api/explore?${params}`);
        const data = (await res.json().catch(() => null)) as
          | { pins?: Pin[]; hasMore?: boolean; error?: string }
          | null;
        if (!res.ok || !data?.pins) {
          throw new Error(data?.error ?? "Couldn't load inspiration — try again.");
        }
        // Neighboring queries can return the same photo — drop repeats.
        const seen = new Set(current.map((p) => p.pexelsId));
        const merged = [...current, ...data.pins.filter((p) => !seen.has(p.pexelsId))];
        setPins(merged);
        setPage(nextPage);
        setHasMore(data.hasMore ?? false);
        try {
          const cache: Cached = {
            seed: nextSeed,
            page: nextPage,
            q: nextQ,
            pins: merged,
            hasMore: data.hasMore ?? false,
          };
          sessionStorage.setItem(CACHE_KEY, JSON.stringify(cache));
        } catch {
          // Cache is an optimization — a failed write is not a feed failure.
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't load inspiration — try again.");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  // Restore the session's feed on back-navigation; otherwise roll a fresh seed.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(CACHE_KEY);
      if (raw) {
        const c = JSON.parse(raw) as Cached;
        setPins(c.pins);
        setPage(c.page);
        setSeed(c.seed);
        setQ(c.q);
        setSearchInput(c.q);
        setHasMore(c.hasMore);
        return;
      }
    } catch {
      // Bad cache — fall through to a fresh load.
    }
    const fresh = Math.floor(Math.random() * 2 ** 31);
    setSeed(fresh);
    void loadPage(1, fresh, "", []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Infinite scroll: load the next page when the sentinel nears the viewport.
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || view !== "forYou") return;
    const io = new IntersectionObserver(
      (entries) => {
        if (
          entries[0].isIntersecting &&
          !loading &&
          hasMore &&
          seed !== null &&
          pins.length > 0
        ) {
          void loadPage(page + 1, seed, q, pins);
        }
      },
      { rootMargin: "600px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [view, loading, hasMore, seed, q, page, pins, loadPage]);

  function shuffle() {
    if (loading) return;
    const fresh = Math.floor(Math.random() * 2 ** 31);
    setSeed(fresh);
    setQ("");
    setSearchInput("");
    setPins([]);
    void loadPage(1, fresh, "", []);
  }

  function search(e: FormEvent) {
    e.preventDefault();
    if (loading || seed === null) return;
    const trimmed = searchInput.trim();
    setQ(trimmed);
    setView("forYou");
    setPins([]);
    void loadPage(1, seed, trimmed, []);
  }

  // Tapping the For You chip while a search is active clears the search.
  function showForYou() {
    setView("forYou");
    if (q && seed !== null && !loading) {
      setQ("");
      setSearchInput("");
      setPins([]);
      void loadPage(1, seed, "", []);
    }
  }

  async function toggleSave(pin: Pin) {
    try {
      const res = await fetch("/api/pins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pin),
      });
      const data = (await res.json().catch(() => null)) as
        | { saved?: boolean; pin?: SavedPin; error?: string }
        | null;
      if (!res.ok || data?.saved == null) {
        throw new Error(data?.error ?? "Couldn't save the pin — try again.");
      }
      setSaved((prev) => {
        const next = new Map(prev);
        if (data.saved && data.pin) next.set(pin.pexelsId, data.pin);
        else next.delete(pin.pexelsId);
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save the pin — try again.");
    }
  }

  function grid(list: Pin[], testid: string) {
    return (
      <div className="flex gap-2" data-testid={testid}>
        {splitColumns(list, cols).map((col, ci) => (
          <div key={ci} className="flex min-w-0 flex-1 flex-col gap-2">
            {col.map((pin) => (
              <PinCard
                key={pin.pexelsId}
                pin={pin}
                saved={saved.has(pin.pexelsId)}
                onOpen={() => setLightbox(pin)}
                onToggleSave={() => void toggleSave(pin)}
              />
            ))}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="mt-4 flex flex-col gap-4">
      <form onSubmit={search} role="search" className="flex gap-2">
        <input
          aria-label="Search inspiration"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          maxLength={100}
          placeholder="Search fashion inspiration…"
          className="min-w-0 flex-1 rounded-full bg-card px-4 py-3 text-ink placeholder:text-mute"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-full bg-card px-5 py-3 text-sm font-bold text-ink disabled:opacity-50"
        >
          Search
        </button>
      </form>

      <div className="flex items-center justify-between">
        <div className="flex gap-2" role="group" aria-label="Explore view">
          <button
            type="button"
            onClick={showForYou}
            aria-pressed={view === "forYou"}
            className={chipClass(view === "forYou")}
          >
            {q ? `“${q}”` : "For You"}
          </button>
          <button
            type="button"
            onClick={() => setView("saved")}
            aria-pressed={view === "saved"}
            className={chipClass(view === "saved")}
          >
            Saved
          </button>
        </div>
        {view === "forYou" && (
          <button
            type="button"
            onClick={shuffle}
            disabled={loading}
            className="rounded-full bg-card px-4 py-2 text-sm font-bold text-ink disabled:opacity-50"
          >
            Shuffle
          </button>
        )}
      </div>

      {error && <p className="text-sm text-error">{error}</p>}

      {view === "forYou" ? (
        <>
          {grid(pins, "pin-grid")}
          {loading && (
            <p role="status" className="text-sm text-mute">
              Finding inspiration…
            </p>
          )}
          <div ref={sentinelRef} aria-hidden="true" />
        </>
      ) : saved.size === 0 ? (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <p className="font-display text-3xl text-ink">Nothing pinned yet</p>
          <p className="text-mute">Tap the heart on any photo to keep it here.</p>
        </div>
      ) : (
        grid([...saved.values()], "saved-grid")
      )}

      {lightbox && (
        <PinLightbox
          pin={lightbox}
          saved={saved.has(lightbox.pexelsId)}
          onToggleSave={() => void toggleSave(lightbox)}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Write the page**

```tsx
// app/(tabs)/explore/page.tsx
import { desc } from "drizzle-orm";
import ExploreFeed from "@/components/explore/ExploreFeed";
import PageHeader from "@/components/shell/PageHeader";
import { getDb } from "@/lib/db/client";
import { pins } from "@/lib/db/schema";
import type { SavedPin } from "@/lib/explore/pexels";

export const dynamic = "force-dynamic";

export default async function ExplorePage() {
  const rows = await getDb().select().from(pins).orderBy(desc(pins.createdAt));
  const savedPins: SavedPin[] = rows.map((r) => ({
    id: r.id,
    pexelsId: r.pexelsId,
    width: r.width,
    height: r.height,
    alt: r.alt,
    photographer: r.photographer,
    photographerUrl: r.photographerUrl,
    pexelsUrl: r.pexelsUrl,
    imageUrl: r.imageUrl,
  }));
  return (
    <>
      <PageHeader title="Explore" />
      <ExploreFeed savedPins={savedPins} />
    </>
  );
}
```

- [ ] **Step 3: Add the menu link**

In `components/shell/Menu.tsx`, in the `LINKS` array, insert after the Stylist entry:

```ts
  { href: "/explore", label: "Explore" },
```

- [ ] **Step 4: Update `e2e/menu.spec.ts` for seven screens**

Change the navigation test's title and list:

```ts
test("full-screen menu navigates between all seven screens", async ({ page }) => {
  await page.goto("/today");
  for (const name of ["Closet", "Studio", "Stylist", "Explore", "Lookbook", "Settings", "Today"]) {
```

(The tab-trap test stays as-is — Settings is still the last link.)

- [ ] **Step 5: Write the Playwright spec (failing UI test first)**

```ts
// e2e/z-explore.spec.ts
import { expect, test } from "@playwright/test";

// Named z- to run LAST: by now studio.spec's tee/jeans/sneakers are seeded,
// so MOCK_AI stylist combos work for the "Style this" flow.
// NOTE: retries must stay 0 — the save-toggle test assumes a clean pins table.
test.describe.serial("explore", () => {
  test("feed renders a masonry of mock pins", async ({ page }) => {
    await page.goto("/explore");
    await expect(page.getByRole("heading", { level: 1, name: "Explore" })).toBeVisible();
    await expect(page.getByTestId("pin-card")).toHaveCount(30);
  });

  test("infinite scroll loads a second page", async ({ page }) => {
    await page.goto("/explore");
    await expect(page.getByTestId("pin-card")).toHaveCount(30);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect(page.getByTestId("pin-card")).toHaveCount(60);
  });

  test("search swaps the feed to the query", async ({ page }) => {
    await page.goto("/explore");
    await page.getByLabel("Search inspiration").fill("parisian chic");
    await page.getByRole("button", { name: "Search" }).click();
    await expect(page.locator('img[alt="Mock pin parisian chic 1"]')).toBeVisible();
    await expect(page.getByRole("button", { name: "“parisian chic”" })).toBeVisible();
  });

  test("lightbox shows credit and styles the look from the closet", async ({ page }) => {
    await page.goto("/explore");
    await page.getByRole("button", { name: /^Open pin/ }).first().click();
    const dialog = page.getByRole("dialog", { name: "Pin detail" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("link", { name: "Pexels" })).toBeVisible();
    await dialog.getByRole("button", { name: "Style this from my closet" }).click();
    await expect(dialog.getByTestId("suggestion-card").first()).toBeVisible();
    await expect(dialog.getByText("Mock look 1")).toBeVisible();
  });

  test("heart toggle saves, persists, and unsaves a pin", async ({ page }) => {
    await page.goto("/explore");
    await page.getByLabel("Save pin").first().click();
    await expect(page.getByLabel("Unsave pin").first()).toBeVisible();
    await page.getByRole("button", { name: "Saved", exact: true }).click();
    await expect(page.getByTestId("saved-grid").getByTestId("pin-card")).toHaveCount(1);
    // Survives a reload — it lives in the database, not component state.
    await page.reload();
    await page.getByRole("button", { name: "Saved", exact: true }).click();
    await expect(page.getByTestId("saved-grid").getByTestId("pin-card")).toHaveCount(1);
    await page.getByTestId("saved-grid").getByLabel("Unsave pin").click();
    await expect(page.getByText("Nothing pinned yet")).toBeVisible();
  });
});
```

- [ ] **Step 6: Run the full verification**

Run: `npm test && npm run typecheck && npm run test:e2e`
Expected: all green — unit suite unchanged, menu.spec now walks seven screens, z-explore.spec's 5 tests pass. If Turbopack serves stale route types after adding the page: stop server, `rm -rf .next`, retry.

- [ ] **Step 7: Commit**

```bash
git add components/explore/ExploreFeed.tsx "app/(tabs)/explore/page.tsx" components/shell/Menu.tsx e2e/menu.spec.ts e2e/z-explore.spec.ts
git commit -m "feat(explore): pinterest-style explore page with search, saves, and infinite scroll"
git push
```

---

### Task 11: Final verification sweep

**Files:** none new

- [ ] **Step 1: Full suite from a clean build**

```bash
rm -rf .next
npm test && npm run typecheck && npm run test:e2e
```

Expected: all three green. Paste the summary output as evidence.

- [ ] **Step 2: Phone-viewport eyeball (dev, MOCK_AI)**

With `npm run dev` running, load `http://localhost:8000/explore` at a ~390px viewport: masonry shows 2 columns of varied-height fixture pins; scroll appends more without existing pins jumping; heart, Saved toggle, lightbox, and Style-this all behave. This is a smoke pass, not a spec — report anything off.

- [ ] **Step 3: Commit any straggler fixes, push, and stop**

```bash
git status --porcelain   # commit + push anything outstanding
```

Merging `kloset-explore` → `main` is the user's call (superpowers:finishing-a-development-branch).

**Owner manual steps (after merge, for real-photo smoke):**
1. Create a free key at https://www.pexels.com/api/ (instant).
2. Put it in `.env.local` as `PEXELS_API_KEY=...` (never in chat/commits) and add the same var in Vercel project settings.
3. To see real photos locally: set `MOCK_AI=0` temporarily, restart dev, browse `/explore`, then set `MOCK_AI=1` back.

---

## Self-Review (performed at write time)

- **Spec coverage:** external Pexels photos ✓ (T3/T7), closet-seeded For You ✓ (T2/T7), new top-level Explore page after Stylist ✓ (T10), infinite scroll + shuffle + sessionStorage cache ✓ (T10), search bar ✓ (T10), lightbox with attribution ✓ (T9), Style-this via existing stylist ✓ (T8/T9), save pins + For You/Saved toggle ✓ (T6/T7/T10), merge kloset-dark first ✓ (T1), MOCK_AI fixtures + no client-side key ✓ (T3/T7), pins in e2e wipe ✓ (T6), tokens only ✓.
- **Type consistency:** `Pin`/`SavedPin`/`FeedPage` defined once in `lib/explore/pexels.ts` and imported everywhere; `fetchStylistOutfits`/`StylistOutfit` defined once in `SuggestionCard.tsx`; route response shapes in Task 7 match the client parsing in Task 10.
- **Known deliberate simplifications:** saved-view ordering is Map insertion order (newest saves last) — cosmetic; `hasMore` is always true in mock mode — fine, tests cap themselves; no per-pin error UI (one shared error line) — single-user app.
