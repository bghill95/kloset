import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { SignJWT } from "jose";
import { createSession, verifySession } from "./session";

const TEST_SECRET = "test-secret-test-secret-test-secret!!";

beforeAll(() => {
  process.env.SESSION_SECRET = TEST_SECRET;
});

afterEach(() => {
  process.env.SESSION_SECRET = TEST_SECRET;
});

describe("session tokens", () => {
  it("round-trips a signed token", async () => {
    const token = await createSession();
    expect(await verifySession(token)).toBe(true);
  });

  it("rejects garbage", async () => {
    expect(await verifySession("not-a-token")).toBe(false);
  });

  it("rejects a token signed with a different secret", async () => {
    const token = await createSession();
    process.env.SESSION_SECRET = "a-completely-different-secret-value!!";
    expect(await verifySession(token)).toBe(false);
  });

  it("rejects an expired token", async () => {
    const now = Math.floor(Date.now() / 1000);
    const expired = await new SignJWT({ scope: "app" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt(now - 120)
      .setExpirationTime(now - 60)
      .sign(new TextEncoder().encode(TEST_SECRET));
    expect(await verifySession(expired)).toBe(false);
  });
});
