# Kloset Phase 2 — Studio — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the Studio: a slot-based outfit builder with an instant flat-lay collage, on-demand AI photoreal try-on renders against the primary avatar base photo, saving outfits to a minimal Lookbook grid — plus the P1 backlog sweep and the dark-chrome (camera screens) tokenization.

**Architecture:** Additive on P1. One new table (`outfits`) storing name + item-id array + optional render URL — the collage is *not* stored, it's rendered live from item cutouts by a shared `OutfitCollage` component (deterministic layout, no duplicated state). Two new API routes: `POST /api/outfits` (save) and `POST /api/render` (try-on; extends `lib/ai/` exactly like the ingest pipeline, with a MOCK_AI fixture path). Studio page follows the Closet pattern: server component fetches all items, client `StudioBuilder` owns selection state.

**Tech Stack:** Next.js 16 App Router · React 19 · TS 6 · Tailwind v4 tokens (`app/globals.css` `@theme`) · Drizzle/Neon · OpenAI `gpt-image-1` via `images.edit` (multi-image input) · Vercel Blob · Vitest + Playwright (MOCK_AI=1).

## Global Constraints

- Roadmap: `C:\Users\bghil\.claude\plans\i-want-to-scrap-quizzical-lecun.md` (Phase 2 section). Branch: `kloset-p2` off `main` (P1 is merged). Push after every task's commit (standing rule: commit = commit AND push).
- All CLAUDE.md rules apply — notably: TDD for logic; a task is done only when `npm test && npm run typecheck && npm run test:e2e` are all green (run them, show output); dev/tests always MOCK_AI=1; lazy env getters; malformed `req.json()` → 400; UI uses DESIGN.md tokens only (no ad-hoc colors/radii); e2e spec files run alphabetically off a single DB wipe.
- e2e alphabetical order after this phase: `auth-flow` → `closet` → `lookbook` → `menu` → `settings` → `studio` → `today`. `settings.spec.ts` deletes ALL base photos at its end; `closet.spec.ts` leaves exactly one item ("Light blue oxford shirt", a top). `studio.spec.ts` must seed its own items and base photo via `page.request`.
- Design guardrails: at most ONE Kloset-pink CTA per screen (Studio's is "Try it on"; empty states may use their single CTA); Great Vibes only for wordmark/page titles/menu; no shadows; radii 16/32/pill only.
- The `outfits` table has NO foreign keys — `item_ids` is a plain uuid[] and deleted items simply drop out of collages at read time (single-user scale, matches the fetch-all-filter-in-memory style).
- Deliberately skipped (say so, don't build): stored collage images (collage renders live from cutouts); `source` column on outfits (P3 adds it with the Stylist via `db:push`); Lookbook wear history/stats/delete (P3); like/dislike (P4).
- Real-AI render smoke test is an OWNER manual step and currently blocked (`BLOB_READ_WRITE_TOKEN` missing from `.env.local`) — note it, don't attempt it.

---

## File Structure

```
package.json                              (modify — name "kloset")
app/globals.css                           (modify — error/success tokens)
components/PasscodeForm.tsx               (modify — text-error)
components/closet/ItemDetailForm.tsx      (modify — text-error/text-success-deep)
components/context/WeatherSection.tsx     (modify — copy + text-error)
components/context/CalendarSection.tsx    (modify — copy + text-error/success)
components/avatar/AvatarSection.tsx       (modify — text-error)
components/scan/ConfirmSheet.tsx          (modify — text-error)
components/scan/outlines.tsx              (modify — real dress/accessory paths)
DESIGN.md                                 (modify — pink-per-section + dark-chrome sections, utility list)
lib/today/pick.test.ts                    (modify — 3 pinned cases)
e2e/today.spec.ts                         (modify — pin fixture weather text)
components/today/TodayCard.tsx            (modify — client-only dateKey)
components/shell/Menu.tsx                 (modify — Tab focus trap)
e2e/menu.spec.ts                          (modify — focus-trap test)
lib/db/schema.ts                          (modify — outfits table)
e2e/global-setup.ts                       (modify — outfits create/wipe)
CLAUDE.md                                 (modify — plan pointer, wipe list)
lib/closet/item-validation.ts             (modify — export cleanName/isImageUrl)
lib/outfits/types.ts                      (new)
lib/outfits/validation.ts                 (new — TDD)
lib/outfits/validation.test.ts            (new)
app/api/outfits/route.ts                  (new — POST)
lib/ai/render.ts                          (new — TDD, mirrors ingest.ts)
lib/ai/render.test.ts                     (new)
public/fixtures/render.svg                (new — mock try-on render)
app/api/render/route.ts                   (new — POST)
components/studio/OutfitCollage.tsx       (new — shared, server-safe)
components/studio/StudioBuilder.tsx       (new — client)
app/(tabs)/studio/page.tsx                (rewrite — real Studio)
e2e/studio.spec.ts                        (new)
app/(tabs)/lookbook/page.tsx              (rewrite — minimal saved-outfits grid)
e2e/lookbook.spec.ts                      (new — empty state; runs before studio)
components/avatar/AvatarCapture.tsx       (modify — token restyle)
components/scan/CaptureScreen.tsx         (modify — token restyle)
```

---

### Task 1: Branch + mechanical P1 backlog (rename, copy, semantic tokens, outlines)

**Files:**
- Modify: `package.json`, `app/globals.css`, `components/PasscodeForm.tsx:77`, `components/closet/ItemDetailForm.tsx:105,110,127`, `components/context/WeatherSection.tsx:58,69,95`, `components/context/CalendarSection.tsx:64-66,75,101,106`, `components/avatar/AvatarSection.tsx:60,97`, `components/scan/ConfirmSheet.tsx:111`, `components/scan/outlines.tsx`, `DESIGN.md`

**Interfaces:**
- Produces: Tailwind utilities `text-error`, `text-success-deep` (used by every later UI task for error/status text).

- [ ] **Step 1: Verify the branch** (created when this plan was committed)

```bash
cd /c/Users/bghil/styling_app && git branch --show-current
```
Expected: `kloset-p2`. If not, `git checkout kloset-p2`.

- [ ] **Step 2: Rename the package**

In `package.json` line 2: `"name": "styling-app",` → `"name": "kloset",`

- [ ] **Step 3: Kill the stale "status bar" copy** (the status bar died in P1)

`components/context/WeatherSection.tsx:58`:
```
Set a location for the daily forecast in the status bar.
```
→
```
Set a location for the daily forecast on your Today screen.
```

`components/context/CalendarSection.tsx:64-66`:
```
Paste your iCloud shared-calendar link (iCloud Calendar → share →
public link). Events show in the status bar and feed outfit
suggestions later.
```
→
```
Paste your iCloud shared-calendar link (iCloud Calendar → share →
public link). Events show on your Today screen and feed outfit
suggestions.
```

- [ ] **Step 4: Wire the DESIGN.md semantic colors as tokens**

In `app/globals.css` `@theme`, after `--color-hairline: #ecdfe6;` add:

```css
  --color-error: #9e0a0a;
  --color-success-deep: #103c25;
  --color-success-pale: #c7f0da;
```

Then replace every raw semantic class (grep confirms exactly these):
- `text-red-600` → `text-error` in: `components/PasscodeForm.tsx:77`, `components/closet/ItemDetailForm.tsx:110,127`, `components/context/WeatherSection.tsx:69,95`, `components/context/CalendarSection.tsx:75,106`, `components/avatar/AvatarSection.tsx:60,97`, `components/scan/ConfirmSheet.tsx:111`
- `text-green-700` → `text-success-deep` in: `components/closet/ItemDetailForm.tsx:105`, `components/context/CalendarSection.tsx:101`

In `DESIGN.md` Iteration Guide item 6, extend the utility list: after `border-hairline`, add `text-error`, `text-success-deep`.

- [ ] **Step 5: Real dress and accessory outlines** (P1 shipped placeholder geometry)

In `components/scan/outlines.tsx` replace two `PATHS` entries (keep all others and `OUTLINE_HINTS` unchanged):

```ts
  dress:
    "M72 20 Q100 34 128 20 L148 45 L132 62 L126 80 L150 160 L50 160 L74 80 L68 62 L52 45 Z",
  accessory:
    "M85 70 Q85 42 100 42 Q115 42 115 70 M60 70 L140 70 Q150 70 148 82 L142 138 Q141 148 130 148 L70 148 Q59 148 58 138 L52 82 Q50 70 60 70 Z",
```

(dress = cap-sleeve A-line silhouette; accessory = handbag with handle arc — multiple `M` subpaths are valid in one stroked path.)

- [ ] **Step 6: Codify the per-section pink exception in DESIGN.md**

In `DESIGN.md` under **Do's**, append one bullet:

```markdown
- On stacked form screens (Settings), apply the one-pink-CTA rule per section
  card, not per screen: each section may carry one pink primary, so a single
  scrolling screen of sections may legitimately show several.
```

- [ ] **Step 7: Verify**

Run: `npm run typecheck && npm test`
Expected: clean tsc; all vitest suites pass (no behavior changed).
Then: `npm run test:e2e` — all Playwright specs pass (copy changes don't touch any locator text).

- [ ] **Step 8: Commit + push**

```bash
git add -A && git commit -m "chore(p2): P1 backlog sweep — kloset rename, Today-screen copy, semantic color tokens, real dress/accessory outlines" && git push -u origin kloset-p2
```

---

### Task 2: Behavioral P1 backlog (test pins, hydration flash, menu focus trap)

**Files:**
- Modify: `lib/today/pick.test.ts`, `e2e/today.spec.ts`, `components/today/TodayCard.tsx`, `components/shell/Menu.tsx`, `e2e/menu.spec.ts`

**Interfaces:**
- Consumes: `pickOutfit(all, weather, dateKey)` from `lib/today/pick.ts` (unchanged).
- Produces: nothing new — pins existing behavior.

- [ ] **Step 1: Pin the three unpinned pick behaviors** (tests only — they should pass immediately; if one fails, STOP: that's a real bug, investigate before touching `pick.ts`)

Append inside `describe("pickOutfit", ...)` in `lib/today/pick.test.ts`:

```ts
  it("prefers top + bottom over a dress when all are present", () => {
    const closet = [item("top"), item("bottom"), item("dress")];
    expect(pickOutfit(closet, WARM, "2026-07-11")?.picks.map((p) => p.category)).toEqual([
      "top", "bottom",
    ]);
  });

  it("adds the jacket exactly at the 15° boundary", () => {
    const AT15: WeatherSummary = { tempMin: 8, tempMax: 15, code: 2, label: "Cloudy", emoji: "⛅" };
    const closet = [item("top"), item("bottom"), item("jacket")];
    expect(pickOutfit(closet, AT15, "2026-07-11")?.picks.map((p) => p.category)).toEqual([
      "top", "bottom", "jacket",
    ]);
  });

  it("layers jacket and hat over a dress base in the cold", () => {
    const closet = [item("dress"), item("shoes"), item("jacket"), item("hat")];
    expect(pickOutfit(closet, COLD, "2026-07-11")?.picks.map((p) => p.category)).toEqual([
      "dress", "shoes", "jacket", "hat",
    ]);
  });
```

- [ ] **Step 2: Run** `npm test` — expected: PASS (these pin current behavior).

- [ ] **Step 3: Strengthen today.spec — assert the actual fixture weather**

In `e2e/today.spec.ts`, replace the weather-chip line:
```ts
  await expect(page.getByLabel("Today's weather")).toBeVisible();
```
→
```ts
  // FIXTURE_WEATHER in lib/context/fixtures.ts: ⛅ 18–24° Partly cloudy.
  await expect(page.getByLabel("Today's weather")).toHaveText(/18–24° Partly cloudy/);
```
(Note: en-dash, exactly as TodayCard renders `{tempMin}–{tempMax}°`.)

- [ ] **Step 4: Fix the dateKey SSR/hydration flash** (ledgered in P1: server-rendered date can differ from client local date → wrong outfit flashes; clean fix = client-only state)

In `components/today/TodayCard.tsx`, replace the two `dateKey` lines (currently computed inline during render, lines ~46-48):

```ts
  const now = new Date();
  const dateKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const outfit = pickOutfit(items, weather, dateKey);
```
→
```ts
  // Client-only: the server's local date can differ from the viewer's, so the
  // outfit section renders nothing until hydration sets the real local key.
  const [dateKey, setDateKey] = useState<string | null>(null);
  useEffect(() => {
    const now = new Date();
    setDateKey(
      `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`,
    );
  }, []);
  const outfit = dateKey ? pickOutfit(items, weather, dateKey) : null;
```

And guard the outfit/empty-state branch so the "Your closet awaits" CTA can't flash before `dateKey` resolves — replace `{outfit ? (` … `) : (` … `)}` with:

```tsx
      {!dateKey ? null : outfit ? (
        /* existing "Today's outfit" section — unchanged */
      ) : (
        /* existing empty-state block — unchanged */
      )}
```

(State hooks: `dateKey` joins the existing `useState`/`useEffect` imports — both already imported.)

- [ ] **Step 5: Run** `npm run test:e2e -- today` — expected: PASS (Playwright auto-waits for the post-hydration render).

- [ ] **Step 6: Menu focus trap — write the failing e2e test first**

Append to `e2e/menu.spec.ts`:

```ts
test("Tab is trapped inside the open menu", async ({ page }) => {
  await unlock(page);
  await page.getByRole("button", { name: "Open menu" }).click();
  // Focus starts on the close button; Shift+Tab must wrap to the last link.
  await page.keyboard.press("Shift+Tab");
  await expect(page.getByRole("link", { name: "Settings" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Close menu" })).toBeFocused();
});
```

- [ ] **Step 7: Run** `npm run test:e2e -- menu` — expected: new test FAILS (focus escapes the dialog).

- [ ] **Step 8: Implement the trap**

In `components/shell/Menu.tsx`, add above the `return`:

```ts
  function trapTab(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "Tab") return;
    const focusables = e.currentTarget.querySelectorAll<HTMLElement>("a[href], button");
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
```

and extend the dialog's existing handler:
```tsx
          onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
```
→
```tsx
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
            trapTab(e);
          }}
```

- [ ] **Step 9: Run** `npm run test:e2e -- menu` — expected: PASS. Then full gates: `npm test && npm run typecheck && npm run test:e2e`.

- [ ] **Step 10: Commit + push**

```bash
git add -A && git commit -m "fix(p2): P1 backlog — pick.test pins, today weather assert, dateKey hydration, menu focus trap" && git push
```

---

### Task 3: `outfits` schema + validation library (TDD)

**Files:**
- Modify: `lib/db/schema.ts`, `e2e/global-setup.ts`, `CLAUDE.md`, `lib/closet/item-validation.ts`
- Create: `lib/outfits/types.ts`, `lib/outfits/validation.ts`
- Test: `lib/outfits/validation.test.ts`

**Interfaces:**
- Consumes: `UUID_RE`, `Result<T>` from `lib/closet/item-validation.ts`; `CATEGORIES` from `lib/closet/categories.ts`.
- Produces (used by Tasks 4, 5, 7):
  - `outfits` Drizzle table: columns `id: uuid pk`, `name: text notNull`, `itemIds: uuid[] notNull` (`item_ids`), `renderUrl: text` nullable (`render_url`), `createdAt: timestamp notNull default now`.
  - `type Outfit = { id: string; name: string; itemIds: string[]; renderUrl: string | null; createdAt: Date }`
  - `type NewOutfit = { name: string; itemIds: string[]; renderUrl: string | null }`
  - `validateNewOutfit(raw: unknown): Result<NewOutfit>`
  - `validateItemIds(raw: unknown): Result<string[]>` (dedupes; 1..7 UUIDs)
  - `checkOutfitItems(requested: string[], found: {id: string; category: string}[]): string | null`
  - `cleanName` and `isImageUrl` become exported from `lib/closet/item-validation.ts` (signatures unchanged).

- [ ] **Step 1: Write the failing tests**

Create `lib/outfits/validation.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  checkOutfitItems,
  validateItemIds,
  validateNewOutfit,
} from "./validation";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

describe("validateItemIds", () => {
  it("accepts a list of UUIDs and dedupes", () => {
    const r = validateItemIds([A, B, A]);
    expect(r).toEqual({ ok: true, value: [A, B] });
  });
  it("rejects non-arrays, non-UUIDs, and empty lists", () => {
    expect(validateItemIds("nope").ok).toBe(false);
    expect(validateItemIds(["not-a-uuid"]).ok).toBe(false);
    expect(validateItemIds([]).ok).toBe(false);
  });
  it("rejects more than one item per category slot count (7)", () => {
    const ids = Array.from({ length: 8 }, (_, i) => A.replace("1111-1111", `1111-11${String(i).padStart(2, "0")}`));
    expect(validateItemIds(ids).ok).toBe(false);
  });
});

describe("validateNewOutfit", () => {
  it("accepts name + itemIds and defaults renderUrl to null", () => {
    const r = validateNewOutfit({ name: " Friday fit ", itemIds: [A] });
    expect(r).toEqual({
      ok: true,
      value: { name: "Friday fit", itemIds: [A], renderUrl: null },
    });
  });
  it("accepts a blob or fixture renderUrl", () => {
    const r = validateNewOutfit({ name: "x", itemIds: [A], renderUrl: "/fixtures/render.svg" });
    expect(r.ok && r.value.renderUrl).toBe("/fixtures/render.svg");
  });
  it("rejects a missing name, bad itemIds, or a junk renderUrl", () => {
    expect(validateNewOutfit({ itemIds: [A] }).ok).toBe(false);
    expect(validateNewOutfit({ name: "x", itemIds: "no" }).ok).toBe(false);
    expect(validateNewOutfit({ name: "x", itemIds: [A], renderUrl: "javascript:alert(1)" }).ok).toBe(false);
  });
});

describe("checkOutfitItems", () => {
  it("passes when every id resolved and categories are distinct", () => {
    expect(
      checkOutfitItems([A, B], [
        { id: A, category: "top" },
        { id: B, category: "bottom" },
      ]),
    ).toBeNull();
  });
  it("flags missing items", () => {
    expect(checkOutfitItems([A, B], [{ id: A, category: "top" }])).toBe(
      "Some items no longer exist.",
    );
  });
  it("flags two items in one category", () => {
    expect(
      checkOutfitItems([A, B], [
        { id: A, category: "top" },
        { id: B, category: "top" },
      ]),
    ).toBe("Outfits take at most one item per category.");
  });
});
```

- [ ] **Step 2: Run** `npm test -- lib/outfits` — expected: FAIL (module doesn't exist).

- [ ] **Step 3: Export the two closet validators it reuses**

In `lib/closet/item-validation.ts`: `function cleanName(` → `export function cleanName(` and `function isImageUrl(` → `export function isImageUrl(`. Nothing else changes.

- [ ] **Step 4: Implement**

Create `lib/outfits/types.ts`:

```ts
export type Outfit = {
  id: string;
  name: string;
  itemIds: string[];
  renderUrl: string | null;
  createdAt: Date;
};
```

Create `lib/outfits/validation.ts`:

```ts
import { CATEGORIES } from "@/lib/closet/categories";
import {
  cleanName,
  isImageUrl,
  type Result,
  UUID_RE,
} from "@/lib/closet/item-validation";

export type NewOutfit = {
  name: string;
  itemIds: string[];
  renderUrl: string | null;
};

export function validateItemIds(raw: unknown): Result<string[]> {
  if (!Array.isArray(raw)) {
    return { ok: false, error: "itemIds must be an array." };
  }
  if (!raw.every((v): v is string => typeof v === "string" && UUID_RE.test(v))) {
    return { ok: false, error: "itemIds must be item UUIDs." };
  }
  const ids = [...new Set(raw)];
  if (ids.length === 0 || ids.length > CATEGORIES.length) {
    return { ok: false, error: `Pick between 1 and ${CATEGORIES.length} items.` };
  }
  return { ok: true, value: ids };
}

export function validateNewOutfit(raw: unknown): Result<NewOutfit> {
  if (typeof raw !== "object" || raw === null) {
    return { ok: false, error: "Body must be an object." };
  }
  const o = raw as Record<string, unknown>;
  const name = cleanName(o.name);
  if (!name) return { ok: false, error: "Name is required (max 120 chars)." };
  const ids = validateItemIds(o.itemIds);
  if (!ids.ok) return ids;
  if (o.renderUrl != null && !isImageUrl(o.renderUrl)) {
    return { ok: false, error: "Invalid renderUrl." };
  }
  return {
    ok: true,
    value: {
      name,
      itemIds: ids.value,
      renderUrl: (o.renderUrl as string | undefined) ?? null,
    },
  };
}

// After the route fetches the referenced items, verify the outfit is buildable.
export function checkOutfitItems(
  requested: string[],
  found: { id: string; category: string }[],
): string | null {
  if (found.length !== requested.length) return "Some items no longer exist.";
  if (new Set(found.map((i) => i.category)).size !== found.length) {
    return "Outfits take at most one item per category.";
  }
  return null;
}
```

- [ ] **Step 5: Run** `npm test -- lib/outfits` — expected: PASS.

- [ ] **Step 6: Add the table to the schema**

Append to `lib/db/schema.ts`:

```ts
export const outfits = pgTable("outfits", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  // Plain id array, no FK — deleted items drop out of collages at read time.
  itemIds: uuid("item_ids").array().notNull(),
  renderUrl: text("render_url"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
```

- [ ] **Step 7: Push the schema** (remember the learned rule: drizzle-kit re-emitting `SET DEFAULT '{}'::text[]` for the items table is a no-op quirk, not drift)

Run: `npm run db:push`
Expected: `outfits` table created.

- [ ] **Step 8: Sync the e2e wipe**

In `e2e/global-setup.ts`, after the `base_photos` CREATE, add:

```ts
  // Keep in sync with lib/db/schema.ts
  await sql`CREATE TABLE IF NOT EXISTS outfits (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    item_ids uuid[] NOT NULL,
    render_url text,
    created_at timestamp NOT NULL DEFAULT now()
  )`;
```

and after `DELETE FROM base_photos`:

```ts
  await sql`DELETE FROM outfits`;
```

- [ ] **Step 9: Update CLAUDE.md**

- `Current plan:` line → `docs/superpowers/plans/2026-07-11-kloset-p2-studio.md`
- Both mentions of the e2e wipe list (`test:e2e` command bullet and the Rules bullet) → "settings, items, base_photos and outfits tables".

- [ ] **Step 10: Full gates, commit + push**

Run: `npm test && npm run typecheck && npm run test:e2e` — all green.

```bash
git add -A && git commit -m "feat(p2): outfits table + validation library" && git push
```

---

### Task 4: `POST /api/outfits`

**Files:**
- Create: `app/api/outfits/route.ts`

**Interfaces:**
- Consumes: `validateNewOutfit`, `checkOutfitItems` (Task 3); `outfits`, `items` schema; `getDb`.
- Produces: `POST /api/outfits` — body `{name, itemIds, renderUrl?}` → `201 {outfit}` | `400 {error}`. (Auth comes free: `proxy.ts` gates every non-public route.) No GET — pages read the DB directly, like Closet does.

- [ ] **Step 1: Implement the route** (route stays thin — its logic is the unit-tested validation; behavior is covered by studio e2e in Task 7)

Create `app/api/outfits/route.ts`:

```ts
import { inArray } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { items, outfits } from "@/lib/db/schema";
import { checkOutfitItems, validateNewOutfit } from "@/lib/outfits/validation";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const parsed = validateNewOutfit(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const found = await getDb()
    .select({ id: items.id, category: items.category })
    .from(items)
    .where(inArray(items.id, parsed.value.itemIds));
  const problem = checkOutfitItems(parsed.value.itemIds, found);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });
  const [outfit] = await getDb().insert(outfits).values(parsed.value).returning();
  return NextResponse.json({ outfit }, { status: 201 });
}
```

- [ ] **Step 2: Smoke it by hand** (MOCK_AI dev server is fine)

Run: `npm run typecheck`
Expected: clean. (The e2e that exercises this lands with the Studio save flow in Task 7 — this task is reviewable as: route matches the unit-tested validation contract.)

- [ ] **Step 3: Commit + push**

```bash
git add -A && git commit -m "feat(p2): POST /api/outfits" && git push
```

---

### Task 5: Try-on render pipeline + `POST /api/render` (TDD on the MOCK path)

**Files:**
- Create: `lib/ai/render.ts`, `public/fixtures/render.svg`, `app/api/render/route.ts`
- Test: `lib/ai/render.test.ts`

**Interfaces:**
- Consumes: `getOpenAI()` (`lib/ai/openai.ts`), `putImage` (`lib/storage/blob.ts`), `CATEGORY_LABELS`/`Category` (`lib/closet/categories.ts`), `validateItemIds`/`checkOutfitItems` (Task 3), `basePhotos`/`items` schema.
- Produces (used by Task 8):
  - `type RenderGarment = { name: string; category: Category; imageUrl: string }`
  - `runRenderPipeline(basePhotoUrl: string, garments: RenderGarment[]): Promise<string>` — returns the hosted render URL; `/fixtures/render.svg` under MOCK_AI.
  - `POST /api/render` — body `{itemIds}` → `200 {renderUrl}` | `400 {error}` (bad ids) | `409 {error}` (no primary base photo) | `422 {error}` (fixture-image items in real mode) | `502 {error}` (pipeline failure).

- [ ] **Step 1: Write the failing test**

Create `lib/ai/render.test.ts` (same shape as `ingest.test.ts`):

```ts
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runRenderPipeline } from "./render";

describe("runRenderPipeline with MOCK_AI=1", () => {
  const previous = process.env.MOCK_AI;
  beforeEach(() => {
    process.env.MOCK_AI = "1";
  });
  afterEach(() => {
    if (previous === undefined) delete process.env.MOCK_AI;
    else process.env.MOCK_AI = previous;
  });

  it("returns the fixture render without touching OpenAI/Blob", async () => {
    const url = await runRenderPipeline("https://mock/base.jpg", [
      { name: "Light blue oxford shirt", category: "top", imageUrl: "https://mock/cutout.png" },
    ]);
    expect(url).toBe("/fixtures/render.svg");
  });
});
```

- [ ] **Step 2: Run** `npm test -- lib/ai/render` — expected: FAIL (module doesn't exist).

- [ ] **Step 3: Implement the pipeline**

Create `lib/ai/render.ts`:

```ts
import { toFile } from "openai";
import { CATEGORY_LABELS, type Category } from "@/lib/closet/categories";
import { putImage } from "@/lib/storage/blob";
import { getOpenAI } from "./openai";

const IMAGE_MODEL = "gpt-image-1";

export type RenderGarment = { name: string; category: Category; imageUrl: string };

function isMockAi(): boolean {
  return process.env.MOCK_AI === "1";
}

async function fetchImage(url: string): Promise<{ buffer: Buffer; mime: string }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`image fetch failed (${res.status}): ${url}`);
  return {
    buffer: Buffer.from(await res.arrayBuffer()),
    mime: res.headers.get("content-type") ?? "image/png",
  };
}

export async function runRenderPipeline(
  basePhotoUrl: string,
  garments: RenderGarment[],
): Promise<string> {
  if (isMockAi()) return "/fixtures/render.svg";

  const [base, ...cutouts] = await Promise.all([
    fetchImage(basePhotoUrl),
    ...garments.map((g) => fetchImage(g.imageUrl)),
  ]);
  const images = await Promise.all([
    toFile(base.buffer, "base.jpg", { type: base.mime }),
    ...cutouts.map((c, i) => toFile(c.buffer, `garment-${i}.png`, { type: c.mime })),
  ]);
  const list = garments
    .map((g) => `- ${g.name} (${CATEGORY_LABELS[g.category]})`)
    .join("\n");
  const res = await getOpenAI().images.edit({
    model: IMAGE_MODEL,
    quality: "medium",
    image: images,
    size: "1024x1536",
    prompt:
      "The first image is a full-body photo of a person. Dress that person in the " +
      `garments shown in the remaining images:\n${list}\n` +
      "Keep the person's face, hair, body shape, pose, and the original background " +
      "unchanged — replace only their clothing. Photorealistic fabric drape and lighting.",
  });
  const b64 = res.data?.[0]?.b64_json;
  if (!b64) throw new Error("render returned no image");
  return putImage("renders/outfit.png", Buffer.from(b64, "base64"), "image/png");
}
```

- [ ] **Step 4: Run** `npm test -- lib/ai/render` — expected: PASS.

- [ ] **Step 5: Add the mock render fixture**

Create `public/fixtures/render.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 450">
  <rect width="300" height="450" fill="#e8e0e4"/>
  <circle cx="150" cy="80" r="32" fill="#c8a08a"/>
  <path d="M150 112 L110 130 L104 250 L196 250 L190 130 Z" fill="#7bafd4"/>
  <path d="M118 250 L104 420 L138 420 L150 300 L162 420 L196 420 L182 250 Z" fill="#39434f"/>
  <text x="150" y="440" text-anchor="middle" font-family="sans-serif" font-size="14" fill="#6e6270">Mock try-on render</text>
</svg>
```

- [ ] **Step 6: Implement the route**

Create `app/api/render/route.ts`:

```ts
import { eq, inArray } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { runRenderPipeline } from "@/lib/ai/render";
import { getDb } from "@/lib/db/client";
import { basePhotos, items } from "@/lib/db/schema";
import { checkOutfitItems, validateItemIds } from "@/lib/outfits/validation";

// Multi-image photoreal renders are slow; Vercel clamps this to the plan max.
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Body must be an object." }, { status: 400 });
  }
  const ids = validateItemIds((body as Record<string, unknown>).itemIds);
  if (!ids.ok) return NextResponse.json({ error: ids.error }, { status: 400 });

  const db = getDb();
  const found = await db.select().from(items).where(inArray(items.id, ids.value));
  const problem = checkOutfitItems(ids.value, found);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });

  const [primary] = await db
    .select()
    .from(basePhotos)
    .where(eq(basePhotos.isPrimary, true))
    .limit(1);
  if (!primary) {
    return NextResponse.json(
      { error: "Add a base photo first — try-on dresses your primary base photo." },
      { status: 409 },
    );
  }

  if (process.env.MOCK_AI !== "1") {
    const urls = [primary.imageUrl, ...found.map((i) => i.imageUrl)];
    if (urls.some((u) => !u.startsWith("https://"))) {
      return NextResponse.json(
        { error: "Some images are dev fixtures — recapture them before rendering." },
        { status: 422 },
      );
    }
  }

  try {
    const renderUrl = await runRenderPipeline(primary.imageUrl, found);
    return NextResponse.json({ renderUrl });
  } catch (err) {
    console.error("[render] pipeline failed:", err);
    return NextResponse.json({ error: "Render failed — try again." }, { status: 502 });
  }
}
```

- [ ] **Step 7: Full gates** — `npm test && npm run typecheck && npm run test:e2e` all green (e2e coverage of this route lands in Task 8).

- [ ] **Step 8: Commit + push**

```bash
git add -A && git commit -m "feat(p2): try-on render pipeline + POST /api/render (MOCK_AI fixture path)" && git push
```

---

### Task 6: OutfitCollage + StudioBuilder (slots, picker, collage) + Studio page

**Files:**
- Create: `components/studio/OutfitCollage.tsx`, `components/studio/StudioBuilder.tsx`, `e2e/studio.spec.ts`
- Modify: `app/(tabs)/studio/page.tsx` (replace the placeholder)

**Interfaces:**
- Consumes: `ClosetItem`, `CATEGORIES`, `CATEGORY_PLURAL_LABELS`, `Category`.
- Produces (used by Tasks 7, 8):
  - `OutfitCollage({ items }: { items: ClosetItem[] })` — server-safe (no hooks), renders `data-testid="outfit-collage"`, one `<img alt={item.name}>` per item, in a blush `rounded-card` 3:4 canvas.
  - `StudioBuilder({ items }: { items: ClosetItem[] })` — client component; Tasks 7/8 add `save()`/`tryOn()` INTO this file. The `render`/`view` state that `tryOn()` needs is declared now (this task's code compiles standalone); Task 7 declares its own `naming`/`saving` state.

- [ ] **Step 1: The collage**

Create `components/studio/OutfitCollage.tsx`:

```tsx
import type { CSSProperties } from "react";
import { CATEGORIES, type Category } from "@/lib/closet/categories";
import type { ClosetItem } from "@/lib/closet/types";

// Fixed flat-lay zones on a 3:4 canvas: garment column left (top over bottom),
// jacket top-right, hat mid-right, shoes bottom-right, accessory bottom-center.
// DOM order = CATEGORIES order, so later categories paint over earlier ones.
const ZONES: Record<Category, CSSProperties> = {
  top: { left: "6%", top: "4%", width: "46%" },
  bottom: { left: "10%", top: "46%", width: "42%" },
  dress: { left: "6%", top: "4%", width: "50%" },
  jacket: { left: "55%", top: "6%", width: "40%" },
  shoes: { left: "58%", top: "64%", width: "36%" },
  hat: { left: "64%", top: "42%", width: "26%" },
  accessory: { left: "38%", top: "74%", width: "22%" },
};

export default function OutfitCollage({ items }: { items: ClosetItem[] }) {
  const ordered = CATEGORIES.flatMap((c) => items.filter((i) => i.category === c));
  return (
    <div
      data-testid="outfit-collage"
      className="relative aspect-[3/4] overflow-hidden rounded-card bg-card"
    >
      {ordered.map((item) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={item.id}
          src={item.imageUrl}
          alt={item.name}
          className="absolute object-contain"
          style={ZONES[item.category]}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 2: The builder** (selection + collage only — `tryOn`/`save` bodies arrive in Tasks 8/7; declare their state now)

Create `components/studio/StudioBuilder.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useState } from "react";
import OutfitCollage from "./OutfitCollage";
import {
  CATEGORIES,
  CATEGORY_PLURAL_LABELS,
  type Category,
} from "@/lib/closet/categories";
import type { ClosetItem } from "@/lib/closet/types";

type RenderState =
  | { status: "idle"; url: string | null }
  | { status: "loading"; url: null }
  | { status: "error"; url: null; message: string; needsBasePhoto: boolean };

function chipClass(active: boolean) {
  return `whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold ${
    active ? "bg-ink text-white" : "bg-card text-ink"
  }`;
}

export default function StudioBuilder({ items }: { items: ClosetItem[] }) {
  const [selected, setSelected] = useState<Partial<Record<Category, ClosetItem>>>({});
  const [active, setActive] = useState<Category>(
    () => CATEGORIES.find((c) => items.some((i) => i.category === c)) ?? "top",
  );
  const [view, setView] = useState<"collage" | "render">("collage");
  const [render, setRender] = useState<RenderState>({ status: "idle", url: null });

  const chosen = CATEGORIES.flatMap((c) => (selected[c] ? [selected[c]!] : []));
  const activeItems = items.filter((i) => i.category === active);

  function toggle(item: ClosetItem) {
    setSelected((prev) => {
      const next = { ...prev };
      if (next[item.category]?.id === item.id) delete next[item.category];
      else next[item.category] = item;
      return next;
    });
    // A different outfit invalidates the old render.
    setRender({ status: "idle", url: null });
    setView("collage");
  }

  if (items.length === 0) {
    return (
      <div className="mt-16 flex flex-col items-center gap-3 text-center">
        <p className="font-script text-3xl text-ink">Nothing to style yet</p>
        <p className="text-mute">Scan a few pieces, then come build looks.</p>
        <Link
          href="/scan"
          className="rounded-full bg-pink px-5 py-3 text-sm font-bold text-white active:bg-pink-deep"
        >
          Scan an item
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {view === "render" && render.url ? (
        <div className="overflow-hidden rounded-card bg-card">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={render.url} alt="Try-on render" className="w-full" />
        </div>
      ) : (
        <OutfitCollage items={chosen} />
      )}

      <div
        className="flex gap-2 overflow-x-auto pb-1"
        aria-label="Pick a category"
      >
        {CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setActive(c)}
            aria-pressed={active === c}
            className={chipClass(active === c)}
          >
            {CATEGORY_PLURAL_LABELS[c]}
          </button>
        ))}
      </div>

      <div
        className="flex gap-2 overflow-x-auto pb-1"
        aria-label={`Pick ${CATEGORY_PLURAL_LABELS[active].toLowerCase()}`}
      >
        {activeItems.length === 0 && (
          <p className="text-sm text-mute">
            No {CATEGORY_PLURAL_LABELS[active].toLowerCase()} yet —{" "}
            <Link href="/scan" className="underline">
              scan some
            </Link>
            .
          </p>
        )}
        {activeItems.map((item) => {
          const isSelected = selected[item.category]?.id === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => toggle(item)}
              aria-pressed={isSelected}
              className={`w-28 shrink-0 rounded-card bg-card p-3 ${
                isSelected ? "outline-2 outline-ink" : ""
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.imageUrl} alt="" className="h-24 w-full object-contain" />
              <span className="mt-1 block truncate text-xs font-bold text-ink">
                {item.name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: The page**

Replace `app/(tabs)/studio/page.tsx`:

```tsx
import { desc } from "drizzle-orm";
import PageHeader from "@/components/shell/PageHeader";
import StudioBuilder from "@/components/studio/StudioBuilder";
import { getDb } from "@/lib/db/client";
import { items } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export default async function StudioPage() {
  const all = await getDb().select().from(items).orderBy(desc(items.createdAt));
  return (
    <>
      <PageHeader title="Studio" />
      <StudioBuilder items={all} />
    </>
  );
}
```

- [ ] **Step 4: e2e — seed + collage behavior** (file order matters: this serial suite grows in Tasks 7/8; keep test order exactly seed → collage → [save, Task 7] → [try-on tests, Task 8])

Create `e2e/studio.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import { unlock } from "./helpers";

// Runs after settings.spec (base photos: zero) and closet.spec (one leftover
// top). Seeds its own items; Task 8's tests seed the base photo late so the
// no-base-photo path stays testable.
test.describe.serial("studio", () => {
  test("seed: three items land in the closet via the API", async ({ page }) => {
    await unlock(page);
    for (const [name, category] of [
      ["Studio tee", "top"],
      ["Studio jeans", "bottom"],
      ["Studio sneakers", "shoes"],
    ] as const) {
      const res = await page.request.post("/api/items", {
        data: {
          name,
          category,
          colors: ["blue"],
          styleTags: [],
          imageUrl: "/fixtures/cutout-top.svg",
          originalImageUrl: "/fixtures/original-top.svg",
        },
      });
      expect(res.status()).toBe(201);
    }
  });

  test("selecting pieces composes the flat-lay collage", async ({ page }) => {
    await unlock(page);
    await page.goto("/studio");
    await page.getByRole("button", { name: "Studio tee" }).click();
    await expect(page.getByTestId("outfit-collage").locator("img")).toHaveCount(1);
    await page.getByRole("button", { name: "Bottoms" }).click();
    await page.getByRole("button", { name: "Studio jeans" }).click();
    await expect(page.getByTestId("outfit-collage").locator("img")).toHaveCount(2);
    // Tapping the selected piece again clears its slot.
    await page.getByRole("button", { name: "Studio jeans" }).click();
    await expect(page.getByTestId("outfit-collage").locator("img")).toHaveCount(1);
  });
});
```

- [ ] **Step 5: Run** `npm run test:e2e -- studio` — expected: PASS. Then full gates: `npm test && npm run typecheck && npm run test:e2e`.

- [ ] **Step 6: Commit + push**

```bash
git add -A && git commit -m "feat(p2): Studio slot builder with live flat-lay collage" && git push
```

> Amended during execution: selected-tile outline changed pink → ink (DESIGN.md: pink is never decorative; ink is the selected-state idiom).

---

### Task 7: Save outfit → Lookbook grid

**Files:**
- Modify: `components/studio/StudioBuilder.tsx` (add save flow), `e2e/studio.spec.ts` (append save test), `app/(tabs)/lookbook/page.tsx` (replace placeholder)
- Create: `e2e/lookbook.spec.ts`

**Interfaces:**
- Consumes: `POST /api/outfits` (Task 4), `OutfitCollage` (Task 6), `outfits` schema (Task 3).
- Produces: Save flow UI — button "Save outfit" (secondary) reveals input labeled "Outfit name" (prefilled with item names joined by " + ", capped 120) + button "Save" (exact name); success navigates to `/lookbook`. Lookbook = masonry grid of saved outfits (render photo if present, else live collage), name pill overlay.

- [ ] **Step 1: e2e first — append to `e2e/studio.spec.ts`** (inside the serial describe, after the collage test)

```ts
  test("save outfit lands in the lookbook", async ({ page }) => {
    await unlock(page);
    await page.goto("/studio");
    await page.getByRole("button", { name: "Studio tee" }).click();
    await page.getByRole("button", { name: "Bottoms" }).click();
    await page.getByRole("button", { name: "Studio jeans" }).click();
    await page.getByRole("button", { name: "Save outfit" }).click();
    await expect(page.getByLabel("Outfit name")).toHaveValue("Studio tee + Studio jeans");
    await page.getByLabel("Outfit name").fill("Friday fit");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page).toHaveURL(/\/lookbook$/);
    await expect(page.getByText("Friday fit")).toBeVisible();
  });
```

And create `e2e/lookbook.spec.ts` (sorts before `studio.spec.ts`, so it sees the pre-save empty state):

```ts
import { expect, test } from "@playwright/test";
import { unlock } from "./helpers";

test("lookbook starts empty with a studio CTA", async ({ page }) => {
  await unlock(page);
  await page.goto("/lookbook");
  await expect(page.getByText("No looks yet")).toBeVisible();
  await expect(page.getByRole("link", { name: "Open Studio" })).toBeVisible();
});
```

- [ ] **Step 2: Run** `npm run test:e2e -- lookbook studio` — expected: both new tests FAIL (no save UI, placeholder page).

- [ ] **Step 3: Add the save flow to `StudioBuilder.tsx`**

New imports: `import { useRouter } from "next/navigation";` — and inside the component add:

```ts
  const router = useRouter();
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/outfits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          itemIds: chosen.map((i) => i.id),
          renderUrl: render.url,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setSaveError(data?.error ?? "Save failed — try again.");
        return;
      }
      router.push("/lookbook");
      router.refresh();
    } catch {
      setSaveError("Save failed — try again.");
    } finally {
      setSaving(false);
    }
  }
```

Also reset stale naming state inside `toggle(item)` (after the `setView` line): `setNaming(false);`

At the bottom of the returned JSX (after the item strip), add the actions block:

```tsx
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => {
            setNaming(true);
            setName(chosen.map((i) => i.name).join(" + ").slice(0, 120));
          }}
          disabled={chosen.length === 0 || saving}
          className="h-11 rounded-full bg-secondary px-5 text-sm font-bold text-ink active:bg-secondary-deep disabled:opacity-40"
        >
          Save outfit
        </button>
      </div>

      {naming && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
          className="flex items-center gap-2"
        >
          <label className="sr-only" htmlFor="outfit-name">
            Outfit name
          </label>
          <input
            id="outfit-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-11 min-w-0 flex-1 rounded-card border border-hairline bg-canvas px-4 text-ink"
          />
          <button
            type="submit"
            disabled={saving || name.trim().length === 0}
            className="h-11 shrink-0 rounded-full bg-secondary px-5 text-sm font-bold text-ink active:bg-secondary-deep disabled:opacity-40"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </form>
      )}
      {saveError && (
        <p role="alert" className="text-sm text-error">
          {saveError}
        </p>
      )}
```

("Save outfit" is deliberately the blush secondary — the screen's single pink CTA is "Try it on", arriving in Task 8.)

- [ ] **Step 4: Rebuild the Lookbook page**

Replace `app/(tabs)/lookbook/page.tsx`:

```tsx
import { desc } from "drizzle-orm";
import Link from "next/link";
import PageHeader from "@/components/shell/PageHeader";
import OutfitCollage from "@/components/studio/OutfitCollage";
import { getDb } from "@/lib/db/client";
import { items, outfits } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export default async function LookbookPage() {
  const db = getDb();
  const [allOutfits, allItems] = await Promise.all([
    db.select().from(outfits).orderBy(desc(outfits.createdAt)),
    db.select().from(items),
  ]);
  const byId = new Map(allItems.map((i) => [i.id, i]));

  return (
    <>
      <PageHeader title="Lookbook" />
      {allOutfits.length === 0 ? (
        <div className="mt-16 flex flex-col items-center gap-3 text-center">
          <p className="font-script text-3xl text-ink">No looks yet</p>
          <p className="text-mute">Build your first outfit in the Studio.</p>
          <Link
            href="/studio"
            className="rounded-full bg-pink px-5 py-3 text-sm font-bold text-white active:bg-pink-deep"
          >
            Open Studio
          </Link>
        </div>
      ) : (
        <div className="mt-4 columns-2 gap-2 sm:columns-3 md:columns-4 [&>div]:mb-2">
          {allOutfits.map((outfit) => {
            // Deleted items just drop out of the collage.
            const resolved = outfit.itemIds.flatMap((id) => {
              const item = byId.get(id);
              return item ? [item] : [];
            });
            return (
              <div
                key={outfit.id}
                className="relative break-inside-avoid overflow-hidden rounded-card bg-card"
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
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 5: Run** `npm run test:e2e -- lookbook studio` — expected: PASS. Full gates: `npm test && npm run typecheck && npm run test:e2e`.

- [ ] **Step 6: Commit + push**

```bash
git add -A && git commit -m "feat(p2): save outfits + Lookbook grid" && git push
```

---

### Task 8: "Try it on" — the render flow in Studio

**Files:**
- Modify: `components/studio/StudioBuilder.tsx` (tryOn + view toggle + pink CTA), `e2e/studio.spec.ts` (append two tests)

**Interfaces:**
- Consumes: `POST /api/render` (Task 5): 200 `{renderUrl}`, 409 = no base photo, others `{error}`.
- Produces: pink CTA "Try it on"; render photo `<img alt="Try-on render">`; view chips "Flat lay" / "Try-on" once a render exists; 409 error shows a `Link` "Capture base photo" → `/avatar-capture`.

- [ ] **Step 1: e2e first — append to the serial suite in `e2e/studio.spec.ts`** (AFTER the save test: base photos must still be absent for the first one)

```ts
  test("try it on without a base photo points to avatar capture", async ({ page }) => {
    await unlock(page);
    await page.goto("/studio");
    await page.getByRole("button", { name: "Studio tee" }).click();
    await page.getByRole("button", { name: "Try it on" }).click();
    // Next 16's route announcer also has role=alert — use the precise locator.
    await expect(page.locator("p[role='alert']")).toContainText("base photo");
    await expect(page.getByRole("link", { name: "Capture base photo" })).toBeVisible();
  });

  test("try it on renders the mock try-on photo", async ({ page }) => {
    await unlock(page);
    const seeded = await page.request.post("/api/base-photos", {
      multipart: {
        photo: { name: "base.jpg", mimeType: "image/jpeg", buffer: Buffer.from("fake-jpeg-bytes") },
      },
    });
    expect(seeded.status()).toBe(201);
    await page.goto("/studio");
    await page.getByRole("button", { name: "Studio tee" }).click();
    await page.getByRole("button", { name: "Try it on" }).click();
    const photo = page.getByRole("img", { name: "Try-on render" });
    await expect(photo).toBeVisible({ timeout: 15_000 });
    await expect(photo).toHaveAttribute("src", /render\.svg/);
    // Flip back to the flat lay and back again.
    await page.getByRole("button", { name: "Flat lay" }).click();
    await expect(page.getByTestId("outfit-collage")).toBeVisible();
    await page.getByRole("button", { name: "Try-on", exact: true }).click();
    await expect(photo).toBeVisible();
  });
```

- [ ] **Step 2: Run** `npm run test:e2e -- studio` — expected: the two new tests FAIL (no Try it on button).

- [ ] **Step 3: Implement in `StudioBuilder.tsx`**

Add the handler next to `save()`:

```ts
  async function tryOn() {
    setRender({ status: "loading", url: null });
    try {
      const res = await fetch("/api/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemIds: chosen.map((i) => i.id) }),
        signal: AbortSignal.timeout(180_000),
      });
      const data = (await res.json().catch(() => null)) as {
        renderUrl?: string;
        error?: string;
      } | null;
      if (!res.ok || !data?.renderUrl) {
        setRender({
          status: "error",
          url: null,
          message: data?.error ?? "Render failed — try again.",
          needsBasePhoto: res.status === 409,
        });
        return;
      }
      setRender({ status: "idle", url: data.renderUrl });
      setView("render");
    } catch {
      setRender({
        status: "error",
        url: null,
        message: "Render failed — try again.",
        needsBasePhoto: false,
      });
    }
  }
```

In the actions block, add the pink CTA BEFORE the "Save outfit" button (Studio's one pink action):

```tsx
        <button
          type="button"
          onClick={() => void tryOn()}
          disabled={chosen.length === 0 || render.status === "loading"}
          className="h-11 rounded-full bg-pink px-5 text-sm font-bold text-white active:bg-pink-deep disabled:opacity-40"
        >
          {render.status === "loading" ? "Rendering…" : "Try it on"}
        </button>
```

Directly under the collage/render preview, add status + view toggle:

```tsx
      {render.status === "loading" && (
        <p role="status" className="text-sm text-mute">
          Rendering your try-on… this can take a minute.
        </p>
      )}
      {render.status === "error" && (
        <p role="alert" className="text-sm text-error">
          {render.message}{" "}
          {render.needsBasePhoto && (
            <Link href="/avatar-capture" className="underline">
              Capture base photo
            </Link>
          )}
        </p>
      )}
      {render.url && (
        <div className="flex gap-2" role="group" aria-label="Preview mode">
          <button type="button" onClick={() => setView("collage")} className={chipClass(view === "collage")}>
            Flat lay
          </button>
          <button type="button" onClick={() => setView("render")} className={chipClass(view === "render")}>
            Try-on
          </button>
        </div>
      )}
```

- [ ] **Step 4: Run** `npm run test:e2e -- studio` — expected: PASS. Full gates: `npm test && npm run typecheck && npm run test:e2e`.

- [ ] **Step 5: Commit + push**

```bash
git add -A && git commit -m "feat(p2): Try it on — AI try-on render flow in Studio" && git push
```

---

### Task 9: Dark-chrome tokenization — avatar capture + scan viewfinder restyle

**Files:**
- Modify: `components/avatar/AvatarCapture.tsx`, `components/scan/CaptureScreen.tsx`, `DESIGN.md`

**Interfaces:**
- Consumes: existing tokens (`bg-ink`, `bg-canvas`, `text-ink`, `rounded-card`, `border-hairline` — all generated from `@theme`).
- Produces: DESIGN.md "Dark chrome" vocabulary. **Every button label, role, and testid stays byte-identical** — `settings.spec.ts` and `closet.spec.ts` must pass untouched.

- [ ] **Step 1: Codify dark chrome in DESIGN.md** (this was the P1 ledger item — the rules, then the sweep)

Add after the **Overlays** section:

```markdown
### Dark chrome (camera screens)

Scan and avatar-capture viewfinders run on an ink chrome so the camera feed
reads true. The vocabulary, mirroring light chrome one-for-one:

- Surface: `{colors.ink}` (`bg-ink`); wells (viewfinder, photo preview) are
  white at 10% over ink (`bg-white/10`), `{rounded.card}`.
- Primary action: exactly ONE canvas pill per dark screen (`bg-canvas
  text-ink`, pill radius, `{typography.button-md}`) — the dark twin of the
  one-pink-CTA rule. Kloset Pink itself never appears on dark chrome.
- Secondary actions: white at 15% (`bg-white/15 text-white`), pill radius.
- Helper and utility text: white at 70% (`text-white/70`).
- No other colors on dark chrome; the shutter ring keeps `border-hairline`.
```

- [ ] **Step 2: Restyle `AvatarCapture.tsx`** — exact className replacements (labels/structure untouched):

| Current className (find) | Replacement |
|---|---|
| `flex min-h-dvh flex-col bg-neutral-950 p-4` | `flex min-h-dvh flex-col bg-ink p-4` |
| `flex min-h-dvh flex-col gap-4 bg-neutral-950 p-4` | `flex min-h-dvh flex-col gap-4 bg-ink p-4` |
| `flex min-h-dvh flex-col items-center justify-center gap-4 bg-neutral-950 p-6` | `flex min-h-dvh flex-col items-center justify-center gap-4 bg-ink p-6` |
| `flex flex-1 items-center justify-center overflow-hidden rounded-2xl bg-neutral-800` | `flex flex-1 items-center justify-center overflow-hidden rounded-card bg-white/10` |
| `relative flex flex-1 items-center justify-center overflow-hidden rounded-2xl bg-neutral-800` | `relative flex flex-1 items-center justify-center overflow-hidden rounded-card bg-white/10` |
| `flex-1 rounded-xl bg-white p-3 font-semibold text-neutral-900 disabled:opacity-50` ("Use photo") | `flex-1 rounded-full bg-canvas p-3 text-sm font-bold text-ink disabled:opacity-50` |
| `flex-1 rounded-xl bg-neutral-700 p-3 font-semibold text-white disabled:opacity-50` ("↻ Retake") | `flex-1 rounded-full bg-white/15 p-3 text-sm font-bold text-white disabled:opacity-50` |
| `rounded-xl bg-white px-6 py-3 font-semibold text-neutral-900` ("Try again", ×2 incl. ternary branch) | `rounded-full bg-canvas px-6 py-3 text-sm font-bold text-ink` |
| `touch-manipulation rounded-xl bg-white px-5 py-3 font-semibold text-neutral-900 disabled:opacity-30` ("⏱ 10s timer") | `touch-manipulation rounded-full bg-canvas px-5 py-3 text-sm font-bold text-ink disabled:opacity-30` |
| `touch-manipulation rounded-xl bg-neutral-200 px-5 py-3 font-semibold text-neutral-900 disabled:opacity-30` ("Take photo now") | `touch-manipulation rounded-full bg-white/15 px-5 py-3 text-sm font-bold text-white disabled:opacity-30` |
| every `text-neutral-200` | `text-white/80` |
| every `text-neutral-300` | `text-white/70` |
| `text-sm text-neutral-400 underline` | `text-sm text-white/70 underline` |

(Timer is the canvas-pill primary — the featured hands-free, full-body flow; "Take photo now" is secondary. Countdown overlay `bg-black/50` / `text-white` stays.)

- [ ] **Step 3: Restyle `CaptureScreen.tsx`:**

| Current className (find) | Replacement |
|---|---|
| `flex min-h-dvh flex-col gap-4 bg-neutral-950 p-4` | `flex min-h-dvh flex-col gap-4 bg-ink p-4` |
| `relative flex flex-1 items-center justify-center overflow-hidden rounded-card bg-neutral-800` | `relative flex flex-1 items-center justify-center overflow-hidden rounded-card bg-white/10` |
| `max-w-xs text-center text-sm text-neutral-300` | `max-w-xs text-center text-sm text-white/70` |
| `absolute bottom-3 w-full text-center text-xs text-neutral-200` | `absolute bottom-3 w-full text-center text-xs text-white/80` |
| `cursor-pointer text-sm text-neutral-300` | `cursor-pointer text-sm text-white/70` |
| `text-sm text-neutral-300` ("✕ Cancel") | `text-sm text-white/70` |

(The shutter button already uses tokens — unchanged. `CategoryChips` `dark` prop — unchanged.)

- [ ] **Step 4: Verify no neutral remains**

Run: `grep -rn "neutral-" components/ app/`
Expected: no matches.

- [ ] **Step 5: Full gates** — `npm test && npm run typecheck && npm run test:e2e` (settings + closet + studio specs prove the flows still work; all locators were label-based).

- [ ] **Step 6: Commit + push**

```bash
git add -A && git commit -m "polish(p2): dark-chrome tokenization for avatar capture + scan viewfinder" && git push
```

---

### Task 10: Design audit + final verification

**Files:**
- Possibly modify: any P2 screen file, `docs/superpowers/plans/2026-07-11-kloset-p2-studio.md` (amendments), `.superpowers/sdd/progress.md`

- [ ] **Step 1: DESIGN.md-conformance audit of the three touched screens** (Studio, Lookbook, avatar/scan dark chrome). Check each against DESIGN.md rules: exactly one pink CTA per screen (Studio: "Try it on"; Lookbook empty state: "Open Studio"; dark screens: one canvas pill); script font only in page titles/empty-state moments ≥40px equivalents (`text-3xl` script is the established P1 empty-state size — keep consistent); radii only 16/32/pill; no shadows; no hand-rolled hex/arbitrary values (`grep -n "#\|\[.*px\]" components/studio/*.tsx app/(tabs)/studio/page.tsx app/(tabs)/lookbook/page.tsx` — expect only token-backed classes; the `aspect-[3/4]` and `max-w-[85%]` arbitrary utilities are layout, not color/radius — allowed). Fix violations.

- [ ] **Step 2: Full gates with output**

Run: `npm test && npm run typecheck && npm run test:e2e`
Expected: every suite green — paste the summary lines.

- [ ] **Step 3: Drive it in the browser** (dev server runs MOCK_AI=1; phone viewport ~390px)

Run: `npm run dev`, then walk:
1. `/studio` empty → after seeding via `/scan` (library upload) → chips populate.
2. Select top + bottom → collage composes; deselect → slot clears.
3. "Try it on" with no base photo → error + "Capture base photo" link → capture flow (now ink-chrome) → back to Studio → "Try it on" → mock render appears; "Flat lay"/"Try-on" toggle works.
4. "Save outfit" → prefilled name → Save → lands on `/lookbook`, outfit tile + name pill visible.
5. Menu → all six screens still navigate; Today unchanged.

- [ ] **Step 4: Record the phase**

Append task statuses to `.superpowers/sdd/progress.md` (per-task commit ranges + any ledgered minors), including: **real-AI render smoke test = owner manual step, still blocked on BLOB_READ_WRITE_TOKEN in `.env.local`** (applies to both ingest and render now).

- [ ] **Step 5: Commit + push**

```bash
git add -A && git commit -m "docs(p2): progress + audit fixes" && git push
```

---

## Verification (phase exit bar)

- `npm test && npm run typecheck && npm run test:e2e` all green.
- MOCK_AI browser drive (Task 10 Step 3) passes end-to-end on a phone viewport.
- Studio: build → collage instant; try on → render (mock); save → Lookbook shows it.
- Avatar capture + scan viewfinder are token-pure (no `neutral-*`).
- Owner step (deferred until BLOB_READ_WRITE_TOKEN exists): one real-AI smoke — scan a real garment, capture a real base photo, render one try-on, save it.
