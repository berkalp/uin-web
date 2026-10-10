import Link from "next/link";
import { redirect } from "next/navigation";
import { isAuthSessionMissingError } from "@supabase/supabase-js";

import PageDataUnavailable from "@/components/common/PageDataUnavailable";
import InboxSectionNav from "@/components/inbox/InboxSectionNav";
import DirectConversationList from "@/components/messages/DirectConversationList";
import RoomConversationList, {
  isArchivedRoomConversationPlan,
  type RoomConversationPlan,
  type RoomConversationSummary,
} from "@/components/messages/RoomConversationList";
import RoomMessagesRealtimeRefresh from "@/components/messages/RoomMessagesRealtimeRefresh";
import type { DirectConversationSummary } from "@/services/directMessageService";
import { createClient } from "@/utils/supabase/server";

function toNumber(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isUnreadCount(value: unknown): value is number | string | null {
  if (value === null) return true;
  if (typeof value !== "number" && typeof value !== "string") return false;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0;
}

function isDirectConversationSummary(value: unknown): value is DirectConversationSummary {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return typeof row.conversation_id === "string" &&
    typeof row.other_user_id === "string" &&
    isNullableString(row.other_full_name) &&
    isNullableString(row.other_username) &&
    isNullableString(row.other_avatar_url) &&
    isNullableString(row.last_message_body) &&
    isNullableString(row.last_message_at) &&
    isNullableString(row.last_message_sender_id) &&
    isUnreadCount(row.unread_count) &&
    typeof row.viewer_can_send === "boolean" &&
    (row.viewer_access_kind === null || row.viewer_access_kind === "staff" || row.viewer_access_kind === "granted") &&
    isNullableString(row.viewer_access_expires_at);
}

function isRoomConversationSummary(value: unknown): value is RoomConversationSummary {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return typeof row.plan_id === "string" &&
    isNullableString(row.latest_message_id) &&
    (row.latest_message_type === null || row.latest_message_type === "text" || row.latest_message_type === "system") &&
    isNullableString(row.latest_system_event) &&
    isNullableString(row.latest_body) &&
    isNullableString(row.latest_sender_id) &&
    isNullableString(row.latest_sender_name) &&
    isNullableString(row.latest_created_at) &&
    isUnreadCount(row.unread_count);
}

function isRoomConversationPlan(value: unknown): value is RoomConversationPlan {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return typeof row.id === "string" &&
    isNullableString(row.title) &&
    isNullableString(row.creation_mode) &&
    isNullableString(row.status) &&
    isNullableString(row.planned_at) &&
    isNullableString(row.scheduled_start) &&
    isNullableString(row.scheduled_end) &&
    isNullableString(row.completed_at) &&
    isNullableString(row.cancelled_at) &&
    isNullableString(row.expired_at) &&
    isNullableString(row.window_end) &&
    isNullableString(row.timezone);
}

type MessagesPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function pageNumber(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number(raw ?? "1");
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

export default async function MessagesPage({ searchParams }: MessagesPageProps) {
  const params = await searchParams;
  const roomPage = pageNumber(params.roomPage);
  const directPage = pageNumber(params.directPage);
  const archivePage = pageNumber(params.archivePage);
  const requestedSection = Array.isArray(params.section) ? params.section[0] : params.section;
  const activeInboxSection = requestedSection === "staff" ? "staff" : "activities";
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError && !isAuthSessionMissingError(userError)) {
    console.error("Message-center session query failed:", userError);
    return (
      <PageDataUnavailable
        title="Mesajların şu anda yüklenemedi"
        retryHref="/messages"
        backHref="/timeline"
        backLabel="Ana sayfaya dön"
      />
    );
  }

  if (!user) {
    redirect("/");
  }

  const { error: closedRoomSettleError } = await supabase.rpc(
    "settle_my_closed_room_unreads"
  );

  if (closedRoomSettleError) {
    console.warn(
      "Closed Room unread settlement failed:",
      closedRoomSettleError.message
    );
  }
  const [directResult, roomResult] = await Promise.all([
    supabase.rpc("get_my_direct_conversations"),
    supabase.rpc("get_plan_conversation_summaries"),
  ]);

  if (directResult.error) {
    console.error("Direct conversations query failed:", directResult.error);
  }

  if (roomResult.error) {
    console.error("Room conversations query failed:", roomResult.error);
  }

  const directPayloadValid = Array.isArray(directResult.data) &&
    directResult.data.every(isDirectConversationSummary);
  const roomPayloadValid = Array.isArray(roomResult.data) &&
    roomResult.data.every(isRoomConversationSummary);
  const directLoadFailed = Boolean(directResult.error || !directPayloadValid);
  const roomSummaryLoadFailed = Boolean(roomResult.error || !roomPayloadValid);

  if ((!directResult.error && !directPayloadValid) || (!roomResult.error && !roomPayloadValid)) {
    console.error("Message-center queries returned malformed payloads.");
  }

  const directConversations: DirectConversationSummary[] = directPayloadValid
    ? directResult.data as unknown as DirectConversationSummary[]
    : [];
  const roomSummaries: RoomConversationSummary[] = roomPayloadValid
    ? roomResult.data as unknown as RoomConversationSummary[]
    : [];
  const planIds = Array.from(
    new Set(
      roomSummaries
        .filter((summary) => Boolean(summary.latest_message_id))
        .map((summary) => summary.plan_id)
    )
  );

  let plans: RoomConversationPlan[] = [];
  let planLoadFailed = false;

  if (planIds.length > 0) {
    const planResult = await supabase
      .from("plans")
      .select("id, title, creation_mode, status, planned_at, scheduled_start, scheduled_end, completed_at, cancelled_at, expired_at, window_end, timezone")
      .in("id", planIds);

    if (
      planResult.error ||
      !Array.isArray(planResult.data) ||
      !planResult.data.every(isRoomConversationPlan)
    ) {
      console.error("Message-center Plan query failed:", planResult.error);
      planLoadFailed = true;
    } else {
      plans = planResult.data as RoomConversationPlan[];
    }
  }

  const openPlans = plans.filter((plan) => !isArchivedRoomConversationPlan(plan));
  const openPlanIds = new Set(openPlans.map((plan) => plan.id));
  const activeRoomSummaries = roomSummaries.filter((summary) =>
    openPlanIds.has(summary.plan_id)
  );
  const roomLoadFailed = Boolean(roomSummaryLoadFailed || planLoadFailed);
  const roomUnread = roomLoadFailed
    ? null
    : activeRoomSummaries.reduce(
        (total, summary) => total + toNumber(summary.unread_count),
        0
      );
  const directUnread = directLoadFailed
    ? null
    : directConversations.reduce(
        (total, conversation) => total + toNumber(conversation.unread_count),
        0
      );
  const totalUnread = roomUnread === null || directUnread === null
    ? null
    : roomUnread + directUnread;

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8 md:px-6">
      <RoomMessagesRealtimeRefresh />

      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/timeline"
            className="text-sm font-semibold text-gray-600 transition hover:text-green-700"
          >
            <img src="/uin-logo.png" alt="uin? logo" className="h-9 w-auto" />
          </Link>

        </div>

        <header className="mt-8 rounded-[32px] border border-gray-200 bg-white p-6 shadow-sm md:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-green-700">
                Konuşmalar
              </p>
              <h1 className="mt-3 text-4xl font-bold text-gray-950">Mesajlar</h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-gray-500">
                Niyet Odaları, Aktivite Odaları ve doğrudan UIN konuşmaları burada yer alır. Karar Merkezi kararlar için, Bildirimler ise güncellemeler için ayrıdır.
              </p>
            </div>

            <span className="rounded-full bg-gray-950 px-4 py-2 text-sm font-bold text-white">
              {totalUnread === null ? "Okunmamış sayısı yüklenemedi" : `${totalUnread} okunmamış`}
            </span>
          </div>
        </header>

        <InboxSectionNav active={activeInboxSection} />

        <RoomConversationList
          currentUserId={user.id}
          summaries={roomSummaries}
          plans={plans}
          loadFailed={roomLoadFailed}
          page={roomPage}
          directPage={directPage}
          archivePage={archivePage}
        />

        <DirectConversationList
          initialConversations={directConversations}
          initialLoadFailed={directLoadFailed}
          page={directPage}
          roomPage={roomPage}
          archivePage={archivePage}
        />
      </div>
    </main>
  );
}
