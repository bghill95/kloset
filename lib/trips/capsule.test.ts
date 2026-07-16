import { describe, expect, it } from "vitest";
import { joinCapsule, parseCapsule } from "./capsule";

describe("parseCapsule", () => {
  it("parses stored picks and drops malformed entries", () => {
    const raw = JSON.stringify([
      { itemId: "a", role: "Everyday top" },
      { itemId: 7, role: "bad" },
      "junk",
    ]);
    expect(parseCapsule(raw)).toEqual([{ itemId: "a", role: "Everyday top" }]);
  });

  it("returns [] on garbage", () => {
    expect(parseCapsule("not json")).toEqual([]);
    expect(parseCapsule('{"itemId":"a"}')).toEqual([]);
  });
});

describe("joinCapsule", () => {
  it("joins names/images and drops deleted items", () => {
    const picks = [
      { itemId: "a", role: "Everyday top" },
      { itemId: "gone", role: "Ghost" },
    ];
    const items = [{ id: "a", name: "White tee", imageUrl: "/tee.svg" }];
    expect(joinCapsule(picks, items)).toEqual([
      { itemId: "a", role: "Everyday top", name: "White tee", imageUrl: "/tee.svg" },
    ]);
  });
});
