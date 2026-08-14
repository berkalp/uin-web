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

      <div className="relative h-[118px] shrink-0 overflow-hidden border-b border-black/5 bg-gray-100">
        {mapEmbedUrl ? (
          <iframe
            title={mapTitle}
            src={mapEmbedUrl}
            className="pointer-events-none absolute -top-9 left-0 h-[calc(100%+36px)] w-full border-0"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            tabIndex={-1}
          />
        ) : (
          <div className="flex h-full items-center justify-center p-3 text-center text-[11px] text-gray-500">
            No map
          </div>
        )}

        {locationLabel && (
          <span className="absolute bottom-2 left-2 max-w-[78%] truncate rounded-full bg-gray-950/80 px-2 py-0.5 text-[8.5px] font-semibold text-white backdrop-blur">
            {locationPrecision === "public_venue" ? "📍" : "≈"} {locationLabel}
          </span>
        )}

        {mapAction}
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
