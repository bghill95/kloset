export type ContextEvent = {
  title: string;
  start: string; // ISO instant. All-day events: midnight UTC of the literal
  // date — clients must render them via start.slice(0, 10), never local Date
  // conversion.
  end: string;
  allDay: boolean;
};

export type WeatherSummary = {
  tempMin: number;
  tempMax: number;
  code: number;
  label: string;
  emoji: string;
};

export type ContextResponse = {
  events: ContextEvent[];
  weather: WeatherSummary | null;
  configured: { calendar: boolean; weather: boolean };
};
