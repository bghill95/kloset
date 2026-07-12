import { desc } from "drizzle-orm";
import PageHeader from "@/components/shell/PageHeader";
import StudioBuilder from "@/components/studio/StudioBuilder";
import type { Category } from "@/lib/closet/categories";
import type { ClosetItem } from "@/lib/closet/types";
import { getDb } from "@/lib/db/client";
import { items } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export default async function StudioPage({
  searchParams,
}: {
  searchParams: Promise<{ items?: string }>;
}) {
  const all = await getDb().select().from(items).orderBy(desc(items.createdAt));
  // ?items=id1,id2 pre-fills the builder ("Open in Studio" everywhere).
  // Unknown ids drop silently; first item per category wins.
  const { items: preload } = await searchParams;
  const wanted = new Set((preload ?? "").split(",").filter(Boolean));
  const initialSelected: Partial<Record<Category, ClosetItem>> = {};
  for (const item of all) {
    if (wanted.has(item.id) && !initialSelected[item.category]) {
      initialSelected[item.category] = item;
    }
  }
  return (
    <>
      <PageHeader title="Studio" />
      <StudioBuilder items={all} initialSelected={initialSelected} />
    </>
  );
}
