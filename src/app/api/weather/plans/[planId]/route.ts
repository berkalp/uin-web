import { NextResponse } from "next/server";

import { createClient } from "@/utils/supabase/server";
import { geocodeLocation as geocodeAddress } from "@/utils/maps/geocode";
import {
  getWeatherPresentation,
  type PlanWeatherAlert,
  type PlanWeatherPoint,
  type PlanWeatherResponse,
  weatherRevalidateSeconds,
} from "@/utils/planWeather";

type RouteContext = {
  params: Promise<{ planId: string }>;
};

type PlanWeatherRow = {
  id: string;
  host_user_id: string;
  status: string;
  scheduled_start: string | null;
  scheduled_end: string | null;
  timezone: string | null;
  meeting_point: string | null;
  address_text: string | null;
  latitude: number | string | null;
  longitude: number | string | null;
  activity_location_name: string | null;
  activity_address_text: string | null;
  activity_latitude: number | string | null;
  activity_longitude: number | string | null;
  activity_location_visibility: "members" | "public" | string | null;
  meeting_location_same_as_activity: boolean | null;
  locations:
    | {
        country_name?: string | null;
        city?: string | null;
        district?: string | null;
      }
    | Array<{
        country_name?: string | null;
        city?: string | null;
        district?: string | null;
      }>
    | null;
  plan_members:
    | Array<{
        user_id: string;
        status: string;
      }>
    | null;
};

type Coordinates = { latitude: number; longitude: number };

type ForecastHourly = {
  time?: number[];
  temperature_2m?: number[];
  apparent_temperature?: number[];
  precipitation_probability?: Array<number | null>;
  weather_code?: number[];
  wind_speed_10m?: number[];
};

type ForecastPayload = {
  hourly?: ForecastHourly;
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

function uniqueQueries(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))
  );
}

async function resolveLocationCoordinates({
  storedLatitude,
  storedLongitude,
  name,
  address,
  contextLocation,
}: {
  storedLatitude: number | string | null | undefined;
  storedLongitude: number | string | null | undefined;
  name: string | null | undefined;
  address: string | null | undefined;
  contextLocation: string;
}): Promise<Coordinates | null> {
  const latitude = numberOrNull(storedLatitude);
  const longitude = numberOrNull(storedLongitude);
  if (latitude !== null && longitude !== null) return { latitude, longitude };

  // Exact location text is attempted first. If an old Plan only has a venue
  // name or approximate Intent area, progressively fall back instead of asking
  // a city-oriented weather geocoder to understand a street address.
  const candidates = uniqueQueries([
    cleanParts(name, address, contextLocation),
    cleanParts(address, name, contextLocation),
    cleanParts(name, contextLocation),
    cleanParts(address, contextLocation),
    cleanParts(name, address),
    contextLocation,
  ]);

  for (const query of candidates) {
    const hit = await geocodeAddress(query, { language: "tr,en;q=0.8" });
    if (hit) return { latitude: hit.latitude, longitude: hit.longitude };
  }

  return null;
}

async function fetchForecast(
  coordinates: Coordinates,
  scheduledStart: Date,
  label: string,
  kind: "meeting" | "activity",
  sameAsOtherLocation = false
): Promise<PlanWeatherPoint | null> {
  try {
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", String(coordinates.latitude));
    url.searchParams.set("longitude", String(coordinates.longitude));
    url.searchParams.set(
      "hourly",
      "temperature_2m,apparent_temperature,precipitation_probability,weather_code,wind_speed_10m"
    );
    url.searchParams.set("forecast_days", "16");
    url.searchParams.set("timezone", "auto");
    url.searchParams.set("timeformat", "unixtime");

    const response = await fetch(url, {
      next: { revalidate: weatherRevalidateSeconds(scheduledStart) },
      signal: AbortSignal.timeout(7000),
    });
    if (!response.ok) return null;

    const payload = (await response.json()) as ForecastPayload;
    const hourly = payload.hourly;
    const times = hourly?.time ?? [];
    if (times.length === 0) return null;

    const targetSeconds = Math.round(scheduledStart.getTime() / 1000);
    let bestIndex = 0;
    let bestDistance = Number.POSITIVE_INFINITY;
    times.forEach((time, index) => {
      const distance = Math.abs(time - targetSeconds);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    });

    // Do not pretend the nearest hour is a forecast if the requested Activity
    // is actually outside the provider horizon.
    if (bestDistance > 3 * 60 * 60) return null;

    const temperature = hourly?.temperature_2m?.[bestIndex];
    const weatherCode = hourly?.weather_code?.[bestIndex];
    if (
      typeof temperature !== "number" ||
      typeof weatherCode !== "number" ||
      !Number.isFinite(temperature) ||
      !Number.isFinite(weatherCode)
    ) return null;

    const presentation = getWeatherPresentation(Number(weatherCode));
    const apparent = hourly?.apparent_temperature?.[bestIndex];
    const precipitation = hourly?.precipitation_probability?.[bestIndex];
    const wind = hourly?.wind_speed_10m?.[bestIndex];

    return {
      kind,
      label,
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
      forecastTime: new Date(times[bestIndex] * 1000).toISOString(),
      temperatureC: Math.round(Number(temperature)),
      apparentTemperatureC:
        typeof apparent === "number" && Number.isFinite(apparent)
          ? Math.round(apparent)
          : null,
      precipitationProbability:
        typeof precipitation === "number" && Number.isFinite(precipitation)
          ? Math.round(precipitation)
          : null,
      windSpeedKmh:
        typeof wind === "number" && Number.isFinite(wind)
          ? Math.round(wind)
          : null,
      weatherCode: Number(weatherCode),
      icon: presentation.icon,
      condition: presentation.condition,
      sameAsOtherLocation,
    };
  } catch {
    return null;
  }
}


type RawWeatherAlert = {
  alert_id?: unknown;
  plan_id?: unknown;
  location_kind?: unknown;
  alert_type?: unknown;
  severity?: unknown;
  title?: unknown;
  message?: unknown;
  suggested_need?: unknown;
  created_at?: unknown;
};

function normalizeWeatherAlert(value: RawWeatherAlert): PlanWeatherAlert | null {
  if (
    typeof value.alert_id !== "string" ||
    typeof value.plan_id !== "string" ||
    (value.location_kind !== "meeting" && value.location_kind !== "activity") ||
    typeof value.alert_type !== "string" ||
    typeof value.title !== "string" ||
    typeof value.message !== "string" ||
    typeof value.created_at !== "string"
  ) return null;

  const severity = value.severity === "critical" || value.severity === "warning" ? value.severity : "notice";
  const allowedTypes = new Set(["severe_weather", "snow", "rain", "wind", "colder", "hotter"]);
  if (!allowedTypes.has(value.alert_type)) return null;

  return {
    id: value.alert_id,
    planId: value.plan_id,
    locationKind: value.location_kind,
    alertType: value.alert_type as PlanWeatherAlert["alertType"],
    severity,
    title: value.title,
    message: value.message,
    suggestedNeed: typeof value.suggested_need === "string" ? value.suggested_need : null,
    createdAt: value.created_at,
  };
}

async function recordWeatherObservation(
  supabase: Awaited<ReturnType<typeof createClient>>,
  planId: string,
  point: PlanWeatherPoint
) {
  await supabase.rpc("record_plan_weather_observation", {
    p_plan_id: planId,
    p_location_kind: point.kind,
    p_label: point.label,
    p_forecast_time: point.forecastTime,
    p_weather_code: point.weatherCode,
    p_temperature_c: point.temperatureC,
    p_apparent_temperature_c: point.apparentTemperatureC,
    p_precipitation_probability: point.precipitationProbability,
    p_wind_speed_kmh: point.windSpeedKmh,
    p_condition: point.condition,
  });
}

async function loadWeatherAlerts(
  supabase: Awaited<ReturnType<typeof createClient>>,
  planId: string
) {
  const { data } = await supabase.rpc("get_plan_weather_alerts", { p_plan_id: planId });
  return (Array.isArray(data) ? data : [])
    .map((item) => normalizeWeatherAlert(item as RawWeatherAlert))
    .filter((item): item is PlanWeatherAlert => item !== null);
}

function json(payload: PlanWeatherResponse, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: {
      "Cache-Control": "private, max-age=300, stale-while-revalidate=900",
    },
  });
}

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: RouteContext) {
  const { planId } = await context.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const base: PlanWeatherResponse = {
    planId,
    status: "unavailable",
    scheduledStart: null,
    forecastAvailableFrom: null,
    updatedAt: new Date().toISOString(),
    locations: [],
    alerts: [],
  };

  if (!user) return json(base, 401);

  const { data, error } = await supabase
    .from("plans")
    .select(`
      id,
      host_user_id,
      status,
      scheduled_start,
      scheduled_end,
      timezone,
      meeting_point,
      address_text,
      latitude,
      longitude,
      activity_location_name,
      activity_address_text,
      activity_latitude,
      activity_longitude,
      activity_location_visibility,
      meeting_location_same_as_activity,
      locations (country_name, city, district),
      plan_members (user_id, status)
    `)
    .eq("id", planId)
    .maybeSingle();

  if (error || !data) return json(base, 404);
  const plan = data as unknown as PlanWeatherRow;
  base.scheduledStart = plan.scheduled_start;

  if (plan.status !== "planned") {
    base.status = "unavailable";
    return json(base);
  }

  if (!plan.scheduled_start) {
    base.status = "missing_schedule";
    return json(base);
  }

  const scheduledStart = new Date(plan.scheduled_start);
  if (Number.isNaN(scheduledStart.getTime())) {
    base.status = "missing_schedule";
    return json(base);
  }

  const now = new Date();
  const leadMs = scheduledStart.getTime() - now.getTime();
  if (leadMs < -3 * 60 * 60 * 1000) {
    base.status = "past";
    return json(base);
  }

  const horizonMs = 16 * 24 * 60 * 60 * 1000;
  if (leadMs > horizonMs) {
    base.status = "too_far";
    base.forecastAvailableFrom = new Date(scheduledStart.getTime() - horizonMs).toISOString();
    return json(base);
  }

  const isMember =
    plan.host_user_id === user.id ||
    (plan.plan_members ?? []).some(
      (member) => member.user_id === user.id && member.status === "active"
    );

  const catalogueLocation = first(plan.locations);
  const contextLocation = cleanParts(
    catalogueLocation?.district,
    catalogueLocation?.city,
    catalogueLocation?.country_name
  );

  const meetingLabel = cleanParts(plan.meeting_point, plan.address_text) || "Meeting point";
  const activityLabel =
    cleanParts(plan.activity_location_name, plan.activity_address_text) ||
    contextLocation ||
    "Activity location";

  let meetingCoordinates: Coordinates | null = null;
  if (isMember) {
    meetingCoordinates = await resolveLocationCoordinates({
      storedLatitude: plan.latitude,
      storedLongitude: plan.longitude,
      name: plan.meeting_point,
      address: plan.address_text,
      contextLocation,
    });
  }

  const canSeeActivityLocation = isMember || plan.activity_location_visibility === "public";
  let activityCoordinates: Coordinates | null = null;
  if (canSeeActivityLocation) {
    if (plan.meeting_location_same_as_activity && meetingCoordinates) {
      activityCoordinates = meetingCoordinates;
    } else {
      activityCoordinates = await resolveLocationCoordinates({
        storedLatitude: plan.activity_latitude,
        storedLongitude: plan.activity_longitude,
        name: plan.activity_location_name,
        address: plan.activity_address_text,
        contextLocation,
      });
    }
  }

  const sameCoordinates = Boolean(
    meetingCoordinates &&
    activityCoordinates &&
    Math.abs(meetingCoordinates.latitude - activityCoordinates.latitude) < 0.0001 &&
    Math.abs(meetingCoordinates.longitude - activityCoordinates.longitude) < 0.0001
  );

  // When both locations are explicitly the same, fetch one forecast instead of
  // presenting two identical weather cards. The Activity point represents both.
  let meetingWeather: PlanWeatherPoint | null = null;
  let activityWeather: PlanWeatherPoint | null = null;

  if (plan.meeting_location_same_as_activity && activityCoordinates) {
    activityWeather = await fetchForecast(
      activityCoordinates,
      scheduledStart,
      activityLabel || meetingLabel,
      "activity",
      true
    );
  } else {
    [meetingWeather, activityWeather] = await Promise.all([
      meetingCoordinates
        ? fetchForecast(meetingCoordinates, scheduledStart, meetingLabel, "meeting", sameCoordinates)
        : Promise.resolve(null),
      activityCoordinates
        ? fetchForecast(activityCoordinates, scheduledStart, activityLabel, "activity", sameCoordinates)
        : Promise.resolve(null),
    ]);
  }

  base.locations = [meetingWeather, activityWeather].filter(
    (item): item is PlanWeatherPoint => Boolean(item)
  );

  const hasUsableCoordinates = Boolean(meetingCoordinates || activityCoordinates);
  base.status = base.locations.length > 0
    ? "available"
    : hasUsableCoordinates
      ? "forecast_unavailable"
      : "missing_location";

  if (base.locations.length > 0) {
    await Promise.allSettled(
      base.locations.map((point) => recordWeatherObservation(supabase, planId, point))
    );
    base.alerts = await loadWeatherAlerts(supabase, planId);
  }

  return json(base);
}
