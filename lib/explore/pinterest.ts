import { getSetting, setSetting } from "@/lib/db/settings";

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

// ---------- OAuth ----------

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
      await pinterestGet(`/boards/${encodeURIComponent(board.id)}/pins?${qs}`, token),
      board,
    );
    pins.push(...parsed.pins);
    bookmark = parsed.bookmark;
    if (!bookmark) break;
  }
  return pins;
}
