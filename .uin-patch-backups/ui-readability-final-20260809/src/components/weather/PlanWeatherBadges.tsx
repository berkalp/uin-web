"use client";

import { useEffect, useState } from "react";

import type { PlanWeatherResponse } from "@/utils/planWeather";

type PlanWeatherBadgesProps = {
  planId: string;
  className?: string;
  compact?: boolean;
};

type Cached = { data: PlanWeatherResponse; expiresAt: number };
const cache = new Map<string, Cached>();
const inFlight = new Map<string, Promise<PlanWeatherResponse | null>>();

async function load(planId: string, force = false) {
  const cached = cache.get(planId);
  if (!force && cached && cached.expiresAt > Date.now()) return cached.data;
  const running = inFlight.get(planId);
  if (running) return running;

  const request = fetch(`/api/weather/plans/${encodeURIComponent(planId)}`, {
    cache: "no-store",
    credentials: "same-origin",
  })
    .then(async (response) => {
      if (!response.ok) return null;
      const data = (await response.json()) as PlanWeatherResponse;
      cache.set(planId, { data, expiresAt: Date.now() + 30 * 60 * 1000 });
      return data;
    })
    .catch(() => null)
    .finally(() => inFlight.delete(planId));

  inFlight.set(planId, request);
  return request;
}

export default function PlanWeatherBadges({
  planId,
  className = "",
  compact = false,
}: PlanWeatherBadgesProps) {
  const [weather, setWeather] = useState<PlanWeatherResponse | null>(
    () => cache.get(planId)?.data ?? null
  );

  useEffect(() => {
    let active = true;
    const refresh = (force = false) => {
      void load(planId, force).then((data) => {
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
  }, [planId]);

  if (!weather || weather.status !== "available" || weather.locations.length === 0) {
    return null;
  }

  return (
    <div className={`flex flex-col items-end gap-1 ${className}`}>
      {weather.locations.map((point) => (
        <span
          key={point.kind}
          title={`${point.kind === "meeting" ? "Meeting point" : "Activity location"}: ${point.condition}${
            point.precipitationProbability === null ? "" : ` · ${point.precipitationProbability}% precipitation`
          }`}
          className="inline-flex max-w-[170px] items-center gap-1 rounded-full border border-white/20 bg-gray-950/80 px-2 py-1 text-[9px] font-bold text-white shadow-sm backdrop-blur"
        >
          {!compact && (
            <span className="text-[8px] uppercase tracking-wide text-white/70">
              {point.kind === "meeting" ? "Meet" : "Activity"}
            </span>
          )}
          <span aria-hidden="true">{point.icon}</span>
          <span>{Math.round(point.temperatureC)}°</span>
          {!compact && point.precipitationProbability !== null && point.precipitationProbability >= 30 && (
            <span className="text-blue-200">{point.precipitationProbability}%</span>
          )}
        </span>
      ))}
    </div>
  );
}
