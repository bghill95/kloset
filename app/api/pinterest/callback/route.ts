// app/api/pinterest/callback/route.ts
import { NextRequest, NextResponse } from "next/server";
import { setSetting } from "@/lib/db/settings";
import { PINTEREST_AUTH_KEY, exchangeCode, requestOrigin } from "@/lib/explore/pinterest";

export async function GET(req: NextRequest) {
  const origin = requestOrigin(req.headers);
  const fail = (msg: string) =>
    NextResponse.redirect(new URL(`/settings?pinterest_error=${encodeURIComponent(msg)}`, origin));
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const cookieState = req.cookies.get("pinterest_state")?.value;
  if (!code || !state || !cookieState || state !== cookieState) {
    return fail("Pinterest connect failed — try again.");
  }
  try {
    const auth = await exchangeCode(code, `${origin}/api/pinterest/callback`);
    await setSetting(PINTEREST_AUTH_KEY, JSON.stringify(auth));
  } catch (err) {
    console.error("[pinterest] token exchange failed:", err);
    return fail("Pinterest connect failed — try again.");
  }
  const res = NextResponse.redirect(new URL("/settings", origin));
  res.cookies.delete("pinterest_state");
  return res;
}
