import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { pickPrimary, validatePrimaryPatch } from "@/lib/avatar/primary";
import { UUID_RE } from "@/lib/closet/item-validation";
import { getDb } from "@/lib/db/client";
import { basePhotos } from "@/lib/db/schema";
import { deleteImages } from "@/lib/storage/blob";

type Ctx = { params: Promise<{ id: string }> };

// neon-http has no multi-statement transactions; the demote→promote pair runs
// sequentially. Single-user app — a crash between them is recoverable by
// re-tapping "Make primary".

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (!validatePrimaryPatch(body)) {
    return NextResponse.json(
      { error: "Only { isPrimary: true } is accepted." },
      { status: 400 },
    );
  }

  const db = getDb();
  const [target] = await db
    .select()
    .from(basePhotos)
    .where(eq(basePhotos.id, id));
  if (!target) return NextResponse.json({ error: "Not found." }, { status: 404 });

  await db.update(basePhotos).set({ isPrimary: false });
  const [photo] = await db
    .update(basePhotos)
    .set({ isPrimary: true })
    .where(eq(basePhotos.id, id))
    .returning();
  if (!photo) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json({ photo });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  const db = getDb();
  const [deleted] = await db
    .delete(basePhotos)
    .where(eq(basePhotos.id, id))
    .returning();
  if (!deleted) return NextResponse.json({ error: "Not found." }, { status: 404 });

  await deleteImages([deleted.imageUrl]);

  const remaining = await db.select().from(basePhotos);
  const promoteId = pickPrimary(remaining);
  if (promoteId) {
    await db
      .update(basePhotos)
      .set({ isPrimary: true })
      .where(eq(basePhotos.id, promoteId));
  }
  return NextResponse.json({ ok: true });
}
