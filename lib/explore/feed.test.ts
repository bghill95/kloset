import { describe, expect, it } from "vitest";
import type { Pin } from "./pinterest";
import { PER_PAGE, pageFeed, rowToPin, savedRowToPin } from "./feed";

function pin(n: number, alt = `pin ${n}`, credit = "Board A"): Pin {
  return {
    source: "pinterest",
    externalId: String(n).padStart(3, "0"),
    width: 800,
    height: 1000,
    alt,
    credit,
    creditUrl: "",
    sourceUrl: "https://www.pinterest.com",
    imageUrl: "/fixtures/pin-1.svg",
  };
}
const NINETY = Array.from({ length: 90 }, (_, i) => pin(i + 1));

describe("pageFeed", () => {
  it("pages 90 pins as 3 pages of PER_PAGE", () => {
    const p1 = pageFeed(NINETY, 1, 7);
    const p3 = pageFeed(NINETY, 3, 7);
    expect(p1.pins).toHaveLength(PER_PAGE);
    expect(p1.hasMore).toBe(true);
    expect(p3.pins).toHaveLength(PER_PAGE);
    expect(p3.hasMore).toBe(false);
    expect(pageFeed(NINETY, 4, 7).pins).toHaveLength(0);
  });

  it("same seed reproduces the shuffle; a different seed changes it", () => {
    const a = pageFeed(NINETY, 1, 42).pins.map((p) => p.externalId);
    const b = pageFeed(NINETY, 1, 42).pins.map((p) => p.externalId);
    const c = pageFeed(NINETY, 1, 43).pins.map((p) => p.externalId);
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });

  it("search filters by alt and board name, case-insensitive, preserving order", () => {
    const all = [pin(1, "Linen set"), pin(2, "Denim", "Parisian Chic"), pin(3, "linen dress")];
    expect(pageFeed(all, 1, 1, "LINEN").pins.map((p) => p.externalId)).toEqual(["001", "003"]);
    expect(pageFeed(all, 1, 1, "parisian").pins.map((p) => p.externalId)).toEqual(["002"]);
    expect(pageFeed(all, 1, 1, "nope").pins).toEqual([]);
  });
});

describe("row mappers", () => {
  it("rowToPin maps a cache row, falling back to description for alt", () => {
    const p = rowToPin({
      id: "9",
      boardId: "b",
      boardName: "Fits",
      title: "",
      description: "desc",
      link: "https://www.pinterest.com/pin/9/",
      imageUrl: "https://i.pinimg.com/x.jpg",
      width: 10,
      height: 20,
      savedAt: null,
      syncedAt: new Date(),
    });
    expect(p).toEqual({
      source: "pinterest",
      externalId: "9",
      width: 10,
      height: 20,
      alt: "desc",
      credit: "Fits",
      creditUrl: "",
      sourceUrl: "https://www.pinterest.com/pin/9/",
      imageUrl: "https://i.pinimg.com/x.jpg",
    });
  });

  it("savedRowToPin maps the legacy column names", () => {
    const p = savedRowToPin({
      id: "uuid-1",
      source: "pinterest",
      externalId: "9",
      pexelsId: null,
      imageUrl: "/x.jpg",
      alt: "a",
      photographer: "Fits",
      photographerUrl: "",
      pexelsUrl: "https://www.pinterest.com/pin/9/",
      width: 1,
      height: 2,
      createdAt: new Date(),
    });
    expect(p.id).toBe("uuid-1");
    expect(p.credit).toBe("Fits");
    expect(p.sourceUrl).toBe("https://www.pinterest.com/pin/9/");
  });
});
