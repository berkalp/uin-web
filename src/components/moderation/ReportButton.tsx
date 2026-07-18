"use client";

import type {
  FormEvent,
} from "react";
import {
  useEffect,
  useId,
  useState,
} from "react";

import { supabase } from "@/utils/supabase/client";

type ReportTargetType =
  | "user"
  | "intent"
  | "plan"
  | "message"
  | "request";

type ReportReason =
  | "spam"
  | "harassment"
  | "hate_or_abuse"
  | "sexual_content"
  | "violence_or_threat"
  | "fraud_or_scam"
  | "privacy"
  | "impersonation"
  | "child_safety"
  | "self_harm"
  | "illegal_activity"
  | "other";

type ReportButtonVariant =
  | "default"
  | "compact"
  | "danger"
  | "menu";

type ReportButtonProps = {
  targetType: ReportTargetType;
  targetId: string;
  targetLabel: string;
  buttonLabel?: string;
  variant?: ReportButtonVariant;
  className?: string;
};

function getErrorMessage(
  error: unknown
) {
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  return "The report could not be submitted.";
}

function getTargetTypeLabel(
  targetType: ReportTargetType
) {
  if (targetType === "user") {
    return "user";
  }

  if (targetType === "intent") {
    return "Intent";
  }

  if (targetType === "plan") {
    return "Plan";
  }

  if (targetType === "message") {
    return "message";
  }

  return "request";
}

function getButtonClasses(
  variant: ReportButtonVariant
) {
  if (variant === "compact") {
    return "rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-600 transition hover:border-red-300 hover:bg-red-50 hover:text-red-700";
  }

  if (variant === "danger") {
    return "rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 transition hover:border-red-300 hover:bg-red-100";
  }

  if (variant === "menu") {
    return "w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-gray-700 transition hover:bg-red-50 hover:text-red-700";
  }

  return "rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-600 transition hover:border-red-300 hover:bg-red-50 hover:text-red-700";
}

export default function ReportButton({
  targetType,
  targetId,
  targetLabel,
  buttonLabel = "Report",
  variant = "default",
  className = "",
}: ReportButtonProps) {
  const titleId =
    useId();

  const descriptionId =
    useId();

  const [
    isOpen,
    setIsOpen,
  ] = useState(false);

  const [
    reason,
    setReason,
  ] =
    useState<ReportReason>(
      "other"
    );

  const [
    details,
    setDetails,
  ] = useState("");

  const [
    isSubmitting,
    setIsSubmitting,
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const [
    successMessage,
    setSuccessMessage,
  ] = useState("");

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousOverflow =
      document.body.style
        .overflow;

    document.body.style.overflow =
      "hidden";

    function handleKeyDown(
      event: KeyboardEvent
    ) {
      if (
        event.key === "Escape" &&
        !isSubmitting
      ) {
        closeModal();
      }
    }

    window.addEventListener(
      "keydown",
      handleKeyDown
    );

    return () => {
      document.body.style.overflow =
        previousOverflow;

      window.removeEventListener(
        "keydown",
        handleKeyDown
      );
    };
  }, [
    isOpen,
    isSubmitting,
  ]);

  function openModal() {
    setErrorMessage("");
    setSuccessMessage("");
    setIsOpen(true);
  }

  function closeModal() {
    if (isSubmitting) {
      return;
    }

    setIsOpen(false);
    setReason("other");
    setDetails("");
    setErrorMessage("");
    setSuccessMessage("");
  }

  async function submitReport(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setErrorMessage("");
    setSuccessMessage("");

    const cleanedDetails =
      details.trim();

    if (
      cleanedDetails.length >
      4000
    ) {
      setErrorMessage(
        "Report details cannot exceed 4000 characters."
      );

      return;
    }

    setIsSubmitting(true);

    try {
      const {
        data,
        error,
      } = await supabase.rpc(
        "create_moderation_report",
        {
          p_target_type:
            targetType,
          p_target_id:
            targetId,
          p_reason:
            reason,
          p_details:
            cleanedDetails ||
            null,
        }
      );

      if (error) {
        throw error;
      }

      if (!data) {
        throw new Error(
          "The report could not be created."
        );
      }

      setSuccessMessage(
        "Your report was submitted for review."
      );

      setDetails("");
    } catch (error) {
      setErrorMessage(
        getErrorMessage(error)
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className={`${getButtonClasses(
          variant
        )} ${className}`}
      >
        {buttonLabel}
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 px-4 py-8"
          role="presentation"
          onMouseDown={(event) => {
            if (
              event.target ===
                event.currentTarget &&
              !isSubmitting
            ) {
              closeModal();
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={
              titleId
            }
            aria-describedby={
              descriptionId
            }
            className="max-h-full w-full max-w-xl overflow-y-auto rounded-3xl border border-gray-200 bg-white p-6 shadow-2xl md:p-8"
          >
            <div className="flex items-start justify-between gap-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-red-600">
                  Safety Report
                </p>

                <h2
                  id={titleId}
                  className="mt-2 text-2xl font-bold text-gray-950"
                >
                  Report this{" "}
                  {getTargetTypeLabel(
                    targetType
                  )}
                </h2>

                <p
                  id={
                    descriptionId
                  }
                  className="mt-3 text-sm leading-6 text-gray-500"
                >
                  Reports are reviewed
                  by the UIN moderation
                  team. The reported
                  person will not be told
                  who submitted the
                  report.
                </p>
              </div>

              <button
                type="button"
                onClick={closeModal}
                disabled={
                  isSubmitting
                }
                aria-label="Close report form"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-gray-200 text-xl text-gray-500 transition hover:border-gray-300 hover:bg-gray-50 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-50"
              >
                ×
              </button>
            </div>

            <div className="mt-6 rounded-2xl bg-gray-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                Reported Content
              </p>

              <p className="mt-2 break-words font-semibold text-gray-900">
                {targetLabel}
              </p>

              <p className="mt-2 break-all font-mono text-xs text-gray-400">
                {targetType} ·{" "}
                {targetId}
              </p>
            </div>

            {successMessage ? (
              <div className="mt-6">
                <div className="rounded-2xl border border-green-200 bg-green-50 p-5">
                  <p className="font-semibold text-green-800">
                    Report submitted
                  </p>

                  <p className="mt-2 text-sm leading-6 text-green-700">
                    {successMessage}
                  </p>
                </div>

                <div className="mt-6 flex justify-end">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="rounded-xl bg-gray-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-gray-800"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : (
              <form
                onSubmit={
                  submitReport
                }
                className="mt-6"
              >
                <div>
                  <label
                    htmlFor={`report-reason-${titleId}`}
                    className="block text-sm font-semibold text-gray-800"
                  >
                    Why are you reporting
                    this?
                  </label>

                  <select
                    id={`report-reason-${titleId}`}
                    value={reason}
                    onChange={(
                      event
                    ) =>
                      setReason(
                        event.target
                          .value as ReportReason
                      )
                    }
                    disabled={
                      isSubmitting
                    }
                    className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100 disabled:cursor-not-allowed disabled:bg-gray-100"
                  >
                    <option value="spam">
                      Spam
                    </option>

                    <option value="harassment">
                      Harassment
                    </option>

                    <option value="hate_or_abuse">
                      Hate or Abuse
                    </option>

                    <option value="sexual_content">
                      Sexual Content
                    </option>

                    <option value="violence_or_threat">
                      Violence or Threat
                    </option>

                    <option value="fraud_or_scam">
                      Fraud or Scam
                    </option>

                    <option value="privacy">
                      Privacy Violation
                    </option>

                    <option value="impersonation">
                      Impersonation
                    </option>

                    <option value="child_safety">
                      Child Safety
                    </option>

                    <option value="self_harm">
                      Self-Harm Concern
                    </option>

                    <option value="illegal_activity">
                      Illegal Activity
                    </option>

                    <option value="other">
                      Other
                    </option>
                  </select>
                </div>

                <div className="mt-5">
                  <label
                    htmlFor={`report-details-${titleId}`}
                    className="block text-sm font-semibold text-gray-800"
                  >
                    Additional details
                  </label>

                  <textarea
                    id={`report-details-${titleId}`}
                    value={details}
                    onChange={(
                      event
                    ) =>
                      setDetails(
                        event.target
                          .value
                      )
                    }
                    disabled={
                      isSubmitting
                    }
                    maxLength={4000}
                    rows={6}
                    placeholder="Describe what happened and include any context that may help the moderation team."
                    className="mt-2 w-full resize-y rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm leading-6 text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-red-500 focus:ring-2 focus:ring-red-100 disabled:cursor-not-allowed disabled:bg-gray-100"
                  />

                  <div className="mt-2 flex items-center justify-between gap-3">
                    <p className="text-xs text-gray-500">
                      Optional
                    </p>

                    <p className="text-xs text-gray-500">
                      {details.length}
                      /4000
                    </p>
                  </div>
                </div>

                {errorMessage && (
                  <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4">
                    <p className="text-sm font-semibold text-red-800">
                      {errorMessage}
                    </p>
                  </div>
                )}

                <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={closeModal}
                    disabled={
                      isSubmitting
                    }
                    className="rounded-xl border border-gray-200 bg-white px-6 py-3 text-sm font-semibold text-gray-700 transition hover:border-gray-300 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={
                      isSubmitting
                    }
                    className="rounded-xl bg-red-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isSubmitting
                      ? "Submitting..."
                      : "Submit Report"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}