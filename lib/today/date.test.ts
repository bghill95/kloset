import { describe, expect, it } from "vitest";
import { localDateKey } from "./date";

describe("localDateKey", () => {
  it("formats the local date with zero padding", () => {
    expect(localDateKey(new Date(2026, 0, 5))).toBe("2026-01-05");
    expect(localDateKey(new Date(2026, 11, 31))).toBe("2026-12-31");
  });
});
