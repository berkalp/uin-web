export type PlanWeatherLocationKind = "meeting" | "activity";

export type PlanWeatherPoint = {
  kind: PlanWeatherLocationKind;
  label: string;
  latitude: number;
  longitude: number;
  forecastTime: string;
  temperatureC: number;
  apparentTemperatureC: number | null;
  precipitationProbability: number | null;
  windSpeedKmh: number | null;
  weatherCode: number;
  icon: string;
  condition: string;
  sameAsOtherLocation?: boolean;
};


export type PlanWeatherAlert = {
  id: string;
  planId: string;
  locationKind: PlanWeatherLocationKind;
  alertType: "severe_weather" | "snow" | "rain" | "wind" | "colder" | "hotter";
  severity: "notice" | "warning" | "critical";
  title: string;
  message: string;
  suggestedNeed: string | null;
  createdAt: string;
};

export type PlanWeatherResponse = {
  planId: string;
  status:
    | "available"
    | "too_far"
    | "past"
    | "missing_schedule"
    | "missing_location"
    | "forecast_unavailable"
    | "unavailable";
  scheduledStart: string | null;
  forecastAvailableFrom: string | null;
  updatedAt: string;
  locations: PlanWeatherPoint[];
  alerts: PlanWeatherAlert[];
};

export function getWeatherPresentation(code: number) {
  if (code === 0) return { icon: "☀️", condition: "Clear sky" };
  if (code === 1) return { icon: "🌤️", condition: "Mainly clear" };
  if (code === 2) return { icon: "⛅", condition: "Partly cloudy" };
  if (code === 3) return { icon: "☁️", condition: "Overcast" };
  if (code === 45 || code === 48) return { icon: "🌫️", condition: "Fog" };
  if (code === 51 || code === 53 || code === 55) return { icon: "🌦️", condition: "Drizzle" };
  if (code === 56 || code === 57) return { icon: "🌧️", condition: "Freezing drizzle" };
  if (code === 61 || code === 63) return { icon: "🌧️", condition: "Rain" };
  if (code === 65) return { icon: "🌧️", condition: "Heavy rain" };
  if (code === 66 || code === 67) return { icon: "🌧️", condition: "Freezing rain" };
  if (code === 71 || code === 73 || code === 75 || code === 77) return { icon: "🌨️", condition: "Snow" };
  if (code === 80 || code === 81) return { icon: "🌦️", condition: "Rain showers" };
  if (code === 82) return { icon: "🌧️", condition: "Heavy showers" };
  if (code === 85 || code === 86) return { icon: "🌨️", condition: "Snow showers" };
  if (code === 95) return { icon: "⛈️", condition: "Thunderstorm" };
  if (code === 96 || code === 99) return { icon: "⛈️", condition: "Thunderstorm with hail" };
  return { icon: "🌡️", condition: "Weather" };
}

export function weatherRevalidateSeconds(forecastTime: Date, now = new Date()) {
  const hours = Math.max(0, (forecastTime.getTime() - now.getTime()) / 3_600_000);
  if (hours <= 24) return 60 * 60;
  if (hours <= 72) return 3 * 60 * 60;
  if (hours <= 7 * 24) return 6 * 60 * 60;
  return 12 * 60 * 60;
}
