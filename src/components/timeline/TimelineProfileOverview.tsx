import Link from "next/link";

import BadgeIcon from "@/components/badges/BadgeIcon";
import ProfileConnectionsFamilyPanel from "@/components/profile/ProfileConnectionsFamilyPanel";
import ProfilePresencePanel from "@/components/profile/ProfilePresencePanel";
import VerificationMark from "@/components/professionals/VerificationMark";
import {
  getBadgeScopeLabel,
  getBadgeToneClasses,
  type PublicBadge,
} from "@/utils/badges";
import type {
  ProfileConnectionSummary,
  RawFamilyData,
} from "@/utils/profileConnections";
import type {
  ProfileEmbed,
  ProfileLink,
} from "@/utils/profilePresence";
import {
  getReputationLevelClasses,
  getReputationLevelLabel,
  type PublicReputationSummary,
} from "@/utils/reputation";

type TimelineProfileOverviewProps = {
  profile: {
    fullName: string | null;
    username: string | null;
    avatarUrl: string | null;
    coverUrl: string | null;
    bio: string | null;
    city: string | null;
    country: string | null;
    createdAt: string | null;
  };
  identityVerified: boolean;
  badges: PublicBadge[];
  reputation: PublicReputationSummary;
  presence: {
    links: ProfileLink[];
    embeds: ProfileEmbed[];
  };
  connections: ProfileConnectionSummary | null;
  family: RawFamilyData;
};

function getInitial(value: string) {
  return value.trim().charAt(0).toUpperCase() || "?";
}

function formatMonthYear(value: string | null) {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat("en-GB", {
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatConfidence(value: string | null | undefined) {
  if (!value) return "—";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export default function TimelineProfileOverview({
  profile,
  identityVerified,
  badges,
  reputation,
  presence,
  connections,
  family,
}: TimelineProfileOverviewProps) {
  const displayName = profile.fullName || profile.username || "UIN member";
  const location = [profile.city, profile.country].filter(Boolean).join(", ");
  const joinedLabel = formatMonthYear(profile.createdAt);
  const global = reputation.global;
  const score =
    global?.overall_score !== null &&
    global?.overall_score !== undefined &&
    Number.isFinite(Number(global.overall_score))
      ? Math.round(Number(global.overall_score))
      : null;

  const visibleBadges = badges.slice(0, 6);

  return (
    <section className="mt-8 overflow-hidden rounded-[32px] border border-gray-200 bg-white shadow-sm">
      <div className="relative h-48 overflow-hidden bg-gradient-to-br from-gray-950 via-slate-900 to-green-950 md:h-60">
        {profile.coverUrl && (
          <img
            src={profile.coverUrl}
            alt=""
            className="h-full w-full object-cover opacity-85"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-gray-950/55 via-transparent to-transparent" />
      </div>

      <div className="relative px-5 pb-7 md:px-8">
        <div className="-mt-14 rounded-3xl border border-gray-200 bg-white p-5 shadow-lg md:p-7">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
            <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center">
              {profile.avatarUrl ? (
                <img
                  src={profile.avatarUrl}
                  alt={displayName}
                  className="h-24 w-24 shrink-0 rounded-full border-4 border-white object-cover shadow-lg"
                />
              ) : (
                <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full border-4 border-white bg-gray-100 text-3xl font-black text-gray-500 shadow-lg">
                  {getInitial(displayName)}
                </div>
              )}

              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-2">
                  <h2 className="truncate text-2xl font-black text-gray-950 md:text-3xl">
                    {displayName}
                  </h2>
                  {identityVerified && <VerificationMark />}
                </div>

                {profile.username && (
                  <p className="mt-1.5 text-sm text-gray-500">@{profile.username}</p>
                )}

                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs font-semibold text-gray-500">
                  {location && <span>📍 {location}</span>}
                  {joinedLabel && <span>Joined {joinedLabel}</span>}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href="/settings/profile"
                className="rounded-xl bg-green-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-green-700"
              >
                Edit Profile
              </Link>
              <Link
                href="/join-requests"
                className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-bold text-gray-700 transition hover:border-green-300 hover:text-green-700"
              >
                Join Requests
              </Link>
              <Link
                href="/friends"
                className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-bold text-blue-700 transition hover:bg-blue-100"
              >
                Friends
              </Link>
            </div>
          </div>

          <div className="mt-6 grid gap-5 border-t border-gray-100 pt-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.95fr)]">
            <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(290px,0.8fr)]">
              <div className="min-w-0 rounded-2xl border border-gray-100 bg-gray-50/70 p-5">
                <ProfilePresencePanel
                  links={presence.links}
                  embeds={presence.embeds}
                />

                {presence.links.length === 0 && presence.embeds.length === 0 && (
                  <p className="text-sm text-gray-400">
                    No public links or featured soundtrack yet.
                  </p>
                )}

                <div className="mt-5 border-t border-gray-200 pt-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-green-700">
                    About
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-gray-600">
                    {profile.bio || "No profile description yet."}
                  </p>
                </div>
              </div>

              <div className="min-w-0 rounded-2xl border border-gray-100 bg-white p-5">
                <ProfileConnectionsFamilyPanel
                  connections={connections}
                  family={family}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
              <article className="rounded-2xl border border-emerald-100 bg-emerald-50/45 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
                      Reliability
                    </p>
                    <h3 className="mt-1 text-lg font-black text-gray-950">
                      Your reputation
                    </h3>
                  </div>

                  {global ? (
                    <span
                      className={`rounded-full border px-3 py-1.5 text-xs font-black ${getReputationLevelClasses(
                        global.reputation_level
                      )}`}
                    >
                      {getReputationLevelLabel(global.reputation_level)}
                    </span>
                  ) : (
                    <span className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-gray-500">
                      New
                    </span>
                  )}
                </div>

                <div className="mt-4 flex items-center gap-4">
                  <div className="grid h-20 w-20 shrink-0 place-items-center rounded-full border-4 border-emerald-200 bg-white text-2xl font-black text-emerald-700 shadow-sm">
                    {score ?? "—"}
                  </div>

                  <div className="grid min-w-0 flex-1 grid-cols-2 gap-2 text-xs">
                    <div className="rounded-xl bg-white p-2.5">
                      <p className="text-gray-400">Completed</p>
                      <p className="mt-1 font-black text-gray-950">
                        {global?.activity_count ?? 0}
                      </p>
                    </div>
                    <div className="rounded-xl bg-white p-2.5">
                      <p className="text-gray-400">Attendance</p>
                      <p className="mt-1 font-black text-gray-950">
                        {global && global.attendance_observation_count >= 3
                          ? `${Math.round(global.attendance_rate ?? 0)}%`
                          : "—"}
                      </p>
                    </div>
                    <div className="rounded-xl bg-white p-2.5">
                      <p className="text-gray-400">Join again</p>
                      <p className="mt-1 font-black text-gray-950">
                        {global &&
                        global.feedback_count >= 3 &&
                        global.would_join_again_count !== null
                          ? `${global.would_join_again_count}/${global.feedback_count}`
                          : "—"}
                      </p>
                    </div>
                    <div className="rounded-xl bg-white p-2.5">
                      <p className="text-gray-400">Confidence</p>
                      <p className="mt-1 truncate font-black text-gray-950">
                        {formatConfidence(global?.confidence_level)}
                      </p>
                    </div>
                  </div>
                </div>
              </article>

              <article className="rounded-2xl border border-amber-100 bg-amber-50/40 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-700">
                      Badges
                    </p>
                    <h3 className="mt-1 text-lg font-black text-gray-950">
                      Recognitions
                    </h3>
                  </div>
                  <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-amber-800 shadow-sm">
                    {badges.length}
                  </span>
                </div>

                {visibleBadges.length > 0 ? (
                  <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-2">
                    {visibleBadges.map((badge) => {
                      const tone = getBadgeToneClasses(badge.tone);
                      const contextLabel = getBadgeScopeLabel({
                        scopeType: badge.scope_type,
                        categoryName: badge.category_name,
                        activityName: badge.activity_name,
                      });

                      return (
                        <div
                          key={badge.id}
                          title={badge.description}
                          className={`min-w-0 rounded-xl border p-2.5 ${tone.wrapper}`}
                        >
                          <div className="flex min-w-0 items-center gap-2">
                            <span
                              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${tone.icon}`}
                            >
                              <BadgeIcon
                                iconKey={badge.icon_key}
                                iconUrl={badge.icon_url}
                                className="h-4 w-4"
                                imageClassName="h-5 w-5 object-contain"
                              />
                            </span>
                            <div className="min-w-0">
                              <p className="truncate text-xs font-black">
                                {badge.name}
                              </p>
                              <p className="mt-0.5 truncate text-[9px] font-semibold uppercase tracking-wide opacity-60">
                                {contextLabel}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-gray-400">
                    No earned badges yet.
                  </p>
                )}

                {badges.length > visibleBadges.length && (
                  <p className="mt-3 text-xs font-semibold text-amber-800">
                    +{badges.length - visibleBadges.length} more badges on your profile.
                  </p>
                )}
              </article>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
