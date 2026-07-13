import { describe, expect, it } from "vitest";
import { splitColumns } from "./masonry";
import type { Pin } from "./pexels";

const pin = (id: number, height: number): Pin => ({
  pexelsId: id,
  width: 800,
  height,
  alt: "",
  photographer: "",
  photographerUrl: "",
  pexelsUrl: "",
  imageUrl: "/fixtures/pin-1.svg",
});

describe("splitColumns", () => {
  it("packs each pin into the currently shortest column (ties go left)", () => {
    const cols = splitColumns([pin(1, 1600), pin(2, 800), pin(3, 800), pin(4, 800)], 2);
    expect(cols[0].map((p) => p.pexelsId)).toEqual([1, 4]);
    expect(cols[1].map((p) => p.pexelsId)).toEqual([2, 3]);
  });

  it("appending pins never moves earlier pins", () => {
    const first = [pin(1, 900), pin(2, 1300), pin(3, 700)];
    const more = [...first, pin(4, 1000), pin(5, 1100)];
    const a = splitColumns(first, 2);
    const b = splitColumns(more, 2);
    expect(b[0].slice(0, a[0].length)).toEqual(a[0]);
    expect(b[1].slice(0, a[1].length)).toEqual(a[1]);
  });

  it("a single column keeps feed order", () => {
    expect(splitColumns([pin(1, 500), pin(2, 900)], 1)[0].map((p) => p.pexelsId)).toEqual([1, 2]);
  });
});
