import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/session";

const PUBLIC_PATHS = [
  /^\/login$/,
  /^\/setup$/,
  /^\/api\/auth\//,
  /^\/api\/health$/,
  /^\/manifest\.webmanifest$/,
  /^\/icon$/,
  /^\/apple-icon$/,
];

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC_PATHS.some((p) => p.test(pathname))) return NextResponse.next();

  const token = req.cookies.get("session")?.value;
  if (token && (await verifySession(token))) return NextResponse.next();

  return NextResponse.redirect(new URL("/login", req.url));
}

export const config = {
  matcher: ["/((?!_next|favicon.ico).*)"],
};
