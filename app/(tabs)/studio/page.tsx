import { desc } from "drizzle-orm";
import PageHeader from "@/components/shell/PageHeader";
import StudioBuilder from "@/components/studio/StudioBuilder";
import { getDb } from "@/lib/db/client";
import { items } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export default async function StudioPage() {
  const all = await getDb().select().from(items).orderBy(desc(items.createdAt));
  return (
    <>
      <PageHeader title="Studio" />
      <StudioBuilder items={all} />
    </>
  );
}
