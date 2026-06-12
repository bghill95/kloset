import { desc } from "drizzle-orm";
import Link from "next/link";
import {
  CATEGORIES,
  CATEGORY_LABELS,
  isCategory,
} from "@/lib/closet/categories";
import { distinctColors, filterItems } from "@/lib/closet/filter";
import { getDb } from "@/lib/db/client";
import { items } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

function chipClass(active: boolean) {
  return `rounded-full px-3 py-1 text-sm ${
    active ? "bg-neutral-900 text-white" : "bg-neutral-200 text-neutral-600"
  }`;
}

function href(category?: string, color?: string) {
  const params = new URLSearchParams();
  if (category) params.set("category", category);
  if (color) params.set("color", color);
  const qs = params.toString();
  return qs ? `/closet?${qs}` : "/closet";
}

export default async function ClosetPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; color?: string }>;
}) {
  const params = await searchParams;
  const category = isCategory(params.category) ? params.category : undefined;
  const color = params.color || undefined;

  // Single-user scale: fetch all, filter in memory (unit-tested pure logic).
  const all = await getDb().select().from(items).orderBy(desc(items.createdAt));
  const visible = filterItems(all, { category, color });
  const colors = distinctColors(all);

  return (
    <>
      <h1 className="text-2xl font-semibold">Closet</h1>

      <div className="mt-3 flex flex-wrap gap-2">
        <Link href={href(undefined, color)} className={chipClass(!category)}>
          All
        </Link>
        {CATEGORIES.map((c) => (
          <Link key={c} href={href(c, color)} className={chipClass(category === c)}>
            {CATEGORY_LABELS[c]}s
          </Link>
        ))}
      </div>

      {colors.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          <Link href={href(category)} className={chipClass(!color)}>
            Any color
          </Link>
          {colors.map((c) => (
            <Link key={c} href={href(category, c)} className={chipClass(color === c)}>
              {c}
            </Link>
          ))}
        </div>
      )}

      {all.length === 0 && (
        <p className="mt-6 text-neutral-500">
          Your closet is empty — scan your first item.
        </p>
      )}

      <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
        <Link
          href="/scan"
          className="flex h-36 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-neutral-300 text-sm font-semibold text-neutral-500"
        >
          📷 Scan item
        </Link>
        {visible.map((item) => (
          <Link
            key={item.id}
            href={`/closet/${item.id}`}
            className="flex h-36 flex-col items-center justify-center gap-1 rounded-xl bg-white p-2 shadow-sm"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={item.imageUrl}
              alt={item.name}
              className="min-h-0 flex-1 object-contain"
            />
            <span className="max-w-full truncate text-xs text-neutral-600">
              {item.name}
            </span>
          </Link>
        ))}
      </div>
    </>
  );
}
