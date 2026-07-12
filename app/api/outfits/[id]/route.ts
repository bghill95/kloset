import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { UUID_RE } from "@/lib/closet/item-validation";
import { getDb } from "@/lib/db/client";
import { outfits, wears } from "@/lib/db/schema";
import { deleteImages } from "@/lib/storage/blob";

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  const db = getDb();
  const [gone] = await db.delete(outfits).where(eq(outfits.id, id)).returning();
  if (!gone) return NextResponse.json({ error: "Not found." }, { status: 404 });
  // Orphan cleanup: wears reference outfits without an FK.
  await db.delete(wears).where(eq(wears.outfitId, id));
  await deleteImages([gone.renderUrl]);
  return NextResponse.json({ ok: true });
}
