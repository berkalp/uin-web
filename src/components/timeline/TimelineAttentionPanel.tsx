"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import type { PlanWeatherAlert, PlanWeatherResponse } from "@/utils/planWeather";

type OutcomeItem = {
  planId: string;
  title: string;
  dateLabel: string;
  href: string;
};

type WeatherPlanItem = {
  planId: string;
  title: string;
  dateLabel: string;
  href: string;
};

type TimelineAttentionPanelProps = {
  outcomes: OutcomeItem[];
  weatherPlans: WeatherPlanItem[];
  pendingJoinRequestCount: number;
  pendingIntentInvitationCount: number;
  pendingManagedProfileActionCount: number;
};

type WeatherAlertWithPlan = PlanWeatherAlert & {
  planTitle: string;
  planDateLabel: string;
  href: string;
};

export default function TimelineAttentionPanel({
  outcomes,
  weatherPlans,
  pendingJoinRequestCount,
  pendingIntentInvitationCount,
  pendingManagedProfileActionCount,
}: TimelineAttentionPanelProps) {
  const [weatherAlerts, setWeatherAlerts] = useState<WeatherAlertWithPlan[]>([]);

  const weatherPlanKey = useMemo(
    () => weatherPlans.map((plan) => `${plan.planId}:${plan.dateLabel}`).join("|"),
    [weatherPlans]
  );

  useEffect(() => {
    let active = true;
    const candidates = weatherPlans.slice(0, 20);
    if (candidates.length === 0) {
      setWeatherAlerts([]);
      return () => {
        active = false;
      };
    }

    void Promise.all(
      candidates.map(async (plan) => {
        try {
          const response = await fetch(`/api/weather/plans/${encodeURIComponent(plan.planId)}`, {
            cache: "no-store",
            credentials: "same-origin",
          });
          if (!response.ok) return [];
          const data = (await response.json()) as PlanWeatherResponse;
          return (data.alerts ?? []).map((alert) => ({
            ...alert,
            planTitle: plan.title,
            planDateLabel: plan.dateLabel,
            href: plan.href,
          }));
        } catch {
          return [];
        }
      })
    ).then((groups) => {
      if (!active) return;
      const seen = new Set<string>();
      const flattened = groups
        .flat()
        .filter((alert) => {
          if (seen.has(alert.id)) return false;
          seen.add(alert.id);
          return true;
        })
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setWeatherAlerts(flattened);
    });

    return () => {
      active = false;
    };
  }, [weatherPlanKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const actionCount =
    outcomes.length +
    weatherAlerts.length +
    pendingJoinRequestCount +
    pendingIntentInvitationCount +
    pendingManagedProfileActionCount;

  if (actionCount === 0) return null;

  return (
    <section className="mt-8 rounded-[28px] border border-amber-200 bg-amber-50 p-5 shadow-sm md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-700">Needs your attention</p>
          <h2 className="mt-2 text-2xl font-black text-gray-950">A few things need you</h2>
          <p className="mt-1 text-sm text-amber-900/70">
            Actions and real-world changes that may affect an Intent or Activity appear here.
          </p>
        </div>
        <span className="rounded-full bg-white px-3 py-1.5 text-xs font-black text-amber-800 shadow-sm">
          {actionCount} action{actionCount === 1 ? "" : "s"}
        </span>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {weatherAlerts.slice(0, 4).map((alert) => (
          <Link
            key={`weather-${alert.id}`}
            href={alert.href}
            className={`rounded-2xl border bg-white p-4 transition hover:-translate-y-0.5 hover:shadow-sm ${
              alert.severity === "critical"
                ? "border-red-300"
                : alert.severity === "warning"
                  ? "border-amber-300"
                  : "border-sky-200"
            }`}
          >
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-sky-700">
              Weather changed · {alert.locationKind === "meeting" ? "Meeting" : "Activity"}
            </p>
            <h3 className="mt-2 line-clamp-2 font-black text-gray-950">{alert.planTitle}</h3>
            <p className="mt-1 text-xs font-bold text-gray-700">{alert.title}</p>
            <p className="mt-2 line-clamp-2 text-xs leading-5 text-gray-500">{alert.message}</p>
            <p className="mt-2 text-[11px] text-gray-400">{alert.planDateLabel}</p>
          </Link>
        ))}

        {outcomes.slice(0, 4).map((item) => (
          <Link
            key={`attention-${item.planId}`}
            href={item.href}
            className="rounded-2xl border border-amber-200 bg-white p-4 transition hover:-translate-y-0.5 hover:border-amber-300 hover:shadow-sm"
          >
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-amber-700">Outcome review</p>
            <h3 className="mt-2 line-clamp-2 font-black text-gray-950">{item.title}</h3>
            <p className="mt-2 text-xs text-gray-500">{item.dateLabel}</p>
          </Link>
        ))}

        {pendingJoinRequestCount > 0 && (
          <Link href="/join-requests" className="rounded-2xl border border-amber-200 bg-white p-4 transition hover:-translate-y-0.5 hover:border-amber-300 hover:shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-amber-700">Join requests</p>
            <h3 className="mt-2 font-black text-gray-950">{pendingJoinRequestCount} request{pendingJoinRequestCount === 1 ? "" : "s"} waiting</h3>
            <p className="mt-2 text-xs text-gray-500">Review who wants to join your Intents.</p>
          </Link>
        )}

        {pendingIntentInvitationCount > 0 && (
          <Link href="/intent-invitations" className="rounded-2xl border border-amber-200 bg-white p-4 transition hover:-translate-y-0.5 hover:border-amber-300 hover:shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-amber-700">Invitations</p>
            <h3 className="mt-2 font-black text-gray-950">{pendingIntentInvitationCount} invitation{pendingIntentInvitationCount === 1 ? "" : "s"} waiting</h3>
            <p className="mt-2 text-xs text-gray-500">Accept or decline direct Intent invitations.</p>
          </Link>
        )}

        {pendingManagedProfileActionCount > 0 && (
          <Link href="/settings/family" className="rounded-2xl border border-amber-200 bg-white p-4 transition hover:-translate-y-0.5 hover:border-amber-300 hover:shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-amber-700">Family</p>
            <h3 className="mt-2 font-black text-gray-950">{pendingManagedProfileActionCount} family action{pendingManagedProfileActionCount === 1 ? "" : "s"}</h3>
            <p className="mt-2 text-xs text-gray-500">Review pending managed-profile invitations.</p>
          </Link>
        )}
      </div>
    </section>
  );
}
