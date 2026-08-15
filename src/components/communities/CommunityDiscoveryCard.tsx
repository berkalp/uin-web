import Link from "next/link";

import CommunityFollowButton from "@/components/communities/CommunityFollowButton";
import CommunityIcon from "@/components/communities/CommunityIcon";

import {
  communityAccentWithAlpha,
  getCommunityAccentForeground,
  getCommunityVisibleBorder,
  normalizeCommunityAccent,
  normalizeCommunitySecondary,
  type CommunityIconKey,
  type CommunityScopeType,
} from "@/utils/communities";

export type CommunityPlanningStyle =
  | "mostly_public"
  | "mixed"
  | "mostly_private"
  | "mostly_invite_only"
  | "not_enough_data";

export type CommunityDiscoveryRow = {
  community_id: string;
  community_name: string;
  community_slug: string;
  community_description: string | null;
  community_icon_key: CommunityIconKey;
  community_icon_url: string | null;
  community_accent_color: string;
  community_secondary_color: string | null;
  community_cover_image_url: string | null;
  community_scope_type: CommunityScopeType;
  category_id: string | null;
  category_name: string;
  category_ids: string[];
  category_names: string[];
  activity_ids: string[];
  activity_names: string[];
  is_following: boolean;
  follower_count: number | string;
  verified_member_count?: number | string;
  open_intent_count: number | string;
  planning_activity_count: number | string;
  completed_experience_count: number | string;
  planning_style: CommunityPlanningStyle;
  matching_intent_count: number | string;
  total_count: number | string;
};

type CommunityDiscoveryCardProps = {
  community: CommunityDiscoveryRow;
  showMatchingCount: boolean;
  openHref: string;
};

const compactNumberFormatter = new Intl.NumberFormat("en", {
  notation: "compact",
  maximumFractionDigits: 1,
});

function toCount(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCount(value: number) {
  return value < 1000
    ? String(value)
    : compactNumberFormatter.format(value);
}


export default function CommunityDiscoveryCard({
  community,
  showMatchingCount,
  openHref,
}: CommunityDiscoveryCardProps) {
  const accentColor = normalizeCommunityAccent(
    community.community_accent_color
  );

  const secondaryColor = normalizeCommunitySecondary(
    community.community_secondary_color
  );

  const brandSecondaryColor = secondaryColor ?? accentColor;
  const visibleBorder = getCommunityVisibleBorder(
    accentColor,
    secondaryColor
  );
  const accentForeground = getCommunityAccentForeground(accentColor);

  const followerCount = toCount(community.follower_count);
  const verifiedMemberCount = toCount(community.verified_member_count);
  const openIntentCount = toCount(community.open_intent_count);
  const planningActivityCount = toCount(
    community.planning_activity_count
  );
  const completedExperienceCount = toCount(
    community.completed_experience_count
  );
  const matchingIntentCount = toCount(
    community.matching_intent_count
  );

  const visibleActivityNames = (community.activity_names ?? []).slice(
    0,
    3
  );

  const extraActivityCount = Math.max(
    0,
    (community.activity_names ?? []).length - visibleActivityNames.length
  );

  const hasCover = Boolean(community.community_cover_image_url);

  const fallbackHeroBackground = `linear-gradient(135deg, ${communityAccentWithAlpha(
    accentColor,
    1
  )} 0%, ${communityAccentWithAlpha(
    accentColor,
    1
  )} 72%, ${communityAccentWithAlpha(
    brandSecondaryColor,
    1
  )} 72%, ${communityAccentWithAlpha(
    brandSecondaryColor,
    1
  )} 100%)`;

  const imageReadabilityOverlay =
    "linear-gradient(90deg, rgba(3, 9, 24, 0.72) 0%, rgba(3, 9, 24, 0.44) 54%, rgba(3, 9, 24, 0.16) 100%)";

  const imageBrandWash = `linear-gradient(135deg, ${communityAccentWithAlpha(
    accentColor,
    0.22
  )} 0%, ${communityAccentWithAlpha(
    accentColor,
    0.08
  )} 62%, transparent 100%)`;

  return (
    <article
      className="group relative flex min-h-[470px] flex-col overflow-hidden rounded-3xl border bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
      style={{ borderColor: visibleBorder }}
    >
      <Link
        href={openHref}
        aria-label={`Open ${community.community_name}`}
        className="absolute inset-0 z-0 rounded-3xl"
      />

      <div
        className="pointer-events-none relative isolate min-h-48 overflow-hidden px-5 py-5"
        style={{
          color: hasCover ? "#FFFFFF" : accentForeground,
          backgroundColor: accentColor,
        }}
      >
        {hasCover ? (
          <>
            <div
              aria-hidden="true"
              className="absolute inset-0 -z-30 bg-cover bg-center transition-transform duration-500 group-hover:scale-[1.045]"
              style={{
                backgroundImage: `url(${JSON.stringify(
                  community.community_cover_image_url
                )})`,
                backgroundPosition: "center",
                backgroundSize: "cover",
                filter: "brightness(0.82) contrast(1.08) saturate(1.12)",
              }}
            />

            <div
              aria-hidden="true"
              className="absolute inset-0 -z-20"
              style={{ backgroundImage: imageReadabilityOverlay }}
            />

            <div
              aria-hidden="true"
              className="absolute inset-0 -z-10"
              style={{ backgroundImage: imageBrandWash }}
            />

            <div
              aria-hidden="true"
              className="absolute inset-y-0 right-0 -z-[5] w-[34%]"
              style={{
                backgroundColor: communityAccentWithAlpha(
                  brandSecondaryColor,
                  0.82
                ),
                clipPath: "polygon(100% 0, 100% 100%, 0 100%)",
              }}
            />
          </>
        ) : (
          <div
            aria-hidden="true"
            className="absolute inset-0 -z-10"
            style={{ backgroundImage: fallbackHeroBackground }}
          />
        )}

        <div className="flex items-start justify-between gap-4">
          <div
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border shadow-sm backdrop-blur-sm"
            style={{
              backgroundColor: communityAccentWithAlpha(
                "#FFFFFF",
                hasCover ? 0.78 : 0.34
              ),
              borderColor: communityAccentWithAlpha("#FFFFFF", 0.68),
              boxShadow: hasCover
                ? "0 8px 24px rgba(0, 0, 0, 0.22)"
                : `inset 0 0 0 2px ${visibleBorder}`,
              color: hasCover ? accentColor : undefined,
            }}
          >
            <CommunityIcon
              iconKey={community.community_icon_key || "people"}
              iconUrl={community.community_icon_url}
              className="h-7 w-7"
            />
          </div>

          {community.is_following && (
            <span
              className="rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-wide backdrop-blur-sm"
              style={{
                borderColor: communityAccentWithAlpha(
                  accentForeground,
                  0.35
                ),
                backgroundColor: communityAccentWithAlpha(
                  accentForeground,
                  0.12
                ),
              }}
            >
              Following
            </span>
          )}
        </div>

        <div
          className="mt-8"
          style={
            hasCover
              ? { textShadow: "0 2px 10px rgba(0, 0, 0, 0.72)" }
              : undefined
          }
        >
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] opacity-90">
            {community.category_name}
          </p>
          <h2 className="mt-1 text-2xl font-black leading-tight">
            {community.community_name}
          </h2>
        </div>
      </div>

      <div className="pointer-events-none relative z-10 flex flex-1 flex-col p-5">
        <p className="line-clamp-2 min-h-12 text-sm leading-6 text-gray-500">
          {community.community_description ||
            "A curated UIN Community context."}
        </p>

        <div className="mt-4 flex min-h-14 flex-wrap content-start gap-2">
          {visibleActivityNames.length > 0 ? (
            <>
              {visibleActivityNames.map((activityName) => (
                <span
                  key={activityName}
                  className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-[11px] font-semibold text-gray-700"
                >
                  {activityName}
                </span>
              ))}

              {extraActivityCount > 0 && (
                <span className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-gray-500">
                  +{extraActivityCount} more
                </span>
              )}
            </>
          ) : (
            <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-[11px] font-semibold text-gray-600">
              {community.community_scope_type === "global"
                ? "All Activities"
                : community.category_name}
            </span>
          )}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 rounded-2xl bg-gray-50 p-3">
          <div className={`${verifiedMemberCount > 0 ? "" : "col-span-2"} rounded-xl bg-white p-3 shadow-sm`}>
            <p className="text-xl font-black text-gray-950">
              {formatCount(followerCount)}
            </p>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-gray-500">
              Followers
            </p>
          </div>

          {verifiedMemberCount > 0 && (
            <div className="rounded-xl bg-white p-3 shadow-sm">
              <p className="text-xl font-black text-gray-950">
                {formatCount(verifiedMemberCount)}
              </p>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                Verified members
              </p>
            </div>
          )}

          <div className="rounded-xl bg-white p-3 shadow-sm">
            <p className="text-lg font-black text-gray-950">
              {openIntentCount}
            </p>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-gray-500">
              Open
            </p>
          </div>

          <div className="rounded-xl bg-white p-3 shadow-sm">
            <p className="text-lg font-black text-gray-950">
              {planningActivityCount}
            </p>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-gray-500">
              Planning
            </p>
          </div>

          <div className="col-span-2 rounded-xl bg-white p-3 shadow-sm">
            <p className="text-lg font-black text-gray-950">
              {completedExperienceCount}
            </p>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-gray-500">
              Completed experiences
            </p>
          </div>
        </div>

        {showMatchingCount && (
          <div className="mt-3 rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700">
            {matchingIntentCount} current Intent
            {matchingIntentCount === 1 ? "" : "s"} match the selected eligibility or location.
          </div>
        )}

        <div className="pointer-events-auto relative z-20 mt-auto flex flex-wrap items-center gap-3 border-t border-gray-100 pt-5">
          <Link
            href={openHref}
            className="rounded-xl bg-gray-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-800"
          >
            Open Community
          </Link>

          <CommunityFollowButton
            communityId={community.community_id}
            communityName={community.community_name}
            initialIsFollowing={community.is_following}
            compact
          />

          <span
            aria-hidden="true"
            className="ml-auto h-3 w-3 rounded-full border"
            style={{
              backgroundColor: brandSecondaryColor,
              borderColor: visibleBorder,
            }}
          />
        </div>
      </div>
    </article>
  );
}
