import { NextRequest, NextResponse } from "next/server";
import { validateNewItem } from "@/lib/closet/item-validation";
import { getDb } from "@/lib/db/client";
import { items } from "@/lib/db/schema";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const parsed = validateNewItem(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const [item] = await getDb().insert(items).values(parsed.value).returning();
  return NextResponse.json({ item }, { status: 201 });
}
