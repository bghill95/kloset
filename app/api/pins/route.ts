// app/api/pins/route.ts
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { pins } from "@/lib/db/schema";
import { validatePinBody } from "@/lib/explore/validation";

// Toggle, like /api/wears: posting an already-saved pexelsId unsaves it.
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
  const existing = await db.select().from(pins).where(eq(pins.pexelsId, pin.pexelsId));
  if (existing.length > 0) {
    await db.delete(pins).where(eq(pins.pexelsId, pin.pexelsId));
    return NextResponse.json({ saved: false });
  }
  const [row] = await db
    .insert(pins)
    .values({ ...pin, externalId: String(pin.pexelsId) }) // shim until Task 6 rewrites this route
    .onConflictDoNothing()
    .returning();
  if (!row) {
    // Lost a double-click race — the concurrent request saved it first.
    const [existing] = await db.select().from(pins).where(eq(pins.pexelsId, pin.pexelsId));
    if (!existing) return NextResponse.json({ saved: false });
    return NextResponse.json({ saved: true, pin: existing });
  }
  return NextResponse.json({ saved: true, pin: row }, { status: 201 });
}
