"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import {
  ACTIVITY_VISIBILITY_OPTIONS,
  type ActivityVisibility,
  getActivityVisibilityLabel,
  normalizeActivityVisibility,
} from "@/utils/activityVisibility";
import { supabase } from "@/utils/supabase/client";

type ActivityVisibilityManagerProps = {
  intentId: string;
  initialVisibility: ActivityVisibility;
  canEdit: boolean;
  compact?: boolean;
};

const options =
  ACTIVITY_VISIBILITY_OPTIONS;

export default function ActivityVisibilityManager({
  intentId,
  initialVisibility,
  canEdit,
  compact = false,
}: ActivityVisibilityManagerProps) {
  const router = useRouter();

  const normalizedInitial =
    normalizeActivityVisibility(
      initialVisibility
    );

  const [
    selectedVisibility,
    setSelectedVisibility,
  ] = useState<ActivityVisibility>(
    normalizedInitial
  );

  const [
    savedVisibility,
    setSavedVisibility,
  ] = useState<ActivityVisibility>(
    normalizedInitial
  );

  const [
    isSaving,
    setIsSaving,
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const [
    successMessage,
    setSuccessMessage,
  ] = useState("");

  const selectedOption =
    options.find(
      (option) =>
        option.value ===
        selectedVisibility
    ) ?? options[0];

  async function saveVisibility() {
    if (
      !canEdit ||
      selectedVisibility ===
        savedVisibility ||
      isSaving
    ) {
      return;
    }

    setIsSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const {
        data,
        error,
      } = await supabase.rpc(
        "update_activity_visibility",
        {
          p_intent_id:
            intentId,

          p_visibility:
            selectedVisibility,
        }
      );

      if (error) {
        throw error;
      }

      const saved =
        normalizeActivityVisibility(
          typeof data === "string"
            ? data
            : selectedVisibility
        );

      setSavedVisibility(
        saved
      );

      setSelectedVisibility(
        saved
      );

      setSuccessMessage(
        `Activity visibility changed to ${getActivityVisibilityLabel(
          saved
        )}.`
      );

      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Activity visibility could not be updated."
      );
    } finally {
      setIsSaving(false);
    }
  }

  if (compact) {
    return (
      <section className="rounded-3xl border border-indigo-200 bg-indigo-50 p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">
              Activity Visibility
            </p>

            <h2 className="mt-2 text-xl font-bold text-indigo-950">
              {getActivityVisibilityLabel(
                savedVisibility
              )}
            </h2>

            <p className="mt-3 max-w-2xl text-sm leading-7 text-indigo-800">
              {
                options.find(
                  (option) =>
                    option.value ===
                    savedVisibility
                )?.description
              }
            </p>
          </div>

          {canEdit && (
            <a
              href={`/intents/${encodeURIComponent(
                intentId
              )}/visibility`}
              className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
            >
              Manage Visibility
            </a>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-[32px] border border-indigo-200 bg-white p-6 shadow-sm md:p-8">
      <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">
        Activity Visibility
      </p>

      <h1 className="mt-3 text-3xl font-bold text-gray-950">
        Choose who can see and join
      </h1>

      <p className="mt-3 max-w-3xl text-sm leading-7 text-gray-500">
        The source Intent and its linked
        Shared Plan always use the same
        audience. Planning Room messages
        remain members-only regardless of
        this setting.
      </p>

      <div className="mt-7 space-y-3">
        {options.map(
          (option) => {
            const selected =
              selectedVisibility ===
              option.value;

            return (
              <button
                key={
                  option.value
                }
                type="button"
                disabled={
                  !canEdit ||
                  isSaving
                }
                onClick={() => {
                  setSelectedVisibility(
                    option.value
                  );
                  setErrorMessage("");
                  setSuccessMessage("");
                }}
                className={`w-full rounded-2xl border p-5 text-left transition ${
                  selected
                    ? "border-indigo-500 bg-indigo-50 ring-2 ring-indigo-100"
                    : "border-gray-200 bg-white hover:border-indigo-200 hover:bg-indigo-50/40"
                } disabled:cursor-not-allowed disabled:opacity-70`}
              >
                <div className="flex items-start gap-4">
                  <div
                    className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
                      selected
                        ? "border-indigo-600 bg-indigo-600 text-white"
                        : "border-gray-300 bg-white text-transparent"
                    }`}
                  >
                    ✓
                  </div>

                  <div className="min-w-0">
                    <p className="font-bold text-gray-950">
                      {option.label}
                    </p>

                    <p className="mt-2 text-sm leading-6 text-gray-600">
                      {
                        option.description
                      }
                    </p>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-gray-600">
                        {
                          option.discovery
                        }
                      </span>

                      <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-gray-600">
                        {option.request}
                      </span>

                      <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-gray-600">
                        {
                          option.invitation
                        }
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            );
          }
        )}
      </div>

      <div className="mt-6 rounded-2xl border border-gray-200 bg-gray-50 p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
          Selected Behavior
        </p>

        <h2 className="mt-2 text-lg font-bold text-gray-950">
          {
            selectedOption.label
          }
        </h2>

        <p className="mt-2 text-sm leading-6 text-gray-600">
          {
            selectedOption.description
          }
        </p>
      </div>

      {errorMessage && (
        <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-semibold text-red-800">
            {errorMessage}
          </p>
        </div>
      )}

      {successMessage && (
        <div className="mt-5 rounded-xl border border-green-200 bg-green-50 p-4">
          <p className="text-sm font-semibold text-green-800">
            {successMessage}
          </p>
        </div>
      )}

      <button
        type="button"
        disabled={
          !canEdit ||
          isSaving ||
          selectedVisibility ===
            savedVisibility
        }
        onClick={
          saveVisibility
        }
        className="mt-6 w-full rounded-xl bg-indigo-600 px-6 py-4 text-base font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {isSaving
          ? "Saving Visibility..."
          : "Save Visibility"}
      </button>
    </section>
  );
}
