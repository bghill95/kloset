import { desc } from "drizzle-orm";
import PageHeader from "@/components/shell/PageHeader";
import TodayCard from "@/components/today/TodayCard";
import { getDb } from "@/lib/db/client";
import { items } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const all = await getDb().select().from(items).orderBy(desc(items.createdAt));
  return (
    <>
      <PageHeader title="Today" />
      <TodayCard items={all} />
    </>
  );
}
