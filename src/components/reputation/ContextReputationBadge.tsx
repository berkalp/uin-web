import {
  getReputationLevelClasses,
  getReputationLevelLabel,
  type ContextualReputation,
} from "@/utils/reputation";

type ContextReputationBadgeProps = {
  reputation: ContextualReputation | null;
  activityName: string;
  categoryName: string;
};

export default function ContextReputationBadge({
  reputation,
  activityName,
  categoryName,
}: ContextReputationBadgeProps) {
  if (
    !reputation ||
    reputation.is_managed_minor ||
    !reputation.summary
  ) {
    return null;
  }

  const summary =
    reputation.summary;

  const contextLabel =
    reputation.source_context ===
    "activity"
      ? activityName
      : reputation.source_context ===
          "category"
        ? categoryName
        : "Overall";

  return (
    <div className="mt-4 rounded-2xl border border-white/70 bg-white/75 p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-700">
            Reputation in this context
          </p>

          <p className="mt-1 text-sm font-bold text-gray-950">
            {contextLabel}
          </p>
        </div>

        <span
          className={`rounded-full border px-3 py-1 text-xs font-bold ${getReputationLevelClasses(
            summary.reputation_level
          )}`}
        >
          {getReputationLevelLabel(
            summary.reputation_level
          )}
        </span>
      </div>

      <p className="mt-3 text-xs leading-5 text-gray-600">
        Based on {summary.activity_count}{" "}
        completed Activit
        {summary.activity_count === 1
          ? "y"
          : "ies"}
        {reputation.source_context !==
        "activity"
          ? `. No ${activityName}-specific history yet, so ${contextLabel} history is shown.`
          : "."}
      </p>
    </div>
  );
}
