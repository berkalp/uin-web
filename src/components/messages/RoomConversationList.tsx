import Link from "next/link";
import { isRoomConversationOpen } from "@/utils/roomConversationLifecycle";

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
  expired_at: string | null;
  window_end: string | null;
  timezone: string | null;
};

type RoomConversationListProps = {
  currentUserId: string;
  summaries: RoomConversationSummary[];
  plans: RoomConversationPlan[];
  page?: number;
  directPage?: number;
};

const PAGE_SIZE = 5;

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
  page = 1,
  directPage = 1,
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
        Boolean(entry.plan) && isRoomConversationOpen(entry.plan as RoomConversationPlan)
    )
    .sort((first, second) => {
      const firstTime = first.summary.latest_created_at
        ? new Date(first.summary.latest_created_at).getTime()
        : 0;
      const secondTime = second.summary.latest_created_at
        ? new Date(second.summary.latest_created_at).getTime()
        : 0;
      return secondTime - firstTime;
    });

  const unreadTotal = conversations.reduce(
    (total, entry) => total + toNumber(entry.summary.unread_count),
    0
  );

  const pageCount = Math.max(1, Math.ceil(conversations.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), pageCount);
  const visibleConversations = conversations.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  );

  function pageHref(targetPage: number) {
    const params = new URLSearchParams();
    params.set("roomPage", String(targetPage));
    params.set("directPage", String(directPage));
    return `/messages?${params.toString()}`;
  }

  return (
    <section className="mt-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-green-700">
            Oda sohbetleri
          </p>
          <h2 className="mt-2 text-2xl font-bold text-gray-950">
            Niyet & Aktivite Odaları
          </h2>
          <p className="mt-2 text-sm leading-6 text-gray-500">
            Her Niyet, planlama ve Aktivite boyunca tek konuşma olarak devam eder. Mesajlar kendi Odasında gruplanır.
          </p>
        </div>

        <span className="rounded-full bg-green-50 px-4 py-2 text-sm font-bold text-green-700">
          {unreadTotal} okunmamış
        </span>
      </div>

      <div className="mt-4 space-y-3">
        {conversations.length === 0 && (
          <div className="rounded-3xl border border-dashed border-gray-300 bg-white p-8 text-center shadow-sm">
            <p className="font-bold text-gray-900">Henüz oda sohbeti yok</p>
            <p className="mt-2 text-sm text-gray-500">
              Niyet ve Aktivite Odası sohbetleri ilk mesajdan sonra burada görünür.
            </p>
          </div>
        )}

        {visibleConversations.map(({ summary, plan }) => {
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

        {conversations.length > PAGE_SIZE && (
          <nav
            aria-label="Oda sohbeti sayfaları"
            className="flex flex-wrap items-center justify-between gap-3 pt-2"
          >
            <p className="text-xs font-semibold text-gray-400">
              Sayfa {safePage} / {pageCount} · Her sayfada en fazla {PAGE_SIZE} konuşma
            </p>

            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={pageHref(Math.max(1, safePage - 1))}
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
                    href={pageHref(pageNumber)}
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
                href={pageHref(Math.min(pageCount, safePage + 1))}
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
      </div>
    </section>
  );
}
