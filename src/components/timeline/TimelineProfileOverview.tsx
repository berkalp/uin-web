import Link from "next/link";

import TimelineProfileDetailsShell from "@/components/timeline/TimelineProfileDetailsShell";

import ProfileConnectionsFamilyPanel from "@/components/profile/ProfileConnectionsFamilyPanel";
import ProfilePresencePanel from "@/components/profile/ProfilePresencePanel";
import VerificationMark from "@/components/professionals/VerificationMark";
import type {
  ProfileConnectionSummary,
  RawFamilyData,
} from "@/utils/profileConnections";
import {
  buildYouTubeEmbedUrl,
  type ProfileEmbed,
  type ProfileLink,
} from "@/utils/profilePresence";

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

export default function TimelineProfileOverview({
  profile,
  identityVerified,
  presence,
  connections,
  family,
}: TimelineProfileOverviewProps) {
  const displayName = profile.fullName || profile.username || "UIN member";
  const location = [profile.city, profile.country].filter(Boolean).join(", ");
  const joinedLabel = formatMonthYear(profile.createdAt);
  const youtubeEmbedUrl = buildYouTubeEmbedUrl(
    presence.embeds.find((embed) => embed.provider === "youtube")?.source_url
  );
  const profileHref = profile.username
    ? `/u/${encodeURIComponent(profile.username)}`
    : null;

  return (
    <TimelineProfileDetailsShell>
      <section className="overflow-hidden rounded-[32px] border border-gray-200 bg-white shadow-sm">
      <div
        className={`grid overflow-hidden bg-gray-950 ${
          youtubeEmbedUrl ? "md:grid-cols-2" : ""
        }`}
      >
        <div className="relative h-48 overflow-hidden bg-gradient-to-br from-gray-950 via-slate-900 to-green-950 md:h-64">
          {profile.coverUrl && (
            <img
              src={profile.coverUrl}
              alt=""
              className="h-full w-full object-cover opacity-85"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-gray-950/55 via-transparent to-transparent" />
        </div>

        {youtubeEmbedUrl && (
          <div className="relative aspect-video overflow-hidden border-t border-white/10 bg-black md:aspect-auto md:h-64 md:border-l md:border-t-0">
            <iframe
              title="Featured YouTube video"
              src={youtubeEmbedUrl}
              className="absolute inset-0 h-full w-full border-0"
              loading="lazy"
              referrerPolicy="strict-origin-when-cross-origin"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
            <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-black/65 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white backdrop-blur">
              Featured video
            </span>
          </div>
        )}
      </div>

      <div className="relative px-5 pb-7 md:px-8">
        <div className="-mt-14 rounded-3xl border border-gray-200 bg-white p-5 shadow-lg md:p-7">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
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
              {profileHref && (
                <Link
                  href={profileHref}
                  className="rounded-xl border border-green-200 bg-green-50 px-4 py-2.5 text-sm font-bold text-green-800 transition hover:border-green-400 hover:bg-green-100"
                >
                  View Profile
                </Link>
              )}
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
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 border-t border-gray-100 pt-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.9fr)_minmax(280px,0.72fr)]">
            <div className="min-w-0">
              <ProfilePresencePanel
                links={presence.links}
                embeds={presence.embeds}
              />

              {presence.links.length === 0 &&
                presence.embeds.every((embed) => embed.provider !== "spotify") && (
                  <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-5 text-sm text-gray-400">
                    No public links or featured soundtrack yet.
                  </div>
                )}
            </div>

            <ProfileConnectionsFamilyPanel
              connections={connections}
              family={family}
              metricLinks={{
                followers: "/connections?view=followers",
                following: "/connections?view=following",
                friends: "/connections?view=friends",
              }}
            />

            <aside className="rounded-2xl bg-gray-50 p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-green-700">
                About
              </p>

              <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-gray-600">
                {profile.bio || "No profile description yet."}
              </p>

              {location && (
                <p className="mt-5 border-t border-gray-200 pt-4 text-sm font-semibold text-gray-600">
                  📍 {location}
                </p>
              )}
            </aside>
          </div>
        </div>
      </div>
      </section>
    </TimelineProfileDetailsShell>
  );
}
