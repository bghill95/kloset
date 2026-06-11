import { SignJWT, jwtVerify } from "jose";

const SESSION_DURATION = "30d";

function secret(): Uint8Array {
  const value = process.env.SESSION_SECRET;
  if (!value) throw new Error("SESSION_SECRET is not set");
  return new TextEncoder().encode(value);
}

export async function createSession(): Promise<string> {
  return new SignJWT({ scope: "app" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(SESSION_DURATION)
    .sign(secret());
}

export async function verifySession(token: string): Promise<boolean> {
  try {
    // The payload ({ scope: "app" }) is intentionally not inspected: single-user
    // app — any token with a valid signature and unexpired claims is authorized.
    await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    return true;
  } catch {
    return false;
  }
}
