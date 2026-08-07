import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import SeedCatalogueSubjectFields from "@/components/admin/SeedCatalogueSubjectFields";
import SeedExperienceEngagement, {
  type SeedExperienceCommentPreview,
  type SeedExperienceEngagementData,
} from "@/components/seeds/SeedExperienceEngagement";
import SeedSubjectMetadataPanel from "@/components/seeds/SeedSubjectMetadataPanel";
import { createClient } from "@/utils/supabase/server";

import { plantSeedFromCatalogue } from "../../explore/actions";
import {
  adminReviewSeedLibrarySubject,
  adminUpdateSeedLibrarySubject,
  reportSeedLibrarySubject,
} from "./actions";

type SeedSubjectPageProps = {
  params: Promise<{ subjectId: string }>;
  searchParams: Promise<{
    error?: string | string[];
    planted?: string | string[];
    admin_updated?: string | string[];
  }>;
};

type SubjectDetail = {
  subject: {
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
    metadata: Record<string, unknown>;
    status: string;
  };
  aliases: Array<{
    id: string;
    alias: string;
    language_code: string | null;
    source: string;
    is_primary: boolean;
  }>;
  editions: Array<{
    id: string;
    edition_label: string | null;
    isbn: string | null;
    publisher: string | null;
    translator: string | null;
    language_code: string | null;
    publication_year: number | null;
    format: string | null;
  }>;
  stats: {
    planted_count: number;
    active_count: number;
    completed_count: number;
    experience_count: number;
    inspired_seed_count: number;
  };
  viewer_seed: {
    seed_id: string;
    status: string;
    title: string;
  } | null;
  viewer_active_seed?: {
    seed_id: string;
    status: string;
    title: string;
  } | null;
  viewer_completed_seed?: {
    seed_id: string;
    status: string;
    title: string;
    origin?: string;
    completed_date_precision?: "exact" | "year" | "unknown" | null;
    completed_year?: number | null;
  } | null;
  experiences: Array<{
    seed_id: string;
    title: string;
    completed_at: string | null;
    origin?: "planted" | "retrospective";
    completed_date_precision?: "exact" | "year" | "unknown" | null;
    completed_year?: number | null;
    owner: {
      user_id: string;
      full_name: string | null;
      username: string | null;
      avatar_url: string | null;
    };
    reflection: {
      entry_id: string;
      body: string | null;
      key_takeaway: string | null;
      attachments: Array<Record<string, unknown>>;
      occurred_on: string;
    };
    inspired_seed_count: number;
    experience_comment_policy: "everyone" | "friends" | "same_seed" | "off";
    engagement: SeedExperienceEngagementData;
    comments: SeedExperienceCommentPreview[];
  }>;
};

type SeedTypeRow = {
  id: string;
  name: string;
  slug: string;
  icon: string;
  description: string | null;
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

function one(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0]?.trim() || "";
  return value?.trim() || "";
}

function getPastExperienceLabel(seedTypeSlug: string): string {
  switch (seedTypeSlug) {
    case "read":
      return "I’ve read this";
    case "watch":
      return "I’ve watched this";
    case "listen":
      return "I’ve listened to this";
    case "visit":
      return "I’ve been here";
    case "play":
      return "I’ve played this";
    default:
      return "I’ve already done this";
  }
}

function formatExperienceDate(experience: {
  completed_at: string | null;
  completed_date_precision?: "exact" | "year" | "unknown" | null;
  completed_year?: number | null;
}): string {
  if (experience.completed_date_precision === "unknown") {
    return "Date not remembered";
  }

  if (experience.completed_date_precision === "year") {
    return experience.completed_year
      ? String(experience.completed_year)
      : "Year not set";
  }

  if (!experience.completed_at) return "Completed";

  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(experience.completed_at));
}

export async function generateMetadata({
  params,
}: SeedSubjectPageProps): Promise<Metadata> {
  const { subjectId } = await params;
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_seed_catalog_detail", {
    p_catalog_item_id: subjectId,
  });
  const detail = data as SubjectDetail | null;

  return {
    title: detail?.subject
      ? `${detail.subject.canonical_title} | Seed Library`
      : "Seed Subject | UIN",
  };
}

export default async function SeedSubjectPage({
  params,
  searchParams,
}: SeedSubjectPageProps) {
  const [{ subjectId }, queryParams] = await Promise.all([
    params,
    searchParams,
  ]);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "get_seed_catalog_detail",
    { p_catalog_item_id: subjectId }
  );

  if (error || !data) {
    notFound();
  }

  const detail = data as SubjectDetail;
  const subject = detail.subject;
  const { data: { user } } = await supabase.auth.getUser();
  let adminRole: string | null = null;
  if (user) {
    const { data: roleData } = await supabase.rpc("get_admin_role");
    adminRole = typeof roleData === "string" ? roleData : null;
  }
  const isAdmin = Boolean(adminRole);
  const [placeResponse, seedTypesResponse] = await Promise.all([
    supabase
      .from("seed_catalog_place_details")
      .select("country_name,region_name,city_name,address_text,latitude,longitude,map_url,external_place_id")
      .eq("catalog_item_id", subject.catalog_item_id)
      .maybeSingle(),
    isAdmin ? supabase.rpc("get_active_seed_types") : Promise.resolve({ data: [] }),
  ]);
  const place = (placeResponse.data ?? null) as PlaceDetails | null;
  const seedTypes = (seedTypesResponse.data ?? []) as SeedTypeRow[];
  const returnTo = `/seeds/subjects/${encodeURIComponent(subjectId)}`;
  const viewerCompletedHasExperience = Boolean(
    detail.viewer_completed_seed?.seed_id &&
      detail.experiences.some(
        (experience) =>
          experience.seed_id === detail.viewer_completed_seed?.seed_id
      )
  );
  const errorMessage = one(queryParams.error);
  const plantedNotice = one(queryParams.planted);
  const adminUpdated = one(queryParams.admin_updated);

  return (
    <main className="min-h-screen bg-[#f7f8f4] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/seeds/explore"
            className="text-sm font-bold text-gray-600 hover:text-gray-950"
          >
            ← Seed Library
          </Link>
          {isAdmin && (
            <a
              href="#admin-seed-editor"
              className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-black uppercase tracking-wide text-emerald-800 hover:bg-emerald-100"
            >
              Admin · Edit Library Subject
            </a>
          )}
        </div>

        <section className="overflow-hidden rounded-[2rem] border border-gray-200 bg-white shadow-sm">
          <div className="grid md:grid-cols-[260px_1fr]">
            <div className="min-h-72 bg-gradient-to-br from-emerald-50 to-lime-100">
              {subject.cover_url ? (
                <img
                  src={subject.cover_url}
                  alt=""
                  className="h-full min-h-72 w-full object-cover"
                />
              ) : (
                <div className="flex h-full min-h-72 items-center justify-center text-7xl">
                  {subject.seed_type_icon || "🌱"}
                </div>
              )}
            </div>

            <div className="p-6 sm:p-8">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">
                  {subject.seed_type_icon} {subject.seed_type_name} · {subject.item_kind}
                </p>
                {subject.status === "pending" && (
                  <span className="rounded-full bg-amber-50 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-amber-800">Pending Library review</span>
                )}
              </div>
              <h1 className="mt-3 text-3xl font-black tracking-tight text-gray-950 sm:text-4xl">
                {subject.canonical_title}
              </h1>
              {(subject.creator_name || subject.release_year) && (
                <p className="mt-2 text-base font-semibold text-gray-600">
                  {[subject.creator_name, subject.release_year]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              )}

              {subject.original_title &&
                subject.original_title !== subject.canonical_title && (
                  <p className="mt-2 text-sm text-gray-500">
                    Original title: {subject.original_title}
                  </p>
                )}

              <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
                {[
                  ["Journeys", detail.stats.planted_count],
                  ["Active", detail.stats.active_count],
                  ["Completed", detail.stats.completed_count],
                  ["Experiences", detail.stats.experience_count],
                  ["Inspired", detail.stats.inspired_seed_count],
                ].map(([label, value]) => (
                  <div
                    key={String(label)}
                    className="rounded-2xl bg-gray-50 p-3"
                  >
                    <p className="text-xl font-black text-gray-950">{value}</p>
                    <p className="mt-1 text-[11px] font-bold uppercase tracking-wide text-gray-500">
                      {label}
                    </p>
                  </div>
                ))}
              </div>

              {errorMessage && (
                <p className="mt-5 rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700">
                  {errorMessage}
                </p>
              )}
              {plantedNotice && (
                <p className="mt-5 rounded-2xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
                  Your personal Seed is now linked to this shared subject.
                </p>
              )}
              {adminUpdated && (
                <p className="mt-5 rounded-2xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
                  Library subject updated successfully.
                </p>
              )}

              <div className="mt-6 flex flex-wrap gap-2">
                {detail.viewer_active_seed?.seed_id ? (
                  <Link
                    href={`/seeds/${encodeURIComponent(
                      detail.viewer_active_seed.seed_id
                    )}`}
                    className="rounded-full bg-emerald-50 px-5 py-3 text-sm font-black text-emerald-700 hover:bg-emerald-100"
                  >
                    ✓ Open my Seed
                  </Link>
                ) : (
                  <form action={plantSeedFromCatalogue}>
                    <input
                      type="hidden"
                      name="catalog_item_id"
                      value={subject.catalog_item_id}
                    />
                    <input type="hidden" name="return_to" value={returnTo} />
                    <button
                      type="submit"
                      className="rounded-full bg-emerald-600 px-5 py-3 text-sm font-black text-white hover:bg-emerald-700"
                    >
                      Plant this Seed
                    </button>
                  </form>
                )}

                {detail.viewer_completed_seed?.seed_id ? (
                  <Link
                    href={`/seeds/${encodeURIComponent(
                      detail.viewer_completed_seed.seed_id
                    )}`}
                    className="rounded-full border border-purple-200 bg-purple-50 px-5 py-3 text-sm font-black text-purple-800 hover:bg-purple-100"
                  >
                    {viewerCompletedHasExperience
                      ? "Open my experience"
                      : "Add my experience"}
                  </Link>
                ) : (
                  <Link
                    href={`${returnTo}/past`}
                    className="rounded-full border border-purple-200 bg-purple-50 px-5 py-3 text-sm font-black text-purple-800 hover:bg-purple-100"
                  >
                    {getPastExperienceLabel(subject.seed_type_slug)}
                  </Link>
                )}

                <Link
                  href="/seeds"
                  className="rounded-full border border-gray-300 px-5 py-3 text-sm font-black text-gray-800 hover:border-gray-950"
                >
                  My Seeds
                </Link>
              </div>

              {user && subject.status === "active" && (
                <details className="mt-5 rounded-2xl border border-gray-200 bg-gray-50">
                  <summary className="cursor-pointer px-4 py-3 text-sm font-bold text-gray-600 hover:text-red-700">
                    Report this Library subject
                  </summary>
                  <form action={reportSeedLibrarySubject} className="space-y-3 border-t border-gray-200 p-4">
                    <input type="hidden" name="catalog_item_id" value={subject.catalog_item_id} />
                    <p className="text-xs leading-5 text-gray-500">
                      A report immediately removes this shared subject from public Library and profile surfaces while UIN reviews it. Personal Seed history is not deleted.
                    </p>
                    <select name="reason" required defaultValue="" className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm font-semibold">
                      <option value="" disabled>Select a reason</option>
                      <option value="offensive">Offensive or abusive</option>
                      <option value="hate_harassment">Hate or harassment</option>
                      <option value="sexual">Sexual content</option>
                      <option value="spam">Spam or advertising</option>
                      <option value="misleading">Misleading / wrong subject</option>
                      <option value="other">Other</option>
                    </select>
                    <textarea name="details" maxLength={1000} rows={3} placeholder="Optional details" className="w-full resize-y rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm" />
                    <button type="submit" className="rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-black text-red-700 hover:bg-red-50">
                      Report subject
                    </button>
                  </form>
                </details>
              )}
            </div>
          </div>
        </section>

        <SeedSubjectMetadataPanel
          seedTypeSlug={subject.seed_type_slug}
          itemKind={subject.item_kind}
          title={subject.canonical_title}
          metadata={subject.metadata}
          place={place}
        />

        {isAdmin && (
          <section
            id="admin-seed-editor"
            className="mt-6 overflow-hidden rounded-3xl border border-emerald-200 bg-white shadow-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-4 bg-emerald-50 px-5 py-4 sm:px-6">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-emerald-700">
                  Admin controls
                </p>
                <h2 className="mt-1 text-xl font-black text-gray-950">
                  Edit this Library Subject
                </h2>
                <p className="mt-1 max-w-2xl text-xs leading-5 text-gray-600">
                  Changes here update the shared identity inherited by every linked Seed. Personal notes, journals and visibility remain untouched.
                </p>
              </div>
              <Link
                href={`/admin/seed-catalogue?status=all&q=${encodeURIComponent(subject.canonical_title)}`}
                className="rounded-full border border-emerald-200 bg-white px-4 py-2 text-xs font-black text-emerald-800 hover:border-emerald-500"
              >
                Open in Seed Catalogue
              </Link>
            </div>

            <form
              action={adminUpdateSeedLibrarySubject}
              className="space-y-4 p-5 sm:p-6"
            >
              <input type="hidden" name="catalog_item_id" value={subject.catalog_item_id} />
              <input type="hidden" name="return_to" value={returnTo} />
              <SeedCatalogueSubjectFields
                mode="edit"
                seedTypes={seedTypes}
                initialSeedTypeId={subject.seed_type_id}
                initialSeedTypeSlug={subject.seed_type_slug}
                initialItemKind={subject.item_kind}
                initialTitle={subject.canonical_title}
                initialCreatorName={subject.creator_name}
                initialOriginalTitle={subject.original_title}
                initialReleaseYear={subject.release_year}
                initialCoverUrl={subject.cover_url}
                initialLanguageCode={subject.language_code}
                initialMetadata={subject.metadata}
                initialPlace={place}
              />
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-4">
                <p className="text-xs leading-5 text-gray-500">
                  Type and subject kind stay locked here so shared identity cannot drift accidentally.
                </p>
                <button
                  type="submit"
                  className="rounded-2xl bg-emerald-600 px-6 py-3 text-sm font-black text-white hover:bg-emerald-700"
                >
                  Save Library Subject
                </button>
              </div>
            </form>

            {(subject.status === "pending" || subject.status === "under_review") && (
              <div className="grid gap-3 border-t border-emerald-100 bg-emerald-50/40 p-5 sm:grid-cols-2 sm:p-6">
                <form action={adminReviewSeedLibrarySubject}>
                  <input type="hidden" name="catalog_item_id" value={subject.catalog_item_id} />
                  <input type="hidden" name="review_action" value="approve" />
                  <input type="hidden" name="return_to" value={returnTo} />
                  <button
                    type="submit"
                    className="w-full rounded-2xl bg-gray-950 px-5 py-3 text-sm font-black text-white hover:bg-gray-800"
                  >
                    {subject.status === "under_review" ? "Restore to Library" : "Approve to Library"}
                  </button>
                </form>
                <form action={adminReviewSeedLibrarySubject}>
                  <input type="hidden" name="catalog_item_id" value={subject.catalog_item_id} />
                  <input type="hidden" name="review_action" value="reject" />
                  <input type="hidden" name="return_to" value={returnTo} />
                  <button
                    type="submit"
                    className="w-full rounded-2xl border border-red-200 bg-white px-5 py-3 text-sm font-black text-red-700 hover:bg-red-50"
                  >
                    {subject.status === "under_review" ? "Remove from Library" : "Reject suggestion"}
                  </button>
                </form>
              </div>
            )}
          </section>
        )}

        {detail.aliases.length > 1 && (
          <section className="mt-6 rounded-3xl border border-gray-200 bg-white p-6">
            <h2 className="text-lg font-black text-gray-950">
              Names that resolve here
            </h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {detail.aliases.map((alias) => (
                <span
                  key={alias.id}
                  className="rounded-full bg-gray-100 px-3 py-1.5 text-sm font-semibold text-gray-700"
                >
                  {alias.alias}
                  {alias.language_code ? ` · ${alias.language_code}` : ""}
                </span>
              ))}
            </div>
          </section>
        )}

        <section className="mt-8">
          <div className="mb-4">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-gray-500">
              Completed Seeds
            </p>
            <h2 className="mt-1 text-2xl font-black text-gray-950">
              Experiences
            </h2>
          </div>

          {detail.experiences.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {detail.experiences.map((experience) => {
                const ownerName =
                  experience.owner.full_name ||
                  experience.owner.username ||
                  "UIN member";

                return (
                  <article
                    key={experience.seed_id}
                    className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm"
                  >
                    <div className="flex items-center gap-3">
                      {experience.owner.avatar_url ? (
                        <img
                          src={experience.owner.avatar_url}
                          alt=""
                          className="h-11 w-11 rounded-full object-cover"
                        />
                      ) : (
                        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gray-100 font-black text-gray-600">
                          {ownerName.slice(0, 1).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="truncate font-black text-gray-950">
                          {ownerName}
                        </p>
                        <p className="text-xs font-semibold text-gray-500">
                          {formatExperienceDate(experience)}
                        </p>
                      </div>
                    </div>

                    {experience.reflection.body && (
                      <p className="mt-4 whitespace-pre-line text-sm leading-6 text-gray-700">
                        {experience.reflection.body}
                      </p>
                    )}

                    {experience.reflection.key_takeaway && (
                      <div className="mt-4 rounded-2xl bg-amber-50 p-4">
                        <p className="text-[11px] font-black uppercase tracking-wide text-amber-700">
                          Key takeaway
                        </p>
                        <p className="mt-1 text-sm font-semibold leading-6 text-amber-950">
                          {experience.reflection.key_takeaway}
                        </p>
                      </div>
                    )}

                    <div className="mt-5 flex items-center justify-between gap-3">
                      <span className="text-xs font-bold text-gray-500">
                        Inspired {experience.inspired_seed_count} new Seeds
                      </span>

                      {!detail.viewer_active_seed?.seed_id && (
                        <form action={plantSeedFromCatalogue}>
                          <input
                            type="hidden"
                            name="catalog_item_id"
                            value={subject.catalog_item_id}
                          />
                          <input
                            type="hidden"
                            name="inspired_by_seed_id"
                            value={experience.seed_id}
                          />
                          <input
                            type="hidden"
                            name="return_to"
                            value={returnTo}
                          />
                          <button
                            type="submit"
                            className="rounded-full bg-gray-950 px-4 py-2 text-xs font-black text-white hover:bg-gray-800"
                          >
                            Plant from this
                          </button>
                        </form>
                      )}
                    </div>

                    <SeedExperienceEngagement
                      seedId={experience.seed_id}
                      engagement={experience.engagement}
                      comments={experience.comments}
                      commentPolicy={experience.experience_comment_policy}
                      returnTo={returnTo}
                    />
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-gray-300 bg-white p-8 text-center">
              <p className="font-black text-gray-950">
                No visible completion experience yet.
              </p>
              <p className="mt-2 text-sm text-gray-600">
                Completed Experiences shared by members will appear here.
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
