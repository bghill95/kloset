import { asc } from "drizzle-orm";
import AvatarSection from "@/components/avatar/AvatarSection";
import CalendarSection from "@/components/context/CalendarSection";
import WeatherSection from "@/components/context/WeatherSection";
import PinterestSection from "@/components/settings/PinterestSection";
import PageHeader from "@/components/shell/PageHeader";
import { getDb } from "@/lib/db/client";
import { basePhotos } from "@/lib/db/schema";
import { getSetting } from "@/lib/db/settings";
import { PINTEREST_AUTH_KEY, isPinterestMock } from "@/lib/explore/pinterest";
import { PINTEREST_SYNCED_KEY } from "@/lib/explore/sync";

export const dynamic = "force-dynamic";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ pinterest_error?: string }>;
}) {
  const [photos, icsUrl, weatherLocationRaw, pinterestAuth, pinterestSyncedAt] =
    await Promise.all([
      getDb().select().from(basePhotos).orderBy(asc(basePhotos.createdAt)),
      getSetting("icsUrl"),
      getSetting("weatherLocation"),
      getSetting(PINTEREST_AUTH_KEY),
      getSetting(PINTEREST_SYNCED_KEY),
    ]);
  const { pinterest_error } = await searchParams;

  let weatherLabel: string | null = null;
  if (weatherLocationRaw) {
    try {
      weatherLabel = (JSON.parse(weatherLocationRaw) as { label?: string })
        .label ?? null;
    } catch {
      weatherLabel = null;
    }
  }

  return (
    <>
      <PageHeader title="Settings" />
      <div className="mt-6 flex flex-col gap-8">
        <AvatarSection photos={photos} />
        <CalendarSection currentUrl={icsUrl} />
        <WeatherSection currentLabel={weatherLabel} />
        <PinterestSection
          connected={!!pinterestAuth || isPinterestMock()}
          syncedAt={pinterestSyncedAt}
          connectError={pinterest_error ?? null}
        />
      </div>
      <p className="mt-16 pb-8 text-center text-xs font-medium text-ash">
        built by Pseudo Engineering Studios
      </p>
    </>
  );
}
