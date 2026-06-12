import { describe, expect, it } from "vitest";
import { validateWindow } from "./window";

describe("validateWindow", () => {
  it("accepts a sane window", () => {
    const r = validateWindow("2026-06-11T07:00:00.000Z", "2026-06-13T07:00:00.000Z");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.from.toISOString()).toBe("2026-06-11T07:00:00.000Z");
      expect(r.to.toISOString()).toBe("2026-06-13T07:00:00.000Z");
    }
  });

  it.each([
    ["missing from", null, "2026-06-13T07:00:00.000Z"],
    ["garbage", "yesterday", "2026-06-13T07:00:00.000Z"],
    ["reversed", "2026-06-13T07:00:00.000Z", "2026-06-11T07:00:00.000Z"],
    ["over 7 days", "2026-06-01T00:00:00.000Z", "2026-06-09T00:00:01.000Z"],
  ])("rejects %s", (_label, from, to) => {
    expect(validateWindow(from, to).ok).toBe(false);
  });
});
