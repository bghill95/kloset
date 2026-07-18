// app/api/pins/route.ts
import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { pins } from "@/lib/db/schema";
import { savedRowToPin } from "@/lib/explore/feed";
import { validatePinBody } from "@/lib/explore/validation";

// Toggle, like /api/wears: posting an already-saved pin unsaves it.
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const parsed = validatePinBody(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const pin = parsed.value;
  const db = getDb();
  const match = and(eq(pins.source, pin.source), eq(pins.externalId, pin.externalId));
  const values = {
    source: pin.source,
    externalId: pin.externalId,
    imageUrl: pin.imageUrl,
    alt: pin.alt,
    photographer: pin.credit,
    photographerUrl: pin.creditUrl,
    pexelsUrl: pin.sourceUrl,
    width: pin.width,
    height: pin.height,
  };
  const existing = await db.select().from(pins).where(match);
  if (existing.length > 0) {
    await db.delete(pins).where(match);
    return NextResponse.json({ saved: false });
  }
  const [row] = await db.insert(pins).values(values).onConflictDoNothing().returning();
  if (!row) {
    // Lost a double-click race — the concurrent request saved it first.
    const [raced] = await db.select().from(pins).where(match);
    if (!raced) return NextResponse.json({ saved: false });
    return NextResponse.json({ saved: true, pin: savedRowToPin(raced) });
  }
  return NextResponse.json({ saved: true, pin: savedRowToPin(row) }, { status: 201 });
}
