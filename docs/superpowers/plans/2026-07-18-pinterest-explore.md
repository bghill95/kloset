# Pinterest-Powered Explore Feed Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Pexels-backed Explore feed with the user's own Pinterest board pins — OAuth connect in Settings, board picker, DB-cached pins with staleness auto-sync + manual sync, and search over the cached pins.

**Architecture:** A new `lib/explore/pinterest.ts` client (OAuth + reads + mock mode) feeds a `pinterest_pins` DB cache via `lib/explore/sync.ts`. `/api/explore` serves pages from the cache (seeded shuffle for browse, filter for search) through a pure `lib/explore/feed.ts`. The `pins` (hearts) table goes source-agnostic. Pexels code is deleted at the end.

**Tech Stack:** Next.js 16 App Router, Drizzle + Neon, Vitest, Playwright. Pinterest API v5 (scopes `boards:read,pins:read`, Trial tier).

## Global Constraints

- Never read env vars or construct external clients at module scope — lazy reads inside functions (CLAUDE.md learned rule).
- Every `await req.json()` wrapped in try/catch returning 400 (CLAUDE.md learned rule).
- Mock mode: `MOCK_AI === "1" && !process.env.PINTEREST_APP_ID` — a real app id overrides MOCK_AI (same convention Pexels had). All unit/e2e tests run keyless.
- New env vars (`PINTEREST_APP_ID`, `PINTEREST_APP_SECRET`) also go in `.env.example`; `.env.local` never committed.
- UI uses DESIGN.md tokens only (existing classNames are copied from neighboring components — reuse them).
- Done bar: `npm test && npm run typecheck && npm run test:e2e` all green. **Kill any manually-started dev server before e2e** (learned rule) and restart it after (`npm run dev`; tailscale serve config persists).
- Pinterest pin IDs are numeric strings that can exceed 2^53 — always `text`, never number.
- Commits: conventional style, end body with the Co-Authored-By + Claude-Session trailer used in this repo.

## Shared type vocabulary (defined in Task 2, used everywhere)

```ts
// lib/explore/pinterest.ts
export type Pin = {
  source: "pexels" | "pinterest";
  externalId: string;
  width: number;
  height: number;
  alt: string;        // pinterest: title || description
  credit: string;     // pinterest: board name; pexels: photographer
  creditUrl: string;  // pexels: photographer url; pinterest: ""
  sourceUrl: string;  // link to the pin/photo on its source site
  imageUrl: string;
};
export type SavedPin = Pin & { id: string };            // pins-table row (id = our uuid)
export type FeedPage = { pins: Pin[]; hasMore: boolean };
export type Board = { id: string; name: string };
export type BoardPin = {                                 // pinterest_pins insert shape
  id: string; boardId: string; boardName: string;
  title: string; description: string; link: string;
  imageUrl: string; width: number; height: number; savedAt: Date | null;
};
```

DB column mapping for hearts (`pins` table keeps its legacy column names): `credit`↔`photographer`, `creditUrl`↔`photographer_url`, `sourceUrl`↔`pexels_url`.

---

### Task 1: Schema — `pinterest_pins` cache table + source-agnostic `pins`

**Files:**
- Modify: `lib/db/schema.ts` (pins table + new pinterestPins table)
- Modify: `e2e/global-setup.ts` (mirror both; add wipe)
- Modify: `CLAUDE.md` (e2e wipe lists in Commands + Rules sections)

**Interfaces:**
- Produces: `pinterestPins` and reshaped `pins` Drizzle tables consumed by Tasks 5–6.

- [ ] **Step 1: Reshape `pins` and add `pinterestPins` in `lib/db/schema.ts`**

Replace the existing `pins` export (and its comment) with:

```ts
// Saved Explore pins (hearted from the feed). Stored denormalized so the
// Saved view renders without re-querying the source; unique (source,
// external_id) makes the heart a clean save/unsave toggle. Column names
// photographer/photographer_url/pexels_url are legacy Pexels-era names —
// they now hold credit/credit_url/source_url for any source.
export const pins = pgTable(
  "pins",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    source: text("source", { enum: ["pexels", "pinterest"] })
      .notNull()
      .default("pexels"),
    externalId: text("external_id").notNull(),
    // ponytail: dead Pexels-era column — kept nullable to avoid drizzle-kit
    // rename prompts on push; drop manually whenever convenient.
    pexelsId: bigint("pexels_id", { mode: "number" }),
    imageUrl: text("image_url").notNull(),
    alt: text("alt").notNull().default(""),
    photographer: text("photographer").notNull().default(""),
    photographerUrl: text("photographer_url").notNull().default(""),
    pexelsUrl: text("pexels_url").notNull().default(""),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [unique("pins_source_external_id_unique").on(t.source, t.externalId)],
);

// Cache of pins pulled from the user's selected Pinterest boards. Replaced
// wholesale per board on each sync; the Explore feed reads only this table.
export const pinterestPins = pgTable("pinterest_pins", {
  id: text("id").primaryKey(), // Pinterest pin id — numeric string, can exceed 2^53
  boardId: text("board_id").notNull(),
  boardName: text("board_name").notNull().default(""),
  title: text("title").notNull().default(""),
  description: text("description").notNull().default(""),
  link: text("link").notNull().default(""),
  imageUrl: text("image_url").notNull(),
  width: integer("width").notNull(),
  height: integer("height").notNull(),
  savedAt: timestamp("saved_at"),
  syncedAt: timestamp("synced_at").notNull().defaultNow(),
});
```

- [ ] **Step 2: Mirror in `e2e/global-setup.ts`**

Replace the `pins` CREATE with, and add `pinterest_pins` after it:

```ts
  // Keep in sync with lib/db/schema.ts
  await sql`CREATE TABLE IF NOT EXISTS pins (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    source text NOT NULL DEFAULT 'pexels',
    external_id text NOT NULL,
    pexels_id bigint,
    image_url text NOT NULL,
    alt text NOT NULL DEFAULT '',
    photographer text NOT NULL DEFAULT '',
    photographer_url text NOT NULL DEFAULT '',
    pexels_url text NOT NULL DEFAULT '',
    width integer NOT NULL,
    height integer NOT NULL,
    created_at timestamp NOT NULL DEFAULT now(),
    CONSTRAINT pins_source_external_id_unique UNIQUE (source, external_id)
  )`;
  // Keep in sync with lib/db/schema.ts
  await sql`CREATE TABLE IF NOT EXISTS pinterest_pins (
    id text PRIMARY KEY,
    board_id text NOT NULL,
    board_name text NOT NULL DEFAULT '',
    title text NOT NULL DEFAULT '',
    description text NOT NULL DEFAULT '',
    link text NOT NULL DEFAULT '',
    image_url text NOT NULL,
    width integer NOT NULL,
    height integer NOT NULL,
    saved_at timestamp,
    synced_at timestamp NOT NULL DEFAULT now()
  )`;
```

Add to the wipe block at the bottom (after `DELETE FROM pins`):

```ts
  await sql`DELETE FROM pinterest_pins`;
```

- [ ] **Step 3: Clear disposable pins rows, then push**

The live table holds only e2e junk (per HANDOFF.md) and the NOT NULL `external_id` addition needs an empty table:

```bash
node -e "require('dotenv').config({path:'.env.local'}); const {neon}=require('@neondatabase/serverless'); const sql=neon(process.env.DATABASE_URL); sql\`DELETE FROM pins\`.then(r=>console.log('pins cleared'))"
npm run db:push
```

Expected: push succeeds. Ignore the known re-emitted `wears` DROP/ADD CONSTRAINT churn and `'{}'::text[]` defaults (learned rules); the new `pins_source_external_id_unique` may join that churn on future pushes — also expected.

- [ ] **Step 4: Update CLAUDE.md wipe lists**

In both the `test:e2e` command line and the Rules bullet, change the table list to: `settings, items, base_photos, outfits, wears, pins, pinterest_pins, preferences and trips`.

- [ ] **Step 5: Compatibility shims so every commit typechecks**

Two files still use the old columns; give them minimal shims (both are rewritten properly in Tasks 6–7):

In `app/(tabs)/explore/page.tsx`, the mapper line becomes:

```ts
    pexelsId: r.pexelsId ?? 0, // shim until Task 7 switches to savedRowToPin
```

In `app/api/pins/route.ts`, the insert gains the now-required externalId:

```ts
  const [row] = await db
    .insert(pins)
    .values({ ...pin, externalId: String(pin.pexelsId) }) // shim until Task 6 rewrites this route
    .onConflictDoNothing()
    .returning();
```

- [ ] **Step 6: Typecheck and commit**

```bash
npm run typecheck
git add lib/db/schema.ts e2e/global-setup.ts CLAUDE.md "app/(tabs)/explore/page.tsx" app/api/pins/route.ts
git commit -m "feat(explore): pinterest_pins cache table; pins table goes source-agnostic"
```

---

### Task 2: Pinterest client — types, parsers, mock data (TDD)

**Files:**
- Create: `lib/explore/pinterest.ts`
- Test: `lib/explore/pinterest.test.ts`

**Interfaces:**
- Produces: the **Shared type vocabulary** above, plus:
  - `parseBoardsResponse(raw: unknown): { boards: Board[]; bookmark: string | null }`
  - `parseBoardPinsResponse(raw: unknown, board: Board): { pins: BoardPin[]; bookmark: string | null }`
  - `MOCK_BOARDS: Board[]` — `[{id:"mockboard1",name:"Street Style"},{id:"mockboard2",name:"Parisian Chic"}]`
  - `mockBoardPins(board: Board): BoardPin[]` — 45 deterministic pins per board
  - `isPinterestMock(): boolean`

- [ ] **Step 1: Write the failing tests** (`lib/explore/pinterest.test.ts`)

```ts
import { afterEach, describe, expect, it } from "vitest";
import {
  MOCK_BOARDS,
  isPinterestMock,
  mockBoardPins,
  parseBoardPinsResponse,
  parseBoardsResponse,
} from "./pinterest";

const BOARD = { id: "b1", name: "Fits" };

describe("parseBoardsResponse", () => {
  it("maps items and passes the bookmark through", () => {
    const out = parseBoardsResponse({
      items: [{ id: "123", name: "Fall fits" }, { id: "456", name: "Paris" }],
      bookmark: "abc",
    });
    expect(out.boards).toEqual([
      { id: "123", name: "Fall fits" },
      { id: "456", name: "Paris" },
    ]);
    expect(out.bookmark).toBe("abc");
  });

  it("drops malformed entries and tolerates garbage", () => {
    const out = parseBoardsResponse({ items: [{ id: 5 }, null, { id: "9", name: "ok" }] });
    expect(out.boards).toEqual([{ id: "9", name: "ok" }]);
    expect(out.bookmark).toBeNull();
    expect(parseBoardsResponse(null)).toEqual({ boards: [], bookmark: null });
  });
});

describe("parseBoardPinsResponse", () => {
  const item = {
    id: "1104578219333637375", // > 2^53 — must stay a string
    created_at: "2026-07-01T10:00:00",
    title: "Linen set",
    description: "Summer look",
    link: "https://www.pinterest.com/pin/1104578219333637375/",
    media: {
      images: {
        "150x150": { width: 150, height: 150, url: "https://i.pinimg.com/150x150/a.jpg" },
        "1200x": { width: 1200, height: 1500, url: "https://i.pinimg.com/1200x/a.jpg" },
      },
    },
  };

  it("maps a pin picking the largest image and keeps the id a string", () => {
    const out = parseBoardPinsResponse({ items: [item], bookmark: null }, BOARD);
    expect(out.pins).toHaveLength(1);
    const p = out.pins[0];
    expect(p.id).toBe("1104578219333637375");
    expect(p.boardId).toBe("b1");
    expect(p.boardName).toBe("Fits");
    expect(p.title).toBe("Linen set");
    expect(p.imageUrl).toBe("https://i.pinimg.com/1200x/a.jpg");
    expect(p.width).toBe(1200);
    expect(p.height).toBe(1500);
    expect(p.savedAt).toEqual(new Date("2026-07-01T10:00:00"));
  });

  it("skips items with no usable image and tolerates garbage", () => {
    const noImage = { ...item, id: "2", media: { images: {} } };
    const out = parseBoardPinsResponse({ items: [noImage, "junk"] }, BOARD);
    expect(out.pins).toEqual([]);
    expect(parseBoardPinsResponse(undefined, BOARD)).toEqual({ pins: [], bookmark: null });
  });
});

describe("mockBoardPins", () => {
  it("is deterministic: 45 pins, titled by board, ids zero-padded for stable sort", () => {
    const pins = mockBoardPins(MOCK_BOARDS[1]);
    expect(pins).toHaveLength(45);
    expect(pins[0].id).toBe("mock-mockboard2-01");
    expect(pins[0].title).toBe("Mock pin Parisian Chic 1");
    expect(pins[0].imageUrl).toBe("/fixtures/pin-1.svg");
    expect(pins[4].imageUrl).toBe("/fixtures/pin-1.svg"); // 4 shapes cycle
    expect(mockBoardPins(MOCK_BOARDS[1])).toEqual(pins);
  });
});

describe("isPinterestMock", () => {
  const OLD = { MOCK_AI: process.env.MOCK_AI, PINTEREST_APP_ID: process.env.PINTEREST_APP_ID };
  afterEach(() => {
    // Assigning undefined to process.env coerces to the string "undefined" —
    // delete instead.
    if (OLD.MOCK_AI === undefined) delete process.env.MOCK_AI;
    else process.env.MOCK_AI = OLD.MOCK_AI;
    if (OLD.PINTEREST_APP_ID === undefined) delete process.env.PINTEREST_APP_ID;
    else process.env.PINTEREST_APP_ID = OLD.PINTEREST_APP_ID;
  });
  it("mocks only when MOCK_AI=1 and no app id", () => {
    process.env.MOCK_AI = "1";
    delete process.env.PINTEREST_APP_ID;
    expect(isPinterestMock()).toBe(true);
    process.env.PINTEREST_APP_ID = "real";
    expect(isPinterestMock()).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run lib/explore/pinterest.test.ts`
Expected: FAIL — cannot resolve `./pinterest`.

- [ ] **Step 3: Implement `lib/explore/pinterest.ts`**

```ts
export type Pin = {
  source: "pexels" | "pinterest";
  externalId: string;
  width: number;
  height: number;
  alt: string;
  credit: string;
  creditUrl: string;
  sourceUrl: string;
  imageUrl: string;
};

// A pin row persisted in the pins table (id = our uuid).
export type SavedPin = Pin & { id: string };

export type FeedPage = { pins: Pin[]; hasMore: boolean };

export type Board = { id: string; name: string };

// Insert shape for the pinterest_pins cache table.
export type BoardPin = {
  id: string;
  boardId: string;
  boardName: string;
  title: string;
  description: string;
  link: string;
  imageUrl: string;
  width: number;
  height: number;
  savedAt: Date | null;
};

export function isPinterestMock(): boolean {
  // Lazy env read (learned rule). A real app id wins over MOCK_AI so live
  // Pinterest can be smoke-tested while OpenAI/Blob stay mocked.
  return process.env.MOCK_AI === "1" && !process.env.PINTEREST_APP_ID;
}

// Tolerant mappers: drop malformed entries instead of failing the page.
export function parseBoardsResponse(raw: unknown): { boards: Board[]; bookmark: string | null } {
  if (typeof raw !== "object" || raw === null) return { boards: [], bookmark: null };
  const o = raw as Record<string, unknown>;
  const list = Array.isArray(o.items) ? o.items : [];
  const boards: Board[] = [];
  for (const entry of list) {
    if (typeof entry !== "object" || entry === null) continue;
    const b = entry as Record<string, unknown>;
    if (typeof b.id !== "string" || typeof b.name !== "string") continue;
    boards.push({ id: b.id, name: b.name });
  }
  return { boards, bookmark: typeof o.bookmark === "string" && o.bookmark ? o.bookmark : null };
}

export function parseBoardPinsResponse(
  raw: unknown,
  board: Board,
): { pins: BoardPin[]; bookmark: string | null } {
  if (typeof raw !== "object" || raw === null) return { pins: [], bookmark: null };
  const o = raw as Record<string, unknown>;
  const list = Array.isArray(o.items) ? o.items : [];
  const pins: BoardPin[] = [];
  for (const entry of list) {
    if (typeof entry !== "object" || entry === null) continue;
    const p = entry as Record<string, unknown>;
    if (typeof p.id !== "string") continue;
    const media = (typeof p.media === "object" && p.media !== null ? p.media : {}) as Record<
      string,
      unknown
    >;
    const images = (typeof media.images === "object" && media.images !== null
      ? media.images
      : {}) as Record<string, unknown>;
    // Pick the largest size variant with a usable url + dimensions.
    let best: { url: string; width: number; height: number } | null = null;
    for (const v of Object.values(images)) {
      if (typeof v !== "object" || v === null) continue;
      const img = v as Record<string, unknown>;
      if (
        typeof img.url !== "string" ||
        typeof img.width !== "number" ||
        typeof img.height !== "number" ||
        img.width <= 0 ||
        img.height <= 0
      )
        continue;
      if (!best || img.width > best.width)
        best = { url: img.url, width: img.width, height: img.height };
    }
    if (!best) continue;
    const savedAtMs = typeof p.created_at === "string" ? Date.parse(p.created_at) : NaN;
    pins.push({
      id: p.id,
      boardId: board.id,
      boardName: board.name,
      title: typeof p.title === "string" ? p.title : "",
      description: typeof p.description === "string" ? p.description : "",
      link:
        typeof p.link === "string" && p.link.startsWith("https://")
          ? p.link
          : `https://www.pinterest.com/pin/${p.id}/`,
      imageUrl: best.url,
      width: best.width,
      height: best.height,
      savedAt: Number.isFinite(savedAtMs) ? new Date(savedAtMs) : null,
    });
  }
  return { pins, bookmark: typeof o.bookmark === "string" && o.bookmark ? o.bookmark : null };
}

// ---------- mock mode ----------

export const MOCK_BOARDS: Board[] = [
  { id: "mockboard1", name: "Street Style" },
  { id: "mockboard2", name: "Parisian Chic" },
];

// Four placeholder shapes so the mock masonry has real height variety.
const MOCK_SHAPES = [
  { file: "/fixtures/pin-1.svg", width: 800, height: 1000 },
  { file: "/fixtures/pin-2.svg", width: 800, height: 1200 },
  { file: "/fixtures/pin-3.svg", width: 800, height: 800 },
  { file: "/fixtures/pin-4.svg", width: 800, height: 1400 },
];

// 45 per board → 90 total = exactly 3 feed pages. Ids zero-padded so
// lexicographic order matches numeric order (search results sort by id).
export function mockBoardPins(board: Board): BoardPin[] {
  return Array.from({ length: 45 }, (_, i) => {
    const shape = MOCK_SHAPES[i % MOCK_SHAPES.length];
    return {
      id: `mock-${board.id}-${String(i + 1).padStart(2, "0")}`,
      boardId: board.id,
      boardName: board.name,
      title: `Mock pin ${board.name} ${i + 1}`,
      description: "",
      link: "https://www.pinterest.com",
      imageUrl: shape.file,
      width: shape.width,
      height: shape.height,
      savedAt: null,
    };
  });
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npx vitest run lib/explore/pinterest.test.ts`
Expected: PASS (all describes).

- [ ] **Step 5: Commit**

```bash
git add lib/explore/pinterest.ts lib/explore/pinterest.test.ts
git commit -m "feat(explore): pinterest client types, parsers, and mock data"
```

---

### Task 3: OAuth + HTTP reads + connect routes

**Files:**
- Modify: `lib/explore/pinterest.ts` (append auth + fetch section)
- Create: `app/api/pinterest/auth/route.ts`
- Create: `app/api/pinterest/callback/route.ts`
- Test: `lib/explore/pinterest.test.ts` (append)

**Interfaces:**
- Consumes: `getSetting`/`setSetting`/`deleteSetting` from `lib/db/settings.ts`; parsers/mocks from Task 2.
- Produces:
  - `type PinterestAuth = { accessToken: string; refreshToken: string; accessExpiresAt: number; refreshExpiresAt: number }`
  - `needsRefresh(auth: PinterestAuth, now: number): boolean`
  - `parseTokenResponse(raw: unknown, now: number, prev?: PinterestAuth): PinterestAuth | null`
  - `exchangeCode(code: string, redirectUri: string): Promise<PinterestAuth>`
  - `getFreshAccessToken(): Promise<string | null>` (mock → `"mock-token"`)
  - `listBoards(token: string): Promise<Board[]>`
  - `listBoardPins(token: string, board: Board): Promise<BoardPin[]>`
  - `getAuthorizeUrl(state: string, redirectUri: string): string`
  - `requestOrigin(headers: Headers): string`
  - `PINTEREST_AUTH_KEY = "pinterestAuth"`

- [ ] **Step 1: Append failing tests** to `lib/explore/pinterest.test.ts`

```ts
import { needsRefresh, parseTokenResponse, type PinterestAuth } from "./pinterest";

describe("token lifecycle", () => {
  const NOW = 1_800_000_000_000;
  const AUTH: PinterestAuth = {
    accessToken: "a",
    refreshToken: "r",
    accessExpiresAt: NOW + 60 * 60_000,
    refreshExpiresAt: NOW + 1000 * 60_000,
  };

  it("needsRefresh only inside the 5-minute margin", () => {
    expect(needsRefresh(AUTH, NOW)).toBe(false);
    expect(needsRefresh({ ...AUTH, accessExpiresAt: NOW + 2 * 60_000 }, NOW)).toBe(true);
    expect(needsRefresh({ ...AUTH, accessExpiresAt: NOW - 1 }, NOW)).toBe(true);
  });

  it("parseTokenResponse maps a code-exchange response", () => {
    const out = parseTokenResponse(
      { access_token: "at", refresh_token: "rt", expires_in: 2592000, refresh_token_expires_in: 31536000 },
      NOW,
    );
    expect(out).toEqual({
      accessToken: "at",
      refreshToken: "rt",
      accessExpiresAt: NOW + 2592000 * 1000,
      refreshExpiresAt: NOW + 31536000 * 1000,
    });
  });

  it("carries the previous refresh token when the refresh grant omits it", () => {
    const out = parseTokenResponse({ access_token: "at2", expires_in: 100 }, NOW, AUTH);
    expect(out?.refreshToken).toBe("r");
    expect(out?.refreshExpiresAt).toBe(AUTH.refreshExpiresAt);
  });

  it("rejects malformed responses", () => {
    expect(parseTokenResponse({ access_token: "x" }, NOW)).toBeNull();
    expect(parseTokenResponse(null, NOW)).toBeNull();
    expect(parseTokenResponse({ access_token: "x", expires_in: 5 }, NOW)).toBeNull(); // no refresh token anywhere
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run lib/explore/pinterest.test.ts`
Expected: FAIL — `needsRefresh` not exported.

- [ ] **Step 3: Append the auth + fetch section to `lib/explore/pinterest.ts`**

```ts
// ---------- OAuth ----------

import { getSetting, setSetting } from "@/lib/db/settings";

export type PinterestAuth = {
  accessToken: string;
  refreshToken: string;
  accessExpiresAt: number; // epoch ms
  refreshExpiresAt: number; // epoch ms
};

export const PINTEREST_AUTH_KEY = "pinterestAuth";
const TOKEN_URL = "https://api.pinterest.com/v5/oauth/token";
const API_BASE = "https://api.pinterest.com/v5";
const REFRESH_MARGIN_MS = 5 * 60_000;

export function needsRefresh(auth: PinterestAuth, now: number): boolean {
  return auth.accessExpiresAt - now < REFRESH_MARGIN_MS;
}

// prev carries the old refresh token forward — Pinterest omits refresh_token
// from refresh-grant responses unless rotation is enabled.
export function parseTokenResponse(
  raw: unknown,
  now: number,
  prev?: PinterestAuth,
): PinterestAuth | null {
  if (typeof raw !== "object" || raw === null) return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.access_token !== "string" || typeof o.expires_in !== "number") return null;
  const refreshToken = typeof o.refresh_token === "string" ? o.refresh_token : prev?.refreshToken;
  if (!refreshToken) return null;
  const refreshExpiresAt =
    typeof o.refresh_token_expires_in === "number"
      ? now + o.refresh_token_expires_in * 1000
      : (prev?.refreshExpiresAt ?? now + 365 * 24 * 3600 * 1000);
  return {
    accessToken: o.access_token,
    refreshToken,
    accessExpiresAt: now + o.expires_in * 1000,
    refreshExpiresAt,
  };
}

async function tokenRequest(body: URLSearchParams, prev?: PinterestAuth): Promise<PinterestAuth> {
  const id = process.env.PINTEREST_APP_ID;
  const secret = process.env.PINTEREST_APP_SECRET;
  if (!id || !secret) throw new Error("PINTEREST_APP_ID / PINTEREST_APP_SECRET is not set");
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Pinterest token request failed: ${res.status}`);
  const auth = parseTokenResponse(await res.json(), Date.now(), prev);
  if (!auth) throw new Error("Pinterest token response malformed");
  return auth;
}

export function exchangeCode(code: string, redirectUri: string): Promise<PinterestAuth> {
  return tokenRequest(
    new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: redirectUri }),
  );
}

function refreshAuth(prev: PinterestAuth): Promise<PinterestAuth> {
  return tokenRequest(
    new URLSearchParams({ grant_type: "refresh_token", refresh_token: prev.refreshToken }),
    prev,
  );
}

// Null means "not connected" — callers treat that as an empty feed, not an error.
export async function getFreshAccessToken(): Promise<string | null> {
  if (isPinterestMock()) return "mock-token";
  const raw = await getSetting(PINTEREST_AUTH_KEY);
  if (!raw) return null;
  let auth: PinterestAuth;
  try {
    auth = JSON.parse(raw) as PinterestAuth;
  } catch {
    return null;
  }
  if (!needsRefresh(auth, Date.now())) return auth.accessToken;
  const next = await refreshAuth(auth);
  await setSetting(PINTEREST_AUTH_KEY, JSON.stringify(next));
  return next.accessToken;
}

export function getAuthorizeUrl(state: string, redirectUri: string): string {
  const id = process.env.PINTEREST_APP_ID;
  if (!id) throw new Error("PINTEREST_APP_ID is not set");
  const p = new URLSearchParams({
    client_id: id,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "boards:read,pins:read",
    state,
  });
  return `https://www.pinterest.com/oauth/?${p}`;
}

// Origin as the browser saw it — behind `tailscale serve` the request arrives
// via a localhost proxy, so trust forwarded headers first.
export function requestOrigin(headers: Headers): string {
  const host = headers.get("x-forwarded-host") ?? headers.get("host") ?? "localhost:4100";
  const proto = headers.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

// ---------- reads ----------

async function pinterestGet(path: string, token: string): Promise<unknown> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Pinterest GET ${path} failed: ${res.status}`);
  return res.json();
}

// ponytail: 20 pages × 100 = 2000 pins/board ceiling; raise if a board tops it.
const MAX_PAGES = 20;

export async function listBoards(token: string): Promise<Board[]> {
  if (isPinterestMock()) return MOCK_BOARDS;
  const boards: Board[] = [];
  let bookmark: string | null = null;
  for (let i = 0; i < MAX_PAGES; i++) {
    const qs = new URLSearchParams({ page_size: "100" });
    if (bookmark) qs.set("bookmark", bookmark);
    const parsed = parseBoardsResponse(await pinterestGet(`/boards?${qs}`, token));
    boards.push(...parsed.boards);
    bookmark = parsed.bookmark;
    if (!bookmark) break;
  }
  return boards;
}

export async function listBoardPins(token: string, board: Board): Promise<BoardPin[]> {
  if (isPinterestMock()) return mockBoardPins(board);
  const pins: BoardPin[] = [];
  let bookmark: string | null = null;
  for (let i = 0; i < MAX_PAGES; i++) {
    const qs = new URLSearchParams({ page_size: "100" });
    if (bookmark) qs.set("bookmark", bookmark);
    const parsed = parseBoardPinsResponse(
      await pinterestGet(`/boards/${board.id}/pins?${qs}`, token),
      board,
    );
    pins.push(...parsed.pins);
    bookmark = parsed.bookmark;
    if (!bookmark) break;
  }
  return pins;
}
```

(Note: the `import { getSetting, setSetting }` line goes at the TOP of the file with a normal import, not mid-file — shown here inline only to indicate it's newly needed.)

- [ ] **Step 4: Run tests to verify pass**

Run: `npx vitest run lib/explore/pinterest.test.ts`
Expected: PASS.

- [ ] **Step 5: Create `app/api/pinterest/auth/route.ts`**

```ts
// app/api/pinterest/auth/route.ts
import { NextRequest, NextResponse } from "next/server";
import { deleteSetting } from "@/lib/db/settings";
import {
  PINTEREST_AUTH_KEY,
  getAuthorizeUrl,
  isPinterestMock,
  requestOrigin,
} from "@/lib/explore/pinterest";

// Kicks off the OAuth dance. In mock mode there is nothing to connect —
// bounce straight back to Settings.
export async function GET(req: NextRequest) {
  const origin = requestOrigin(req.headers);
  if (isPinterestMock()) return NextResponse.redirect(new URL("/settings", origin));
  const state = crypto.randomUUID();
  const res = NextResponse.redirect(
    getAuthorizeUrl(state, `${origin}/api/pinterest/callback`),
  );
  res.cookies.set("pinterest_state", state, { httpOnly: true, maxAge: 600, path: "/" });
  return res;
}

// Disconnect: forget the tokens. Cached pins stay until the next sync.
export async function DELETE() {
  await deleteSetting(PINTEREST_AUTH_KEY);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 6: Create `app/api/pinterest/callback/route.ts`**

```ts
// app/api/pinterest/callback/route.ts
import { NextRequest, NextResponse } from "next/server";
import { setSetting } from "@/lib/db/settings";
import { PINTEREST_AUTH_KEY, exchangeCode, requestOrigin } from "@/lib/explore/pinterest";

export async function GET(req: NextRequest) {
  const origin = requestOrigin(req.headers);
  const fail = (msg: string) =>
    NextResponse.redirect(new URL(`/settings?pinterest_error=${encodeURIComponent(msg)}`, origin));
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const cookieState = req.cookies.get("pinterest_state")?.value;
  if (!code || !state || !cookieState || state !== cookieState) {
    return fail("Pinterest connect failed — try again.");
  }
  try {
    const auth = await exchangeCode(code, `${origin}/api/pinterest/callback`);
    await setSetting(PINTEREST_AUTH_KEY, JSON.stringify(auth));
  } catch (err) {
    console.error("[pinterest] token exchange failed:", err);
    return fail("Pinterest connect failed — try again.");
  }
  const res = NextResponse.redirect(new URL("/settings", origin));
  res.cookies.delete("pinterest_state");
  return res;
}
```

- [ ] **Step 7: Typecheck + full unit suite, commit**

```bash
npm run typecheck && npm test
git add lib/explore/pinterest.ts lib/explore/pinterest.test.ts app/api/pinterest
git commit -m "feat(explore): pinterest oauth, token refresh, and board/pin reads"
```

---

### Task 4: Pure feed lib — shuffle/paginate/search + row mappers (TDD)

**Files:**
- Create: `lib/explore/feed.ts`
- Test: `lib/explore/feed.test.ts`

**Interfaces:**
- Consumes: `Pin`, `FeedPage`, `SavedPin` from `lib/explore/pinterest.ts`; `pinterestPins`, `pins` schema types.
- Produces:
  - `PER_PAGE = 30`
  - `pageFeed(all: Pin[], page: number, seed: number, q?: string): FeedPage`
  - `rowToPin(r: typeof pinterestPins.$inferSelect): Pin`
  - `savedRowToPin(r: typeof pins.$inferSelect): SavedPin`

- [ ] **Step 1: Write the failing tests** (`lib/explore/feed.test.ts`)

```ts
import { describe, expect, it } from "vitest";
import type { Pin } from "./pinterest";
import { PER_PAGE, pageFeed, rowToPin, savedRowToPin } from "./feed";

function pin(n: number, alt = `pin ${n}`, credit = "Board A"): Pin {
  return {
    source: "pinterest",
    externalId: String(n).padStart(3, "0"),
    width: 800,
    height: 1000,
    alt,
    credit,
    creditUrl: "",
    sourceUrl: "https://www.pinterest.com",
    imageUrl: "/fixtures/pin-1.svg",
  };
}
const NINETY = Array.from({ length: 90 }, (_, i) => pin(i + 1));

describe("pageFeed", () => {
  it("pages 90 pins as 3 pages of PER_PAGE", () => {
    const p1 = pageFeed(NINETY, 1, 7);
    const p3 = pageFeed(NINETY, 3, 7);
    expect(p1.pins).toHaveLength(PER_PAGE);
    expect(p1.hasMore).toBe(true);
    expect(p3.pins).toHaveLength(PER_PAGE);
    expect(p3.hasMore).toBe(false);
    expect(pageFeed(NINETY, 4, 7).pins).toHaveLength(0);
  });

  it("same seed reproduces the shuffle; a different seed changes it", () => {
    const a = pageFeed(NINETY, 1, 42).pins.map((p) => p.externalId);
    const b = pageFeed(NINETY, 1, 42).pins.map((p) => p.externalId);
    const c = pageFeed(NINETY, 1, 43).pins.map((p) => p.externalId);
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });

  it("search filters by alt and board name, case-insensitive, preserving order", () => {
    const all = [pin(1, "Linen set"), pin(2, "Denim", "Parisian Chic"), pin(3, "linen dress")];
    expect(pageFeed(all, 1, 1, "LINEN").pins.map((p) => p.externalId)).toEqual(["001", "003"]);
    expect(pageFeed(all, 1, 1, "parisian").pins.map((p) => p.externalId)).toEqual(["002"]);
    expect(pageFeed(all, 1, 1, "nope").pins).toEqual([]);
  });
});

describe("row mappers", () => {
  it("rowToPin maps a cache row, falling back to description for alt", () => {
    const p = rowToPin({
      id: "9",
      boardId: "b",
      boardName: "Fits",
      title: "",
      description: "desc",
      link: "https://www.pinterest.com/pin/9/",
      imageUrl: "https://i.pinimg.com/x.jpg",
      width: 10,
      height: 20,
      savedAt: null,
      syncedAt: new Date(),
    });
    expect(p).toEqual({
      source: "pinterest",
      externalId: "9",
      width: 10,
      height: 20,
      alt: "desc",
      credit: "Fits",
      creditUrl: "",
      sourceUrl: "https://www.pinterest.com/pin/9/",
      imageUrl: "https://i.pinimg.com/x.jpg",
    });
  });

  it("savedRowToPin maps the legacy column names", () => {
    const p = savedRowToPin({
      id: "uuid-1",
      source: "pinterest",
      externalId: "9",
      pexelsId: null,
      imageUrl: "/x.jpg",
      alt: "a",
      photographer: "Fits",
      photographerUrl: "",
      pexelsUrl: "https://www.pinterest.com/pin/9/",
      width: 1,
      height: 2,
      createdAt: new Date(),
    });
    expect(p.id).toBe("uuid-1");
    expect(p.credit).toBe("Fits");
    expect(p.sourceUrl).toBe("https://www.pinterest.com/pin/9/");
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run lib/explore/feed.test.ts`
Expected: FAIL — cannot resolve `./feed`.

- [ ] **Step 3: Implement `lib/explore/feed.ts`**

```ts
import type { pins, pinterestPins } from "@/lib/db/schema";
import type { FeedPage, Pin, SavedPin } from "./pinterest";

export const PER_PAGE = 30;

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

// Browse mode shuffles by seed (the Shuffle button rerolls it); search keeps
// the caller's order (savedAt desc from the route) so results are stable.
export function pageFeed(all: Pin[], page: number, seed: number, q?: string): FeedPage {
  let list: Pin[];
  if (q) {
    const needle = q.toLowerCase();
    list = all.filter(
      (p) => p.alt.toLowerCase().includes(needle) || p.credit.toLowerCase().includes(needle),
    );
  } else {
    list = [...all];
    const rand = rng(seed);
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
  }
  const start = (page - 1) * PER_PAGE;
  return { pins: list.slice(start, start + PER_PAGE), hasMore: start + PER_PAGE < list.length };
}

export function rowToPin(r: typeof pinterestPins.$inferSelect): Pin {
  return {
    source: "pinterest",
    externalId: r.id,
    width: r.width,
    height: r.height,
    alt: r.title || r.description,
    credit: r.boardName,
    creditUrl: "",
    sourceUrl: r.link,
    imageUrl: r.imageUrl,
  };
}

export function savedRowToPin(r: typeof pins.$inferSelect): SavedPin {
  return {
    id: r.id,
    source: r.source,
    externalId: r.externalId,
    width: r.width,
    height: r.height,
    alt: r.alt,
    credit: r.photographer,
    creditUrl: r.photographerUrl,
    sourceUrl: r.pexelsUrl,
    imageUrl: r.imageUrl,
  };
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npx vitest run lib/explore/feed.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/explore/feed.ts lib/explore/feed.test.ts
git commit -m "feat(explore): pure feed paging/shuffle/search and row mappers"
```

---

### Task 5: Sync engine + board/sync API routes (TDD on pure parts)

**Files:**
- Create: `lib/explore/sync.ts`
- Create: `app/api/pinterest/sync/route.ts`
- Create: `app/api/pinterest/boards/route.ts`
- Modify: `lib/explore/validation.ts` (add `validateBoardsBody`)
- Test: `lib/explore/sync.test.ts`, `lib/explore/validation.test.ts` (append)

**Interfaces:**
- Consumes: Task 3's `getFreshAccessToken`/`listBoards`/`listBoardPins`/`MOCK_BOARDS`/`isPinterestMock`; `pinterestPins` table; settings helpers.
- Produces:
  - `PINTEREST_BOARDS_KEY = "pinterestBoards"`, `PINTEREST_SYNCED_KEY = "pinterestSyncedAt"`
  - `isStale(syncedAtRaw: string | null, now: number): boolean` (1-hour TTL)
  - `getSelectedBoards(): Promise<Board[]>` (mock defaults to `MOCK_BOARDS` when unset)
  - `syncPinterest(): Promise<{ synced: boolean; pinCount: number }>`
  - `syncIfStale(): Promise<void>`
  - `validateBoardsBody(raw: unknown): Result<Board[]>`

- [ ] **Step 1: Write failing tests**

`lib/explore/sync.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { isStale } from "./sync";

describe("isStale", () => {
  const NOW = 1_800_000_000_000;
  it("null, garbage, and >1h-old stamps are stale", () => {
    expect(isStale(null, NOW)).toBe(true);
    expect(isStale("not-a-number", NOW)).toBe(true);
    expect(isStale(String(NOW - 61 * 60_000), NOW)).toBe(true);
  });
  it("a fresh stamp is not stale", () => {
    expect(isStale(String(NOW - 59 * 60_000), NOW)).toBe(false);
  });
});
```

Append to `lib/explore/validation.test.ts`:

```ts
import { validateBoardsBody } from "./validation";

describe("validateBoardsBody", () => {
  it("accepts a boards array and trims names", () => {
    const out = validateBoardsBody({ boards: [{ id: "1", name: "  Fits " }] });
    expect(out).toEqual({ ok: true, value: [{ id: "1", name: "Fits" }] });
  });
  it("rejects non-arrays, bad entries, and oversized lists", () => {
    expect(validateBoardsBody({}).ok).toBe(false);
    expect(validateBoardsBody({ boards: [{ id: 1, name: "x" }] }).ok).toBe(false);
    expect(validateBoardsBody({ boards: [{ id: "", name: "x" }] }).ok).toBe(false);
    expect(
      validateBoardsBody({ boards: Array.from({ length: 51 }, (_, i) => ({ id: String(i), name: "b" })) }).ok,
    ).toBe(false);
  });
});
```

(If `validation.test.ts` doesn't already import `describe/expect/it` from vitest at top, extend the existing import.)

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run lib/explore/sync.test.ts lib/explore/validation.test.ts`
Expected: FAIL — `./sync` unresolved; `validateBoardsBody` not exported.

- [ ] **Step 3: Implement**

Add to `lib/explore/validation.ts`:

```ts
import type { Board } from "./pinterest"; // add alongside the existing imports

const MAX_BOARDS = 50;
const MAX_ID = 100;
const MAX_NAME = 100;

export function validateBoardsBody(raw: unknown): Result<Board[]> {
  if (typeof raw !== "object" || raw === null) {
    return { ok: false, error: "Body must be an object." };
  }
  const list = (raw as Record<string, unknown>).boards;
  if (!Array.isArray(list) || list.length > MAX_BOARDS) {
    return { ok: false, error: `boards must be an array of at most ${MAX_BOARDS}.` };
  }
  const boards: Board[] = [];
  for (const entry of list) {
    if (typeof entry !== "object" || entry === null) {
      return { ok: false, error: "Each board must be an object." };
    }
    const b = entry as Record<string, unknown>;
    if (typeof b.id !== "string" || b.id.length === 0 || b.id.length > MAX_ID) {
      return { ok: false, error: "Each board needs a non-empty string id." };
    }
    if (typeof b.name !== "string") {
      return { ok: false, error: "Each board needs a non-empty name." };
    }
    const name = b.name.trim();
    if (name.length === 0 || name.length > MAX_NAME) {
      return { ok: false, error: "Each board needs a non-empty name." };
    }
    boards.push({ id: b.id, name });
  }
  return { ok: true, value: boards };
}
```

(Note `validation.ts` still imports `Pin` from `./pexels` until Task 6 switches it.)

Create `lib/explore/sync.ts`:

```ts
import { getDb } from "@/lib/db/client";
import { pinterestPins } from "@/lib/db/schema";
import { getSetting, setSetting } from "@/lib/db/settings";
import {
  type Board,
  type BoardPin,
  MOCK_BOARDS,
  getFreshAccessToken,
  isPinterestMock,
  listBoardPins,
} from "./pinterest";

export const PINTEREST_BOARDS_KEY = "pinterestBoards";
export const PINTEREST_SYNCED_KEY = "pinterestSyncedAt";
const STALE_MS = 60 * 60_000; // auto re-sync when the cache is older than 1h

export function isStale(syncedAtRaw: string | null, now: number): boolean {
  if (!syncedAtRaw) return true;
  const t = Number(syncedAtRaw);
  return !Number.isFinite(t) || now - t > STALE_MS;
}

export async function getSelectedBoards(): Promise<Board[]> {
  const raw = await getSetting(PINTEREST_BOARDS_KEY);
  if (!raw) return isPinterestMock() ? MOCK_BOARDS : [];
  try {
    const list = JSON.parse(raw) as unknown;
    if (!Array.isArray(list)) return [];
    return list.filter(
      (b): b is Board =>
        typeof b === "object" &&
        b !== null &&
        typeof (b as Board).id === "string" &&
        typeof (b as Board).name === "string",
    );
  } catch {
    return [];
  }
}

export async function syncPinterest(): Promise<{ synced: boolean; pinCount: number }> {
  const token = await getFreshAccessToken();
  const boards = await getSelectedBoards();
  if (!token || boards.length === 0) return { synced: false, pinCount: 0 };
  // Fetch everything BEFORE touching the DB — a network failure mid-sync
  // leaves the old cache fully intact (isStale retries on the next feed load).
  const byId = new Map<string, BoardPin>();
  for (const board of boards) {
    for (const pin of await listBoardPins(token, board)) {
      if (!byId.has(pin.id)) byId.set(pin.id, pin);
    }
  }
  const all = [...byId.values()];
  const db = getDb();
  // Full replace: deselected boards, deleted pins, and moved pins all drop
  // out together — no stale boardId rows can survive a sync.
  await db.delete(pinterestPins);
  for (let i = 0; i < all.length; i += 500) {
    await db.insert(pinterestPins).values(all.slice(i, i + 500));
  }
  await setSetting(PINTEREST_SYNCED_KEY, String(Date.now()));
  return { synced: true, pinCount: all.length };
}

export async function syncIfStale(): Promise<void> {
  if (isStale(await getSetting(PINTEREST_SYNCED_KEY), Date.now())) await syncPinterest();
}
```

Create `app/api/pinterest/sync/route.ts`:

```ts
// app/api/pinterest/sync/route.ts
import { NextResponse } from "next/server";
import { syncPinterest } from "@/lib/explore/sync";

export async function POST() {
  try {
    const result = await syncPinterest();
    return NextResponse.json(result);
  } catch (err) {
    console.error("[pinterest] sync failed:", err);
    return NextResponse.json({ error: "Sync failed — try again." }, { status: 502 });
  }
}
```

Create `app/api/pinterest/boards/route.ts`:

```ts
// app/api/pinterest/boards/route.ts
import { NextRequest, NextResponse } from "next/server";
import { setSetting } from "@/lib/db/settings";
import { getFreshAccessToken, listBoards } from "@/lib/explore/pinterest";
import { PINTEREST_BOARDS_KEY, getSelectedBoards } from "@/lib/explore/sync";
import { validateBoardsBody } from "@/lib/explore/validation";

export async function GET() {
  // getFreshAccessToken throws on a refresh failure (transient) and returns
  // null only when not connected — keep it inside the try so a Pinterest
  // hiccup 502s with a friendly message instead of an unhandled 500.
  try {
    const token = await getFreshAccessToken();
    if (!token) {
      return NextResponse.json({ error: "Pinterest is not connected." }, { status: 401 });
    }
    const [boards, selected] = await Promise.all([listBoards(token), getSelectedBoards()]);
    return NextResponse.json({ boards, selectedIds: selected.map((b) => b.id) });
  } catch (err) {
    console.error("[pinterest] board list failed:", err);
    return NextResponse.json({ error: "Couldn't load boards — try again." }, { status: 502 });
  }
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const parsed = validateBoardsBody(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  await setSetting(PINTEREST_BOARDS_KEY, JSON.stringify(parsed.value));
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npx vitest run lib/explore/sync.test.ts lib/explore/validation.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck + commit**

```bash
npm run typecheck
git add lib/explore/sync.ts lib/explore/sync.test.ts lib/explore/validation.ts lib/explore/validation.test.ts app/api/pinterest
git commit -m "feat(explore): pinterest sync engine and board/sync routes"
```

---

### Task 6: Rewire /api/explore, /api/pins, and the Explore page to the cache

**Files:**
- Modify: `lib/explore/validation.ts` (rewrite `validatePinBody` for the new `Pin`)
- Modify: `lib/explore/validation.test.ts` (rewrite `validatePinBody` tests)
- Modify: `app/api/explore/route.ts` (full rewrite)
- Modify: `app/api/pins/route.ts` (toggle on source+externalId)
- Modify: `app/(tabs)/explore/page.tsx` (use `savedRowToPin`)

**Interfaces:**
- Consumes: `pageFeed`/`rowToPin`/`savedRowToPin`/`PER_PAGE` (Task 4), `syncIfStale` (Task 5), `Pin` from `./pinterest`.
- Produces: `/api/explore?page&seed&q` → `FeedPage`; `/api/pins` POST body = the new `Pin` shape, response `{saved, pin?: SavedPin}` (client shape unchanged otherwise).

- [ ] **Step 1: Rewrite the `validatePinBody` tests** in `lib/explore/validation.test.ts`

Replace every existing `validatePinBody` test with:

```ts
describe("validatePinBody", () => {
  const GOOD = {
    source: "pinterest",
    externalId: "1104578219333637375",
    width: 800,
    height: 1000,
    alt: "Linen set",
    credit: "Fits",
    creditUrl: "",
    sourceUrl: "https://www.pinterest.com/pin/1104578219333637375/",
    imageUrl: "https://i.pinimg.com/1200x/a.jpg",
  };

  it("accepts a valid pinterest pin", () => {
    const out = validatePinBody(GOOD);
    expect(out).toEqual({ ok: true, value: GOOD });
  });

  it("rejects bad source, empty externalId, and bad dimensions", () => {
    expect(validatePinBody({ ...GOOD, source: "tumblr" }).ok).toBe(false);
    expect(validatePinBody({ ...GOOD, externalId: "" }).ok).toBe(false);
    expect(validatePinBody({ ...GOOD, width: 0 }).ok).toBe(false);
    expect(validatePinBody({ ...GOOD, height: 1.5 }).ok).toBe(false);
    expect(validatePinBody(null).ok).toBe(false);
  });

  it("blanks non-https credit/source urls and requires a valid imageUrl", () => {
    const out = validatePinBody({ ...GOOD, creditUrl: "http://x", sourceUrl: "javascript:x" });
    expect(out.ok && out.value.creditUrl).toBe("");
    expect(out.ok && out.value.sourceUrl).toBe("");
    expect(validatePinBody({ ...GOOD, imageUrl: "http://plain" }).ok).toBe(false);
  });
});
```

(Keep the existing `validateFeedParams` tests untouched. Fixture mock pins use root-relative `/fixtures/...` image urls — `isImageUrl` already accepts root-relative, same as before.)

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run lib/explore/validation.test.ts`
Expected: FAIL — old implementation demands `pexelsId`.

- [ ] **Step 3: Rewrite `validatePinBody` in `lib/explore/validation.ts`**

Change the Pin import to `import type { Pin } from "./pinterest";` and replace the function:

```ts
export function validatePinBody(raw: unknown): Result<Pin> {
  if (typeof raw !== "object" || raw === null) {
    return { ok: false, error: "Body must be an object." };
  }
  const o = raw as Record<string, unknown>;
  if (o.source !== "pexels" && o.source !== "pinterest") {
    return { ok: false, error: "source must be pexels or pinterest." };
  }
  if (typeof o.externalId !== "string" || o.externalId.length === 0 || o.externalId.length > 100) {
    return { ok: false, error: "externalId must be a non-empty string." };
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
      source: o.source,
      externalId: o.externalId,
      width: o.width,
      height: o.height,
      alt: textOrBlank(o.alt),
      credit: textOrBlank(o.credit),
      creditUrl: httpsOrBlank(o.creditUrl),
      sourceUrl: httpsOrBlank(o.sourceUrl),
      imageUrl: o.imageUrl,
    },
  };
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npx vitest run lib/explore/validation.test.ts`
Expected: PASS.

- [ ] **Step 5: Rewrite `app/api/explore/route.ts`**

```ts
// app/api/explore/route.ts
import { asc, desc } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { pinterestPins } from "@/lib/db/schema";
import { pageFeed, rowToPin } from "@/lib/explore/feed";
import { syncIfStale } from "@/lib/explore/sync";
import { validateFeedParams } from "@/lib/explore/validation";

// The feed reads only the pinterest_pins cache. Browse pages are a seeded
// shuffle of the whole cache; a search (?q=) filters it (newest first).
export async function GET(req: NextRequest) {
  const parsed = validateFeedParams(req.nextUrl.searchParams);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const { page, seed, q } = parsed.value;

  try {
    await syncIfStale();
  } catch (err) {
    // Serve the stale cache rather than failing the feed.
    console.error("[explore] pinterest sync failed:", err);
  }

  const rows = await getDb()
    .select()
    .from(pinterestPins)
    .orderBy(desc(pinterestPins.savedAt), asc(pinterestPins.id));
  return NextResponse.json(pageFeed(rows.map(rowToPin), page, seed, q));
}
```

- [ ] **Step 6: Update `app/api/pins/route.ts`**

```ts
// app/api/pins/route.ts
import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { pins } from "@/lib/db/schema";
import { savedRowToPin } from "@/lib/explore/feed";
import { validatePinBody } from "@/lib/explore/validation";

// Toggle, like /api/wears: posting an already-saved pin unsaves it.
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
  const match = and(eq(pins.source, pin.source), eq(pins.externalId, pin.externalId));
  const values = {
    source: pin.source,
    externalId: pin.externalId,
    imageUrl: pin.imageUrl,
    alt: pin.alt,
    photographer: pin.credit,
    photographerUrl: pin.creditUrl,
    pexelsUrl: pin.sourceUrl,
    width: pin.width,
    height: pin.height,
  };
  const existing = await db.select().from(pins).where(match);
  if (existing.length > 0) {
    await db.delete(pins).where(match);
    return NextResponse.json({ saved: false });
  }
  const [row] = await db.insert(pins).values(values).onConflictDoNothing().returning();
  if (!row) {
    // Lost a double-click race — the concurrent request saved it first.
    const [raced] = await db.select().from(pins).where(match);
    if (!raced) return NextResponse.json({ saved: false });
    return NextResponse.json({ saved: true, pin: savedRowToPin(raced) });
  }
  return NextResponse.json({ saved: true, pin: savedRowToPin(row) }, { status: 201 });
}
```

- [ ] **Step 7: Full unit suite + typecheck**

Run: `npm test && npm run typecheck`
Expected: PASS. The components still compile against the old `Pin` from `./pexels` (untouched this task); `app/(tabs)/explore/page.tsx` still feeds them old-shape rows — the page and components switch together in Task 7 so every commit typechecks.

Note: after this task the explore feed *API* serves the new shape while the *page* still maps old columns — the two meet in Task 7; don't manually drive the UI in between.

- [ ] **Step 8: Commit**

```bash
git add lib/explore/validation.ts lib/explore/validation.test.ts app/api/explore/route.ts app/api/pins/route.ts
git commit -m "feat(explore): serve the feed and hearts from the pinterest cache"
```

---

### Task 7: UI — ExploreFeed + PinLightbox on the new Pin shape

**Files:**
- Modify: `components/explore/ExploreFeed.tsx`
- Modify: `components/explore/PinLightbox.tsx`
- Modify: `app/(tabs)/explore/page.tsx` (full rewrite — replaces the Task 1 shim)

**Interfaces:**
- Consumes: `Pin`, `SavedPin` from `@/lib/explore/pinterest`; `savedRowToPin` from `@/lib/explore/feed`.
- Produces: same component APIs; pins keyed by `externalId` (string) everywhere.

- [ ] **Step 0: Rewrite `app/(tabs)/explore/page.tsx`**

```ts
import { desc } from "drizzle-orm";
import ExploreFeed from "@/components/explore/ExploreFeed";
import PageHeader from "@/components/shell/PageHeader";
import { getDb } from "@/lib/db/client";
import { pins } from "@/lib/db/schema";
import { savedRowToPin } from "@/lib/explore/feed";

export const dynamic = "force-dynamic";

export default async function ExplorePage() {
  const rows = await getDb().select().from(pins).orderBy(desc(pins.createdAt));
  return (
    <>
      <PageHeader title="Explore" />
      <ExploreFeed savedPins={rows.map(savedRowToPin)} />
    </>
  );
}
```

- [ ] **Step 1: Update `components/explore/ExploreFeed.tsx`** — surgical diffs:

1. Import: `import type { Pin, SavedPin } from "@/lib/explore/pinterest";`
2. `isCached`: add a shape guard so a stale pre-migration sessionStorage cache is discarded:

```ts
  return (
    typeof c.seed === "number" &&
    typeof c.page === "number" &&
    typeof c.q === "string" &&
    typeof c.hasMore === "boolean" &&
    Array.isArray(c.pins) &&
    (c.pins.length === 0 ||
      typeof (c.pins[0] as Record<string, unknown>).externalId === "string")
  );
```

3. Saved map keys become strings:

```ts
  const [saved, setSaved] = useState<Map<string, SavedPin>>(
    () => new Map(savedPins.map((p) => [p.externalId, p])),
  );
```

4. In `loadPage`, dedup by `externalId`:

```ts
        const seen = new Set(current.map((p) => p.externalId));
        const merged = [...current];
        for (const p of data.pins) {
          if (!seen.has(p.externalId)) {
            seen.add(p.externalId);
            merged.push(p);
          }
        }
```

5. In `toggleSave`, key by `externalId`:

```ts
        if (data.saved && data.pin) next.set(pin.externalId, data.pin);
        else next.delete(pin.externalId);
```

6. In `grid`, `key={pin.externalId}` and `saved={saved.has(pin.externalId)}`.
7. Lightbox render: `saved={saved.has(lightbox.externalId)}`.
8. Chip label: `{q ? `“${q}”` : "Pinterest"}` (was `"For You"`).
9. Search placeholder: `placeholder="Search your saved pins…"` (aria-label stays `"Search inspiration"` — e2e keys on it).
10. Browse empty state — directly after `{grid(pins, "pin-grid")}` inside the forYou branch, add:

```tsx
          {!loading && !error && !q && pins.length === 0 && (
            <p className="text-mute">
              Nothing here yet — connect Pinterest in Settings and pick your boards.
            </p>
          )}
```

- [ ] **Step 2: Update `components/explore/PinLightbox.tsx`**

1. Import: `import type { Pin } from "@/lib/explore/pinterest";`
2. `styleThis` occasion stays keyed on `pin.alt` (unchanged — alt now carries the Pinterest title).
3. Replace the credit `<p>` block with:

```tsx
        <p className="text-sm text-mute">
          From{" "}
          {pin.creditUrl ? (
            <a className="underline" href={pin.creditUrl} target="_blank" rel="noreferrer">
              {pin.credit || "unknown"}
            </a>
          ) : (
            pin.credit || "unknown"
          )}{" "}
          on{" "}
          <a
            className="underline"
            href={
              pin.sourceUrl ||
              (pin.source === "pinterest" ? "https://www.pinterest.com" : "https://www.pexels.com")
            }
            target="_blank"
            rel="noreferrer"
          >
            {pin.source === "pinterest" ? "Pinterest" : "Pexels"}
          </a>
        </p>
```

- [ ] **Step 3: Gate**

Run: `npm test && npm run typecheck`
Expected: PASS — the whole app now compiles against the new `Pin`.

- [ ] **Step 4: Commit**

```bash
git add components/explore/ExploreFeed.tsx components/explore/PinLightbox.tsx "app/(tabs)/explore/page.tsx"
git commit -m "feat(explore): feed UI keyed by externalId with Pinterest chip and credit"
```

---

### Task 8: Settings — PinterestSection (connect, board picker, sync)

**Files:**
- Create: `components/settings/PinterestSection.tsx`
- Modify: `app/(tabs)/settings/page.tsx`

**Interfaces:**
- Consumes: `/api/pinterest/boards` GET/POST, `/api/pinterest/sync` POST, `/api/pinterest/auth` GET/DELETE (Tasks 3/5); `isPinterestMock`, `PINTEREST_AUTH_KEY`, `Board` from `@/lib/explore/pinterest`; `PINTEREST_SYNCED_KEY` from `@/lib/explore/sync`.
- Produces: `<PinterestSection connected={boolean} syncedAt={string | null} connectError={string | null} />`

- [ ] **Step 1: Create `components/settings/PinterestSection.tsx`**

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Board } from "@/lib/explore/pinterest";

export default function PinterestSection({
  connected,
  syncedAt,
  connectError,
}: {
  connected: boolean;
  syncedAt: string | null;
  connectError: string | null;
}) {
  const router = useRouter();
  const [boards, setBoards] = useState<Board[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(connectError);

  useEffect(() => {
    if (!connected) return;
    void (async () => {
      try {
        const res = await fetch("/api/pinterest/boards");
        const data = (await res.json().catch(() => null)) as {
          boards?: Board[];
          selectedIds?: string[];
          error?: string;
        } | null;
        if (!res.ok || !data?.boards) {
          throw new Error(data?.error ?? "Couldn't load boards — try again.");
        }
        setBoards(data.boards);
        setSelected(new Set(data.selectedIds ?? []));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't load boards — try again.");
      }
    })();
  }, [connected]);

  async function runSync() {
    const res = await fetch("/api/pinterest/sync", { method: "POST" });
    const data = (await res.json().catch(() => null)) as {
      pinCount?: number;
      error?: string;
    } | null;
    if (!res.ok) throw new Error(data?.error ?? "Sync failed — try again.");
    setMessage(`Synced ${data?.pinCount ?? 0} pins.`);
    router.refresh();
  }

  async function saveAndSync() {
    if (!boards) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const chosen = boards.filter((b) => selected.has(b.id));
      const res = await fetch("/api/pinterest/boards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ boards: chosen }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(data?.error ?? "Couldn't save boards — try again.");
      await runSync();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed — try again.");
    } finally {
      setBusy(false);
    }
  }

  async function syncNow() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await runSync();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed — try again.");
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/pinterest/auth", { method: "DELETE" });
      if (!res.ok) throw new Error("Couldn't disconnect — try again.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't disconnect — try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-label="Pinterest">
      <h2 className="text-lg font-semibold">Pinterest</h2>
      <p className="mt-1 text-sm text-mute">
        Your Explore feed pulls pins from the boards you pick here.
      </p>
      {!connected ? (
        <a
          href="/api/pinterest/auth"
          className="mt-2 inline-block rounded-full bg-pink px-4 py-2 text-sm font-semibold text-on-pink active:bg-pink-deep"
        >
          Connect Pinterest
        </a>
      ) : (
        <div className="mt-2 flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <p className="text-sm text-body">✅ Pinterest connected</p>
            <button
              type="button"
              onClick={() => void disconnect()}
              disabled={busy}
              className="text-xs text-error underline disabled:opacity-50"
            >
              Disconnect
            </button>
          </div>
          {boards === null && !error ? (
            <p role="status" className="text-sm text-mute">
              Loading boards…
            </p>
          ) : boards && boards.length === 0 ? (
            <p className="text-sm text-mute">No boards on this account yet.</p>
          ) : (
            boards && (
              <>
                <ul className="flex flex-col gap-1">
                  {boards.map((b) => (
                    <li key={b.id}>
                      <label className="flex items-center gap-2 text-sm text-body">
                        <input
                          type="checkbox"
                          checked={selected.has(b.id)}
                          disabled={busy}
                          onChange={(e) =>
                            setSelected((prev) => {
                              const next = new Set(prev);
                              if (e.target.checked) next.add(b.id);
                              else next.delete(b.id);
                              return next;
                            })
                          }
                        />
                        {b.name}
                      </label>
                    </li>
                  ))}
                </ul>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void saveAndSync()}
                    disabled={busy || selected.size === 0}
                    className="rounded-full bg-pink px-4 py-2 text-sm font-semibold text-on-pink active:bg-pink-deep disabled:opacity-50"
                  >
                    {busy ? "…" : "Save boards & sync"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void syncNow()}
                    disabled={busy}
                    className="rounded-full bg-card px-4 py-2 text-sm font-semibold text-ink disabled:opacity-50"
                  >
                    Sync now
                  </button>
                </div>
              </>
            )
          )}
          {syncedAt && (
            <p className="text-xs text-mute">
              Last synced {new Date(Number(syncedAt)).toLocaleString()}
            </p>
          )}
        </div>
      )}
      {message && (
        <p role="status" className="mt-2 text-sm text-success">
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm text-error">
          {error}
        </p>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Wire it into `app/(tabs)/settings/page.tsx`**

Add imports:

```ts
import PinterestSection from "@/components/settings/PinterestSection";
import { PINTEREST_AUTH_KEY, isPinterestMock } from "@/lib/explore/pinterest";
import { PINTEREST_SYNCED_KEY } from "@/lib/explore/sync";
```

Change the signature and data load:

```ts
export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ pinterest_error?: string }>;
}) {
  const [photos, icsUrl, weatherLocationRaw, pinterestAuth, pinterestSyncedAt] =
    await Promise.all([
      getDb().select().from(basePhotos).orderBy(asc(basePhotos.createdAt)),
      getSetting("icsUrl"),
      getSetting("weatherLocation"),
      getSetting(PINTEREST_AUTH_KEY),
      getSetting(PINTEREST_SYNCED_KEY),
    ]);
  const { pinterest_error } = await searchParams;
```

Render the section after `<WeatherSection …/>`:

```tsx
        <PinterestSection
          connected={!!pinterestAuth || isPinterestMock()}
          syncedAt={pinterestSyncedAt}
          connectError={pinterest_error ?? null}
        />
```

- [ ] **Step 3: Gate**

Run: `npm test && npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add components/settings/PinterestSection.tsx "app/(tabs)/settings/page.tsx"
git commit -m "feat(settings): pinterest connect, board picker, and sync section"
```

---

### Task 9: Delete Pexels, swap env plumbing, update docs

**Files:**
- Delete: `lib/explore/pexels.ts`, `lib/explore/pexels.test.ts`, `lib/explore/queries.ts`, `lib/explore/queries.test.ts`
- Modify: `.env.example`, `playwright.config.ts`, `CLAUDE.md`

- [ ] **Step 1: Verify nothing still imports the dead modules**

Run: `grep -rn "explore/pexels\|explore/queries\|PEXELS_API_KEY" app components lib e2e playwright.config.ts --include=*.ts --include=*.tsx`
Expected: only hits inside the four files being deleted + `playwright.config.ts` + comments being edited this task. If anything else hits, fix it first.

- [ ] **Step 2: Delete the four files**

```bash
git rm lib/explore/pexels.ts lib/explore/pexels.test.ts lib/explore/queries.ts lib/explore/queries.test.ts
```

- [ ] **Step 2b: Decouple `lib/explore/masonry.test.ts` from the deleted pexels module**

Task 7 generalized `splitColumns` to `<T extends { width: number; height: number }>`, so the masonry test no longer needs the Pin type at all. Remove its `import ... from "./pexels"` line and replace its pin fixtures with minimal `{ width, height }` object literals (keep every existing assertion — only the fixture shape and import change).

- [ ] **Step 3: `.env.example`** — replace the `PEXELS_API_KEY` block (comment + var) with:

```
# Pinterest app credentials — server-side only, power the Explore feed
# (developers.pinterest.com → your app → Trial access). When PINTEREST_APP_ID
# is set, Explore talks to the real Pinterest API even under MOCK_AI=1
# (leave unset to keep the canned mock pins).
PINTEREST_APP_ID=
PINTEREST_APP_SECRET=
```

- [ ] **Step 4: `playwright.config.ts`** — replace the env line + its comment:

```ts
    // PINTEREST_APP_ID is blanked so Explore stays on canned pins even when the
    // developer's .env.local has real credentials (a real app id overrides MOCK_AI).
    env: {
      ...process.env,
      MOCK_AI: "1",
      PINTEREST_APP_ID: "",
      PINTEREST_APP_SECRET: "",
    } as Record<string, string>,
```

- [ ] **Step 5: `CLAUDE.md`** — update the manual-dev-server learned rule to:

```
- A manually-started dev server left running poisons e2e: playwright.config.ts
  only pins MOCK_AI=1 / PINTEREST_APP_ID="" on servers IT starts, and
  `reuseExistingServer` makes it adopt whatever is already on :4100 — real
  Pinterest pins then break z-explore's mock-pin assertions. Kill the dev
  server (or never leave one running) before `npm run test:e2e`.
```

- [ ] **Step 6: Gate + commit**

```bash
npm test && npm run typecheck
git add -A
git commit -m "chore(explore): remove pexels client and swap env plumbing to pinterest"
```

---

### Task 10: e2e rewrite + full done bar

**Files:**
- Modify: `e2e/z-explore.spec.ts`

- [ ] **Step 1: Rewrite `e2e/z-explore.spec.ts`**

```ts
import { expect, test } from "@playwright/test";

// Named z- to run LAST: by now studio.spec's tee/jeans/sneakers are seeded,
// so MOCK_AI stylist combos work for the "Style this" flow.
// NOTE: retries must stay 0 — the save-toggle test assumes a clean pins table.
// Mock Pinterest: 2 boards × 45 pins = 90 cached pins → exactly 3 feed pages.
// The first /api/explore call auto-syncs the mock boards into pinterest_pins.
test.describe.serial("explore", () => {
  test("feed renders a masonry of mock pinterest pins", async ({ page }) => {
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

  test("search filters the cached pins", async ({ page }) => {
    await page.goto("/explore");
    await page.getByLabel("Search inspiration").fill("parisian");
    await page.getByRole("button", { name: "Search" }).click();
    await expect(page.locator('img[alt="Mock pin Parisian Chic 1"]')).toBeVisible();
    await expect(page.getByRole("button", { name: "“parisian”" })).toBeVisible();
  });

  test("lightbox credits Pinterest and styles the look from the closet", async ({ page }) => {
    await page.goto("/explore");
    await page.getByRole("button", { name: /^Open pin/ }).first().click();
    const dialog = page.getByRole("dialog", { name: "Pin detail" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("link", { name: "Pinterest" })).toBeVisible();
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

(Note the chip is now labeled "Pinterest" but no test keys on that label; the Saved chip and all other locators are unchanged.)

- [ ] **Step 2: Kill the running dev server** (learned rule — it would poison e2e)

The tailnet dev server from this session is a background task; stop it (TaskStop on its task id, or kill the process on :4100). Verify: `curl -s -o /dev/null -w "%{http_code}" http://localhost:4100` → connection refused.

- [ ] **Step 3: Full done bar**

```bash
npm test && npm run typecheck && npm run test:e2e
```

Expected: all three green (unit ≈ current count + new pinterest/feed/sync tests − deleted pexels/queries tests; e2e 49+ specs, z-explore rewritten). Show the output.

- [ ] **Step 4: Commit**

```bash
git add e2e/z-explore.spec.ts
git commit -m "test(explore): z-explore drives the mock pinterest feed"
```

- [ ] **Step 5: Restart the phone server**

`npm run dev` in the background — tailscale serve config persists, https://personal.tailc2e1d7.ts.net comes back on its own.

---

## Verification (end to end)

1. Done bar (Task 10 Step 3) — all green, output shown.
2. Mock-mode drive: open http://localhost:4100/explore → 30 mock pins render under the "Pinterest" chip; search "parisian" filters; heart + lightbox + "Style this" work; Settings shows the Pinterest section connected (mock) with 2 boards.
3. Live smoke (needs Bailey's manual checklist below): on the phone via https://personal.tailc2e1d7.ts.net → Settings → Connect Pinterest → approve on Pinterest → pick boards → Save boards & sync → Explore shows real pins; save a new pin on Pinterest, tap Sync now, confirm it appears.

## Bailey's manual checklist (before live use — mock mode needs none of this)

1. Pinterest developer portal requires a (free) business account — convert or create one **linked to the account that owns your boards** (OAuth must log into that account).
2. developers.pinterest.com → create an app → request Trial access (app description + a reachable privacy-policy URL — any simple page).
3. Register BOTH redirect URIs: `https://personal.tailc2e1d7.ts.net:8443/api/pinterest/callback` and `http://localhost:4100/api/pinterest/callback`. (Kloset serves on :8443 — :443 belongs to another project.)
4. Put the App ID + secret in `.env.local` as `PINTEREST_APP_ID` / `PINTEREST_APP_SECRET`.
