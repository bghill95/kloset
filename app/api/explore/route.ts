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
