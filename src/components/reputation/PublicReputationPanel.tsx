import {
  formatReputationDimension,
  getReputationLevelClasses,
  getReputationLevelLabel,
  type PublicReputationSummary,
  type ReputationContextSummary,
} from "@/utils/reputation";

type PublicReputationPanelProps = {
  summary: PublicReputationSummary;
};

function Metric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-400">
        {label}
      </p>

      <p className="mt-2 text-lg font-bold text-gray-950">
        {value}
      </p>
    </div>
  );
}

function ContextCard({
  context,
}: {
  context: ReputationContextSummary;
}) {
  const title =
    context.activity_name ||
    context.category_name ||
    "UIN context";

  const dimensions =
    Object.entries(
      context.dimension_scores ?? {}
    )
      .filter(
        ([, score]) =>
          score.responses >= 2 &&
          score.score >= 70
      )
      .sort(
        (first, second) =>
          second[1].score -
          first[1].score
      )
      .slice(0, 3);

  return (
    <article className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-400">
            {context.context_type ===
            "activity"
              ? "Activity reputation"
              : "Category reputation"}
          </p>

          <h3 className="mt-2 text-lg font-bold text-gray-950">
            {title}
          </h3>
        </div>

        <span
          className={`rounded-full border px-3 py-1.5 text-xs font-bold ${getReputationLevelClasses(
            context.reputation_level
          )}`}
        >
          {getReputationLevelLabel(
            context.reputation_level
          )}
        </span>
      </div>

      <p className="mt-3 text-sm text-gray-500">
        Based on {context.activity_count}{" "}
        completed Activit
        {context.activity_count === 1
          ? "y"
          : "ies"}
        .
      </p>

      {dimensions.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {dimensions.map(
            ([dimension, score]) => (
              <span
                key={dimension}
                className="rounded-full bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-800"
              >
                {formatReputationDimension(
                  dimension
                )}{" "}
                · {Math.round(score.score)}%
              </span>
            )
          )}
        </div>
      )}
    </article>
  );
}

export default function PublicReputationPanel({
  summary,
}: PublicReputationPanelProps) {
  if (summary.is_managed_minor) {
    return (
      <section className="mt-6 rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-purple-700">
          Participation history
        </p>

        <h2 className="mt-2 text-xl font-bold text-gray-950">
          Guardian-managed Activity history
        </h2>

        <p className="mt-3 text-sm leading-7 text-gray-600">
          Participated in {summary.participation_count}{" "}
          guardian-managed Activit
          {summary.participation_count === 1
            ? "y"
            : "ies"}
          . Numerical peer reputation is not shown for managed minor profiles.
        </p>
      </section>
    );
  }

  const global =
    summary.global;

  if (!global) {
    return (
      <section className="mt-6 rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-green-700">
          Reputation
        </p>

        <h2 className="mt-2 text-xl font-bold text-gray-950">
          New to shared Activities
        </h2>

        <p className="mt-3 text-sm leading-7 text-gray-600">
          There is not enough completed Activity history to show a reputation summary yet.
        </p>
      </section>
    );
  }

  const activityContexts =
    summary.contexts
      .filter(
        (context) =>
          context.context_type ===
          "activity"
      )
      .slice(0, 6);

  const categoryContexts =
    summary.contexts
      .filter(
        (context) =>
          context.context_type ===
          "category"
      )
      .slice(0, 4);

  return (
    <section className="mt-6 rounded-[32px] border border-gray-200 bg-white p-6 shadow-sm md:p-8">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-green-700">
            Reputation
          </p>

          <h2 className="mt-2 text-2xl font-bold text-gray-950">
            Reliability by context
          </h2>

          <p className="mt-3 max-w-3xl text-sm leading-7 text-gray-600">
            Reputation reflects verified shared Activity behaviour. It does not include followers, popularity or skill level.
          </p>
        </div>

        <span
          className={`w-fit rounded-full border px-4 py-2 text-sm font-bold ${getReputationLevelClasses(
            global.reputation_level
          )}`}
        >
          {getReputationLevelLabel(
            global.reputation_level
          )}
        </span>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric
          label="Completed together"
          value={String(
            global.activity_count
          )}
        />

        <Metric
          label="Attendance reliability"
          value={
            global.attendance_observation_count >=
            3
              ? `${Math.round(
                  global.attendance_rate ??
                    0
                )}%`
              : "Not enough data"
          }
        />

        <Metric
          label="Would join again"
          value={
            global.feedback_count >= 3 &&
            global.would_join_again_count !== null
              ? `${global.would_join_again_count} of ${global.feedback_count}`
              : "Not enough data"
          }
        />

        <Metric
          label="Confidence"
          value={
            global.confidence_level
              .charAt(0)
              .toUpperCase() +
            global.confidence_level.slice(
              1
            )
          }
        />
      </div>

      {activityContexts.length > 0 && (
        <div className="mt-8">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">
            By Activity
          </p>

          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {activityContexts.map(
              (context) => (
                <ContextCard
                  key={`${context.context_key}-${context.role}`}
                  context={context}
                />
              )
            )}
          </div>
        </div>
      )}

      {categoryContexts.length > 0 && (
        <div className="mt-8">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">
            By Category
          </p>

          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {categoryContexts.map(
              (context) => (
                <ContextCard
                  key={`${context.context_key}-${context.role}`}
                  context={context}
                />
              )
            )}
          </div>
        </div>
      )}
    </section>
  );
}
