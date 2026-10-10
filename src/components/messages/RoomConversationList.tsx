import Link from "next/link";
import {
  getEventStatusPresentation,
  type CollaborationActivityTone,
  type EventStatusPresentation,
} from "@/lib/collaborationActivity";

export type RoomConversationSummary = {
  plan_id: string;
  latest_message_id: string | null;
  latest_message_type: "text" | "system" | null;
  latest_system_event: string | null;
  latest_body: string | null;
  latest_sender_id: string | null;
  latest_sender_name: string | null;
  latest_created_at: string | null;
  unread_count: number | string | null;
};

export type RoomConversationPlan = {
  id: string;
  title: string | null;
  creation_mode: string | null;
  status: string | null;
  planned_at: string | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  expired_at: string | null;
  window_end: string | null;
  timezone: string | null;
};

type RoomConversationListProps = {
  currentUserId: string;
  summaries: RoomConversationSummary[];
  plans: RoomConversationPlan[];
  loadFailed?: boolean;
  page?: number;
  directPage?: number;
  archivePage?: number;
};

const PAGE_SIZE = 5;
const ARCHIVE_TONE_CLASSES: Record<CollaborationActivityTone, string> = {
  amber: "border-amber-200 bg-amber-50 text-amber-800",
  green: "border-emerald-200 bg-emerald-50 text-emerald-800",
  slate: "border-slate-200 bg-slate-100 text-slate-700",
  red: "border-red-200 bg-red-50 text-red-800",
};
const ARCHIVED_ROOM_KINDS = new Set<EventStatusPresentation["kind"]>([
  "awaiting_result",
  "expired",
  "completed",
  "cancelled",
]);
const STALE_SCHEDULED_ROOM_STATUSES = new Set([
  "planned",
  "active",
  "current",
  "future",
  "closed",
]);

function normalizeLifecycleStatus(value: string | null) {
  return value?.trim().toLowerCase().replace(/[\s-]+/g, "_") ?? "";
}

function dayKey(timestamp: number, timezone: string | null) {
  if (!Number.isFinite(timestamp)) return null;

  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone?.trim() || "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date(timestamp));
    const value = (type: "year" | "month" | "day") =>
      parts.find((part) => part.type === type)?.value;
    const year = value("year");
    const month = value("month");
    const day = value("day");
    return year && month && day ? `${year}-${month}-${day}` : null;
  } catch {
    return new Date(timestamp).toISOString().slice(0, 10);
  }
}

export function getRoomConversationStatusPresentation(
  plan: RoomConversationPlan,
  now: number | string | Date = Date.now()
) {
  const normalizedStatus = normalizeLifecycleStatus(plan.status);
  const nowTimestamp = now instanceof Date
    ? now.getTime()
    : typeof now === "string"
      ? Date.parse(now)
      : now;
  const currentDay = dayKey(nowTimestamp, plan.timezone);
  const formingWindowExpired = normalizedStatus === "forming" &&
    plan.window_end !== null &&
    currentDay !== null &&
    currentDay > plan.window_end;
  const authoritativeStatus = plan.cancelled_at
    ? "cancelled"
    : plan.completed_at
      ? "completed"
      : plan.expired_at || formingWindowExpired
        ? "expired"
        : normalizedStatus;
  const scheduledEnd = plan.scheduled_end ? Date.parse(plan.scheduled_end) : Number.NaN;
  if (
    STALE_SCHEDULED_ROOM_STATUSES.has(authoritativeStatus) &&
    Number.isFinite(nowTimestamp) &&
    Number.isFinite(scheduledEnd) &&
    nowTimestamp > scheduledEnd
  ) {
    return getEventStatusPresentation({ status: "awaiting_result" });
  }

  return getEventStatusPresentation({
    status: authoritativeStatus,
    scheduledStart: plan.scheduled_start,
    scheduledEnd: plan.scheduled_end,
    now,
  });
}

export function isArchivedRoomConversationPlan(
  plan: RoomConversationPlan,
  now: number | string | Date = Date.now()
) {
  return ARCHIVED_ROOM_KINDS.has(getRoomConversationStatusPresentation(plan, now).kind);
}

function toNumber(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatDateTime(value: string | null) {
  if (!value) return "Henüz mesaj yok";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Bilinmeyen zaman";

  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

function currentRoomPhase(plan: RoomConversationPlan) {
  const activityRoomExists =
    plan.creation_mode === "scheduled_direct" ||
    plan.status === "planned" ||
    plan.status === "completed" ||
    (plan.status === "cancelled" && Boolean(plan.planned_at));

  return activityRoomExists ? "activity" : "planning";
}

function preview(summary: RoomConversationSummary, currentUserId: string) {
  const body = (summary.latest_body ?? "").trim();
  if (!body) return "Konuşma hareketi";

  if (summary.latest_message_type === "system") {
    return body;
  }

  const sender =
    summary.latest_sender_id === currentUserId
      ? "Sen"
      : summary.latest_sender_name || "UIN üyesi";

  return `${sender}: ${body}`;
}

export default function RoomConversationList({
  currentUserId,
  summaries,
  plans,
  loadFailed = false,
  page = 1,
  directPage = 1,
  archivePage = 1,
}: RoomConversationListProps) {
  const planById = new Map(plans.map((plan) => [plan.id, plan]));

  const conversations = summaries
    .filter((summary) => Boolean(summary.latest_message_id))
    .map((summary) => ({
      summary,
      plan: planById.get(summary.plan_id) ?? null,
    }))
    .filter(
      (entry): entry is { summary: RoomConversationSummary; plan: RoomConversationPlan } =>
        Boolean(entry.plan)
    )
    .sort((first, second) => {
      const firstTime = first.summary.latest_created_at
        ? new Date(first.summary.latest_created_at).getTime()
        : 0;
      const secondTime = second.summary.latest_created_at
        ? new Date(second.summary.latest_created_at).getTime()
        : 0;
      return secondTime - firstTime;
    })
    .map((entry) => ({
      ...entry,
      statusPresentation: getRoomConversationStatusPresentation(entry.plan),
    }));

  const activeConversations = conversations.filter((entry) =>
    !ARCHIVED_ROOM_KINDS.has(entry.statusPresentation.kind)
  );
  const archivedConversations = conversations.filter((entry) =>
    ARCHIVED_ROOM_KINDS.has(entry.statusPresentation.kind)
  );

  const unreadTotal = activeConversations.reduce(
    (total, entry) => total + toNumber(entry.summary.unread_count),
    0
  );

  const pageCount = Math.max(1, Math.ceil(activeConversations.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), pageCount);
  const visibleConversations = activeConversations.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  );
  const archivePageCount = Math.max(1, Math.ceil(archivedConversations.length / PAGE_SIZE));
  const safeArchivePage = Math.min(Math.max(1, archivePage), archivePageCount);
  const visibleArchivedConversations = archivedConversations.slice(
    (safeArchivePage - 1) * PAGE_SIZE,
    safeArchivePage * PAGE_SIZE
  );

  function pageHref({
    targetPage = safePage,
    targetArchivePage = safeArchivePage,
  }: {
    targetPage?: number;
    targetArchivePage?: number;
  }) {
    const params = new URLSearchParams();
    params.set("roomPage", String(targetPage));
    params.set("directPage", String(directPage));
    params.set("archivePage", String(targetArchivePage));
    params.set("section", "activities");
    return `/messages?${params.toString()}#etkinlikler`;
  }

  function archivePresentation(presentation: EventStatusPresentation) {
    return {
      label: presentation.label,
      classes: ARCHIVE_TONE_CLASSES[presentation.tone],
    };
  }

  return (
    <section id="etkinlikler" className="scroll-mt-24 pt-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-green-700">
            Plan ve etkinlik sohbetleri
          </p>
          <h2 className="mt-2 text-2xl font-bold text-gray-950">
            Planlama & Aktivite Odaları
          </h2>
          <p className="mt-2 text-sm leading-6 text-gray-500">
            Bir planın konuşması planlama ve etkinlik boyunca aynı odada devam eder.
          </p>
        </div>

        <span className={`rounded-full px-4 py-2 text-sm font-bold ${loadFailed ? "bg-amber-50 text-amber-700" : "bg-green-50 text-green-700"}`}>
          {loadFailed ? "Okunmamış sayısı yüklenemedi" : `${unreadTotal} okunmamış`}
        </span>
      </div>

      <div className="mt-4 space-y-3">
        {loadFailed && (
          <div role="alert" className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-center text-amber-900 shadow-sm">
            <p className="font-bold">Oda konuşmaları şu anda yüklenemedi</p>
            <p className="mt-2 text-sm">Eksik konuşmaları boş liste gibi göstermiyoruz.</p>
            <Link href={pageHref({ targetPage: page })} className="mt-4 inline-flex rounded-xl bg-amber-700 px-4 py-2 text-sm font-bold text-white">
              Yeniden dene
            </Link>
          </div>
        )}

        {!loadFailed && activeConversations.length === 0 && (
          <div className="rounded-3xl border border-dashed border-gray-300 bg-white p-8 text-center shadow-sm">
            <p className="font-bold text-gray-900">Açık etkinlik sohbeti yok</p>
            <p className="mt-2 text-sm text-gray-500">
              Yeni bir planlama veya Aktivite Odası konuşması başladığında burada görünür.
            </p>
          </div>
        )}

        {!loadFailed && visibleConversations.map(({ summary, plan }) => {
          const phase = currentRoomPhase(plan);
          const unread = toNumber(summary.unread_count);
          const roomLabel = phase === "planning" ? "Niyet Odası" : "Aktivite Odası";

          return (
            <Link
              key={summary.plan_id}
              href={`/plans/${encodeURIComponent(summary.plan_id)}/${phase}`}
              className="flex items-center gap-4 rounded-3xl border border-gray-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-green-300 hover:shadow-md"
            >
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-green-50 text-xl text-green-700">
                💬
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="truncate font-bold text-gray-950">
                    {plan.title || "UIN Aktivitesi"}
                  </h3>
                  <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-bold text-gray-600">
                    {roomLabel}
                  </span>
                </div>

                <p className="mt-1 truncate text-sm text-gray-500">
                  {preview(summary, currentUserId)}
                </p>
                <p className="mt-2 text-xs text-gray-400">
                  {formatDateTime(summary.latest_created_at)}
                </p>
              </div>

              {unread > 0 && (
                <span className="flex min-h-8 min-w-8 items-center justify-center rounded-full bg-green-600 px-2 text-xs font-bold text-white">
                  {unread > 99 ? "99+" : unread}
                </span>
              )}

              <span className="text-gray-300">→</span>
            </Link>
          );
        })}

        {activeConversations.length > PAGE_SIZE && (
          <nav
            aria-label="Oda sohbeti sayfaları"
            className="flex flex-wrap items-center justify-between gap-3 pt-2"
          >
            <p className="text-xs font-semibold text-gray-400">
              Sayfa {safePage} / {pageCount} · Her sayfada en fazla {PAGE_SIZE} konuşma
            </p>

            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={pageHref({ targetPage: Math.max(1, safePage - 1) })}
                aria-disabled={safePage === 1}
                className={`rounded-xl border px-3.5 py-2 text-sm font-bold transition ${
                  safePage === 1
                    ? "pointer-events-none border-gray-100 bg-gray-100 text-gray-300"
                    : "border-gray-200 bg-white text-gray-700 hover:border-green-300 hover:text-green-700"
                }`}
              >
                Önceki
              </Link>

              {Array.from({ length: pageCount }, (_, index) => index + 1).map(
                (pageNumber) => (
                  <Link
                    key={pageNumber}
                    href={pageHref({ targetPage: pageNumber })}
                    className={`min-w-10 rounded-xl px-3.5 py-2 text-center text-sm font-black transition ${
                      pageNumber === safePage
                        ? "bg-gray-950 text-white"
                        : "border border-gray-200 bg-white text-gray-700 hover:border-green-300 hover:text-green-700"
                    }`}
                  >
                    {pageNumber}
                  </Link>
                )
              )}

              <Link
                href={pageHref({ targetPage: Math.min(pageCount, safePage + 1) })}
                aria-disabled={safePage === pageCount}
                className={`rounded-xl border px-3.5 py-2 text-sm font-bold transition ${
                  safePage === pageCount
                    ? "pointer-events-none border-gray-100 bg-gray-100 text-gray-300"
                    : "border-gray-200 bg-white text-gray-700 hover:border-green-300 hover:text-green-700"
                }`}
              >
                Sonraki
              </Link>
            </div>
          </nav>
        )}

        {!loadFailed && (
          <details
            id="etkinlik-arsivi"
            className="group mt-8 rounded-3xl border border-rose-200 bg-rose-50/60 p-5 shadow-sm"
          >
            <summary className="flex cursor-pointer list-none flex-wrap items-start justify-between gap-3 rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-rose-700">
                  Etkinlik arşivi
                </p>
                <h3 className="mt-2 text-xl font-bold text-gray-950">
                  Kapanan oda konuşmaları
                </h3>
                <p className="mt-2 text-sm leading-6 text-gray-600">
                  Tamamlanan, iptal edilen veya süresi dolan planlar burada kalır; açık etkinlik listesinde tekrarlanmaz.
                </p>
              </div>
              <span className="flex items-center gap-2 rounded-full border border-rose-200 bg-white px-3 py-1.5 text-xs font-bold text-rose-700">
                {archivedConversations.length} arşiv
                <span className="transition group-open:rotate-180" aria-hidden="true">⌄</span>
              </span>
            </summary>

            {archivedConversations.length === 0 ? (
              <div className="mt-4 rounded-2xl border border-dashed border-rose-200 bg-white/80 p-6 text-center">
                <p className="font-bold text-gray-900">Arşivlenmiş etkinlik sohbeti yok</p>
                <p className="mt-2 text-sm text-gray-500">
                  Kapanan etkinlik odaları durumlarıyla birlikte burada görünür.
                </p>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {visibleArchivedConversations.map(({ summary, plan, statusPresentation }) => {
                  const phase = currentRoomPhase(plan);
                  const status = archivePresentation(statusPresentation);

                  return (
                    <Link
                      key={summary.plan_id}
                      href={`/plans/${encodeURIComponent(summary.plan_id)}/${phase}`}
                      className="flex items-center gap-4 rounded-2xl border border-rose-100 bg-white p-4 transition hover:border-rose-300 hover:shadow-sm"
                    >
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-rose-100 text-lg" aria-hidden="true">
                        🗂️
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="truncate font-bold text-gray-950">
                            {plan.title || "UIN Aktivitesi"}
                          </h4>
                          <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${status.classes}`}>
                            {status.label}
                          </span>
                        </div>
                        <p className="mt-1 truncate text-sm text-gray-500">
                          {preview(summary, currentUserId)}
                        </p>
                        <p className="mt-2 text-xs text-gray-400">
                          {formatDateTime(summary.latest_created_at)}
                        </p>
                      </div>
                      <span className="text-rose-300" aria-hidden="true">→</span>
                    </Link>
                  );
                })}

                {archivedConversations.length > PAGE_SIZE && (
                  <nav aria-label="Etkinlik arşivi sayfaları" className="flex flex-wrap items-center justify-between gap-3 pt-2">
                    <p className="text-xs font-semibold text-rose-700">
                      Sayfa {safeArchivePage} / {archivePageCount}
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={pageHref({ targetArchivePage: Math.max(1, safeArchivePage - 1) })}
                        aria-disabled={safeArchivePage === 1}
                        className={`rounded-xl border px-3.5 py-2 text-sm font-bold transition ${
                          safeArchivePage === 1
                            ? "pointer-events-none border-rose-100 bg-rose-100 text-rose-300"
                            : "border-rose-200 bg-white text-rose-700 hover:border-rose-400"
                        }`}
                      >
                        Önceki
                      </Link>
                      <Link
                        href={pageHref({ targetArchivePage: Math.min(archivePageCount, safeArchivePage + 1) })}
                        aria-disabled={safeArchivePage === archivePageCount}
                        className={`rounded-xl border px-3.5 py-2 text-sm font-bold transition ${
                          safeArchivePage === archivePageCount
                            ? "pointer-events-none border-rose-100 bg-rose-100 text-rose-300"
                            : "border-rose-200 bg-white text-rose-700 hover:border-rose-400"
                        }`}
                      >
                        Sonraki
                      </Link>
                    </div>
                  </nav>
                )}
              </div>
            )}
          </details>
        )}
      </div>
    </section>
  );
}
