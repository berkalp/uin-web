import type { ReactNode } from "react";

import LifecycleCurrentDate from "../activities/LifecycleCurrentDate";

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
  mapTitle: string;
  mapEmbedUrl: string | null;
  locationLabel?: string | null;
  locationPrecision?: "public_venue" | "approximate";
  mapAction?: ReactNode;
  peopleContent: ReactNode;
  participantValue: string;
  rightMeta?: ReactNode;
};

export default function CanonicalActivityCardBody({
  targetStart,
  targetEnd,
  scheduledStart,
  scheduledEnd,
  completedAt,
  cancelledAt,
  expiredAt,
  status,
  timezone,
  mapTitle,
  mapEmbedUrl,
  locationLabel = null,
  locationPrecision = "approximate",
  mapAction = null,
  peopleContent,
  participantValue,
  rightMeta = null,
}: Props) {
  return (
    <div className="flex min-h-0 flex-1 flex-col peer-checked:hidden">
      <div className="shrink-0 border-b border-black/5 px-2.5 py-2">
        <LifecycleCurrentDate
          targetStart={targetStart}
          targetEnd={targetEnd}
          scheduledStart={scheduledStart}
          scheduledEnd={scheduledEnd}
          completedAt={completedAt}
          cancelledAt={cancelledAt}
          expiredAt={expiredAt}
          status={status}
          timezone={timezone}
          compact
          className="w-full"
        />
      </div>

      <div className="shrink-0 px-4 py-2 text-xs text-gray-500">
        📍 {locationLabel || "Konum henüz belirlenmedi"}
      </div>

      <div className="flex h-[52px] shrink-0 min-w-0 items-center justify-between gap-3 border-b border-black/5 px-3">
        <div className="min-w-0 flex-1">{peopleContent}</div>
        <div className="flex shrink-0 items-center gap-1.5">
          {rightMeta}
          <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold text-gray-600 shadow-sm">
            {participantValue}
          </span>
        </div>
      </div>
    </div>
  );
}
