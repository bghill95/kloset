import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { UUID_RE } from "@/lib/closet/item-validation";
import { getDb } from "@/lib/db/client";
import { trips } from "@/lib/db/schema";
import { parseCapsule } from "@/lib/trips/capsule";
import { validatePackedPatch } from "@/lib/trips/validation";

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
  const parsed = validatePackedPatch(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const db = getDb();
  const [trip] = await db.select().from(trips).where(eq(trips.id, id));
  if (!trip) return NextResponse.json({ error: "Not found." }, { status: 404 });
  // Only capsule members can be ticked.
  const allowed = new Set(parseCapsule(trip.capsule).map((p) => p.itemId));
  const packedIds = parsed.value.filter((pid) => allowed.has(pid));
  await db.update(trips).set({ packedIds }).where(eq(trips.id, id));
  return NextResponse.json({ packedIds });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  const [gone] = await getDb().delete(trips).where(eq(trips.id, id)).returning();
  if (!gone) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
