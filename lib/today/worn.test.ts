import { describe, expect, it } from "vitest";
import { findWornMatch } from "./worn";

describe("findWornMatch", () => {
  const wear = { outfitId: "o1", itemIds: ["a", "b", "c"] };

  it("matches regardless of order", () => {
    expect(findWornMatch([wear], ["c", "a", "b"])).toBe("o1");
  });

  it("rejects subsets and supersets", () => {
    expect(findWornMatch([wear], ["a", "b"])).toBeNull();
    expect(findWornMatch([wear], ["a", "b", "c", "d"])).toBeNull();
  });

  it("returns null with no wears", () => {
    expect(findWornMatch([], ["a"])).toBeNull();
  });
});
