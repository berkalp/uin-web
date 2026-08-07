import Link from "next/link";

import PublicIntentJoinButton from "@/components/intents/PublicIntentJoinButton";
import ReportButton from "@/components/moderation/ReportButton";
import {
  getActivityVisibilityLabel,
  type ActivityVisibility,
} from "@/utils/activityVisibility";
import { createClient } from "@/utils/supabase/server";

type ActivityDetailPageProps = {
  params: Promise<{
    resourceId: string;
  }>;
};

type ActivityDetailData = {
  resource_type: "intent" | "plan";

  viewer: {
    is_authenticated: boolean;
    is_owner: boolean;
    is_member: boolean;
    role: "host" | "co_host" | "participant" | null;
    can_request: boolean;
    invitation_status:
      | "pending"
      | "accepted"
      | "declined"
      | "revoked"
      | "expired"
      | null;
    join_request_status:
      | "pending"
      | "accepted"
      | "declined"
      | "withdrawn"
      | null;
    join_request_id: string | null;
  };

  activity: {
    resource_id: string;
    intent_id: string | null;
    plan_id: string | null;
    title: string;
    activity_name: string;
    category_name: string;
    description: string | null;
    status: string;
    visibility: ActivityVisibility;
    recruitment_status: "open" | "full" | "closed";
    city: string | null;
    district: string | null;
    window_start: string | null;
    window_end: string | null;
    scheduled_start: string | null;
    scheduled_end: string | null;
    timezone: string;
    meeting_point: string | null;
    member_count: number;
    participant_count: number;
    max_participants: number | null;
    budget: number | null;
    completed_at: string | null;
    host_user_id: string;
    host_full_name: string | null;
    host_username: string | null;
    host_avatar_url: string | null;
    viewer_attendance_status:
      | "pending"
      | "attended"
      | "no_show"
      | null;
  };
};

function isValidUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function getInitial(value: string) {
  return value.trim().charAt(0).toUpperCase() || "?";
}

function formatDate(value: string | null) {
  if (!value) {
    return "Not set";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatDateTime(
  value: string | null,
  timezone: string
) {
  if (!value) {
    return "Not set";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  try {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(date);
  } catch {
    return date.toLocaleString("en-GB");
  }
}

function getStatusPresentation(status: string) {
  if (status === "forming") {
    return {
      label: "Planning in progress",
      classes: "bg-purple-50 text-purple-700",
    };
  }

  if (status === "planned") {
    return {
      label: "Confirmed Activity",
      classes: "bg-blue-50 text-blue-700",
    };
  }

  if (status === "completed") {
    return {
      label: "Completed",
      classes: "bg-green-50 text-green-700",
    };
  }

  if (status === "cancelled") {
    return {
      label: "Cancelled",
      classes: "bg-red-50 text-red-700",
    };
  }

  return {
    label: "Active Intent",
    classes: "bg-green-50 text-green-700",
  };
}

export default async function ActivityDetailPage({
  params,
}: ActivityDetailPageProps) {
  const { resourceId } = await params;

  const supabase = await createClient();

  if (!resourceId || !isValidUuid(resourceId)) {
    return (
      <main className="min-h-screen bg-gray-50 px-4 py-8 md:px-6">
        <div className="mx-auto max-w-4xl">
          <Link
            href="/timeline"
            className="text-sm font-semibold text-gray-600 transition hover:text-green-700"
          >
            ← Back to Timeline
          </Link>

          <section className="mt-8 rounded-3xl border border-red-200 bg-white p-8 shadow-sm">
            <h1 className="text-2xl font-bold text-gray-950">
              Invalid Activity address
            </h1>
          </section>
        </div>
      </main>
    );
  }

  const { data, error } = await supabase.rpc(
    "get_activity_detail_page",
    {
      p_resource_id: resourceId,
    }
  );

  if (error || !data) {
    if (error) {
      console.error(
        "Activity detail query failed:",
        error
      );
    }

    return (
      <main className="min-h-screen bg-gray-50 px-4 py-8 md:px-6">
        <div className="mx-auto max-w-4xl">
          <Link
            href="/timeline"
            className="text-sm font-semibold text-gray-600 transition hover:text-green-700"
          >
            ← Back to Timeline
          </Link>

          <section className="mt-8 rounded-3xl border border-amber-200 bg-white p-8 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
              Activity Unavailable
            </p>

            <h1 className="mt-3 text-2xl font-bold text-gray-950">
              This Activity is not visible to you
            </h1>

            <p className="mt-3 text-sm leading-7 text-gray-600">
              It may be private, invite-only,
              restricted to friends or no longer
              available.
            </p>
          </section>
        </div>
      </main>
    );
  }

  const page = data as ActivityDetailData;

  const activity = page.activity;
  const viewer = page.viewer;

  const hostName =
    activity.host_full_name ||
    activity.host_username ||
    "UIN host";

  const status = getStatusPresentation(
    activity.status
  );

  const isForming = activity.status === "forming";

  const isPlannedOrCompleted =
    activity.status === "planned" ||
    activity.status === "completed";

  const roomHref = activity.plan_id
    ? isForming
      ? `/plans/${encodeURIComponent(
          activity.plan_id
        )}/planning`
      : `/plans/${encodeURIComponent(
          activity.plan_id
        )}/activity`
    : null;

  const scheduleLabel = activity.scheduled_start
    ? `${formatDateTime(
        activity.scheduled_start,
        activity.timezone
      )} → ${formatDateTime(
        activity.scheduled_end,
        activity.timezone
      )}`
    : `${formatDate(
        activity.window_start
      )} → ${formatDate(activity.window_end)}`;

  const reportTargetId =
    activity.plan_id ?? activity.intent_id;

  const reportTargetType:
    | "plan"
    | "intent" = activity.plan_id
    ? "plan"
    : "intent";

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8 md:px-6">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link
            href={
              activity.host_username
                ? `/u/${encodeURIComponent(
                    activity.host_username
                  )}`
                : "/timeline"
            }
            className="text-sm font-semibold text-gray-600 transition hover:text-green-700"
          >
            ← Back to Profile
          </Link>

          <div className="flex flex-wrap gap-3">
            {viewer.is_member && roomHref && (
              <Link
                href={roomHref}
                className="rounded-xl bg-green-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-green-700"
              >
                {isForming
                  ? "Open Planning Room"
                  : "Open Activity Room"}
              </Link>
            )}

            {viewer.is_owner &&
              activity.intent_id && (
                <Link
                  href={`/intents/${encodeURIComponent(
                    activity.intent_id
                  )}/visibility`}
                  className="rounded-xl border border-indigo-200 bg-indigo-50 px-5 py-3 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100"
                >
                  Manage Visibility
                </Link>
              )}
          </div>
        </div>

        <section className="mt-8 overflow-hidden rounded-[32px] border border-gray-200 bg-white shadow-sm">
          <div className="bg-gradient-to-br from-gray-950 via-slate-900 to-green-950 px-6 py-10 text-white md:px-8">
            <div className="flex flex-wrap items-start justify-between gap-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-green-300">
                  {activity.category_name}
                </p>

                <h1 className="mt-3 text-3xl font-bold md:text-5xl">
                  {activity.title}
                </h1>

                <p className="mt-3 text-sm text-white/65">
                  {activity.activity_name}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <span
                  className={`rounded-full px-4 py-2 text-xs font-semibold ${status.classes}`}
                >
                  {status.label}
                </span>

                <span className="rounded-full bg-white/10 px-4 py-2 text-xs font-semibold text-white">
                  {getActivityVisibilityLabel(
                    activity.visibility
                  )}
                </span>

                <span className="rounded-full bg-white/10 px-4 py-2 text-xs font-semibold capitalize text-white">
                  {activity.recruitment_status}
                </span>
              </div>
            </div>
          </div>

          <div className="p-6 md:p-8">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div>
                <section className="rounded-3xl border border-gray-200 bg-gray-50 p-6">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                    Schedule
                  </p>

                  <p className="mt-3 text-lg font-bold text-gray-950">
                    {scheduleLabel}
                  </p>

                  {(activity.meeting_point ||
                    activity.city ||
                    activity.district) && (
                    <p className="mt-3 text-sm leading-6 text-gray-600">
                      📍{" "}
                      {activity.meeting_point ||
                        [
                          activity.district,
                          activity.city,
                        ]
                          .filter(Boolean)
                          .join(", ")}
                    </p>
                  )}
                </section>

                {activity.description && (
                  <section className="mt-5 rounded-3xl border border-gray-200 bg-white p-6">
                    <p className="text-xs font-semibold uppercase tracking-wide text-green-700">
                      About this Activity
                    </p>

                    <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-gray-600">
                      {activity.description}
                    </p>
                  </section>
                )}

                <section className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-4">
                  <div className="rounded-2xl border border-gray-200 bg-white p-5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                      Plan Members
                    </p>

                    <p className="mt-3 text-2xl font-bold text-gray-950">
                      {activity.member_count}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-gray-200 bg-white p-5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                      Participants
                    </p>

                    <p className="mt-3 text-2xl font-bold text-gray-950">
                      {activity.participant_count}
                      {activity.max_participants !==
                      null
                        ? ` / ${activity.max_participants}`
                        : ""}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-gray-200 bg-white p-5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                      Visibility
                    </p>

                    <p className="mt-3 text-sm font-bold text-gray-950">
                      {getActivityVisibilityLabel(
                        activity.visibility
                      )}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-gray-200 bg-white p-5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                      Budget
                    </p>

                    <p className="mt-3 text-sm font-bold text-gray-950">
                      {activity.budget !== null
                        ? `${Number(
                            activity.budget
                          ).toLocaleString(
                            "en-US"
                          )} TL`
                        : "Not set"}
                    </p>
                  </div>
                </section>

                {activity.status ===
                  "completed" && (
                  <section className="mt-5 rounded-3xl border border-green-200 bg-green-50 p-6">
                    <p className="text-xs font-semibold uppercase tracking-wide text-green-700">
                      Activity Record
                    </p>

                    <h2 className="mt-2 text-xl font-bold text-green-950">
                      Completed Activity
                    </h2>

                    {activity.viewer_attendance_status && (
                      <p className="mt-3 text-sm font-semibold text-green-800">
                        Your attendance:{" "}
                        {activity.viewer_attendance_status ===
                        "attended"
                          ? "Attended"
                          : activity.viewer_attendance_status ===
                              "no_show"
                            ? "Did not attend"
                            : "Not recorded"}
                      </p>
                    )}
                  </section>
                )}
              </div>

              <aside className="h-fit space-y-5">
                <section className="rounded-3xl border border-cyan-200 bg-cyan-50 p-5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-cyan-700">
                    Hosted by
                  </p>

                  <div className="mt-4 flex items-center gap-4">
                    {activity.host_avatar_url ? (
                      <img
                        src={activity.host_avatar_url}
                        alt={hostName}
                        className="h-14 w-14 rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-xl font-bold text-cyan-700">
                        {getInitial(hostName)}
                      </div>
                    )}

                    <div className="min-w-0">
                      {activity.host_username ? (
                        <Link
                          href={`/u/${encodeURIComponent(
                            activity.host_username
                          )}`}
                          className="block truncate font-bold text-gray-950 transition hover:text-green-700"
                        >
                          {hostName}
                        </Link>
                      ) : (
                        <p className="truncate font-bold text-gray-950">
                          {hostName}
                        </p>
                      )}

                      {activity.host_username && (
                        <p className="mt-1 truncate text-sm text-gray-500">
                          @{activity.host_username}
                        </p>
                      )}
                    </div>
                  </div>
                </section>

                {!viewer.is_owner &&
                  activity.intent_id &&
                  !isPlannedOrCompleted && (
                    <section className="rounded-3xl border border-green-200 bg-white p-5 shadow-sm">
                      <p className="text-xs font-semibold uppercase tracking-wide text-green-700">
                        Participation
                      </p>

                      <p className="mt-3 text-sm leading-6 text-gray-600">
                        Request access without
                        seeing private Planning
                        Room messages.
                      </p>

                      <div className="mt-5">
                        <PublicIntentJoinButton
                          intentId={
                            activity.intent_id
                          }
                          planId={activity.plan_id}
                          activityName={
                            activity.title
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
                            viewer.can_request
                          }
                          viewerIsMember={
                            viewer.is_member
                          }
                          viewerInvitationStatus={
                            viewer.invitation_status
                          }
                          initialRequestStatus={
                            viewer.join_request_status
                          }
                          initialRequestId={
                            viewer.join_request_id
                          }
                          isAuthenticated={
                            viewer.is_authenticated
                          }
                        />
                      </div>
                    </section>
                  )}

                <section className="rounded-3xl border border-gray-200 bg-white p-5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                    Privacy Boundary
                  </p>

                  <p className="mt-3 text-sm leading-7 text-gray-600">
                    Activity details follow the
                    selected audience. Planning
                    Room messages, member
                    management, invitation
                    history and budget
                    commitments stay
                    members-only.
                  </p>
                </section>

                {viewer.is_authenticated &&
                  !viewer.is_owner &&
                  reportTargetId && (
                    <ReportButton
                      targetType={
                        reportTargetType
                      }
                      targetId={reportTargetId}
                      targetLabel={
                        activity.title
                      }
                      variant="compact"
                    />
                  )}
              </aside>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}