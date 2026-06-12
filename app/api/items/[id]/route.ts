import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import {
  UUID_RE,
  validateItemPatch,
} from "@/lib/closet/item-validation";
import { getDb } from "@/lib/db/client";
import { items } from "@/lib/db/schema";
import { deleteImages } from "@/lib/storage/blob";

type Ctx = { params: Promise<{ id: string }> };

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
  const parsed = validateItemPatch(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const [item] = await getDb()
    .update(items)
    .set(parsed.value)
    .where(eq(items.id, id))
    .returning();
  if (!item) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json({ item });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  const [item] = await getDb()
    .delete(items)
    .where(eq(items.id, id))
    .returning();
  if (!item) return NextResponse.json({ error: "Not found." }, { status: 404 });
  // Spec: no orphan storage — remove the Blob images with the row.
  await deleteImages([item.imageUrl, item.originalImageUrl]);
  return NextResponse.json({ ok: true });
}
