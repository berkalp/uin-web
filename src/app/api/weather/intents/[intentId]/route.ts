import { NextResponse } from "next/server";

import { createClient } from "@/utils/supabase/server";
import {
  getIntentWeatherPresentation,
  type IntentWeatherResponse,
} from "@/utils/intentWeather";

type RouteContext = {
  params: Promise<{ intentId: string }>;
};

type IntentWeatherRow = {
  id: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  locations:
    | {
        country_name?: string | null;
        city?: string | null;
        district?: string | null;
        latitude?: number | string | null;
        longitude?: number | string | null;
      }
    | Array<{
        country_name?: string | null;
        city?: string | null;
        district?: string | null;
        latitude?: number | string | null;
        longitude?: number | string | null;
      }>
    | null;
};

type Coordinates = { latitude: number; longitude: number };

type DailyForecast = {
  time?: string[];
  weather_code?: number[];
  temperature_2m_max?: number[];
  temperature_2m_min?: number[];
  precipitation_probability_max?: Array<number | null>;
  wind_speed_10m_max?: number[];
};

type ForecastPayload = {
  daily?: DailyForecast;
};

function first<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function numberOrNull(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function cleanParts(...values: Array<string | null | undefined>) {
  return values.map((value) => value?.trim()).filter(Boolean).join(", ");
}

function dateOnlyInIstanbul(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function addDays(dateOnly: string, days: number) {
  const date = new Date(`${dateOnly}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function differenceInDaysInclusive(start: string, end: string) {
  const startMs = new Date(`${start}T12:00:00Z`).getTime();
  const endMs = new Date(`${end}T12:00:00Z`).getTime();
  return Math.max(1, Math.floor((endMs - startMs) / 86_400_000) + 1);
}

async function geocodeLocation(query: string): Promise<Coordinates | null> {
  if (!query.trim()) return null;
  try {
    const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
    url.searchParams.set("name", query);
    url.searchParams.set("count", "1");
    url.searchParams.set("language", "en");
    url.searchParams.set("format", "json");

    const response = await fetch(url, {
      next: { revalidate: 7 * 24 * 60 * 60 },
      signal: AbortSignal.timeout(6000),
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as {
      results?: Array<{ latitude?: number; longitude?: number }>;
    };
    const hit = payload.results?.[0];
    if (
      !hit ||
      typeof hit.latitude !== "number" ||
      typeof hit.longitude !== "number" ||
      !Number.isFinite(hit.latitude) ||
      !Number.isFinite(hit.longitude)
    ) return null;
    return { latitude: hit.latitude, longitude: hit.longitude };
  } catch {
    return null;
  }
}

function weatherSeverity(code: number) {
  if (code === 95 || code === 96 || code === 99) return 6;
  if (code === 65 || code === 67 || code === 82 || code === 85 || code === 86) return 5;
  if ([61, 63, 66, 71, 73, 75, 77, 80, 81].includes(code)) return 4;
  if ([51, 53, 55, 56, 57, 45, 48].includes(code)) return 3;
  if (code === 3) return 2;
  if (code === 2) return 1;
  return 0;
}

function json(payload: IntentWeatherResponse, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: {
      "Cache-Control": "private, max-age=300, stale-while-revalidate=900",
    },
  });
}

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: RouteContext) {
  const { intentId } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const base: IntentWeatherResponse = {
    intentId,
    status: "unavailable",
    mode: null,
    targetStart: null,
    targetEnd: null,
    locationLabel: null,
    latitude: null,
    longitude: null,
    forecastFrom: null,
    forecastThrough: null,
    forecastAvailableFrom: null,
    coveredDays: 0,
    totalTargetDays: 0,
    partialWindow: false,
    weatherCode: null,
    icon: null,
    condition: null,
    minTemperatureC: null,
    maxTemperatureC: null,
    precipitationProbabilityMax: null,
    windSpeedKmhMax: null,
    updatedAt: new Date().toISOString(),
  };

  if (!user) return json(base, 401);

  const { data, error } = await supabase
    .from("intents")
    .select(`
      id,
      status,
      start_date,
      end_date,
      locations (
        country_name,
        city,
        district,
        latitude,
        longitude
      )
    `)
    .eq("id", intentId)
    .maybeSingle();

  if (error || !data) return json(base, 404);
  const intent = data as unknown as IntentWeatherRow;
  base.targetStart = intent.start_date;
  base.targetEnd = intent.end_date ?? intent.start_date;

  if (!intent.start_date) {
    base.status = "missing_window";
    return json(base);
  }

  const targetStart = intent.start_date.slice(0, 10);
  const targetEnd = (intent.end_date ?? intent.start_date).slice(0, 10);
  const today = dateOnlyInIstanbul();
  const horizonEnd = addDays(today, 15);

  base.targetStart = targetStart;
  base.targetEnd = targetEnd;
  base.mode = targetStart === targetEnd ? "day" : "window";
  base.totalTargetDays = differenceInDaysInclusive(targetStart, targetEnd);

  if (targetEnd < today) {
    base.status = "past";
    return json(base);
  }

  if (targetStart > horizonEnd) {
    base.status = "too_far";
    base.forecastAvailableFrom = addDays(targetStart, -15);
    return json(base);
  }

  const location = first(intent.locations);
  const locationLabel = cleanParts(location?.district, location?.city, location?.country_name);
  base.locationLabel = locationLabel || null;

  if (!locationLabel) {
    base.status = "missing_location";
    return json(base);
  }

  const latitude = numberOrNull(location?.latitude);
  const longitude = numberOrNull(location?.longitude);
  const coordinates =
    latitude !== null && longitude !== null
      ? { latitude, longitude }
      : await geocodeLocation(locationLabel);

  if (!coordinates) {
    base.status = "missing_location";
    return json(base);
  }

  base.latitude = coordinates.latitude;
  base.longitude = coordinates.longitude;

  try {
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", String(coordinates.latitude));
    url.searchParams.set("longitude", String(coordinates.longitude));
    url.searchParams.set(
      "daily",
      "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max"
    );
    url.searchParams.set("forecast_days", "16");
    url.searchParams.set("timezone", "auto");

    const response = await fetch(url, {
      next: { revalidate: 3 * 60 * 60 },
      signal: AbortSignal.timeout(7000),
    });
    if (!response.ok) return json(base);

    const payload = (await response.json()) as ForecastPayload;
    const daily = payload.daily;
    const times = daily?.time ?? [];
    if (times.length === 0) return json(base);

    const rows = times
      .map((date, index) => ({
        date,
        weatherCode: daily?.weather_code?.[index],
        min: daily?.temperature_2m_min?.[index],
        max: daily?.temperature_2m_max?.[index],
        precipitation: daily?.precipitation_probability_max?.[index],
        wind: daily?.wind_speed_10m_max?.[index],
      }))
      .filter((row) => row.date >= targetStart && row.date <= targetEnd);

    if (rows.length === 0) {
      base.status = targetStart > times[times.length - 1] ? "too_far" : "unavailable";
      if (base.status === "too_far") base.forecastAvailableFrom = addDays(targetStart, -15);
      return json(base);
    }

    const validMins = rows.map((row) => row.min).filter((value): value is number => typeof value === "number" && Number.isFinite(value));
    const validMaxes = rows.map((row) => row.max).filter((value): value is number => typeof value === "number" && Number.isFinite(value));
    const validPrecipitation = rows.map((row) => row.precipitation).filter((value): value is number => typeof value === "number" && Number.isFinite(value));
    const validWind = rows.map((row) => row.wind).filter((value): value is number => typeof value === "number" && Number.isFinite(value));
    const validCodes = rows.map((row) => row.weatherCode).filter((value): value is number => typeof value === "number" && Number.isFinite(value));

    if (validMins.length === 0 || validMaxes.length === 0 || validCodes.length === 0) return json(base);

    const representativeCode = [...validCodes].sort((left, right) => weatherSeverity(right) - weatherSeverity(left))[0];
    const presentation = getIntentWeatherPresentation(representativeCode);

    base.status = "available";
    base.forecastFrom = rows[0].date;
    base.forecastThrough = rows[rows.length - 1].date;
    base.coveredDays = rows.length;
    base.partialWindow = rows.length < base.totalTargetDays;
    base.weatherCode = representativeCode;
    base.icon = presentation.icon;
    base.condition = base.mode === "window" && new Set(validCodes).size > 1
      ? `Mixed outlook · ${presentation.condition} possible`
      : presentation.condition;
    base.minTemperatureC = Math.round(Math.min(...validMins));
    base.maxTemperatureC = Math.round(Math.max(...validMaxes));
    base.precipitationProbabilityMax = validPrecipitation.length > 0 ? Math.round(Math.max(...validPrecipitation)) : null;
    base.windSpeedKmhMax = validWind.length > 0 ? Math.round(Math.max(...validWind)) : null;
    return json(base);
  } catch {
    return json(base);
  }
}
