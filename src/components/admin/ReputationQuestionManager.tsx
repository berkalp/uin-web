"use client";

import {
  useMemo,
  useState,
} from "react";
import {
  useRouter,
} from "next/navigation";

import {
  supabase,
} from "@/utils/supabase/client";

type CatalogueCategory = {
  id: string;
  name: string;
  is_active: boolean;
};

type CatalogueActivity = {
  id: string;
  category_id: string;
  name: string;
  is_active: boolean;
};

type ReputationQuestionRow = {
  id: string;
  scope_type:
    | "global"
    | "category"
    | "activity";
  category_id: string | null;
  activity_id: string | null;
  dimension: string;
  response_type:
    | "yes_no"
    | "scale_5";
  applies_to_role:
    | "both"
    | "host"
    | "participant";
  is_required: boolean;
  public_summary_eligible: boolean;
  sort_order: number;
  is_active: boolean;
  current_version: number;
  prompt: string;
  weight: number;
  options: {
    low_label?: string;
    high_label?: string;
  };
};

export type AdminReputationCatalogue = {
  categories: CatalogueCategory[];
  activities: CatalogueActivity[];
  questions: ReputationQuestionRow[];
};

type QuestionDraft = {
  scopeType:
    | "global"
    | "category"
    | "activity";
  categoryId: string;
  activityId: string;
  dimension: string;
  prompt: string;
  responseType:
    | "yes_no"
    | "scale_5";
  appliesToRole:
    | "both"
    | "host"
    | "participant";
  weight: string;
  isRequired: boolean;
  publicSummaryEligible: boolean;
  sortOrder: string;
  lowLabel: string;
  highLabel: string;
};

const EMPTY_DRAFT: QuestionDraft = {
  scopeType: "global",
  categoryId: "",
  activityId: "",
  dimension: "reliable",
  prompt: "",
  responseType: "scale_5",
  appliesToRole: "both",
  weight: "1",
  isRequired: true,
  publicSummaryEligible: true,
  sortOrder: "100",
  lowLabel: "Low",
  highLabel: "High",
};

function toDraft(
  question: ReputationQuestionRow
): QuestionDraft {
  return {
    scopeType: question.scope_type,
    categoryId:
      question.category_id ?? "",
    activityId:
      question.activity_id ?? "",
    dimension: question.dimension,
    prompt: question.prompt,
    responseType:
      question.response_type,
    appliesToRole:
      question.applies_to_role,
    weight: String(question.weight),
    isRequired: question.is_required,
    publicSummaryEligible:
      question.public_summary_eligible,
    sortOrder: String(
      question.sort_order
    ),
    lowLabel:
      question.options?.low_label ??
      "Low",
    highLabel:
      question.options?.high_label ??
      "High",
  };
}

function QuestionFields({
  value,
  onChange,
  categories,
  activities,
}: {
  value: QuestionDraft;
  onChange: (
    next: QuestionDraft
  ) => void;
  categories: CatalogueCategory[];
  activities: CatalogueActivity[];
}) {
  const visibleActivities =
    useMemo(
      () =>
        activities.filter(
          (activity) =>
            !value.categoryId ||
            activity.category_id ===
              value.categoryId
        ),
      [
        activities,
        value.categoryId,
      ]
    );

  function set<Key extends keyof QuestionDraft>(
    key: Key,
    next: QuestionDraft[Key]
  ) {
    onChange({
      ...value,
      [key]: next,
    });
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <label>
        <span className="text-xs font-semibold text-gray-600">
          Scope
        </span>
        <select
          value={value.scopeType}
          onChange={(event) => {
            const scope =
              event.target.value as QuestionDraft["scopeType"];

            onChange({
              ...value,
              scopeType: scope,
              categoryId:
                scope === "global"
                  ? ""
                  : value.categoryId,
              activityId:
                scope === "activity"
                  ? value.activityId
                  : "",
            });
          }}
          className="mt-1.5 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm"
        >
          <option value="global">
            Global
          </option>
          <option value="category">
            Category
          </option>
          <option value="activity">
            Activity
          </option>
        </select>
      </label>

      {value.scopeType !==
        "global" && (
        <label>
          <span className="text-xs font-semibold text-gray-600">
            Category
          </span>
          <select
            value={value.categoryId}
            onChange={(event) =>
              onChange({
                ...value,
                categoryId:
                  event.target.value,
                activityId: "",
              })
            }
            className="mt-1.5 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm"
          >
            <option value="">
              Select category
            </option>
            {categories.map(
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
      )}

      {value.scopeType ===
        "activity" && (
        <label>
          <span className="text-xs font-semibold text-gray-600">
            Activity
          </span>
          <select
            value={value.activityId}
            onChange={(event) =>
              set(
                "activityId",
                event.target.value
              )
            }
            className="mt-1.5 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm"
          >
            <option value="">
              Select Activity
            </option>
            {visibleActivities.map(
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
      )}

      <label>
        <span className="text-xs font-semibold text-gray-600">
          Dimension key
        </span>
        <input
          value={value.dimension}
          onChange={(event) =>
            set(
              "dimension",
              event.target.value
                .toLowerCase()
                .replace(
                  /[^a-z0-9_]/g,
                  "_"
                )
            )
          }
          placeholder="sportsmanship"
          className="mt-1.5 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
        />
      </label>

      <label className="md:col-span-2 xl:col-span-4">
        <span className="text-xs font-semibold text-gray-600">
          Question text
        </span>
        <textarea
          value={value.prompt}
          onChange={(event) =>
            set(
              "prompt",
              event.target.value
            )
          }
          rows={2}
          className="mt-1.5 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm leading-6"
          placeholder="Did this person show good sportsmanship?"
        />
      </label>

      <label>
        <span className="text-xs font-semibold text-gray-600">
          Answer type
        </span>
        <select
          value={value.responseType}
          onChange={(event) =>
            set(
              "responseType",
              event.target.value as QuestionDraft["responseType"]
            )
          }
          className="mt-1.5 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm"
        >
          <option value="scale_5">
            1–5 scale
          </option>
          <option value="yes_no">
            Yes / No
          </option>
        </select>
      </label>

      <label>
        <span className="text-xs font-semibold text-gray-600">
          Evaluated role
        </span>
        <select
          value={value.appliesToRole}
          onChange={(event) =>
            set(
              "appliesToRole",
              event.target.value as QuestionDraft["appliesToRole"]
            )
          }
          className="mt-1.5 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm"
        >
          <option value="both">
            Host and participant
          </option>
          <option value="host">
            Host only
          </option>
          <option value="participant">
            Participant only
          </option>
        </select>
      </label>

      <label>
        <span className="text-xs font-semibold text-gray-600">
          Weight
        </span>
        <input
          type="number"
          min="0.1"
          max="10"
          step="0.1"
          value={value.weight}
          onChange={(event) =>
            set(
              "weight",
              event.target.value
            )
          }
          className="mt-1.5 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
        />
      </label>

      <label>
        <span className="text-xs font-semibold text-gray-600">
          Sort order
        </span>
        <input
          type="number"
          min="0"
          max="10000"
          value={value.sortOrder}
          onChange={(event) =>
            set(
              "sortOrder",
              event.target.value
            )
          }
          className="mt-1.5 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
        />
      </label>

      {value.responseType ===
        "scale_5" && (
        <>
          <label>
            <span className="text-xs font-semibold text-gray-600">
              Low label
            </span>
            <input
              value={value.lowLabel}
              onChange={(event) =>
                set(
                  "lowLabel",
                  event.target.value
                )
              }
              className="mt-1.5 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
            />
          </label>

          <label>
            <span className="text-xs font-semibold text-gray-600">
              High label
            </span>
            <input
              value={value.highLabel}
              onChange={(event) =>
                set(
                  "highLabel",
                  event.target.value
                )
              }
              className="mt-1.5 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
            />
          </label>
        </>
      )}

      <label className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-700">
        <input
          type="checkbox"
          checked={value.isRequired}
          onChange={(event) =>
            set(
              "isRequired",
              event.target.checked
            )
          }
        />
        Required
      </label>

      <label className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-700">
        <input
          type="checkbox"
          checked={
            value.publicSummaryEligible
          }
          onChange={(event) =>
            set(
              "publicSummaryEligible",
              event.target.checked
            )
          }
        />
        May appear in public summary
      </label>
    </div>
  );
}

function toRpcPayload(
  draft: QuestionDraft
) {
  return {
    p_scope_type:
      draft.scopeType,
    p_category_id:
      draft.categoryId || null,
    p_activity_id:
      draft.activityId || null,
    p_dimension:
      draft.dimension.trim(),
    p_prompt:
      draft.prompt.trim(),
    p_response_type:
      draft.responseType,
    p_applies_to_role:
      draft.appliesToRole,
    p_weight:
      Number(draft.weight),
    p_is_required:
      draft.isRequired,
    p_public_summary_eligible:
      draft.publicSummaryEligible,
    p_sort_order:
      Number(draft.sortOrder),
    p_options:
      draft.responseType ===
      "scale_5"
        ? {
            low_label:
              draft.lowLabel.trim(),
            high_label:
              draft.highLabel.trim(),
          }
        : {},
  };
}

function ExistingQuestionEditor({
  question,
  catalogue,
}: {
  question: ReputationQuestionRow;
  catalogue: AdminReputationCatalogue;
}) {
  const router =
    useRouter();

  const [draft, setDraft] =
    useState<QuestionDraft>(
      toDraft(question)
    );

  const [busy, setBusy] =
    useState(false);

  const [message, setMessage] =
    useState<string | null>(null);

  async function save() {
    setBusy(true);
    setMessage(null);

    const {
      error,
    } = await supabase.rpc(
      "admin_update_reputation_question",
      {
        p_question_id:
          question.id,
        ...toRpcPayload(draft),
      }
    );

    setBusy(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage(
      "Saved. A new version was created when the wording or weight changed."
    );
    router.refresh();
  }

  async function toggleActive() {
    setBusy(true);
    setMessage(null);

    const {
      error,
    } = await supabase.rpc(
      "admin_set_reputation_question_active",
      {
        p_question_id:
          question.id,
        p_is_active:
          !question.is_active,
      }
    );

    setBusy(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    router.refresh();
  }

  return (
    <article
      className={`rounded-3xl border p-5 ${
        question.is_active
          ? "border-gray-200 bg-white"
          : "border-gray-200 bg-gray-100 opacity-75"
      }`}
    >
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-gray-950 px-3 py-1 text-xs font-bold uppercase text-white">
            {question.scope_type}
          </span>

          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800">
            {question.dimension}
          </span>

          <span className="rounded-full bg-purple-50 px-3 py-1 text-xs font-semibold text-purple-800">
            Version {question.current_version}
          </span>
        </div>

        <button
          type="button"
          disabled={busy}
          onClick={toggleActive}
          className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs font-bold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
        >
          {question.is_active
            ? "Deactivate"
            : "Reactivate"}
        </button>
      </div>

      <QuestionFields
        value={draft}
        onChange={setDraft}
        categories={catalogue.categories}
        activities={catalogue.activities}
      />

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={save}
          className="rounded-xl bg-green-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-green-700 disabled:opacity-50"
        >
          {busy
            ? "Saving…"
            : "Save question"}
        </button>

        {message && (
          <p className="text-sm text-gray-600">
            {message}
          </p>
        )}
      </div>
    </article>
  );
}

export default function ReputationQuestionManager({
  catalogue,
}: {
  catalogue: AdminReputationCatalogue;
}) {
  const router =
    useRouter();

  const [draft, setDraft] =
    useState<QuestionDraft>(
      EMPTY_DRAFT
    );

  const [busy, setBusy] =
    useState(false);

  const [message, setMessage] =
    useState<string | null>(null);

  async function createQuestion() {
    setBusy(true);
    setMessage(null);

    const {
      error,
    } = await supabase.rpc(
      "admin_create_reputation_question",
      toRpcPayload(draft)
    );

    setBusy(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setDraft(EMPTY_DRAFT);
    setMessage(
      "Question created."
    );
    router.refresh();
  }

  return (
    <div className="space-y-8">
      <section className="rounded-[32px] border border-green-200 bg-green-50/60 p-6 shadow-sm md:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-green-700">
          New reputation question
        </p>

        <h2 className="mt-2 text-2xl font-bold text-gray-950">
          Add a contextual question
        </h2>

        <p className="mt-3 max-w-3xl text-sm leading-7 text-gray-600">
          Global questions apply everywhere. Category questions apply to every Activity in a category. Activity questions apply only to the selected canonical Activity.
        </p>

        <div className="mt-6">
          <QuestionFields
            value={draft}
            onChange={setDraft}
            categories={catalogue.categories}
            activities={catalogue.activities}
          />
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={createQuestion}
            className="rounded-xl bg-green-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-green-700 disabled:opacity-50"
          >
            {busy
              ? "Creating…"
              : "Create question"}
          </button>

          {message && (
            <p className="text-sm text-gray-600">
              {message}
            </p>
          )}
        </div>
      </section>

      <section>
        <div className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-purple-700">
            Question catalogue
          </p>

          <h2 className="mt-2 text-2xl font-bold text-gray-950">
            {catalogue.questions.length}{" "}
            versioned questions
          </h2>

          <p className="mt-2 text-sm text-gray-500">
            Used questions are never rewritten in old feedback. Editing wording or weight creates a new version; deactivation only affects future forms.
          </p>
        </div>

        <div className="space-y-5">
          {catalogue.questions.map(
            (question) => (
              <ExistingQuestionEditor
                key={question.id}
                question={question}
                catalogue={catalogue}
              />
            )
          )}
        </div>
      </section>
    </div>
  );
}
