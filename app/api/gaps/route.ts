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
