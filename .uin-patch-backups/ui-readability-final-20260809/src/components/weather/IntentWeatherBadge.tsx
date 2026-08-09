"use client";

import { useEffect, useState } from "react";

import {
  formatIntentWeatherTemperatureRange,
  type IntentWeatherResponse,
} from "@/utils/intentWeather";

type Props = {
  intentId: string;
  className?: string;
  compact?: boolean;
};

type Cached = { data: IntentWeatherResponse; expiresAt: number };
const cache = new Map<string, Cached>();
const inFlight = new Map<string, Promise<IntentWeatherResponse | null>>();

async function load(intentId: string, force = false) {
  const cached = cache.get(intentId);
  if (!force && cached && cached.expiresAt > Date.now()) return cached.data;
  const running = inFlight.get(intentId);
  if (running) return running;

  const request = fetch(`/api/weather/intents/${encodeURIComponent(intentId)}`, {
    cache: "no-store",
    credentials: "same-origin",
  })
    .then(async (response) => {
      if (!response.ok) return null;
      const data = (await response.json()) as IntentWeatherResponse;
      cache.set(intentId, { data, expiresAt: Date.now() + 30 * 60 * 1000 });
      return data;
    })
    .catch(() => null)
    .finally(() => inFlight.delete(intentId));

  inFlight.set(intentId, request);
  return request;
}

export default function IntentWeatherBadge({ intentId, className = "", compact = false }: Props) {
  const [weather, setWeather] = useState<IntentWeatherResponse | null>(() => cache.get(intentId)?.data ?? null);

  useEffect(() => {
    let active = true;
    const refresh = (force = false) => {
      void load(intentId, force).then((data) => {
        if (active && data) setWeather(data);
      });
    };

    refresh(false);
    const interval = window.setInterval(() => refresh(true), 30 * 60 * 1000);
    const onFocus = () => refresh(true);
    window.addEventListener("focus", onFocus);
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [intentId]);

  if (!weather || weather.status !== "available" || !weather.icon) return null;

  const temperature = formatIntentWeatherTemperatureRange(
    weather.minTemperatureC,
    weather.maxTemperatureC
  );

  return (
    <span
      title={`Target weather outlook · ${weather.locationLabel ?? "Approximate area"} · ${weather.condition ?? "Weather"}${
        weather.precipitationProbabilityMax === null ? "" : ` · up to ${weather.precipitationProbabilityMax}% precipitation`
      }`}
      className={`inline-flex max-w-[185px] items-center gap-1 rounded-full border border-white/20 bg-gray-950/80 px-2 py-1 text-[9px] font-bold text-white shadow-sm backdrop-blur ${className}`}
    >
      {!compact && <span className="text-[8px] uppercase tracking-wide text-white/70">Target</span>}
      <span aria-hidden="true">{weather.icon}</span>
      <span>{temperature}</span>
      {!compact && weather.precipitationProbabilityMax !== null && weather.precipitationProbabilityMax >= 30 && (
        <span className="text-blue-200">{weather.precipitationProbabilityMax}%</span>
      )}
    </span>
  );
}
