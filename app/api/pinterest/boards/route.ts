// app/api/pinterest/boards/route.ts
import { NextRequest, NextResponse } from "next/server";
import { setSetting } from "@/lib/db/settings";
import { getFreshAccessToken, listBoards } from "@/lib/explore/pinterest";
import { PINTEREST_BOARDS_KEY, getSelectedBoards } from "@/lib/explore/sync";
import { validateBoardsBody } from "@/lib/explore/validation";

export async function GET() {
  // getFreshAccessToken throws on a refresh failure (transient) and returns
  // null only when not connected — keep it inside the try so a Pinterest
  // hiccup 502s with a friendly message instead of an unhandled 500.
  try {
    const token = await getFreshAccessToken();
    if (!token) {
      return NextResponse.json({ error: "Pinterest is not connected." }, { status: 401 });
    }
    const [boards, selected] = await Promise.all([listBoards(token), getSelectedBoards()]);
    return NextResponse.json({ boards, selectedIds: selected.map((b) => b.id) });
  } catch (err) {
    console.error("[pinterest] board list failed:", err);
    return NextResponse.json({ error: "Couldn't load boards — try again." }, { status: 502 });
  }
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const parsed = validateBoardsBody(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  await setSetting(PINTEREST_BOARDS_KEY, JSON.stringify(parsed.value));
  return NextResponse.json({ ok: true });
}
