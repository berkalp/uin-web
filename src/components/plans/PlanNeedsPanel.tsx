"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  createPlanNeed,
  deletePlanNeed,
  getPlanNeeds,
  setMyPlanNeedContribution,
  updatePlanNeed,
  withdrawMyPlanNeedContribution,
  type PlanNeed,
  type PlanNeedFulfillmentMode,
  type PlanNeedImportance,
} from "@/services/planNeedsService";

type PlanStatus =
  | "forming"
  | "planned"
  | "completed"
  | "cancelled";

type PlanNeedsPanelProps = {
  planId: string;
  planStatus: PlanStatus;
  canManage: boolean;
  canContribute: boolean;
  readOnly: boolean;
};

type NeedDraft = {
  need: string;
  quantity: string;
  importance: PlanNeedImportance;
  fulfillmentMode: PlanNeedFulfillmentMode;
};

const EMPTY_DRAFT: NeedDraft = {
  need: "",
  quantity: "",
  importance: "required",
  fulfillmentMode: "shared",
};

function parseOptionalQuantity(
  value: string
) {
  if (!value.trim()) {
    return null;
  }

  const parsed = Number(value);

  if (
    !Number.isInteger(parsed) ||
    parsed < 1 ||
    parsed > 100000
  ) {
    return Number.NaN;
  }

  return parsed;
}

function getContributorName(
  contributor: PlanNeed["contributors"][number]
) {
  return (
    contributor.fullName ||
    contributor.username ||
    "UIN member"
  );
}

function getProgress(
  need: PlanNeed
) {
  if (
    need.fulfillmentMode ===
    "per_participant"
  ) {
    if (
      need.importance ===
      "optional"
    ) {
      return null;
    }

    if (
      need.activeParticipantCount < 1
    ) {
      return 0;
    }

    return Math.min(
      100,
      Math.max(
        0,
        Math.round(
          (
            need.contributorCount /
            need.activeParticipantCount
          ) * 100
        )
      )
    );
  }

  return Math.min(
    100,
    Math.max(
      0,
      Math.round(
        (
          need.contributedQuantity /
          need.quantity
        ) * 100
      )
    )
  );
}

function getPeopleSummary(
  need: PlanNeed
) {
  if (
    need.importance ===
    "optional"
  ) {
    return need.contributorCount === 1
      ? "1 person will bring this"
      : `${need.contributorCount} people will bring this`;
  }

  if (need.isFulfilled) {
    return "Everyone is ready";
  }

  return need.remainingParticipantCount === 1
    ? "1 person still needs to confirm"
    : `${need.remainingParticipantCount} people still need to confirm`;
}

export default function PlanNeedsPanel({
  planId,
  planStatus,
  canManage,
  canContribute,
  readOnly,
}: PlanNeedsPanelProps) {
  const [needs, setNeeds] =
    useState<PlanNeed[]>([]);

  const [isLoading, setIsLoading] =
    useState(true);

  const [isCreateOpen, setIsCreateOpen] =
    useState(false);

  const [createDraft, setCreateDraft] =
    useState<NeedDraft>(EMPTY_DRAFT);

  const [editingNeedId, setEditingNeedId] =
    useState<string | null>(null);

  const [editDraft, setEditDraft] =
    useState<NeedDraft>(EMPTY_DRAFT);

  const [contributionNeedId, setContributionNeedId] =
    useState<string | null>(null);

  const [deleteConfirmNeedId, setDeleteConfirmNeedId] =
    useState<string | null>(null);

  const [contributionQuantity, setContributionQuantity] =
    useState("1");

  const [workingKey, setWorkingKey] =
    useState<string | null>(null);

  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);

  const [successMessage, setSuccessMessage] =
    useState<string | null>(null);

  const loadNeeds = useCallback(
    async () => {
      setErrorMessage(null);

      try {
        const loadedNeeds =
          await getPlanNeeds(planId);

        setNeeds(loadedNeeds);
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Plan needs could not be loaded."
        );
      } finally {
        setIsLoading(false);
      }
    },
    [planId]
  );

  useEffect(() => {
    loadNeeds();
  }, [loadNeeds]);

  useEffect(() => {
    const handleExternalChange = (event: Event) => {
      const customEvent = event as CustomEvent<{ planId?: string }>;
      if (customEvent.detail?.planId === planId) {
        void loadNeeds();
      }
    };

    window.addEventListener("uin:plan-needs-changed", handleExternalChange);
    return () => window.removeEventListener("uin:plan-needs-changed", handleExternalChange);
  }, [loadNeeds, planId]);

  const requiredNeeds = useMemo(
    () =>
      needs.filter(
        (need) =>
          need.importance ===
          "required"
      ),
    [needs]
  );

  const optionalNeeds = useMemo(
    () =>
      needs.filter(
        (need) =>
          need.importance ===
          "optional"
      ),
    [needs]
  );

  function clearMessages() {
    setErrorMessage(null);
    setSuccessMessage(null);
  }

  function closeEditors() {
    setEditingNeedId(null);
    setContributionNeedId(null);
    setDeleteConfirmNeedId(null);
  }

  async function handleCreate(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    clearMessages();

    const quantity =
      parseOptionalQuantity(
        createDraft.quantity
      );

    if (Number.isNaN(quantity)) {
      setErrorMessage(
        "Quantity must be a whole number between 1 and 100000."
      );
      return;
    }

    try {
      setWorkingKey("create");

      await createPlanNeed({
        planId,
        need: createDraft.need,
        quantity,
        importance:
          createDraft.importance,
        fulfillmentMode:
          createDraft.fulfillmentMode,
      });

      setCreateDraft(EMPTY_DRAFT);
      setIsCreateOpen(false);
      setSuccessMessage(
        "Need added to the Plan."
      );
      await loadNeeds();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "The Need could not be created."
      );
    } finally {
      setWorkingKey(null);
    }
  }

  function startEditing(
    need: PlanNeed
  ) {
    clearMessages();
    closeEditors();
    setEditingNeedId(need.id);
    setEditDraft({
      need: need.need,
      quantity: String(need.quantity),
      importance: need.importance,
      fulfillmentMode:
        need.fulfillmentMode,
    });
  }

  async function handleUpdate(
    event: FormEvent<HTMLFormElement>,
    need: PlanNeed
  ) {
    event.preventDefault();
    clearMessages();

    const quantity =
      parseOptionalQuantity(
        editDraft.quantity
      );

    if (Number.isNaN(quantity)) {
      setErrorMessage(
        "Quantity must be a whole number between 1 and 100000."
      );
      return;
    }

    try {
      setWorkingKey(
        `edit:${need.id}`
      );

      await updatePlanNeed({
        needId: need.id,
        need: editDraft.need,
        quantity,
        importance:
          editDraft.importance,
        fulfillmentMode:
          editDraft.fulfillmentMode,
      });

      setEditingNeedId(null);
      setSuccessMessage(
        "Need updated."
      );
      await loadNeeds();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "The Need could not be updated."
      );
    } finally {
      setWorkingKey(null);
    }
  }

  async function handleDelete(
    need: PlanNeed
  ) {
    clearMessages();

    try {
      setWorkingKey(
        `delete:${need.id}`
      );

      await deletePlanNeed(
        need.id
      );

      setDeleteConfirmNeedId(null);
      setSuccessMessage(
        "Need deleted."
      );
      await loadNeeds();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "The Need could not be deleted."
      );
    } finally {
      setWorkingKey(null);
    }
  }

  function openContribution(
    need: PlanNeed
  ) {
    clearMessages();
    closeEditors();
    setContributionNeedId(
      need.id
    );
    setContributionQuantity(
      String(
        need.viewerQuantity > 0
          ? need.viewerQuantity
          : 1
      )
    );
  }

  async function saveContribution(
    need: PlanNeed,
    quantityOverride?: number
  ) {
    clearMessages();

    const isPerParticipant =
      need.fulfillmentMode ===
      "per_participant";

    const parsedQuantity =
      isPerParticipant
        ? need.quantity
        : quantityOverride ??
          Number(
            contributionQuantity
          );

    const maximumQuantity =
      need.remainingQuantity +
      need.viewerQuantity;

    if (
      !Number.isInteger(
        parsedQuantity
      ) ||
      parsedQuantity < 1 ||
      (
        !isPerParticipant &&
        parsedQuantity >
          maximumQuantity
      )
    ) {
      setErrorMessage(
        `Enter a whole number between 1 and ${maximumQuantity}.`
      );
      return;
    }

    try {
      setWorkingKey(
        `contribute:${need.id}`
      );

      await setMyPlanNeedContribution({
        needId: need.id,
        quantity: parsedQuantity,
      });

      setContributionNeedId(null);
      setSuccessMessage(
        "Your contribution was saved."
      );
      await loadNeeds();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Your contribution could not be saved."
      );
    } finally {
      setWorkingKey(null);
    }
  }

  async function withdrawContribution(
    need: PlanNeed
  ) {
    clearMessages();

    try {
      setWorkingKey(
        `withdraw:${need.id}`
      );

      await withdrawMyPlanNeedContribution(
        need.id
      );

      setContributionNeedId(null);
      setSuccessMessage(
        "Your contribution was withdrawn."
      );
      await loadNeeds();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Your contribution could not be withdrawn."
      );
    } finally {
      setWorkingKey(null);
    }
  }

  function renderModePicker(
    draft: NeedDraft,
    setDraft: (
      updater: (
        current: NeedDraft
      ) => NeedDraft
    ) => void,
    disabled = false
  ) {
    const modes = [
      {
        value: "shared" as const,
        title: "Shared need",
        description:
          "One or more participants can cover the total quantity.",
      },
      {
        value:
          "per_participant" as const,
        title: "Every participant",
        description:
          "Each active participant confirms this separately.",
      },
    ];

    return (
      <fieldset>
        <legend className="text-xs font-semibold uppercase tracking-wide text-cyan-800">
          Who should bring it?
        </legend>

        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          {modes.map((mode) => (
            <button
              key={mode.value}
              type="button"
              disabled={disabled}
              onClick={() =>
                setDraft(
                  (current) => ({
                    ...current,
                    fulfillmentMode:
                      mode.value,
                  })
                )
              }
              className={`rounded-2xl border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${
                draft.fulfillmentMode ===
                mode.value
                  ? "border-cyan-600 bg-cyan-600 text-white"
                  : "border-cyan-200 bg-white text-cyan-950 hover:bg-cyan-50"
              }`}
            >
              <span className="block text-sm font-bold">
                {mode.title}
              </span>
              <span
                className={`mt-1 block text-xs leading-5 ${
                  draft.fulfillmentMode ===
                  mode.value
                    ? "text-cyan-50"
                    : "text-cyan-700"
                }`}
              >
                {mode.description}
              </span>
            </button>
          ))}
        </div>
      </fieldset>
    );
  }

  function renderImportancePicker(
    draft: NeedDraft,
    setDraft: (
      updater: (
        current: NeedDraft
      ) => NeedDraft
    ) => void
  ) {
    return (
      <div className="flex flex-wrap gap-2">
        {(
          [
            "required",
            "optional",
          ] as const
        ).map((importance) => (
          <button
            key={importance}
            type="button"
            onClick={() =>
              setDraft(
                (current) => ({
                  ...current,
                  importance,
                })
              )
            }
            className={`rounded-xl border px-4 py-2 text-sm font-semibold transition ${
              draft.importance ===
              importance
                ? "border-cyan-600 bg-cyan-600 text-white"
                : "border-cyan-200 bg-white text-cyan-800 hover:bg-cyan-50"
            }`}
          >
            {importance ===
            "required"
              ? "Required"
              : "Optional"}
          </button>
        ))}
      </div>
    );
  }

  function renderNeed(
    need: PlanNeed
  ) {
    const progress =
      getProgress(need);

    const isEditing =
      editingNeedId ===
      need.id;

    const isContributing =
      contributionNeedId ===
      need.id;

    const isPerParticipant =
      need.fulfillmentMode ===
      "per_participant";

    const maximumContribution =
      need.remainingQuantity +
      need.viewerQuantity;

    const canTakeNeed =
      canContribute &&
      !readOnly &&
      (
        isPerParticipant ||
        !need.isFulfilled ||
        need.viewerQuantity > 0
      );

    const cardIsComplete =
      need.isFulfilled &&
      !(
        isPerParticipant &&
        need.importance ===
          "optional"
      );

    return (
      <article
        key={need.id}
        className={`rounded-2xl border p-4 transition ${
          cardIsComplete
            ? "border-green-200 bg-green-50/70"
            : "border-gray-200 bg-white"
        }`}
      >
        {isEditing ? (
          <form
            onSubmit={(event) =>
              handleUpdate(
                event,
                need
              )
            }
            className="space-y-4"
          >
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_170px]">
              <label>
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Need
                </span>
                <input
                  value={editDraft.need}
                  onChange={(event) =>
                    setEditDraft(
                      (current) => ({
                        ...current,
                        need:
                          event.target.value,
                      })
                    )
                  }
                  maxLength={160}
                  required
                  className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-100"
                />
              </label>

              <label>
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  {editDraft.fulfillmentMode ===
                  "per_participant"
                    ? "Per-person quantity"
                    : "Total quantity"}
                </span>
                <input
                  type="number"
                  min="1"
                  max="100000"
                  step="1"
                  value={editDraft.quantity}
                  onChange={(event) =>
                    setEditDraft(
                      (current) => ({
                        ...current,
                        quantity:
                          event.target.value,
                      })
                    )
                  }
                  disabled={
                    need.contributorCount >
                    0
                  }
                  className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-100 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500"
                />
              </label>
            </div>

            {renderModePicker(
              editDraft,
              setEditDraft,
              need.contributorCount > 0
            )}

            {need.contributorCount > 0 && (
              <p className="text-xs font-semibold text-amber-700">
                Quantity and fulfillment type cannot be changed after contributions begin.
              </p>
            )}

            {renderImportancePicker(
              editDraft,
              setEditDraft
            )}

            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() =>
                  setEditingNeedId(null)
                }
                disabled={
                  workingKey ===
                  `edit:${need.id}`
                }
                className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={
                  workingKey ===
                  `edit:${need.id}`
                }
                className="rounded-xl bg-gray-950 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {workingKey ===
                `edit:${need.id}`
                  ? "Saving..."
                  : "Save Need"}
              </button>
            </div>
          </form>
        ) : (
          <>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="break-words text-lg font-bold text-gray-950">
                    {need.need}
                  </h4>

                  <span
                    className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
                      isPerParticipant
                        ? "bg-violet-100 text-violet-700"
                        : "bg-cyan-100 text-cyan-700"
                    }`}
                  >
                    {isPerParticipant
                      ? "Every participant"
                      : "Shared"}
                  </span>

                  {cardIsComplete && (
                    <span className="rounded-full bg-green-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-green-700">
                      Fulfilled
                    </span>
                  )}
                </div>

                {isPerParticipant ? (
                  <div className="mt-2">
                    <p className="font-semibold text-gray-700">
                      {need.importance ===
                      "required"
                        ? `${need.contributorCount} / ${need.activeParticipantCount} people`
                        : getPeopleSummary(
                            need
                          )}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      Each participant brings {need.quantity}
                    </p>
                    {need.importance ===
                      "required" && (
                      <p
                        className={`mt-1 text-xs font-semibold ${
                          need.isFulfilled
                            ? "text-green-700"
                            : "text-amber-700"
                        }`}
                      >
                        {getPeopleSummary(
                          need
                        )}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="mt-2 font-semibold text-gray-700">
                    {need.contributedQuantity} / {need.quantity}
                  </p>
                )}
              </div>

              {canManage &&
                !readOnly && (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      startEditing(
                        need
                      )
                    }
                    className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 transition hover:bg-gray-50"
                  >
                    Edit
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      clearMessages();
                      setDeleteConfirmNeedId(
                        need.id
                      );
                      setEditingNeedId(null);
                      setContributionNeedId(null);
                    }}
                    disabled={
                      need.contributorCount >
                      0
                    }
                    title={
                      need.contributorCount >
                      0
                        ? "A Need with contributions cannot be deleted."
                        : undefined
                    }
                    className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>

            {progress !== null && (
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-gray-100">
                <div
                  className={`h-full rounded-full transition-all ${
                    cardIsComplete
                      ? "bg-green-600"
                      : need.importance ===
                          "required"
                        ? "bg-amber-500"
                        : "bg-blue-500"
                  }`}
                  style={{
                    width: `${progress}%`,
                  }}
                />
              </div>
            )}

            {need.contributors.length > 0 && (
              <div className="mt-4">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                  Who is bringing this
                </p>

                <div className="mt-2 flex flex-wrap gap-2">
                  {need.contributors.map(
                    (contributor) => (
                      <span
                        key={
                          contributor.userId
                        }
                        className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-semibold text-gray-700"
                      >
                        {contributor.avatarUrl ? (
                          <img
                            src={
                              contributor.avatarUrl
                            }
                            alt=""
                            className="h-5 w-5 rounded-full object-cover"
                          />
                        ) : (
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-[9px] font-bold text-gray-500">
                            {getContributorName(
                              contributor
                            )
                              .charAt(0)
                              .toUpperCase()}
                          </span>
                        )}

                        <span>
                          {getContributorName(
                            contributor
                          )}
                          {!isPerParticipant &&
                          need.quantity > 1
                            ? ` · ${contributor.quantity}`
                            : ""}
                        </span>
                      </span>
                    )
                  )}
                </div>
              </div>
            )}

            {deleteConfirmNeedId ===
              need.id &&
              canManage &&
              !readOnly && (
              <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4">
                <p className="font-bold text-red-900">
                  Delete this Need?
                </p>

                <p className="mt-1 text-sm text-red-700">
                  This action cannot be undone.
                </p>

                <div className="mt-4 flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setDeleteConfirmNeedId(
                        null
                      )
                    }
                    disabled={
                      workingKey ===
                      `delete:${need.id}`
                    }
                    className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      handleDelete(
                        need
                      )
                    }
                    disabled={
                      workingKey ===
                      `delete:${need.id}`
                    }
                    className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
                  >
                    {workingKey ===
                    `delete:${need.id}`
                      ? "Deleting..."
                      : "Delete Need"}
                  </button>
                </div>
              </div>
            )}

            {isContributing &&
              canTakeNeed && (
              <div className="mt-4 rounded-2xl border border-green-100 bg-green-50 p-4">
                {!isPerParticipant &&
                  need.quantity > 1 && (
                  <label className="block">
                    <span className="text-xs font-semibold uppercase tracking-wide text-green-800">
                      Quantity you will bring
                    </span>

                    <input
                      type="number"
                      min="1"
                      max={
                        maximumContribution
                      }
                      step="1"
                      value={
                        contributionQuantity
                      }
                      onChange={(event) =>
                        setContributionQuantity(
                          event.target.value
                        )
                      }
                      className="mt-2 w-full rounded-xl border border-green-200 bg-white px-4 py-3 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
                    />

                    <p className="mt-2 text-xs text-green-800">
                      {maximumContribution} available to you, including your current contribution.
                    </p>
                  </label>
                )}

                {isPerParticipant && (
                  <p className="text-sm font-semibold text-green-900">
                    You’ll bring {need.quantity}
                  </p>
                )}

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      saveContribution(
                        need,
                        !isPerParticipant &&
                        need.quantity === 1
                          ? 1
                          : undefined
                      )
                    }
                    disabled={
                      workingKey ===
                      `contribute:${need.id}`
                    }
                    className="flex-1 rounded-xl bg-green-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-green-700 disabled:opacity-50"
                  >
                    {workingKey ===
                    `contribute:${need.id}`
                      ? "Saving..."
                      : need.viewerQuantity > 0
                        ? "Update contribution"
                        : "I’ll bring this"}
                  </button>

                  {need.viewerQuantity > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        withdrawContribution(
                          need
                        )
                      }
                      disabled={
                        workingKey ===
                        `withdraw:${need.id}`
                      }
                      className="rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-50"
                    >
                      {workingKey ===
                      `withdraw:${need.id}`
                        ? "Withdrawing..."
                        : "Withdraw"}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() =>
                      setContributionNeedId(
                        null
                      )
                    }
                    className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {!isContributing &&
              canContribute &&
              !readOnly && (
              <div className="mt-4 flex flex-wrap gap-2">
                {isPerParticipant &&
                need.viewerQuantity > 0 ? (
                  <span className="flex-1 rounded-xl border border-green-200 bg-green-50 px-4 py-2.5 text-center text-sm font-semibold text-green-800">
                    You’ll bring {need.quantity}
                  </span>
                ) : !isPerParticipant &&
                  need.isFulfilled &&
                  need.viewerQuantity === 0 ? (
                  <span className="flex-1 rounded-xl bg-green-100 px-4 py-2.5 text-center text-sm font-semibold text-green-800">
                    Covered
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      if (
                        isPerParticipant
                      ) {
                        saveContribution(
                          need,
                          need.quantity
                        );
                        return;
                      }

                      if (
                        need.quantity ===
                          1 &&
                        need.viewerQuantity ===
                          0
                      ) {
                        saveContribution(
                          need,
                          1
                        );
                        return;
                      }

                      openContribution(
                        need
                      );
                    }}
                    disabled={
                      workingKey ===
                      `contribute:${need.id}`
                    }
                    className="flex-1 rounded-xl border border-green-200 bg-green-50 px-4 py-2.5 text-sm font-semibold text-green-800 transition hover:bg-green-100 disabled:opacity-50"
                  >
                    {workingKey ===
                    `contribute:${need.id}`
                      ? "Saving..."
                      : need.viewerQuantity > 0
                        ? `You are bringing ${need.viewerQuantity}`
                        : "I’ll bring this"}
                  </button>
                )}

                {need.viewerQuantity > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      withdrawContribution(
                        need
                      )
                    }
                    disabled={
                      workingKey ===
                      `withdraw:${need.id}`
                    }
                    className="rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-50"
                  >
                    {workingKey ===
                    `withdraw:${need.id}`
                      ? "Withdrawing..."
                      : "Withdraw"}
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </article>
    );
  }

  const sections = [
    {
      key: "required" as const,
      icon: "⭐",
      title: "Required",
      empty:
        "No required needs yet.",
      items: requiredNeeds,
      surface:
        "border-amber-100 bg-amber-50/40",
    },
    {
      key: "optional" as const,
      icon: "💡",
      title: "Optional",
      empty:
        "No optional needs yet.",
      items: optionalNeeds,
      surface:
        "border-blue-100 bg-blue-50/40",
    },
  ];

  return (
    <section className="rounded-3xl border border-cyan-100 bg-white p-5 shadow-sm md:p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-700">
            Plan Needs
          </p>

          <h2 className="mt-1 text-2xl font-bold text-gray-950">
            What should we bring?
          </h2>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-500">
            Coordinate what members will bring. This is not a payment or donation system.
          </p>

          <p className="mt-1 max-w-3xl text-xs leading-5 text-gray-400">
            Participants can suggest additions in the conversation. The Host or a Co-host decides what is added.
          </p>
        </div>

        {canManage &&
          !readOnly && (
          <button
            type="button"
            onClick={() => {
              clearMessages();
              setIsCreateOpen(
                (current) =>
                  !current
              );
              closeEditors();
            }}
            className="rounded-xl bg-cyan-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-cyan-700"
          >
            {isCreateOpen
              ? "Close"
              : "Add Need"}
          </button>
        )}
      </div>

      {readOnly && (
        <div className="mt-5 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-600">
          This list is read-only in the current Plan state.
        </div>
      )}

      {isCreateOpen &&
        canManage &&
        !readOnly && (
        <form
          onSubmit={handleCreate}
          className="mt-6 rounded-2xl border border-cyan-100 bg-cyan-50/60 p-5"
        >
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_170px]">
            <label>
              <span className="text-xs font-semibold uppercase tracking-wide text-cyan-800">
                Need
              </span>

              <input
                value={createDraft.need}
                onChange={(event) =>
                  setCreateDraft(
                    (current) => ({
                      ...current,
                      need:
                        event.target.value,
                    })
                  )
                }
                maxLength={160}
                required
                placeholder="Water, football, Bluetooth speaker..."
                className="mt-2 w-full rounded-xl border border-cyan-200 bg-white px-4 py-3 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
              />
            </label>

            <label>
              <span className="text-xs font-semibold uppercase tracking-wide text-cyan-800">
                {createDraft.fulfillmentMode ===
                "per_participant"
                  ? "Per-person quantity"
                  : "Total quantity"}
              </span>

              <input
                type="number"
                min="1"
                max="100000"
                step="1"
                value={createDraft.quantity}
                onChange={(event) =>
                  setCreateDraft(
                    (current) => ({
                      ...current,
                      quantity:
                        event.target.value,
                    })
                  )
                }
                placeholder="1"
                className="mt-2 w-full rounded-xl border border-cyan-200 bg-white px-4 py-3 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
              />

              <p className="mt-2 text-xs text-cyan-800">
                Optional. Defaults to 1.
              </p>
            </label>
          </div>

          <div className="mt-4">
            {renderModePicker(
              createDraft,
              setCreateDraft
            )}
          </div>

          <div className="mt-4">
            {renderImportancePicker(
              createDraft,
              setCreateDraft
            )}
          </div>

          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setCreateDraft(
                  EMPTY_DRAFT
                );
                setIsCreateOpen(false);
              }}
              disabled={
                workingKey ===
                "create"
              }
              className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={
                workingKey ===
                "create"
              }
              className="rounded-xl bg-gray-950 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {workingKey ===
              "create"
                ? "Saving..."
                : "Save Need"}
            </button>
          </div>
        </form>
      )}

      {errorMessage && (
        <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {errorMessage}
        </div>
      )}

      {successMessage && (
        <div className="mt-5 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-700">
          {successMessage}
        </div>
      )}

      {isLoading ? (
        <div className="mt-6 rounded-2xl bg-gray-50 p-8 text-center text-sm text-gray-500">
          Loading Plan needs...
        </div>
      ) : (
        <div className="mt-6 grid gap-5 xl:grid-cols-2">
          {sections.map(
            (section) => (
              <section
                key={section.key}
                className={`rounded-2xl border p-4 ${section.surface}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-lg font-bold text-gray-950">
                    {section.icon}{" "}
                    {section.title}
                  </h3>

                  <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-gray-600 shadow-sm">
                    {section.items.length}
                  </span>
                </div>

                {section.items.length > 0 ? (
                  <div className="mt-4 space-y-3">
                    {section.items.map(
                      renderNeed
                    )}
                  </div>
                ) : (
                  <p className="mt-4 rounded-xl border border-dashed border-gray-200 bg-white/60 px-4 py-6 text-center text-sm text-gray-500">
                    {section.empty}
                  </p>
                )}
              </section>
            )
          )}
        </div>
      )}

      {planStatus ===
        "completed" && (
        <p className="mt-5 text-xs text-gray-400">
          Contributions are preserved as part of the completed Plan record.
        </p>
      )}
    </section>
  );
}
