import type { Metadata } from "next";
import Link from "next/link";

import SeedCatalogueSubjectFields from "@/components/admin/SeedCatalogueSubjectFields";
import { createClient } from "@/utils/supabase/server";

import {
  createSeedCatalogueItem,
  reviewSeedCatalogueItem,
  updateSeedCatalogueItem,
} from "./actions";

export const metadata: Metadata = {
  title: "Seed Library Management | UIN Admin",
};

type AdminSeedCataloguePageProps = {
  searchParams: Promise<{
    status?: string | string[];
    q?: string | string[];
    error?: string | string[];
    updated?: string | string[];
  }>;
};

type SeedTypeRow = {
  id: string;
  name: string;
  slug: string;
  icon: string;
  description: string | null;
  sort_order: number;
};

type PlaceDetails = {
  country_name: string | null;
  region_name: string | null;
  city_name: string | null;
  address_text: string | null;
  latitude: number | string | null;
  longitude: number | string | null;
  map_url: string | null;
  external_place_id: string | null;
};

type DuplicateCandidate = {
  catalog_item_id: string;
  canonical_title: string;
  creator_name: string | null;
  item_kind: string;
  score: number | string;
};

type CatalogueItem = {
  catalog_item_id: string;
  seed_type_id: string;
  seed_type_name: string;
  seed_type_slug: string;
  seed_type_icon: string;
  item_kind: string;
  canonical_title: string;
  original_title: string | null;
  creator_name: string | null;
  release_year: number | null;
  cover_url: string | null;
  language_code: string | null;
  status: "active" | "pending" | "under_review" | "merged" | "rejected";
  metadata: Record<string, unknown>;
  place: PlaceDetails | null;
  duplicate_candidates: DuplicateCandidate[];
  created_at: string;
  personal_seed_count: number;
  created_by: {
    user_id: string;
    full_name: string | null;
    username: string | null;
  } | null;
  report_count?: number;
  latest_report?: {
    report_id: string;
    reason: string;
    details: string | null;
    created_at: string;
    reporter: {
      user_id: string | null;
      full_name: string | null;
      username: string | null;
    } | null;
  } | null;
  aliases: Array<{
    id: string;
    alias: string;
    language_code: string | null;
    source: string;
    is_primary: boolean;
  }>;
};

type CatalogueCounts = {
  pending?: number | string | null;
  active?: number | string | null;
  under_review?: number | string | null;
  rejected?: number | string | null;
  merged?: number | string | null;
};

function one(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0]?.trim() || "";
  return value?.trim() || "";
}

function numberValue(value: number | string | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

function statusLabel(status: string): string {
  switch (status) {
    case "pending":
      return "Needs Review";
    case "under_review":
      return "Reports";
    case "active":
      return "Active Library";
    case "rejected":
      return "Rejected";
    case "merged":
      return "Merged History";
    default:
      return "Library";
  }
}

function statusTone(status: string): string {
  switch (status) {
    case "pending":
      return "border-amber-200 bg-amber-50 text-amber-800";
    case "under_review":
      return "border-red-200 bg-red-50 text-red-800";
    case "active":
      return "border-emerald-200 bg-emerald-50 text-emerald-800";
    case "rejected":
      return "border-gray-200 bg-gray-100 text-gray-700";
    default:
      return "border-gray-200 bg-white text-gray-700";
  }
}

function mapQuery(item: CatalogueItem): string {
  const place = item.place;
  if (place?.latitude != null && place?.longitude != null) {
    return `${place.latitude},${place.longitude}`;
  }
  return [
    item.canonical_title,
    place?.address_text,
    place?.city_name,
    place?.region_name,
    place?.country_name,
  ]
    .filter(Boolean)
    .filter((value, index, values) => values.indexOf(value) === index)
    .join(", ");
}

export default async function AdminSeedCataloguePage({
  searchParams,
}: AdminSeedCataloguePageProps) {
  const params = await searchParams;
  const requestedStatus = one(params.status) || "pending";
  const allowedStatuses = ["pending", "active", "under_review", "rejected", "merged", "all"];
  const status = allowedStatuses.includes(requestedStatus) ? requestedStatus : "pending";
  const query = one(params.q);
  const errorMessage = one(params.error);
  const updated = one(params.updated);

  const supabase = await createClient();
  const [itemsResponse, seedTypesResponse, countsResponse] = await Promise.all([
    supabase.rpc("get_admin_seed_catalog_items", {
      p_status: status === "all" ? null : status,
      p_query: query || null,
      p_limit: 150,
    }),
    supabase.rpc("get_active_seed_types"),
    supabase.rpc("get_admin_seed_catalog_counts"),
  ]);

  const items = (itemsResponse.data ?? []) as CatalogueItem[];
  const seedTypes = (seedTypesResponse.data ?? []) as SeedTypeRow[];
  const counts = (countsResponse.data ?? {}) as CatalogueCounts;
  const pendingCount = numberValue(counts.pending);
  const activeCount = numberValue(counts.active);
  const reportCount = numberValue(counts.under_review);
  const rejectedCount = numberValue(counts.rejected);
  const mergedCount = numberValue(counts.merged);

  const currentParams = new URLSearchParams({ status });
  if (query) currentParams.set("q", query);
  const returnTo = `/admin/seed-catalogue?${currentParams.toString()}`;

  const tabs = [
    { status: "pending", label: "Needs Review", count: pendingCount, tone: "amber" },
    { status: "active", label: "Active Library", count: activeCount, tone: "emerald" },
    { status: "under_review", label: "Reports", count: reportCount, tone: "red" },
    { status: "rejected", label: "Rejected", count: rejectedCount, tone: "gray" },
  ];

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">
              UIN Admin · Shared Vocabulary
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-gray-950">
              Seed Library Management
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-600">
              Curate the canonical subjects people can plant. Suggestions stay private until reviewed,
              duplicate subjects merge into one identity, and type-specific metadata gives books,
              places, films and other Seeds the context they actually need.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {mergedCount > 0 && (
              <Link
                href="/admin/seed-catalogue?status=merged"
                className="rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-bold text-gray-700 hover:border-gray-950"
              >
                Merged history · {mergedCount}
              </Link>
            )}
            <Link
              href="/admin"
              className="rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-bold text-gray-800 hover:border-gray-950"
            >
              Admin home
            </Link>
          </div>
        </div>

        {(pendingCount > 0 || reportCount > 0) && (
          <section className="mb-6 rounded-3xl border border-amber-200 bg-amber-50 p-5 shadow-sm sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-700">Curation queue</p>
                <h2 className="mt-1 text-xl font-black text-amber-950">
                  {pendingCount + reportCount} Seed Library item{pendingCount + reportCount === 1 ? "" : "s"} need attention
                </h2>
                <p className="mt-1 text-sm text-amber-800">
                  {pendingCount} new suggestion{pendingCount === 1 ? "" : "s"} · {reportCount} reported subject{reportCount === 1 ? "" : "s"}
                </p>
              </div>
              <div className="flex gap-2">
                {pendingCount > 0 && (
                  <Link href="/admin/seed-catalogue?status=pending" className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-black text-white hover:bg-amber-700">
                    Review suggestions
                  </Link>
                )}
                {reportCount > 0 && (
                  <Link href="/admin/seed-catalogue?status=under_review" className="rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-black text-red-700 hover:bg-red-50">
                    Review reports
                  </Link>
                )}
              </div>
            </div>
          </section>
        )}

        <section className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {tabs.map((tab) => (
            <Link
              key={tab.status}
              href={`/admin/seed-catalogue?status=${tab.status}`}
              className={`rounded-2xl border p-4 transition hover:-translate-y-0.5 hover:shadow-sm ${
                status === tab.status ? statusTone(tab.status) : "border-gray-200 bg-white text-gray-700"
              }`}
            >
              <p className="text-xs font-black uppercase tracking-wide">{tab.label}</p>
              <p className="mt-2 text-2xl font-black">{tab.count}</p>
            </Link>
          ))}
        </section>

        <details className="mb-6 overflow-hidden rounded-3xl border border-emerald-200 bg-white shadow-sm">
          <summary className="cursor-pointer bg-emerald-50 px-5 py-4 text-base font-black text-emerald-950 sm:px-6">
            + Add a verified Seed directly to the Library
          </summary>
          <form action={createSeedCatalogueItem} className="space-y-4 border-t border-emerald-100 p-5 sm:p-6">
            <input type="hidden" name="return_to" value={returnTo} />
            <SeedCatalogueSubjectFields mode="create" seedTypes={seedTypes} />
            <div className="flex justify-end">
              <button type="submit" className="rounded-2xl bg-emerald-600 px-6 py-3 text-sm font-black text-white hover:bg-emerald-700">
                Add verified subject
              </button>
            </div>
          </form>
        </details>

        <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-gray-500">{statusLabel(status)}</p>
              <h2 className="mt-1 text-xl font-black text-gray-950">
                {items.length} item{items.length === 1 ? "" : "s"} shown
              </h2>
            </div>
            <form method="get" className="flex min-w-0 flex-1 gap-2 sm:max-w-xl">
              <input type="hidden" name="status" value={status} />
              <input
                name="q"
                defaultValue={query}
                placeholder="Search title, alias or creator"
                className="min-w-0 flex-1 rounded-2xl border border-gray-300 px-4 py-3 outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
              />
              <button type="submit" className="rounded-2xl bg-gray-950 px-5 py-3 text-sm font-black text-white">Search</button>
            </form>
          </div>

          {itemsResponse.error && (
            <p className="mt-4 rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700">{itemsResponse.error.message}</p>
          )}
          {countsResponse.error && (
            <p className="mt-4 rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700">Queue counts could not be loaded: {countsResponse.error.message}</p>
          )}
          {errorMessage && (
            <p className="mt-4 rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700">{errorMessage}</p>
          )}
          {updated && (
            <p className="mt-4 rounded-2xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">Catalogue item updated: {updated}.</p>
          )}
        </section>

        <section className="mt-6 space-y-5">
          {items.map((item) => {
            const duplicates = item.duplicate_candidates ?? [];
            const placeQuery = mapQuery(item);
            const mapEmbedUrl = placeQuery
              ? `https://www.google.com/maps?q=${encodeURIComponent(placeQuery)}&output=embed`
              : null;
            const description = typeof item.metadata?.description === "string" ? item.metadata.description : "";

            return (
              <article key={item.catalog_item_id} className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
                <div className="grid lg:grid-cols-[170px_1fr]">
                  <div className="min-h-44 bg-gradient-to-br from-emerald-50 to-lime-100">
                    {item.cover_url ? (
                      <img src={item.cover_url} alt="" className="h-full min-h-44 w-full object-cover" />
                    ) : item.seed_type_slug === "visit" && mapEmbedUrl ? (
                      <iframe title={`${item.canonical_title} map`} src={mapEmbedUrl} loading="lazy" referrerPolicy="no-referrer-when-downgrade" className="h-full min-h-44 w-full border-0" />
                    ) : (
                      <div className="flex h-full min-h-44 items-center justify-center text-5xl">{item.seed_type_icon || "🌱"}</div>
                    )}
                  </div>

                  <div className="p-5 sm:p-6">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-xs font-black uppercase tracking-wide text-emerald-700">
                          {item.seed_type_icon} {item.seed_type_name} · {item.item_kind}
                        </p>
                        <h2 className="mt-2 text-2xl font-black text-gray-950">{item.canonical_title}</h2>
                        {(item.creator_name || item.release_year) && (
                          <p className="mt-1 text-sm font-semibold text-gray-600">
                            {[item.creator_name, item.release_year].filter(Boolean).join(" · ")}
                          </p>
                        )}
                        {item.seed_type_slug === "visit" && item.place && (
                          <p className="mt-1 text-sm font-semibold text-gray-600">
                            {[item.place.city_name, item.place.region_name, item.place.country_name]
                              .filter(Boolean)
                              .filter((value, index, values) => values.indexOf(value) === index)
                              .join(" · ") || "Place details not completed yet"}
                          </p>
                        )}
                        {description && <p className="mt-3 max-w-3xl text-sm leading-6 text-gray-600">{description}</p>}
                        <p className="mt-3 text-xs text-gray-500">
                          {item.personal_seed_count} linked personal Seed{item.personal_seed_count === 1 ? "" : "s"} · added {formatDate(item.created_at)}
                        </p>
                        {item.created_by && (
                          <p className="mt-1 text-xs text-gray-500">
                            Suggested by {item.created_by.full_name || item.created_by.username || "UIN member"}
                            {item.created_by.username ? ` · @${item.created_by.username}` : ""}
                          </p>
                        )}
                      </div>
                      <span className={`rounded-full border px-3 py-1 text-xs font-black uppercase ${statusTone(item.status)}`}>{statusLabel(item.status)}</span>
                    </div>

                    {item.status === "under_review" && item.latest_report && (
                      <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-xs font-black uppercase tracking-wide text-red-700">Reported Library subject</p>
                            <p className="mt-1 text-sm font-black capitalize text-red-950">{item.latest_report.reason.replaceAll("_", " ")}</p>
                            {item.latest_report.details && <p className="mt-2 text-sm leading-6 text-red-900">{item.latest_report.details}</p>}
                            <p className="mt-2 text-xs text-red-700">
                              Reporter: {item.latest_report.reporter?.full_name || item.latest_report.reporter?.username || "Member"}
                            </p>
                          </div>
                          <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-red-700">
                            {item.report_count ?? 1} open report{(item.report_count ?? 1) === 1 ? "" : "s"}
                          </span>
                        </div>
                      </div>
                    )}

                    {item.aliases.length > 0 && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {item.aliases.map((alias) => (
                          <span key={alias.id} className="rounded-full bg-gray-50 px-3 py-1 text-xs font-semibold text-gray-600">
                            {alias.alias}{alias.language_code ? ` · ${alias.language_code}` : ""}
                          </span>
                        ))}
                      </div>
                    )}

                    {(item.status === "active" || item.status === "pending" || item.status === "under_review") && (
                      <details className="mt-5 rounded-2xl border border-gray-200 bg-gray-50">
                        <summary className="cursor-pointer px-4 py-3 text-sm font-black text-gray-800">Edit shared subject, cover and metadata</summary>
                        <form action={updateSeedCatalogueItem} className="space-y-4 border-t border-gray-200 p-4">
                          <input type="hidden" name="catalog_item_id" value={item.catalog_item_id} />
                          <input type="hidden" name="return_to" value={returnTo} />
                          <SeedCatalogueSubjectFields
                            mode="edit"
                            seedTypes={seedTypes}
                            initialSeedTypeId={item.seed_type_id}
                            initialSeedTypeSlug={item.seed_type_slug}
                            initialItemKind={item.item_kind}
                            initialTitle={item.canonical_title}
                            initialCreatorName={item.creator_name}
                            initialOriginalTitle={item.original_title}
                            initialReleaseYear={item.release_year}
                            initialCoverUrl={item.cover_url}
                            initialLanguageCode={item.language_code}
                            initialMetadata={item.metadata}
                            initialPlace={item.place}
                            compact
                          />
                          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 pt-4">
                            <Link href={`/seeds/subjects/${encodeURIComponent(item.catalog_item_id)}`} className="rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-black text-gray-700 hover:border-gray-950">
                              View Library page
                            </Link>
                            <button type="submit" className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-black text-white hover:bg-emerald-700">Save subject details</button>
                          </div>
                        </form>
                      </details>
                    )}

                    {(item.status === "pending" || item.status === "under_review") && (
                      <div className="mt-5 border-t border-gray-100 pt-5">
                        {item.status === "pending" && (
                          <div className={`mb-4 rounded-2xl border p-4 ${duplicates.length > 0 ? "border-blue-200 bg-blue-50" : "border-gray-200 bg-gray-50"}`}>
                            <p className="text-xs font-black uppercase tracking-wide text-gray-600">Duplicate check</p>
                            {duplicates.length > 0 ? (
                              <>
                                <p className="mt-1 text-sm font-black text-blue-950">Possible existing subject{duplicates.length === 1 ? "" : "s"} found</p>
                                <div className="mt-3 space-y-2">
                                  {duplicates.map((candidate) => (
                                    <div key={candidate.catalog_item_id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-100 bg-white p-3">
                                      <div>
                                        <p className="font-black text-gray-950">{candidate.canonical_title}</p>
                                        <p className="text-xs text-gray-500">
                                          {candidate.creator_name || candidate.item_kind} · {Math.round(numberValue(candidate.score) * 100)}% similarity
                                        </p>
                                      </div>
                                      <form action={reviewSeedCatalogueItem}>
                                        <input type="hidden" name="catalog_item_id" value={item.catalog_item_id} />
                                        <input type="hidden" name="review_action" value="merge" />
                                        <input type="hidden" name="target_catalog_item_id" value={candidate.catalog_item_id} />
                                        <input type="hidden" name="return_to" value={returnTo} />
                                        <button type="submit" className="rounded-xl bg-gray-950 px-4 py-2 text-xs font-black text-white">Merge with this subject</button>
                                      </form>
                                    </div>
                                  ))}
                                </div>
                              </>
                            ) : (
                              <p className="mt-1 text-sm font-semibold text-gray-600">No likely duplicate found in the same Seed Type and subject kind.</p>
                            )}
                          </div>
                        )}

                        <div className="grid gap-3 sm:grid-cols-2">
                          <form action={reviewSeedCatalogueItem}>
                            <input type="hidden" name="catalog_item_id" value={item.catalog_item_id} />
                            <input type="hidden" name="review_action" value="approve" />
                            <input type="hidden" name="return_to" value={returnTo} />
                            <button type="submit" className="w-full rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black text-white hover:bg-emerald-700">
                              {item.status === "under_review" ? "Restore subject" : "Approve to Library"}
                            </button>
                          </form>
                          <form action={reviewSeedCatalogueItem}>
                            <input type="hidden" name="catalog_item_id" value={item.catalog_item_id} />
                            <input type="hidden" name="review_action" value="reject" />
                            <input type="hidden" name="return_to" value={returnTo} />
                            <button type="submit" className="w-full rounded-2xl border border-red-300 bg-white px-5 py-3 text-sm font-black text-red-700 hover:bg-red-50">
                              {item.status === "under_review" ? "Remove from Library" : "Reject suggestion"}
                            </button>
                          </form>
                        </div>
                      </div>
                    )}

                    {item.status === "rejected" && (
                      <div className="mt-5 border-t border-gray-100 pt-5">
                        <form action={reviewSeedCatalogueItem}>
                          <input type="hidden" name="catalog_item_id" value={item.catalog_item_id} />
                          <input type="hidden" name="review_action" value="approve" />
                          <input type="hidden" name="return_to" value={returnTo} />
                          <button type="submit" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-black text-emerald-800 hover:bg-emerald-100">Restore to Library</button>
                        </form>
                      </div>
                    )}
                  </div>
                </div>
              </article>
            );
          })}

          {!itemsResponse.error && items.length === 0 && (
            <div className="rounded-3xl border border-dashed border-gray-300 bg-white p-8 text-center">
              <p className="font-black text-gray-950">Nothing is waiting in {statusLabel(status).toLowerCase()}.</p>
              <p className="mt-2 text-sm text-gray-500">The quiet is suspicious, but technically desirable.</p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
