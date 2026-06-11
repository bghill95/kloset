import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { settings } from "@/lib/db/schema";

export async function GET() {
  try {
    await db.select().from(settings).limit(1);
    return NextResponse.json({ ok: true, db: true });
  } catch {
    return NextResponse.json({ ok: false, db: false }, { status: 503 });
  }
}
