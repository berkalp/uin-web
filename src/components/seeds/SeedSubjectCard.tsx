import Link from "next/link";

import { connectPrivateSeedToCatalogue, plantSeedFromCatalogue } from "@/app/seeds/explore/actions";

export type SeedSubjectSearchRow = {
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
  metadata: Record<string, unknown> | null;
  planted_count: number | string;
  active_count: number | string;
  completed_count: number | string;
  experience_count: number | string;
  viewer_has_active_seed: boolean;
  viewer_seed_id: string | null;
  catalogue_status: "active" | "pending" | string;
  search_score: number | string;
};

type SeedSubjectCardProps = {
  subject: SeedSubjectSearchRow;
  returnTo: string;
  sourceSeedId?: string | null;
};

function toCount(value: number | string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
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
      return "I’ve done this";
  }
}

export default function SeedSubjectCard({
  subject,
  returnTo,
  sourceSeedId = null,
}: SeedSubjectCardProps) {
  const plantedCount = toCount(subject.planted_count);
  const activeCount = toCount(subject.active_count);
  const completedCount = toCount(subject.completed_count);
  const experienceCount = toCount(subject.experience_count);

  return (
    <article className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
      <div className="flex min-h-44">
        <div className="relative w-32 shrink-0 bg-gradient-to-br from-emerald-50 to-lime-100 sm:w-40">
          {subject.cover_url ? (
            <img
              src={subject.cover_url}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-5xl">
              {subject.seed_type_icon || "🌱"}
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">
                {subject.seed_type_icon} {subject.seed_type_name}
              </p>

              <h2 className="mt-2 line-clamp-2 text-xl font-black tracking-tight text-gray-950">
                {subject.canonical_title}
              </h2>

              {(subject.creator_name || subject.release_year) && (
                <p className="mt-1 text-sm font-medium text-gray-600">
                  {[subject.creator_name, subject.release_year]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              )}
            </div>

            <div className="flex flex-col items-end gap-2">
              <span className="rounded-full bg-gray-100 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-gray-600">
                {subject.item_kind}
              </span>
              {subject.catalogue_status === "pending" && (
                <span className="rounded-full bg-amber-50 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-amber-800">
                  Pending review
                </span>
              )}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-gray-600 sm:grid-cols-4">
            <span>
              <strong className="text-gray-950">{plantedCount}</strong> journeys
            </span>
            <span>
              <strong className="text-gray-950">{activeCount}</strong> active
            </span>
            <span>
              <strong className="text-gray-950">{completedCount}</strong> completed
            </span>
            <span>
              <strong className="text-gray-950">{experienceCount}</strong> experiences
            </span>
          </div>

          <div className="mt-auto flex flex-wrap items-center gap-2 pt-5">
            <Link
              href={`/seeds/subjects/${encodeURIComponent(
                subject.catalog_item_id
              )}`}
              className="rounded-full border border-gray-300 px-4 py-2 text-sm font-bold text-gray-800 transition hover:border-gray-950 hover:bg-gray-950 hover:text-white"
            >
              View subject
            </Link>

            {sourceSeedId ? (
              <form action={connectPrivateSeedToCatalogue}>
                <input type="hidden" name="source_seed_id" value={sourceSeedId} />
                <input type="hidden" name="catalog_item_id" value={subject.catalog_item_id} />
                <input type="hidden" name="return_to" value={returnTo} />
                <button type="submit" className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-black text-white transition hover:bg-emerald-700">
                  Connect this Seed
                </button>
              </form>
            ) : subject.viewer_has_active_seed && subject.viewer_seed_id ? (
              <Link
                href={`/seeds/${encodeURIComponent(subject.viewer_seed_id)}`}
                className="rounded-full bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-700 transition hover:bg-emerald-100"
              >
                ✓ Open my Seed
              </Link>
            ) : (
              <form action={plantSeedFromCatalogue}>
                <input type="hidden" name="catalog_item_id" value={subject.catalog_item_id} />
                <input type="hidden" name="return_to" value={returnTo} />
                <button type="submit" className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-black text-white transition hover:bg-emerald-700">
                  Plant this Seed
                </button>
              </form>
            )}

            <Link
              href={`/seeds/subjects/${encodeURIComponent(
                subject.catalog_item_id
              )}/past`}
              className="rounded-full border border-purple-200 bg-purple-50 px-4 py-2 text-sm font-bold text-purple-800 transition hover:bg-purple-100"
            >
              {getPastExperienceLabel(subject.seed_type_slug)}
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}
