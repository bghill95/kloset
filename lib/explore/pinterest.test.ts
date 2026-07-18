import { afterEach, describe, expect, it } from "vitest";
import {
  MOCK_BOARDS,
  isPinterestMock,
  mockBoardPins,
  parseBoardPinsResponse,
  parseBoardsResponse,
} from "./pinterest";

const BOARD = { id: "b1", name: "Fits" };

describe("parseBoardsResponse", () => {
  it("maps items and passes the bookmark through", () => {
    const out = parseBoardsResponse({
      items: [{ id: "123", name: "Fall fits" }, { id: "456", name: "Paris" }],
      bookmark: "abc",
    });
    expect(out.boards).toEqual([
      { id: "123", name: "Fall fits" },
      { id: "456", name: "Paris" },
    ]);
    expect(out.bookmark).toBe("abc");
  });

  it("drops malformed entries and tolerates garbage", () => {
    const out = parseBoardsResponse({ items: [{ id: 5 }, null, { id: "9", name: "ok" }] });
    expect(out.boards).toEqual([{ id: "9", name: "ok" }]);
    expect(out.bookmark).toBeNull();
    expect(parseBoardsResponse(null)).toEqual({ boards: [], bookmark: null });
  });
});

describe("parseBoardPinsResponse", () => {
  const item = {
    id: "1104578219333637375", // > 2^53 — must stay a string
    created_at: "2026-07-01T10:00:00",
    title: "Linen set",
    description: "Summer look",
    link: "https://www.pinterest.com/pin/1104578219333637375/",
    media: {
      images: {
        "150x150": { width: 150, height: 150, url: "https://i.pinimg.com/150x150/a.jpg" },
        "1200x": { width: 1200, height: 1500, url: "https://i.pinimg.com/1200x/a.jpg" },
      },
    },
  };

  it("maps a pin picking the largest image and keeps the id a string", () => {
    const out = parseBoardPinsResponse({ items: [item], bookmark: null }, BOARD);
    expect(out.pins).toHaveLength(1);
    const p = out.pins[0];
    expect(p.id).toBe("1104578219333637375");
    expect(p.boardId).toBe("b1");
    expect(p.boardName).toBe("Fits");
    expect(p.title).toBe("Linen set");
    expect(p.imageUrl).toBe("https://i.pinimg.com/1200x/a.jpg");
    expect(p.width).toBe(1200);
    expect(p.height).toBe(1500);
    expect(p.savedAt).toEqual(new Date("2026-07-01T10:00:00"));
  });

  it("skips items with no usable image and tolerates garbage", () => {
    const noImage = { ...item, id: "2", media: { images: {} } };
    const out = parseBoardPinsResponse({ items: [noImage, "junk"] }, BOARD);
    expect(out.pins).toEqual([]);
    expect(parseBoardPinsResponse(undefined, BOARD)).toEqual({ pins: [], bookmark: null });
  });
});

describe("mockBoardPins", () => {
  it("is deterministic: 45 pins, titled by board, ids zero-padded for stable sort", () => {
    const pins = mockBoardPins(MOCK_BOARDS[1]);
    expect(pins).toHaveLength(45);
    expect(pins[0].id).toBe("mock-mockboard2-01");
    expect(pins[0].title).toBe("Mock pin Parisian Chic 1");
    expect(pins[0].imageUrl).toBe("/fixtures/pin-1.svg");
    expect(pins[4].imageUrl).toBe("/fixtures/pin-1.svg"); // 4 shapes cycle
    expect(mockBoardPins(MOCK_BOARDS[1])).toEqual(pins);
  });
});

describe("isPinterestMock", () => {
  const OLD = { MOCK_AI: process.env.MOCK_AI, PINTEREST_APP_ID: process.env.PINTEREST_APP_ID };
  afterEach(() => {
    // Assigning undefined to process.env coerces to the string "undefined" —
    // delete instead.
    if (OLD.MOCK_AI === undefined) delete process.env.MOCK_AI;
    else process.env.MOCK_AI = OLD.MOCK_AI;
    if (OLD.PINTEREST_APP_ID === undefined) delete process.env.PINTEREST_APP_ID;
    else process.env.PINTEREST_APP_ID = OLD.PINTEREST_APP_ID;
  });
  it("mocks only when MOCK_AI=1 and no app id", () => {
    process.env.MOCK_AI = "1";
    delete process.env.PINTEREST_APP_ID;
    expect(isPinterestMock()).toBe(true);
    process.env.PINTEREST_APP_ID = "real";
    expect(isPinterestMock()).toBe(false);
  });
});
