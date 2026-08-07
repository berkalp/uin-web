"use client";

import {
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";

import { supabase } from "@/utils/supabase/client";

export type AdminCommunitySportCommunity = {
  id: string;
  name: string;
  status: string;
};

export type AdminCommunitySportSport = {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  sort_order: number | string;
};

export type AdminCommunitySportLink = {
  community_id: string;
  sport_id: string;
  default_cover_url: string | null;
  is_active: boolean;
  sort_order: number | string;
  updated_at: string | null;
};

type CommunitySportsManagerProps = {
  communities: AdminCommunitySportCommunity[];
  sports: AdminCommunitySportSport[];
  links: AdminCommunitySportLink[];
};

type EditorState = {
  linked: boolean;
  isActive: boolean;
  coverUrl: string;
  sortOrder: string;
};

function toNumber(
  value: number | string | null | undefined,
  fallback = 100
) {
  const parsed =
    typeof value === "number"
      ? value
      : Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : fallback;
}

function getEditorKey(
  communityId: string,
  sportId: string
) {
  return `${communityId}:${sportId}`;
}

export default function CommunitySportsManager({
  communities,
  sports,
  links,
}: CommunitySportsManagerProps) {
  const router = useRouter();

  const defaultCommunityId =
    communities.find(
      (community) =>
        community.status === "active"
    )?.id ??
    communities[0]?.id ??
    "";

  const [
    selectedCommunityId,
    setSelectedCommunityId,
  ] = useState(
    defaultCommunityId
  );

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    editorOverrides,
    setEditorOverrides,
  ] = useState<
    Record<string, EditorState>
  >({});

  const [
    savingSportId,
    setSavingSportId,
  ] = useState<string | null>(
    null
  );

  const [
    message,
    setMessage,
  ] = useState<string | null>(
    null
  );

  const selectedCommunity =
    communities.find(
      (community) =>
        community.id ===
        selectedCommunityId
    ) ?? null;

  const linkBySportId =
    useMemo(() => {
      const map =
        new Map<
          string,
          AdminCommunitySportLink
        >();

      links
        .filter(
          (link) =>
            link.community_id ===
            selectedCommunityId
        )
        .forEach(
          (link) => {
            map.set(
              link.sport_id,
              link
            );
          }
        );

      return map;
    }, [
      links,
      selectedCommunityId,
    ]);

  const visibleSports =
    useMemo(() => {
      const normalizedSearch =
        search
          .trim()
          .toLocaleLowerCase(
            "en-US"
          );

      return [...sports]
        .filter(
          (sport) =>
            !normalizedSearch ||
            sport.name
              .toLocaleLowerCase(
                "en-US"
              )
              .includes(
                normalizedSearch
              )
        )
        .sort(
          (
            left,
            right
          ) => {
            const leftLinked =
              linkBySportId.has(
                left.id
              );

            const rightLinked =
              linkBySportId.has(
                right.id
              );

            if (
              leftLinked !==
              rightLinked
            ) {
              return leftLinked
                ? -1
                : 1;
            }

            const orderComparison =
              toNumber(
                left.sort_order
              ) -
              toNumber(
                right.sort_order
              );

            if (
              orderComparison !== 0
            ) {
              return orderComparison;
            }

            return left.name.localeCompare(
              right.name
            );
          }
        );
    }, [
      sports,
      search,
      linkBySportId,
    ]);

  function getEditorState(
    sport: AdminCommunitySportSport
  ): EditorState {
    const key =
      getEditorKey(
        selectedCommunityId,
        sport.id
      );

    const override =
      editorOverrides[key];

    if (override) {
      return override;
    }

    const link =
      linkBySportId.get(
        sport.id
      );

    return {
      linked: Boolean(link),
      isActive:
        link?.is_active ??
        true,
      coverUrl:
        link?.default_cover_url ??
        "",
      sortOrder:
        String(
          toNumber(
            link?.sort_order,
            100
          )
        ),
    };
  }

  function updateEditorState(
    sportId: string,
    patch: Partial<EditorState>
  ) {
    const sport =
      sports.find(
        (item) =>
          item.id ===
          sportId
      );

    if (!sport) {
      return;
    }

    const key =
      getEditorKey(
        selectedCommunityId,
        sportId
      );

    setEditorOverrides(
      (current) => ({
        ...current,
        [key]: {
          ...getEditorState(
            sport
          ),
          ...patch,
        },
      })
    );

    setMessage(null);
  }

  async function saveSport(
    sport: AdminCommunitySportSport
  ) {
    if (
      !selectedCommunityId
    ) {
      return;
    }

    const editor =
      getEditorState(
        sport
      );

    const sortOrder =
      Number(
        editor.sortOrder
      );

    if (
      !Number.isInteger(
        sortOrder
      ) ||
      sortOrder < 0
    ) {
      setMessage(
        "Sort order must be zero or greater."
      );
      return;
    }

    if (
      editor.coverUrl.trim() &&
      !/^https?:\/\//i.test(
        editor.coverUrl.trim()
      )
    ) {
      setMessage(
        "Cover URL must begin with http:// or https://."
      );
      return;
    }

    setSavingSportId(
      sport.id
    );
    setMessage(null);

    const { error } =
      await supabase.rpc(
        "admin_upsert_community_sport",
        {
          p_community_id:
            selectedCommunityId,
          p_sport_id:
            sport.id,
          p_default_cover_url:
            editor.coverUrl.trim() ||
            null,
          p_is_active:
            editor.isActive,
          p_sort_order:
            sortOrder,
        }
      );

    setSavingSportId(
      null
    );

    if (error) {
      setMessage(
        error.message
      );
      return;
    }

    updateEditorState(
      sport.id,
      {
        linked: true,
      }
    );

    setMessage(
      `${sport.name} relationship saved.`
    );

    router.refresh();
  }

  async function removeSport(
    sport: AdminCommunitySportSport
  ) {
    if (
      !selectedCommunityId
    ) {
      return;
    }

    setSavingSportId(
      sport.id
    );
    setMessage(null);

    const { error } =
      await supabase.rpc(
        "admin_remove_community_sport",
        {
          p_community_id:
            selectedCommunityId,
          p_sport_id:
            sport.id,
        }
      );

    setSavingSportId(
      null
    );

    if (error) {
      setMessage(
        error.message
      );
      return;
    }

    const key =
      getEditorKey(
        selectedCommunityId,
        sport.id
      );

    setEditorOverrides(
      (current) => ({
        ...current,
        [key]: {
          linked: false,
          isActive: true,
          coverUrl: "",
          sortOrder: "100",
        },
      })
    );

    setMessage(
      `${sport.name} relationship removed.`
    );

    router.refresh();
  }

  const linkedCount =
    links.filter(
      (link) =>
        link.community_id ===
          selectedCommunityId &&
        link.is_active
    ).length;

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm md:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-700">
              Community Sports
            </p>

            <h2 className="mt-2 text-2xl font-bold text-gray-950">
              Select a Community
            </h2>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-500">
              Define which sports this Community
              belongs to and assign a separate
              presentation cover for each relationship.
            </p>
          </div>

          <div className="rounded-2xl border border-indigo-100 bg-indigo-50 px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">
              Active sports
            </p>

            <p className="mt-1 text-2xl font-bold text-indigo-950">
              {linkedCount}
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <label>
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Community
            </span>

            <select
              value={
                selectedCommunityId
              }
              onChange={(event) => {
                setSelectedCommunityId(
                  event.target.value
                );
                setMessage(null);
              }}
              className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 font-semibold outline-none focus:border-indigo-500"
            >
              {communities.map(
                (community) => (
                  <option
                    key={
                      community.id
                    }
                    value={
                      community.id
                    }
                  >
                    {
                      community.name
                    }
                    {community.status ===
                    "active"
                      ? ""
                      : ` (${community.status})`}
                  </option>
                )
              )}
            </select>
          </label>

          <label>
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Search sports
            </span>

            <input
              type="search"
              value={
                search
              }
              onChange={(event) =>
                setSearch(
                  event.target.value
                )
              }
              placeholder="Football, Basketball..."
              className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 outline-none focus:border-indigo-500"
            />
          </label>
        </div>

        {selectedCommunity && (
          <div className="mt-5 rounded-2xl border border-gray-100 bg-gray-50 px-5 py-4">
            <p className="font-semibold text-gray-900">
              {
                selectedCommunity.name
              }
            </p>

            <p className="mt-1 text-sm text-gray-500">
              Only enabled sports will show this
              Community in Intent creation.
            </p>
          </div>
        )}

        {message && (
          <p className="mt-4 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-800">
            {message}
          </p>
        )}
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        {visibleSports.map(
          (sport) => {
            const editor =
              getEditorState(
                sport
              );

            const isSaving =
              savingSportId ===
              sport.id;

            return (
              <article
                key={
                  sport.id
                }
                className={`overflow-hidden rounded-3xl border bg-white shadow-sm ${
                  editor.linked
                    ? "border-indigo-200"
                    : "border-gray-200"
                }`}
              >
                {editor.coverUrl && (
                  <div
                    className="h-36 bg-gray-100 bg-cover bg-center"
                    style={{
                      backgroundImage:
                        `linear-gradient(rgba(0,0,0,0.12), rgba(0,0,0,0.12)), url("${editor.coverUrl}")`,
                    }}
                  />
                )}

                <div className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-bold text-gray-950">
                          {
                            sport.name
                          }
                        </h3>

                        {!sport.is_active && (
                          <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-semibold text-gray-600">
                            Sport inactive
                          </span>
                        )}
                      </div>

                      <p className="mt-1 text-sm text-gray-500">
                        {editor.linked
                          ? "Linked to this Community"
                          : "Not available for this Community"}
                      </p>
                    </div>

                    <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                      <input
                        type="checkbox"
                        checked={
                          editor.isActive
                        }
                        onChange={(event) =>
                          updateEditorState(
                            sport.id,
                            {
                              isActive:
                                event.target.checked,
                            }
                          )
                        }
                        disabled={
                          !editor.linked
                        }
                        className="h-4 w-4"
                      />

                      Active
                    </label>
                  </div>

                  <div className="mt-5 grid gap-4 sm:grid-cols-[minmax(0,1fr)_110px]">
                    <label>
                      <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Cover URL
                      </span>

                      <input
                        type="url"
                        value={
                          editor.coverUrl
                        }
                        onChange={(event) =>
                          updateEditorState(
                            sport.id,
                            {
                              coverUrl:
                                event.target.value,
                            }
                          )
                        }
                        placeholder="https://..."
                        className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-indigo-500"
                      />
                    </label>

                    <label>
                      <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Sort
                      </span>

                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={
                          editor.sortOrder
                        }
                        onChange={(event) =>
                          updateEditorState(
                            sport.id,
                            {
                              sortOrder:
                                event.target.value,
                            }
                          )
                        }
                        className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-indigo-500"
                      />
                    </label>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-3">
                    <button
                      type="button"
                      disabled={
                        isSaving
                      }
                      onClick={() =>
                        saveSport(
                          sport
                        )
                      }
                      className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {isSaving
                        ? "Saving..."
                        : editor.linked
                          ? "Save relationship"
                          : "Enable for Community"}
                    </button>

                    {editor.linked && (
                      <button
                        type="button"
                        disabled={
                          isSaving
                        }
                        onClick={() =>
                          removeSport(
                            sport
                          )
                        }
                        className="rounded-xl border border-red-200 bg-red-50 px-5 py-3 text-sm font-semibold text-red-700 transition hover:border-red-400 hover:bg-red-100 disabled:opacity-50"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          }
        )}
      </section>

      {visibleSports.length === 0 && (
        <section className="rounded-3xl border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500">
          No sports match the search.
        </section>
      )}
    </div>
  );
}
