import Link from "next/link";
import { redirect } from "next/navigation";

import type { DirectConversationSummary } from "@/services/directMessageService";
import { createClient } from "@/utils/supabase/server";

function getInitial(value: string) {
  return value.trim().charAt(0).toUpperCase() || "?";
}

function formatDateTime(value: string | null) {
  if (!value) return "No messages yet";

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(value));
}

function toNumber(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export default async function MessagesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  const { data, error } = await supabase.rpc("get_my_direct_conversations");

  if (error) {
    console.error("Direct conversations query failed:", error);
  }

  const conversations = (data ?? []) as unknown as DirectConversationSummary[];
  const unreadTotal = conversations.reduce(
    (total, conversation) => total + toNumber(conversation.unread_count),
    0
  );

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8 md:px-6">
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
            Inbox
          </Link>
        </div>

        <header className="mt-8 rounded-3xl border border-gray-200 bg-white p-6 shadow-sm md:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-green-700">
                Direct conversations
              </p>
              <h1 className="mt-3 text-4xl font-bold text-gray-950">Messages</h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-gray-500">
                Staff-created conversations live here. General member-to-member DMs remain closed.
              </p>
            </div>

            <span className="rounded-full bg-gray-950 px-4 py-2 text-sm font-bold text-white">
              {unreadTotal} unread
            </span>
          </div>
        </header>

        <section className="mt-6 space-y-3">
          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm font-semibold text-red-700">
              Conversations could not be loaded.
            </div>
          )}

          {!error && conversations.length === 0 && (
            <div className="rounded-3xl border border-dashed border-gray-300 bg-white p-10 text-center shadow-sm">
              <p className="text-lg font-bold text-gray-900">No conversations yet</p>
              <p className="mt-2 text-sm text-gray-500">
                A staff member can open a direct channel when there is a reason to talk.
              </p>
            </div>
          )}

          {conversations.map((conversation) => {
            const displayName =
              conversation.other_full_name || conversation.other_username || "UIN member";
            const unreadCount = toNumber(conversation.unread_count);

            return (
              <Link
                key={conversation.conversation_id}
                href={`/messages/${encodeURIComponent(conversation.conversation_id)}`}
                className="flex items-center gap-4 rounded-3xl border border-gray-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-green-300 hover:shadow-md"
              >
                {conversation.other_avatar_url ? (
                  <img
                    src={conversation.other_avatar_url}
                    alt={displayName}
                    className="h-14 w-14 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-green-50 text-lg font-bold text-green-700">
                    {getInitial(displayName)}
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate font-bold text-gray-950">{displayName}</h2>
                    {conversation.viewer_access_kind === "staff" && (
                      <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-700">
                        STAFF CHANNEL
                      </span>
                    )}
                    {!conversation.viewer_can_send && (
                      <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-700">
                        READ ONLY
                      </span>
                    )}
                  </div>

                  <p className="mt-1 truncate text-sm text-gray-500">
                    {conversation.last_message_body || "Conversation opened"}
                  </p>
                  <p className="mt-2 text-xs text-gray-400">
                    {formatDateTime(conversation.last_message_at)}
                  </p>
                </div>

                {unreadCount > 0 && (
                  <span className="flex min-h-8 min-w-8 items-center justify-center rounded-full bg-green-600 px-2 text-xs font-bold text-white">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}

                <span className="text-gray-300">→</span>
              </Link>
            );
          })}
        </section>
      </div>
    </main>
  );
}
