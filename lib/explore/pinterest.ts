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
