import type { ReactNode } from "react";
import Link from "next/link";

import ActivityLifecycleTimeline from "../activities/ActivityLifecycleTimeline";
import type { IntentCommunityContext } from "../../utils/communities";

type Props = {
  targetStart?: string | null;
  targetEnd?: string | null;
  scheduledStart?: string | null;
  scheduledEnd?: string | null;
  completedAt?: string | null;
  cancelledAt?: string | null;
  expiredAt?: string | null;
  status: string;
  timezone?: string | null;
  participantValue: string;
  visibilityValue: string;
  recurrenceValue: string;
  costLabel: string;
  costValue: string;
  communities?: IntentCommunityContext[];
  locationLabel?: string | null;
  locationPrecision?: "public_venue" | "approximate";
  note?: string | null;
  linkCount?: number;
  originLabel?: string | null;
  originHref?: string | null;
  extra?: ReactNode;
};

function DetailMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-gray-100 bg-white px-2 py-1.5 shadow-sm">
      <p className="text-[7.5px] font-semibold uppercase tracking-[0.05em] text-gray-400">
        {label}
      </p>
      <p className="mt-0.5 truncate font-semibold text-gray-950" title={value}>
        {value}
      </p>
    </div>
  );
}

export default function CanonicalActivityCardDetails({
  targetStart,
  targetEnd,
  scheduledStart,
  scheduledEnd,
  completedAt,
  cancelledAt,
  expiredAt,
  status,
  timezone,
  participantValue,
  visibilityValue,
  recurrenceValue,
  costLabel,
  costValue,
  communities = [],
  locationLabel = null,
  locationPrecision = "approximate",
  note = null,
  linkCount = 0,
  originLabel = null,
  originHref = null,
  extra = null,
}: Props) {
  const primaryCommunity =
    communities.find((community) => community.isPrimary) ?? communities[0] ?? null;

  return (
    <div className="hidden min-h-0 flex-1 overflow-y-auto overscroll-contain bg-white/85 px-2.5 py-2 peer-checked:block">
      <div className="shrink-0">
        <ActivityLifecycleTimeline
          targetStart={targetStart}
          targetEnd={targetEnd}
          scheduledStart={scheduledStart}
          scheduledEnd={scheduledEnd}
          completedAt={completedAt}
          cancelledAt={cancelledAt}
          expiredAt={expiredAt}
          status={status}
          timezone={timezone}
          variant="compact"
          hideCompactTitle
        />
      </div>

      <div className="mt-1.5 grid grid-cols-2 gap-1 text-[9.5px]">
        <DetailMetric label="Participants" value={participantValue} />
        <DetailMetric label="Visibility" value={visibilityValue} />
        <DetailMetric label="Recurrence" value={recurrenceValue} />
        <DetailMetric label={costLabel} value={costValue} />
      </div>

      {(primaryCommunity || locationLabel) && (
        <div className="mt-1 flex min-w-0 gap-1 overflow-hidden">
          {primaryCommunity && (
            <Link
              href={`/communities/${encodeURIComponent(primaryCommunity.slug)}`}
              className="inline-flex min-w-0 max-w-[58%] items-center gap-1 rounded-full border border-green-200 bg-green-50 px-1.5 py-0.5 text-[8.5px] font-semibold text-green-800 transition hover:bg-green-100"
            >
              {primaryCommunity.iconUrl ? (
                <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded bg-white p-[1px] ring-1 ring-black/5">
                  <img src={primaryCommunity.iconUrl} alt="" className="h-full w-full object-contain" />
                </span>
              ) : (
                <span
                  aria-hidden="true"
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: primaryCommunity.accentColor }}
                />
              )}
              <span className="truncate">{primaryCommunity.name}</span>
              {communities.length > 1 && (
                <span className="shrink-0 text-green-600">+{communities.length - 1}</span>
              )}
            </Link>
          )}

          {locationLabel && (
            <span className="inline-flex min-w-0 flex-1 items-center gap-1 rounded-full border border-gray-200 bg-white px-1.5 py-0.5 text-[8.5px] font-medium text-gray-600">
              <span aria-hidden="true">{locationPrecision === "public_venue" ? "📍" : "≈"}</span>
              <span className="truncate">{locationLabel}</span>
            </span>
          )}
        </div>
      )}

      {note?.trim() && (
        <div className="mt-1 rounded-lg border border-blue-100 bg-blue-50/60 px-2 py-1.5">
          <p className="text-[7.5px] font-semibold uppercase tracking-[0.05em] text-blue-500">Note</p>
          <p className="mt-0.5 line-clamp-2 text-[9.5px] leading-3.5 text-gray-700">
            {note.trim()}
          </p>
        </div>
      )}

      <div className="mt-1 flex min-w-0 items-center gap-2 text-[8.5px] text-gray-500">
        <span className="shrink-0">{linkCount} {linkCount === 1 ? "link" : "links"}</span>
        {originLabel && originHref && (
          <>
            <span aria-hidden="true">·</span>
            <Link
              href={originHref}
              className="min-w-0 truncate font-semibold text-emerald-700 hover:text-emerald-800"
            >
              Origin · {originLabel}
            </Link>
          </>
        )}
      </div>

      {extra}
    </div>
  );
}
