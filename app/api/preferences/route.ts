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
