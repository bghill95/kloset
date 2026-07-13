import { desc } from "drizzle-orm";
import Link from "next/link";
import {
  CATEGORIES,
  CATEGORY_PLURAL_LABELS,
  isCategory,
} from "@/lib/closet/categories";
import { distinctColors, filterItems } from "@/lib/closet/filter";
import { getDb } from "@/lib/db/client";
import { items } from "@/lib/db/schema";
import PageHeader from "@/components/shell/PageHeader";

export const dynamic = "force-dynamic";

function chipClass(active: boolean) {
  return `whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold ${
    active ? "bg-ink text-canvas" : "bg-card text-ink"
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

      <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Filter by category">
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
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1" aria-label="Filter by color">
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
        <div className="mt-16 flex flex-col items-center gap-3 text-center">
          <p className="font-display text-3xl text-ink">Your closet awaits</p>
          <p className="text-mute">Scan your first item to start your Kloset.</p>
        </div>
      )}

      <div className="mt-4 columns-2 gap-2 sm:columns-3 md:columns-4 [&>a]:mb-2">
        {visible.map((item) => (
          <Link
            key={item.id}
            href={`/closet/${item.id}`}
            className="relative block break-inside-avoid overflow-hidden rounded-card bg-card"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={item.imageUrl}
              alt=""
              loading="lazy"
              decoding="async"
              className="w-full object-contain p-3"
            />
            <span className="absolute bottom-2 left-2 max-w-[85%] truncate rounded-full bg-canvas px-3 py-1 text-xs font-bold text-ink">
              {item.name}
            </span>
          </Link>
        ))}
      </div>

      <Link
        href="/scan"
        aria-label="Scan item"
        className="fixed right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-pink text-on-pink"
        style={{ bottom: "calc(1.25rem + env(safe-area-inset-bottom))" }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M4 8h3l2-3h6l2 3h3v11H4V8z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
          <circle cx="12" cy="13" r="3.5" stroke="currentColor" strokeWidth="2" />
        </svg>
      </Link>
    </>
  );
}
