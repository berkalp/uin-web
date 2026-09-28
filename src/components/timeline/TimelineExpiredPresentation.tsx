"use client";

import Link from "next/link";
import { UinCardHeader } from "@/components/cards/UinCard";

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
    <article className="peer-card relative flex min-h-[560px] min-w-0 flex-col overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm transition hover:shadow-md">
      <input id={detailToggleId} type="checkbox" className="peer sr-only" aria-label={`Toggle details for ${props.title}`} />

      <UinCardHeader title={props.title} subtitle={locationLabel} category={props.categoryName} coverUrl={cover} badge="SÜRESİ DOLDU" tone="plan" href={href ?? undefined} />

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

      <div className="mt-auto shrink-0 space-y-2 px-4 pb-4 pt-3">
      <div className="flex min-h-10 items-center justify-between gap-1">
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
      </div>
    </article>
  );
}
