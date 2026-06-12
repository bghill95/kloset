import { describe, expect, it } from "vitest";
import { distinctColors, filterItems } from "./filter";

const items = [
  { category: "top", colors: ["white", "blue"] },
  { category: "top", colors: ["red"] },
  { category: "shoes", colors: ["white"] },
];

describe("filterItems", () => {
  it("returns everything with no filters", () => {
    expect(filterItems(items, {})).toHaveLength(3);
  });

  it("filters by category", () => {
    expect(filterItems(items, { category: "top" })).toHaveLength(2);
  });

  it("filters by color", () => {
    expect(filterItems(items, { color: "white" })).toHaveLength(2);
  });

  it("combines category and color", () => {
    expect(filterItems(items, { category: "top", color: "white" })).toEqual([
      items[0],
    ]);
  });

  it("treats empty-string filters as no filter", () => {
    expect(filterItems(items, { category: "", color: "" })).toHaveLength(3);
  });
});

describe("distinctColors", () => {
  it("returns sorted unique colors", () => {
    expect(distinctColors(items)).toEqual(["blue", "red", "white"]);
  });
});
