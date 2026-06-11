import { beforeAll, describe, expect, it } from "vitest";
import { createSession, verifySession } from "./session";

beforeAll(() => {
  process.env.SESSION_SECRET = "test-secret-test-secret-test-secret!!";
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
    process.env.SESSION_SECRET = "test-secret-test-secret-test-secret!!";
  });
});
