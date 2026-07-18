import { desc } from "drizzle-orm";
import ExploreFeed from "@/components/explore/ExploreFeed";
import PageHeader from "@/components/shell/PageHeader";
import { getDb } from "@/lib/db/client";
import { pins } from "@/lib/db/schema";
import { savedRowToPin } from "@/lib/explore/feed";

export const dynamic = "force-dynamic";

export default async function ExplorePage() {
  const rows = await getDb().select().from(pins).orderBy(desc(pins.createdAt));
  return (
    <>
      <PageHeader title="Explore" />
      <ExploreFeed savedPins={rows.map(savedRowToPin)} />
    </>
  );
}
