import type { Metadata } from "next";
import Link from "next/link";

import { createClient } from "@/utils/supabase/server";

import {
  createSeedCatalogueItem,
  reviewSeedCatalogueItem,
  updateSeedCatalogueItem,
} from "./actions";

export const metadata: Metadata = {
  title: "Seed Catalogue | UIN Admin",
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
  status: "active" | "pending" | "merged" | "rejected";
  created_at: string;
  personal_seed_count: number;
  created_by: {
    user_id: string;
    full_name: string | null;
    username: string | null;
  } | null;
  aliases: Array<{
    id: string;
    alias: string;
    language_code: string | null;
    source: string;
    is_primary: boolean;
  }>;
};

function one(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0]?.trim() || "";
  return value?.trim() || "";
}

export default async function AdminSeedCataloguePage({
  searchParams,
}: AdminSeedCataloguePageProps) {
  const params = await searchParams;
  const status = one(params.status) || "pending";
  const query = one(params.q);
  const errorMessage = one(params.error);
  const updated = one(params.updated);

  const supabase = await createClient();
  const [itemsResponse, targetsResponse, seedTypesResponse] = await Promise.all([
    supabase.rpc("get_admin_seed_catalog_items", {
      p_status: status === "all" ? null : status,
      p_query: query || null,
      p_limit: 150,
    }),
    supabase.rpc("get_admin_seed_catalog_items", {
      p_status: "active",
      p_query: null,
      p_limit: 300,
    }),
    supabase.rpc("get_active_seed_types"),
  ]);

  const items = (itemsResponse.data ?? []) as CatalogueItem[];
  const activeTargets = (targetsResponse.data ?? []) as CatalogueItem[];
  const seedTypes = (seedTypesResponse.data ?? []) as SeedTypeRow[];
  const currentParams = new URLSearchParams({ status });
  if (query) currentParams.set("q", query);
  const returnTo = `/admin/seed-catalogue?${currentParams.toString()}`;

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">
              UIN Admin
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-gray-950">
              Seed Catalogue
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600">
              Review new shared subjects, approve valid records, merge duplicates
              and preserve personal Seeds when a suggestion is rejected.
            </p>
          </div>
          <Link
            href="/admin"
            className="rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-bold text-gray-800 hover:border-gray-950"
          >
            Admin home
          </Link>
        </div>

        <details className="mb-6 overflow-hidden rounded-3xl border border-emerald-200 bg-white shadow-sm">
          <summary className="cursor-pointer bg-emerald-50 px-5 py-4 text-base font-black text-emerald-950 sm:px-6">
            + Add a Seed to the Library
          </summary>
          <form
            action={createSeedCatalogueItem}
            className="grid gap-4 border-t border-emerald-100 p-5 sm:p-6 md:grid-cols-2"
          >
            <input type="hidden" name="return_to" value={returnTo} />

            <label>
              <span className="text-xs font-black uppercase tracking-wide text-gray-500">
                Seed Type
              </span>
              <select
                name="seed_type_id"
                required
                className="mt-2 w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-emerald-600"
              >
                <option value="">Select a Seed Type</option>
                {seedTypes.map((seedType) => (
                  <option key={seedType.id} value={seedType.id}>
                    {seedType.icon} {seedType.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span className="text-xs font-black uppercase tracking-wide text-gray-500">
                Subject kind
              </span>
              <select
                name="item_kind"
                required
                defaultValue="generic"
                className="mt-2 w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-emerald-600"
              >
                {[
                  "book",
                  "movie",
                  "series",
                  "game",
                  "album",
                  "podcast",
                  "course",
                  "place",
                  "restaurant",
                  "recipe",
                  "skill",
                  "challenge",
                  "generic",
                ].map((kind) => (
                  <option key={kind} value={kind}>
                    {kind.charAt(0).toUpperCase() + kind.slice(1)}
                  </option>
                ))}
              </select>
            </label>

            <label className="md:col-span-2">
              <span className="text-xs font-black uppercase tracking-wide text-gray-500">
                Canonical title
              </span>
              <input
                name="canonical_title"
                required
                maxLength={240}
                placeholder="Suç ve Ceza"
                className="mt-2 w-full rounded-2xl border border-gray-300 px-4 py-3 font-semibold outline-none focus:border-emerald-600"
              />
            </label>

            <label>
              <span className="text-xs font-black uppercase tracking-wide text-gray-500">
                Creator / author
              </span>
              <input
                name="creator_name"
                maxLength={240}
                placeholder="Fyodor Dostoyevski"
                className="mt-2 w-full rounded-2xl border border-gray-300 px-4 py-3 outline-none focus:border-emerald-600"
              />
            </label>

            <label>
              <span className="text-xs font-black uppercase tracking-wide text-gray-500">
                Original title
              </span>
              <input
                name="original_title"
                maxLength={240}
                placeholder="Преступление и наказание"
                className="mt-2 w-full rounded-2xl border border-gray-300 px-4 py-3 outline-none focus:border-emerald-600"
              />
            </label>

            <label>
              <span className="text-xs font-black uppercase tracking-wide text-gray-500">
                Release year
              </span>
              <input
                type="number"
                name="release_year"
                min={1}
                max={3000}
                placeholder="1866"
                className="mt-2 w-full rounded-2xl border border-gray-300 px-4 py-3 outline-none focus:border-emerald-600"
              />
            </label>

            <label>
              <span className="text-xs font-black uppercase tracking-wide text-gray-500">
                Language code
              </span>
              <input
                name="language_code"
                maxLength={20}
                placeholder="tr"
                className="mt-2 w-full rounded-2xl border border-gray-300 px-4 py-3 outline-none focus:border-emerald-600"
              />
            </label>

            <label className="md:col-span-2">
              <span className="text-xs font-black uppercase tracking-wide text-gray-500">
                Cover image URL
              </span>
              <input
                type="url"
                name="cover_url"
                maxLength={2000}
                placeholder="https://..."
                className="mt-2 w-full rounded-2xl border border-gray-300 px-4 py-3 outline-none focus:border-emerald-600"
              />
              <span className="mt-2 block text-xs leading-5 text-gray-500">
                The shared cover will appear on every personal Seed linked to this subject.
              </span>
            </label>

            <label className="md:col-span-2">
              <span className="text-xs font-black uppercase tracking-wide text-gray-500">
                Alternate names and translations
              </span>
              <textarea
                name="aliases"
                rows={4}
                placeholder={"Suç & Ceza\nSuc ve Ceza\nCrime and Punishment"}
                className="mt-2 w-full resize-y rounded-2xl border border-gray-300 px-4 py-3 outline-none focus:border-emerald-600"
              />
              <span className="mt-2 block text-xs leading-5 text-gray-500">
                Enter one alias per line or separate aliases with commas.
              </span>
            </label>

            <div className="md:col-span-2 flex justify-end">
              <button
                type="submit"
                className="rounded-2xl bg-emerald-600 px-6 py-3 text-sm font-black text-white hover:bg-emerald-700"
              >
                Add to Seed Library
              </button>
            </div>
          </form>
        </details>

        <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
          <form method="get" className="grid gap-3 sm:grid-cols-[180px_1fr_auto]">
            <select
              name="status"
              defaultValue={status}
              className="rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm font-bold"
            >
              <option value="pending">Pending</option>
              <option value="active">Active</option>
              <option value="rejected">Rejected</option>
              <option value="merged">Merged</option>
              <option value="all">All</option>
            </select>
            <input
              name="q"
              defaultValue={query}
              placeholder="Title, alias or creator"
              className="rounded-2xl border border-gray-300 px-4 py-3 outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
            />
            <button
              type="submit"
              className="rounded-2xl bg-gray-950 px-5 py-3 text-sm font-black text-white"
            >
              Filter
            </button>
          </form>

          {itemsResponse.error && (
            <p className="mt-4 rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700">
              {itemsResponse.error.message}
            </p>
          )}
          {errorMessage && (
            <p className="mt-4 rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700">
              {errorMessage}
            </p>
          )}
          {updated && (
            <p className="mt-4 rounded-2xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
              Catalogue item updated: {updated}.
            </p>
          )}
        </section>

        <section className="mt-6 space-y-4">
          {items.map((item) => (
            <article
              key={item.catalog_item_id}
              className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-xs font-black uppercase tracking-wide text-emerald-700">
                    {item.seed_type_icon} {item.seed_type_name} · {item.item_kind}
                  </p>
                  <h2 className="mt-2 text-xl font-black text-gray-950">
                    {item.canonical_title}
                  </h2>
                  {(item.creator_name || item.release_year) && (
                    <p className="mt-1 text-sm font-semibold text-gray-600">
                      {[item.creator_name, item.release_year]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  )}
                  <p className="mt-2 text-xs text-gray-500">
                    ID: {item.catalog_item_id} · {item.personal_seed_count} personal Seeds
                  </p>
                  {item.created_by && (
                    <p className="mt-1 text-xs text-gray-500">
                      Suggested by {item.created_by.full_name || item.created_by.username}
                    </p>
                  )}
                </div>
                <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-black uppercase text-gray-600">
                  {item.status}
                </span>
              </div>

              {item.aliases.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {item.aliases.map((alias) => (
                    <span
                      key={alias.id}
                      className="rounded-full bg-gray-50 px-3 py-1 text-xs font-semibold text-gray-600"
                    >
                      {alias.alias}
                    </span>
                  ))}
                </div>
              )}

              {(item.status === "active" || item.status === "pending") && (
                <details className="mt-5 rounded-2xl border border-gray-200 bg-gray-50">
                  <summary className="cursor-pointer px-4 py-3 text-sm font-black text-gray-800">
                    Edit shared subject and cover
                  </summary>
                  <form
                    action={updateSeedCatalogueItem}
                    className="grid gap-4 border-t border-gray-200 p-4 md:grid-cols-2"
                  >
                    <input type="hidden" name="catalog_item_id" value={item.catalog_item_id} />
                    <input type="hidden" name="return_to" value={returnTo} />

                    <label>
                      <span className="text-xs font-bold text-gray-600">Canonical title</span>
                      <input
                        name="canonical_title"
                        required
                        defaultValue={item.canonical_title}
                        maxLength={240}
                        className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm outline-none focus:border-emerald-600"
                      />
                    </label>

                    <label>
                      <span className="text-xs font-bold text-gray-600">Creator / author</span>
                      <input
                        name="creator_name"
                        defaultValue={item.creator_name ?? ""}
                        maxLength={240}
                        className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm outline-none focus:border-emerald-600"
                      />
                    </label>

                    <label>
                      <span className="text-xs font-bold text-gray-600">Original title</span>
                      <input
                        name="original_title"
                        defaultValue={item.original_title ?? ""}
                        maxLength={240}
                        className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm outline-none focus:border-emerald-600"
                      />
                    </label>

                    <div className="grid grid-cols-2 gap-3">
                      <label>
                        <span className="text-xs font-bold text-gray-600">Release year</span>
                        <input
                          type="number"
                          name="release_year"
                          min={1}
                          max={3000}
                          defaultValue={item.release_year ?? ""}
                          className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm outline-none focus:border-emerald-600"
                        />
                      </label>
                      <label>
                        <span className="text-xs font-bold text-gray-600">Language</span>
                        <input
                          name="language_code"
                          defaultValue={item.language_code ?? ""}
                          maxLength={20}
                          placeholder="tr"
                          className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm outline-none focus:border-emerald-600"
                        />
                      </label>
                    </div>

                    <label className="md:col-span-2">
                      <span className="text-xs font-bold text-gray-600">Cover image URL</span>
                      <input
                        type="url"
                        name="cover_url"
                        defaultValue={item.cover_url ?? ""}
                        maxLength={2000}
                        placeholder="https://..."
                        className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm outline-none focus:border-emerald-600"
                      />
                      <span className="mt-2 block text-xs leading-5 text-gray-500">
                        This cover is inherited by every personal Seed linked to this subject.
                      </span>
                    </label>

                    <div className="md:col-span-2 flex flex-wrap items-center gap-3">
                      {item.cover_url && (
                        <img
                          src={item.cover_url}
                          alt=""
                          className="h-20 w-16 rounded-lg border border-gray-200 object-cover"
                        />
                      )}
                      <button
                        type="submit"
                        className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-black text-white hover:bg-emerald-700"
                      >
                        Save subject details
                      </button>
                    </div>
                  </form>
                </details>
              )}

              {item.status === "pending" && (
                <div className="mt-5 grid gap-3 border-t border-gray-100 pt-5 lg:grid-cols-[auto_auto_1fr]">
                  <form action={reviewSeedCatalogueItem}>
                    <input type="hidden" name="catalog_item_id" value={item.catalog_item_id} />
                    <input type="hidden" name="review_action" value="approve" />
                    <input type="hidden" name="return_to" value={returnTo} />
                    <button
                      type="submit"
                      className="w-full rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black text-white hover:bg-emerald-700"
                    >
                      Approve
                    </button>
                  </form>

                  <form action={reviewSeedCatalogueItem}>
                    <input type="hidden" name="catalog_item_id" value={item.catalog_item_id} />
                    <input type="hidden" name="review_action" value="reject" />
                    <input type="hidden" name="return_to" value={returnTo} />
                    <button
                      type="submit"
                      className="w-full rounded-2xl border border-red-300 bg-white px-5 py-3 text-sm font-black text-red-700 hover:bg-red-50"
                    >
                      Reject
                    </button>
                  </form>

                  <form
                    action={reviewSeedCatalogueItem}
                    className="grid gap-2 sm:grid-cols-[1fr_auto]"
                  >
                    <input type="hidden" name="catalog_item_id" value={item.catalog_item_id} />
                    <input type="hidden" name="review_action" value="merge" />
                    <input type="hidden" name="return_to" value={returnTo} />
                    <select
                      name="target_catalog_item_id"
                      required
                      className="min-w-0 rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm font-bold"
                    >
                      <option value="">Merge into an active subject…</option>
                      {activeTargets
                        .filter((target) => target.catalog_item_id !== item.catalog_item_id)
                        .map((target) => (
                          <option
                            key={target.catalog_item_id}
                            value={target.catalog_item_id}
                          >
                            {target.canonical_title}
                            {target.creator_name ? ` · ${target.creator_name}` : ""}
                          </option>
                        ))}
                    </select>
                    <button
                      type="submit"
                      className="rounded-2xl bg-gray-950 px-5 py-3 text-sm font-black text-white"
                    >
                      Merge
                    </button>
                  </form>
                </div>
              )}
            </article>
          ))}

          {!itemsResponse.error && items.length === 0 && (
            <div className="rounded-3xl border border-dashed border-gray-300 bg-white p-8 text-center">
              <p className="font-black text-gray-950">No catalogue items match this filter.</p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
