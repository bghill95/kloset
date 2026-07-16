import { desc } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { suggestOutfits, validateStylistBody } from "@/lib/ai/stylist";
import { FIXTURE_WEATHER } from "@/lib/context/fixtures";
import type { WeatherSummary } from "@/lib/context/types";
import { buildForecastUrl, summarizeForecast } from "@/lib/context/weather";
import { getDb } from "@/lib/db/client";
import { items, preferences } from "@/lib/db/schema";
import { getSetting } from "@/lib/db/settings";
import { prefsSignal } from "@/lib/prefs/aggregate";

const REVALIDATE_SECONDS = 900;

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const parsed = validateStylistBody(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const { count, occasion, date } = parsed.value;

  const all = await getDb().select().from(items).orderBy(desc(items.createdAt));

  const votes = await getDb().select().from(preferences);
  const prefs = votes.length > 0 ? prefsSignal(votes, all) : null;

  // Weather degrades to null; styling still works without it.
  let weather: WeatherSummary | null = null;
  if (date) {
    if (process.env.MOCK_AI === "1") {
      weather = FIXTURE_WEATHER;
    } else {
      try {
        const locationRaw = await getSetting("weatherLocation");
        if (locationRaw) {
          const location = JSON.parse(locationRaw) as { lat: number; lon: number };
          const res = await fetch(buildForecastUrl(location.lat, location.lon, date), {
            next: { revalidate: REVALIDATE_SECONDS },
            signal: AbortSignal.timeout(10_000),
          });
          if (res.ok) weather = summarizeForecast(await res.json());
        }
      } catch (err) {
        console.error("[stylist] weather fetch failed:", err);
      }
    }
  }

  let combos;
  try {
    combos = await suggestOutfits(all, { count, occasion, date, weather, prefs });
  } catch (err) {
    console.error("[stylist] suggestion failed:", err);
    return NextResponse.json({ error: "Styling failed — try again." }, { status: 502 });
  }

  const byId = new Map(all.map((i) => [i.id, i]));
  return NextResponse.json({
    outfits: combos.map((c) => ({
      name: c.name,
      reason: c.reason,
      // validateCombos guarantees every id resolves.
      items: c.itemIds.map((id) => byId.get(id)!),
    })),
  });
}
