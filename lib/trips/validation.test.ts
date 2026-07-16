import { describe, expect, it } from "vitest";
import { MAX_TRIP_DAYS, tripDays, validateNewTrip, validatePackedPatch } from "./validation";

const A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

describe("tripDays", () => {
  it("counts inclusive days across month ends", () => {
    expect(tripDays("2026-07-20", "2026-07-20")).toBe(1);
    expect(tripDays("2026-07-30", "2026-08-02")).toBe(4);
  });
});

describe("validateNewTrip", () => {
  it("accepts a trimmed destination and ordered dates", () => {
    expect(validateNewTrip({ destination: "  Paris ", startDate: "2026-08-01", endDate: "2026-08-04" })).toEqual({
      ok: true,
      value: { destination: "Paris", startDate: "2026-08-01", endDate: "2026-08-04" },
    });
  });

  it("rejects bad shapes, dates, order, and over-long trips", () => {
    expect(validateNewTrip(null).ok).toBe(false);
    expect(validateNewTrip({ destination: "", startDate: "2026-08-01", endDate: "2026-08-02" }).ok).toBe(false);
    expect(validateNewTrip({ destination: "Paris", startDate: "08/01/2026", endDate: "2026-08-02" }).ok).toBe(false);
    expect(validateNewTrip({ destination: "Paris", startDate: "2026-08-05", endDate: "2026-08-01" }).ok).toBe(false);
    expect(
      validateNewTrip({ destination: "Paris", startDate: "2026-08-01", endDate: "2026-09-15" }).ok,
    ).toBe(false); // > MAX_TRIP_DAYS
    expect(MAX_TRIP_DAYS).toBe(30);
  });
});

describe("validatePackedPatch", () => {
  it("accepts deduped uuid lists including empty", () => {
    expect(validatePackedPatch({ packedIds: [A, A] })).toEqual({ ok: true, value: [A] });
    expect(validatePackedPatch({ packedIds: [] })).toEqual({ ok: true, value: [] });
  });

  it("rejects non-arrays and non-uuids", () => {
    expect(validatePackedPatch({}).ok).toBe(false);
    expect(validatePackedPatch({ packedIds: ["nope"] }).ok).toBe(false);
  });
});
