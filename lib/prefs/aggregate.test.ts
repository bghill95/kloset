import { describe, expect, it } from "vitest";
import {
  hardDisliked,
  itemScores,
  prefsSignal,
  tasteLines,
  tasteProfile,
  type Vote,
} from "./aggregate";

const vote = (itemIds: string[], verdict: Vote["verdict"]): Vote => ({ itemIds, verdict });
const item = (id: string, styleTags: string[], colors: string[]) => ({ id, styleTags, colors });

describe("itemScores", () => {
  it("counts likes and dislikes per item across votes", () => {
    const scores = itemScores([vote(["a", "b"], "like"), vote(["a"], "dislike")]);
    expect(scores).toEqual({ a: { likes: 1, dislikes: 1 }, b: { likes: 1, dislikes: 0 } });
  });
});

describe("hardDisliked", () => {
  it("returns items whose dislikes outnumber likes", () => {
    const votes = [
      vote(["a"], "dislike"),
      vote(["a", "b"], "dislike"),
      vote(["a"], "like"),
      vote(["b"], "like"),
    ];
    expect(hardDisliked(votes)).toEqual(["a"]); // a: 2>1; b: 1==1 stays
  });
});

describe("tasteProfile", () => {
  it("nets tags and colors, normalized, ignoring unknown ids", () => {
    const items = [item("a", ["Minimalist"], ["black"]), item("b", ["neon"], ["black"])];
    const votes = [vote(["a"], "like"), vote(["b"], "dislike"), vote(["ghost"], "like")];
    expect(tasteProfile(votes, items)).toEqual({
      likedTags: ["minimalist"],
      dislikedTags: ["neon"],
      likedColors: [],  // black nets to 0 (one like, one dislike)
      dislikedColors: [],
    });
  });

  it("caps liked tags at 5 (MAX_TASTE) and orders by |net| desc then alphabetically", () => {
    const items = [
      item("1", ["a"], []),
      item("2", ["b"], []),
      item("3", ["c"], []),
      item("4", ["d"], []),
      item("5", ["e"], []),
      item("6", ["f"], []),
      item("7", ["g"], []),
    ];
    const votes = [
      vote(["3"], "like"), // c: +1
      vote(["3"], "like"), // c: +2
      vote(["3"], "like"), // c: +3
      vote(["4"], "like"), // d: +1
      vote(["4"], "like"), // d: +2
      vote(["1"], "like"), // a: +1
      vote(["2"], "like"), // b: +1
      vote(["5"], "like"), // e: +1
      vote(["6"], "like"), // f: +1
      vote(["7"], "like"), // g: +1
    ];
    const profile = tasteProfile(votes, items);
    // c (3), d (2), then a, b, e, f, g (1 each, alphabetically) → c, d, a, b, e (capped at 5)
    expect(profile.likedTags).toEqual(["c", "d", "a", "b", "e"]);
  });
});

describe("empty votes", () => {
  it("produce empty scores, no hard dislikes, and empty profile", () => {
    const items = [item("a", ["boho"], ["red"])];
    expect(itemScores([])).toEqual({});
    expect(hardDisliked([])).toEqual([]);
    expect(tasteProfile([], items)).toEqual({
      likedTags: [],
      dislikedTags: [],
      likedColors: [],
      dislikedColors: [],
    });
  });
});

describe("tasteLines", () => {
  it("renders like/avoid lines and nothing when empty", () => {
    expect(
      tasteLines({ likedTags: ["boho"], dislikedTags: [], likedColors: ["red"], dislikedColors: ["neon green"] }),
    ).toEqual([
      "Her feedback says she likes: boho, red.",
      "Her feedback says to avoid: neon green.",
    ]);
    expect(tasteLines({ likedTags: [], dislikedTags: [], likedColors: [], dislikedColors: [] })).toEqual([]);
  });
});

describe("prefsSignal", () => {
  it("bundles scores and profile", () => {
    const items = [item("a", ["boho"], [])];
    const s = prefsSignal([vote(["a"], "like")], items);
    expect(s.scores.a.likes).toBe(1);
    expect(s.profile.likedTags).toEqual(["boho"]);
  });
});
