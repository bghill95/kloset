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

export function buildForecastUrl(lat: number, lon: number, date?: string): string {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    daily: "weathercode,temperature_2m_max,temperature_2m_min",
    timezone: "auto",
  });
  // A specific day (stylist occasions, ≤16 days out) vs. today (forecast_days).
  if (date) {
    params.set("start_date", date);
    params.set("end_date", date);
  } else {
    params.set("forecast_days", "1");
  }
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
  const top = results[0];
  if (typeof top !== "object" || top === null) return null;
  const topObj = top as Record<string, unknown>;
  if (typeof topObj.latitude !== "number" || typeof topObj.longitude !== "number") {
    return null;
  }
  const name = typeof topObj.name === "string" ? topObj.name : "Unknown";
  const admin = typeof topObj.admin1 === "string" ? `, ${topObj.admin1}` : "";
  return { lat: topObj.latitude as number, lon: topObj.longitude as number, label: `${name}${admin}` };
}

export type DayForecast = WeatherSummary & { date: string };

// Open-Meteo's free forecast reaches ~16 days; day 0 is today.
const FORECAST_HORIZON_DAYS = 15;

export function addDaysKey(key: string, days: number): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export function buildForecastRangeUrl(
  lat: number,
  lon: number,
  startDate: string,
  endDate: string,
): string {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    daily: "weathercode,temperature_2m_max,temperature_2m_min",
    timezone: "auto",
    start_date: startDate,
    end_date: endDate,
  });
  return `https://api.open-meteo.com/v1/forecast?${params}`;
}

export function summarizeForecastRange(raw: unknown): DayForecast[] {
  if (typeof raw !== "object" || raw === null) return [];
  const daily = (raw as { daily?: unknown }).daily;
  if (typeof daily !== "object" || daily === null) return [];
  const d = daily as Record<string, unknown>;
  const times = Array.isArray(d.time) ? d.time : [];
  const mins = Array.isArray(d.temperature_2m_min) ? d.temperature_2m_min : [];
  const maxs = Array.isArray(d.temperature_2m_max) ? d.temperature_2m_max : [];
  const codes = Array.isArray(d.weathercode) ? d.weathercode : [];
  const out: DayForecast[] = [];
  for (let i = 0; i < times.length; i++) {
    const date = times[i];
    const min = mins[i];
    const max = maxs[i];
    const code = codes[i];
    if (
      typeof date !== "string" ||
      typeof min !== "number" ||
      typeof max !== "number" ||
      typeof code !== "number"
    ) {
      continue;
    }
    const { label, emoji } = weatherLabel(code);
    out.push({ date, tempMin: Math.round(min), tempMax: Math.round(max), code, label, emoji });
  }
  return out;
}

// The forecastable slice of a trip, or null when it's entirely beyond the horizon.
export function clampForecastWindow(
  startDate: string,
  endDate: string,
  todayKey: string,
): { start: string; end: string } | null {
  const horizon = addDaysKey(todayKey, FORECAST_HORIZON_DAYS);
  const start = startDate > todayKey ? startDate : todayKey;
  const end = endDate < horizon ? endDate : horizon;
  return start > end ? null : { start, end };
}
