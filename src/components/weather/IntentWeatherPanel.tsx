"use client";

import { useEffect, useState } from "react";

import {
  formatIntentWeatherTemperatureRange,
  type IntentWeatherResponse,
} from "@/utils/intentWeather";

type Props = { intentId: string };

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(
    new Date(`${value}T12:00:00`)
  );
}

export default function IntentWeatherPanel({ intentId }: Props) {
  const [weather, setWeather] = useState<IntentWeatherResponse | null>(null);

  useEffect(() => {
    let active = true;
    const load = () => {
      void fetch(`/api/weather/intents/${encodeURIComponent(intentId)}`, {
        cache: "no-store",
        credentials: "same-origin",
      })
        .then(async (response) => (response.ok ? ((await response.json()) as IntentWeatherResponse) : null))
        .then((data) => {
          if (active && data) setWeather(data);
        })
        .catch(() => undefined);
    };
    load();
    const timer = window.setInterval(load, 30 * 60 * 1000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [intentId]);

  if (!weather) {
    return <div className="rounded-2xl border border-gray-200 bg-white p-4 text-sm text-gray-500">Loading target weather…</div>;
  }

  if (weather.status === "too_far") {
    return (
      <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-4">
        <p className="text-sm font-bold text-gray-900">Weather forecast will appear closer to the target date</p>
        <p className="mt-1 text-xs leading-5 text-gray-500">
          UIN only shows real forecast data inside the provider window. No long-range guess is shown here.
          {weather.forecastAvailableFrom ? ` Forecast should become available around ${formatDate(weather.forecastAvailableFrom)}.` : ""}
        </p>
      </div>
    );
  }

  if (weather.status === "missing_location") {
    return (
      <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-4">
        <p className="text-sm font-bold text-gray-900">Approximate location needed for weather</p>
        <p className="mt-1 text-xs leading-5 text-gray-500">Add a city or district to this Intent so UIN can show a target-date weather outlook.</p>
      </div>
    );
  }

  if (weather.status !== "available" || !weather.icon) return null;

  const temperature = formatIntentWeatherTemperatureRange(weather.minTemperatureC, weather.maxTemperatureC);
  const dateLabel = weather.targetStart === weather.targetEnd
    ? formatDate(weather.targetStart)
    : `${formatDate(weather.targetStart)} → ${formatDate(weather.targetEnd)}`;

  return (
    <article className="rounded-2xl border border-sky-100 bg-gradient-to-br from-white to-sky-50 p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-sky-700">Target weather outlook</p>
          <p className="mt-1 text-sm font-bold text-gray-950">Approximate area · {weather.locationLabel ?? "Intent location"}</p>
          <p className="mt-1 text-[11px] text-gray-500">{dateLabel}</p>
          {weather.partialWindow && (
            <p className="mt-2 text-[11px] font-semibold text-amber-700">
              Only the part of your target window currently inside the live forecast horizon is included.
            </p>
          )}
        </div>
        <div className="shrink-0 text-right">
          <div className="text-3xl" aria-hidden="true">{weather.icon}</div>
          <div className="mt-1 text-2xl font-black text-gray-950">{temperature}</div>
        </div>
      </div>

      <p className="mt-3 text-sm font-semibold text-gray-800">{weather.condition}</p>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[10px]">
        <div className="rounded-xl bg-white p-2">
          <p className="text-gray-400">Rain risk</p>
          <p className="mt-1 font-bold text-gray-900">{weather.precipitationProbabilityMax === null ? "—" : `${weather.precipitationProbabilityMax}%`}</p>
        </div>
        <div className="rounded-xl bg-white p-2">
          <p className="text-gray-400">Wind</p>
          <p className="mt-1 font-bold text-gray-900">{weather.windSpeedKmhMax === null ? "—" : `${weather.windSpeedKmhMax} km/h`}</p>
        </div>
        <div className="rounded-xl bg-white p-2">
          <p className="text-gray-400">Forecast days</p>
          <p className="mt-1 font-bold text-gray-900">{weather.coveredDays}</p>
        </div>
      </div>
      <p className="mt-3 text-[11px] leading-5 text-gray-500">
        This is an approximate outlook based on the Intent&apos;s target window and approximate area. After a Plan confirms the exact time and locations, UIN switches to Meeting Point and Activity Location weather.
      </p>
    </article>
  );
}
