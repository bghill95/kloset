import { describe, expect, it } from "vitest";
import {
  addDaysKey,
  buildForecastRangeUrl,
  buildForecastUrl,
  buildGeocodeUrl,
  clampForecastWindow,
  parseGeocode,
  summarizeForecast,
  summarizeForecastRange,
  weatherLabel,
} from "./weather";

describe("weatherLabel", () => {
  it.each([
    [0, "Clear", "☀️"],
    [2, "Partly cloudy", "⛅"],
    [3, "Overcast", "☁️"],
    [61, "Rain", "🌧️"],
    [71, "Snow", "❄️"],
    [95, "Thunderstorm", "⛈️"],
    [999, "Unknown", "🌡️"],
  ])("maps code %i", (code, label, emoji) => {
    expect(weatherLabel(code)).toEqual({ label, emoji });
  });
});

describe("summarizeForecast", () => {
  it("summarizes an Open-Meteo daily payload", () => {
    expect(
      summarizeForecast({
        daily: {
          temperature_2m_min: [17.6],
          temperature_2m_max: [23.9],
          weathercode: [2],
        },
      }),
    ).toEqual({
      tempMin: 18,
      tempMax: 24,
      code: 2,
      label: "Partly cloudy",
      emoji: "⛅",
    });
  });

  it("returns null for malformed payloads", () => {
    expect(summarizeForecast(null)).toBeNull();
    expect(summarizeForecast({ daily: { temperature_2m_min: [] } })).toBeNull();
  });
});

describe("parseGeocode", () => {
  it("returns the top match with a friendly label", () => {
    expect(
      parseGeocode({
        results: [
          { name: "Carlsbad", admin1: "California", latitude: 33.16, longitude: -117.35 },
        ],
      }),
    ).toEqual({ lat: 33.16, lon: -117.35, label: "Carlsbad, California" });
  });

  it("returns null when there are no results", () => {
    expect(parseGeocode({})).toBeNull();
    expect(parseGeocode(null)).toBeNull();
    // Fix 4b: guard non-object first element
    expect(parseGeocode({ results: [null] })).toBeNull();
  });
});

describe("urls", () => {
  it("builds forecast and geocode urls", () => {
    expect(buildForecastUrl(33.16, -117.35)).toContain("latitude=33.16");
    expect(buildGeocodeUrl("Carlsbad")).toContain("name=Carlsbad");
  });
});

describe("buildForecastUrl with a date", () => {
  it("requests exactly that day", () => {
    const url = new URL(buildForecastUrl(40, -70, "2026-07-18"));
    expect(url.searchParams.get("start_date")).toBe("2026-07-18");
    expect(url.searchParams.get("end_date")).toBe("2026-07-18");
    expect(url.searchParams.get("forecast_days")).toBeNull();
  });

  it("keeps forecast_days=1 when no date is given", () => {
    const url = new URL(buildForecastUrl(40, -70));
    expect(url.searchParams.get("forecast_days")).toBe("1");
    expect(url.searchParams.get("start_date")).toBeNull();
  });
});

describe("range forecast", () => {
  it("addDaysKey does date math on YYYY-MM-DD keys", () => {
    expect(addDaysKey("2026-07-15", 15)).toBe("2026-07-30");
    expect(addDaysKey("2026-12-30", 3)).toBe("2027-01-02");
  });

  it("buildForecastRangeUrl requests the span", () => {
    const url = buildForecastRangeUrl(48.85, 2.35, "2026-07-20", "2026-07-23");
    expect(url).toContain("start_date=2026-07-20");
    expect(url).toContain("end_date=2026-07-23");
    expect(url).toContain("daily=weathercode");
  });

  it("summarizeForecastRange maps parallel daily arrays and skips bad rows", () => {
    const days = summarizeForecastRange({
      daily: {
        time: ["2026-07-20", "2026-07-21", "2026-07-22"],
        temperature_2m_min: [14.2, null, 15.1],
        temperature_2m_max: [22.8, 24, 25.4],
        weathercode: [2, 3, 61],
      },
    });
    expect(days).toHaveLength(2);
    expect(days[0]).toEqual({
      date: "2026-07-20",
      tempMin: 14,
      tempMax: 23,
      code: 2,
      label: "Partly cloudy",
      emoji: "⛅",
    });
    expect(days[1].date).toBe("2026-07-22");
    expect(summarizeForecastRange(null)).toEqual([]);
  });

  it("clampForecastWindow clips to today..today+15 and nulls beyond", () => {
    expect(clampForecastWindow("2026-08-10", "2026-08-12", "2026-07-15")).toBeNull();
    expect(clampForecastWindow("2026-07-10", "2026-09-01", "2026-07-15")).toEqual({
      start: "2026-07-15",
      end: "2026-07-30",
    });
    expect(clampForecastWindow("2026-07-20", "2026-07-23", "2026-07-15")).toEqual({
      start: "2026-07-20",
      end: "2026-07-23",
    });
  });
});
