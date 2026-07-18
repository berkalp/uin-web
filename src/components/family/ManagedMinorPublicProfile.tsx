import Link from "next/link";

import ReportButton from "@/components/moderation/ReportButton";
import ProfileFollowButton from "@/components/profile/ProfileFollowButton";

export type ManagedMinorProfileData = {
  id: string;
  full_name: string | null;
  username: string;
  avatar_url: string | null;
  cover_url: string | null;
  bio: string | null;
};

export type ManagedMinorContext = {
  is_managed_minor: boolean;
  age_state: string;
  viewer_user_id: string | null;
  viewer_is_guardian: boolean;
  viewer_guardian_role:
    | "primary_guardian"
    | "guardian"
    | null;
  viewer_can_follow_guardians: boolean;
  guardian_count: number;
};

export type PublicGuardianRow = {
  guardian_link_id: string;
  guardian_user_id: string;
  full_name: string | null;
  username: string;
  avatar_url: string | null;
  relationship:
    | "parent"
    | "legal_guardian";
  guardian_role:
    | "primary_guardian"
    | "guardian";
  viewer_is_following: boolean;
};

type ManagedMinorPublicProfileProps = {
  profile: ManagedMinorProfileData;
  context: ManagedMinorContext;
  guardians: PublicGuardianRow[];
  viewerIsAuthenticated: boolean;
  viewerIsOwner: boolean;
};

function getInitial(
  value: string
) {
  return (
    value
      .trim()
      .charAt(0)
      .toUpperCase() || "?"
  );
}

function getRelationshipLabel(
  relationship:
    | "parent"
    | "legal_guardian"
) {
  return relationship ===
    "parent"
    ? "Parent"
    : "Legal Guardian";
}

function getGuardianRoleLabel(
  role:
    | "primary_guardian"
    | "guardian"
) {
  return role ===
    "primary_guardian"
    ? "Primary Guardian"
    : "Guardian";
}

export default function ManagedMinorPublicProfile({
  profile,
  context,
  guardians,
  viewerIsAuthenticated,
  viewerIsOwner,
}: ManagedMinorPublicProfileProps) {
  const displayName =
    profile.full_name ||
    profile.username;

  const acceptedGuardianCount =
    guardians.length;

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-6 md:px-6 md:py-8">
      <div className="mx-auto max-w-6xl">
        <Link
          href="/timeline"
          className="text-sm font-semibold text-gray-600 transition hover:text-green-700"
        >
          ← Back to Timeline
        </Link>

        <section className="mt-6 overflow-hidden rounded-[32px] border border-gray-200 bg-white shadow-sm">
          <div className="relative h-64 overflow-hidden bg-gradient-to-br from-slate-950 via-blue-950 to-emerald-950 md:h-72">
            {profile.cover_url && (
              <img
                src={
                  profile.cover_url
                }
                alt=""
                className="h-full w-full object-cover opacity-75"
              />
            )}

            <div className="absolute inset-0 bg-gradient-to-t from-gray-950/75 via-gray-950/10 to-transparent" />

            <div className="absolute left-6 top-6 rounded-full border border-white/20 bg-gray-950/40 px-4 py-2 text-xs font-semibold text-white backdrop-blur-md">
              Protected Profile
            </div>
          </div>

          <div className="relative px-5 pb-6 md:px-8 md:pb-8">
            <div className="-mt-16 rounded-3xl border border-gray-200 bg-white p-5 shadow-lg md:p-7">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex min-w-0 flex-col gap-5 sm:flex-row sm:items-center">
                  {profile.avatar_url ? (
                    <img
                      src={
                        profile.avatar_url
                      }
                      alt={
                        displayName
                      }
                      className="h-28 w-28 shrink-0 rounded-full border-4 border-white object-cover shadow-lg"
                    />
                  ) : (
                    <div className="flex h-28 w-28 shrink-0 items-center justify-center rounded-full border-4 border-white bg-emerald-100 text-4xl font-bold text-emerald-700 shadow-lg">
                      {getInitial(
                        displayName
                      )}
                    </div>
                  )}

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-3">
                      <h1 className="truncate text-3xl font-bold text-gray-950 md:text-4xl">
                        {displayName}
                      </h1>

                      <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                        Managed Child Profile
                      </span>
                    </div>

                    <p className="mt-2 text-gray-500">
                      @
                      {
                        profile.username
                      }
                    </p>

                    <p className="mt-3 text-sm font-semibold text-gray-500">
                      Managed by{" "}
                      {
                        acceptedGuardianCount
                      }{" "}
                      accepted{" "}
                      {acceptedGuardianCount ===
                      1
                        ? "guardian"
                        : "guardians"}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  {(viewerIsOwner ||
                    context.viewer_is_guardian) && (
                    <Link
                      href="/settings/family"
                      className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
                    >
                      Family & Age Settings
                    </Link>
                  )}

                  {viewerIsAuthenticated &&
                    !viewerIsOwner && (
                    <ReportButton
                      targetType="user"
                      targetId={profile.id}
                      targetLabel={displayName}
                      variant="compact"
                    />
                  )}
                </div>
              </div>

              <div className="mt-6 flex flex-col gap-4 rounded-2xl border border-blue-100 bg-blue-50/70 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-lg shadow-sm">
                    🛡️
                  </div>

                  <div>
                    <p className="text-sm font-bold text-blue-950">
                      Protected profile
                    </p>

                    <p className="mt-1 text-sm leading-6 text-blue-900">
                      Following,
                      friendships, public
                      requests, live
                      Activities and precise
                      location are disabled.
                    </p>
                  </div>
                </div>

                <span className="shrink-0 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-blue-700 shadow-sm">
                  Under guardian management
                </span>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-green-700">
                Managed by
              </p>

              <h2 className="mt-2 text-2xl font-bold text-gray-950">
                Parents and guardians
              </h2>
            </div>

            {acceptedGuardianCount >
              0 && (
              <span className="rounded-full bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-600">
                {
                  acceptedGuardianCount
                }{" "}
                accepted
              </span>
            )}
          </div>

          {acceptedGuardianCount >
          0 ? (
            <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
              {guardians.map(
                (guardian) => {
                  const guardianName =
                    guardian.full_name ||
                    guardian.username;

                  return (
                    <article
                      key={
                        guardian.guardian_link_id
                      }
                      className="rounded-3xl border border-green-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                    >
                      <div className="flex items-start gap-4">
                        <Link
                          href={`/u/${encodeURIComponent(
                            guardian.username
                          )}`}
                          className="shrink-0"
                        >
                          {guardian.avatar_url ? (
                            <img
                              src={
                                guardian.avatar_url
                              }
                              alt={
                                guardianName
                              }
                              className="h-16 w-16 rounded-full object-cover"
                            />
                          ) : (
                            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-50 text-xl font-bold text-green-700">
                              {getInitial(
                                guardianName
                              )}
                            </div>
                          )}
                        </Link>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                              <Link
                                href={`/u/${encodeURIComponent(
                                  guardian.username
                                )}`}
                                className="block truncate text-lg font-bold text-gray-950 transition hover:text-green-700"
                              >
                                {
                                  guardianName
                                }
                              </Link>

                              <p className="mt-1 truncate text-sm text-gray-500">
                                @
                                {
                                  guardian.username
                                }
                              </p>
                            </div>

                            <Link
                              href={`/u/${encodeURIComponent(
                                guardian.username
                              )}`}
                              className="text-lg text-gray-300 transition hover:translate-x-1 hover:text-green-700"
                              aria-label={`Open ${guardianName}'s profile`}
                            >
                              →
                            </Link>
                          </div>

                          <p className="mt-3 text-sm font-semibold text-green-700">
                            {getRelationshipLabel(
                              guardian.relationship
                            )}
                            {" · "}
                            {getGuardianRoleLabel(
                              guardian.guardian_role
                            )}
                          </p>

                          <div className="mt-4 flex flex-wrap gap-3">
                            <Link
                              href={`/u/${encodeURIComponent(
                                guardian.username
                              )}`}
                              className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:border-green-300 hover:text-green-700"
                            >
                              View Profile
                            </Link>

                            {context.viewer_can_follow_guardians &&
                              context.viewer_user_id !==
                                guardian.guardian_user_id && (
                              <ProfileFollowButton
                                profileUserId={
                                  guardian.guardian_user_id
                                }
                                initialFollowing={
                                  guardian.viewer_is_following
                                }
                              />
                            )}
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                }
              )}
            </div>
          ) : (
            <div className="mt-5 rounded-3xl border border-amber-200 bg-amber-50 p-6">
              <h3 className="font-bold text-amber-950">
                Guardian setup is pending
              </h3>

              <p className="mt-2 text-sm leading-6 text-amber-800">
                This profile remains
                socially restricted until
                an adult guardian completes
                verification.
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}