// app/api/explore/route.ts
import { desc } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { items } from "@/lib/db/schema";
import { searchPexels } from "@/lib/explore/pexels";
import { buildFeedQueries } from "@/lib/explore/queries";
import { validateFeedParams } from "@/lib/explore/validation";

const PER_PAGE = 30;

// For You paging walks the seeded query list round-robin: feed page N uses
// query (N-1) % len at provider page floor((N-1)/len)+1. A search (?q=) pages
// the provider directly.
export async function GET(req: NextRequest) {
  const parsed = validateFeedParams(req.nextUrl.searchParams);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const { page, seed, q } = parsed.value;

  let query = q;
  let providerPage = page;
  if (!query) {
    const all = await getDb().select().from(items).orderBy(desc(items.createdAt));
    const queries = buildFeedQueries(all, seed); // never empty — staples guarantee ≥5
    query = queries[(page - 1) % queries.length];
    providerPage = Math.floor((page - 1) / queries.length) + 1;
  }

  try {
    const feed = await searchPexels(query, providerPage, PER_PAGE);
    return NextResponse.json(feed);
  } catch (err) {
    console.error("[explore] pexels search failed:", err);
    return NextResponse.json({ error: "Couldn't load inspiration — try again." }, { status: 502 });
  }
}
