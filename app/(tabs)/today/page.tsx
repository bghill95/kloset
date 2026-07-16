import { desc } from "drizzle-orm";
import PageHeader from "@/components/shell/PageHeader";
import TodayCard from "@/components/today/TodayCard";
import { getDb } from "@/lib/db/client";
import { items, preferences } from "@/lib/db/schema";
import { hardDisliked } from "@/lib/prefs/aggregate";

export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const all = await getDb().select().from(items).orderBy(desc(items.createdAt));
  const votes = await getDb().select().from(preferences);
  const dislikedIds = hardDisliked(votes);
  return (
    <>
      <PageHeader title="Today" />
      <TodayCard items={all} dislikedIds={dislikedIds} />
    </>
  );
}
