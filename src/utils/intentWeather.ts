import { getWeatherPresentation } from "@/utils/planWeather";

export type IntentWeatherStatus =
  | "available"
  | "too_far"
  | "past"
  | "missing_window"
  | "missing_location"
  | "unavailable";

export type IntentWeatherResponse = {
  intentId: string;
  status: IntentWeatherStatus;
  mode: "day" | "window" | null;
  targetStart: string | null;
  targetEnd: string | null;
  locationLabel: string | null;
  latitude: number | null;
  longitude: number | null;
  forecastFrom: string | null;
  forecastThrough: string | null;
  forecastAvailableFrom: string | null;
  coveredDays: number;
  totalTargetDays: number;
  partialWindow: boolean;
  weatherCode: number | null;
  icon: string | null;
  condition: string | null;
  minTemperatureC: number | null;
  maxTemperatureC: number | null;
  precipitationProbabilityMax: number | null;
  windSpeedKmhMax: number | null;
  updatedAt: string;
};

export function getIntentWeatherPresentation(code: number) {
  return getWeatherPresentation(code);
}

export function formatIntentWeatherTemperatureRange(
  minTemperatureC: number | null,
  maxTemperatureC: number | null
) {
  if (minTemperatureC === null && maxTemperatureC === null) return "—";
  if (minTemperatureC === null) return `${Math.round(maxTemperatureC as number)}°`;
  if (maxTemperatureC === null) return `${Math.round(minTemperatureC)}°`;

  const min = Math.round(minTemperatureC);
  const max = Math.round(maxTemperatureC);
  return min === max ? `${max}°` : `${min}–${max}°`;
}
