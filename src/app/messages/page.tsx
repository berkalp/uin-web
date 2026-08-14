import Link from "next/link";
import { redirect } from "next/navigation";

import DirectConversationList from "@/components/messages/DirectConversationList";
import RoomConversationList, {
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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
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

  const directConversations = (directResult.data ?? []) as unknown as DirectConversationSummary[];
  const roomSummaries = (roomResult.data ?? []) as unknown as RoomConversationSummary[];
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
      .select("id, title, creation_mode, status, planned_at")
      .in("id", planIds);

    if (planResult.error) {
      console.error("Message-center Plan query failed:", planResult.error);
      planLoadFailed = true;
    } else {
      plans = (planResult.data ?? []) as RoomConversationPlan[];
    }
  }

  const roomUnread = roomSummaries.reduce(
    (total, summary) => total + toNumber(summary.unread_count),
    0
  );
  const directUnread = directConversations.reduce(
    (total, conversation) => total + toNumber(conversation.unread_count),
    0
  );
  const totalUnread = roomUnread + directUnread;

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8 md:px-6">
      <RoomMessagesRealtimeRefresh />

      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/timeline"
            className="text-sm font-semibold text-gray-600 transition hover:text-green-700"
          >
            ← Back to Timeline
          </Link>

          <Link
            href="/inbox"
            className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:border-green-400 hover:text-green-700"
          >
            Karar Merkezi
          </Link>
        </div>

        <header className="mt-8 rounded-[32px] border border-gray-200 bg-white p-6 shadow-sm md:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-green-700">
                Conversations
              </p>
              <h1 className="mt-3 text-4xl font-bold text-gray-950">Messages</h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-gray-500">
                Planning Rooms, Activity Rooms and direct UIN conversations live here. Karar Merkezi stays reserved for decisions; Notifications stay reserved for updates.
              </p>
            </div>

            <span className="rounded-full bg-gray-950 px-4 py-2 text-sm font-bold text-white">
              {totalUnread} unread
            </span>
          </div>
        </header>

        {planLoadFailed && (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm font-semibold text-red-700">
            Some Room conversations could not be loaded.
          </div>
        )}

        <RoomConversationList
          currentUserId={user.id}
          summaries={roomSummaries}
          plans={plans}
          page={roomPage}
          directPage={directPage}
        />

        <DirectConversationList
          initialConversations={directConversations}
          initialLoadFailed={Boolean(directResult.error)}
          page={directPage}
          roomPage={roomPage}
        />
      </div>
    </main>
  );
}
