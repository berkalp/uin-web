"use client";

import { useEffect, useRef, useState } from "react";

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
  const visibilityRef = useRef<HTMLSpanElement | null>(null);
  const [shouldLoad, setShouldLoad] = useState(
    () => Boolean(cache.get(planId)?.data)
  );
  const [currentPlanId, setCurrentPlanId] = useState(planId);

  if (currentPlanId !== planId) {
    const cached = cache.get(planId)?.data ?? null;
    setCurrentPlanId(planId);
    setWeather(cached);
    setShouldLoad(Boolean(cached));
  }

  useEffect(() => {
    const cached = cache.get(planId)?.data ?? null;
    if (cached) return;

    const element = visibilityRef.current;
    if (!element || typeof IntersectionObserver === "undefined") {
      const timer = window.setTimeout(() => setShouldLoad(true), 0);
      return () => window.clearTimeout(timer);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShouldLoad(true);
          observer.disconnect();
        }
      },
      { rootMargin: "320px 0px" }
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [planId]);

  useEffect(() => {
    if (!shouldLoad) return;
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
  }, [planId, shouldLoad]);

  if (!weather || weather.status !== "available" || weather.locations.length === 0) {
    return <span ref={visibilityRef} aria-hidden="true" className="block h-px w-px" />;
  }

  return (
    <span
      className={`flex items-end gap-1 ${
        compact ? "flex-row flex-wrap justify-end" : "flex-col"
      } ${className}`}
    >
      {weather.locations.map((point) => (
        <span
          key={point.kind}
          title={`${point.kind === "meeting" ? "Meeting point" : "Activity location"}: ${point.condition}${
            point.precipitationProbability === null ? "" : ` · ${point.precipitationProbability}% precipitation`
          }`}
          className={`inline-flex items-center gap-1 rounded-full border border-white/20 bg-gray-950/80 font-bold text-white shadow-sm backdrop-blur ${
            compact
              ? "max-w-[92px] px-2 py-1 text-[9px]"
              : "max-w-[170px] px-2 py-1 text-[9px]"
          }`}
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
    </span>
  );
}
