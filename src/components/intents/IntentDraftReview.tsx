"use client";

import {
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { supabase } from "@/utils/supabase/client";

export type IntentDraftLocation = {
  id: string;
  city: string;
  district: string;
};

export type IntentDraftDetail = {
  draft: {
    id: string;
    status:
      | "awaiting_activity_review"
      | "ready_to_publish"
      | "published"
      | "rejected"
      | "cancelled";
    start_date: string;
    end_date: string;
    people: string;
    location_id: string;
    budget: number | null;
    recurrence: string;
    visibility: string;
    notes: string | null;
    intent_type: string;
    max_participants: number | null;
    timing_mode: string;
    published_intent_id: string | null;
    created_at: string;
    updated_at: string;
  };
  suggestion: {
    id: string;
    proposed_activity_name: string;
    proposed_category_name: string | null;
    description: string;
    status:
      | "pending"
      | "mapped_existing"
      | "approved_new"
      | "rejected";
    review_note: string | null;
    reviewed_at: string | null;
  };
  canonical_activity: {
    id: string;
    name: string;
    category_id: string;
    category_name: string;
  } | null;
  location: IntentDraftLocation;
};

type IntentDraftReviewProps = {
  initialData: IntentDraftDetail;
  locations: IntentDraftLocation[];
};

function getStatusLabel(
  status: IntentDraftDetail["draft"]["status"]
) {
  if (
    status ===
    "awaiting_activity_review"
  ) {
    return "Awaiting Activity review";
  }

  if (
    status ===
    "ready_to_publish"
  ) {
    return "Ready to publish";
  }

  if (status === "published") {
    return "Published";
  }

  if (status === "rejected") {
    return "Request rejected";
  }

  return "Cancelled";
}

function getStatusClasses(
  status: IntentDraftDetail["draft"]["status"]
) {
  if (
    status ===
    "ready_to_publish"
  ) {
    return "bg-green-100 text-green-800";
  }

  if (
    status ===
    "awaiting_activity_review"
  ) {
    return "bg-amber-100 text-amber-800";
  }

  if (status === "published") {
    return "bg-blue-100 text-blue-800";
  }

  if (status === "rejected") {
    return "bg-red-100 text-red-800";
  }

  return "bg-gray-100 text-gray-700";
}

export default function IntentDraftReview({
  initialData,
  locations,
}: IntentDraftReviewProps) {
  const router = useRouter();

  const [startDate, setStartDate] =
    useState(
      initialData.draft.start_date
    );

  const [endDate, setEndDate] =
    useState(
      initialData.draft.end_date
    );

  const [people, setPeople] =
    useState(
      initialData.draft.people
    );

  const [locationId, setLocationId] =
    useState(
      initialData.draft.location_id
    );

  const [budget, setBudget] =
    useState(
      initialData.draft.budget ===
      null
        ? ""
        : String(
            initialData.draft.budget
          )
    );

  const [recurrence, setRecurrence] =
    useState(
      initialData.draft.recurrence
    );

  const [
    maxParticipants,
    setMaxParticipants,
  ] = useState(
    initialData.draft
      .max_participants === null
      ? "unlimited"
      : String(
          initialData.draft
            .max_participants
        )
  );

  const [visibility, setVisibility] =
    useState(
      initialData.draft.visibility
    );

  const [notes, setNotes] =
    useState(
      initialData.draft.notes ?? ""
    );

  const [isSaving, setIsSaving] =
    useState(false);

  const [isPublishing, setIsPublishing] =
    useState(false);

  const [message, setMessage] =
    useState<string | null>(null);

  const isEditable =
    initialData.draft.status ===
      "awaiting_activity_review" ||
    initialData.draft.status ===
      "ready_to_publish";

  const canPublish =
    initialData.draft.status ===
      "ready_to_publish" &&
    initialData.canonical_activity !==
      null;

  const selectedLocation =
    useMemo(
      () =>
        locations.find(
          (location) =>
            location.id ===
            locationId
        ) ?? null,
      [locationId, locations]
    );

  async function saveDraft() {
    if (!isEditable) {
      return;
    }

    setIsSaving(true);
    setMessage(null);

    const parsedBudget =
      budget.trim()
        ? Number(budget)
        : null;

    const parsedMaxParticipants =
      maxParticipants ===
      "unlimited"
        ? null
        : Number(
            maxParticipants
          );

    const { error } =
      await supabase.rpc(
        "update_my_intent_draft",
        {
          p_draft_id:
            initialData.draft.id,
          p_start_date:
            startDate,
          p_end_date:
            endDate,
          p_people:
            people,
          p_location_id:
            locationId,
          p_budget:
            parsedBudget,
          p_recurrence:
            recurrence,
          p_visibility:
            visibility,
          p_notes:
            notes || null,
          p_max_participants:
            parsedMaxParticipants,
          p_timing_mode:
            initialData.draft
              .timing_mode,
        }
      );

    setIsSaving(false);

    if (error) {
      setMessage(
        error.message
      );
      return;
    }

    setMessage(
      "Draft saved."
    );

    router.refresh();
  }

  async function publishDraft() {
    if (!canPublish) {
      return;
    }

    setIsPublishing(true);
    setMessage(null);

    const { data, error } =
      await supabase.rpc(
        "publish_ready_intent_draft",
        {
          p_draft_id:
            initialData.draft.id,
        }
      );

    if (error) {
      setMessage(
        error.message
      );
      setIsPublishing(false);
      return;
    }

    if (
      typeof data !== "string"
    ) {
      setMessage(
        "Intent could not be published."
      );
      setIsPublishing(false);
      return;
    }

    router.push("/timeline");
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8 md:px-6">
      <div className="mx-auto max-w-4xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/intent-drafts"
            className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:border-purple-300 hover:text-purple-700"
          >
            ← Activity requests
          </Link>

          <Link
            href="/timeline"
            className="text-sm font-semibold text-green-700 transition hover:underline"
          >
            Timeline
          </Link>
        </div>

        <header className="mt-6 rounded-3xl border border-gray-200 bg-white p-6 shadow-sm md:p-8">
          <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-purple-700">
                Intent Draft
              </p>

              <h1 className="mt-3 text-3xl font-bold text-gray-950">
                {initialData
                  .canonical_activity
                  ?.name ??
                  initialData.suggestion
                    .proposed_activity_name}
              </h1>

              <p className="mt-2 text-gray-500">
                {initialData
                  .canonical_activity
                  ?.category_name ??
                  "Canonical classification pending"}
              </p>
            </div>

            <span
              className={`rounded-full px-4 py-2 text-sm font-semibold ${getStatusClasses(
                initialData.draft
                  .status
              )}`}
            >
              {getStatusLabel(
                initialData.draft
                  .status
              )}
            </span>
          </div>
        </header>

        <section className="mt-6 rounded-3xl border border-purple-200 bg-purple-50 p-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-purple-700">
            Original Activity request
          </p>

          <h2 className="mt-2 text-xl font-bold text-purple-950">
            {
              initialData.suggestion
                .proposed_activity_name
            }
          </h2>

          {initialData.suggestion
            .proposed_category_name && (
            <p className="mt-1 text-sm text-purple-700">
              Suggested category:{" "}
              {
                initialData
                  .suggestion
                  .proposed_category_name
              }
            </p>
          )}

          <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-purple-900">
            {
              initialData.suggestion
                .description
            }
          </p>

          {initialData.suggestion
            .review_note && (
            <div className="mt-5 rounded-2xl border border-white/70 bg-white/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-purple-700">
                Administrator note
              </p>

              <p className="mt-2 text-sm leading-6 text-purple-950">
                {
                  initialData
                    .suggestion
                    .review_note
                }
              </p>
            </div>
          )}
        </section>

        {initialData
          .canonical_activity && (
          <section className="mt-6 rounded-3xl border border-green-200 bg-green-50 p-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-green-700">
              Canonical classification
            </p>

            <h2 className="mt-2 text-2xl font-bold text-green-950">
              {
                initialData
                  .canonical_activity
                  .name
              }
            </h2>

            <p className="mt-1 text-sm text-green-800">
              {
                initialData
                  .canonical_activity
                  .category_name
              }
            </p>

            <p className="mt-4 text-sm leading-6 text-green-900">
              This canonical Activity will
              be the main title of the
              published Intent. Your
              personal detail remains in
              Notes.
            </p>
          </section>
        )}

        {initialData.draft
          .status ===
          "awaiting_activity_review" && (
          <section className="mt-6 rounded-3xl border border-amber-200 bg-amber-50 p-6">
            <h2 className="font-bold text-amber-950">
              Administrator review is
              pending
            </h2>

            <p className="mt-2 text-sm leading-6 text-amber-800">
              You may update the Intent
              details while the Activity is
              being classified. Publishing
              becomes available after a
              canonical Activity is
              assigned.
            </p>
          </section>
        )}

        {initialData.draft
          .status ===
          "rejected" && (
          <section className="mt-6 rounded-3xl border border-red-200 bg-red-50 p-6">
            <h2 className="font-bold text-red-950">
              This request was not added
              to the catalogue
            </h2>

            <p className="mt-2 text-sm leading-6 text-red-800">
              Review the administrator
              note above and create a new
              Activity request with clearer
              details when appropriate.
            </p>

            <Link
              href="/onboarding"
              className="mt-5 inline-flex rounded-xl bg-red-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-red-800"
            >
              Create a new Intent
            </Link>
          </section>
        )}

        {initialData.draft
          .status ===
          "published" && (
          <section className="mt-6 rounded-3xl border border-blue-200 bg-blue-50 p-6">
            <h2 className="font-bold text-blue-950">
              This Intent has been
              published
            </h2>

            <Link
              href="/timeline"
              className="mt-4 inline-flex rounded-xl bg-blue-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-800"
            >
              Open Timeline
            </Link>
          </section>
        )}

        {isEditable && (
          <section className="mt-6 rounded-3xl border border-gray-200 bg-white p-6 shadow-sm md:p-8">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Intent details
            </p>

            <div className="mt-5 grid gap-5 md:grid-cols-2">
              <label>
                <span className="text-sm font-semibold text-gray-700">
                  Start date
                </span>

                <input
                  type="date"
                  value={startDate}
                  onChange={(event) =>
                    setStartDate(
                      event.target.value
                    )
                  }
                  className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-green-500"
                />
              </label>

              <label>
                <span className="text-sm font-semibold text-gray-700">
                  End date
                </span>

                <input
                  type="date"
                  min={startDate}
                  value={endDate}
                  onChange={(event) =>
                    setEndDate(
                      event.target.value
                    )
                  }
                  className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-green-500"
                />
              </label>

              <label>
                <span className="text-sm font-semibold text-gray-700">
                  With whom?
                </span>

                <select
                  value={people}
                  onChange={(event) =>
                    setPeople(
                      event.target.value
                    )
                  }
                  className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-green-500"
                >
                  <option value="anyone">
                    Anyone
                  </option>
                  <option value="friends">
                    Friends
                  </option>
                  <option value="new people">
                    New people
                  </option>
                  <option value="professionals">
                    Professionals
                  </option>
                  <option value="solo">
                    Solo
                  </option>
                </select>
              </label>

              <label>
                <span className="text-sm font-semibold text-gray-700">
                  Location
                </span>

                <select
                  value={locationId}
                  onChange={(event) =>
                    setLocationId(
                      event.target.value
                    )
                  }
                  className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-green-500"
                >
                  {locations.map(
                    (location) => (
                      <option
                        key={
                          location.id
                        }
                        value={
                          location.id
                        }
                      >
                        {
                          location.district
                        }
                        ,{" "}
                        {
                          location.city
                        }
                      </option>
                    )
                  )}
                </select>
              </label>

              <label>
                <span className="text-sm font-semibold text-gray-700">
                  Budget
                </span>

                <input
                  type="number"
                  min="0"
                  value={budget}
                  onChange={(event) =>
                    setBudget(
                      event.target.value
                    )
                  }
                  placeholder="No defined budget"
                  className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-green-500"
                />
              </label>

              <label>
                <span className="text-sm font-semibold text-gray-700">
                  Recurrence
                </span>

                <select
                  value={recurrence}
                  onChange={(event) =>
                    setRecurrence(
                      event.target.value
                    )
                  }
                  className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-green-500"
                >
                  <option value="one-time">
                    One-time
                  </option>
                  <option value="daily">
                    Daily
                  </option>
                  <option value="weekly">
                    Weekly
                  </option>
                  <option value="monthly">
                    Monthly
                  </option>
                </select>
              </label>

              <label>
                <span className="text-sm font-semibold text-gray-700">
                  Participant capacity
                </span>

                <select
                  value={
                    maxParticipants
                  }
                  onChange={(event) =>
                    setMaxParticipants(
                      event.target.value
                    )
                  }
                  className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-green-500"
                >
                  <option value="1">
                    +1 person
                  </option>
                  <option value="2">
                    +2 people
                  </option>
                  <option value="3">
                    +3 people
                  </option>
                  <option value="5">
                    +5 people
                  </option>
                  <option value="10">
                    +10 people
                  </option>
                  <option value="unlimited">
                    Unlimited
                  </option>
                </select>
              </label>

              <label>
                <span className="text-sm font-semibold text-gray-700">
                  Visibility
                </span>

                <select
                  value={visibility}
                  onChange={(event) =>
                    setVisibility(
                      event.target.value
                    )
                  }
                  className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-green-500"
                >
                  <option value="public">
                    Anyone
                  </option>
                  <option value="friends">
                    Friends only
                  </option>
                  <option value="except_friends">
                    Anyone except friends
                  </option>
                  <option value="invite_only">
                    Invite only
                  </option>
                  <option value="private">
                    Only me
                  </option>
                </select>
              </label>

              <label className="md:col-span-2">
                <span className="text-sm font-semibold text-gray-700">
                  Notes
                </span>

                <textarea
                  value={notes}
                  onChange={(event) =>
                    setNotes(
                      event.target.value
                    )
                  }
                  placeholder="Describe your personal version of the canonical Activity."
                  className="mt-2 h-32 w-full resize-none rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-green-500"
                />
              </label>
            </div>

            <div className="mt-5 rounded-2xl bg-gray-50 p-4 text-sm text-gray-600">
              <p>
                Area:{" "}
                {selectedLocation
                  ? `${selectedLocation.district}, ${selectedLocation.city}`
                  : "Not selected"}
              </p>

              <p className="mt-1">
                Intent type:{" "}
                {
                  initialData.draft
                    .intent_type
                }
              </p>
            </div>

            {message && (
              <p
                className={`mt-4 rounded-xl p-3 text-sm font-semibold ${
                  message ===
                  "Draft saved."
                    ? "bg-green-50 text-green-700"
                    : "bg-red-50 text-red-700"
                }`}
              >
                {message}
              </p>
            )}

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={isSaving}
                onClick={saveDraft}
                className="rounded-xl border border-gray-200 bg-white px-5 py-3 font-semibold text-gray-700 transition hover:border-green-400 hover:text-green-700 disabled:opacity-50"
              >
                {isSaving
                  ? "Saving..."
                  : "Save Draft"}
              </button>

              {canPublish && (
                <button
                  type="button"
                  disabled={
                    isPublishing
                  }
                  onClick={
                    publishDraft
                  }
                  className="rounded-xl bg-green-600 px-6 py-3 font-semibold text-white transition hover:bg-green-700 disabled:opacity-50"
                >
                  {isPublishing
                    ? "Publishing..."
                    : "Publish Intent"}
                </button>
              )}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
