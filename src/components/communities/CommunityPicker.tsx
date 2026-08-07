"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import CommunityIcon from "@/components/communities/CommunityIcon";
import {
  getCommunityAccentForeground,
  getCommunityVisibleBorder,
  normalizeCommunityAccent,
  normalizeCommunitySecondary,
  type CommunityOption,
} from "@/utils/communities";
import { supabase } from "@/utils/supabase/client";

const MAX_COMMUNITIES = 3;

type CommunityPickerProps = {
  categoryId: string;
  activityId: string;
  activityName?: string;
  value: string[];
  communities: CommunityOption[];
  isLoading: boolean;
  onChange: (communityIds: string[]) => void;
};

function normalizeSearchValue(value: string) {
  return value
    .toLocaleLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export default function CommunityPicker({
  categoryId,
  activityId,
  activityName = "",
  value,
  communities,
  isLoading,
  onChange,
}: CommunityPickerProps) {
  const exactCommunities = useMemo(
    () =>
      communities.filter(
        (community) =>
          community.relevanceRank === 0 &&
          (community.activityIds.length === 0 ||
            community.activityIds.includes(activityId))
      ),
    [activityId, communities]
  );

  const selectedCommunities = value.flatMap((communityId) => {
    const community = exactCommunities.find(
      (candidate) => candidate.id === communityId
    );
    return community ? [community] : [];
  });

  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [suggestionOpen, setSuggestionOpen] = useState(false);
  const [suggestedName, setSuggestedName] = useState("");
  const [suggestionDescription, setSuggestionDescription] = useState("");
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [localMessage, setLocalMessage] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    setQuery("");
    setSuggestionOpen(false);
    setSuggestedName("");
    setSuggestionDescription("");
    setLocalMessage(null);
  }, [activityId]);

  const normalizedQuery = normalizeSearchValue(query);
  const selectedIdSet = new Set(value);

  const filteredCommunities = useMemo(() => {
    const available = exactCommunities.filter(
      (community) => !selectedIdSet.has(community.id)
    );

    if (!normalizedQuery) return available;

    return available.filter((community) =>
      normalizeSearchValue(
        [community.name, community.description ?? ""].join(" ")
      ).includes(normalizedQuery)
    );
  }, [exactCommunities, normalizedQuery, value.join("|")]);

  const exactNameExists = exactCommunities.some(
    (community) =>
      normalizeSearchValue(community.name) === normalizedQuery
  );

  const canOfferSuggestion =
    Boolean(activityId) && query.trim().length >= 2 && !exactNameExists;

  const showResults =
    Boolean(activityId) && isFocused && !suggestionOpen;

  function selectCommunity(community: CommunityOption) {
    if (value.length >= MAX_COMMUNITIES || selectedIdSet.has(community.id)) {
      return;
    }

    onChange([...value, community.id]);
    setQuery("");
    setIsFocused(false);
    setLocalMessage(null);
  }

  function removeCommunity(communityId: string) {
    onChange(value.filter((id) => id !== communityId));
  }

  function makePrimary(communityId: string) {
    onChange([
      communityId,
      ...value.filter((id) => id !== communityId),
    ]);
  }

  function openSuggestion() {
    setSuggestedName(query.trim());
    setSuggestionDescription("");
    setSuggestionOpen(true);
    setIsFocused(false);
    setLocalMessage(null);
  }

  async function submitSuggestion() {
    setLocalMessage(null);

    if (!categoryId || !activityId) {
      setLocalMessage({
        tone: "error",
        text: "Select an exact Activity before suggesting a Community.",
      });
      return;
    }

    if (suggestedName.trim().length < 2) {
      setLocalMessage({
        tone: "error",
        text: "Community name must contain at least 2 characters.",
      });
      return;
    }

    setIsSuggesting(true);

    try {
      const { error } = await supabase.rpc(
        "submit_community_suggestion_for_activity",
        {
          p_suggested_name: suggestedName.trim(),
          p_description: suggestionDescription.trim() || null,
          p_activity_id: activityId,
        }
      );

      if (error) throw error;

      setSuggestionOpen(false);
      setSuggestedName("");
      setSuggestionDescription("");
      setQuery("");
      setLocalMessage({
        tone: "success",
        text: "Community suggestion sent for review.",
      });
    } catch (error) {
      setLocalMessage({
        tone: "error",
        text:
          error instanceof Error
            ? error.message
            : "Community suggestion could not be sent.",
      });
    } finally {
      setIsSuggesting(false);
    }
  }

  return (
    <section className="md:col-span-2">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-gray-700">
            Communities
            <span className="ml-1 font-normal text-gray-400">
              (optional, up to 3)
            </span>
          </p>
          <p className="mt-1 text-xs leading-5 text-gray-400">
            The first Community is primary. All choices must belong directly to the selected Activity.
          </p>
        </div>

        <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
          {value.length} / {MAX_COMMUNITIES}
        </span>
      </div>

      {selectedCommunities.length > 0 && (
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {selectedCommunities.map((community, index) => {
            const accentColor = normalizeCommunityAccent(community.accentColor);
            const secondaryColor = normalizeCommunitySecondary(community.secondaryColor);
            const visibleBorder = getCommunityVisibleBorder(
              accentColor,
              secondaryColor
            );

            return (
              <article
                key={community.id}
                className="flex min-w-0 items-center gap-3 rounded-2xl border bg-white p-3 shadow-sm"
                style={{ borderColor: visibleBorder }}
              >
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                  style={{
                    backgroundColor: accentColor,
                    color: getCommunityAccentForeground(accentColor),
                    boxShadow: `inset 0 0 0 2px ${visibleBorder}`,
                  }}
                >
                  <CommunityIcon
                    iconKey={community.iconKey}
                    iconUrl={community.iconUrl}
                    className="h-5 w-5"
                  />
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-gray-950">
                    {community.name}
                  </p>
                  <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                    {index === 0 ? "Primary Community" : "Additional Community"}
                  </p>
                </div>

                <div className="flex shrink-0 flex-col gap-1">
                  {index > 0 && (
                    <button
                      type="button"
                      onClick={() => makePrimary(community.id)}
                      className="rounded-lg px-2 py-1 text-[10px] font-semibold text-indigo-700 hover:bg-indigo-50"
                    >
                      Make primary
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => removeCommunity(community.id)}
                    className="rounded-lg px-2 py-1 text-[10px] font-semibold text-red-600 hover:bg-red-50"
                  >
                    Remove
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <div className="relative mt-3">
        <input
          value={query}
          disabled={!activityId || isLoading || value.length >= MAX_COMMUNITIES}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onChange={(event) => {
            setQuery(event.target.value);
            setLocalMessage(null);
          }}
          placeholder={
            !activityId
              ? "Select an Activity first"
              : isLoading
                ? "Loading Communities..."
                : value.length >= MAX_COMMUNITIES
                  ? "Maximum 3 Communities selected"
                  : "Search or select another Community"
          }
          className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-100 disabled:bg-gray-100 disabled:text-gray-400"
        />

        {showResults && value.length < MAX_COMMUNITIES && (
          <div className="absolute z-30 mt-2 max-h-72 w-full overflow-y-auto rounded-2xl border border-gray-200 bg-white p-2 shadow-xl">
            {filteredCommunities.length > 0 ? (
              <div className="space-y-1">
                {filteredCommunities.map((community) => (
                  <button
                    key={community.id}
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => selectCommunity(community)}
                    className="flex w-full items-center justify-between gap-4 rounded-xl px-4 py-3 text-left transition hover:bg-green-50"
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <span
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                        style={{
                          backgroundColor: normalizeCommunityAccent(
                            community.accentColor
                          ),
                          color: getCommunityAccentForeground(
                            community.accentColor
                          ),
                        }}
                      >
                        <CommunityIcon
                          iconKey={community.iconKey}
                          iconUrl={community.iconUrl}
                          className="h-4 w-4"
                        />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-semibold text-gray-950">
                          {community.name}
                        </span>
                        {community.description && (
                          <span className="mt-0.5 block truncate text-xs text-gray-500">
                            {community.description}
                          </span>
                        )}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm font-semibold text-green-700">
                      Select
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="px-4 py-5 text-sm text-gray-500">
                No additional Community has been approved for {activityName || "this Activity"}.
              </p>
            )}

            {canOfferSuggestion && (
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={openSuggestion}
                className="mt-2 w-full rounded-xl border border-dashed border-purple-300 bg-purple-50 px-4 py-3 text-left text-sm font-semibold text-purple-800 transition hover:border-purple-500 hover:bg-purple-100"
              >
                Can&apos;t find it for {activityName || "this Activity"}? Suggest a Community
              </button>
            )}
          </div>
        )}
      </div>

      {suggestionOpen && (
        <section className="mt-4 rounded-2xl border border-purple-200 bg-purple-50 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-purple-700">
                Community suggestion
              </p>
              <h3 className="mt-1 font-bold text-purple-950">
                Suggest a Community for {activityName || "this Activity"}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setSuggestionOpen(false)}
              className="rounded-lg px-3 py-2 text-sm font-semibold text-purple-700 hover:bg-purple-100"
            >
              Close
            </button>
          </div>

          <div className="mt-4 grid gap-4">
            <input
              value={suggestedName}
              onChange={(event) => setSuggestedName(event.target.value)}
              maxLength={100}
              placeholder="Community name"
              className="rounded-xl border border-purple-200 bg-white px-4 py-3 outline-none focus:border-purple-500"
            />
            <textarea
              value={suggestionDescription}
              onChange={(event) => setSuggestionDescription(event.target.value)}
              maxLength={1200}
              placeholder="Why is this a reusable context? Optional."
              className="min-h-24 resize-y rounded-xl border border-purple-200 bg-white px-4 py-3 outline-none focus:border-purple-500"
            />
            <button
              type="button"
              disabled={isSuggesting}
              onClick={submitSuggestion}
              className="rounded-xl bg-purple-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              {isSuggesting ? "Sending..." : "Send suggestion"}
            </button>
          </div>
        </section>
      )}

      {localMessage && (
        <p
          className={`mt-3 text-sm font-semibold ${
            localMessage.tone === "success" ? "text-green-700" : "text-red-700"
          }`}
        >
          {localMessage.text}
        </p>
      )}
    </section>
  );
}
