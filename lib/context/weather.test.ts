import { describe, expect, it } from "vitest";
import {
  buildForecastUrl,
  buildGeocodeUrl,
  parseGeocode,
  summarizeForecast,
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
  });
});

describe("urls", () => {
  it("builds forecast and geocode urls", () => {
    expect(buildForecastUrl(33.16, -117.35)).toContain("latitude=33.16");
    expect(buildGeocodeUrl("Carlsbad")).toContain("name=Carlsbad");
  });
});
