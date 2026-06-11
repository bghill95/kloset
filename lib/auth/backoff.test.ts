import { describe, expect, it } from "vitest";
import { lockoutMs } from "./backoff";

describe("lockoutMs", () => {
  it("no lockout below 5 failed attempts", () => {
    expect(lockoutMs(0)).toBe(0);
    expect(lockoutMs(4)).toBe(0);
  });

  it("starts at 30s on the 5th failure and doubles", () => {
    expect(lockoutMs(5)).toBe(30_000);
    expect(lockoutMs(6)).toBe(60_000);
    expect(lockoutMs(7)).toBe(120_000);
  });

  it("caps at 64 minutes", () => {
    expect(lockoutMs(12)).toBe(3_840_000);
    expect(lockoutMs(50)).toBe(3_840_000);
  });
});
