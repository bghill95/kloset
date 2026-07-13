import { count, desc } from "drizzle-orm";
import Link from "next/link";
import PageHeader from "@/components/shell/PageHeader";
import OutfitCollage from "@/components/studio/OutfitCollage";
import { getDb } from "@/lib/db/client";
import { items, outfits, wears } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export default async function LookbookPage() {
  const db = getDb();
  const [allOutfits, allItems, wearCounts] = await Promise.all([
    db.select().from(outfits).orderBy(desc(outfits.createdAt)),
    db.select().from(items),
    db.select({ outfitId: wears.outfitId, n: count() }).from(wears).groupBy(wears.outfitId),
  ]);
  const byId = new Map(allItems.map((i) => [i.id, i]));
  const wornTimes = new Map(wearCounts.map((w) => [w.outfitId, w.n]));

  return (
    <>
      <PageHeader title="Lookbook" />
      {allOutfits.length === 0 ? (
        <div className="mt-16 flex flex-col items-center gap-3 text-center">
          <p className="font-display text-3xl text-ink">No looks yet</p>
          <p className="text-mute">Build your first outfit in the Studio.</p>
          <Link
            href="/studio"
            className="rounded-full bg-pink px-5 py-3 text-sm font-bold text-on-pink active:bg-pink-deep"
          >
            Open Studio
          </Link>
        </div>
      ) : (
        <div className="mt-4 columns-2 gap-2 sm:columns-3 md:columns-4 [&>a]:mb-2">
          {allOutfits.map((outfit) => {
            // Deleted items just drop out of the collage.
            const resolved = outfit.itemIds.flatMap((id) => {
              const item = byId.get(id);
              return item ? [item] : [];
            });
            return (
              <Link
                key={outfit.id}
                href={`/lookbook/${outfit.id}`}
                className="relative block break-inside-avoid overflow-hidden rounded-card bg-card"
              >
                {outfit.renderUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={outfit.renderUrl} alt={outfit.name} className="w-full" />
                ) : (
                  <OutfitCollage items={resolved} />
                )}
                <span className="absolute bottom-2 left-2 max-w-[85%] truncate rounded-full bg-canvas px-3 py-1 text-xs font-bold text-ink">
                  {outfit.name}
                </span>
                {(wornTimes.get(outfit.id) ?? 0) > 0 && (
                  <span className="absolute right-2 top-2 rounded-full bg-canvas px-3 py-1 text-xs font-bold text-ink">
                    Worn {wornTimes.get(outfit.id)}×
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
