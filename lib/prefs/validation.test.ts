import { describe, expect, it } from "vitest";
import { validateItemsParam, validateVoteBody, voteKey } from "./validation";

const A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

describe("voteKey", () => {
  it("is order- and case-insensitive", () => {
    expect(voteKey([B, A.toUpperCase()])).toBe(`${A},${B}`);
    expect(voteKey([A, B])).toBe(voteKey([B, A]));
  });
});

describe("validateVoteBody", () => {
  it("accepts a vote and defaults source to stylist", () => {
    expect(validateVoteBody({ itemIds: [A, B], verdict: "like" })).toEqual({
      ok: true,
      value: { itemIds: [A, B], verdict: "like", source: "stylist" },
    });
  });

  it("accepts an explicit source and dislike", () => {
    const r = validateVoteBody({ itemIds: [A], verdict: "dislike", source: "today" });
    expect(r.ok && r.value.source).toBe("today");
  });

  it("rejects bad verdicts, sources, ids, and non-objects", () => {
    expect(validateVoteBody(null).ok).toBe(false);
    expect(validateVoteBody({ itemIds: [A], verdict: "meh" }).ok).toBe(false);
    expect(validateVoteBody({ itemIds: [A], verdict: "like", source: "explore" }).ok).toBe(false);
    expect(validateVoteBody({ itemIds: ["nope"], verdict: "like" }).ok).toBe(false);
    expect(validateVoteBody({ itemIds: [], verdict: "like" }).ok).toBe(false);
  });
});

describe("validateItemsParam", () => {
  it("parses a comma list of uuids", () => {
    expect(validateItemsParam(`${A},${B}`)).toEqual({ ok: true, value: [A, B] });
  });

  it("rejects missing, empty, and malformed params", () => {
    expect(validateItemsParam(null).ok).toBe(false);
    expect(validateItemsParam("").ok).toBe(false);
    expect(validateItemsParam(`${A},junk`).ok).toBe(false);
  });
});
