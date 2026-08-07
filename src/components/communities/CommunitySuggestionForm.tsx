"use client";

import {
  useMemo,
  useState,
} from "react";
import Link from "next/link";

import {
  supabase,
} from "@/utils/supabase/client";

type CategoryOption = {
  id: string;
  name: string;
};

export type CommunitySuggestionRow = {
  suggestion_id: string;
  suggested_name: string;
  description: string | null;
  category_id: string;
  category_name: string;
  suggestion_status:
    | "pending"
    | "approved_new"
    | "merged_existing"
    | "rejected";
  linked_community_id: string | null;
  linked_community_name: string | null;
  review_note: string | null;
  created_at: string;
  reviewed_at: string | null;
};

type CommunitySuggestionFormProps = {
  categories: CategoryOption[];
  initialCategoryId: string;
  initialSuggestions: CommunitySuggestionRow[];
};

function getStatusPresentation(
  status:
    CommunitySuggestionRow["suggestion_status"]
) {
  if (
    status ===
    "approved_new"
  ) {
    return {
      label:
        "Approved",
      classes:
        "bg-green-100 text-green-800",
    };
  }

  if (
    status ===
    "merged_existing"
  ) {
    return {
      label:
        "Merged",
      classes:
        "bg-blue-100 text-blue-800",
    };
  }

  if (
    status ===
    "rejected"
  ) {
    return {
      label:
        "Rejected",
      classes:
        "bg-red-100 text-red-800",
    };
  }

  return {
    label:
      "Pending review",
    classes:
      "bg-amber-100 text-amber-800",
  };
}

function formatDateTime(
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
      dateStyle:
        "medium",
      timeStyle:
        "short",
    }
  ).format(date);
}

export default function CommunitySuggestionForm({
  categories,
  initialCategoryId,
  initialSuggestions,
}: CommunitySuggestionFormProps) {
  const validInitialCategory =
    categories.some(
      (category) =>
        category.id ===
        initialCategoryId
    )
      ? initialCategoryId
      : "";

  const [
    categoryId,
    setCategoryId,
  ] = useState(
    validInitialCategory
  );

  const [
    suggestedName,
    setSuggestedName,
  ] = useState("");

  const [
    description,
    setDescription,
  ] = useState("");

  const [
    suggestions,
    setSuggestions,
  ] = useState(
    initialSuggestions
  );

  const [
    isSaving,
    setIsSaving,
  ] = useState(false);

  const [
    message,
    setMessage,
  ] = useState<{
    tone:
      | "success"
      | "error";
    text: string;
  } | null>(null);

  const selectedCategory =
    useMemo(
      () =>
        categories.find(
          (category) =>
            category.id ===
            categoryId
        ) ?? null,
      [
        categories,
        categoryId,
      ]
    );

  async function refreshSuggestions() {
    const {
      data,
      error,
    } = await supabase.rpc(
      "get_my_community_suggestions"
    );

    if (error) {
      throw error;
    }

    setSuggestions(
      (
        data ??
        []
      ) as CommunitySuggestionRow[]
    );
  }

  async function handleSubmit() {
    setMessage(null);

    if (!categoryId) {
      setMessage({
        tone:
          "error",
        text:
          "Select the Activity category this Community belongs to.",
      });
      return;
    }

    if (
      suggestedName
        .trim()
        .length <
      2
    ) {
      setMessage({
        tone:
          "error",
        text:
          "Community name must contain at least 2 characters.",
      });
      return;
    }

    setIsSaving(true);

    try {
      const {
        error,
      } = await supabase.rpc(
        "submit_community_suggestion",
        {
          p_suggested_name:
            suggestedName,
          p_description:
            description ||
            null,
          p_category_id:
            categoryId,
        }
      );

      if (error) {
        throw error;
      }

      await refreshSuggestions();

      setSuggestedName("");
      setDescription("");

      setMessage({
        tone:
          "success",
        text:
          "Community suggestion sent for administrator review.",
      });
    } catch (
      error
    ) {
      console.error(
        "Community suggestion failed:",
        error
      );

      setMessage({
        tone:
          "error",
        text:
          error instanceof
          Error
            ? error.message
            : "Community suggestion could not be sent.",
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-7">
      <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm md:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-700">
          Community suggestion
        </p>

        <h2 className="mt-2 text-2xl font-bold text-gray-950">
          Suggest a curated context
        </h2>

        <p className="mt-3 max-w-3xl text-sm leading-7 text-gray-600">
          Suggest a stable context people
          may reuse across many Intents,
          such as a sports club, music
          genre, local interest or recurring
          community. One-off match, concert
          or plan details stay in the Intent
          description.
        </p>

        <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
          <label className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-gray-700">
              Activity category
            </span>

            <select
              value={
                categoryId
              }
              onChange={(event) =>
                setCategoryId(
                  event.target.value
                )
              }
              className="rounded-xl border border-gray-200 bg-white px-4 py-3 outline-none focus:border-indigo-500"
            >
              <option value="">
                Select a category
              </option>

              {categories.map(
                (category) => (
                  <option
                    key={
                      category.id
                    }
                    value={
                      category.id
                    }
                  >
                    {
                      category.name
                    }
                  </option>
                )
              )}
            </select>
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-gray-700">
              Suggested Community name
            </span>

            <input
              type="text"
              maxLength={100}
              value={
                suggestedName
              }
              onChange={(event) =>
                setSuggestedName(
                  event.target.value
                )
              }
              placeholder="Beşiktaş JK, Rock Music, Parents in Kadıköy..."
              className="rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-indigo-500"
            />
          </label>

          <label className="flex flex-col gap-2 md:col-span-2">
            <span className="text-sm font-semibold text-gray-700">
              Why should this Community exist?
            </span>

            <textarea
              maxLength={1200}
              value={
                description
              }
              onChange={(event) =>
                setDescription(
                  event.target.value
                )
              }
              placeholder="Describe the broad shared context. Do not submit one-off event names or a sentence that belongs in an Intent."
              className="h-32 resize-none rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-indigo-500"
            />

            <span className="text-xs text-gray-400">
              {description.length}
              {" / "}
              1200
            </span>
          </label>
        </div>

        {selectedCategory && (
          <div className="mt-5 rounded-2xl border border-indigo-100 bg-indigo-50 p-4 text-sm leading-6 text-indigo-900">
            This suggestion will be reviewed
            under{" "}
            <span className="font-bold">
              {
                selectedCategory.name
              }
            </span>
            . Administrators may approve it,
            merge it into an existing
            Community or reject it.
          </div>
        )}

        {message && (
          <p
            className={`mt-5 rounded-xl border p-4 text-sm font-semibold ${
              message.tone ===
              "success"
                ? "border-green-200 bg-green-50 text-green-800"
                : "border-red-200 bg-red-50 text-red-800"
            }`}
          >
            {message.text}
          </p>
        )}

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={
              isSaving
            }
            onClick={
              handleSubmit
            }
            className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-wait disabled:opacity-60"
          >
            {isSaving
              ? "Sending..."
              : "Send suggestion"}
          </button>

          <Link
            href="/onboarding"
            className="rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-gray-700 transition hover:border-green-400 hover:text-green-700"
          >
            Back to Intent Builder
          </Link>
        </div>
      </section>

      <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm md:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
          Your suggestions
        </p>

        <h2 className="mt-2 text-2xl font-bold text-gray-950">
          Review history
        </h2>

        {suggestions.length >
        0 ? (
          <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
            {suggestions.map(
              (suggestion) => {
                const presentation =
                  getStatusPresentation(
                    suggestion.suggestion_status
                  );

                return (
                  <article
                    key={
                      suggestion.suggestion_id
                    }
                    className="rounded-2xl border border-gray-200 p-5"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="font-bold text-gray-950">
                          {
                            suggestion.suggested_name
                          }
                        </h3>

                        <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-indigo-700">
                          {
                            suggestion.category_name
                          }
                        </p>
                      </div>

                      <span
                        className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${presentation.classes}`}
                      >
                        {
                          presentation.label
                        }
                      </span>
                    </div>

                    {suggestion.description && (
                      <p className="mt-3 text-sm leading-6 text-gray-600">
                        {
                          suggestion.description
                        }
                      </p>
                    )}

                    {suggestion.linked_community_name && (
                      <p className="mt-3 rounded-xl bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800">
                        Linked to{" "}
                        {
                          suggestion.linked_community_name
                        }
                      </p>
                    )}

                    {suggestion.review_note && (
                      <p className="mt-3 text-sm leading-6 text-gray-500">
                        Administrator note:{" "}
                        {
                          suggestion.review_note
                        }
                      </p>
                    )}

                    <p className="mt-4 text-xs text-gray-400">
                      Suggested{" "}
                      {
                        formatDateTime(
                          suggestion.created_at
                        )
                      }
                    </p>
                  </article>
                );
              }
            )}
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">
            You have not suggested a
            Community yet.
          </div>
        )}
      </section>
    </div>
  );
}
