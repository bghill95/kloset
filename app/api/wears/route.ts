import { and, eq, inArray } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { outfits, wears } from "@/lib/db/schema";
import { DATE_KEY_RE, validateNewWear } from "@/lib/wears/validation";

// Toggle: logging the same outfit for the same day twice un-logs it.
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const parsed = validateNewWear(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const { outfitId, wornOn } = parsed.value;
  const db = getDb();
  const [outfit] = await db
    .select({ id: outfits.id })
    .from(outfits)
    .where(eq(outfits.id, outfitId));
  if (!outfit) {
    return NextResponse.json({ error: "Outfit not found." }, { status: 404 });
  }
  const removed = await db
    .delete(wears)
    .where(and(eq(wears.outfitId, outfitId), eq(wears.wornOn, wornOn)))
    .returning({ id: wears.id });
  if (removed.length > 0) return NextResponse.json({ worn: false });
  await db.insert(wears).values({ outfitId, wornOn }).onConflictDoNothing();
  return NextResponse.json({ worn: true });
}

// GET /api/wears?on=YYYY-MM-DD → that day's wears with their outfits' itemIds,
// so Today can match its pick against what's already logged.
export async function GET(req: NextRequest) {
  const on = req.nextUrl.searchParams.get("on");
  if (!on || !DATE_KEY_RE.test(on)) {
    return NextResponse.json({ error: "on must be a YYYY-MM-DD date." }, { status: 400 });
  }
  const db = getDb();
  const rows = await db.select().from(wears).where(eq(wears.wornOn, on));
  const outfitRows = rows.length
    ? await db
        .select({ id: outfits.id, itemIds: outfits.itemIds })
        .from(outfits)
        .where(inArray(outfits.id, rows.map((w) => w.outfitId)))
    : [];
  const byId = new Map(outfitRows.map((o) => [o.id, o.itemIds]));
  return NextResponse.json({
    wears: rows.flatMap((w) => {
      const itemIds = byId.get(w.outfitId);
      return itemIds ? [{ outfitId: w.outfitId, wornOn: w.wornOn, itemIds }] : [];
    }),
  });
}
