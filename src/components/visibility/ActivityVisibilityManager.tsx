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

function getVisibilityErrorMessage(error: unknown) {
  if (
    error &&
    typeof error === "object"
  ) {
    const candidate = error as {
      message?: unknown;
      details?: unknown;
      hint?: unknown;
      code?: unknown;
    };

    const parts = [
      candidate.message,
      candidate.details,
      candidate.hint,
    ].filter(
      (value): value is string =>
        typeof value === "string" &&
        value.trim().length > 0
    );

    if (parts.length > 0) {
      const code =
        typeof candidate.code === "string" &&
        candidate.code.trim().length > 0
          ? ` (${candidate.code})`
          : "";

      return `${parts.join(" ")}${code}`;
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Activity visibility could not be updated.";
}

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
        "set_activity_visibility_v2",
        {
          p_target_intent_id:
            intentId,

          p_target_visibility:
            selectedVisibility,
        }
      );

      if (error) {
        throw error;
      }

      const returnedVisibility =
        typeof data === "string"
          ? data
          : data &&
              typeof data === "object" &&
              "visibility" in data &&
              typeof (
                data as {
                  visibility?: unknown;
                }
              ).visibility === "string"
            ? (
                data as {
                  visibility: string;
                }
              ).visibility
            : selectedVisibility;

      const saved =
        normalizeActivityVisibility(
          returnedVisibility
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
      const visibilityError =
        getVisibilityErrorMessage(
          error
        );

      // A rejected save is handled inline. Using console.error here makes
      // Next.js dev mode replace the page with its error overlay even though
      // the component has already recovered from the request failure.
      console.warn(
        "Activity visibility update failed:",
        visibilityError
      );

      setErrorMessage(
        visibilityError
      );
    } finally {
      setIsSaving(false);
    }
  }

  if (compact) {
    return (
      <section id="privacy" className="scroll-mt-24 rounded-3xl border border-indigo-100 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-50 text-lg text-indigo-700">
              🔒
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-indigo-700">
                Privacy & Visibility
              </p>
              <h2 className="mt-1 text-lg font-bold text-gray-950">
                {getActivityVisibilityLabel(savedVisibility)}
              </h2>
              <p className="mt-1 text-xs text-gray-500">
                {options.find((option) => option.value === savedVisibility)?.description}
              </p>
            </div>
          </div>

          {canEdit && (
            <a
              href={`/intents/${encodeURIComponent(intentId)}/visibility`}
              className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100"
            >
              Edit visibility
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
