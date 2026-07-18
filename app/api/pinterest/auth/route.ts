// app/api/pinterest/auth/route.ts
import { NextRequest, NextResponse } from "next/server";
import { deleteSetting } from "@/lib/db/settings";
import {
  PINTEREST_AUTH_KEY,
  getAuthorizeUrl,
  isPinterestMock,
  requestOrigin,
} from "@/lib/explore/pinterest";

// Kicks off the OAuth dance. In mock mode there is nothing to connect —
// bounce straight back to Settings.
export async function GET(req: NextRequest) {
  const origin = requestOrigin(req.headers);
  if (isPinterestMock()) return NextResponse.redirect(new URL("/settings", origin));
  const state = crypto.randomUUID();
  const res = NextResponse.redirect(
    getAuthorizeUrl(state, `${origin}/api/pinterest/callback`),
  );
  res.cookies.set("pinterest_state", state, { httpOnly: true, maxAge: 600, path: "/" });
  return res;
}

// Disconnect: forget the tokens. Cached pins stay until the next sync.
export async function DELETE() {
  await deleteSetting(PINTEREST_AUTH_KEY);
  return NextResponse.json({ ok: true });
}
