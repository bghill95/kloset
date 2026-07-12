import { describe, expect, it } from "vitest";
import { validateNewWear } from "./validation";

const UUID = "6f1c2ad0-0000-4000-8000-000000000001";

describe("validateNewWear", () => {
  it("accepts a uuid + date key", () => {
    const r = validateNewWear({ outfitId: UUID, wornOn: "2026-07-11" });
    expect(r.ok && r.value).toEqual({ outfitId: UUID, wornOn: "2026-07-11" });
  });

  it("rejects a non-uuid outfitId", () => {
    expect(validateNewWear({ outfitId: "nope", wornOn: "2026-07-11" }).ok).toBe(false);
  });

  it("rejects malformed dates", () => {
    for (const wornOn of ["2026-7-1", "July 11", "2026-07-11T00:00:00Z", 20260711]) {
      expect(validateNewWear({ outfitId: UUID, wornOn }).ok).toBe(false);
    }
  });

  it("rejects non-objects", () => {
    expect(validateNewWear(null).ok).toBe(false);
    expect(validateNewWear("x").ok).toBe(false);
  });
});
