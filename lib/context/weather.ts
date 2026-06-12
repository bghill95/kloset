import type { WeatherSummary } from "./types";

// WMO weather interpretation codes → display label/emoji.
const CODE_MAP: Array<[number[], string, string]> = [
  [[0], "Clear", "☀️"],
  [[1, 2], "Partly cloudy", "⛅"],
  [[3], "Overcast", "☁️"],
  [[45, 48], "Fog", "🌫️"],
  [[51, 53, 55, 56, 57], "Drizzle", "🌦️"],
  [[61, 63, 65, 66, 67], "Rain", "🌧️"],
  [[71, 73, 75, 77, 85, 86], "Snow", "❄️"],
  [[80, 81, 82], "Showers", "🌦️"],
  [[95, 96, 99], "Thunderstorm", "⛈️"],
];

export function weatherLabel(code: number): { label: string; emoji: string } {
  for (const [codes, label, emoji] of CODE_MAP) {
    if (codes.includes(code)) return { label, emoji };
  }
  return { label: "Unknown", emoji: "🌡️" };
}

export function summarizeForecast(raw: unknown): WeatherSummary | null {
  if (typeof raw !== "object" || raw === null) return null;
  const daily = (raw as { daily?: unknown }).daily;
  if (typeof daily !== "object" || daily === null) return null;
  const d = daily as Record<string, unknown>;
  const min = Array.isArray(d.temperature_2m_min) ? d.temperature_2m_min[0] : null;
  const max = Array.isArray(d.temperature_2m_max) ? d.temperature_2m_max[0] : null;
  const code = Array.isArray(d.weathercode) ? d.weathercode[0] : null;
  if (typeof min !== "number" || typeof max !== "number" || typeof code !== "number") {
    return null;
  }
  const { label, emoji } = weatherLabel(code);
  return {
    tempMin: Math.round(min),
    tempMax: Math.round(max),
    code,
    label,
    emoji,
  };
}

export function buildForecastUrl(lat: number, lon: number): string {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    daily: "weathercode,temperature_2m_max,temperature_2m_min",
    timezone: "auto",
    forecast_days: "1",
  });
  return `https://api.open-meteo.com/v1/forecast?${params}`;
}

export function buildGeocodeUrl(query: string): string {
  const params = new URLSearchParams({ name: query, count: "1" });
  return `https://geocoding-api.open-meteo.com/v1/search?${params}`;
}

export type GeoLocation = { lat: number; lon: number; label: string };

export function parseGeocode(raw: unknown): GeoLocation | null {
  if (typeof raw !== "object" || raw === null) return null;
  const results = (raw as { results?: unknown }).results;
  if (!Array.isArray(results) || results.length === 0) return null;
  const top = results[0] as Record<string, unknown>;
  if (typeof top.latitude !== "number" || typeof top.longitude !== "number") {
    return null;
  }
  const name = typeof top.name === "string" ? top.name : "Unknown";
  const admin = typeof top.admin1 === "string" ? `, ${top.admin1}` : "";
  return { lat: top.latitude, lon: top.longitude, label: `${name}${admin}` };
}
