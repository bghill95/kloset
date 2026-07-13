import { asc } from "drizzle-orm";
import AvatarSection from "@/components/avatar/AvatarSection";
import CalendarSection from "@/components/context/CalendarSection";
import WeatherSection from "@/components/context/WeatherSection";
import PageHeader from "@/components/shell/PageHeader";
import { getDb } from "@/lib/db/client";
import { basePhotos } from "@/lib/db/schema";
import { getSetting } from "@/lib/db/settings";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [photos, icsUrl, weatherLocationRaw] = await Promise.all([
    getDb().select().from(basePhotos).orderBy(asc(basePhotos.createdAt)),
    getSetting("icsUrl"),
    getSetting("weatherLocation"),
  ]);

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
      </div>
    </>
  );
}
