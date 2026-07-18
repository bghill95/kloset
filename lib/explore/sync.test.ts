import { describe, expect, it } from "vitest";
import { isStale } from "./sync";

describe("isStale", () => {
  const NOW = 1_800_000_000_000;
  it("null, garbage, and >1h-old stamps are stale", () => {
    expect(isStale(null, NOW)).toBe(true);
    expect(isStale("not-a-number", NOW)).toBe(true);
    expect(isStale(String(NOW - 61 * 60_000), NOW)).toBe(true);
  });
  it("a fresh stamp is not stale", () => {
    expect(isStale(String(NOW - 59 * 60_000), NOW)).toBe(false);
  });
});
