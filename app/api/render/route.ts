import { eq, inArray } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { runRenderPipeline } from "@/lib/ai/render";
import { getDb } from "@/lib/db/client";
import { basePhotos, items } from "@/lib/db/schema";
import { checkOutfitItems, validateItemIds } from "@/lib/outfits/validation";

// Multi-image photoreal renders are slow; Vercel clamps this to the plan max.
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Body must be an object." }, { status: 400 });
  }
  const ids = validateItemIds((body as Record<string, unknown>).itemIds);
  if (!ids.ok) return NextResponse.json({ error: ids.error }, { status: 400 });

  const db = getDb();
  const found = await db.select().from(items).where(inArray(items.id, ids.value));
  const problem = checkOutfitItems(ids.value, found);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });

  const [primary] = await db
    .select()
    .from(basePhotos)
    .where(eq(basePhotos.isPrimary, true))
    .limit(1);
  if (!primary) {
    return NextResponse.json(
      { error: "Add a base photo first — try-on dresses your primary base photo." },
      { status: 409 },
    );
  }

  if (process.env.MOCK_AI !== "1") {
    const urls = [primary.imageUrl, ...found.map((i) => i.imageUrl)];
    if (urls.some((u) => !u.startsWith("https://"))) {
      return NextResponse.json(
        { error: "Some images are dev fixtures — recapture them before rendering." },
        { status: 422 },
      );
    }
  }

  try {
    const renderUrl = await runRenderPipeline(primary.imageUrl, found);
    return NextResponse.json({ renderUrl });
  } catch (err) {
    console.error("[render] pipeline failed:", err);
    return NextResponse.json({ error: "Render failed — try again." }, { status: 502 });
  }
}
