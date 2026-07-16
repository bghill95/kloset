# Kloset P4 (Preferences + Trips/Packing + Gap Recommendations) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 👍/👎 preference learning on every suggestion card that feeds the AI stylist prompt (and filters Today's deterministic pick), a Trips screen with an AI-generated forecast-aware packing checklist, and a "More outfits if you add…" gap-recommendations card on the Stylist tab — plus the wears-constraint db:push fix and the deferred polish batch.

**Architecture:** Pure logic lives in `lib/prefs/`, `lib/trips/`, `lib/ai/packing.ts`, `lib/ai/gaps.ts`, and extensions to `lib/context/weather.ts` — all unit-tested. Thin API routes follow the house pattern (json guard → `Result<T>` validator → 400/404/502). Thumbs land inside the shared `OutfitActions` row so every suggestion surface (Stylist feed/occasion, Today, Explore lightbox, Lookbook detail) gets them for free. Trips is a new top-level screen; the gaps card is a section inside the existing `StylistTab` — no Shopping screen (scope trimmed by owner).

**Tech Stack:** Next.js 16 App Router, React 19, TS 6, Tailwind v4 (DESIGN.md tokens), Drizzle + Neon Postgres, OpenAI chat completions (`gpt-4.1-mini`, json_schema strict), Open-Meteo forecast+geocoding, Vitest, Playwright.

## Global Constraints

- All work on branch `kloset-p4`, cut from `main`. Every commit is also pushed (`git push`) — "commit" means commit AND push in this repo.
- Dev/tests always run `MOCK_AI=1` — it mocks ALL external services. Every new AI/weather path MUST have a deterministic mock (packing, gaps, range forecast). Exception already in tree: a set `PEXELS_API_KEY` overrides MOCK_AI for Explore only — do not copy that pattern to new code.
- Never read env vars or construct external clients at module scope — lazy access inside functions only (crashes `next build` otherwise).
- Always wrap `await req.json()` in try/catch and return 400.
- UI uses DESIGN.md token utilities ONLY: `bg-canvas`, `bg-card`, `bg-pink`, `bg-pink-deep`, `text-on-pink`, `text-ink`, `text-body`, `text-mute`, `text-error`, `bg-secondary`, `font-display`, `rounded-card`, `rounded-full`. Rose (`bg-pink`) = at most ONE primary CTA per screen; active/selected state is the ink inversion (`bg-ink text-canvas`).
- Vitest only picks up `lib/**/*.test.ts` — logic needing unit tests lives under `lib/`.
- e2e spec files run alphabetically with ONE DB wipe up front; later specs rely on earlier specs' seeds. New specs `z-prefs.spec.ts` and `z-trips.spec.ts` sort after `z-explore.spec.ts` (e < p < t) and rely on `studio.spec.ts`'s tee/jeans/sneakers seeds. e2e wipes settings, items, base_photos, outfits, wears, pins and (after Tasks 5/13) preferences, trips — never point `DATABASE_URL` at data you care about.
- A task is done only when `npm test && npm run typecheck && npm run test:e2e` are all green (UI tasks run all three; pure-lib tasks may defer e2e to the final sweep since they touch no routes/UI).
- `.env.local` is never committed. No new env vars in this phase.
- House DB pattern: plain id columns, **no foreign keys**; orphan sweeps at delete/read time.
- Next 16 quirks: dynamic route params are a Promise (`{ params }: { params: Promise<{ id: string }> }` — match `app/api/outfits/[id]/route.ts`); the route announcer has `role="alert"` so Playwright must use precise locators; if Turbopack serves stale tokens/types: stop server, `rm -rf .next`, restart.
- Dev server: `npm run dev` on **:4100**.
- `npm run db:push` re-emits no-op `ALTER ... SET DEFAULT '{}'::text[]` for text-array columns — a drizzle-kit quirk, not schema drift. Do not "fix" it. If db:push prompts for anything DESTRUCTIVE (truncate/drop), answer No and STOP — report it.

---

### Task 1: Branch setup + wears-constraint reconcile (unblocks db:push)

**Files:**
- Modify: `lib/db/schema.ts` (explicit unique-constraint name on wears)
- Modify: `e2e/global-setup.ts` (name the constraint in the mirror SQL)
- Modify: `CLAUDE.md` (Current plan pointer)
- Commit: `docs/superpowers/plans/2026-07-15-kloset-p4-preferences-trips-gaps.md` (this file)

**Interfaces:**
- Consumes: branches `main` (green at HEAD), live Neon DB
- Produces: branch `kloset-p4`; a `wears` unique constraint whose live name, schema name, and e2e-mirror name all agree — so Tasks 5 and 13 can `npm run db:push` cleanly

**Background:** the live `wears` table was created by e2e's hand-written SQL (`UNIQUE (outfit_id, worn_on)`), which Postgres auto-names `wears_outfit_id_worn_on_key`. Drizzle's `unique().on(...)` expects `wears_outfit_id_worn_on_unique`, so drizzle-kit tries to recreate the constraint and prompts about truncating wears on every push. Fix: make the name explicit and identical everywhere. Owner decision: **no data loss** — never accept a truncate.

- [ ] **Step 1: Cut the branch**

```bash
cd C:/Users/bghil/kloset
git status --porcelain   # must be empty except this untracked plan doc; stop and report otherwise
git checkout main && git pull
git checkout -b kloset-p4
git add docs/superpowers/plans/2026-07-15-kloset-p4-preferences-trips-gaps.md
git commit -m "docs: P4 preferences/trips/gaps implementation plan"
git push -u origin kloset-p4
```

- [ ] **Step 2: Discover the live constraint name**

```bash
node --input-type=module -e "
import { config } from 'dotenv';
config({ path: '.env.local' });
const { neon } = await import('@neondatabase/serverless');
const sql = neon(process.env.DATABASE_URL);
const rows = await sql\`SELECT conname FROM pg_constraint WHERE conrelid = 'wears'::regclass AND contype = 'u'\`;
console.log(JSON.stringify(rows));
"
```

Expected: `[{"conname":"wears_outfit_id_worn_on_key"}]`. If the name differs, use the actual name in Step 3's schema edit instead.

- [ ] **Step 3: Pin the name in the Drizzle schema**

In `lib/db/schema.ts`, change the wears constraint line:

```ts
  // Same outfit + same day is a toggle, never a duplicate. Name pinned to the
  // live DB's (Postgres auto-name from e2e's CREATE TABLE) so db:push agrees.
  (t) => [unique("wears_outfit_id_worn_on_key").on(t.outfitId, t.wornOn)],
```

- [ ] **Step 4: Pin the name in the e2e mirror**

In `e2e/global-setup.ts`, change the wears CREATE TABLE's last line from `UNIQUE (outfit_id, worn_on)` to:

```ts
    CONSTRAINT wears_outfit_id_worn_on_key UNIQUE (outfit_id, worn_on)
```

- [ ] **Step 5: Verify db:push is clean**

Run: `npm run db:push`
Expected: only the known no-op `ALTER ... SET DEFAULT '{}'::text[]` statements; **no truncate/drop prompt**. If prompted destructively: answer No, stop, report.

- [ ] **Step 6: Update the CLAUDE.md plan pointer**

In `CLAUDE.md`, change the `- Current plan:` line to:

```
- Current plan: docs/superpowers/plans/2026-07-15-kloset-p4-preferences-trips-gaps.md
```

- [ ] **Step 7: Verify suites, commit**

Run: `npm test && npm run typecheck`
Expected: all green (schema name change is metadata-only).

```bash
git add lib/db/schema.ts e2e/global-setup.ts CLAUDE.md
git commit -m "fix(db): pin wears unique-constraint name so db:push stops prompting"
git push
```

---

### Task 2: Server/lib polish batch (explore ledger items, with tests)

**Files:**
- Modify: `lib/explore/pexels.ts`, `lib/explore/queries.ts`, `lib/explore/masonry.ts`, `app/api/pins/route.ts`, `components/explore/ExploreFeed.tsx`
- Test: `lib/explore/pexels.test.ts`, `lib/explore/queries.test.ts`, `lib/explore/masonry.test.ts` (append)

**Interfaces:**
- Consumes: existing explore modules
- Produces: no interface changes — hardening only. `GET /api/pins` is DELETED (dead code; the explore page reads the DB directly).

- [ ] **Step 1: Write the failing tests (append to the three test files)**

Append to `lib/explore/pexels.test.ts` (add `afterEach`, `vi` to the vitest import; add `searchPexels` to the `./pexels` import):

```ts
describe("parsePexelsResponse credit links", () => {
  it("blanks non-https photographer and pexels urls", () => {
    const { pins } = parsePexelsResponse({
      photos: [photo(9, { photographer_url: "http://insecure.example", url: "javascript:alert(1)" })],
    });
    expect(pins[0].photographerUrl).toBe("");
    expect(pins[0].pexelsUrl).toBe("");
  });
});

describe("searchPexels", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("returns canned pins under MOCK_AI without a key", async () => {
    vi.stubEnv("MOCK_AI", "1");
    vi.stubEnv("PEXELS_API_KEY", "");
    await expect(searchPexels("boho", 1, 4)).resolves.toEqual({
      pins: mockPins("boho", 1, 4),
      hasMore: true,
    });
  });

  it("throws without a key when not mocked", async () => {
    vi.stubEnv("MOCK_AI", "0");
    vi.stubEnv("PEXELS_API_KEY", "");
    await expect(searchPexels("boho", 1, 4)).rejects.toThrow("PEXELS_API_KEY");
  });

  it("throws on a non-OK response", async () => {
    vi.stubEnv("MOCK_AI", "0");
    vi.stubEnv("PEXELS_API_KEY", "k");
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 429 })));
    await expect(searchPexels("boho", 1, 4)).rejects.toThrow("429");
  });
});
```

Append to `lib/explore/queries.test.ts` (inside a new describe):

```ts
describe("buildFeedQueries dedup", () => {
  it("drops a closet query that duplicates a staple", () => {
    const items = [{ styleTags: ["casual chic"], colors: [] }];
    const qs = buildFeedQueries(items, 1);
    expect(qs.filter((q) => q === "casual chic outfit")).toHaveLength(1);
    expect(qs).toHaveLength(1 + STAPLE_QUERIES.length - 0); // pool deduped, casual chic outfit == staple
  });
});
```

Wait — "casual chic outfit" IS the staple, so the pool has it once from tags and once from staples; after dedup length is `STAPLE_QUERIES.length` exactly. Use this assertion instead:

```ts
describe("buildFeedQueries dedup", () => {
  it("drops a closet query that duplicates a staple", () => {
    const items = [{ styleTags: ["casual chic"], colors: [] }];
    const qs = buildFeedQueries(items, 1);
    expect(qs).toHaveLength(STAPLE_QUERIES.length);
    expect(new Set(qs).size).toBe(qs.length);
  });
});
```

Append to `lib/explore/masonry.test.ts`:

```ts
  it("returns no columns for a non-positive count", () => {
    expect(splitColumns([pin(1, 500)], 0)).toEqual([]);
    expect(splitColumns([pin(1, 500)], -2)).toEqual([]);
  });
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `npx vitest run lib/explore`
Expected: the appended tests FAIL (https-blanking, dedup, count guard); prior tests pass. (`searchPexels` mock test may already pass — fine.)

- [ ] **Step 3: Implement the lib fixes**

In `lib/explore/pexels.ts`, inside `parsePexelsResponse`, replace the two URL fields of the pushed pin:

```ts
      photographerUrl:
        typeof p.photographer_url === "string" && p.photographer_url.startsWith("https://")
          ? p.photographer_url
          : "",
      pexelsUrl: typeof p.url === "string" && p.url.startsWith("https://") ? p.url : "",
```

In `lib/explore/queries.ts`, `buildFeedQueries` first line becomes:

```ts
  const pool = [...new Set([...closetQueries(items), ...STAPLE_QUERIES])];
```

In `lib/explore/masonry.ts`, first line of `splitColumns`:

```ts
  if (count < 1) return [];
```

- [ ] **Step 4: Fix the pins route (dead GET + insert race)**

`app/api/pins/route.ts`: DELETE the entire `GET` handler and the now-unused `desc` import. Replace the insert tail of `POST` with:

```ts
  const [row] = await db.insert(pins).values(pin).onConflictDoNothing().returning();
  if (!row) {
    // Lost a double-click race — the concurrent request saved it first.
    const [existing] = await db.select().from(pins).where(eq(pins.pexelsId, pin.pexelsId));
    if (!existing) return NextResponse.json({ saved: false });
    return NextResponse.json({ saved: true, pin: existing });
  }
  return NextResponse.json({ saved: true, pin: row }, { status: 201 });
```

- [ ] **Step 5: Fix ExploreFeed dedup + cache shape**

In `components/explore/ExploreFeed.tsx`:

1. Replace the merge block in `loadPage` (within-page dedup gap):

```ts
        // Neighboring queries — and a single page — can repeat a photo; drop repeats.
        const seen = new Set(current.map((p) => p.pexelsId));
        const merged = [...current];
        for (const p of data.pins) {
          if (!seen.has(p.pexelsId)) {
            seen.add(p.pexelsId);
            merged.push(p);
          }
        }
```

2. Add a shape guard above the component:

```ts
function isCached(v: unknown): v is Cached {
  if (typeof v !== "object" || v === null) return false;
  const c = v as Record<string, unknown>;
  return (
    typeof c.seed === "number" &&
    typeof c.page === "number" &&
    typeof c.q === "string" &&
    typeof c.hasMore === "boolean" &&
    Array.isArray(c.pins)
  );
}
```

3. In the restore effect, replace `const c = JSON.parse(raw) as Cached;` and the following sets with:

```ts
        const c: unknown = JSON.parse(raw);
        if (isCached(c)) {
          setPins(c.pins);
          setPage(c.page);
          setSeed(c.seed);
          setQ(c.q);
          setSearchInput(c.q);
          setHasMore(c.hasMore);
          return;
        }
```

(fall through to the fresh-seed path when the guard fails).

4. Search empty state — after the `{error && ...}` line's sibling block, inside the `view === "forYou"` branch right after `{grid(pins, "pin-grid")}`:

```tsx
          {!loading && !error && q && pins.length === 0 && (
            <p className="text-mute">Nothing for “{q}” — try another search.</p>
          )}
```

- [ ] **Step 6: Verify**

Run: `npm test && npm run typecheck && npm run test:e2e`
Expected: all green (z-explore exercises the modified feed + pins toggle end-to-end).

- [ ] **Step 7: Commit**

```bash
git add lib/explore app/api/pins/route.ts components/explore/ExploreFeed.tsx
git commit -m "fix(explore): polish batch — credit https-blanking, page dedup, cache guard, pins race, drop dead GET"
git push
```

---

### Task 3: UI/a11y polish batch (aria-alerts, focus return, SSR date, serialized type, wears sweep assert)

**Files:**
- Modify: `components/outfits/OutfitActions.tsx`, `components/stylist/StylistTab.tsx`, `components/lookbook/DeleteOutfitButton.tsx`, `components/explore/PinLightbox.tsx`, `components/explore/ExploreFeed.tsx`, `components/outfits/SuggestionCard.tsx`, `components/studio/OutfitCollage.tsx`, `lib/closet/types.ts`
- Modify: `e2e/wears.spec.ts` (sweep assert)

**Interfaces:**
- Consumes: existing components
- Produces: `SerializedClosetItem` in `lib/closet/types.ts` (used by Task 7+ code); `StylistOutfit.items` becomes `SerializedClosetItem[]`; `OutfitCollage` accepts `CollageItem[]` (a Pick both item types satisfy). Everything else is attribute-level.

- [ ] **Step 1: role="alert" on error paragraphs**

Change these five error lines (each is currently `<p className="text-sm text-error">…` — add `role="alert"`):
- `components/outfits/OutfitActions.tsx`: `{error && <p role="alert" className="text-sm text-error">{error}</p>}`
- `components/stylist/StylistTab.tsx`: both `{resultsError && …}` and `{feedError && …}` paragraphs
- `components/lookbook/DeleteOutfitButton.tsx`: `{error && <p role="alert" className="w-full text-sm text-error">{error}</p>}`
- `components/explore/PinLightbox.tsx`: the `{styleError && …}` paragraph
- `components/explore/ExploreFeed.tsx`: the `{error && …}` paragraph

(Playwright never uses `getByRole("alert")` loosely in this repo — the Next 16 announcer rule — so no spec changes.)

- [ ] **Step 2: PinLightbox focus return**

Replace the mount effect in `components/explore/PinLightbox.tsx`:

```tsx
  // Same dialog manners as the Menu overlay: lock scroll, focus the close
  // button, and hand focus back to the opener on close.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = "";
      opener?.focus();
    };
  }, []);
```

- [ ] **Step 3: StylistTab date-input SSR hydration fix**

In `components/stylist/StylistTab.tsx`:

```tsx
  // Client-only date init: the server's local date can differ from the
  // viewer's (same family as TodayCard's dateKey fix).
  const [date, setDate] = useState("");
  const [dateBounds, setDateBounds] = useState<{ min: string; max: string } | null>(null);
  useEffect(() => {
    setDate(localDateKey());
    setDateBounds({
      min: localDateKey(),
      max: localDateKey(new Date(Date.now() + MAX_DATE_OFFSET_DAYS * 24 * 60 * 60 * 1000)),
    });
  }, []);
```

Delete the old `const [date, setDate] = useState(() => localDateKey());` and the render-time `const minDate/maxDate` pair; the input becomes `min={dateBounds?.min} max={dateBounds?.max}`.

- [ ] **Step 4: SerializedClosetItem across the stylist JSON boundary**

Append to `lib/closet/types.ts`:

```ts
// ClosetItem as it crosses a JSON boundary (Date serializes to an ISO string).
export type SerializedClosetItem = Omit<ClosetItem, "createdAt"> & { createdAt: string };
```

In `components/outfits/SuggestionCard.tsx`, change the import + type:

```ts
import type { SerializedClosetItem } from "@/lib/closet/types";

export type StylistOutfit = { name: string; reason: string; items: SerializedClosetItem[] };
```

In `components/studio/OutfitCollage.tsx`, widen the prop so both shapes fit:

```tsx
import type { ClosetItem } from "@/lib/closet/types";

type CollageItem = Pick<ClosetItem, "id" | "name" | "category" | "imageUrl">;

export default function OutfitCollage({ items }: { items: CollageItem[] }) {
```

- [ ] **Step 5: wears sweep assert**

At the end of the "deleting the outfit removes it and its wears" test in `e2e/wears.spec.ts`, append:

```ts
    // The delete route sweeps orphan wears (no FK) — verify via the API.
    const swept = await page.request.get("/api/wears?on=2026-07-01");
    expect((await swept.json()).wears).toEqual([]);
```

- [ ] **Step 6: Verify**

Run: `npm test && npm run typecheck && npm run test:e2e`
Expected: all green.

- [ ] **Step 7: Commit**

```bash
git add components lib/closet/types.ts e2e/wears.spec.ts
git commit -m "fix(a11y): polish batch — alert roles, lightbox focus return, SSR date init, serialized item type, wears sweep assert"
git push
```

---

### Task 4: Preferences libs — validation + aggregation (`lib/prefs/`)

**Files:**
- Create: `lib/prefs/validation.ts`, `lib/prefs/aggregate.ts`
- Test: `lib/prefs/validation.test.ts`, `lib/prefs/aggregate.test.ts`

**Interfaces:**
- Consumes: `Result<T>`, `UUID_RE` from `@/lib/closet/item-validation`; `OUTFIT_SOURCES`, `OutfitSource`, `validateItemIds` from `@/lib/outfits/validation`; `ClosetItem` from `@/lib/closet/types`
- Produces (Tasks 6–13 rely on these exact names):
  - `VERDICTS`, `type Verdict = "like" | "dislike"`, `type NewVote = { itemIds: string[]; verdict: Verdict; source: OutfitSource }`
  - `voteKey(itemIds: string[]): string` — lowercased, sorted, comma-joined (order-insensitive canonical key)
  - `validateVoteBody(raw: unknown): Result<NewVote>`; `validateItemsParam(raw: string | null): Result<string[]>`
  - `type Vote = { itemIds: string[]; verdict: Verdict }`, `type ItemScore = { likes: number; dislikes: number }`
  - `type TasteProfile = { likedTags: string[]; dislikedTags: string[]; likedColors: string[]; dislikedColors: string[] }`
  - `type PrefsSignal = { scores: Record<string, ItemScore>; profile: TasteProfile }`
  - `itemScores(votes: Vote[]): Record<string, ItemScore>`; `hardDisliked(votes: Vote[]): string[]` (net dislikes > likes)
  - `tasteProfile(votes: Vote[], items: Pick<ClosetItem, "id" | "styleTags" | "colors">[]): TasteProfile`
  - `tasteLines(profile: TasteProfile): string[]` (0–2 prompt lines); `prefsSignal(votes, items): PrefsSignal`

- [ ] **Step 1: Write the failing tests**

```ts
// lib/prefs/validation.test.ts
import { describe, expect, it } from "vitest";
import { validateItemsParam, validateVoteBody, voteKey } from "./validation";

const A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

describe("voteKey", () => {
  it("is order- and case-insensitive", () => {
    expect(voteKey([B, A.toUpperCase()])).toBe(`${A},${B}`);
    expect(voteKey([A, B])).toBe(voteKey([B, A]));
  });
});

describe("validateVoteBody", () => {
  it("accepts a vote and defaults source to stylist", () => {
    expect(validateVoteBody({ itemIds: [A, B], verdict: "like" })).toEqual({
      ok: true,
      value: { itemIds: [A, B], verdict: "like", source: "stylist" },
    });
  });

  it("accepts an explicit source and dislike", () => {
    const r = validateVoteBody({ itemIds: [A], verdict: "dislike", source: "today" });
    expect(r.ok && r.value.source).toBe("today");
  });

  it("rejects bad verdicts, sources, ids, and non-objects", () => {
    expect(validateVoteBody(null).ok).toBe(false);
    expect(validateVoteBody({ itemIds: [A], verdict: "meh" }).ok).toBe(false);
    expect(validateVoteBody({ itemIds: [A], verdict: "like", source: "explore" }).ok).toBe(false);
    expect(validateVoteBody({ itemIds: ["nope"], verdict: "like" }).ok).toBe(false);
    expect(validateVoteBody({ itemIds: [], verdict: "like" }).ok).toBe(false);
  });
});

describe("validateItemsParam", () => {
  it("parses a comma list of uuids", () => {
    expect(validateItemsParam(`${A},${B}`)).toEqual({ ok: true, value: [A, B] });
  });

  it("rejects missing, empty, and malformed params", () => {
    expect(validateItemsParam(null).ok).toBe(false);
    expect(validateItemsParam("").ok).toBe(false);
    expect(validateItemsParam(`${A},junk`).ok).toBe(false);
  });
});
```

```ts
// lib/prefs/aggregate.test.ts
import { describe, expect, it } from "vitest";
import {
  hardDisliked,
  itemScores,
  prefsSignal,
  tasteLines,
  tasteProfile,
  type Vote,
} from "./aggregate";

const vote = (itemIds: string[], verdict: Vote["verdict"]): Vote => ({ itemIds, verdict });
const item = (id: string, styleTags: string[], colors: string[]) => ({ id, styleTags, colors });

describe("itemScores", () => {
  it("counts likes and dislikes per item across votes", () => {
    const scores = itemScores([vote(["a", "b"], "like"), vote(["a"], "dislike")]);
    expect(scores).toEqual({ a: { likes: 1, dislikes: 1 }, b: { likes: 1, dislikes: 0 } });
  });
});

describe("hardDisliked", () => {
  it("returns items whose dislikes outnumber likes", () => {
    const votes = [
      vote(["a"], "dislike"),
      vote(["a", "b"], "dislike"),
      vote(["a"], "like"),
      vote(["b"], "like"),
    ];
    expect(hardDisliked(votes)).toEqual(["a"]); // a: 2>1; b: 1==1 stays
  });
});

describe("tasteProfile", () => {
  it("nets tags and colors, normalized, ignoring unknown ids", () => {
    const items = [item("a", ["Minimalist"], ["black"]), item("b", ["neon"], ["black"])];
    const votes = [vote(["a"], "like"), vote(["b"], "dislike"), vote(["ghost"], "like")];
    expect(tasteProfile(votes, items)).toEqual({
      likedTags: ["minimalist"],
      dislikedTags: ["neon"],
      likedColors: [],  // black nets to 0 (one like, one dislike)
      dislikedColors: [],
    });
  });
});

describe("tasteLines", () => {
  it("renders like/avoid lines and nothing when empty", () => {
    expect(
      tasteLines({ likedTags: ["boho"], dislikedTags: [], likedColors: ["red"], dislikedColors: ["neon green"] }),
    ).toEqual([
      "Her feedback says she likes: boho, red.",
      "Her feedback says to avoid: neon green.",
    ]);
    expect(tasteLines({ likedTags: [], dislikedTags: [], likedColors: [], dislikedColors: [] })).toEqual([]);
  });
});

describe("prefsSignal", () => {
  it("bundles scores and profile", () => {
    const items = [item("a", ["boho"], [])];
    const s = prefsSignal([vote(["a"], "like")], items);
    expect(s.scores.a.likes).toBe(1);
    expect(s.profile.likedTags).toEqual(["boho"]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/prefs`
Expected: FAIL — cannot resolve `./validation` / `./aggregate`.

- [ ] **Step 3: Write the implementations**

```ts
// lib/prefs/validation.ts
import { type Result, UUID_RE } from "@/lib/closet/item-validation";
import { OUTFIT_SOURCES, type OutfitSource, validateItemIds } from "@/lib/outfits/validation";

export const VERDICTS = ["like", "dislike"] as const;
export type Verdict = (typeof VERDICTS)[number];

export type NewVote = { itemIds: string[]; verdict: Verdict; source: OutfitSource };

// One vote row per distinct combo: lowercased, sorted, comma-joined ids.
export function voteKey(itemIds: string[]): string {
  return itemIds
    .map((id) => id.toLowerCase())
    .sort()
    .join(",");
}

export function validateVoteBody(raw: unknown): Result<NewVote> {
  if (typeof raw !== "object" || raw === null) {
    return { ok: false, error: "Body must be an object." };
  }
  const o = raw as Record<string, unknown>;
  if (typeof o.verdict !== "string" || !(VERDICTS as readonly string[]).includes(o.verdict)) {
    return { ok: false, error: "verdict must be 'like' or 'dislike'." };
  }
  const ids = validateItemIds(o.itemIds);
  if (!ids.ok) return ids;
  const source = (o.source ?? "stylist") as string;
  if (!(OUTFIT_SOURCES as readonly string[]).includes(source)) {
    return { ok: false, error: "Invalid source." };
  }
  return {
    ok: true,
    value: { itemIds: ids.value, verdict: o.verdict as Verdict, source: source as OutfitSource },
  };
}

export function validateItemsParam(raw: string | null): Result<string[]> {
  if (!raw) return { ok: false, error: "items is required (comma-separated item UUIDs)." };
  const parts = raw.split(",");
  if (!parts.every((p) => UUID_RE.test(p))) {
    return { ok: false, error: "items must be item UUIDs." };
  }
  return { ok: true, value: [...new Set(parts)] };
}
```

```ts
// lib/prefs/aggregate.ts
import type { ClosetItem } from "@/lib/closet/types";
import type { Verdict } from "./validation";

export type Vote = { itemIds: string[]; verdict: Verdict };
export type ItemScore = { likes: number; dislikes: number };
export type TasteProfile = {
  likedTags: string[];
  dislikedTags: string[];
  likedColors: string[];
  dislikedColors: string[];
};
export type PrefsSignal = { scores: Record<string, ItemScore>; profile: TasteProfile };

const MAX_TASTE = 5;

export function itemScores(votes: Vote[]): Record<string, ItemScore> {
  const scores: Record<string, ItemScore> = {};
  for (const vote of votes) {
    for (const id of vote.itemIds) {
      const s = (scores[id] ??= { likes: 0, dislikes: 0 });
      if (vote.verdict === "like") s.likes += 1;
      else s.dislikes += 1;
    }
  }
  return scores;
}

// "Hard-disliked" = net negative. Today's pick filters these out.
export function hardDisliked(votes: Vote[]): string[] {
  return Object.entries(itemScores(votes))
    .filter(([, s]) => s.dislikes > s.likes)
    .map(([id]) => id);
}

function bump(map: Map<string, number>, raw: string, sign: number): void {
  const key = raw.trim().toLowerCase();
  if (key) map.set(key, (map.get(key) ?? 0) + sign);
}

function top(map: Map<string, number>, sign: 1 | -1): string[] {
  return [...map.entries()]
    .filter(([, net]) => sign * net > 0)
    .sort((a, b) => sign * (b[1] - a[1]) || a[0].localeCompare(b[0]))
    .slice(0, MAX_TASTE)
    .map(([k]) => k);
}

export function tasteProfile(
  votes: Vote[],
  items: Pick<ClosetItem, "id" | "styleTags" | "colors">[],
): TasteProfile {
  const byId = new Map(items.map((i) => [i.id, i]));
  const tagNet = new Map<string, number>();
  const colorNet = new Map<string, number>();
  for (const vote of votes) {
    const sign = vote.verdict === "like" ? 1 : -1;
    for (const id of vote.itemIds) {
      const item = byId.get(id);
      if (!item) continue;
      for (const t of item.styleTags) bump(tagNet, t, sign);
      for (const c of item.colors) bump(colorNet, c, sign);
    }
  }
  return {
    likedTags: top(tagNet, 1),
    dislikedTags: top(tagNet, -1),
    likedColors: top(colorNet, 1),
    dislikedColors: top(colorNet, -1),
  };
}

export function tasteLines(p: TasteProfile): string[] {
  const lines: string[] = [];
  const likes = [...p.likedTags, ...p.likedColors];
  const avoid = [...p.dislikedTags, ...p.dislikedColors];
  if (likes.length > 0) lines.push(`Her feedback says she likes: ${likes.join(", ")}.`);
  if (avoid.length > 0) lines.push(`Her feedback says to avoid: ${avoid.join(", ")}.`);
  return lines;
}

export function prefsSignal(
  votes: Vote[],
  items: Pick<ClosetItem, "id" | "styleTags" | "colors">[],
): PrefsSignal {
  return { scores: itemScores(votes), profile: tasteProfile(votes, items) };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/prefs`
Expected: all PASS. Then `npm test && npm run typecheck` — green.

- [ ] **Step 5: Commit**

```bash
git add lib/prefs
git commit -m "feat(prefs): vote validation and preference aggregation libs"
git push
```

---

### Task 5: `preferences` table (schema, e2e wipe, CLAUDE.md, db push)

**Files:**
- Modify: `lib/db/schema.ts` (append table)
- Modify: `e2e/global-setup.ts` (create + wipe)
- Modify: `CLAUDE.md` (both wiped-table lists)

**Interfaces:**
- Consumes: drizzle `pgTable` helpers (all needed types already imported)
- Produces: `preferences` table export — Tasks 6, 8, 9, 13, 15 read it.

- [ ] **Step 1: Append to `lib/db/schema.ts`**

```ts
// Outfit-combo feedback (👍/👎 on suggestion cards). item_key is the
// canonical sorted id list — one vote per distinct combo, so re-voting
// toggles or flips in place. No FK (house pattern): deleted items simply
// stop matching at aggregation time.
export const preferences = pgTable("preferences", {
  id: uuid("id").primaryKey().defaultRandom(),
  itemKey: text("item_key").notNull().unique(),
  itemIds: uuid("item_ids").array().notNull(),
  verdict: text("verdict", { enum: ["like", "dislike"] }).notNull(),
  source: text("source", { enum: ["studio", "stylist", "today"] })
    .notNull()
    .default("stylist"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
```

- [ ] **Step 2: Mirror in `e2e/global-setup.ts`** (after the pins CREATE):

```ts
  // Keep in sync with lib/db/schema.ts
  await sql`CREATE TABLE IF NOT EXISTS preferences (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    item_key text NOT NULL UNIQUE,
    item_ids uuid[] NOT NULL,
    verdict text NOT NULL,
    source text NOT NULL DEFAULT 'stylist',
    created_at timestamp NOT NULL DEFAULT now()
  )`;
```

And in the wipe block: `await sql`DELETE FROM preferences`;`

- [ ] **Step 3: Update CLAUDE.md wipe lists**

Both mentions ("creates + wipes the settings, items, base_photos, outfits, wears and pins tables" under Commands; "e2e wipes the settings, items, base_photos, outfits, wears and pins tables" under Rules) gain `preferences` — e.g. "…outfits, wears, pins and preferences tables".

- [ ] **Step 4: Push and verify**

Run: `npm run db:push` → expect `CREATE TABLE preferences` + the known no-op text[] ALTERs, nothing destructive.
Run: `npm run typecheck` → clean.

- [ ] **Step 5: Commit**

```bash
git add lib/db/schema.ts e2e/global-setup.ts CLAUDE.md
git commit -m "feat(prefs): preferences table for outfit feedback"
git push
```

---

### Task 6: `/api/preferences` route (toggle POST + lookup GET)

**Files:**
- Create: `app/api/preferences/route.ts`

**Interfaces:**
- Consumes: `voteKey`, `validateVoteBody`, `validateItemsParam` (Task 4); `preferences` (Task 5); `getDb`
- Produces (Task 7's client calls these):
  - `GET /api/preferences?items=a,b,c` → 200 `{ vote: "like" | "dislike" | null }` | 400 `{ error }`
  - `POST /api/preferences` (body `{ itemIds, verdict, source? }`) → tri-state toggle: new vote 201 `{ vote }`, flipped 200 `{ vote }`, re-voted-same 200 `{ vote: null }` (cleared) | 400 `{ error }`

- [ ] **Step 1: Write the route**

```ts
// app/api/preferences/route.ts
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { preferences } from "@/lib/db/schema";
import { validateItemsParam, validateVoteBody, voteKey } from "@/lib/prefs/validation";

// Lookup: does this exact combo already carry a vote?
export async function GET(req: NextRequest) {
  const parsed = validateItemsParam(req.nextUrl.searchParams.get("items"));
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const [row] = await getDb()
    .select()
    .from(preferences)
    .where(eq(preferences.itemKey, voteKey(parsed.value)));
  return NextResponse.json({ vote: row?.verdict ?? null });
}

// Tri-state toggle: same verdict clears, other verdict flips, none inserts.
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const parsed = validateVoteBody(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const vote = parsed.value;
  const key = voteKey(vote.itemIds);
  const db = getDb();
  const [existing] = await db.select().from(preferences).where(eq(preferences.itemKey, key));
  if (existing && existing.verdict === vote.verdict) {
    await db.delete(preferences).where(eq(preferences.itemKey, key));
    return NextResponse.json({ vote: null });
  }
  if (existing) {
    await db
      .update(preferences)
      .set({ verdict: vote.verdict, source: vote.source })
      .where(eq(preferences.itemKey, key));
    return NextResponse.json({ vote: vote.verdict });
  }
  await db
    .insert(preferences)
    .values({ itemKey: key, itemIds: vote.itemIds, verdict: vote.verdict, source: vote.source })
    // Double-click race: the concurrent insert won — converge on this verdict.
    .onConflictDoUpdate({ target: preferences.itemKey, set: { verdict: vote.verdict } });
  return NextResponse.json({ vote: vote.verdict }, { status: 201 });
}
```

- [ ] **Step 2: Smoke against the dev server**

```bash
U=11111111-1111-1111-1111-111111111111
curl -s -X POST http://localhost:4100/api/preferences -H "Content-Type: application/json" -d "{\"itemIds\":[\"$U\"],\"verdict\":\"like\"}"
curl -s "http://localhost:4100/api/preferences?items=$U"
curl -s -X POST http://localhost:4100/api/preferences -H "Content-Type: application/json" -d "{\"itemIds\":[\"$U\"],\"verdict\":\"dislike\"}"
curl -s -X POST http://localhost:4100/api/preferences -H "Content-Type: application/json" -d "{\"itemIds\":[\"$U\"],\"verdict\":\"dislike\"}"
curl -s "http://localhost:4100/api/preferences?items=$U"
curl -s -X POST http://localhost:4100/api/preferences -H "Content-Type: application/json" -d "{\"verdict\":\"like\"}"
```

Expected in order: `{"vote":"like"}`; `{"vote":"like"}`; `{"vote":"dislike"}`; `{"vote":null}`; `{"vote":null}`; `{"error":"itemIds must be an array."}`. (Net zero rows left behind.)

- [ ] **Step 3: Typecheck + commit**

Run: `npm run typecheck` → clean.

```bash
git add app/api/preferences/route.ts
git commit -m "feat(prefs): vote toggle and lookup API route"
git push
```

---

### Task 7: 👍/👎 thumbs in `OutfitActions` + e2e

**Files:**
- Modify: `components/outfits/OutfitActions.tsx`
- Create: `e2e/z-prefs.spec.ts`

**Interfaces:**
- Consumes: `GET|POST /api/preferences` (Task 6); existing `run()` machinery
- Produces: thumbs on EVERY OutfitActions surface (Stylist feed/occasion, Today, Explore lightbox, Lookbook detail — shared component, intentional). Button labels `Like this outfit` / `Dislike this outfit`, `aria-pressed` reflects the vote.

- [ ] **Step 1: Add vote state + buttons to `components/outfits/OutfitActions.tsx`**

Add `useEffect` to the react import. After the `const [error, setError]` line, add:

```tsx
  const [vote, setVote] = useState<"like" | "dislike" | null>(null);

  // Show the existing vote when this exact combo reappears (matched by item-set).
  // ponytail: one lookup per mounted card — fine for a single-user app.
  useEffect(() => {
    if (itemIds.length === 0) return;
    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetch(`/api/preferences?items=${itemIds.join(",")}`, {
          signal: controller.signal,
        });
        if (res.ok) {
          const data = (await res.json()) as { vote: "like" | "dislike" | null };
          setVote(data.vote);
        }
      } catch {
        // Lookup is best-effort; thumbs start neutral.
      }
    })();
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const voteOutfit = (verdict: "like" | "dislike") =>
    run(async () => {
      const res = await fetch("/api/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemIds, verdict, source }),
      });
      const data = (await res.json().catch(() => null)) as
        | { vote?: "like" | "dislike" | null; error?: string }
        | null;
      if (!res.ok || !data || !("vote" in data)) {
        throw new Error(data?.error ?? "Couldn't save your feedback — try again.");
      }
      setVote(data.vote ?? null);
    });
```

After the `Open in Studio` Link inside the button row, add:

```tsx
        <button
          type="button"
          onClick={() => voteOutfit("like")}
          disabled={busy}
          aria-pressed={vote === "like"}
          aria-label="Like this outfit"
          className={pillClass(vote === "like")}
        >
          👍
        </button>
        <button
          type="button"
          onClick={() => voteOutfit("dislike")}
          disabled={busy}
          aria-pressed={vote === "dislike"}
          aria-label="Dislike this outfit"
          className={pillClass(vote === "dislike")}
        >
          👎
        </button>
```

- [ ] **Step 2: Write the failing e2e spec**

```ts
// e2e/z-prefs.spec.ts
import { expect, test } from "@playwright/test";

// Named z-prefs to run after studio.spec's seeds (tee/jeans/sneakers) so
// MOCK_AI stylist combos exist. Runs after z-explore (e < p).
test.describe.serial("preferences", () => {
  test("thumbs toggle, persist across reload, and flip", async ({ page }) => {
    await page.goto("/stylist");
    const card = page.getByTestId("suggestion-card").first();
    const like = card.getByRole("button", { name: "Like this outfit" });
    await expect(like).toHaveAttribute("aria-pressed", "false");
    await like.click();
    await expect(like).toHaveAttribute("aria-pressed", "true");

    // Survives a reload — feed restores from sessionStorage, vote from the DB.
    await page.reload();
    const cardAfter = page.getByTestId("suggestion-card").first();
    await expect(cardAfter.getByRole("button", { name: "Like this outfit" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    // Voting the other way flips rather than stacking.
    await cardAfter.getByRole("button", { name: "Dislike this outfit" }).click();
    await expect(cardAfter.getByRole("button", { name: "Dislike this outfit" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(cardAfter.getByRole("button", { name: "Like this outfit" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );

    // Re-voting the same way clears (leaves the table clean for later specs).
    await cardAfter.getByRole("button", { name: "Dislike this outfit" }).click();
    await expect(cardAfter.getByRole("button", { name: "Dislike this outfit" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  test("api tri-state toggle", async ({ page }) => {
    const u = "22222222-2222-2222-2222-222222222222";
    const post = (verdict: string) =>
      page.request.post("/api/preferences", { data: { itemIds: [u], verdict } });
    expect((await (await post("like")).json()).vote).toBe("like");
    expect((await (await post("dislike")).json()).vote).toBe("dislike");
    expect((await (await post("dislike")).json()).vote).toBe(null);
  });
});
```

- [ ] **Step 3: Verify**

Run: `npm test && npm run typecheck && npm run test:e2e`
Expected: all green, including the 2 new z-prefs tests. (Existing specs are unaffected: the new buttons have unique accessible names.)

- [ ] **Step 4: Commit**

```bash
git add components/outfits/OutfitActions.tsx e2e/z-prefs.spec.ts
git commit -m "feat(prefs): thumbs voting on every suggestion card"
git push
```

---

### Task 8: Prompt injection — preferences into the AI stylist

**Files:**
- Modify: `lib/ai/stylist.ts`, `app/api/stylist/route.ts`
- Test: `lib/ai/stylist.test.ts` (append)

**Interfaces:**
- Consumes: `PrefsSignal`, `tasteLines`, `prefsSignal` (Task 4); `preferences` (Task 5)
- Produces (packing/gaps in Tasks 12/15 import these):
  - `export function isMockAi(): boolean` (now exported)
  - `export function inventoryLines(items: ClosetItem[], prefs?: PrefsSignal | null): string` (now exported, feedback-aware)
  - `export function stylistPrompt(items: ClosetItem[], opts: StylistOptions): string` (extracted, pure, testable)
  - `StylistOptions` gains `prefs?: PrefsSignal | null`

- [ ] **Step 1: Write the failing tests (append to `lib/ai/stylist.test.ts`)**

```ts
describe("stylistPrompt", () => {
  const promptItem = (id: string, category: Category, tags: string[]): ClosetItem => ({
    id,
    name: `Item ${id}`,
    category,
    colors: ["black"],
    styleTags: tags,
    imageUrl: "/x.svg",
    originalImageUrl: "/x.svg",
    createdAt: new Date("2026-01-01"),
  });
  const items = [promptItem("id-1", "top", ["minimalist"]), promptItem("id-2", "bottom", [])];
  const prefs = {
    scores: { "id-1": { likes: 2, dislikes: 1 } },
    profile: { likedTags: ["minimalist"], dislikedTags: ["neon"], likedColors: [], dislikedColors: [] },
  };

  it("flags feedback inline and adds taste lines", () => {
    const prompt = stylistPrompt(items, { count: 3, prefs });
    expect(prompt).toContain("id-1 | top | Item id-1");
    expect(prompt).toContain("feedback: liked 2×, disliked 1×");
    expect(prompt).toContain("Her feedback says she likes: minimalist.");
    expect(prompt).toContain("Her feedback says to avoid: neon.");
    expect(prompt).toContain("Honor the feedback signals");
  });

  it("omits feedback plumbing without prefs", () => {
    const prompt = stylistPrompt(items, { count: 3 });
    expect(prompt).not.toContain("feedback:");
    expect(prompt).not.toContain("Honor the feedback signals");
  });
});
```

(Add `stylistPrompt` to the `./stylist` import, `Category` to the categories import if not present, and `ClosetItem` if not present.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/ai/stylist.test.ts`
Expected: FAIL — `stylistPrompt` not exported.

- [ ] **Step 3: Modify `lib/ai/stylist.ts`**

1. Add the import: `import { type PrefsSignal, tasteLines } from "@/lib/prefs/aggregate";`
2. `StylistOptions` gains `prefs?: PrefsSignal | null;`
3. Export `isMockAi` (add `export` keyword).
4. Replace `inventoryLines` with the exported, feedback-aware version:

```ts
export function inventoryLines(items: ClosetItem[], prefs?: PrefsSignal | null): string {
  return items
    .map((i) => {
      const s = prefs?.scores[i.id];
      const parts: string[] = [];
      if (s?.likes) parts.push(`liked ${s.likes}×`);
      if (s?.dislikes) parts.push(`disliked ${s.dislikes}×`);
      const feedback = parts.length > 0 ? ` | feedback: ${parts.join(", ")}` : "";
      return `- ${i.id} | ${i.category} | ${i.name} | colors: ${i.colors.join(", ") || "n/a"} | tags: ${i.styleTags.join(", ") || "n/a"}${feedback}`;
    })
    .join("\n");
}
```

5. Extract the prompt into a pure exported function, and use it in `suggestOutfits`:

```ts
export function stylistPrompt(items: ClosetItem[], opts: StylistOptions): string {
  const contextLines = [
    opts.occasion
      ? `Occasion: ${opts.occasion}${opts.date ? ` on ${opts.date}` : ""}.`
      : "General inspiration — varied, everyday looks.",
    opts.weather
      ? `Weather that day: ${opts.weather.tempMin}–${opts.weather.tempMax}°, ${opts.weather.label}.`
      : null,
    ...(opts.prefs ? tasteLines(opts.prefs.profile) : []),
  ]
    .filter(Boolean)
    .join("\n");
  const feedbackRule = opts.prefs
    ? "Honor the feedback signals: favor liked items and styles, avoid disliked ones unless nothing else fits. "
    : "";
  return (
    `You are a personal stylist. Compose ${opts.count} distinct outfits using ONLY items from this closet, referenced by their exact ids:\n` +
    `${inventoryLines(items, opts.prefs)}\n\n${contextLines}\n\n` +
    `Rules: every outfit needs either a dress, or a top and a bottom. At most one item per category. ` +
    `Add shoes/jacket/hat/accessory only when they suit the look. ` +
    feedbackRule +
    `Give each outfit a short evocative name and a one-sentence reason.`
  );
}
```

In `suggestOutfits`, delete the inline `contextLines` block and change the message to `content: stylistPrompt(items, opts)`. The MOCK path is untouched (returns before the prompt — keeps e2e deterministic).

- [ ] **Step 4: Wire prefs in `app/api/stylist/route.ts`**

Add imports: `preferences` to the schema import; `import { prefsSignal } from "@/lib/prefs/aggregate";`. After the items query:

```ts
  const votes = await getDb().select().from(preferences);
  const prefs = votes.length > 0 ? prefsSignal(votes, all) : null;
```

And pass it: `combos = await suggestOutfits(all, { count, occasion, date, weather, prefs });`

- [ ] **Step 5: Verify**

Run: `npm test && npm run typecheck && npm run test:e2e`
Expected: all green (mock stylist path unchanged; new unit tests pass).

- [ ] **Step 6: Commit**

```bash
git add lib/ai/stylist.ts app/api/stylist/route.ts lib/ai/stylist.test.ts
git commit -m "feat(prefs): feedback flags and taste lines in the stylist prompt"
git push
```

---

### Task 9: Today pick filters hard-disliked items

**Files:**
- Modify: `lib/today/pick.ts`, `app/(tabs)/today/page.tsx`, `components/today/TodayCard.tsx`
- Test: `lib/today/pick.test.ts` (append)

**Interfaces:**
- Consumes: `hardDisliked` (Task 4), `preferences` (Task 5)
- Produces: `pickOutfit(all, weather, dateKey, excludedIds?: ReadonlySet<string>)` — 4th param optional, default empty (all existing callers/tests unaffected); `TodayCard` gains optional `dislikedIds?: string[]` prop.

- [ ] **Step 1: Write the failing tests (append to `lib/today/pick.test.ts`)**

```ts
describe("pickOutfit dislike filter", () => {
  // Reuse this file's existing item helper if one exists; otherwise:
  const fitem = (id: string, category: Category): ClosetItem => ({
    id,
    name: id,
    category,
    colors: [],
    styleTags: [],
    imageUrl: "/x.svg",
    originalImageUrl: "/x.svg",
    createdAt: new Date("2026-01-01"),
  });

  it("skips excluded items when alternatives exist", () => {
    const all = [fitem("t1", "top"), fitem("t2", "top"), fitem("b1", "bottom")];
    for (const day of ["2026-07-15", "2026-07-16", "2026-07-17"]) {
      const picked = pickOutfit(all, null, day, new Set(["t1"]));
      expect(picked?.picks.find((p) => p.category === "top")?.item.id).toBe("t2");
    }
  });

  it("falls back to excluded items rather than emptying a category", () => {
    const all = [fitem("t1", "top"), fitem("b1", "bottom")];
    const picked = pickOutfit(all, null, "2026-07-15", new Set(["t1", "b1"]));
    expect(picked?.picks.map((p) => p.item.id).sort()).toEqual(["b1", "t1"]);
  });
});
```

(Match the existing test file's item-factory naming if it already has one — reuse it instead of adding `fitem`.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/today/pick.test.ts`
Expected: FAIL — `pickOutfit` takes 3 arguments.

- [ ] **Step 3: Implement in `lib/today/pick.ts`**

```ts
function choose(
  all: ClosetItem[],
  category: Category,
  dateKey: string,
  excluded: ReadonlySet<string>,
): ClosetItem | null {
  const pool = all.filter((i) => i.category === category);
  if (pool.length === 0) return null;
  // Dislike filter with a fallback: feedback may never empty a category.
  const preferred = pool.filter((i) => !excluded.has(i.id));
  const candidates = preferred.length > 0 ? preferred : pool;
  return candidates[fnv1a(dateKey + category) % candidates.length];
}

export function pickOutfit(
  all: ClosetItem[],
  weather: WeatherSummary | null,
  dateKey: string,
  excludedIds: ReadonlySet<string> = new Set(),
): OutfitPick | null {
```

…and thread `excludedIds` through every `choose(...)` call site in the function.

- [ ] **Step 4: Wire the data through**

`app/(tabs)/today/page.tsx`:

```tsx
import { items, preferences } from "@/lib/db/schema";
import { hardDisliked } from "@/lib/prefs/aggregate";
// in the component:
  const votes = await getDb().select().from(preferences);
  const dislikedIds = hardDisliked(votes);
  // ...
  <TodayCard items={all} dislikedIds={dislikedIds} />
```

`components/today/TodayCard.tsx`:

```tsx
export default function TodayCard({
  items,
  dislikedIds = [],
}: {
  items: ClosetItem[];
  dislikedIds?: string[];
}) {
```

and the pick line becomes:

```tsx
  const outfit = dateKey ? pickOutfit(items, weather, dateKey, new Set(dislikedIds)) : null;
```

- [ ] **Step 5: Verify**

Run: `npm test && npm run typecheck && npm run test:e2e`
Expected: all green (z-prefs clears its votes, so today.spec's pick is unchanged).

- [ ] **Step 6: Commit**

```bash
git add lib/today/pick.ts lib/today/pick.test.ts "app/(tabs)/today/page.tsx" components/today/TodayCard.tsx
git commit -m "feat(prefs): today's pick skips hard-disliked items with a safe fallback"
git push
```

---

### Task 10: Range forecast — weather lib + fixtures

**Files:**
- Modify: `lib/context/weather.ts`, `lib/context/fixtures.ts`
- Test: `lib/context/weather.test.ts` (append)

**Interfaces:**
- Consumes: existing `weatherLabel`, `WeatherSummary`
- Produces (Tasks 12–14 rely on these):
  - `type DayForecast = WeatherSummary & { date: string }`
  - `addDaysKey(key: string, days: number): string` (exported)
  - `buildForecastRangeUrl(lat: number, lon: number, startDate: string, endDate: string): string`
  - `summarizeForecastRange(raw: unknown): DayForecast[]`
  - `clampForecastWindow(startDate: string, endDate: string, todayKey: string): { start: string; end: string } | null` — Open-Meteo horizon is today+15
  - `fixtureForecastRange(start: string, end: string): DayForecast[]` (in fixtures.ts)

- [ ] **Step 1: Write the failing tests (append to `lib/context/weather.test.ts`)**

```ts
describe("range forecast", () => {
  it("addDaysKey does date math on YYYY-MM-DD keys", () => {
    expect(addDaysKey("2026-07-15", 15)).toBe("2026-07-30");
    expect(addDaysKey("2026-12-30", 3)).toBe("2027-01-02");
  });

  it("buildForecastRangeUrl requests the span", () => {
    const url = buildForecastRangeUrl(48.85, 2.35, "2026-07-20", "2026-07-23");
    expect(url).toContain("start_date=2026-07-20");
    expect(url).toContain("end_date=2026-07-23");
    expect(url).toContain("daily=weathercode");
  });

  it("summarizeForecastRange maps parallel daily arrays and skips bad rows", () => {
    const days = summarizeForecastRange({
      daily: {
        time: ["2026-07-20", "2026-07-21", "2026-07-22"],
        temperature_2m_min: [14.2, null, 15.1],
        temperature_2m_max: [22.8, 24, 25.4],
        weathercode: [2, 3, 61],
      },
    });
    expect(days).toHaveLength(2);
    expect(days[0]).toEqual({
      date: "2026-07-20",
      tempMin: 14,
      tempMax: 23,
      code: 2,
      label: "Partly cloudy",
      emoji: "⛅",
    });
    expect(days[1].date).toBe("2026-07-22");
    expect(summarizeForecastRange(null)).toEqual([]);
  });

  it("clampForecastWindow clips to today..today+15 and nulls beyond", () => {
    expect(clampForecastWindow("2026-08-10", "2026-08-12", "2026-07-15")).toBeNull();
    expect(clampForecastWindow("2026-07-10", "2026-09-01", "2026-07-15")).toEqual({
      start: "2026-07-15",
      end: "2026-07-30",
    });
    expect(clampForecastWindow("2026-07-20", "2026-07-23", "2026-07-15")).toEqual({
      start: "2026-07-20",
      end: "2026-07-23",
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/context/weather.test.ts`
Expected: FAIL — new exports missing.

- [ ] **Step 3: Append to `lib/context/weather.ts`**

```ts
export type DayForecast = WeatherSummary & { date: string };

// Open-Meteo's free forecast reaches ~16 days; day 0 is today.
const FORECAST_HORIZON_DAYS = 15;

export function addDaysKey(key: string, days: number): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export function buildForecastRangeUrl(
  lat: number,
  lon: number,
  startDate: string,
  endDate: string,
): string {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    daily: "weathercode,temperature_2m_max,temperature_2m_min",
    timezone: "auto",
    start_date: startDate,
    end_date: endDate,
  });
  return `https://api.open-meteo.com/v1/forecast?${params}`;
}

export function summarizeForecastRange(raw: unknown): DayForecast[] {
  if (typeof raw !== "object" || raw === null) return [];
  const daily = (raw as { daily?: unknown }).daily;
  if (typeof daily !== "object" || daily === null) return [];
  const d = daily as Record<string, unknown>;
  const times = Array.isArray(d.time) ? d.time : [];
  const mins = Array.isArray(d.temperature_2m_min) ? d.temperature_2m_min : [];
  const maxs = Array.isArray(d.temperature_2m_max) ? d.temperature_2m_max : [];
  const codes = Array.isArray(d.weathercode) ? d.weathercode : [];
  const out: DayForecast[] = [];
  for (let i = 0; i < times.length; i++) {
    const date = times[i];
    const min = mins[i];
    const max = maxs[i];
    const code = codes[i];
    if (
      typeof date !== "string" ||
      typeof min !== "number" ||
      typeof max !== "number" ||
      typeof code !== "number"
    ) {
      continue;
    }
    const { label, emoji } = weatherLabel(code);
    out.push({ date, tempMin: Math.round(min), tempMax: Math.round(max), code, label, emoji });
  }
  return out;
}

// The forecastable slice of a trip, or null when it's entirely beyond the horizon.
export function clampForecastWindow(
  startDate: string,
  endDate: string,
  todayKey: string,
): { start: string; end: string } | null {
  const horizon = addDaysKey(todayKey, FORECAST_HORIZON_DAYS);
  const start = startDate > todayKey ? startDate : todayKey;
  const end = endDate < horizon ? endDate : horizon;
  return start > end ? null : { start, end };
}
```

- [ ] **Step 4: Append to `lib/context/fixtures.ts`**

```ts
import { addDaysKey, type DayForecast } from "./weather";

// Deterministic per-day forecast for MOCK_AI trips: same summary every day.
export function fixtureForecastRange(start: string, end: string): DayForecast[] {
  const out: DayForecast[] = [];
  let d = start;
  while (d <= end && out.length < 16) {
    out.push({ date: d, ...FIXTURE_WEATHER });
    d = addDaysKey(d, 1);
  }
  return out;
}
```

- [ ] **Step 5: Run tests, commit**

Run: `npx vitest run lib/context && npm run typecheck` → green.

```bash
git add lib/context/weather.ts lib/context/fixtures.ts lib/context/weather.test.ts
git commit -m "feat(trips): multi-day forecast range with horizon clamp and fixtures"
git push
```

---

### Task 11: Trips libs — validation + capsule parse/join

**Files:**
- Create: `lib/trips/validation.ts`, `lib/trips/capsule.ts`
- Test: `lib/trips/validation.test.ts`, `lib/trips/capsule.test.ts`

**Interfaces:**
- Consumes: `Result`, `UUID_RE` (`@/lib/closet/item-validation`); `DATE_KEY_RE` (`@/lib/wears/validation`); `PackingPick` (Task 12 — define the type here? No: capsule.ts declares its own structural import from `@/lib/ai/packing`; to avoid a forward dependency, `capsule.ts` defines the shape inline as `{ itemId: string; role: string }` and Task 12's `PackingPick` matches it structurally)
- Produces (Tasks 13–14 rely on):
  - `type NewTrip = { destination: string; startDate: string; endDate: string }`, `MAX_TRIP_DAYS = 30`
  - `tripDays(startDate: string, endDate: string): number` (inclusive)
  - `validateNewTrip(raw: unknown): Result<NewTrip>`; `validatePackedPatch(raw: unknown): Result<string[]>`
  - `type CapsulePick = { itemId: string; role: string }` (in capsule.ts)
  - `type CapsuleEntry = CapsulePick & { name: string; imageUrl: string }`
  - `parseCapsule(raw: string): CapsulePick[]` (tolerant of bad JSON)
  - `joinCapsule(picks: CapsulePick[], items: Pick<ClosetItem, "id" | "name" | "imageUrl">[]): CapsuleEntry[]` (drops deleted items)

- [ ] **Step 1: Write the failing tests**

```ts
// lib/trips/validation.test.ts
import { describe, expect, it } from "vitest";
import { MAX_TRIP_DAYS, tripDays, validateNewTrip, validatePackedPatch } from "./validation";

const A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

describe("tripDays", () => {
  it("counts inclusive days across month ends", () => {
    expect(tripDays("2026-07-20", "2026-07-20")).toBe(1);
    expect(tripDays("2026-07-30", "2026-08-02")).toBe(4);
  });
});

describe("validateNewTrip", () => {
  it("accepts a trimmed destination and ordered dates", () => {
    expect(validateNewTrip({ destination: "  Paris ", startDate: "2026-08-01", endDate: "2026-08-04" })).toEqual({
      ok: true,
      value: { destination: "Paris", startDate: "2026-08-01", endDate: "2026-08-04" },
    });
  });

  it("rejects bad shapes, dates, order, and over-long trips", () => {
    expect(validateNewTrip(null).ok).toBe(false);
    expect(validateNewTrip({ destination: "", startDate: "2026-08-01", endDate: "2026-08-02" }).ok).toBe(false);
    expect(validateNewTrip({ destination: "Paris", startDate: "08/01/2026", endDate: "2026-08-02" }).ok).toBe(false);
    expect(validateNewTrip({ destination: "Paris", startDate: "2026-08-05", endDate: "2026-08-01" }).ok).toBe(false);
    expect(
      validateNewTrip({ destination: "Paris", startDate: "2026-08-01", endDate: "2026-09-15" }).ok,
    ).toBe(false); // > MAX_TRIP_DAYS
    expect(MAX_TRIP_DAYS).toBe(30);
  });
});

describe("validatePackedPatch", () => {
  it("accepts deduped uuid lists including empty", () => {
    expect(validatePackedPatch({ packedIds: [A, A] })).toEqual({ ok: true, value: [A] });
    expect(validatePackedPatch({ packedIds: [] })).toEqual({ ok: true, value: [] });
  });

  it("rejects non-arrays and non-uuids", () => {
    expect(validatePackedPatch({}).ok).toBe(false);
    expect(validatePackedPatch({ packedIds: ["nope"] }).ok).toBe(false);
  });
});
```

```ts
// lib/trips/capsule.test.ts
import { describe, expect, it } from "vitest";
import { joinCapsule, parseCapsule } from "./capsule";

describe("parseCapsule", () => {
  it("parses stored picks and drops malformed entries", () => {
    const raw = JSON.stringify([
      { itemId: "a", role: "Everyday top" },
      { itemId: 7, role: "bad" },
      "junk",
    ]);
    expect(parseCapsule(raw)).toEqual([{ itemId: "a", role: "Everyday top" }]);
  });

  it("returns [] on garbage", () => {
    expect(parseCapsule("not json")).toEqual([]);
    expect(parseCapsule('{"itemId":"a"}')).toEqual([]);
  });
});

describe("joinCapsule", () => {
  it("joins names/images and drops deleted items", () => {
    const picks = [
      { itemId: "a", role: "Everyday top" },
      { itemId: "gone", role: "Ghost" },
    ];
    const items = [{ id: "a", name: "White tee", imageUrl: "/tee.svg" }];
    expect(joinCapsule(picks, items)).toEqual([
      { itemId: "a", role: "Everyday top", name: "White tee", imageUrl: "/tee.svg" },
    ]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/trips`
Expected: FAIL — modules missing.

- [ ] **Step 3: Write the implementations**

```ts
// lib/trips/validation.ts
import { type Result, UUID_RE } from "@/lib/closet/item-validation";
import { DATE_KEY_RE } from "@/lib/wears/validation";

const MAX_DEST = 100;
export const MAX_TRIP_DAYS = 30;

export type NewTrip = { destination: string; startDate: string; endDate: string };

export function tripDays(startDate: string, endDate: string): number {
  const [ys, ms, ds] = startDate.split("-").map(Number);
  const [ye, me, de] = endDate.split("-").map(Number);
  return Math.round((Date.UTC(ye, me - 1, de) - Date.UTC(ys, ms - 1, ds)) / 86_400_000) + 1;
}

export function validateNewTrip(raw: unknown): Result<NewTrip> {
  if (typeof raw !== "object" || raw === null) {
    return { ok: false, error: "Body must be an object." };
  }
  const o = raw as Record<string, unknown>;
  if (typeof o.destination !== "string") {
    return { ok: false, error: "destination is required." };
  }
  const destination = o.destination.trim();
  if (destination.length === 0 || destination.length > MAX_DEST) {
    return { ok: false, error: `destination must be 1–${MAX_DEST} characters.` };
  }
  if (typeof o.startDate !== "string" || !DATE_KEY_RE.test(o.startDate)) {
    return { ok: false, error: "startDate must be a YYYY-MM-DD date." };
  }
  if (typeof o.endDate !== "string" || !DATE_KEY_RE.test(o.endDate)) {
    return { ok: false, error: "endDate must be a YYYY-MM-DD date." };
  }
  if (o.endDate < o.startDate) {
    return { ok: false, error: "endDate must not be before startDate." };
  }
  if (tripDays(o.startDate, o.endDate) > MAX_TRIP_DAYS) {
    return { ok: false, error: `Trips are capped at ${MAX_TRIP_DAYS} days.` };
  }
  return { ok: true, value: { destination, startDate: o.startDate, endDate: o.endDate } };
}

export function validatePackedPatch(raw: unknown): Result<string[]> {
  if (typeof raw !== "object" || raw === null) {
    return { ok: false, error: "Body must be an object." };
  }
  const o = raw as Record<string, unknown>;
  if (!Array.isArray(o.packedIds)) {
    return { ok: false, error: "packedIds must be an array." };
  }
  if (!o.packedIds.every((v): v is string => typeof v === "string" && UUID_RE.test(v))) {
    return { ok: false, error: "packedIds must be item UUIDs." };
  }
  return { ok: true, value: [...new Set(o.packedIds)] };
}
```

```ts
// lib/trips/capsule.ts
import type { ClosetItem } from "@/lib/closet/types";

export type CapsulePick = { itemId: string; role: string };
export type CapsuleEntry = CapsulePick & { name: string; imageUrl: string };

// trips.capsule column holds JSON-encoded CapsulePick[]; tolerate anything.
export function parseCapsule(raw: string): CapsulePick[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.flatMap((e) => {
    if (typeof e !== "object" || e === null) return [];
    const o = e as Record<string, unknown>;
    return typeof o.itemId === "string" && typeof o.role === "string"
      ? [{ itemId: o.itemId, role: o.role }]
      : [];
  });
}

// Deleted items drop out of the checklist at read time (no FK, house pattern).
export function joinCapsule(
  picks: CapsulePick[],
  items: Pick<ClosetItem, "id" | "name" | "imageUrl">[],
): CapsuleEntry[] {
  const byId = new Map(items.map((i) => [i.id, i]));
  return picks.flatMap((p) => {
    const item = byId.get(p.itemId);
    return item ? [{ ...p, name: item.name, imageUrl: item.imageUrl }] : [];
  });
}
```

- [ ] **Step 4: Run tests, commit**

Run: `npx vitest run lib/trips && npm run typecheck` → green.

```bash
git add lib/trips
git commit -m "feat(trips): trip validation and capsule parse/join libs"
git push
```

---

### Task 12: Packing AI (`lib/ai/packing.ts`)

**Files:**
- Create: `lib/ai/packing.ts`
- Test: `lib/ai/packing.test.ts`

**Interfaces:**
- Consumes: `inventoryLines`, `isMockAi` (Task 8); `tasteLines`, `PrefsSignal` (Task 4); `DayForecast` (Task 10); `getOpenAI`; `CapsulePick` shape (Task 11 — `PackingPick` is structurally identical)
- Produces (Task 13's capsule route calls these):
  - `type PackingPick = { itemId: string; role: string }`
  - `type PackingOptions = { destination: string; startDate: string; endDate: string; days: number; forecast: DayForecast[] | null; prefs?: PrefsSignal | null }`
  - `packingPrompt(items: ClosetItem[], opts: PackingOptions): string` (pure)
  - `mockPacking(items: ClosetItem[], days: number): PackingPick[]` (deterministic)
  - `validatePacking(raw: unknown, items: ClosetItem[]): PackingPick[]`
  - `suggestPacking(items: ClosetItem[], opts: PackingOptions): Promise<PackingPick[]>` — honors MOCK_AI

- [ ] **Step 1: Write the failing test**

```ts
// lib/ai/packing.test.ts
import { describe, expect, it } from "vitest";
import type { Category } from "@/lib/closet/categories";
import type { ClosetItem } from "@/lib/closet/types";
import { mockPacking, packingPrompt, validatePacking } from "./packing";

const item = (id: string, category: Category): ClosetItem => ({
  id,
  name: `Item ${id}`,
  category,
  colors: ["black"],
  styleTags: [],
  imageUrl: "/x.svg",
  originalImageUrl: "/x.svg",
  createdAt: new Date("2026-01-01"),
});

describe("mockPacking", () => {
  it("is deterministic and scales caps with trip length", () => {
    const items = [
      item("t1", "top"), item("t2", "top"), item("t3", "top"), item("t4", "top"), item("t5", "top"),
      item("b1", "bottom"), item("b2", "bottom"),
      item("s1", "shoes"),
    ];
    const picks = mockPacking(items, 4);
    expect(mockPacking(items, 4)).toEqual(picks);
    expect(picks.filter((p) => p.itemId.startsWith("t"))).toHaveLength(4); // min(days, 4-cap)
    expect(picks.filter((p) => p.itemId.startsWith("b"))).toHaveLength(2); // ceil(4/2)
    expect(picks.filter((p) => p.itemId.startsWith("s"))).toHaveLength(1);
    expect(picks.every((p) => p.role.length > 0)).toBe(true);
  });

  it("returns [] for an empty closet", () => {
    expect(mockPacking([], 3)).toEqual([]);
  });
});

describe("validatePacking", () => {
  const items = [item("a", "top"), item("b", "bottom")];

  it("keeps known ids, dedupes, trims roles", () => {
    expect(
      validatePacking(
        { picks: [{ itemId: "a", role: "  Everyday top  " }, { itemId: "a", role: "dupe" }, { itemId: "ghost", role: "x" }, "junk"] },
        items,
      ),
    ).toEqual([{ itemId: "a", role: "Everyday top" }]);
  });

  it("returns [] on garbage", () => {
    expect(validatePacking(null, items)).toEqual([]);
    expect(validatePacking({ picks: "no" }, items)).toEqual([]);
  });
});

describe("packingPrompt", () => {
  const items = [item("a", "top")];
  const base = { destination: "Paris", startDate: "2026-08-01", endDate: "2026-08-04", days: 4, prefs: null };

  it("lists the forecast when present", () => {
    const prompt = packingPrompt(items, {
      ...base,
      forecast: [{ date: "2026-08-01", tempMin: 14, tempMax: 23, code: 2, label: "Partly cloudy", emoji: "⛅" }],
    });
    expect(prompt).toContain("4 day(s) in Paris");
    expect(prompt).toContain("- 2026-08-01: 14–23°, Partly cloudy");
  });

  it("falls back to seasonal guidance without a forecast", () => {
    const prompt = packingPrompt(items, { ...base, forecast: null });
    expect(prompt).toContain("No forecast available yet");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/ai/packing.test.ts`
Expected: FAIL — cannot resolve `./packing`.

- [ ] **Step 3: Write the implementation**

```ts
// lib/ai/packing.ts
import type { Category } from "@/lib/closet/categories";
import type { ClosetItem } from "@/lib/closet/types";
import type { DayForecast } from "@/lib/context/weather";
import { type PrefsSignal, tasteLines } from "@/lib/prefs/aggregate";
import { getOpenAI } from "./openai";
import { inventoryLines, isMockAi } from "./stylist";

const PACKING_MODEL = "gpt-4.1-mini";
const MAX_ROLE = 120;
const MAX_PICKS = 24;

export type PackingPick = { itemId: string; role: string };

export type PackingOptions = {
  destination: string;
  startDate: string;
  endDate: string;
  days: number;
  forecast: DayForecast[] | null;
  prefs?: PrefsSignal | null;
};

// Deterministic offline capsule: fixed per-category counts, closet order.
export function mockPacking(items: ClosetItem[], days: number): PackingPick[] {
  const byCat = (c: Category) => items.filter((i) => i.category === c);
  const want: Array<[Category, number]> = [
    ["top", Math.min(days, 4)],
    ["bottom", Math.min(Math.ceil(days / 2), 3)],
    ["dress", 1],
    ["shoes", 2],
    ["jacket", 1],
    ["accessory", 1],
  ];
  const picks: PackingPick[] = [];
  for (const [cat, n] of want) {
    for (const item of byCat(cat).slice(0, n)) {
      picks.push({ itemId: item.id, role: `Mock packing pick (${cat})` });
    }
  }
  return picks;
}

export function validatePacking(raw: unknown, items: ClosetItem[]): PackingPick[] {
  if (typeof raw !== "object" || raw === null) return [];
  const list = (raw as { picks?: unknown }).picks;
  if (!Array.isArray(list)) return [];
  const known = new Set(items.map((i) => i.id));
  const seen = new Set<string>();
  const picks: PackingPick[] = [];
  for (const entry of list) {
    if (picks.length >= MAX_PICKS) break;
    if (typeof entry !== "object" || entry === null) continue;
    const o = entry as Record<string, unknown>;
    if (typeof o.itemId !== "string" || !known.has(o.itemId) || seen.has(o.itemId)) continue;
    seen.add(o.itemId);
    picks.push({
      itemId: o.itemId,
      role: typeof o.role === "string" ? o.role.trim().slice(0, MAX_ROLE) : "",
    });
  }
  return picks;
}

export function packingPrompt(items: ClosetItem[], opts: PackingOptions): string {
  const forecastLines =
    opts.forecast && opts.forecast.length > 0
      ? `Forecast:\n${opts.forecast.map((f) => `- ${f.date}: ${f.tempMin}–${f.tempMax}°, ${f.label}`).join("\n")}`
      : "No forecast available yet — pack for the destination's typical weather in that season.";
  const taste = opts.prefs ? tasteLines(opts.prefs.profile).join("\n") : "";
  return (
    `You are a packing assistant. Build a light travel capsule from this closet, referencing items by their exact ids:\n` +
    `${inventoryLines(items, opts.prefs)}\n\n` +
    `Trip: ${opts.days} day(s) in ${opts.destination}, ${opts.startDate} to ${opts.endDate}.\n` +
    `${forecastLines}\n${taste}\n\n` +
    `Rules: pieces must mix and match; cover every day; prefer versatile items; at most ${MAX_PICKS} pieces. ` +
    `Give each piece a one-line role in the capsule.`
  );
}

export async function suggestPacking(
  items: ClosetItem[],
  opts: PackingOptions,
): Promise<PackingPick[]> {
  if (items.length === 0) return [];
  if (isMockAi()) return mockPacking(items, opts.days);

  const res = await getOpenAI().chat.completions.create({
    model: PACKING_MODEL,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "packing_capsule",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          required: ["picks"],
          properties: {
            picks: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                required: ["itemId", "role"],
                properties: {
                  itemId: { type: "string" },
                  role: { type: "string" },
                },
              },
            },
          },
        },
      },
    },
    messages: [{ role: "user", content: packingPrompt(items, opts) }],
  });
  const text = res.choices[0]?.message?.content;
  if (!text) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return [];
  }
  return validatePacking(parsed, items);
}
```

- [ ] **Step 4: Run tests, commit**

Run: `npx vitest run lib/ai/packing.test.ts && npm run typecheck` → green.

```bash
git add lib/ai/packing.ts lib/ai/packing.test.ts
git commit -m "feat(trips): packing capsule AI with deterministic mock"
git push
```

---

### Task 13: `trips` table + API routes

**Files:**
- Modify: `lib/db/schema.ts` (append table; add `doublePrecision` to the pg-core import)
- Modify: `e2e/global-setup.ts` (create + wipe)
- Modify: `CLAUDE.md` (wipe lists gain `trips`)
- Create: `app/api/trips/route.ts`, `app/api/trips/[id]/route.ts`, `app/api/trips/[id]/capsule/route.ts`

**Interfaces:**
- Consumes: Tasks 10–12 libs; `preferences`/`prefsSignal` (Tasks 4–5); `FIXTURE_LOCATION`, geocode helpers; `localDateKey`
- Produces (Task 14's UI calls these):
  - `trips` table export
  - `POST /api/trips` `{ destination, startDate, endDate }` → 201 `{ trip }` | 400
  - `PATCH /api/trips/[id]` `{ packedIds }` → 200 `{ packedIds }` (filtered to capsule members) | 400/404
  - `DELETE /api/trips/[id]` → `{ ok: true }` | 404
  - `POST /api/trips/[id]/capsule` → 200 `{ capsule: CapsuleEntry[], packedIds }` | 404/502 — regenerates, keeping ticks for surviving items
  - (No GET route — list/detail pages read the DB directly, house pattern.)

- [ ] **Step 1: Schema. Import line gains `doublePrecision`:**

```ts
import { bigint, boolean, date, doublePrecision, integer, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
```

Append:

```ts
// Trips with an AI packing capsule. capsule = JSON-encoded {itemId, role}[]
// (deleted items drop out at read time); packed_ids = the ticked subset.
export const trips = pgTable("trips", {
  id: uuid("id").primaryKey().defaultRandom(),
  destination: text("destination").notNull(),
  lat: doublePrecision("lat").notNull(),
  lon: doublePrecision("lon").notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  capsule: text("capsule").notNull().default("[]"),
  packedIds: uuid("packed_ids").array().notNull().default(sql`'{}'::uuid[]`),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
```

- [ ] **Step 2: e2e mirror (after preferences CREATE) + wipe + CLAUDE.md**

```ts
  // Keep in sync with lib/db/schema.ts
  await sql`CREATE TABLE IF NOT EXISTS trips (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    destination text NOT NULL,
    lat double precision NOT NULL,
    lon double precision NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    capsule text NOT NULL DEFAULT '[]',
    packed_ids uuid[] NOT NULL DEFAULT '{}',
    created_at timestamp NOT NULL DEFAULT now()
  )`;
```

Wipe block: `await sql`DELETE FROM trips`;`. CLAUDE.md: both wipe lists gain `trips` (final: "settings, items, base_photos, outfits, wears, pins, preferences and trips").

- [ ] **Step 3: `npm run db:push`** → expect `CREATE TABLE trips` + known no-ops only.

- [ ] **Step 4: Create route**

```ts
// app/api/trips/route.ts
import { NextRequest, NextResponse } from "next/server";
import { FIXTURE_LOCATION } from "@/lib/context/fixtures";
import { buildGeocodeUrl, parseGeocode } from "@/lib/context/weather";
import { getDb } from "@/lib/db/client";
import { trips } from "@/lib/db/schema";
import { validateNewTrip } from "@/lib/trips/validation";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const parsed = validateNewTrip(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const { destination, startDate, endDate } = parsed.value;

  let lat = FIXTURE_LOCATION.lat;
  let lon = FIXTURE_LOCATION.lon;
  if (process.env.MOCK_AI !== "1") {
    try {
      const res = await fetch(buildGeocodeUrl(destination), {
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) throw new Error(String(res.status));
      const location = parseGeocode(await res.json());
      if (!location) {
        return NextResponse.json({ error: "No match for that destination." }, { status: 400 });
      }
      lat = location.lat;
      lon = location.lon;
    } catch (err) {
      console.error("[trips] geocode failed:", err);
      return NextResponse.json({ error: "Couldn't look that up — try again." }, { status: 400 });
    }
  }

  const [row] = await getDb()
    .insert(trips)
    .values({ destination, lat, lon, startDate, endDate })
    .returning();
  return NextResponse.json({ trip: row }, { status: 201 });
}
```

- [ ] **Step 5: Patch/delete route**

```ts
// app/api/trips/[id]/route.ts
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { UUID_RE } from "@/lib/closet/item-validation";
import { getDb } from "@/lib/db/client";
import { trips } from "@/lib/db/schema";
import { parseCapsule } from "@/lib/trips/capsule";
import { validatePackedPatch } from "@/lib/trips/validation";

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
  const parsed = validatePackedPatch(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const db = getDb();
  const [trip] = await db.select().from(trips).where(eq(trips.id, id));
  if (!trip) return NextResponse.json({ error: "Not found." }, { status: 404 });
  // Only capsule members can be ticked.
  const allowed = new Set(parseCapsule(trip.capsule).map((p) => p.itemId));
  const packedIds = parsed.value.filter((pid) => allowed.has(pid));
  await db.update(trips).set({ packedIds }).where(eq(trips.id, id));
  return NextResponse.json({ packedIds });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  const [gone] = await getDb().delete(trips).where(eq(trips.id, id)).returning();
  if (!gone) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 6: Capsule route**

```ts
// app/api/trips/[id]/capsule/route.ts
import { desc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { type PackingPick, suggestPacking } from "@/lib/ai/packing";
import { UUID_RE } from "@/lib/closet/item-validation";
import { fixtureForecastRange } from "@/lib/context/fixtures";
import {
  buildForecastRangeUrl,
  clampForecastWindow,
  type DayForecast,
  summarizeForecastRange,
} from "@/lib/context/weather";
import { getDb } from "@/lib/db/client";
import { items, preferences, trips } from "@/lib/db/schema";
import { prefsSignal } from "@/lib/prefs/aggregate";
import { localDateKey } from "@/lib/today/date";
import { joinCapsule } from "@/lib/trips/capsule";
import { tripDays } from "@/lib/trips/validation";

const REVALIDATE_SECONDS = 900;

type Ctx = { params: Promise<{ id: string }> };

// (Re)generate the packing capsule; ticks survive for items still in it.
export async function POST(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  const db = getDb();
  const [trip] = await db.select().from(trips).where(eq(trips.id, id));
  if (!trip) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const all = await db.select().from(items).orderBy(desc(items.createdAt));
  const votes = await db.select().from(preferences);
  const prefs = votes.length > 0 ? prefsSignal(votes, all) : null;

  // Forecast degrades to null; packing still works without it.
  let forecast: DayForecast[] | null = null;
  const window = clampForecastWindow(trip.startDate, trip.endDate, localDateKey());
  if (window) {
    if (process.env.MOCK_AI === "1") {
      forecast = fixtureForecastRange(window.start, window.end);
    } else {
      try {
        const res = await fetch(buildForecastRangeUrl(trip.lat, trip.lon, window.start, window.end), {
          next: { revalidate: REVALIDATE_SECONDS },
          signal: AbortSignal.timeout(10_000),
        });
        if (res.ok) forecast = summarizeForecastRange(await res.json());
      } catch (err) {
        console.error("[trips] forecast fetch failed:", err);
      }
    }
  }

  let picks: PackingPick[];
  try {
    picks = await suggestPacking(all, {
      destination: trip.destination,
      startDate: trip.startDate,
      endDate: trip.endDate,
      days: tripDays(trip.startDate, trip.endDate),
      forecast,
      prefs,
    });
  } catch (err) {
    console.error("[trips] packing failed:", err);
    return NextResponse.json({ error: "Couldn't build the capsule — try again." }, { status: 502 });
  }

  const pickIds = new Set(picks.map((p) => p.itemId));
  const packedIds = trip.packedIds.filter((pid) => pickIds.has(pid));
  await db
    .update(trips)
    .set({ capsule: JSON.stringify(picks), packedIds })
    .where(eq(trips.id, id));
  return NextResponse.json({ capsule: joinCapsule(picks, all), packedIds });
}
```

- [ ] **Step 7: Smoke against the dev server**

```bash
curl -s -X POST http://localhost:4100/api/trips -H "Content-Type: application/json" -d '{"destination":"Paris","startDate":"2026-07-17","endDate":"2026-07-20"}'
# note the returned trip id as $T
curl -s -X POST http://localhost:4100/api/trips/$T/capsule
curl -s -X PATCH http://localhost:4100/api/trips/$T -H "Content-Type: application/json" -d '{"packedIds":[]}'
curl -s -X DELETE http://localhost:4100/api/trips/$T
curl -s -X POST http://localhost:4100/api/trips -H "Content-Type: application/json" -d '{"destination":"Paris","startDate":"2026-07-20","endDate":"2026-07-01"}'
```

Expected in order: 201 `{"trip":{...}}`; `{"capsule":[...],"packedIds":[]}` (mock picks from dev items, `[]` capsule if dev closet is empty — both fine); `{"packedIds":[]}`; `{"ok":true}`; `{"error":"endDate must not be before startDate."}`.

- [ ] **Step 8: Typecheck + commit**

Run: `npm run typecheck` → clean.

```bash
git add lib/db/schema.ts e2e/global-setup.ts CLAUDE.md app/api/trips
git commit -m "feat(trips): trips table with create/patch/delete and capsule generation routes"
git push
```

---

### Task 14: Trips UI — list, detail, menu entry, e2e

**Files:**
- Create: `app/(tabs)/trips/page.tsx`, `app/(tabs)/trips/[id]/page.tsx`, `components/trips/NewTripForm.tsx`, `components/trips/TripDetail.tsx`, `components/trips/DeleteTripButton.tsx`
- Modify: `components/shell/Menu.tsx`, `e2e/menu.spec.ts`
- Create: `e2e/z-trips.spec.ts`

**Interfaces:**
- Consumes: Task 13 routes + table; `parseCapsule`/`joinCapsule`; `clampForecastWindow`/`fixtureForecastRange`/`summarizeForecastRange`/`buildForecastRangeUrl`/`DayForecast`; `PageHeader`; `UUID_RE`; `localDateKey`
- Produces: route `/trips` (+ `/trips/[id]`); menu entry "Trips" between Lookbook and Settings; testids `capsule-item`; labels `Destination`, `First day`, `Last day`, `Add trip`, `Generate packing list`/`Regenerate capsule`, `Delete trip`.

- [ ] **Step 1: Menu link + spec update**

`components/shell/Menu.tsx` LINKS, insert after Lookbook:

```ts
  { href: "/trips", label: "Trips" },
```

`e2e/menu.spec.ts` navigation test becomes:

```ts
test("full-screen menu navigates between all eight screens", async ({ page }) => {
  await page.goto("/today");
  for (const name of ["Closet", "Studio", "Stylist", "Explore", "Lookbook", "Trips", "Settings", "Today"]) {
```

(The tab-trap test still ends on Settings — unchanged.)

- [ ] **Step 2: List page + create form**

```tsx
// app/(tabs)/trips/page.tsx
import { asc } from "drizzle-orm";
import Link from "next/link";
import PageHeader from "@/components/shell/PageHeader";
import NewTripForm from "@/components/trips/NewTripForm";
import { getDb } from "@/lib/db/client";
import { trips } from "@/lib/db/schema";
import { parseCapsule } from "@/lib/trips/capsule";

export const dynamic = "force-dynamic";

export default async function TripsPage() {
  const rows = await getDb().select().from(trips).orderBy(asc(trips.startDate));
  return (
    <>
      <PageHeader title="Trips" />
      <div className="mt-4 flex flex-col gap-4">
        <NewTripForm />
        {rows.length === 0 ? (
          <p className="text-mute">No trips planned yet — add one above.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {rows.map((t) => {
              const capsule = parseCapsule(t.capsule);
              return (
                <li key={t.id}>
                  <Link
                    href={`/trips/${t.id}`}
                    className="flex items-center justify-between gap-3 rounded-card bg-card p-4"
                  >
                    <span className="font-bold text-ink">{t.destination}</span>
                    <span className="text-sm text-mute">
                      {t.startDate} – {t.endDate}
                      {capsule.length > 0 ? ` · ${t.packedIds.length}/${capsule.length} packed` : ""}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
```

```tsx
// components/trips/NewTripForm.tsx
"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

export default function NewTripForm() {
  const router = useRouter();
  const [destination, setDestination] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy || destination.trim().length === 0 || !startDate || !endDate) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ destination: destination.trim(), startDate, endDate }),
      });
      const data = (await res.json().catch(() => null)) as
        | { trip?: { id: string }; error?: string }
        | null;
      if (!res.ok || !data?.trip) {
        throw new Error(data?.error ?? "Couldn't add the trip — try again.");
      }
      router.push(`/trips/${data.trip.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't add the trip — try again.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2 rounded-card bg-card p-4">
      <label htmlFor="trip-destination" className="font-bold text-ink">
        Plan a trip
      </label>
      <input
        id="trip-destination"
        aria-label="Destination"
        value={destination}
        onChange={(e) => setDestination(e.target.value)}
        maxLength={100}
        placeholder="Where to?"
        className="rounded-full bg-canvas px-4 py-3 text-ink placeholder:text-mute"
      />
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="trip-start" className="text-sm text-body">
          First day
        </label>
        <input
          id="trip-start"
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="rounded-full bg-canvas px-4 py-2 text-sm text-ink"
        />
        <label htmlFor="trip-end" className="text-sm text-body">
          Last day
        </label>
        <input
          id="trip-end"
          type="date"
          value={endDate}
          min={startDate || undefined}
          onChange={(e) => setEndDate(e.target.value)}
          className="rounded-full bg-canvas px-4 py-2 text-sm text-ink"
        />
        <button
          type="submit"
          disabled={busy || destination.trim().length === 0 || !startDate || !endDate}
          className="ml-auto rounded-full bg-pink px-5 py-3 text-sm font-bold text-on-pink active:bg-pink-deep disabled:opacity-50"
        >
          Add trip
        </button>
      </div>
      {error && <p role="alert" className="text-sm text-error">{error}</p>}
    </form>
  );
}
```

- [ ] **Step 3: Detail page (server) — capsule join + forecast**

```tsx
// app/(tabs)/trips/[id]/page.tsx
import { eq, inArray } from "drizzle-orm";
import { notFound } from "next/navigation";
import PageHeader from "@/components/shell/PageHeader";
import TripDetail from "@/components/trips/TripDetail";
import { UUID_RE } from "@/lib/closet/item-validation";
import { fixtureForecastRange } from "@/lib/context/fixtures";
import {
  buildForecastRangeUrl,
  clampForecastWindow,
  type DayForecast,
  summarizeForecastRange,
} from "@/lib/context/weather";
import { getDb } from "@/lib/db/client";
import { items, trips } from "@/lib/db/schema";
import { localDateKey } from "@/lib/today/date";
import { joinCapsule, parseCapsule } from "@/lib/trips/capsule";

export const dynamic = "force-dynamic";

const REVALIDATE_SECONDS = 900;

export default async function TripPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const db = getDb();
  const [trip] = await db.select().from(trips).where(eq(trips.id, id));
  if (!trip) notFound();

  const picks = parseCapsule(trip.capsule);
  const capsuleItems =
    picks.length > 0
      ? await db.select().from(items).where(inArray(items.id, picks.map((p) => p.itemId)))
      : [];
  const capsule = joinCapsule(picks, capsuleItems);

  // Forecast strip appears once any trip day is inside the 16-day horizon.
  let forecast: DayForecast[] | null = null;
  const window = clampForecastWindow(trip.startDate, trip.endDate, localDateKey());
  if (window) {
    if (process.env.MOCK_AI === "1") {
      forecast = fixtureForecastRange(window.start, window.end);
    } else {
      try {
        const res = await fetch(buildForecastRangeUrl(trip.lat, trip.lon, window.start, window.end), {
          next: { revalidate: REVALIDATE_SECONDS },
          signal: AbortSignal.timeout(10_000),
        });
        if (res.ok) forecast = summarizeForecastRange(await res.json());
      } catch (err) {
        console.error("[trips] forecast fetch failed:", err);
      }
    }
  }

  return (
    <>
      <PageHeader title={trip.destination} />
      <p className="text-mute">
        {trip.startDate} – {trip.endDate}
      </p>
      <TripDetail
        tripId={trip.id}
        capsule={capsule}
        packedIds={trip.packedIds}
        forecast={forecast}
      />
    </>
  );
}
```

- [ ] **Step 4: TripDetail + DeleteTripButton (client)**

```tsx
// components/trips/TripDetail.tsx
"use client";

import { useState } from "react";
import DeleteTripButton from "@/components/trips/DeleteTripButton";
import type { DayForecast } from "@/lib/context/weather";
import type { CapsuleEntry } from "@/lib/trips/capsule";

type Props = {
  tripId: string;
  capsule: CapsuleEntry[];
  packedIds: string[];
  forecast: DayForecast[] | null;
};

export default function TripDetail({ tripId, capsule: initialCapsule, packedIds, forecast }: Props) {
  const [capsule, setCapsule] = useState(initialCapsule);
  const [packed, setPacked] = useState<Set<string>>(() => new Set(packedIds));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/trips/${tripId}/capsule`, { method: "POST" });
      const data = (await res.json().catch(() => null)) as
        | { capsule?: CapsuleEntry[]; packedIds?: string[]; error?: string }
        | null;
      if (!res.ok || !data?.capsule) {
        throw new Error(data?.error ?? "Couldn't build the capsule — try again.");
      }
      setCapsule(data.capsule);
      setPacked(new Set(data.packedIds ?? []));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't build the capsule — try again.");
    } finally {
      setBusy(false);
    }
  }

  async function togglePacked(itemId: string) {
    const prev = packed;
    const next = new Set(prev);
    if (next.has(itemId)) next.delete(itemId);
    else next.add(itemId);
    setPacked(next); // optimistic — reverted on failure
    try {
      const res = await fetch(`/api/trips/${tripId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packedIds: [...next] }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setPacked(prev);
      setError("Couldn't save that tick — try again.");
    }
  }

  return (
    <div className="mt-4 flex flex-col gap-4">
      {forecast && forecast.length > 0 ? (
        <ul aria-label="Trip forecast" className="flex gap-2 overflow-x-auto pb-1">
          {forecast.map((d) => (
            <li
              key={d.date}
              className="shrink-0 rounded-card bg-card px-3 py-2 text-center text-xs text-body"
            >
              <span className="block font-bold text-ink">{d.date.slice(5)}</span>
              {d.emoji} {d.tempMin}–{d.tempMax}°
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-mute">Forecast appears once the trip is within 16 days.</p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={generate}
          disabled={busy}
          className="rounded-full bg-pink px-5 py-3 text-sm font-bold text-on-pink active:bg-pink-deep disabled:opacity-50"
        >
          {capsule.length > 0 ? "Regenerate capsule" : "Generate packing list"}
        </button>
        {capsule.length > 0 && (
          <span className="text-sm text-mute">
            {packed.size}/{capsule.length} packed
          </span>
        )}
      </div>
      {busy && (
        <p role="status" className="text-sm text-mute">
          Packing your capsule…
        </p>
      )}
      {error && <p role="alert" className="text-sm text-error">{error}</p>}

      {capsule.length === 0 && !busy ? (
        <p className="text-mute">No capsule yet — generate a packing list from your closet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {capsule.map((entry) => (
            <li key={entry.itemId} data-testid="capsule-item">
              <label className="flex items-center gap-3 rounded-card bg-card p-3">
                <input
                  type="checkbox"
                  checked={packed.has(entry.itemId)}
                  onChange={() => void togglePacked(entry.itemId)}
                  className="h-5 w-5"
                />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={entry.imageUrl}
                  alt=""
                  className="h-12 w-12 rounded-card bg-canvas object-contain"
                />
                <span className="flex min-w-0 flex-col">
                  <span className="font-bold text-ink">{entry.name}</span>
                  <span className="text-sm text-mute">{entry.role}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}

      <DeleteTripButton tripId={tripId} />
    </div>
  );
}
```

```tsx
// components/trips/DeleteTripButton.tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function DeleteTripButton({ tripId }: { tripId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function del() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/trips/${tripId}`, { method: "DELETE" });
      if (!res.ok) {
        setError("Delete failed — try again.");
        return;
      }
      router.push("/trips");
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
        Delete trip
      </button>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="text-sm text-body">Delete this trip?</span>
      <button
        type="button"
        onClick={del}
        disabled={busy}
        className="rounded-full bg-error px-4 py-2 text-sm font-bold text-canvas disabled:opacity-50"
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
      {error && <p role="alert" className="w-full text-sm text-error">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 5: Write the e2e spec**

```ts
// e2e/z-trips.spec.ts
import { expect, test } from "@playwright/test";

// Named z-trips to run after studio.spec's seeds (the mock capsule needs
// closet items) and after z-explore/z-prefs (e < p < t).
// NOTE: retries must stay 0 — the serial suite assumes its own seeds.
function key(offsetDays: number): string {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

test.describe.serial("trips", () => {
  test("create a trip and land on its detail", async ({ page }) => {
    await page.goto("/trips");
    await expect(page.getByRole("heading", { level: 1, name: "Trips" })).toBeVisible();
    await expect(page.getByText("No trips planned yet — add one above.")).toBeVisible();
    await page.getByLabel("Destination").fill("Paris");
    await page.getByLabel("First day").fill(key(2));
    await page.getByLabel("Last day").fill(key(5));
    await page.getByRole("button", { name: "Add trip" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Paris" })).toBeVisible();
    // Within the 16-day horizon → mock forecast strip renders.
    await expect(page.getByLabel("Trip forecast")).toBeVisible();
  });

  test("generate capsule, tick an item, ticks survive reload and regenerate", async ({ page }) => {
    await page.goto("/trips");
    await page.getByRole("link", { name: /Paris/ }).click();
    await page.getByRole("button", { name: "Generate packing list" }).click();
    await expect(page.getByTestId("capsule-item").first()).toBeVisible();

    const firstBox = page.getByTestId("capsule-item").first().getByRole("checkbox");
    await firstBox.check();
    await expect(firstBox).toBeChecked();

    await page.reload();
    await expect(
      page.getByTestId("capsule-item").first().getByRole("checkbox"),
    ).toBeChecked();

    // Regenerate keeps the tick — the mock capsule is deterministic.
    await page.getByRole("button", { name: "Regenerate capsule" }).click();
    await expect(page.getByText(/1\/\d+ packed/)).toBeVisible();
  });

  test("delete removes the trip", async ({ page }) => {
    await page.goto("/trips");
    await page.getByRole("link", { name: /Paris/ }).click();
    await page.getByRole("button", { name: "Delete trip" }).click();
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(page).toHaveURL(/\/trips$/);
    await expect(page.getByText("No trips planned yet — add one above.")).toBeVisible();
  });
});
```

- [ ] **Step 6: Verify**

Run: `npm test && npm run typecheck && npm run test:e2e`
Expected: all green — menu.spec walks eight screens, z-trips' 3 tests pass. If Turbopack serves stale route types after adding the pages: stop server, `rm -rf .next`, retry.

- [ ] **Step 7: Commit**

```bash
git add "app/(tabs)/trips" components/trips components/shell/Menu.tsx e2e/menu.spec.ts e2e/z-trips.spec.ts
git commit -m "feat(trips): trips screen with packing checklist, forecast strip, and menu entry"
git push
```

---

### Task 15: Gap recommendations — lib + route

**Files:**
- Create: `lib/ai/gaps.ts`, `app/api/gaps/route.ts`
- Test: `lib/ai/gaps.test.ts`

**Interfaces:**
- Consumes: `inventoryLines`, `isMockAi` (Task 8); `tasteLines`, `prefsSignal`, `PrefsSignal` (Task 4); `preferences` (Task 5); `getOpenAI`
- Produces (Task 16's card calls the route):
  - `type GapSuggestion = { piece: string; reason: string }`
  - `mockGaps(items: ClosetItem[]): GapSuggestion[]` (deterministic; `[]` only for an empty closet)
  - `validateGaps(raw: unknown): GapSuggestion[]`; `gapsPrompt(items, prefs): string`
  - `suggestGaps(items: ClosetItem[], prefs?: PrefsSignal | null): Promise<GapSuggestion[]>`
  - `GET /api/gaps` → 200 `{ gaps: GapSuggestion[] }` | 502

- [ ] **Step 1: Write the failing test**

```ts
// lib/ai/gaps.test.ts
import { describe, expect, it } from "vitest";
import type { Category } from "@/lib/closet/categories";
import type { ClosetItem } from "@/lib/closet/types";
import { gapsPrompt, mockGaps, validateGaps } from "./gaps";

const item = (id: string, category: Category): ClosetItem => ({
  id,
  name: `Item ${id}`,
  category,
  colors: [],
  styleTags: [],
  imageUrl: "/x.svg",
  originalImageUrl: "/x.svg",
  createdAt: new Date("2026-01-01"),
});

describe("mockGaps", () => {
  it("suggests missing categories, capped at three", () => {
    const gaps = mockGaps([item("t", "top"), item("b", "bottom")]);
    expect(gaps).toHaveLength(3);
    expect(gaps[0].piece).toBe("A versatile jacket");
  });

  it("falls back to one suggestion when the wishlist is covered", () => {
    const gaps = mockGaps([
      item("t", "top"), item("b", "bottom"), item("j", "jacket"),
      item("d", "dress"), item("a", "accessory"), item("h", "hat"),
    ]);
    expect(gaps).toEqual([
      {
        piece: "A statement layer",
        reason: "Your basics are covered — one bold piece unlocks new combinations.",
      },
    ]);
  });

  it("returns [] for an empty closet", () => {
    expect(mockGaps([])).toEqual([]);
  });
});

describe("validateGaps", () => {
  it("trims, caps at three, drops malformed", () => {
    expect(
      validateGaps({
        gaps: [
          { piece: "  White sneakers ", reason: " Pairs with everything. " },
          { piece: 7, reason: "bad" },
          { piece: "A", reason: "B" },
          { piece: "C", reason: "D" },
          { piece: "E", reason: "F" },
        ],
      }),
    ).toEqual([
      { piece: "White sneakers", reason: "Pairs with everything." },
      { piece: "A", reason: "B" },
      { piece: "C", reason: "D" },
    ]);
    expect(validateGaps(null)).toEqual([]);
  });
});

describe("gapsPrompt", () => {
  it("includes the inventory and the buy framing", () => {
    const prompt = gapsPrompt([item("t", "top")], null);
    expect(prompt).toContain("t | top | Item t");
    expect(prompt).toContain("unlock the most new outfits");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/ai/gaps.test.ts`
Expected: FAIL — cannot resolve `./gaps`.

- [ ] **Step 3: Write the implementation**

```ts
// lib/ai/gaps.ts
import type { Category } from "@/lib/closet/categories";
import type { ClosetItem } from "@/lib/closet/types";
import { type PrefsSignal, tasteLines } from "@/lib/prefs/aggregate";
import { getOpenAI } from "./openai";
import { inventoryLines, isMockAi } from "./stylist";

const GAPS_MODEL = "gpt-4.1-mini";
const MAX_GAPS = 3;
const MAX_PIECE = 80;
const MAX_REASON = 200;

export type GapSuggestion = { piece: string; reason: string };

// Deterministic offline gaps: first missing categories from a fixed wishlist.
const WISHLIST: Array<[Category, string, string]> = [
  ["jacket", "A versatile jacket", "Layers over most of your outfits and extends them into cooler days."],
  ["dress", "A day dress", "A one-piece outfit that multiplies your looks instantly."],
  ["accessory", "A statement accessory", "Lifts your simplest combinations without new clothes."],
  ["hat", "A finishing hat", "Tops off casual looks and adds polish."],
];

export function mockGaps(items: ClosetItem[]): GapSuggestion[] {
  if (items.length === 0) return [];
  const have = new Set(items.map((i) => i.category));
  const gaps = WISHLIST.filter(([c]) => !have.has(c)).map(([, piece, reason]) => ({ piece, reason }));
  if (gaps.length === 0) {
    return [
      {
        piece: "A statement layer",
        reason: "Your basics are covered — one bold piece unlocks new combinations.",
      },
    ];
  }
  return gaps.slice(0, MAX_GAPS);
}

export function validateGaps(raw: unknown): GapSuggestion[] {
  if (typeof raw !== "object" || raw === null) return [];
  const list = (raw as { gaps?: unknown }).gaps;
  if (!Array.isArray(list)) return [];
  const gaps: GapSuggestion[] = [];
  for (const entry of list) {
    if (gaps.length >= MAX_GAPS) break;
    if (typeof entry !== "object" || entry === null) continue;
    const o = entry as Record<string, unknown>;
    if (typeof o.piece !== "string" || o.piece.trim().length === 0) continue;
    gaps.push({
      piece: o.piece.trim().slice(0, MAX_PIECE),
      reason: typeof o.reason === "string" ? o.reason.trim().slice(0, MAX_REASON) : "",
    });
  }
  return gaps;
}

export function gapsPrompt(items: ClosetItem[], prefs?: PrefsSignal | null): string {
  const taste = prefs ? `\n${tasteLines(prefs.profile).join("\n")}` : "";
  return (
    `You are a wardrobe strategist. Given this closet:\n${inventoryLines(items, prefs)}${taste}\n\n` +
    `Suggest up to ${MAX_GAPS} pieces to buy (NOT already in the closet) that would unlock the most new outfits ` +
    `with what she already owns. For each: a short piece name and a one-sentence reason naming what it pairs with.`
  );
}

export async function suggestGaps(
  items: ClosetItem[],
  prefs?: PrefsSignal | null,
): Promise<GapSuggestion[]> {
  if (items.length === 0) return [];
  if (isMockAi()) return mockGaps(items);

  const res = await getOpenAI().chat.completions.create({
    model: GAPS_MODEL,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "closet_gaps",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          required: ["gaps"],
          properties: {
            gaps: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                required: ["piece", "reason"],
                properties: {
                  piece: { type: "string" },
                  reason: { type: "string" },
                },
              },
            },
          },
        },
      },
    },
    messages: [{ role: "user", content: gapsPrompt(items, prefs) }],
  });
  const text = res.choices[0]?.message?.content;
  if (!text) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return [];
  }
  return validateGaps(parsed);
}
```

- [ ] **Step 4: Write the route**

```ts
// app/api/gaps/route.ts
import { desc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { suggestGaps } from "@/lib/ai/gaps";
import { getDb } from "@/lib/db/client";
import { items, preferences } from "@/lib/db/schema";
import { prefsSignal } from "@/lib/prefs/aggregate";

export async function GET() {
  const db = getDb();
  const all = await db.select().from(items).orderBy(desc(items.createdAt));
  const votes = await db.select().from(preferences);
  const prefs = votes.length > 0 ? prefsSignal(votes, all) : null;
  try {
    const gaps = await suggestGaps(all, prefs);
    return NextResponse.json({ gaps });
  } catch (err) {
    console.error("[gaps] suggestion failed:", err);
    return NextResponse.json({ error: "Couldn't size up your closet — try again." }, { status: 502 });
  }
}
```

- [ ] **Step 5: Run tests + smoke, commit**

Run: `npx vitest run lib/ai/gaps.test.ts && npm run typecheck` → green.
Smoke: `curl -s http://localhost:4100/api/gaps` → `{"gaps":[...]}` (contents depend on dev closet; `[]` if empty — fine).

```bash
git add lib/ai/gaps.ts lib/ai/gaps.test.ts app/api/gaps/route.ts
git commit -m "feat(gaps): closet gap suggestions lib and API route"
git push
```

---

### Task 16: Gaps card in StylistTab + e2e

**Files:**
- Modify: `components/stylist/StylistTab.tsx`
- Modify: `e2e/stylist.spec.ts` (append one test)

**Interfaces:**
- Consumes: `GET /api/gaps` (Task 15); `GapSuggestion` (type-only import — MUST be `import type`, the module pulls in the OpenAI client)
- Produces: "More outfits if you add" section under the Inspiration feed; testid `gap-suggestion`; sessionStorage cache `kloset-stylist-gaps`.

- [ ] **Step 1: Add the gaps section to `components/stylist/StylistTab.tsx`**

Add to imports: `import type { GapSuggestion } from "@/lib/ai/gaps";`
Add below `FEED_CACHE_KEY`: `const GAPS_CACHE_KEY = "kloset-stylist-gaps";`

Add state + loader (next to the feed state):

```tsx
  const [gaps, setGaps] = useState<GapSuggestion[] | null>(null);
  const [gapsLoading, setGapsLoading] = useState(false);
  const [gapsError, setGapsError] = useState<string | null>(null);

  async function loadGaps() {
    setGapsLoading(true);
    setGapsError(null);
    try {
      const res = await fetch("/api/gaps");
      const data = (await res.json().catch(() => null)) as
        | { gaps?: GapSuggestion[]; error?: string }
        | null;
      if (!res.ok || !data?.gaps) {
        throw new Error(data?.error ?? "Couldn't size up your closet — try again.");
      }
      setGaps(data.gaps);
      if (data.gaps.length > 0) {
        try {
          sessionStorage.setItem(GAPS_CACHE_KEY, JSON.stringify(data.gaps));
        } catch {
          // Cache is an optimization — a failed write is not a failure.
        }
      }
    } catch (err) {
      setGapsError(err instanceof Error ? err.message : "Couldn't size up your closet — try again.");
    } finally {
      setGapsLoading(false);
    }
  }

  // Same session-cache manners as the feed: shown instantly on return visits.
  useEffect(() => {
    try {
      const cached = sessionStorage.getItem(GAPS_CACHE_KEY);
      if (cached) {
        setGaps(JSON.parse(cached) as GapSuggestion[]);
        return;
      }
    } catch {
      // Bad cache — fall through to a fresh fetch.
    }
    void loadGaps();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
```

Add the section after the closing `</section>` of the Inspiration feed:

```tsx
      {(gapsLoading || gapsError || (gaps && gaps.length > 0)) && (
        <section aria-label="Closet gaps" className="flex flex-col gap-3">
          <h2 className="font-display text-3xl text-ink">More outfits if you add</h2>
          {gapsLoading && (
            <p role="status" className="text-sm text-mute">
              Sizing up your closet…
            </p>
          )}
          {gapsError && <p role="alert" className="text-sm text-error">{gapsError}</p>}
          {gaps?.map((g) => (
            <div key={g.piece} data-testid="gap-suggestion" className="rounded-card bg-card p-4">
              <p className="font-bold text-ink">{g.piece}</p>
              {g.reason && <p className="text-sm text-mute">{g.reason}</p>}
            </div>
          ))}
        </section>
      )}
```

- [ ] **Step 2: Append the e2e test to `e2e/stylist.spec.ts`**

```ts
test("gaps card suggests additions below the feed", async ({ page }) => {
  await page.goto("/stylist");
  await expect(page.getByRole("heading", { name: "More outfits if you add" })).toBeVisible();
  await expect(page.getByTestId("gap-suggestion").first()).toBeVisible();
});
```

(Deterministic: at stylist.spec time the closet has seeded tops/bottoms/shoes, so `mockGaps` always yields at least one suggestion.)

- [ ] **Step 3: Verify**

Run: `npm test && npm run typecheck && npm run test:e2e`
Expected: all green.

- [ ] **Step 4: Commit**

```bash
git add components/stylist/StylistTab.tsx e2e/stylist.spec.ts
git commit -m "feat(gaps): 'more outfits if you add' card on the stylist tab"
git push
```

---

### Task 17: Final verification sweep

**Files:** none new

- [ ] **Step 1: Full suite from a clean build**

```bash
rm -rf .next
npm test && npm run typecheck && npm run test:e2e
```

Expected: all three green. Paste the summary output as evidence.

- [ ] **Step 2: Phone-viewport eyeball (dev, MOCK_AI)**

With `npm run dev` on :4100, at ~390px viewport: `/stylist` shows thumbs on cards + gaps card; vote a card and reload — the vote sticks; `/trips` create → detail shows forecast strip → generate → tick → reload; `/today` still renders its pick. Smoke pass, not a spec — report anything off.

- [ ] **Step 3: Commit stragglers, stop**

```bash
git status --porcelain   # commit + push anything outstanding
```

Merging `kloset-p4` → `main` is the user's call (superpowers:finishing-a-development-branch).

**Owner manual steps (after merge):**
1. Real-AI smoke of the three new prompts (stylist-with-feedback, packing, gaps): set `MOCK_AI=0` temporarily (OPENAI_API_KEY already in `.env.local`), drive Stylist + a real trip, then set `MOCK_AI=1` back. Note: with your `PEXELS_API_KEY` set, Explore is live regardless.
2. Phone drive of /trips and thumbs on real data.

---

## Self-Review (performed at write time)

- **Spec coverage:** wears-constraint db:push fix ✓ (T1), deferred polish batch ✓ (T2/T3), thumbs on suggestion cards with tri-state toggle + reappear lookup ✓ (T4–T7), item flags + taste summary in stylist prompt ✓ (T8), Today pick dislike filter with fallback ✓ (T9), trips screen with geocoded destination + date range ✓ (T13/T14), flat packing checklist with persistent ticks + regenerate-keeps-ticks ✓ (T12–T14), forecast ≤16 days with far-trip fallback ✓ (T10, T12–T14), gaps card on Stylist (no Shopping screen) ✓ (T15/T16), new tables in e2e wipe + CLAUDE.md ✓ (T5/T13), menu 8 screens ✓ (T14).
- **Type consistency:** `PrefsSignal`/`Vote`/`ItemScore`/`TasteProfile` defined once in `lib/prefs/aggregate.ts`; `PackingPick` (lib/ai/packing) and `CapsulePick` (lib/trips/capsule) are structurally identical `{itemId, role}` — routes pass one where the other is expected, which TS accepts structurally; `DayForecast` defined once in weather.ts; route response shapes match client parsing (`{vote}`, `{trip}`, `{capsule, packedIds}`, `{gaps}`).
- **Known deliberate simplifications:** one vote-lookup fetch per mounted card (single-user); thumbs also appear on Lookbook detail (shared component, harmless); trips have no edit — delete and recreate; `hardDisliked` threshold is simple net-negative; mock packing/gaps are category-count heuristics, not stylish — they exist for determinism, not taste.
