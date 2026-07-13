import { desc, eq, inArray } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import DeleteOutfitButton from "@/components/lookbook/DeleteOutfitButton";
import OutfitActions from "@/components/outfits/OutfitActions";
import PageHeader from "@/components/shell/PageHeader";
import OutfitCollage from "@/components/studio/OutfitCollage";
import { CATEGORIES, CATEGORY_LABELS } from "@/lib/closet/categories";
import { UUID_RE } from "@/lib/closet/item-validation";
import { getDb } from "@/lib/db/client";
import { items, outfits, wears } from "@/lib/db/schema";
import { localDateKey } from "@/lib/today/date";

export const dynamic = "force-dynamic";

function formatWorn(wornOn: string): string {
  // Anchor to local midnight — bare date strings would parse as UTC.
  return new Date(`${wornOn}T00:00:00`).toLocaleDateString([], {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default async function OutfitPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const db = getDb();
  const [outfit] = await db.select().from(outfits).where(eq(outfits.id, id));
  if (!outfit) notFound();
  const [resolved, history] = await Promise.all([
    outfit.itemIds.length
      ? db.select().from(items).where(inArray(items.id, outfit.itemIds))
      : Promise.resolve([]),
    db.select().from(wears).where(eq(wears.outfitId, id)).orderBy(desc(wears.wornOn)),
  ]);
  const ordered = CATEGORIES.flatMap((c) => resolved.filter((i) => i.category === c));
  // Server-local date: worst case the toggle starts stale near midnight and
  // corrects itself on first tap (the POST response is authoritative).
  const wornToday = history.some((w) => w.wornOn === localDateKey());

  return (
    <>
      <Link href="/lookbook" className="text-sm text-mute">
        ← Lookbook
      </Link>
      <PageHeader title={outfit.name} />
      <div className="flex flex-col gap-6">
        {outfit.renderUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={outfit.renderUrl}
            alt={outfit.name}
            className="w-full overflow-hidden rounded-card bg-card"
          />
        ) : (
          <OutfitCollage items={ordered} />
        )}

        <OutfitActions
          name={outfit.name}
          itemIds={ordered.map((i) => i.id)}
          savedOutfitId={outfit.id}
          initialWorn={wornToday}
          showSave={false}
        />

        <section aria-label="Pieces" className="flex flex-col gap-2">
          <h2 className="font-display text-3xl text-ink">Pieces</h2>
          {ordered.map((item) => (
            <Link
              key={item.id}
              href={`/closet/${item.id}`}
              className="flex items-center gap-3 rounded-card bg-card p-2"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.imageUrl} alt="" className="h-12 w-12 object-contain" />
              <span className="font-bold text-ink">{item.name}</span>
              <span className="ml-auto pr-2 text-sm text-mute">
                {CATEGORY_LABELS[item.category]}
              </span>
            </Link>
          ))}
          {ordered.length === 0 && (
            <p className="text-mute">The pieces in this look are no longer in your closet.</p>
          )}
        </section>

        <section aria-label="Wear history" className="flex flex-col gap-2">
          <h2 className="font-display text-3xl text-ink">Worn {history.length}×</h2>
          {history.length === 0 ? (
            <p className="text-mute">Not worn yet.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {history.map((w) => (
                <li key={w.id} className="text-sm text-body">
                  {formatWorn(w.wornOn)}
                </li>
              ))}
            </ul>
          )}
        </section>

        <DeleteOutfitButton outfitId={outfit.id} />
      </div>
    </>
  );
}
