"use client";

import { useEffect, useState } from "react";

import { addWeatherSuggestedPlanNeed, dismissWeatherAlert } from "@/services/weatherAlertService";

import type { PlanWeatherResponse } from "@/utils/planWeather";

type PlanWeatherPanelProps = {
  planId: string;
  canManagePlanNeeds?: boolean;
};

function formatForecastDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function PlanWeatherPanel({ planId, canManagePlanNeeds = false }: PlanWeatherPanelProps) {
  const [weather, setWeather] = useState<PlanWeatherResponse | null>(null);
  const [workingAlertId, setWorkingAlertId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = () => {
      void fetch(`/api/weather/plans/${encodeURIComponent(planId)}`, {
        cache: "no-store",
        credentials: "same-origin",
      })
        .then(async (response) => (response.ok ? ((await response.json()) as PlanWeatherResponse) : null))
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
  }, [planId]);


  async function handleDismiss(alertId: string) {
    setWorkingAlertId(alertId);
    setFeedback(null);
    try {
      await dismissWeatherAlert(alertId);
      setWeather((current) => current ? { ...current, alerts: current.alerts.filter((alert) => alert.id !== alertId) } : current);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Weather alert could not be dismissed.");
    } finally {
      setWorkingAlertId(null);
    }
  }

  async function handleAddNeed(alertId: string) {
    setWorkingAlertId(alertId);
    setFeedback(null);
    try {
      await addWeatherSuggestedPlanNeed(alertId);
      window.dispatchEvent(new CustomEvent("uin:plan-needs-changed", { detail: { planId } }));
      setFeedback("Suggested item added to Plan Needs.");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Weather suggestion could not be added.");
    } finally {
      setWorkingAlertId(null);
    }
  }

  if (!weather) {
    return <div className="rounded-2xl border border-gray-200 bg-white p-4 text-sm text-gray-500">Loading weather context…</div>;
  }

  if (weather.status === "too_far") {
    return (
      <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-4">
        <p className="text-sm font-bold text-gray-900">Weather forecast is not available yet</p>
        <p className="mt-1 text-xs leading-5 text-gray-500">
          UIN starts showing live forecast context when the Activity enters the 16-day forecast window.
        </p>
      </div>
    );
  }

  if (weather.status === "forecast_unavailable") {
    return (
      <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-4">
        <p className="text-sm font-bold text-gray-900">Weather forecast is not available yet</p>
        <p className="mt-1 text-xs leading-5 text-gray-500">
          Forecasts follow the confirmed schedule and refresh automatically as the Activity gets closer.
        </p>
      </div>
    );
  }

  if (weather.status !== "available" || weather.locations.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-4">
        <p className="text-sm font-bold text-gray-900">No weather context yet</p>
        <p className="mt-1 text-xs leading-5 text-gray-500">
          A confirmed schedule and usable coordinates or place information are needed for the meeting point and Activity location.
        </p>
      </div>
    );
  }

  return (
    <div>
      {weather.alerts.length > 0 && (
        <div className="mb-4 space-y-3">
          {weather.alerts.map((alert) => (
            <article
              key={alert.id}
              className={`rounded-2xl border p-4 ${
                alert.severity === "critical"
                  ? "border-red-200 bg-red-50"
                  : alert.severity === "warning"
                    ? "border-amber-200 bg-amber-50"
                    : "border-sky-200 bg-sky-50"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-gray-600">
                    Weather changed · {alert.locationKind === "meeting" ? "Meeting point" : "Activity location"}
                  </p>
                  <h3 className="mt-1 text-sm font-black text-gray-950">{alert.title}</h3>
                  <p className="mt-1 max-w-3xl text-xs leading-5 text-gray-700">{alert.message}</p>
                  {alert.suggestedNeed && (
                    <p className="mt-2 text-xs font-semibold text-gray-800">
                      Suggested Plan Need: {alert.suggestedNeed}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  {canManagePlanNeeds && alert.suggestedNeed && (
                    <button
                      type="button"
                      disabled={workingAlertId === alert.id}
                      onClick={() => void handleAddNeed(alert.id)}
                      className="rounded-xl bg-gray-950 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
                    >
                      Add to Plan Needs
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={workingAlertId === alert.id}
                    onClick={() => void handleDismiss(alert.id)}
                    className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs font-bold text-gray-700 disabled:opacity-50"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {feedback && (
        <div className="mb-3 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700">
          {feedback}
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2">
      {weather.locations.map((point) => (
        <article key={point.kind} className="rounded-2xl border border-sky-100 bg-gradient-to-br from-white to-sky-50 p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-sky-700">
                {point.sameAsOtherLocation ? "Meeting point & Activity location" : point.kind === "meeting" ? "Meeting point weather" : "Activity location weather"}
              </p>
              <p className="mt-1 truncate text-sm font-bold text-gray-950" title={point.label}>{point.label}</p>
              <p className="mt-1 text-[11px] text-gray-500">{formatForecastDate(point.forecastTime)}</p>
            </div>
            <div className="shrink-0 text-right">
              <div className="text-3xl" aria-hidden="true">{point.icon}</div>
              <div className="mt-1 text-2xl font-black text-gray-950">{point.temperatureC}°</div>
            </div>
          </div>

          <p className="mt-3 text-sm font-semibold text-gray-800">{point.condition}</p>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[10px]">
            <div className="rounded-xl bg-white p-2">
              <p className="text-gray-400">Feels</p>
              <p className="mt-1 font-bold text-gray-900">{point.apparentTemperatureC === null ? "—" : `${point.apparentTemperatureC}°`}</p>
            </div>
            <div className="rounded-xl bg-white p-2">
              <p className="text-gray-400">Rain</p>
              <p className="mt-1 font-bold text-gray-900">{point.precipitationProbability === null ? "—" : `${point.precipitationProbability}%`}</p>
            </div>
            <div className="rounded-xl bg-white p-2">
              <p className="text-gray-400">Wind</p>
              <p className="mt-1 font-bold text-gray-900">{point.windSpeedKmh === null ? "—" : `${point.windSpeedKmh} km/h`}</p>
            </div>
          </div>
        </article>
      ))}
      </div>
    </div>
  );
}
