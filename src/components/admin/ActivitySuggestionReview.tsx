"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";

import { supabase } from "@/utils/supabase/client";

export type ActivitySuggestionRequestExample = {
  draft_id: string;
  user_id: string;
  user_name: string;
  user_username: string | null;
  request_description: string;
  notes: string | null;
  start_date: string;
  end_date: string;
  city: string | null;
  district: string | null;
  created_at: string;
};

export type AdminActivitySuggestionRow = {
  suggestion_id: string;
  suggestion_status:
    | "pending"
    | "mapped_existing"
    | "approved_new"
    | "rejected";
  proposed_activity_name: string;
  requested_category_id: string | null;
  requested_category_name: string | null;
  description: string;
  supporter_count:
    | number
    | string;
  draft_count:
    | number
    | string;
  request_examples: ActivitySuggestionRequestExample[];
  suggested_by_user_id: string;
  user_full_name: string | null;
  user_username: string | null;
  user_email: string | null;
  draft_id: string | null;
  draft_status: string | null;
  start_date: string | null;
  end_date: string | null;
  city: string | null;
  district: string | null;
  people: string | null;
  notes: string | null;
  canonical_activity_id: string | null;
  canonical_activity_name: string | null;
  canonical_category_name: string | null;
  review_note: string | null;
  reviewed_at: string | null;
  created_at: string;
};

export type SuggestionCatalogueCategory = {
  id: string;
  name: string;
  is_active: boolean;
};

export type SuggestionCatalogueActivity = {
  id: string;
  name: string;
  category_id: string;
  category_name: string;
  is_active: boolean;
  category_is_active: boolean;
};

type ActivitySuggestionReviewProps = {
  suggestions: AdminActivitySuggestionRow[];
  categories: SuggestionCatalogueCategory[];
  activities: SuggestionCatalogueActivity[];
};

type ResolutionAction =
  | "map_existing"
  | "create_activity"
  | "create_category_and_activity"
  | "reject";

function toNumber(
  value: number | string
) {
  const parsedValue =
    typeof value === "number"
      ? value
      : Number(value);

  return Number.isFinite(
    parsedValue
  )
    ? parsedValue
    : 0;
}

function formatDate(
  value: string
) {
  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return value;
  }

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }
  ).format(date);
}

function getStatusLabel(
  status: AdminActivitySuggestionRow["suggestion_status"]
) {
  if (status === "pending") {
    return "Pending";
  }

  if (
    status ===
    "mapped_existing"
  ) {
    return "Mapped to existing";
  }

  if (
    status ===
    "approved_new"
  ) {
    return "Approved as new";
  }

  return "Rejected";
}

function SuggestionCard({
  suggestion,
  categories,
  activities,
}: {
  suggestion: AdminActivitySuggestionRow;
  categories: SuggestionCatalogueCategory[];
  activities: SuggestionCatalogueActivity[];
}) {
  const router = useRouter();

  const activeCategories =
    useMemo(
      () =>
        categories.filter(
          (category) =>
            category.is_active
        ),
      [categories]
    );

  const requestedCategoryId =
    suggestion.requested_category_id ??
    activeCategories[0]?.id ??
    "";

  const [action, setAction] =
    useState<ResolutionAction>(
      "map_existing"
    );

  const [mapCategoryId, setMapCategoryId] =
    useState(
      requestedCategoryId
    );

  const [existingCategoryId, setExistingCategoryId] =
    useState(
      requestedCategoryId
    );

  const [existingActivityId, setExistingActivityId] =
    useState("");

  const [newActivityName, setNewActivityName] =
    useState(
      suggestion.proposed_activity_name
    );

  const [newCategoryName, setNewCategoryName] =
    useState(
      suggestion.requested_category_name ??
        ""
    );

  const [reviewNote, setReviewNote] =
    useState("");

  const [isSaving, setIsSaving] =
    useState(false);

  const [message, setMessage] =
    useState<string | null>(null);

  const activeActivities =
    useMemo(
      () =>
        activities.filter(
          (activity) =>
            activity.is_active &&
            activity.category_is_active
        ),
      [activities]
    );

  const mappedActivities =
    useMemo(
      () =>
        activeActivities.filter(
          (activity) =>
            activity.category_id ===
            mapCategoryId
        ),
      [
        activeActivities,
        mapCategoryId,
      ]
    );

  useEffect(() => {
    if (
      mappedActivities.some(
        (activity) =>
          activity.id ===
          existingActivityId
      )
    ) {
      return;
    }

    setExistingActivityId(
      mappedActivities[0]?.id ??
        ""
    );
  }, [
    existingActivityId,
    mappedActivities,
  ]);

  const isPending =
    suggestion.suggestion_status ===
    "pending";

  const supporterCount =
    toNumber(
      suggestion.supporter_count
    );

  const draftCount =
    toNumber(
      suggestion.draft_count
    );

  const requestExamples =
    suggestion.request_examples ?? [];

  const canSubmit =
    isPending &&
    !isSaving &&
    (
      (
        action ===
        "map_existing" &&
        Boolean(
          existingActivityId
        )
      ) ||
      (
        action ===
        "create_activity" &&
        Boolean(
          existingCategoryId
        ) &&
        newActivityName.trim()
          .length >= 2
      ) ||
      (
        action ===
        "create_category_and_activity" &&
        newCategoryName.trim()
          .length >= 2 &&
        newActivityName.trim()
          .length >= 2
      ) ||
      action === "reject"
    );

  async function resolveSuggestion() {
    if (!canSubmit) {
      return;
    }

    setIsSaving(true);
    setMessage(null);

    const { error } =
      await supabase.rpc(
        "admin_resolve_activity_suggestion",
        {
          p_suggestion_id:
            suggestion.suggestion_id,
          p_action:
            action,
          p_existing_activity_id:
            action ===
            "map_existing"
              ? existingActivityId
              : null,
          p_existing_category_id:
            action ===
            "create_activity"
              ? existingCategoryId
              : null,
          p_new_activity_name:
            action ===
              "create_activity" ||
            action ===
              "create_category_and_activity"
              ? newActivityName
              : null,
          p_new_category_name:
            action ===
            "create_category_and_activity"
              ? newCategoryName
              : null,
          p_review_note:
            reviewNote || null,
        }
      );

    setIsSaving(false);

    if (error) {
      setMessage(
        error.message
      );
      return;
    }

    setMessage("Resolved.");
    router.refresh();
  }

  return (
    <article className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                isPending
                  ? "bg-amber-100 text-amber-800"
                  : suggestion.suggestion_status ===
                      "rejected"
                    ? "bg-red-100 text-red-800"
                    : "bg-green-100 text-green-800"
              }`}
            >
              {getStatusLabel(
                suggestion.suggestion_status
              )}
            </span>

            <span className="rounded-full bg-purple-50 px-3 py-1 text-xs font-semibold text-purple-700">
              Activity request
            </span>

            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
              {supporterCount} user{supporterCount === 1 ? "" : "s"} waiting
            </span>

            {draftCount >
              supporterCount && (
              <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
                {draftCount} drafts
              </span>
            )}
          </div>

          <h2 className="mt-4 text-2xl font-bold text-gray-950">
            {suggestion.proposed_activity_name}
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Requested under: {suggestion.requested_category_name ?? "Unknown category"}
          </p>
        </div>

        <div className="text-sm text-gray-500 lg:text-right">
          <p className="font-semibold text-gray-900">
            First requested by {suggestion.user_full_name ?? suggestion.user_username ?? "UIN member"}
          </p>

          <p className="mt-1">
            {suggestion.user_email ?? "Email unavailable"}
          </p>

          <p className="mt-2 text-xs">
            {formatDate(
              suggestion.created_at
            )}
          </p>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-purple-100 bg-purple-50 p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-purple-700">
          Original explanation
        </p>

        <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-purple-950">
          {suggestion.description}
        </p>
      </div>

      {requestExamples.length > 0 && (
        <details className="mt-5 rounded-2xl border border-gray-200 bg-gray-50 p-5">
          <summary className="cursor-pointer list-none text-sm font-semibold text-gray-800">
            Review up to {requestExamples.length} user examples
          </summary>

          <div className="mt-4 space-y-4 border-t border-gray-200 pt-4">
            {requestExamples.map(
              (example) => (
                <article
                  key={example.draft_id}
                  className="rounded-2xl bg-white p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-gray-950">
                        {example.user_name}
                      </p>

                      <p className="mt-1 text-xs text-gray-500">
                        {example.start_date} → {example.end_date}
                        {example.district || example.city
                          ? ` · ${[example.district, example.city].filter(Boolean).join(", ")}`
                          : ""}
                      </p>
                    </div>

                    <p className="text-xs text-gray-400">
                      {formatDate(example.created_at)}
                    </p>
                  </div>

                  <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-gray-700">
                    {example.request_description}
                  </p>

                  {example.notes && (
                    <p className="mt-3 rounded-xl bg-gray-50 p-3 text-sm leading-6 text-gray-600">
                      Intent notes: {example.notes}
                    </p>
                  )}
                </article>
              )
            )}
          </div>
        </details>
      )}

      {!isPending && (
        <div className="mt-5 rounded-2xl border border-gray-200 bg-gray-50 p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Resolution
          </p>

          {suggestion.canonical_activity_name ? (
            <>
              <p className="mt-2 font-bold text-gray-950">
                {suggestion.canonical_activity_name}
              </p>

              <p className="mt-1 text-sm text-gray-600">
                {suggestion.canonical_category_name}
              </p>
            </>
          ) : (
            <p className="mt-2 font-semibold text-red-800">
              Request rejected
            </p>
          )}

          {suggestion.review_note && (
            <p className="mt-3 text-sm leading-6 text-gray-700">
              {suggestion.review_note}
            </p>
          )}
        </div>
      )}

      {isPending && (
        <section className="mt-6 rounded-2xl border border-gray-200 bg-gray-50 p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Administrator decision
          </p>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="md:col-span-2">
              <span className="text-sm font-semibold text-gray-700">
                Resolution
              </span>

              <select
                value={action}
                onChange={(event) =>
                  setAction(
                    event.target.value as ResolutionAction
                  )
                }
                className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 outline-none focus:border-green-500"
              >
                <option value="map_existing">
                  Map to an existing canonical Activity
                </option>

                <option value="create_activity">
                  Create a new Activity in an existing category
                </option>

                <option value="create_category_and_activity">
                  Create a new category and Activity
                </option>

                <option value="reject">
                  Reject the request
                </option>
              </select>
            </label>

            {action === "map_existing" && (
              <>
                <label>
                  <span className="text-sm font-semibold text-gray-700">
                    Canonical category
                  </span>

                  <select
                    value={mapCategoryId}
                    onChange={(event) =>
                      setMapCategoryId(
                        event.target.value
                      )
                    }
                    className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 outline-none focus:border-green-500"
                  >
                    <option value="">
                      Select category
                    </option>

                    {activeCategories.map(
                      (category) => (
                        <option
                          key={category.id}
                          value={category.id}
                        >
                          {category.name}
                        </option>
                      )
                    )}
                  </select>
                </label>

                <label>
                  <span className="text-sm font-semibold text-gray-700">
                    Canonical Activity
                  </span>

                  <select
                    value={existingActivityId}
                    onChange={(event) =>
                      setExistingActivityId(
                        event.target.value
                      )
                    }
                    className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 outline-none focus:border-green-500"
                  >
                    <option value="">
                      Select canonical Activity
                    </option>

                    {mappedActivities.map(
                      (activity) => (
                        <option
                          key={activity.id}
                          value={activity.id}
                        >
                          {activity.name}
                        </option>
                      )
                    )}
                  </select>
                </label>
              </>
            )}

            {action === "create_activity" && (
              <>
                <label>
                  <span className="text-sm font-semibold text-gray-700">
                    Existing category
                  </span>

                  <select
                    value={existingCategoryId}
                    onChange={(event) =>
                      setExistingCategoryId(
                        event.target.value
                      )
                    }
                    className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 outline-none focus:border-green-500"
                  >
                    <option value="">
                      Select category
                    </option>

                    {activeCategories.map(
                      (category) => (
                        <option
                          key={category.id}
                          value={category.id}
                        >
                          {category.name}
                        </option>
                      )
                    )}
                  </select>
                </label>

                <label>
                  <span className="text-sm font-semibold text-gray-700">
                    Canonical Activity name
                  </span>

                  <input
                    value={newActivityName}
                    onChange={(event) =>
                      setNewActivityName(
                        event.target.value
                      )
                    }
                    className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 outline-none focus:border-green-500"
                  />
                </label>
              </>
            )}

            {action === "create_category_and_activity" && (
              <>
                <label>
                  <span className="text-sm font-semibold text-gray-700">
                    Canonical category name
                  </span>

                  <input
                    value={newCategoryName}
                    onChange={(event) =>
                      setNewCategoryName(
                        event.target.value
                      )
                    }
                    className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 outline-none focus:border-green-500"
                  />
                </label>

                <label>
                  <span className="text-sm font-semibold text-gray-700">
                    Canonical Activity name
                  </span>

                  <input
                    value={newActivityName}
                    onChange={(event) =>
                      setNewActivityName(
                        event.target.value
                      )
                    }
                    className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 outline-none focus:border-green-500"
                  />
                </label>
              </>
            )}

            <label className="md:col-span-2">
              <span className="text-sm font-semibold text-gray-700">
                Review note
                <span className="ml-1 font-normal text-gray-400">
                  optional
                </span>
              </span>

              <textarea
                value={reviewNote}
                onChange={(event) =>
                  setReviewNote(
                    event.target.value
                  )
                }
                placeholder={
                  action === "reject"
                    ? "Explain why the request was rejected."
                    : "Explain the canonical classification when useful."
                }
                maxLength={2000}
                className="mt-2 h-24 w-full resize-none rounded-xl border border-gray-200 bg-white px-4 py-3 outline-none focus:border-green-500"
              />
            </label>
          </div>

          {message && (
            <p
              className={`mt-4 text-sm font-semibold ${
                message === "Resolved."
                  ? "text-green-700"
                  : "text-red-700"
              }`}
            >
              {message}
            </p>
          )}

          <button
            type="button"
            disabled={!canSubmit}
            onClick={resolveSuggestion}
            className={`mt-5 w-full rounded-xl px-5 py-3.5 font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50 ${
              action === "reject"
                ? "bg-red-700 hover:bg-red-800"
                : "bg-green-700 hover:bg-green-800"
            }`}
          >
            {isSaving
              ? "Resolving..."
              : action === "reject"
                ? "Reject Activity Request"
                : `Approve classification for ${supporterCount} user${supporterCount === 1 ? "" : "s"}`}
          </button>
        </section>
      )}
    </article>
  );
}

export default function ActivitySuggestionReview({
  suggestions,
  categories,
  activities,
}: ActivitySuggestionReviewProps) {
  const [filter, setFilter] =
    useState<
      | "all"
      | "pending"
      | "resolved"
    >("pending");

  const visibleSuggestions =
    useMemo(() => {
      if (filter === "all") {
        return suggestions;
      }

      if (filter === "pending") {
        return suggestions.filter(
          (suggestion) =>
            suggestion.suggestion_status ===
            "pending"
        );
      }

      return suggestions.filter(
        (suggestion) =>
          suggestion.suggestion_status !==
          "pending"
      );
    }, [filter, suggestions]);

  const pendingCount =
    suggestions.filter(
      (suggestion) =>
        suggestion.suggestion_status ===
        "pending"
    ).length;

  const pendingUserCount =
    suggestions
      .filter(
        (suggestion) =>
          suggestion.suggestion_status ===
          "pending"
      )
      .reduce(
        (total, suggestion) =>
          total +
          toNumber(
            suggestion.supporter_count
          ),
        0
      );

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <p className="text-sm font-semibold text-gray-700">
          {pendingCount} grouped request{pendingCount === 1 ? "" : "s"} · {pendingUserCount} user{pendingUserCount === 1 ? "" : "s"} waiting
        </p>

        <div className="flex flex-wrap gap-2">
          {(
            [
              "pending",
              "resolved",
              "all",
            ] as const
          ).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() =>
                setFilter(item)
              }
              className={`rounded-xl px-4 py-2 text-sm font-semibold capitalize transition ${
                filter === item
                  ? "bg-gray-950 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 space-y-6">
        {visibleSuggestions.map(
          (suggestion) => (
            <SuggestionCard
              key={suggestion.suggestion_id}
              suggestion={suggestion}
              categories={categories}
              activities={activities}
            />
          )
        )}

        {visibleSuggestions.length === 0 && (
          <div className="rounded-3xl border border-gray-200 bg-white p-10 text-center shadow-sm">
            <h2 className="text-xl font-bold text-gray-950">
              No Activity requests here.
            </h2>

            <p className="mt-2 text-gray-500">
              The selected queue is empty.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
