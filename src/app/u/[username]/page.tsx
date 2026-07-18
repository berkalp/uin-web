import Link from "next/link";
import { notFound } from "next/navigation";

import ClickableActivityCard from "@/components/activity/ClickableActivityCard";
import AdultPublicFamily, {
  type PublicFamilyData,
} from "@/components/family/AdultPublicFamily";
import ManagedMinorPublicProfile, {
  type ManagedMinorContext,
  type PublicGuardianRow,
} from "@/components/family/ManagedMinorPublicProfile";
import PublicIntentJoinButton from "@/components/intents/PublicIntentJoinButton";
import ReportButton from "@/components/moderation/ReportButton";
import ProfileFollowButton from "@/components/profile/ProfileFollowButton";
import FriendshipButton from "@/components/profile/FriendshipButton";
import {
  getActivityVisibilityLabel,
} from "@/utils/activityVisibility";
import { createClient } from "@/utils/supabase/server";

type PublicProfilePageProps = {
  params: Promise<{
    username: string;
  }>;
};

type ProfileData = {
  id: string;
  full_name: string | null;
  username: string;
  avatar_url: string | null;
  cover_url: string | null;
  bio: string | null;
  city: string | null;
  country: string | null;
  created_at: string;
};

type ActiveIntent = {
  id: string;
  activity_name: string;
  category_name: string;
  city: string;
  district: string;
  start_date: string;
  end_date: string;
  people: string;
  budget: number | null;
  recurrence: string;
  max_participants: number | null;
  recruitment_status:
    | "open"
    | "full";
  visibility:
    | "public"
    | "friends"
    | "except_friends"
    | "invite_only"
    | "private";
  viewer_can_request: boolean;
  viewer_invitation_status:
    | "pending"
    | "accepted"
    | "declined"
    | "revoked"
    | "expired"
    | null;
  viewer_join_request_status:
    | "pending"
    | "accepted"
    | "declined"
    | "withdrawn"
    | null;
  viewer_join_request_id: string | null;
};

type FormingActivity = {
  id: string;
  source_intent_id: string;
  title: string;
  activity_name: string;
  category_name: string;
  city: string | null;
  district: string | null;
  window_start: string;
  window_end: string;
  member_count: number;
  recruitment_status:
    | "open"
    | "full"
    | "closed";
  visibility:
    | "public"
    | "friends"
    | "except_friends"
    | "invite_only"
    | "private";
  viewer_can_request: boolean;
  viewer_is_member: boolean;
  viewer_invitation_status:
    | "pending"
    | "accepted"
    | "declined"
    | "revoked"
    | "expired"
    | null;
  viewer_join_request_status:
    | "pending"
    | "accepted"
    | "declined"
    | "withdrawn"
    | null;
  viewer_join_request_id: string | null;
};


type ScheduledActivity = {
  id: string;
  title: string;
  activity_name: string;
  category_name: string;
  city: string | null;
  district: string | null;
  scheduled_start: string;
  scheduled_end: string;
  timezone: string;
  meeting_point?: string | null;
  member_count: number;
  relationship:
    | "host"
    | "co_host"
    | "participant";
  attendance_status?:
    | "pending"
    | "attended"
    | "no_show"
    | null;
};

type ProfilePageData = {
  viewer: {
    is_authenticated: boolean;
    is_owner: boolean;
    is_following: boolean;
    friendship_id: string | null;
    friendship_status:
      | "pending"
      | "accepted"
      | "declined"
      | "removed"
      | null;
    friendship_direction:
      | "incoming"
      | "outgoing"
      | null;
  };

  profile: ProfileData;

  summary: {
    active_intents: number;
    forming_activities: number;
    upcoming_activities: number;
    completed_activities: number;
    private_archive:
      | {
          closed: number;
          expired: number;
          cancelled: number;
        }
      | null;
  };

  active_intents: ActiveIntent[];
  forming_activities: FormingActivity[];
  upcoming_activities: ScheduledActivity[];
  completed_activities: ScheduledActivity[];
};

function deduplicateById<
  Item extends {
    id: string;
  },
>(
  items: Item[]
) {
  const uniqueItems =
    new Map<
      string,
      Item
    >();

  for (const item of items) {
    if (
      !uniqueItems.has(
        item.id
      )
    ) {
      uniqueItems.set(
        item.id,
        item
      );
    }
  }

  return Array.from(
    uniqueItems.values()
  );
}


function getInitial(
  value: string | null
) {
  return (
    value
      ?.trim()
      .charAt(0)
      .toUpperCase() || "?"
  );
}

function formatMonthYear(
  value: string
) {
  return new Intl.DateTimeFormat(
    "en-GB",
    {
      month: "short",
      year: "numeric",
    }
  ).format(new Date(value));
}

function formatSchedule(
  value: string,
  timezone: string
) {
  try {
    return new Intl.DateTimeFormat(
      "en-GB",
      {
        timeZone: timezone,
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }
    ).format(
      new Date(value)
    );
  } catch {
    return new Date(
      value
    ).toLocaleString("en-GB");
  }
}

function SectionHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-green-700">
        {eyebrow}
      </p>

      <h2 className="mt-2 text-2xl font-bold text-gray-950">
        {title}
      </h2>

      <p className="mt-2 text-sm leading-6 text-gray-500">
        {description}
      </p>
    </div>
  );
}

export default async function PublicProfilePage({
  params,
}: PublicProfilePageProps) {
  const { username } =
    await params;

  const supabase =
    await createClient();

  const {
    data,
    error,
  } = await supabase.rpc(
    "get_public_profile_page_visibility",
    {
      p_username:
        decodeURIComponent(
          username
        ),
    }
  );

  if (
    error ||
    !data
  ) {
    console.error(
      "Public profile query failed:",
      error
    );

    notFound();
  }

  const rawPage =
    data as ProfilePageData;

  const activeIntents =
    deduplicateById(
      rawPage.active_intents
    );

  const formingActivities =
    deduplicateById(
      rawPage.forming_activities
    );

  const upcomingActivities =
    deduplicateById(
      rawPage.upcoming_activities
    );

  const completedActivities =
    deduplicateById(
      rawPage.completed_activities
    );

  const page: ProfilePageData = {
    ...rawPage,

    summary: {
      ...rawPage.summary,

      active_intents:
        activeIntents.length,

      forming_activities:
        formingActivities.length,

      upcoming_activities:
        upcomingActivities.length,

      completed_activities:
        completedActivities.length,
    },

    active_intents:
      activeIntents,

    forming_activities:
      formingActivities,

    upcoming_activities:
      upcomingActivities,

    completed_activities:
      completedActivities,
  };

  const profile =
    page.profile;

  const {
    data: minorContextData,
    error: minorContextError,
  } = await supabase.rpc(
    "get_public_minor_profile_context",
    {
      p_profile_user_id:
        profile.id,
    }
  );

  if (minorContextError) {
    console.error(
      "Managed minor profile context query failed:",
      minorContextError
    );
  }

  const minorContext =
    (
      minorContextData ??
      {
        is_managed_minor:
          false,
        age_state:
          "age_unverified",
        viewer_user_id:
          null,
        viewer_is_guardian:
          false,
        viewer_guardian_role:
          null,
        viewer_can_follow_guardians:
          false,
        guardian_count:
          0,
      }
    ) as ManagedMinorContext;

  if (minorContext.is_managed_minor) {
    const {
      data: guardianData,
      error: guardianError,
    } = await supabase.rpc(
      "get_public_profile_guardians",
      {
        p_child_user_id:
          profile.id,
      }
    );

    if (guardianError) {
      console.error(
        "Public guardian query failed:",
        guardianError
      );
    }

    return (
      <ManagedMinorPublicProfile
        profile={
          profile
        }
        context={
          minorContext
        }
        guardians={
          (
            guardianData ??
            []
          ) as PublicGuardianRow[]
        }
        viewerIsAuthenticated={
          page.viewer.is_authenticated
        }
        viewerIsOwner={
          page.viewer.is_owner
        }
      />
    );
  }


  const {
    data: publicFamilyData,
    error: publicFamilyError,
  } = await supabase.rpc(
    "get_public_profile_family",
    {
      p_profile_user_id:
        profile.id,
    }
  );

  if (publicFamilyError) {
    console.error(
      "Public family query failed:",
      publicFamilyError
    );
  }

  const publicFamily =
    (
      publicFamilyData ??
      {
        children: [],
        relationships: [],
      }
    ) as PublicFamilyData;

  const hasPublicFamily =
    publicFamily.children.length >
      0 ||
    publicFamily.relationships.length >
      0;

  const displayName =
    profile.full_name ||
    profile.username;

  const location = [
    profile.city,
    profile.country,
  ]
    .filter(Boolean)
    .join(", ");

  const hasTimelineContent =
    page.active_intents.length >
      0 ||
    page.forming_activities.length >
      0 ||
    page.upcoming_activities.length >
      0 ||
    page.completed_activities.length >
      0;

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-6 md:px-6 md:py-8">
      <div className="mx-auto max-w-7xl">
        <Link
          href="/timeline"
          className="text-sm font-semibold text-gray-600 transition hover:text-green-700"
        >
          ← Back to Timeline
        </Link>

        <section className="mt-6 overflow-hidden rounded-[32px] border border-gray-200 bg-white shadow-sm">
          <div className="relative h-64 bg-gradient-to-br from-gray-950 via-slate-900 to-green-950">
            {profile.cover_url && (
              <img
                src={
                  profile.cover_url
                }
                alt=""
                className="h-full w-full object-cover opacity-75"
              />
            )}

            <div className="absolute inset-0 bg-gradient-to-t from-gray-950/60 via-transparent to-transparent" />
          </div>

          <div className="relative px-6 pb-8 md:px-8">
            <div className="-mt-16 rounded-3xl border border-gray-200 bg-white p-6 shadow-lg">
              <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
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
                    <div className="flex h-28 w-28 shrink-0 items-center justify-center rounded-full border-4 border-white bg-gray-100 text-4xl font-bold text-gray-500 shadow-lg">
                      {getInitial(
                        displayName
                      )}
                    </div>
                  )}

                  <div className="min-w-0">
                    <h1 className="truncate text-3xl font-bold text-gray-950 md:text-4xl">
                      {displayName}
                    </h1>

                    <p className="mt-2 text-gray-500">
                      @
                      {
                        profile.username
                      }
                    </p>

                    <p className="mt-3 text-sm text-gray-400">
                      Joined{" "}
                      {formatMonthYear(
                        profile.created_at
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  {page.viewer.is_owner ? (
                    <>
                      <Link
                        href="/settings/profile"
                        className="rounded-xl bg-green-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-green-700"
                      >
                        Edit Profile
                      </Link>

                      <Link
                        href="/join-requests"
                        className="rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-gray-700 transition hover:border-green-300 hover:text-green-700"
                      >
                        Join Requests
                      </Link>

                      <Link
                        href="/friends"
                        className="rounded-xl border border-blue-200 bg-blue-50 px-5 py-3 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
                      >
                        Friends
                      </Link>
                    </>
                  ) : page.viewer.is_authenticated ? (
                    <>
                      <ProfileFollowButton
                        profileUserId={
                          profile.id
                        }
                        initialFollowing={
                          page.viewer.is_following
                        }
                      />

                      <FriendshipButton
                        profileUserId={
                          profile.id
                        }
                        initialFriendshipId={
                          page.viewer.friendship_id
                        }
                        initialStatus={
                          page.viewer.friendship_status
                        }
                        initialDirection={
                          page.viewer.friendship_direction
                        }
                      />

                      <ReportButton
                        targetType="user"
                        targetId={profile.id}
                        targetLabel={displayName}
                        variant="compact"
                      />
                    </>
                  ) : (
                    <Link
                      href="/"
                      className="rounded-xl bg-green-600 px-5 py-3 text-sm font-semibold text-white"
                    >
                      Sign in
                    </Link>
                  )}
                </div>
              </div>

              <div
                className={`mt-6 grid grid-cols-1 gap-5 border-t border-gray-100 pt-6 ${
                  hasPublicFamily
                    ? "lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.8fr)_300px]"
                    : "lg:grid-cols-[minmax(0,1fr)_300px]"
                }`}
              >
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-green-700">
                    About
                  </p>

                  <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-gray-600">
                    {profile.bio ||
                      "No profile description yet."}
                  </p>
                </div>

                {hasPublicFamily && (
                  <AdultPublicFamily
                    data={
                      publicFamily
                    }
                  />
                )}

                <aside className="rounded-2xl bg-gray-50 p-5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                    Profile Details
                  </p>

                  <div className="mt-4 space-y-3 text-sm text-gray-600">
                    {location && (
                      <p>
                        📍 {location}
                      </p>
                    )}

                    <p>
                      Active Intent updates
                      can be followed without
                      unlocking private
                      visibility.
                    </p>
                  </div>
                </aside>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[
            {
              label: "Active",
              value:
                page.summary.active_intents,
              tone: "green",
              href: "#active-intents",
            },
            {
              label: "Forming",
              value:
                page.summary.forming_activities,
              tone: "purple",
              href: "#forming-activities",
            },
            {
              label: "Upcoming",
              value:
                page.summary.upcoming_activities,
              tone: "blue",
              href: "#upcoming-activities",
            },
            {
              label: "Completed",
              value:
                page.summary.completed_activities,
              tone: "gray",
              href: "#completed-activities",
            },
          ].map(
            (metric) => {
              const classes = `rounded-3xl border bg-white p-5 shadow-sm transition ${
                metric.tone === "green"
                  ? "border-green-200"
                  : metric.tone === "purple"
                    ? "border-purple-200"
                    : metric.tone === "blue"
                      ? "border-blue-200"
                      : "border-gray-200"
              }`;

              if (
                metric.value === 0
              ) {
                return (
                  <div
                    key={
                      metric.label
                    }
                    className={`${classes} opacity-55`}
                  >
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                      {
                        metric.label
                      }
                    </p>

                    <p className="mt-3 text-3xl font-bold text-gray-950">
                      {
                        metric.value
                      }
                    </p>
                  </div>
                );
              }

              return (
                <Link
                  key={
                    metric.label
                  }
                  href={
                    metric.href
                  }
                  className={`${classes} group hover:-translate-y-0.5 hover:shadow-md`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                        {
                          metric.label
                        }
                      </p>

                      <p className="mt-3 text-3xl font-bold text-gray-950">
                        {
                          metric.value
                        }
                      </p>
                    </div>

                    <span className="text-lg text-gray-300 transition group-hover:translate-x-1 group-hover:text-gray-700">
                      →
                    </span>
                  </div>
                </Link>
              );
            }
          )}
        </section>

        {!hasTimelineContent && (
          <section className="mt-8 rounded-3xl border border-gray-200 bg-white p-10 text-center shadow-sm">
            <h2 className="text-xl font-bold text-gray-950">
              No visible activity yet
            </h2>
          </section>
        )}

        {page.active_intents.length >
          0 && (
          <section id="active-intents" className="mt-10 scroll-mt-8">
            <SectionHeader
              eyebrow="Active Intents"
              title={`${displayName} is open to opportunities`}
              description="Current public intentions that are still accepting participants."
            />

            <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
              {page.active_intents.map(
                (intent) => (
                  <ClickableActivityCard
                    key={
                      intent.id
                    }
                    href={`/activities/${encodeURIComponent(
                      intent.id
                    )}`}
                    ariaLabel={`Open ${intent.activity_name}`}
                    className="rounded-3xl border border-green-200 bg-white p-6 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-green-700">
                          Active Intent
                        </p>

                        <h3 className="mt-2 text-2xl font-bold text-gray-950">
                          {
                            intent.activity_name
                          }
                        </h3>

                        <p className="mt-1 text-sm text-gray-500">
                          {
                            intent.category_name
                          }
                        </p>
                      </div>

                      <div className="flex flex-wrap justify-end gap-2">
                        <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
                          {getActivityVisibilityLabel(
                            intent.visibility
                          )}
                        </span>

                        <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold capitalize text-green-700">
                          {
                            intent.recruitment_status
                          }
                        </span>
                      </div>
                    </div>

                    <div className="mt-5 rounded-2xl bg-gray-50 p-5 text-sm text-gray-600">
                      <p>
                        📅{" "}
                        {
                          intent.start_date
                        }{" "}
                        →{" "}
                        {intent.end_date}
                      </p>

                      <p className="mt-2">
                        📍{" "}
                        {
                          intent.district
                        }
                        , {intent.city}
                      </p>

                      <p className="mt-2">
                        👥{" "}
                        {intent.max_participants ===
                        null
                          ? "Unlimited capacity"
                          : `Capacity: ${intent.max_participants}`}
                      </p>

                      {intent.budget !==
                        null && (
                        <p className="mt-2">
                          💰{" "}
                          {
                            intent.budget
                          }{" "}
                          TL
                        </p>
                      )}
                    </div>

                    <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                      {!page.viewer.is_owner && (
                        <PublicIntentJoinButton
                          intentId={
                            intent.id
                          }
                          activityName={
                            intent.activity_name
                          }
                          recruitmentStatus={
                            intent.recruitment_status
                          }
                          visibility={
                            intent.visibility
                          }
                          viewerCanRequest={
                            intent.viewer_can_request
                          }
                          viewerInvitationStatus={
                            intent.viewer_invitation_status
                          }
                          initialRequestStatus={
                            intent.viewer_join_request_status
                          }
                          initialRequestId={
                            intent.viewer_join_request_id
                          }
                          isAuthenticated={
                            page.viewer.is_authenticated
                          }
                        />
                      )}

                      {page.viewer.is_authenticated &&
                        !page.viewer.is_owner && (
                        <ReportButton
                          targetType="intent"
                          targetId={intent.id}
                          targetLabel={
                            intent.activity_name
                          }
                          variant="compact"
                        />
                      )}
                    </div>
                  
                    <div className="mt-5 flex items-center justify-end text-sm font-semibold text-green-700">
                      View Activity
                      <span className="ml-2 transition group-hover:translate-x-1">
                        →
                      </span>
                    </div>
                  </ClickableActivityCard>
                )
              )}
            </div>
          </section>
        )}

        {page.forming_activities.length >
          0 && (
          <section id="forming-activities" className="mt-10 scroll-mt-8">
            <SectionHeader
              eyebrow="Forming Activities"
              title="Activities currently being planned"
              description="Shared Plans that have not reached a confirmed schedule yet."
            />

            <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
              {page.forming_activities.map(
                (activity) => (
                  <ClickableActivityCard
                    key={
                      activity.id
                    }
                    href={`/activities/${encodeURIComponent(
                      activity.id
                    )}`}
                    ariaLabel={`Open ${activity.title || activity.activity_name}`}
                    className="rounded-3xl border border-purple-200 bg-white p-6 shadow-sm"
                  >
                    <p className="text-xs font-semibold uppercase tracking-wide text-purple-700">
                      Planning in progress
                    </p>

                    <h3 className="mt-2 text-2xl font-bold text-gray-950">
                      {activity.title ||
                        activity.activity_name}
                    </h3>

                    <p className="mt-1 text-sm text-gray-500">
                      {
                        activity.category_name
                      }
                    </p>

                    <div className="mt-5 rounded-2xl bg-purple-50 p-5 text-sm text-purple-950">
                      <p>
                        📅{" "}
                        {
                          activity.window_start
                        }{" "}
                        →{" "}
                        {
                          activity.window_end
                        }
                      </p>

                      <p className="mt-2">
                        👥{" "}
                        {
                          activity.member_count
                        }{" "}
                        members
                      </p>

                      <p className="mt-2">
                        👁{" "}
                        {getActivityVisibilityLabel(
                          activity.visibility
                        )}
                      </p>

                      {activity.city &&
                        activity.district && (
                        <p className="mt-2">
                          📍{" "}
                          {
                            activity.district
                          }
                          ,{" "}
                          {
                            activity.city
                          }
                        </p>
                      )}
                    </div>

                    {!page.viewer.is_owner && (
                      <div className="mt-5">
                        <PublicIntentJoinButton
                          intentId={
                            activity.source_intent_id
                          }
                          planId={
                            activity.id
                          }
                          activityName={
                            activity.title ||
                            activity.activity_name
                          }
                          recruitmentStatus={
                            activity.recruitment_status ===
                            "full"
                              ? "full"
                              : "open"
                          }
                          visibility={
                            activity.visibility
                          }
                          viewerCanRequest={
                            activity.viewer_can_request
                          }
                          viewerIsMember={
                            activity.viewer_is_member
                          }
                          viewerInvitationStatus={
                            activity.viewer_invitation_status
                          }
                          initialRequestStatus={
                            activity.viewer_join_request_status
                          }
                          initialRequestId={
                            activity.viewer_join_request_id
                          }
                          isAuthenticated={
                            page.viewer.is_authenticated
                          }
                        />
                      </div>
                    )}
                  
                    <div className="mt-5 flex items-center justify-end text-sm font-semibold text-purple-700">
                      View Activity
                      <span className="ml-2 transition group-hover:translate-x-1">
                        →
                      </span>
                    </div>
                  </ClickableActivityCard>
                )
              )}
            </div>
          </section>
        )}

        {page.upcoming_activities.length >
          0 && (
          <section id="upcoming-activities" className="mt-10 scroll-mt-8">
            <SectionHeader
              eyebrow="Upcoming Activities"
              title="Confirmed activities"
              description="Public activities with a final schedule."
            />

            <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
              {page.upcoming_activities.map(
                (activity) => (
                  <ClickableActivityCard
                    key={
                      activity.id
                    }
                    href={`/activities/${encodeURIComponent(
                      activity.id
                    )}`}
                    ariaLabel={`Open ${activity.title || activity.activity_name}`}
                    className="rounded-3xl border border-blue-200 bg-white p-6 shadow-sm"
                  >
                    <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
                      Upcoming Activity
                    </p>

                    <h3 className="mt-2 text-2xl font-bold text-gray-950">
                      {activity.title ||
                        activity.activity_name}
                    </h3>

                    <p className="mt-1 text-sm text-gray-500">
                      {
                        activity.category_name
                      }
                    </p>

                    <div className="mt-5 rounded-2xl bg-blue-50 p-5 text-sm text-blue-950">
                      <p>
                        🕒{" "}
                        {formatSchedule(
                          activity.scheduled_start,
                          activity.timezone
                        )}
                      </p>

                      <p className="mt-2">
                        👥{" "}
                        {
                          activity.member_count
                        }{" "}
                        members
                      </p>

                      {activity.meeting_point && (
                        <p className="mt-2">
                          📍{" "}
                          {
                            activity.meeting_point
                          }
                        </p>
                      )}
                    </div>
                  
                    <div className="mt-5 flex items-center justify-end text-sm font-semibold text-blue-700">
                      View Activity
                      <span className="ml-2 transition group-hover:translate-x-1">
                        →
                      </span>
                    </div>
                  </ClickableActivityCard>
                )
              )}
            </div>
          </section>
        )}

        {page.completed_activities.length >
          0 && (
          <section id="completed-activities" className="mt-10 scroll-mt-8">
            <SectionHeader
              eyebrow="Completed Activities"
              title="Activity history"
              description="Public activities this person hosted or joined."
            />

            <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
              {page.completed_activities.map(
                (activity) => (
                  <ClickableActivityCard
                    key={
                      activity.id
                    }
                    href={`/activities/${encodeURIComponent(
                      activity.id
                    )}`}
                    ariaLabel={`Open ${activity.title || activity.activity_name}`}
                    className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                          Completed
                        </p>

                        <h3 className="mt-2 text-2xl font-bold text-gray-950">
                          {activity.title ||
                            activity.activity_name}
                        </h3>

                        <p className="mt-1 text-sm text-gray-500">
                          {
                            activity.category_name
                          }
                        </p>
                      </div>

                      <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold capitalize text-gray-600">
                        {
                          activity.relationship
                        }
                      </span>
                    </div>

                    <div className="mt-5 rounded-2xl bg-gray-50 p-5 text-sm text-gray-600">
                      <p>
                        Completed{" "}
                        {formatSchedule(
                          activity.scheduled_end,
                          activity.timezone
                        )}
                      </p>

                      <p className="mt-2">
                        👥{" "}
                        {
                          activity.member_count
                        }{" "}
                        members
                      </p>

                      {activity.attendance_status && (
                        <p className="mt-2 font-semibold">
                          Attendance:{" "}
                          {activity.attendance_status ===
                          "attended"
                            ? "Attended"
                            : activity.attendance_status ===
                                "no_show"
                              ? "Did not attend"
                              : "Not recorded"}
                        </p>
                      )}
                    </div>
                  
                    <div className="mt-5 flex items-center justify-end text-sm font-semibold text-gray-700">
                      View Activity Record
                      <span className="ml-2 transition group-hover:translate-x-1">
                        →
                      </span>
                    </div>
                  </ClickableActivityCard>
                )
              )}
            </div>
          </section>
        )}


        {page.viewer.is_owner &&
          page.summary.private_archive && (
          <section className="mt-10 rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
              Private Archive
            </p>

            <h2 className="mt-2 text-xl font-bold text-gray-950">
              Hidden from public view
            </h2>

            <div className="mt-5 grid grid-cols-3 gap-3">
              <div className="rounded-2xl bg-gray-50 p-4">
                <p className="text-xs text-gray-400">
                  Closed
                </p>

                <p className="mt-2 text-2xl font-bold text-gray-950">
                  {
                    page.summary.private_archive.closed
                  }
                </p>
              </div>

              <div className="rounded-2xl bg-gray-50 p-4">
                <p className="text-xs text-gray-400">
                  Expired
                </p>

                <p className="mt-2 text-2xl font-bold text-gray-950">
                  {
                    page.summary.private_archive.expired
                  }
                </p>
              </div>

              <div className="rounded-2xl bg-gray-50 p-4">
                <p className="text-xs text-gray-400">
                  Cancelled
                </p>

                <p className="mt-2 text-2xl font-bold text-gray-950">
                  {
                    page.summary.private_archive.cancelled
                  }
                </p>
              </div>
            </div>

            <Link
              href="/timeline"
              className="mt-5 inline-flex text-sm font-semibold text-green-700"
            >
              Open Personal Timeline →
            </Link>
          </section>
        )}
      </div>
    </main>
  );
}