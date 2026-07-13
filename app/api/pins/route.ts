// app/api/pins/route.ts
import { desc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { pins } from "@/lib/db/schema";
import { validatePinBody } from "@/lib/explore/validation";

export async function GET() {
  const rows = await getDb().select().from(pins).orderBy(desc(pins.createdAt));
  return NextResponse.json({ pins: rows });
}

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
  const [row] = await db.insert(pins).values(pin).returning();
  return NextResponse.json({ saved: true, pin: row }, { status: 201 });
}
