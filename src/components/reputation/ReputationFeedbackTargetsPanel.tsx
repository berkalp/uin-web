import Link from "next/link";

import type {
  ReputationFeedbackTarget,
} from "@/utils/reputation";

type ReputationFeedbackTargetsPanelProps = {
  planId: string;
  targets: ReputationFeedbackTarget[];
  compact?: boolean;
};

function getInitial(
  value: string
) {
  return (
    value.trim().charAt(0).toUpperCase() ||
    "?"
  );
}

export default function ReputationFeedbackTargetsPanel({
  planId,
  targets,
  compact = false,
}: ReputationFeedbackTargetsPanelProps) {
  if (targets.length === 0) {
    return null;
  }

  const pendingTargets =
    targets.filter(
      (target) =>
        target.can_feedback
    );

  const submittedTargets =
    targets.filter(
      (target) =>
        target.existing_feedback_id !==
        null
    );

  if (
    pendingTargets.length === 0 &&
    submittedTargets.length === 0
  ) {
    return null;
  }

  return (
    <section
      className={`rounded-3xl border border-purple-200 bg-purple-50/70 shadow-sm ${
        compact
          ? "p-5"
          : "p-6"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-purple-700">
            Activity feedback
          </p>

          <h2 className="mt-2 text-xl font-bold text-purple-950">
            Reputation follows the context
          </h2>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-purple-800">
            Evaluate only the people you shared this Activity with. Basketball feedback stays with Basketball; Family Picnic feedback stays with Family Picnic.
          </p>
        </div>

        {pendingTargets.length > 0 && (
          <span className="rounded-full bg-purple-700 px-3 py-1.5 text-xs font-bold text-white">
            {pendingTargets.length}{" "}
            pending
          </span>
        )}
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {targets.map(
          (target) => {
            const displayName =
              target.target_full_name ||
              target.target_username;

            return (
              <article
                key={target.target_user_id}
                className="flex items-center gap-3 rounded-2xl border border-purple-100 bg-white p-3"
              >
                {target.target_avatar_url ? (
                  <img
                    src={
                      target.target_avatar_url
                    }
                    alt={displayName}
                    className="h-11 w-11 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-purple-100 text-sm font-bold text-purple-800">
                    {getInitial(
                      displayName
                    )}
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-gray-950">
                    {displayName}
                  </p>

                  <p className="mt-0.5 text-xs capitalize text-gray-500">
                    {target.target_role}
                  </p>
                </div>

                {target.can_feedback ? (
                  <Link
                    href={`/reputation/feedback/${encodeURIComponent(
                      planId
                    )}/${encodeURIComponent(
                      target.target_user_id
                    )}`}
                    className="shrink-0 rounded-xl bg-purple-700 px-3 py-2 text-xs font-bold text-white transition hover:bg-purple-800"
                  >
                    Give feedback
                  </Link>
                ) : target.existing_feedback_id ? (
                  <span className="shrink-0 rounded-full bg-green-100 px-3 py-1.5 text-xs font-bold text-green-800">
                    Submitted
                  </span>
                ) : null}
              </article>
            );
          }
        )}
      </div>
    </section>
  );
}
