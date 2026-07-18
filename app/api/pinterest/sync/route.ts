// app/api/pinterest/sync/route.ts
import { NextResponse } from "next/server";
import { syncPinterest } from "@/lib/explore/sync";

export async function POST() {
  try {
    const result = await syncPinterest();
    return NextResponse.json(result);
  } catch (err) {
    console.error("[pinterest] sync failed:", err);
    return NextResponse.json({ error: "Sync failed — try again." }, { status: 502 });
  }
}
