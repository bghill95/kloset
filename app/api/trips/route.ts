import { NextRequest, NextResponse } from "next/server";
import { FIXTURE_LOCATION } from "@/lib/context/fixtures";
import { buildGeocodeUrl, parseGeocode } from "@/lib/context/weather";
import { getDb } from "@/lib/db/client";
import { trips } from "@/lib/db/schema";
import { validateNewTrip } from "@/lib/trips/validation";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const parsed = validateNewTrip(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const { destination, startDate, endDate } = parsed.value;

  let lat = FIXTURE_LOCATION.lat;
  let lon = FIXTURE_LOCATION.lon;
  if (process.env.MOCK_AI !== "1") {
    try {
      const res = await fetch(buildGeocodeUrl(destination), {
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) throw new Error(String(res.status));
      const location = parseGeocode(await res.json());
      if (!location) {
        return NextResponse.json({ error: "No match for that destination." }, { status: 400 });
      }
      lat = location.lat;
      lon = location.lon;
    } catch (err) {
      console.error("[trips] geocode failed:", err);
      return NextResponse.json({ error: "Couldn't look that up — try again." }, { status: 400 });
    }
  }

  const [row] = await getDb()
    .insert(trips)
    .values({ destination, lat, lon, startDate, endDate })
    .returning();
  return NextResponse.json({ trip: row }, { status: 201 });
}
