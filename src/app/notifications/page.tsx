import Link from "next/link";
import { redirect } from "next/navigation";

import {
  MarkAllNotificationsReadButton,
  NotificationOpenButton,
} from "@/components/notifications/NotificationActions";
import NotificationsRealtimeRefresh from "@/components/notifications/NotificationsRealtimeRefresh";
import { createClient } from "@/utils/supabase/server";

type NotificationRow = {
  notification_id: string;
  notification_type: string;
  entity_type: string | null;
  entity_id: string | null;
  title: string;
  body: string | null;
  action_url: string | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;

  actor_user_id: string | null;
  actor_full_name: string | null;
  actor_username: string | null;
  actor_avatar_url: string | null;
};

function getInitial(
  value: string
) {
  return (
    value
      .trim()
      .charAt(0)
      .toUpperCase() || "N"
  );
}

function formatDateTime(
  value: string
) {
  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "Unknown time";
  }

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }
  ).format(date);
}

function getNotificationTone(
  type: string
) {
  if (
    type.includes(
      "feedback"
    )
  ) {
    return {
      border:
        "border-purple-200",
      badge:
        "bg-purple-50 text-purple-700",
      label:
        "Feedback",
    };
  }

  if (
    type.includes(
      "accepted"
    ) ||
    type.includes(
      "planned_activity"
    )
  ) {
    return {
      border:
        "border-green-200",
      badge:
        "bg-green-50 text-green-700",
      label:
        "Update",
    };
  }

  if (
    type.includes(
      "declined"
    ) ||
    type.includes(
      "revoked"
    )
  ) {
    return {
      border:
        "border-red-200",
      badge:
        "bg-red-50 text-red-700",
      label:
        "Resolved",
    };
  }

  if (
    type.includes(
      "invitation"
    )
  ) {
    return {
      border:
        "border-purple-200",
      badge:
        "bg-purple-50 text-purple-700",
      label:
        "Invitation",
    };
  }

  if (
    type.includes(
      "join_request"
    )
  ) {
    return {
      border:
        "border-blue-200",
      badge:
        "bg-blue-50 text-blue-700",
      label:
        "Join Request",
    };
  }

  return {
    border:
      "border-gray-200",
    badge:
      "bg-gray-100 text-gray-600",
    label:
      "Notification",
  };
}

export default async function NotificationsPage() {
  const supabase =
    await createClient();

  const {
    data: { user },
  } =
    await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  const {
    data,
    error,
  } = await supabase.rpc(
    "get_my_notifications",
    {
      p_limit: 100,
      p_offset: 0,
    }
  );

  if (error) {
    console.error(
      "Notification query failed:",
      error
    );
  }

  const notifications =
    (
      data ??
      []
    ) as NotificationRow[];

  const unreadCount =
    notifications.filter(
      (notification) =>
        !notification.is_read
    ).length;

  const unreadNotifications =
    notifications.filter(
      (notification) =>
        !notification.is_read
    );

  const readNotifications =
    notifications.filter(
      (notification) =>
        notification.is_read
    );

  function renderNotification(
    notification: NotificationRow
  ) {
    const actorName =
      notification.actor_full_name ||
      notification.actor_username ||
      "UIN";

    const tone =
      getNotificationTone(
        notification.notification_type
      );

    return (
      <article
        key={
          notification.notification_id
        }
        className={`rounded-3xl border bg-white p-5 shadow-sm ${tone.border} ${
          notification.is_read
            ? "opacity-75"
            : ""
        }`}
      >
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            {notification.actor_avatar_url ? (
              <img
                src={
                  notification.actor_avatar_url
                }
                alt={
                  actorName
                }
                className="h-14 w-14 shrink-0 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gray-100 text-lg font-bold text-gray-500">
                {getInitial(
                  actorName
                )}
              </div>
            )}

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${tone.badge}`}
                >
                  {tone.label}
                </span>

                {!notification.is_read && (
                  <span className="rounded-full bg-gray-950 px-3 py-1 text-xs font-semibold text-white">
                    New
                  </span>
                )}
              </div>

              <h2 className="mt-3 text-lg font-bold leading-7 text-gray-950">
                {
                  notification.title
                }
              </h2>

              {notification.body && (
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-gray-600">
                  {
                    notification.body
                  }
                </p>
              )}

              <p className="mt-3 text-xs text-gray-400">
                {formatDateTime(
                  notification.created_at
                )}
              </p>
            </div>
          </div>

          <NotificationOpenButton
            notificationId={
              notification.notification_id
            }
            actionUrl={
              notification.action_url
            }
            isRead={
              notification.is_read
            }
          />
        </div>
      </article>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8 md:px-6">
      <NotificationsRealtimeRefresh />

      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/timeline"
            className="text-sm font-semibold text-gray-600 transition hover:text-green-700"
          >
            ← Back to Timeline
          </Link>

          <MarkAllNotificationsReadButton
            disabled={
              unreadCount === 0
            }
          />
        </div>

        <header className="mt-8 rounded-[32px] border border-gray-200 bg-white p-6 shadow-sm md:p-8">
          <p className="text-xs font-semibold uppercase tracking-wide text-green-700">
            Activity Updates
          </p>

          <h1 className="mt-3 text-3xl font-bold text-gray-950 md:text-4xl">
            Notifications
          </h1>

          <p className="mt-3 max-w-3xl text-sm leading-7 text-gray-500">
            Invitations, participation
            requests and meaningful public
            updates from people you
            follow.
          </p>

          <div className="mt-6 flex flex-wrap gap-2">
            <span className="rounded-full bg-gray-950 px-4 py-2 text-sm font-semibold text-white">
              {unreadCount} unread
            </span>

            <span className="rounded-full bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-600">
              {
                notifications.length
              }{" "}
              total
            </span>
          </div>
        </header>

        {error && (
          <div className="mt-6 rounded-3xl border border-red-200 bg-red-50 p-6">
            <p className="font-semibold text-red-800">
              Notifications could not be
              loaded.
            </p>

            <p className="mt-2 text-sm text-red-700">
              {error.message}
            </p>
          </div>
        )}

        {!error &&
          notifications.length ===
            0 && (
            <section className="mt-8 rounded-3xl border border-gray-200 bg-white p-10 text-center shadow-sm">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-green-50 text-xl font-bold text-green-700">
                ✓
              </div>

              <h2 className="mt-5 text-xl font-bold text-gray-950">
                Nothing needs your attention
              </h2>

              <p className="mt-3 text-sm leading-7 text-gray-500">
                New invitations, join
                requests and followed
                activity updates will
                appear here.
              </p>
            </section>
          )}

        {!error &&
          unreadNotifications.length >
            0 && (
            <section className="mt-8">
              <p className="text-xs font-semibold uppercase tracking-wide text-green-700">
                New
              </p>

              <h2 className="mt-2 text-2xl font-bold text-gray-950">
                Unread Notifications
              </h2>

              <div className="mt-5 space-y-4">
                {unreadNotifications.map(
                  renderNotification
                )}
              </div>
            </section>
          )}

        {!error &&
          readNotifications.length >
            0 && (
            <section className="mt-10">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                History
              </p>

              <h2 className="mt-2 text-2xl font-bold text-gray-950">
                Earlier Notifications
              </h2>

              <div className="mt-5 space-y-4">
                {readNotifications.map(
                  renderNotification
                )}
              </div>
            </section>
          )}
      </div>
    </main>
  );
}
