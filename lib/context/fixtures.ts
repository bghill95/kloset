import type { ContextEvent, WeatherSummary } from "./types";

// Mock-mode fixtures derive from the requested window so the status bar always
// has content in dev/e2e regardless of wall-clock time.
export function fixtureEvents(from: Date): ContextEvent[] {
  const at = (hours: number, minutes = 0) => {
    const d = new Date(from);
    d.setUTCHours(hours, minutes, 0, 0);
    if (d.getTime() < from.getTime()) d.setUTCDate(d.getUTCDate() + 1);
    return d;
  };
  const coffee = at(10, 0);
  const dinner = at(19, 0);
  return [
    {
      title: "Coffee with Sam",
      start: coffee.toISOString(),
      end: new Date(coffee.getTime() + 60 * 60 * 1000).toISOString(),
      allDay: false,
    },
    {
      title: "Dinner with Alex",
      start: dinner.toISOString(),
      end: new Date(dinner.getTime() + 90 * 60 * 1000).toISOString(),
      allDay: false,
    },
  ];
}

export const FIXTURE_WEATHER: WeatherSummary = {
  tempMin: 18,
  tempMax: 24,
  code: 2,
  label: "Partly cloudy",
  emoji: "⛅",
};

export const FIXTURE_LOCATION = {
  lat: 33.16,
  lon: -117.35,
  label: "Mock City",
};
