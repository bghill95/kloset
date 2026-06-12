import { NextRequest, NextResponse } from "next/server";
import { getSetting } from "@/lib/db/settings";
import { windowEvents } from "@/lib/context/events";
import { FIXTURE_WEATHER, fixtureEvents } from "@/lib/context/fixtures";
import type { ContextResponse, WeatherSummary } from "@/lib/context/types";
import { buildForecastUrl, summarizeForecast } from "@/lib/context/weather";
import { validateWindow } from "@/lib/context/window";

const REVALIDATE_SECONDS = 900;

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const window = validateWindow(searchParams.get("from"), searchParams.get("to"));
  if (!window.ok) {
    return NextResponse.json({ error: window.error }, { status: 400 });
  }

  if (process.env.MOCK_AI === "1") {
    const body: ContextResponse = {
      events: fixtureEvents(window.from),
      weather: FIXTURE_WEATHER,
      configured: { calendar: true, weather: true },
    };
    return NextResponse.json(body);
  }

  const [icsUrl, locationRaw] = await Promise.all([
    getSetting("icsUrl"),
    getSetting("weatherLocation"),
  ]);

  // Context is allowed to fail; the app isn't. Each half degrades alone.
  let events: ContextResponse["events"] = [];
  if (icsUrl) {
    try {
      const res = await fetch(icsUrl, {
        next: { revalidate: REVALIDATE_SECONDS },
      });
      if (res.ok) {
        events = windowEvents(await res.text(), window.from, window.to);
      }
    } catch (err) {
      console.error("[context] ICS fetch failed:", err);
    }
  }

  let weather: WeatherSummary | null = null;
  if (locationRaw) {
    try {
      const location = JSON.parse(locationRaw) as { lat: number; lon: number };
      const res = await fetch(buildForecastUrl(location.lat, location.lon), {
        next: { revalidate: REVALIDATE_SECONDS },
      });
      if (res.ok) weather = summarizeForecast(await res.json());
    } catch (err) {
      console.error("[context] weather fetch failed:", err);
    }
  }

  const body: ContextResponse = {
    events,
    weather,
    configured: { calendar: Boolean(icsUrl), weather: Boolean(locationRaw) },
  };
  return NextResponse.json(body);
}
