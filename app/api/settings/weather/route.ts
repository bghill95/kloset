import { NextRequest, NextResponse } from "next/server";
import { FIXTURE_LOCATION } from "@/lib/context/fixtures";
import { buildGeocodeUrl, parseGeocode } from "@/lib/context/weather";
import { deleteSetting, setSetting } from "@/lib/db/settings";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const query = (body as { query?: unknown })?.query;
  if (
    typeof query !== "string" ||
    query.trim().length === 0 ||
    query.length > 100
  ) {
    return NextResponse.json(
      { error: "Enter a city name (max 100 chars)." },
      { status: 400 },
    );
  }

  if (process.env.MOCK_AI === "1") {
    await setSetting("weatherLocation", JSON.stringify(FIXTURE_LOCATION));
    return NextResponse.json({ ok: true, location: FIXTURE_LOCATION });
  }

  try {
    const res = await fetch(buildGeocodeUrl(query.trim()), {
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(String(res.status));
    const location = parseGeocode(await res.json());
    if (!location) {
      return NextResponse.json(
        { error: "No match for that city." },
        { status: 400 },
      );
    }
    await setSetting("weatherLocation", JSON.stringify(location));
    return NextResponse.json({ ok: true, location });
  } catch (err) {
    console.error("[settings/weather] geocode failed:", err);
    return NextResponse.json(
      { error: "Couldn't look that up — try again." },
      { status: 400 },
    );
  }
}

export async function DELETE() {
  await deleteSetting("weatherLocation");
  return NextResponse.json({ ok: true });
}
