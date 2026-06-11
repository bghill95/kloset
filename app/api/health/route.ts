import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { settings } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await getDb().select().from(settings).limit(1);
    return NextResponse.json({ ok: true, db: true });
  } catch {
    return NextResponse.json({ ok: false, db: false }, { status: 503 });
  }
}
