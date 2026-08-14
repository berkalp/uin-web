"use client";

import Link from "next/link";

import EyeIcon from "../ui/EyeIcon";
import CanonicalActivityCardBody from "../cards/CanonicalActivityCardBody";
import CanonicalActivityCardDetails from "../cards/CanonicalActivityCardDetails";

import { resolveActivityCover } from "../../utils/activityCover";

type Props = {
  itemType: "intent" | "plan";
  title: string;
  activityName: string | null;
  categoryName: string | null;
  coverUrl: string | null;
  city: string | null;
  district: string | null;
  windowStart: string;
  windowEnd: string;
  expiredAt: string;
  roleLabel: string;
  participantCount: number;
  maxParticipants: number | null;
  personalBudget: number | null;
  committedBudget: number | null;
  targetBudget: number | null;
  visibility: string | null;
  notes: string | null;
  recruitmentStatus: string | null;
  matchingStatus: string | null;
  copiedFromIntentId: string | null;
  planId: string | null;
  sourceIntentId: string | null;
  canCreateAgain: boolean;
};

function money(value: number | null) {
  return value === null
    ? "Not set"
    : `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value)} TL`;
}

export default function TimelineExpiredPresentation(props: Props) {
  const locationLabel = [props.district, props.city].filter(Boolean).join(", ");
  const mapEmbedUrl = locationLabel
    ? `https://www.google.com/maps?q=${encodeURIComponent(locationLabel)}&z=10&output=embed`
    : null;
  const cover = resolveActivityCover({
    planCoverUrl: props.coverUrl,
    categoryName: props.categoryName,
    activityName: props.activityName || props.title,
  });
  const href = props.planId
    ? `/plans/${encodeURIComponent(props.planId)}/planning`
    : props.sourceIntentId
      ? `/activities/${encodeURIComponent(props.sourceIntentId)}`
      : null;
  const detailToggleId = `expired-card-details-${props.itemType}-${props.planId ?? props.sourceIntentId ?? props.title.replace(/\s+/g, "-")}`;

  return (
    <article className="peer-card relative flex h-[400px] min-w-0 flex-col overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm transition hover:shadow-md">
      <input id={detailToggleId} type="checkbox" className="peer sr-only" aria-label={`Toggle details for ${props.title}`} />

      <div className="relative h-[128px] shrink-0 overflow-hidden bg-gray-950">
        <img src={cover} alt={`${props.title} cover`} className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-black/45" />
        <div className="absolute inset-x-3 top-3 flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-wrap gap-1.5">
            <span className="inline-flex h-5 items-center rounded-full bg-orange-100 px-2 text-[8.5px] font-bold uppercase leading-none text-orange-800">Süresi Doldu</span>
            <span className="inline-flex h-5 max-w-[130px] items-center truncate rounded-full bg-black/70 px-2 text-[8.5px] font-semibold uppercase leading-none text-white">{props.roleLabel}</span>
          </div>
        </div>
        <div className="absolute inset-x-0 bottom-0 px-3 pb-3">
          <p className="h-3 truncate text-[9px] font-bold uppercase tracking-[0.11em] text-green-300">{props.categoryName ?? "Activity"}</p>
          <div className="mt-0.5 flex h-[38px] items-end">
            <h2 className="line-clamp-2 text-[17px] font-bold leading-[1.12] text-white">{props.title}</h2>
          </div>
          <div className="mt-1 h-6" />
        </div>
      </div>

      <CanonicalActivityCardBody
        targetStart={props.windowStart}
        targetEnd={props.windowEnd}
        expiredAt={props.expiredAt}
        status="expired"
        timezone="Europe/Istanbul"
        mapTitle={`${props.title} approximate area`}
        mapEmbedUrl={mapEmbedUrl}
        locationLabel={locationLabel}
        locationPrecision="approximate"
        participantValue={`${props.participantCount} / ${props.maxParticipants ?? "∞"}`}
        peopleContent={
          <div className="min-w-0">
            <p className="truncate text-[12px] font-semibold text-gray-950">{props.roleLabel}</p>
            <p className="mt-0.5 text-[9px] font-medium text-gray-400">Geçmiş kayıt</p>
          </div>
        }
      />

      <CanonicalActivityCardDetails
        targetStart={props.windowStart}
        targetEnd={props.windowEnd}
        expiredAt={props.expiredAt}
        status="expired"
        timezone="Europe/Istanbul"
        participantValue={`${props.participantCount} / ${props.maxParticipants ?? "∞"}`}
        visibilityValue={props.visibility ?? "Not specified"}
        recurrenceValue="One-time"
        costLabel="Target"
        costValue={money(props.targetBudget ?? props.personalBudget)}
        locationLabel={locationLabel}
        locationPrecision="approximate"
        note={props.notes}
        linkCount={0}
        extra={
          <div className="mt-1.5 grid grid-cols-2 gap-1 text-[9.5px]">
            {[
              ["Committed", money(props.committedBudget)],
              ["Recruitment", props.recruitmentStatus ?? "closed"],
              ["Matching", props.matchingStatus ?? "closed"],
              ["Role", props.roleLabel],
            ].map(([label, value]) => (
              <div key={label} className="min-w-0 rounded-xl border border-gray-100 bg-white px-2 py-1.5 shadow-sm">
                <p className="text-[7.5px] font-semibold uppercase text-gray-400">{label}</p>
                <p className="mt-0.5 truncate font-semibold text-gray-950">{value}</p>
              </div>
            ))}
          </div>
        }
      />

      <div className="flex h-[34px] shrink-0 items-center gap-1 border-t border-black/5 bg-white/95 px-1.5">
        {href ? (
          <Link
            href={href}
            title="Görüntüle"
            aria-label={`Görüntüle ${props.title}`}
            className="flex h-6 w-7 shrink-0 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-600 transition hover:border-green-300 hover:text-green-700"
          >
            <EyeIcon />
          </Link>
        ) : (
          <span className="h-6 w-7 shrink-0" />
        )}
        <label htmlFor={detailToggleId} className="flex h-6 w-[56px] cursor-pointer items-center justify-center rounded-md border border-gray-200 bg-white px-2 text-[9.5px] font-semibold text-gray-700 transition hover:border-blue-300 hover:text-blue-700 after:ml-1 after:content-['▾'] peer-checked:after:content-['▴']">Detaylar</label>
        {props.canCreateAgain && props.sourceIntentId ? (
          <Link href={`/onboarding?copyFrom=${encodeURIComponent(props.sourceIntentId)}`} className="ml-auto flex h-6 min-w-[82px] items-center justify-center rounded-md bg-green-600 px-2 text-[9.5px] font-semibold text-white transition hover:bg-green-700">Tekrar Oluştur</Link>
        ) : null}
      </div>
    </article>
  );
}
