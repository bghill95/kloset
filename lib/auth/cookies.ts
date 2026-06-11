import { cookies } from "next/headers";
import { createSession } from "./session";

export const SESSION_COOKIE = "session";

export async function setSessionCookie(): Promise<void> {
  const token = await createSession();
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30, // keep in sync with SESSION_DURATION ("30d") in session.ts
    path: "/",
  });
}
