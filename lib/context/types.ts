export type ContextEvent = {
  title: string;
  start: string; // ISO instant; for all-day events, midnight UTC of the date
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
