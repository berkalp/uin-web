"use client";

import {
  FormEvent,
  useState,
} from "react";
import { useRouter } from "next/navigation";

import { supabase } from "@/utils/supabase/client";

type ModerationStatus =
  | "open"
  | "under_review"
  | "resolved"
  | "dismissed";

type RestrictionType =
  | "requests"
  | "messaging"
  | "intent_creation"
  | "plan_creation"
  | "account_access";

type ModerationActionsProps = {
  reportId: string;
  reportedUserId: string | null;
  reportStatus: ModerationStatus;
  canManage: boolean;
};

type ActiveOperation =
  | "assign"
  | "resolve"
  | "dismiss"
  | "restriction"
  | null;

function getErrorMessage(
  error: unknown
) {
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message ===
      "string"
  ) {
    return error.message;
  }

  return "The moderation action could not be completed.";
}

function convertLocalDateTimeToIso(
  value: string
) {
  if (!value) {
    return null;
  }

  const parsedDate =
    new Date(value);

  if (
    Number.isNaN(
      parsedDate.getTime()
    )
  ) {
    throw new Error(
      "The restriction end time is invalid."
    );
  }

  if (
    parsedDate.getTime() <=
    Date.now()
  ) {
    throw new Error(
      "The restriction end time must be in the future."
    );
  }

  return parsedDate.toISOString();
}

export default function ModerationActions({
  reportId,
  reportedUserId,
  reportStatus,
  canManage,
}: ModerationActionsProps) {
  const router = useRouter();

  const [
    activeOperation,
    setActiveOperation,
  ] =
    useState<ActiveOperation>(
      null
    );

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const [
    successMessage,
    setSuccessMessage,
  ] = useState("");

  const [
    resolutionSummary,
    setResolutionSummary,
  ] = useState("");

  const [
    dismissalSummary,
    setDismissalSummary,
  ] = useState("");

  const [
    restrictionType,
    setRestrictionType,
  ] =
    useState<RestrictionType>(
      "requests"
    );

  const [
    restrictionReason,
    setRestrictionReason,
  ] = useState("");

  const [
    restrictionNotes,
    setRestrictionNotes,
  ] = useState("");

  const [
    restrictionEndsAt,
    setRestrictionEndsAt,
  ] = useState("");

  const isClosed =
    reportStatus ===
      "resolved" ||
    reportStatus ===
      "dismissed";

  const isBusy =
    activeOperation !== null;

  function clearFeedback() {
    setErrorMessage("");
    setSuccessMessage("");
  }

  async function assignToMe() {
    clearFeedback();
    setActiveOperation(
      "assign"
    );

    try {
      const {
        error,
      } = await supabase.rpc(
        "assign_moderation_report",
        {
          p_report_id:
            reportId,
          p_assigned_admin_id:
            null,
        }
      );

      if (error) {
        throw error;
      }

      setSuccessMessage(
        "The report was assigned to you."
      );

      router.refresh();
    } catch (error) {
      setErrorMessage(
        getErrorMessage(error)
      );
    } finally {
      setActiveOperation(null);
    }
  }

  async function submitResolution(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    clearFeedback();

    const cleanedSummary =
      resolutionSummary.trim();

    if (
      cleanedSummary.length < 3
    ) {
      setErrorMessage(
        "Enter a resolution summary of at least 3 characters."
      );

      return;
    }

    setActiveOperation(
      "resolve"
    );

    try {
      const {
        error,
      } = await supabase.rpc(
        "resolve_moderation_report",
        {
          p_report_id:
            reportId,
          p_outcome:
            "resolved",
          p_resolution_summary:
            cleanedSummary,
        }
      );

      if (error) {
        throw error;
      }

      setResolutionSummary("");

      setSuccessMessage(
        "The report was resolved."
      );

      router.refresh();
    } catch (error) {
      setErrorMessage(
        getErrorMessage(error)
      );
    } finally {
      setActiveOperation(null);
    }
  }

  async function submitDismissal(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    clearFeedback();

    const cleanedSummary =
      dismissalSummary.trim();

    if (
      cleanedSummary.length < 3
    ) {
      setErrorMessage(
        "Enter a dismissal summary of at least 3 characters."
      );

      return;
    }

    setActiveOperation(
      "dismiss"
    );

    try {
      const {
        error,
      } = await supabase.rpc(
        "resolve_moderation_report",
        {
          p_report_id:
            reportId,
          p_outcome:
            "dismissed",
          p_resolution_summary:
            cleanedSummary,
        }
      );

      if (error) {
        throw error;
      }

      setDismissalSummary("");

      setSuccessMessage(
        "The report was dismissed."
      );

      router.refresh();
    } catch (error) {
      setErrorMessage(
        getErrorMessage(error)
      );
    } finally {
      setActiveOperation(null);
    }
  }

  async function submitRestriction(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    clearFeedback();

    if (!reportedUserId) {
      setErrorMessage(
        "The reported user could not be identified."
      );

      return;
    }

    const cleanedReason =
      restrictionReason.trim();

    const cleanedNotes =
      restrictionNotes.trim();

    if (
      cleanedReason.length < 3
    ) {
      setErrorMessage(
        "Enter a restriction reason of at least 3 characters."
      );

      return;
    }

    setActiveOperation(
      "restriction"
    );

    try {
      const endsAt =
        convertLocalDateTimeToIso(
          restrictionEndsAt
        );

      const {
        error,
      } = await supabase.rpc(
        "create_user_restriction",
        {
          p_user_id:
            reportedUserId,
          p_restriction_type:
            restrictionType,
          p_reason:
            cleanedReason,
          p_internal_notes:
            cleanedNotes ||
            null,
          p_ends_at:
            endsAt,
          p_source_report_id:
            reportId,
        }
      );

      if (error) {
        throw error;
      }

      setRestrictionReason("");
      setRestrictionNotes("");
      setRestrictionEndsAt("");

      setSuccessMessage(
        "The user restriction was created."
      );

      router.refresh();
    } catch (error) {
      setErrorMessage(
        getErrorMessage(error)
      );
    } finally {
      setActiveOperation(null);
    }
  }

  if (!canManage) {
    return (
      <div className="mt-5 rounded-2xl border border-gray-200 bg-gray-50 p-5">
        <p className="font-semibold text-gray-800">
          Read-only moderation access
        </p>

        <p className="mt-2 text-sm leading-6 text-gray-500">
          Owner, Administrator or
          Moderator access is required
          to perform moderation actions.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-5 space-y-4">
      {errorMessage && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-semibold text-red-800">
            {errorMessage}
          </p>
        </div>
      )}

      {successMessage && (
        <div className="rounded-2xl border border-green-200 bg-green-50 p-4">
          <p className="text-sm font-semibold text-green-800">
            {successMessage}
          </p>
        </div>
      )}

      {!isClosed && (
        <section className="rounded-2xl border border-gray-200 bg-gray-50 p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Report Assignment
              </p>

              <h4 className="mt-2 text-lg font-bold text-gray-900">
                Take ownership of this review
              </h4>

              <p className="mt-2 text-sm leading-6 text-gray-500">
                Assigning the report moves
                it into the Under Review
                state.
              </p>
            </div>

            <button
              type="button"
              onClick={
                assignToMe
              }
              disabled={isBusy}
              className="rounded-xl bg-gray-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {activeOperation ===
              "assign"
                ? "Assigning..."
                : "Assign to Me"}
            </button>
          </div>
        </section>
      )}

      {!isClosed && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <form
            onSubmit={
              submitResolution
            }
            className="rounded-2xl border border-green-100 bg-green-50 p-5"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-green-700">
              Resolve Report
            </p>

            <h4 className="mt-2 text-lg font-bold text-gray-900">
              Confirm a moderation issue
            </h4>

            <p className="mt-2 text-sm leading-6 text-gray-600">
              Use this when the report
              was valid and the review
              has been completed.
            </p>

            <label
              htmlFor={`resolution-${reportId}`}
              className="mt-5 block text-sm font-semibold text-gray-700"
            >
              Resolution summary
            </label>

            <textarea
              id={`resolution-${reportId}`}
              value={
                resolutionSummary
              }
              onChange={(event) =>
                setResolutionSummary(
                  event.target.value
                )
              }
              maxLength={4000}
              rows={5}
              placeholder="Explain what was reviewed and what action was taken."
              className="mt-2 w-full resize-y rounded-xl border border-green-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-green-500 focus:ring-2 focus:ring-green-100"
            />

            <div className="mt-4 flex items-center justify-between gap-3">
              <p className="text-xs text-gray-500">
                {
                  resolutionSummary.length
                }
                /4000
              </p>

              <button
                type="submit"
                disabled={isBusy}
                className="rounded-xl bg-green-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {activeOperation ===
                "resolve"
                  ? "Resolving..."
                  : "Resolve Report"}
              </button>
            </div>
          </form>

          <form
            onSubmit={
              submitDismissal
            }
            className="rounded-2xl border border-gray-200 bg-gray-50 p-5"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">
              Dismiss Report
            </p>

            <h4 className="mt-2 text-lg font-bold text-gray-900">
              Close without enforcement
            </h4>

            <p className="mt-2 text-sm leading-6 text-gray-600">
              Use this when the report
              is unsupported, duplicated
              or does not violate policy.
            </p>

            <label
              htmlFor={`dismissal-${reportId}`}
              className="mt-5 block text-sm font-semibold text-gray-700"
            >
              Dismissal summary
            </label>

            <textarea
              id={`dismissal-${reportId}`}
              value={
                dismissalSummary
              }
              onChange={(event) =>
                setDismissalSummary(
                  event.target.value
                )
              }
              maxLength={4000}
              rows={5}
              placeholder="Explain why the report is being dismissed."
              className="mt-2 w-full resize-y rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-gray-500 focus:ring-2 focus:ring-gray-100"
            />

            <div className="mt-4 flex items-center justify-between gap-3">
              <p className="text-xs text-gray-500">
                {
                  dismissalSummary.length
                }
                /4000
              </p>

              <button
                type="submit"
                disabled={isBusy}
                className="rounded-xl bg-gray-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {activeOperation ===
                "dismiss"
                  ? "Dismissing..."
                  : "Dismiss Report"}
              </button>
            </div>
          </form>
        </div>
      )}

      {reportedUserId && (
        <form
          onSubmit={
            submitRestriction
          }
          className="rounded-2xl border border-red-100 bg-red-50 p-5"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-red-700">
            User Restriction
          </p>

          <h4 className="mt-2 text-lg font-bold text-gray-900">
            Restrict platform capabilities
          </h4>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-600">
            Restrictions may be temporary
            or indefinite. They are stored
            separately from the report and
            recorded in the Audit Log.
          </p>

          <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div>
              <label
                htmlFor={`restriction-type-${reportId}`}
                className="block text-sm font-semibold text-gray-700"
              >
                Restriction type
              </label>

              <select
                id={`restriction-type-${reportId}`}
                value={
                  restrictionType
                }
                onChange={(event) =>
                  setRestrictionType(
                    event.target
                      .value as RestrictionType
                  )
                }
                className="mt-2 w-full rounded-xl border border-red-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100"
              >
                <option value="requests">
                  Participation Requests
                </option>

                <option value="messaging">
                  Messaging
                </option>

                <option value="intent_creation">
                  Intent Creation
                </option>

                <option value="plan_creation">
                  Plan Creation
                </option>

                <option value="account_access">
                  Account Access
                </option>
              </select>
            </div>

            <div>
              <label
                htmlFor={`restriction-end-${reportId}`}
                className="block text-sm font-semibold text-gray-700"
              >
                End time
              </label>

              <input
                id={`restriction-end-${reportId}`}
                type="datetime-local"
                value={
                  restrictionEndsAt
                }
                onChange={(event) =>
                  setRestrictionEndsAt(
                    event.target.value
                  )
                }
                className="mt-2 w-full rounded-xl border border-red-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100"
              />

              <p className="mt-2 text-xs text-gray-500">
                Leave empty for an
                indefinite restriction.
              </p>
            </div>
          </div>

          <div className="mt-4">
            <label
              htmlFor={`restriction-reason-${reportId}`}
              className="block text-sm font-semibold text-gray-700"
            >
              Restriction reason
            </label>

            <textarea
              id={`restriction-reason-${reportId}`}
              value={
                restrictionReason
              }
              onChange={(event) =>
                setRestrictionReason(
                  event.target.value
                )
              }
              maxLength={2000}
              rows={4}
              placeholder="Explain why this restriction is necessary."
              className="mt-2 w-full resize-y rounded-xl border border-red-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-red-500 focus:ring-2 focus:ring-red-100"
            />
          </div>

          <div className="mt-4">
            <label
              htmlFor={`restriction-notes-${reportId}`}
              className="block text-sm font-semibold text-gray-700"
            >
              Internal notes
            </label>

            <textarea
              id={`restriction-notes-${reportId}`}
              value={
                restrictionNotes
              }
              onChange={(event) =>
                setRestrictionNotes(
                  event.target.value
                )
              }
              maxLength={4000}
              rows={4}
              placeholder="Optional internal context for administrators and moderators."
              className="mt-2 w-full resize-y rounded-xl border border-red-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-red-500 focus:ring-2 focus:ring-red-100"
            />
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-red-700">
              Account Access restrictions
              may prevent the user from
              using the platform.
            </p>

            <button
              type="submit"
              disabled={isBusy}
              className="rounded-xl bg-red-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {activeOperation ===
              "restriction"
                ? "Creating Restriction..."
                : "Create Restriction"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}