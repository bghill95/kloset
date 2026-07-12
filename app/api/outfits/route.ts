import { inArray } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { items, outfits } from "@/lib/db/schema";
import { checkOutfitItems, validateNewOutfit } from "@/lib/outfits/validation";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const parsed = validateNewOutfit(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const found = await getDb()
    .select({ id: items.id, category: items.category })
    .from(items)
    .where(inArray(items.id, parsed.value.itemIds));
  const problem = checkOutfitItems(parsed.value.itemIds, found);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });
  const [outfit] = await getDb().insert(outfits).values(parsed.value).returning();
  return NextResponse.json({ outfit }, { status: 201 });
}
