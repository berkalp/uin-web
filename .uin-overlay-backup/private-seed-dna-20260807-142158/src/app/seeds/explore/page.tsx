import type { Metadata } from "next";
import Link from "next/link";

import SeedSubjectCard, {
  type SeedSubjectSearchRow,
} from "@/components/seeds/SeedSubjectCard";
import { createClient } from "@/utils/supabase/server";

import { suggestAndPlantSeedSubject } from "./actions";

export const metadata: Metadata = {
  title: "Seed Library | UIN",
  description:
    "Find shared Seed subjects, see experiences and plant a personal Seed.",
};

type SeedExplorePageProps = {
  searchParams: Promise<{
    q?: string | string[];
    type?: string | string[];
    error?: string | string[];
    planted?: string | string[];
    suggested?: string | string[];
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

function one(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0]?.trim() || "";
  }
  return value?.trim() || "";
}

function kindForSeedType(slug: string): string {
  switch (slug) {
    case "read":
      return "book";
    case "watch":
      return "movie";
    case "listen":
      return "album";
    case "visit":
      return "place";
    case "try":
      return "restaurant";
    case "learn":
      return "course";
    case "play":
      return "game";
    case "practice":
      return "skill";
    default:
      return "generic";
  }
}

export default async function SeedExplorePage({
  searchParams,
}: SeedExplorePageProps) {
  const params = await searchParams;
  const query = one(params.q);
  const selectedTypeId = one(params.type);
  const errorMessage = one(params.error);
  const plantedNotice = one(params.planted);
  const suggestedNotice = one(params.suggested);

  const supabase = await createClient();

  const [seedTypesResponse, subjectsResponse] = await Promise.all([
    supabase.rpc("get_active_seed_types"),
    supabase.rpc("search_seed_catalog", {
      p_seed_type_id: selectedTypeId || null,
      p_query: query || null,
      p_limit: 36,
    }),
  ]);

  const seedTypes = (seedTypesResponse.data ?? []) as SeedTypeRow[];
  const subjects = (subjectsResponse.data ?? []) as SeedSubjectSearchRow[];
  const selectedType = seedTypes.find(
    (seedType) => seedType.id === selectedTypeId
  );

  const currentParams = new URLSearchParams();
  if (query) currentParams.set("q", query);
  if (selectedTypeId) currentParams.set("type", selectedTypeId);
  const returnTo = `/seeds/explore${
    currentParams.size > 0 ? `?${currentParams.toString()}` : ""
  }`;

  return (
    <main className="min-h-screen bg-[#f7f8f4] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="rounded-[2rem] border border-emerald-100 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-700">
                UIN · Seeds
              </p>
              <h1 className="mt-2 text-3xl font-black tracking-tight text-gray-950 sm:text-4xl">
                Seed Library
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-600 sm:text-base">
                Find a shared subject once, then keep each person’s Seed, progress and
                completion experience separate. Alternate spellings and translated
                titles resolve to the same subject.
              </p>
            </div>

            <div className="flex gap-2">
              <Link
                href={
                  selectedTypeId
                    ? `/seeds/new?mode=personal&type=${encodeURIComponent(selectedTypeId)}`
                    : "/seeds/new?mode=personal"
                }
                className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-800 hover:border-emerald-500"
              >
                Personal Seed
              </Link>
              <Link
                href="/seeds"
                className="rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-bold text-gray-800 hover:border-gray-950"
              >
                My Seeds
              </Link>
            </div>
          </div>

          <form method="get" className="mt-7 grid gap-3 sm:grid-cols-[1fr_220px_auto]">
            <label className="sr-only" htmlFor="seed-search-query">
              Search Seed subjects
            </label>
            <input
              id="seed-search-query"
              name="q"
              defaultValue={query}
              placeholder="Suç & Ceza, Crime and Punishment, Interstellar…"
              className="min-w-0 rounded-2xl border border-gray-300 bg-white px-4 py-3 text-base font-medium text-gray-950 outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
            />

            <label className="sr-only" htmlFor="seed-type-filter">
              Seed Type
            </label>
            <select
              id="seed-type-filter"
              name="type"
              defaultValue={selectedTypeId}
              className="rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm font-bold text-gray-800 outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
            >
              <option value="">All Seed Types</option>
              {seedTypes.map((seedType) => (
                <option key={seedType.id} value={seedType.id}>
                  {seedType.icon} {seedType.name}
                </option>
              ))}
            </select>

            <button
              type="submit"
              className="rounded-2xl bg-emerald-600 px-6 py-3 text-sm font-black text-white hover:bg-emerald-700"
            >
              Search
            </button>
          </form>

          {seedTypesResponse.error && (
            <p className="mt-4 rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700">
              Seed Types could not be loaded: {seedTypesResponse.error.message}
            </p>
          )}

          {errorMessage && (
            <p className="mt-4 rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700">
              {errorMessage}
            </p>
          )}

          {(plantedNotice || suggestedNotice) && (
            <p className="mt-4 rounded-2xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
              {suggestedNotice
                ? "The subject was matched or added to the catalogue, and your personal Seed was planted."
                : "Your personal Seed was planted from this shared subject."}
            </p>
          )}
        </header>

        <section className="mt-8">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-gray-500">
                Subjects
              </p>
              <h2 className="mt-1 text-2xl font-black text-gray-950">
                {query
                  ? `Results for “${query}”`
                  : selectedType
                    ? `${selectedType.icon} ${selectedType.name}`
                    : "Popular and recent subjects"}
              </h2>
            </div>
            <p className="text-sm font-semibold text-gray-500">
              {subjects.length} subject{subjects.length === 1 ? "" : "s"}
            </p>
          </div>

          {subjectsResponse.error ? (
            <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-red-800">
              <p className="font-black">Seed catalogue could not be loaded.</p>
              <p className="mt-2 text-sm">{subjectsResponse.error.message}</p>
            </div>
          ) : subjects.length > 0 ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {subjects.map((subject) => (
                <SeedSubjectCard
                  key={subject.catalog_item_id}
                  subject={subject}
                  returnTo={returnTo}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-[2rem] border border-dashed border-gray-300 bg-white p-6 sm:p-8">
              <h3 className="text-xl font-black text-gray-950">
                No matching subject was found.
              </h3>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600">
                Add the missing subject once. Future spelling variations and translated
                titles can resolve to this shared record while personal Seeds remain
                separate. Use Personal Seed instead when this is a private goal rather
                than a shared book, film, place, course or other identifiable subject.
              </p>

              {selectedType ? (
                <form
                  action={suggestAndPlantSeedSubject}
                  className="mt-6 grid gap-3 sm:grid-cols-2"
                >
                  <input
                    type="hidden"
                    name="seed_type_id"
                    value={selectedType.id}
                  />
                  <input
                    type="hidden"
                    name="item_kind"
                    value={kindForSeedType(selectedType.slug)}
                  />
                  <input type="hidden" name="return_to" value={returnTo} />

                  <label className="block sm:col-span-2">
                    <span className="mb-1 block text-xs font-black uppercase tracking-wide text-gray-500">
                      Subject title
                    </span>
                    <input
                      name="canonical_title"
                      required
                      defaultValue={query}
                      maxLength={240}
                      className="w-full rounded-2xl border border-gray-300 px-4 py-3 font-medium outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-xs font-black uppercase tracking-wide text-gray-500">
                      Author / creator
                    </span>
                    <input
                      name="creator_name"
                      maxLength={240}
                      className="w-full rounded-2xl border border-gray-300 px-4 py-3 font-medium outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-xs font-black uppercase tracking-wide text-gray-500">
                      Release year
                    </span>
                    <input
                      name="release_year"
                      type="number"
                      min={1}
                      max={3000}
                      className="w-full rounded-2xl border border-gray-300 px-4 py-3 font-medium outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
                    />
                  </label>

                  <button
                    type="submit"
                    className="rounded-2xl bg-gray-950 px-5 py-3 text-sm font-black text-white hover:bg-gray-800 sm:col-span-2"
                  >
                    Add to catalogue and plant
                  </button>
                </form>
              ) : (
                <p className="mt-5 rounded-2xl bg-amber-50 p-4 text-sm font-semibold text-amber-800">
                  Select a Seed Type before adding a new subject.
                </p>
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
