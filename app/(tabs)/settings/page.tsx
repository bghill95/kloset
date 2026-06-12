import { asc } from "drizzle-orm";
import AvatarSection from "@/components/avatar/AvatarSection";
import { getDb } from "@/lib/db/client";
import { basePhotos } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const photos = await getDb()
    .select()
    .from(basePhotos)
    .orderBy(asc(basePhotos.createdAt));

  return (
    <>
      <h1 className="text-2xl font-semibold">Settings</h1>
      <div className="mt-6 flex flex-col gap-8">
        <AvatarSection photos={photos} />
        <section aria-label="Passcode">
          <h2 className="text-lg font-semibold">Passcode</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Passcode management arrives in a later milestone.
          </p>
        </section>
      </div>
    </>
  );
}
