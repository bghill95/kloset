import { NextRequest, NextResponse } from "next/server";
import { lockoutMs } from "@/lib/auth/backoff";
import { setSessionCookie } from "@/lib/auth/cookies";
import { verifyPasscode } from "@/lib/auth/passcode";
import { deleteSetting, getSetting, setSetting } from "@/lib/db/settings";

export async function POST(req: NextRequest) {
  const { passcode } = (await req.json()) as { passcode?: string };
  if (typeof passcode !== "string") {
    return NextResponse.json({ error: "Passcode required." }, { status: 400 });
  }

  const hash = await getSetting("passcodeHash");
  if (!hash) {
    return NextResponse.json({ error: "setup_required" }, { status: 409 });
  }

  const failedAttempts = Number((await getSetting("failedAttempts")) ?? "0");
  const lastFailedAt = Number((await getSetting("lastFailedAt")) ?? "0");
  const lockedUntil = lastFailedAt + lockoutMs(failedAttempts);
  if (Date.now() < lockedUntil) {
    return NextResponse.json(
      { error: "locked", retryAfterMs: lockedUntil - Date.now() },
      { status: 429 },
    );
  }

  if (!(await verifyPasscode(passcode, hash))) {
    // Read-then-write without a transaction: concurrent failures may undercount.
    // Intentional — single-user app; lockout still engages within an attempt or two.
    await setSetting("failedAttempts", String(failedAttempts + 1));
    await setSetting("lastFailedAt", String(Date.now()));
    return NextResponse.json({ error: "Wrong passcode." }, { status: 401 });
  }

  await deleteSetting("failedAttempts");
  await deleteSetting("lastFailedAt");
  await setSessionCookie();
  return NextResponse.json({ ok: true });
}
