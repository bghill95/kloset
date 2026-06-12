import { eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import ItemDetailForm from "@/components/closet/ItemDetailForm";
import { UUID_RE } from "@/lib/closet/item-validation";
import { getDb } from "@/lib/db/client";
import { items } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export default async function ItemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const [item] = await getDb().select().from(items).where(eq(items.id, id));
  if (!item) notFound();

  return (
    <>
      <Link href="/closet" className="text-sm text-neutral-500">
        ← Closet
      </Link>
      <h1 className="mt-1 mb-4 text-2xl font-semibold">{item.name}</h1>
      <ItemDetailForm item={item} />
    </>
  );
}
