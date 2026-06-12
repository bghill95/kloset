import { NextRequest, NextResponse } from "next/server";
import { windowEvents } from "@/lib/context/events";
import { deleteSetting, setSetting } from "@/lib/db/settings";

// iCloud hands out webcal:// links; they're https underneath.
function normalizeIcsUrl(raw: string): string | null {
  const normalized = raw.trim().replace(/^webcal:\/\//i, "https://");
  if (!/^https:\/\//i.test(normalized)) return null;
  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    return null;
  }
  const host = parsed.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".local") ||
    /^127\.|^10\.|^192\.168\.|^169\.254\.|^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    host === "::1" ||
    host === "[::1]"
  ) {
    return null;
  }
  return normalized;
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const raw = (body as { icsUrl?: unknown })?.icsUrl;
  if (typeof raw !== "string" || raw.trim().length === 0) {
    return NextResponse.json({ error: "icsUrl is required." }, { status: 400 });
  }
  const icsUrl = normalizeIcsUrl(raw);
  if (!icsUrl) {
    return NextResponse.json(
      { error: "That doesn't look like a webcal:// or https:// link." },
      { status: 400 },
    );
  }

  if (process.env.MOCK_AI === "1") {
    await setSetting("icsUrl", icsUrl);
    return NextResponse.json({ ok: true, eventCount: 2 });
  }

  try {
    const res = await fetch(icsUrl, {
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: `Calendar URL responded with ${res.status}.` },
        { status: 400 },
      );
    }
    const text = await res.text();
    if (text.length > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Calendar feed too large." },
        { status: 400 },
      );
    }
    if (!text.includes("BEGIN:VCALENDAR")) {
      return NextResponse.json(
        { error: "That URL doesn't serve an ICS calendar." },
        { status: 400 },
      );
    }
    const from = new Date();
    const to = new Date(from.getTime() + 7 * 24 * 60 * 60 * 1000);
    const events = windowEvents(text, from, to);
    await setSetting("icsUrl", icsUrl);
    return NextResponse.json({ ok: true, eventCount: events.length });
  } catch (err) {
    console.error("[settings/calendar] test failed:", err);
    return NextResponse.json(
      { error: "Couldn't reach that URL." },
      { status: 400 },
    );
  }
}

export async function DELETE() {
  await deleteSetting("icsUrl");
  return NextResponse.json({ ok: true });
}
