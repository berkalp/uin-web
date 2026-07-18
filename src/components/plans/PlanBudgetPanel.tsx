"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";

import {
  updateMyPlanBudgetCommitment,
  updatePlanTargetBudget,
} from "@/services/planBudgetService";

type PlanStatus =
  | "forming"
  | "planned"
  | "completed"
  | "cancelled";

type PlanBudgetPanelProps = {
  planId: string;
  planStatus: PlanStatus;
  isHost: boolean;
  isActiveMember: boolean;
  initialTargetBudget: number | null;
  initialCommittedBudget: number;
  initialActualBudget: number;
  initialMyCommitment: number;
  initialActiveMemberCount: number;
  initialAttendedMemberCount: number;
};

function formatBudget(
  value: number
) {
  return new Intl.NumberFormat(
    "en-US",
    {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }
  ).format(value);
}

function parseBudgetInput(
  value: string
) {
  if (value.trim() === "") {
    return null;
  }

  const parsedValue =
    Number(value);

  if (
    !Number.isFinite(
      parsedValue
    ) ||
    parsedValue < 0
  ) {
    return Number.NaN;
  }

  return parsedValue;
}

export default function PlanBudgetPanel({
  planId,
  planStatus,
  isHost,
  isActiveMember,
  initialTargetBudget,
  initialCommittedBudget,
  initialActualBudget,
  initialMyCommitment,
  initialActiveMemberCount,
  initialAttendedMemberCount,
}: PlanBudgetPanelProps) {
  const router = useRouter();

  const [
    targetBudgetInput,
    setTargetBudgetInput,
  ] = useState(
    initialTargetBudget === null
      ? ""
      : String(
          initialTargetBudget
        )
  );

  const [
    commitmentInput,
    setCommitmentInput,
  ] = useState(
    String(
      initialMyCommitment
    )
  );

  const [isSaving, setIsSaving] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);

  const [
    successMessage,
    setSuccessMessage,
  ] = useState<string | null>(null);

  useEffect(() => {
    setTargetBudgetInput(
      initialTargetBudget === null
        ? ""
        : String(
            initialTargetBudget
          )
    );
  }, [initialTargetBudget]);

  useEffect(() => {
    setCommitmentInput(
      String(
        initialMyCommitment
      )
    );
  }, [initialMyCommitment]);

  const canEditTarget =
    isHost &&
    planStatus === "forming";

  const canEditCommitment =
    isActiveMember &&
    (
      planStatus === "forming" ||
      planStatus === "planned"
    );

  const parsedTargetBudget =
    useMemo(
      () =>
        parseBudgetInput(
          targetBudgetInput
        ),
      [targetBudgetInput]
    );

  const parsedCommitment =
    useMemo(
      () =>
        parseBudgetInput(
          commitmentInput
        ),
      [commitmentInput]
    );

  const previewTargetBudget =
    canEditTarget
      ? (
          Number.isNaN(
            parsedTargetBudget
          )
            ? initialTargetBudget
            : parsedTargetBudget
        )
      : initialTargetBudget;

  const previewMyCommitment =
    canEditCommitment &&
    parsedCommitment !== null &&
    !Number.isNaN(
      parsedCommitment
    )
      ? parsedCommitment
      : initialMyCommitment;

  const previewCommittedBudget =
    Math.max(
      0,
      initialCommittedBudget -
        initialMyCommitment +
        previewMyCommitment
    );

  const progressPercent =
    previewTargetBudget !== null &&
    previewTargetBudget > 0
      ? (
          previewCommittedBudget /
          previewTargetBudget
        ) * 100
      : null;

  const displayedProgress =
    progressPercent === null
      ? null
      : Math.round(
          progressPercent * 10
        ) / 10;

  const progressBarWidth =
    progressPercent === null
      ? 0
      : Math.min(
          Math.max(
            progressPercent,
            0
          ),
          100
        );

  const remainingBudget =
    previewTargetBudget === null
      ? null
      : Math.max(
          previewTargetBudget -
            previewCommittedBudget,
          0
        );

  const aboveTargetBudget =
    previewTargetBudget === null
      ? 0
      : Math.max(
          previewCommittedBudget -
            previewTargetBudget,
          0
        );

  const showActualBudget =
    planStatus === "completed" ||
    initialActualBudget > 0;

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setErrorMessage(null);
    setSuccessMessage(null);

    const targetBudget =
      parseBudgetInput(
        targetBudgetInput
      );

    const commitment =
      parseBudgetInput(
        commitmentInput
      );

    if (
      canEditTarget &&
      Number.isNaN(
        targetBudget
      )
    ) {
      setErrorMessage(
        "Enter a valid target budget."
      );

      return;
    }

    if (
      canEditCommitment &&
      (
        commitment === null ||
        Number.isNaN(
          commitment
        )
      )
    ) {
      setErrorMessage(
        "Enter a valid budget commitment."
      );

      return;
    }

    const targetChanged =
      canEditTarget &&
      targetBudget !==
        initialTargetBudget;

    const commitmentChanged =
      canEditCommitment &&
      commitment !==
        initialMyCommitment;

    if (
      !targetChanged &&
      !commitmentChanged
    ) {
      setSuccessMessage(
        "No budget changes to save."
      );

      return;
    }

    try {
      setIsSaving(true);

      if (targetChanged) {
        await updatePlanTargetBudget(
          planId,
          targetBudget
        );
      }

      if (
        commitmentChanged &&
        commitment !== null
      ) {
        await updateMyPlanBudgetCommitment(
          planId,
          commitment
        );
      }

      setSuccessMessage(
        "Activity budget updated."
      );

      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "The Activity budget could not be updated."
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="rounded-3xl border border-emerald-100 bg-white p-5 shadow-sm md:p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
            Activity Budget
          </p>

          <h2 className="mt-1 text-2xl font-bold text-gray-900">
            Budget Progress
          </h2>

          <p className="mt-2 text-sm text-gray-500">
            Member commitments are estimates,
            not collected payments.
          </p>
        </div>

        <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <p className="font-semibold">
            {initialActiveMemberCount} active{" "}
            {initialActiveMemberCount === 1
              ? "member"
              : "members"}
          </p>

          {showActualBudget && (
            <p className="mt-1">
              {initialAttendedMemberCount} attended
            </p>
          )}
        </div>
      </div>

      <div
        className={`mt-6 grid grid-cols-1 gap-3 ${
          showActualBudget
            ? "md:grid-cols-4"
            : "md:grid-cols-3"
        }`}
      >
        <div className="rounded-2xl bg-gray-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Target Budget
          </p>

          <p className="mt-2 text-2xl font-bold text-gray-900">
            {previewTargetBudget === null
              ? "Not set"
              : `${formatBudget(
                  previewTargetBudget
                )} TL`}
          </p>
        </div>

        <div className="rounded-2xl bg-emerald-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
            Committed Budget
          </p>

          <p className="mt-2 text-2xl font-bold text-gray-900">
            {formatBudget(
              previewCommittedBudget
            )}{" "}
            TL
          </p>
        </div>

        <div className="rounded-2xl bg-amber-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
            {aboveTargetBudget > 0
              ? "Above Target"
              : "Remaining"}
          </p>

          <p className="mt-2 text-2xl font-bold text-gray-900">
            {previewTargetBudget === null
              ? "Not available"
              : `${formatBudget(
                  aboveTargetBudget > 0
                    ? aboveTargetBudget
                    : remainingBudget ?? 0
                )} TL`}
          </p>
        </div>

        {showActualBudget && (
          <div className="rounded-2xl bg-purple-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-purple-700">
              Actual Budget
            </p>

            <p className="mt-2 text-2xl font-bold text-gray-900">
              {formatBudget(
                initialActualBudget
              )}{" "}
              TL
            </p>
          </div>
        )}
      </div>

      <div className="mt-5 rounded-2xl border border-gray-100 bg-gray-50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-gray-700">
            {previewTargetBudget === null
              ? "Set a target budget to track progress."
              : `${formatBudget(
                  previewCommittedBudget
                )} TL of ${formatBudget(
                  previewTargetBudget
                )} TL committed`}
          </p>

          {displayedProgress !== null && (
            <p className="text-sm font-bold text-emerald-700">
              {displayedProgress}%
            </p>
          )}
        </div>

        <div className="mt-3 h-3 overflow-hidden rounded-full bg-gray-200">
          <div
            className="h-full rounded-full bg-emerald-600 transition-all duration-300"
            style={{
              width: `${progressBarWidth}%`,
            }}
          />
        </div>

        {aboveTargetBudget > 0 && (
          <p className="mt-3 text-sm font-semibold text-emerald-700">
            The committed budget is{" "}
            {formatBudget(
              aboveTargetBudget
            )}{" "}
            TL above the target.
          </p>
        )}
      </div>

      {(canEditTarget ||
        canEditCommitment) && (
        <form
          onSubmit={handleSubmit}
          className="mt-6 border-t border-gray-100 pt-5"
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label
                htmlFor={`target-budget-${planId}`}
                className="text-sm font-semibold text-gray-700"
              >
                Target Budget
              </label>

              <input
                id={`target-budget-${planId}`}
                type="number"
                min="0"
                step="0.01"
                value={targetBudgetInput}
                onChange={(event) =>
                  setTargetBudgetInput(
                    event.target.value
                  )
                }
                disabled={!canEditTarget}
                placeholder="Optional"
                className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500"
              />

              <p className="mt-2 text-xs text-gray-500">
                {canEditTarget
                  ? "Only the host can set this during planning."
                  : "The target budget is locked after schedule confirmation."}
              </p>
            </div>

            <div>
              <label
                htmlFor={`my-commitment-${planId}`}
                className="text-sm font-semibold text-gray-700"
              >
                My Commitment
              </label>

              <input
                id={`my-commitment-${planId}`}
                type="number"
                min="0"
                step="0.01"
                value={commitmentInput}
                onChange={(event) =>
                  setCommitmentInput(
                    event.target.value
                  )
                }
                disabled={!canEditCommitment}
                required={
                  canEditCommitment
                }
                className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500"
              />

              <p className="mt-2 text-xs text-gray-500">
                Your estimated contribution to
                this Activity.
              </p>
            </div>
          </div>

          {errorMessage && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              {errorMessage}
            </div>
          )}

          {successMessage && (
            <div className="mt-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-700">
              {successMessage}
            </div>
          )}

          <button
            type="submit"
            disabled={isSaving}
            className="mt-5 w-full rounded-xl bg-emerald-600 px-5 py-3 font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving
              ? "Saving Budget..."
              : "Save Budget Settings"}
          </button>
        </form>
      )}

      {!canEditTarget &&
        !canEditCommitment && (
          <div className="mt-5 rounded-xl bg-gray-50 px-4 py-3 text-center text-sm text-gray-500">
            Budget settings are read-only in the
            current Activity state.
          </div>
        )}
    </section>
  );
}