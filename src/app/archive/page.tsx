import Link from "next/link";
import { redirect } from "next/navigation";

import ArchivedResourceActions from "@/components/archive/ArchivedResourceActions";
import { resolveActivityCover } from "@/utils/activityCover";
import { createClient } from "@/utils/supabase/server";

type ArchivedResourceRow = {
  resource_type: "intent" | "plan";
  resource_id: string;
  intent_id: string | null;
  plan_id: string | null;
  title: string;
  activity_name: string;
  category_name: string;
  activity_cover_url: string | null;
  category_cover_url: string | null;
  country_name: string | null;
  city: string | null;
  district: string | null;
  location_scope: string | null;
  lifecycle_status: string;
  target_start: string;
  target_end: string;
  scheduled_start: string | null;
  scheduled_end: string | null;
  archived_at: string;
  can_delete_permanently: boolean;
};

function formatDate(value: string | null) {
  if (!value) return "Not set";
  const date = new Date(value.length === 10 ? `${value}T12:00:00Z` : value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatDateTime(value: string | null) {
  if (!value) return "Not scheduled";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Istanbul",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

export default async function PersonalArchivePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/");

  const { data, error } = await supabase.rpc("get_my_archived_resources");

  if (error) {
    console.error("Personal Archive query failed:", error);
  }

  const resources = (data ?? []) as ArchivedResourceRow[];

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8 md:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-700">
              Personal Archive
            </p>
            <h1 className="mt-2 text-3xl font-black text-gray-950">
              Hidden from your active UIN
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-600">
              Archived records stay recoverable. Independent Intents with no interaction history may also be deleted permanently.
            </p>
          </div>

          <Link
            href="/timeline"
            className="rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-gray-700 shadow-sm transition hover:border-green-300 hover:text-green-700"
          >
            <img src="/uin-logo.png" alt="uin? logo" className="h-9 w-auto" />
          </Link>
        </div>

        {error && (
          <div className="mt-8 rounded-3xl border border-red-200 bg-red-50 p-6 text-red-700">
            The archive could not be loaded: {error.message}
          </div>
        )}

        {!error && resources.length === 0 && (
          <div className="mt-8 rounded-3xl border border-gray-200 bg-white p-12 text-center shadow-sm">
            <h2 className="text-xl font-bold text-gray-950">Your archive is empty.</h2>
            <p className="mt-3 text-gray-500">Nothing has been hidden from your active Timeline yet.</p>
          </div>
        )}

        <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {resources.map((resource) => {
            const coverUrl = resolveActivityCover({
              activityCoverUrl: resource.activity_cover_url,
              categoryCoverUrl: resource.category_cover_url,
              activityName: resource.activity_name,
              categoryName: resource.category_name,
            });

            const locationLabel = [
              resource.district,
              resource.city,
              resource.country_name,
            ].filter(Boolean).join(", ");

            return (
              <article
                key={`${resource.resource_type}-${resource.resource_id}`}
                className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm"
              >
                <div className="relative h-44 overflow-hidden bg-gray-900">
                  <img
                    src={coverUrl}
                    alt={`${resource.activity_name} cover`}
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-black/30" />
                  <div className="absolute left-4 top-4 flex flex-wrap gap-2">
                    <span className="rounded-full bg-white/90 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-gray-800">
                      {resource.resource_type === "intent" ? "Intent" : "Shared Activity"}
                    </span>
                    <span className="rounded-full bg-gray-950/75 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
                      {resource.lifecycle_status}
                    </span>
                  </div>
                  <div className="absolute inset-x-0 bottom-0 p-5 text-white">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-green-300">
                      {resource.category_name}
                    </p>
                    <h2 className="mt-2 text-2xl font-black">{resource.title}</h2>
                  </div>
                </div>

                <div className="space-y-4 p-5">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-2xl bg-gray-50 p-3">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Target</p>
                      <p className="mt-1 font-semibold text-gray-900">
                        {formatDate(resource.target_start)} → {formatDate(resource.target_end)}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-gray-50 p-3">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Confirmed plan</p>
                      <p className="mt-1 font-semibold text-gray-900">
                        {formatDateTime(resource.scheduled_start)}
                      </p>
                    </div>
                  </div>

                  {locationLabel && (
                    <p className="text-sm text-gray-600">📍 {locationLabel}</p>
                  )}

                  <p className="text-xs text-gray-400">
                    Archived {formatDateTime(resource.archived_at)}
                  </p>

                  <ArchivedResourceActions
                    resourceType={resource.resource_type}
                    resourceId={resource.resource_id}
                    canDeletePermanently={resource.can_delete_permanently}
                  />
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </main>
  );
}
