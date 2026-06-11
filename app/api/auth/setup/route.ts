import { NextRequest, NextResponse } from "next/server";
import { setSessionCookie } from "@/lib/auth/cookies";
import { hashPasscode } from "@/lib/auth/passcode";
import { getSetting, setSetting } from "@/lib/db/settings";

export async function POST(req: NextRequest) {
  const { passcode } = (await req.json()) as { passcode?: string };

  if (typeof passcode !== "string" || passcode.length < 4) {
    return NextResponse.json(
      { error: "Passcode must be at least 4 characters." },
      { status: 400 },
    );
  }
  if (await getSetting("passcodeHash")) {
    return NextResponse.json(
      { error: "Passcode already configured." },
      { status: 409 },
    );
  }

  await setSetting("passcodeHash", await hashPasscode(passcode));
  await setSessionCookie();
  return NextResponse.json({ ok: true });
}
