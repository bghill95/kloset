import { desc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { type PackingPick, suggestPacking } from "@/lib/ai/packing";
import { UUID_RE } from "@/lib/closet/item-validation";
import { fixtureForecastRange } from "@/lib/context/fixtures";
import {
  buildForecastRangeUrl,
  clampForecastWindow,
  type DayForecast,
  summarizeForecastRange,
} from "@/lib/context/weather";
import { getDb } from "@/lib/db/client";
import { items, preferences, trips } from "@/lib/db/schema";
import { prefsSignal } from "@/lib/prefs/aggregate";
import { localDateKey } from "@/lib/today/date";
import { joinCapsule } from "@/lib/trips/capsule";
import { tripDays } from "@/lib/trips/validation";

const REVALIDATE_SECONDS = 900;

type Ctx = { params: Promise<{ id: string }> };

// (Re)generate the packing capsule; ticks survive for items still in it.
export async function POST(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  const db = getDb();
  const [trip] = await db.select().from(trips).where(eq(trips.id, id));
  if (!trip) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const all = await db.select().from(items).orderBy(desc(items.createdAt));
  const votes = await db.select().from(preferences);
  const prefs = votes.length > 0 ? prefsSignal(votes, all) : null;

  // Forecast degrades to null; packing still works without it.
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

  let picks: PackingPick[];
  try {
    picks = await suggestPacking(all, {
      destination: trip.destination,
      startDate: trip.startDate,
      endDate: trip.endDate,
      days: tripDays(trip.startDate, trip.endDate),
      forecast,
      prefs,
    });
  } catch (err) {
    console.error("[trips] packing failed:", err);
    return NextResponse.json({ error: "Couldn't build the capsule — try again." }, { status: 502 });
  }

  const pickIds = new Set(picks.map((p) => p.itemId));
  const packedIds = trip.packedIds.filter((pid) => pickIds.has(pid));
  await db
    .update(trips)
    .set({ capsule: JSON.stringify(picks), packedIds })
    .where(eq(trips.id, id));
  return NextResponse.json({ capsule: joinCapsule(picks, all), packedIds });
}
