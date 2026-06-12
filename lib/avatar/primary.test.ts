import { describe, expect, it } from "vitest";
import { pickPrimary, validatePrimaryPatch } from "./primary";

const photo = (id: string, isPrimary: boolean, createdAt: string) => ({
  id,
  isPrimary,
  createdAt: new Date(createdAt),
});

describe("pickPrimary", () => {
  it("returns null when no photos remain", () => {
    expect(pickPrimary([])).toBeNull();
  });

  it("returns null when a primary still exists", () => {
    expect(
      pickPrimary([photo("a", true, "2026-01-01"), photo("b", false, "2026-01-02")]),
    ).toBeNull();
  });

  it("promotes the oldest remaining photo when none is primary", () => {
    expect(
      pickPrimary([photo("b", false, "2026-01-02"), photo("a", false, "2026-01-01")]),
    ).toBe("a");
  });
});

describe("validatePrimaryPatch", () => {
  it("accepts exactly { isPrimary: true }", () => {
    expect(validatePrimaryPatch({ isPrimary: true })).toBe(true);
  });

  it.each([
    ["false", { isPrimary: false }],
    ["extra keys", { isPrimary: true, imageUrl: "x" }],
    ["empty", {}],
    ["non-object", "yes"],
    ["null", null],
  ])("rejects %s", (_label, raw) => {
    expect(validatePrimaryPatch(raw)).toBe(false);
  });
});
