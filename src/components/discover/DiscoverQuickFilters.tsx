"use client";

import {
  useRouter,
  useSearchParams,
} from "next/navigation";
import {
  useTransition,
} from "react";

type FilterOption = {
  value: string;
  label: string;
};

type FollowedCommunityOption = {
  id: string;
  name: string;
};

type DiscoverQuickFiltersProps = {
  lifecycle: string;
  scope: string;
  communityScope: string;
  communityId: string;
  followedCommunities:
    FollowedCommunityOption[];
  lifecycleOptions:
    readonly FilterOption[];
  scopeOptions:
    readonly FilterOption[];
  communityScopeOptions:
    readonly FilterOption[];
};

export default function DiscoverQuickFilters({
  lifecycle,
  scope,
  communityScope,
  communityId,
  followedCommunities,
  lifecycleOptions,
  scopeOptions,
  communityScopeOptions,
}: DiscoverQuickFiltersProps) {
  const router =
    useRouter();

  const searchParams =
    useSearchParams();

  const [
    isPending,
    startTransition,
  ] = useTransition();

  function updateQuickFilter(
    key:
      | "lifecycle"
      | "scope"
      | "community_scope",
    value: string
  ) {
    const params =
      new URLSearchParams(
        searchParams.toString()
      );

    params.delete("page");

    if (
      key === "lifecycle" &&
      value === "current"
    ) {
      params.delete("lifecycle");
    } else if (
      key === "scope" &&
      value === "all"
    ) {
      params.delete("scope");
    } else if (
      key === "community_scope" &&
      value === "all"
    ) {
      params.delete(
        "community_scope"
      );
    } else {
      params.set(
        key,
        value
      );
    }

    const query =
      params.toString();

    startTransition(() => {
      router.replace(
        query
          ? `/discover?${query}`
          : "/discover",
        {
          scroll: false,
        }
      );
    });
  }

  function updateCommunityFilter(
    value: string
  ) {
    const params =
      new URLSearchParams(
        searchParams.toString()
      );

    params.delete("page");
    params.delete("community");
    params.delete(
      "community_scope"
    );

    if (
      value === "following"
    ) {
      params.set(
        "community_scope",
        "following"
      );
    } else if (
      value.startsWith(
        "community:"
      )
    ) {
      params.set(
        "community",
        value.slice(
          "community:".length
        )
      );
    }

    const query =
      params.toString();

    startTransition(() => {
      router.replace(
        query
          ? `/discover?${query}`
          : "/discover",
        {
          scroll: false,
        }
      );
    });
  }

  const selectedCommunityFilter =
    communityId
      ? `community:${communityId}`
      : communityScope;

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
      <label className="min-w-[190px]">
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-500">
          Quick lifecycle
        </span>

        <select
          value={lifecycle}
          disabled={isPending}
          onChange={(event) =>
            updateQuickFilter(
              "lifecycle",
              event.target.value
            )
          }
          className="mt-1.5 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-semibold text-gray-800 outline-none transition focus:border-blue-500 disabled:cursor-wait disabled:opacity-60"
        >
          {lifecycleOptions.map(
            (option) => (
              <option
                key={option.value}
                value={option.value}
              >
                {option.label}
              </option>
            )
          )}
        </select>
      </label>

      <label className="min-w-[170px]">
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-500">
          Quick ownership
        </span>

        <select
          value={scope}
          disabled={isPending}
          onChange={(event) =>
            updateQuickFilter(
              "scope",
              event.target.value
            )
          }
          className="mt-1.5 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-semibold text-gray-800 outline-none transition focus:border-blue-500 disabled:cursor-wait disabled:opacity-60"
        >
          {scopeOptions.map(
            (option) => (
              <option
                key={option.value}
                value={option.value}
              >
                {option.label}
              </option>
            )
          )}
        </select>
      </label>

      <label className="min-w-[190px]">
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-500">
          Quick Community
        </span>

        <select
          value={
            selectedCommunityFilter
          }
          disabled={isPending}
          onChange={(event) =>
            updateCommunityFilter(
              event.target.value
            )
          }
          className="mt-1.5 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-semibold text-gray-800 outline-none transition focus:border-indigo-500 disabled:cursor-wait disabled:opacity-60"
        >
          {communityScopeOptions.map(
            (option) => (
              <option
                key={option.value}
                value={option.value}
              >
                {option.label}
              </option>
            )
          )}

          {followedCommunities.length >
            0 && (
            <optgroup label="Followed Communities">
              {followedCommunities.map(
                (community) => (
                  <option
                    key={community.id}
                    value={`community:${community.id}`}
                  >
                    {community.name}
                  </option>
                )
              )}
            </optgroup>
          )}
        </select>
      </label>

      <div
        aria-live="polite"
        className="pb-2 text-xs font-medium text-gray-400"
      >
        {isPending
          ? "Updating…"
          : "Applies instantly"}
      </div>
    </div>
  );
}
