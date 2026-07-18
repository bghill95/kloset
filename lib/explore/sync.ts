import { eq, notInArray } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { pinterestPins } from "@/lib/db/schema";
import { getSetting, setSetting } from "@/lib/db/settings";
import {
  type Board,
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
  const db = getDb();
  let pinCount = 0;
  for (const board of boards) {
    const boardPins = await listBoardPins(token, board);
    pinCount += boardPins.length;
    // Replace wholesale per board — pins deleted on Pinterest drop out too.
    await db.delete(pinterestPins).where(eq(pinterestPins.boardId, board.id));
    for (let i = 0; i < boardPins.length; i += 500) {
      await db
        .insert(pinterestPins)
        .values(boardPins.slice(i, i + 500))
        .onConflictDoNothing(); // same pin saved to two boards: first board wins
    }
  }
  await db.delete(pinterestPins).where(
    notInArray(pinterestPins.boardId, boards.map((b) => b.id)),
  );
  await setSetting(PINTEREST_SYNCED_KEY, String(Date.now()));
  return { synced: true, pinCount };
}

export async function syncIfStale(): Promise<void> {
  if (isStale(await getSetting(PINTEREST_SYNCED_KEY), Date.now())) await syncPinterest();
}
