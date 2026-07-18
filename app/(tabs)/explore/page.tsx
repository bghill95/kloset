import { desc } from "drizzle-orm";
import ExploreFeed from "@/components/explore/ExploreFeed";
import PageHeader from "@/components/shell/PageHeader";
import { getDb } from "@/lib/db/client";
import { pins } from "@/lib/db/schema";
import type { SavedPin } from "@/lib/explore/pexels";

export const dynamic = "force-dynamic";

export default async function ExplorePage() {
  const rows = await getDb().select().from(pins).orderBy(desc(pins.createdAt));
  const savedPins: SavedPin[] = rows.map((r) => ({
    id: r.id,
    pexelsId: r.pexelsId ?? 0, // shim until Task 7 switches to savedRowToPin
    width: r.width,
    height: r.height,
    alt: r.alt,
    photographer: r.photographer,
    photographerUrl: r.photographerUrl,
    pexelsUrl: r.pexelsUrl,
    imageUrl: r.imageUrl,
  }));
  return (
    <>
      <PageHeader title="Explore" />
      <ExploreFeed savedPins={savedPins} />
    </>
  );
}
