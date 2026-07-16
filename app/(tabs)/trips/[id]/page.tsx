import { eq, inArray } from "drizzle-orm";
import { notFound } from "next/navigation";
import PageHeader from "@/components/shell/PageHeader";
import TripDetail from "@/components/trips/TripDetail";
import { UUID_RE } from "@/lib/closet/item-validation";
import { fixtureForecastRange } from "@/lib/context/fixtures";
import {
  buildForecastRangeUrl,
  clampForecastWindow,
  type DayForecast,
  summarizeForecastRange,
} from "@/lib/context/weather";
import { getDb } from "@/lib/db/client";
import { items, trips } from "@/lib/db/schema";
import { localDateKey } from "@/lib/today/date";
import { joinCapsule, parseCapsule } from "@/lib/trips/capsule";

export const dynamic = "force-dynamic";

const REVALIDATE_SECONDS = 900;

export default async function TripPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const db = getDb();
  const [trip] = await db.select().from(trips).where(eq(trips.id, id));
  if (!trip) notFound();

  const picks = parseCapsule(trip.capsule);
  const capsuleItems =
    picks.length > 0
      ? await db.select().from(items).where(inArray(items.id, picks.map((p) => p.itemId)))
      : [];
  const capsule = joinCapsule(picks, capsuleItems);

  // Forecast strip appears once any trip day is inside the 16-day horizon.
  let forecast: DayForecast[] | null = null;
  const window = clampForecastWindow(trip.startDate, trip.endDate, localDateKey());
  if (window) {
    if (process.env.MOCK_AI === "1") {
      forecast = fixtureForecastRange(window.start, window.end);
    } else {
      try {
        const res = await fetch(buildForecastRangeUrl(trip.lat, trip.lon, window.start, window.end), {
          next: { revalidate: REVALIDATE_SECONDS },
          signal: AbortSignal.timeout(10_000),
        });
        if (res.ok) forecast = summarizeForecastRange(await res.json());
      } catch (err) {
        console.error("[trips] forecast fetch failed:", err);
      }
    }
  }

  return (
    <>
      <PageHeader title={trip.destination} />
      <p className="text-mute">
        {trip.startDate} – {trip.endDate}
      </p>
      <TripDetail
        tripId={trip.id}
        capsule={capsule}
        packedIds={trip.packedIds}
        forecast={forecast}
      />
    </>
  );
}
