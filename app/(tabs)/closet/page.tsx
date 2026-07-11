import { desc } from "drizzle-orm";
import Link from "next/link";
import PageHeader from "@/components/shell/PageHeader";
import {
  CATEGORIES,
  CATEGORY_PLURAL_LABELS,
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
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const first = (v: string | string[] | undefined) =>
    Array.isArray(v) ? v[0] : v;
  const rawCategory = first(params.category);
  const category = isCategory(rawCategory) ? rawCategory : undefined;
  const color = first(params.color) || undefined;

  // Single-user scale: fetch all, filter in memory (unit-tested pure logic).
  const all = await getDb().select().from(items).orderBy(desc(items.createdAt));
  const visible = filterItems(all, { category, color });
  const colors = distinctColors(all);

  return (
    <>
      <PageHeader title="Closet" />

      <div className="mt-3 flex flex-wrap gap-2" aria-label="Filter by category">
        <Link href={href(undefined, color)} className={chipClass(!category)} aria-current={!category ? "true" : undefined}>
          All
        </Link>
        {CATEGORIES.map((c) => (
          <Link key={c} href={href(c, color)} className={chipClass(category === c)} aria-current={category === c ? "true" : undefined}>
            {CATEGORY_PLURAL_LABELS[c]}
          </Link>
        ))}
      </div>

      {colors.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2" aria-label="Filter by color">
          <Link href={href(category)} className={chipClass(!color)} aria-current={!color ? "true" : undefined}>
            Any color
          </Link>
          {colors.map((c) => (
            <Link key={c} href={href(category, c)} className={chipClass(color === c)} aria-current={color === c ? "true" : undefined}>
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
              alt=""
              loading="lazy"
              decoding="async"
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
