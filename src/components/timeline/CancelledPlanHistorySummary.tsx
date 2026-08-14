import Link from "next/link";

type CancelledPlanHistorySummaryProps = {
  phase: "planning" | "activity";
  cancelledAt: string | null;
  cancelledByName: string;
  reasonCode: string | null;
  reasonText: string | null;
  journeyHref: string;
  sourceIntentReopened: boolean;
  sourceIntentHref: string | null;
  nextAttempt:
    | {
        label: string;
        href: string;
      }
    | null;
};

const REASON_LABELS: Record<string, string> = {
  schedule_conflict: "Schedule conflict",
  insufficient_participation: "Not enough participants",
  venue_or_event_cancelled: "Venue or event cancelled",
  weather_or_safety: "Weather or safety",
  personal_reason: "Personal reason",
  other: "Other",
};

function formatCancelledAt(value: string | null) {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default function CancelledPlanHistorySummary({
  phase,
  cancelledAt,
  cancelledByName,
  reasonCode,
  reasonText,
  journeyHref,
  sourceIntentReopened,
  sourceIntentHref,
  nextAttempt,
}: CancelledPlanHistorySummaryProps) {
  const phaseLabel = phase === "planning" ? "Plan" : "Activity";
  const reasonLabel = reasonCode
    ? REASON_LABELS[reasonCode] ?? "Cancellation"
    : "Cancellation";
  const cancelledAtLabel = formatCancelledAt(cancelledAt);

  return (
    <div className="mx-3 mt-3 rounded-2xl border border-red-200 bg-gradient-to-br from-red-50 via-white to-orange-50 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[8px] font-black uppercase tracking-[0.15em] text-red-600">
            Why this attempt ended
          </p>
          <p className="mt-1 text-[11px] font-black text-gray-950">
            {phaseLabel} cancelled by {cancelledByName}
          </p>
          {cancelledAtLabel && (
            <p className="mt-0.5 text-[9px] text-gray-500">{cancelledAtLabel}</p>
          )}
        </div>

        <Link
          href={journeyHref}
          className="shrink-0 rounded-full border border-red-200 bg-white px-2.5 py-1 text-[8.5px] font-black text-red-700 transition hover:border-red-300 hover:bg-red-50"
        >
          Journey ↗
        </Link>
      </div>

      <div className="mt-2 rounded-xl border border-red-100 bg-white/80 px-3 py-2">
        <p className="text-[8px] font-bold uppercase tracking-wide text-gray-400">
          Reason
        </p>
        <p className="mt-0.5 text-[10px] font-bold text-gray-800">{reasonLabel}</p>
        {reasonText && reasonText.trim() && reasonText.trim() !== reasonLabel && (
          <p className="mt-1 text-[9px] leading-4 text-gray-600">{reasonText.trim()}</p>
        )}
      </div>

      {sourceIntentReopened && (
        <div className="mt-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2">
          <p className="text-[8px] font-black uppercase tracking-[0.12em] text-emerald-700">
            Recovery
          </p>
          <div className="mt-1 flex items-center justify-between gap-3">
            <p className="text-[9.5px] font-bold text-emerald-950">
              Intent reopened. This cancelled attempt remains in history.
            </p>
            {sourceIntentHref && !nextAttempt && (
              <Link
                href={sourceIntentHref}
                className="shrink-0 text-[9px] font-black text-emerald-700 hover:text-emerald-900"
              >
                Open Intent →
              </Link>
            )}
          </div>

          {nextAttempt && (
            <Link
              href={nextAttempt.href}
              className="mt-2 flex items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-white px-2.5 py-2 text-[9px] font-bold text-emerald-900 transition hover:border-emerald-300"
            >
              <span className="min-w-0 truncate">↳ {nextAttempt.label}</span>
              <span className="shrink-0">Open →</span>
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
