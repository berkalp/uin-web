import AppNavigation from "@/components/navigation/AppNavigation";
import PageDataUnavailable from "@/components/common/PageDataUnavailable";
import Link from "next/link";
import { redirect } from "next/navigation";
import { isAuthSessionMissingError } from "@supabase/supabase-js";

import {
  MarkAllNotificationsReadButton,
  NotificationOpenButton,
} from "@/components/notifications/NotificationActions";
import InboxSectionNav from "@/components/inbox/InboxSectionNav";
import NotificationsRealtimeRefresh from "@/components/notifications/NotificationsRealtimeRefresh";
import { createClient } from "@/utils/supabase/server";
import { commonIntentTitle } from "@/utils/commonIntentTitle";

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

type NotificationPagePayload = {
  items?: NotificationRow[];
  total_count?: number | string;
  unread_count?: number | string;
  limit?: number | string;
  offset?: number | string;
};

type NotificationsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const PAGE_SIZE = 10;
const CARD_UPDATE_TYPES = new Set([
  "uin_card_new_intent",
  "uin_card_new_experience",
  "uin_card_new_event",
]);

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isNotificationCount(value: unknown) {
  if (
    (typeof value !== "number" && typeof value !== "string") ||
    (typeof value === "string" && !value.trim())
  ) {
    return false;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && Number.isInteger(parsed) && parsed >= 0;
}

function isNotificationRow(value: unknown): value is NotificationRow {
  if (!isRecord(value)) return false;

  return (
    typeof value.notification_id === "string" &&
    typeof value.notification_type === "string" &&
    isNullableString(value.entity_type) &&
    isNullableString(value.entity_id) &&
    typeof value.title === "string" &&
    isNullableString(value.body) &&
    isNullableString(value.action_url) &&
    typeof value.is_read === "boolean" &&
    isNullableString(value.read_at) &&
    typeof value.created_at === "string" &&
    isNullableString(value.actor_user_id) &&
    isNullableString(value.actor_full_name) &&
    isNullableString(value.actor_username) &&
    isNullableString(value.actor_avatar_url)
  );
}

function isCollaborationChatRouteRow(
  value: unknown
): value is { suggestion_id: string } {
  return isRecord(value) && typeof value.suggestion_id === "string";
}

function getInitial(value: string) {
  return value.trim().charAt(0).toUpperCase() || "N";
}

function formatDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Bilinmeyen zaman";
  }

  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

function isCardUpdateNotification(type: string) {
  return CARD_UPDATE_TYPES.has(type);
}

function getNotificationTone(type: string) {
  if (type === "uin_card_new_intent") {
    return {
      border: "border-emerald-200",
      badge: "bg-emerald-50 text-emerald-700",
      label: "Kart · Yeni niyet",
    };
  }

  if (type === "uin_card_new_experience") {
    return {
      border: "border-violet-200",
      badge: "bg-violet-50 text-violet-700",
      label: "Kart · Yeni deneyim",
    };
  }

  if (type === "uin_card_new_event") {
    return {
      border: "border-amber-200",
      badge: "bg-amber-50 text-amber-800",
      label: "Kart · Yeni etkinlik",
    };
  }

  if (type.includes("feedback")) {
    return {
      border: "border-purple-200",
      badge: "bg-purple-50 text-purple-700",
      label: "Geri Bildirim",
    };
  }

  if (type.includes("accepted") || type.includes("planned_activity")) {
    return {
      border: "border-green-200",
      badge: "bg-green-50 text-green-700",
      label: "Güncelleme",
    };
  }

  if (type.includes("declined") || type.includes("revoked")) {
    return {
      border: "border-red-200",
      badge: "bg-red-50 text-red-700",
      label: "Sonuçlandı",
    };
  }

  if (type.includes("invitation")) {
    return {
      border: "border-purple-200",
      badge: "bg-purple-50 text-purple-700",
      label: "Davet",
    };
  }

  if (type.includes("join_request")) {
    return {
      border: "border-blue-200",
      badge: "bg-blue-50 text-blue-700",
      label: "Katılım İsteği",
    };
  }

  return {
    border: "border-gray-200",
    badge: "bg-gray-100 text-gray-600",
    label: "Bildirim",
  };
}

function localizedNotificationTitle(title: string) {
  const match = title.match(/^(.*?)\s+wants to join\s+(.+)$/i);
  if (!match) return title;
  return `${match[1].trim()}, “${commonIntentTitle(match[2])}” etkinliğine katılmak istiyor`;
}

function localizedNotificationBody(type: string, body: string | null) {
  if (!body) return null;
  if (type.includes("join_request") && /(open|review|accept|decline|join request)/i.test(body)) {
    return "Katılım isteğini incelemek, kabul etmek veya reddetmek için aç.";
  }
  return body;
}

function pageHref(page: number) {
  return page <= 1 ? "/notifications" : `/notifications?page=${page}`;
}

export default async function NotificationsPage({
  searchParams,
}: NotificationsPageProps) {
  const resolvedSearchParams = await searchParams;
  const requestedPage = Math.max(
    1,
    Math.trunc(
      toNumber(
        Array.isArray(resolvedSearchParams.page)
          ? resolvedSearchParams.page[0]
          : resolvedSearchParams.page,
        1
      )
    )
  );

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError && !isAuthSessionMissingError(userError)) {
    console.error("Notification session query failed:", userError);
    return (
      <PageDataUnavailable
        title="Bildirimler şu anda yüklenemedi"
        retryHref={pageHref(requestedPage)}
        backHref="/timeline"
        backLabel="Listeye dön"
      />
    );
  }

  if (!user) {
    redirect("/");
  }

  const offset = (requestedPage - 1) * PAGE_SIZE;
  const { data, error: queryError } = await supabase.rpc(
    "get_my_update_notifications_page",
    {
      p_limit: PAGE_SIZE,
      p_offset: offset,
    }
  );

  const payloadValid = Boolean(
    isRecord(data) &&
    Array.isArray(data.items) &&
    data.items.every(isNotificationRow) &&
    isNotificationCount(data.total_count) &&
    isNotificationCount(data.unread_count)
  );
  const error = queryError ?? (
    payloadValid ? null : new Error("Notification payload was incomplete.")
  );

  if (error) {
    console.error("Notification query failed:", error);
  }

  const payload = (payloadValid ? data : {}) as NotificationPagePayload;
  const notifications = Array.isArray(payload.items) ? payload.items : [];
  const totalCount = Math.max(0, toNumber(payload.total_count));
  const unreadCount = Math.max(0, toNumber(payload.unread_count));
  const pageCount = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  if (!error && totalCount > 0 && requestedPage > pageCount) {
    redirect(pageHref(pageCount));
  }

  const collaborationIds = notifications
    .filter((item) => item.notification_type.startsWith("personal_intent_collaboration") && item.entity_id)
    .map((item) => item.entity_id as string);
  const chatRoutes = new Map<string, string>();
  let collaborationRouteReadFailed = false;
  if (collaborationIds.length) {
    const { data: chats, error: chatsError } = await supabase
      .from("personal_intent_collaboration_chats")
      .select("suggestion_id")
      .in("suggestion_id", collaborationIds);
    if (
      chatsError ||
      !Array.isArray(chats) ||
      !chats.every(isCollaborationChatRouteRow)
    ) {
      collaborationRouteReadFailed = true;
      console.error(
        "Collaboration notification route query failed:",
        chatsError ?? "Incomplete route payload"
      );
    } else {
      for (const row of chats) chatRoutes.set(row.suggestion_id, `/collaboration-chat/${row.suggestion_id}`);
      for (const id of collaborationIds) if (!chatRoutes.has(id)) chatRoutes.set(id, `/collaboration-suggestions?focus=${id}`);
    }
  }

  const cardNotifications = notifications.filter((notification) =>
    isCardUpdateNotification(notification.notification_type)
  );
  const otherNotifications = notifications.filter((notification) =>
    !isCardUpdateNotification(notification.notification_type)
  );

  function renderNotification(notification: NotificationRow) {
    const actorName =
      notification.actor_full_name || notification.actor_username || "UIN";
    const tone = getNotificationTone(notification.notification_type);
    const displayTitle = localizedNotificationTitle(notification.title);
    const displayBody = localizedNotificationBody(notification.notification_type, notification.body);
    const actionUrl = !collaborationRouteReadFailed && notification.entity_id && chatRoutes.get(notification.entity_id)
      ? chatRoutes.get(notification.entity_id)!
      : notification.action_url;

    return (
      <article
        key={notification.notification_id}
        className={`rounded-3xl border bg-white p-5 shadow-sm ${tone.border} ${
          notification.is_read ? "opacity-75" : ""
        }`}
      >
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            {notification.actor_avatar_url ? (
              <img
                src={notification.actor_avatar_url}
                alt={actorName}
                className="h-14 w-14 shrink-0 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gray-100 text-lg font-bold text-gray-500">
                {getInitial(actorName)}
              </div>
            )}

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${tone.badge}`}>
                  {tone.label}
                </span>

                {!notification.is_read && (
                  <span className="rounded-full bg-gray-950 px-3 py-1 text-xs font-semibold text-white">
                    Yeni
                  </span>
                )}
              </div>

              <h2 className="mt-3 text-lg font-bold leading-7 text-gray-950">
                {displayTitle}
              </h2>

              {displayBody && (
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-gray-600">
                  {displayBody}
                </p>
              )}

              <p className="mt-3 text-xs text-gray-400">
                {formatDateTime(notification.created_at)}
              </p>
            </div>
          </div>

          <NotificationOpenButton
            notificationId={notification.notification_id}
            actionUrl={actionUrl}
            isRead={notification.is_read}
          />
        </div>
      </article>
    );
  }

  function renderNotificationSection({
    id,
    eyebrow,
    title,
    description,
    items,
    emptyTitle,
    emptyDescription,
    accent,
  }: {
    id: string;
    eyebrow: string;
    title: string;
    description: string;
    items: NotificationRow[];
    emptyTitle: string;
    emptyDescription: string;
    accent: "emerald" | "slate";
  }) {
    const unreadItems = items.filter((notification) => !notification.is_read);
    const readItems = items.filter((notification) => notification.is_read);
    const accentClasses = accent === "emerald"
      ? "border-emerald-200 bg-emerald-50/60 text-emerald-800"
      : "border-slate-200 bg-slate-50 text-slate-700";

    return (
      <section id={id} className="scroll-mt-24 pt-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className={`text-xs font-bold uppercase tracking-[0.16em] ${accent === "emerald" ? "text-emerald-700" : "text-slate-500"}`}>
              {eyebrow}
            </p>
            <h2 className="mt-2 text-2xl font-bold text-gray-950">{title}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-500">{description}</p>
          </div>
          <span className={`rounded-full border px-3 py-1.5 text-xs font-bold ${accentClasses}`}>
            {items.length} bu sayfada{unreadItems.length > 0 ? ` · ${unreadItems.length} yeni` : ""}
          </span>
        </div>

        {items.length === 0 ? (
          <div className="mt-4 rounded-3xl border border-dashed border-gray-300 bg-white p-8 text-center shadow-sm">
            <h3 className="font-bold text-gray-950">{emptyTitle}</h3>
            <p className="mt-2 text-sm leading-6 text-gray-500">{emptyDescription}</p>
          </div>
        ) : (
          <div className="mt-5 space-y-7">
            {unreadItems.length > 0 && (
              <div>
                <h3 className="text-sm font-black text-gray-900">Yeni</h3>
                <div className="mt-3 space-y-4">{unreadItems.map(renderNotification)}</div>
              </div>
            )}
            {readItems.length > 0 && (
              <div>
                <h3 className="text-sm font-black text-gray-500">Öncekiler</h3>
                <div className="mt-3 space-y-4">{readItems.map(renderNotification)}</div>
              </div>
            )}
          </div>
        )}
      </section>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8 md:px-6">
      <div className="relative z-[60] mx-auto mb-8 max-w-[1320px]"><AppNavigation /></div>
      <NotificationsRealtimeRefresh />

      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-center justify-end gap-4">


          {!error && (
            <MarkAllNotificationsReadButton disabled={unreadCount === 0} />
          )}
        </div>

        <header className="mt-8 rounded-[32px] border border-gray-200 bg-white p-6 shadow-sm md:p-8">
          <p className="text-xs font-semibold uppercase tracking-wide text-green-700">
            Gelen kutusu
          </p>

          <h1 className="mt-3 text-3xl font-bold text-gray-950 md:text-4xl">
            Bildirimler
          </h1>

          <p className="mt-3 max-w-3xl text-sm leading-7 text-gray-500">
            Takip ettiğin kartlardaki gelişmeleri ve niyet, plan, etkinlik bildirimlerini
            ayrı bölümlerde görebilirsin. Oda konuşmaları Sohbetler bölümünde kalır.
          </p>

          {!error && (
            <div className="mt-6 flex flex-wrap gap-2">
              <span className="rounded-full bg-gray-950 px-4 py-2 text-sm font-semibold text-white">
                {unreadCount} okunmamış
              </span>

              <span className="rounded-full bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-600">
                {totalCount} toplam
              </span>

              {totalCount > 0 && (
                <span className="rounded-full bg-green-50 px-4 py-2 text-sm font-semibold text-green-700">
                  Sayfa {Math.min(requestedPage, pageCount)} / {pageCount}
                </span>
              )}
            </div>
          )}
        </header>

        <InboxSectionNav active="updates" />

        {error && (
          <div className="mt-6 rounded-3xl border border-red-200 bg-red-50 p-6">
            <p className="font-semibold text-red-800">Bildirimler yüklenemedi.</p>
            <p className="mt-2 text-sm text-red-700">
              Kayıtların eksik görünmemesi için listeyi göstermiyoruz. Lütfen yeniden dene.
            </p>
            <Link href={pageHref(requestedPage)} className="mt-4 inline-flex rounded-xl bg-red-700 px-4 py-2 text-sm font-bold text-white">
              Yeniden dene
            </Link>
          </div>
        )}

        {!error && renderNotificationSection({
          id: "kart-gelismeleri",
          eyebrow: "Takip ettiğin kartlar",
          title: "Kart gelişmeleri",
          description: "Takip ettiğin kartlara yeni bir niyet, deneyim veya etkinlik eklendiğinde burada görünür.",
          items: cardNotifications,
          emptyTitle: "Bu sayfada kart gelişmesi yok",
          emptyDescription: "Takip ettiğin kartlardaki yeni niyet, deneyim ve etkinlik bildirimleri geldiği sayfada bu bölümde görünür.",
          accent: "emerald",
        })}

        {!error && renderNotificationSection({
          id: "diger-gelismeler",
          eyebrow: "Niyet, plan ve etkinlikler",
          title: "Diğer bildirimler",
          description: "Davetler, katılım istekleri, plan kararları ve etkinlik durumları burada kalır.",
          items: otherNotifications,
          emptyTitle: "Bu sayfada başka bildirim yok",
          emptyDescription: "Bir davet, katılım isteği veya plan gelişmesi olduğunda bu bölümde göreceksin.",
          accent: "slate",
        })}

        {!error && totalCount > PAGE_SIZE && (
          <nav
            aria-label="Bildirim sayfaları"
            className="mt-10 flex items-center justify-between gap-3 rounded-3xl border border-gray-200 bg-white p-4 shadow-sm"
          >
            <Link
              href={pageHref(Math.max(1, requestedPage - 1))}
              aria-disabled={requestedPage <= 1}
              className={`rounded-xl border px-4 py-2.5 text-sm font-bold transition ${
                requestedPage <= 1
                  ? "pointer-events-none border-gray-100 bg-gray-100 text-gray-300"
                  : "border-gray-200 bg-white text-gray-700 hover:border-green-300 hover:text-green-700"
              }`}
            >
              ← Önceki
            </Link>

            <span className="text-sm font-semibold text-gray-500">
              {requestedPage} / {pageCount}
            </span>

            <Link
              href={pageHref(Math.min(pageCount, requestedPage + 1))}
              aria-disabled={requestedPage >= pageCount}
              className={`rounded-xl border px-4 py-2.5 text-sm font-bold transition ${
                requestedPage >= pageCount
                  ? "pointer-events-none border-gray-100 bg-gray-100 text-gray-300"
                  : "border-gray-200 bg-white text-gray-700 hover:border-green-300 hover:text-green-700"
              }`}
            >
              Sonraki →
            </Link>
          </nav>
        )}
      </div>
    </main>
  );
}
