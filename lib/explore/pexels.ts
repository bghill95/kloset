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

// djb2 — full 32-bit hash gives each query its own id block so client dedup does not collide across queries.
function hashQuery(query: string): number {
  let h = 5381;
  for (let i = 0; i < query.length; i++) h = ((h * 33) ^ query.charCodeAt(i)) >>> 0;
  return h;
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
  // Lazy env read — never at module scope (learned rule).
  const key = process.env.PEXELS_API_KEY;
  // A real key wins over MOCK_AI: Pexels is free/read-only, so Explore can go
  // live while OpenAI/Blob stay mocked. e2e pins PEXELS_API_KEY="" to stay canned.
  if (process.env.MOCK_AI === "1" && !key)
    return { pins: mockPins(query, page, perPage), hasMore: true };
  if (!key) throw new Error("PEXELS_API_KEY is not set");
  // Women's fashion only — Pexels otherwise mixes in menswear.
  const url = `${PEXELS_SEARCH_URL}?query=${encodeURIComponent(`women ${query}`)}&page=${page}&per_page=${perPage}`;
  const res = await fetch(url, {
    headers: { Authorization: key },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Pexels search failed: ${res.status}`);
  return parsePexelsResponse(await res.json());
}
