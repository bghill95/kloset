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
  // ponytail: delete+insert is non-transactional (neon-http has no tx) — a
  // mid-write failure leaves a partial cache until isStale re-syncs (≤1h).
  await db.delete(pinterestPins);
  for (let i = 0; i < all.length; i += 500) {
    await db.insert(pinterestPins).values(all.slice(i, i + 500)).onConflictDoNothing();
  }
  await setSetting(PINTEREST_SYNCED_KEY, String(Date.now()));
  return { synced: true, pinCount: all.length };
}

export async function syncIfStale(): Promise<void> {
  if (isStale(await getSetting(PINTEREST_SYNCED_KEY), Date.now())) await syncPinterest();
}
