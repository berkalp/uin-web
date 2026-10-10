import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { isAuthSessionMissingError } from "@supabase/supabase-js";

import PageDataUnavailable from "@/components/common/PageDataUnavailable";
import DirectConversationThread from "@/components/messages/DirectConversationThread";
import type {
  DirectConversationDetail,
  DirectConversationMessage,
} from "@/services/directMessageService";
import { createClient } from "@/utils/supabase/server";

type ConversationPageProps = {
  params: Promise<Record<string, string>>;
};

function isValidUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isConversationDetail(value: unknown): value is DirectConversationDetail {
  return isRecord(value) &&
    typeof value.conversation_id === "string" &&
    typeof value.other_user_id === "string" &&
    typeof value.viewer_can_send === "boolean" &&
    typeof value.viewer_can_manage_access === "boolean" &&
    typeof value.other_is_staff === "boolean";
}

function isConversationMessage(value: unknown): value is DirectConversationMessage {
  return isRecord(value) &&
    typeof value.message_id === "string" &&
    typeof value.sender_id === "string" &&
    typeof value.body === "string" &&
    typeof value.created_at === "string";
}

export default async function ConversationPage({ params }: ConversationPageProps) {
  const resolvedParams = await params;
  const conversationId =
    resolvedParams.conversationId || Object.values(resolvedParams)[0];

  if (!conversationId || !isValidUuid(conversationId)) notFound();

  const retryHref = `/messages/${encodeURIComponent(conversationId)}`;
  const unavailable = (
    <PageDataUnavailable
      title="Mesajlaşma şu anda yüklenemedi"
      retryHref={retryHref}
      backHref="/messages"
      backLabel="Mesajlara dön"
    />
  );
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError && !isAuthSessionMissingError(userError)) {
    console.error("Direct conversation session query failed:", userError);
    return unavailable;
  }

  if (!user) redirect("/");

  const [detailResponse, messagesResponse] = await Promise.all([
    supabase.rpc("get_direct_conversation_detail", {
      p_conversation_id: conversationId,
    }),
    supabase.rpc("get_direct_conversation_messages", {
      p_conversation_id: conversationId,
      p_limit: 300,
    }),
  ]);

  if (detailResponse.error || messagesResponse.error) {
    if (
      detailResponse.error?.code === "P0002" ||
      messagesResponse.error?.code === "P0002"
    ) {
      notFound();
    }

    console.error("Direct conversation load failed:", {
      detail: detailResponse.error,
      messages: messagesResponse.error,
    });
    return unavailable;
  }

  if (!Array.isArray(detailResponse.data) || !Array.isArray(messagesResponse.data)) {
    console.error("Direct conversation queries returned malformed payloads.");
    return unavailable;
  }

  if (detailResponse.data.length === 0) notFound();

  if (
    detailResponse.data.length !== 1 ||
    !isConversationDetail(detailResponse.data[0]) ||
    !messagesResponse.data.every(isConversationMessage)
  ) {
    console.error("Direct conversation queries returned incomplete payloads.");
    return unavailable;
  }

  const detail = detailResponse.data[0];
  const messages = messagesResponse.data;

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8 md:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/messages"
            className="text-sm font-semibold text-gray-600 transition hover:text-green-700"
          >
            ← Messages
          </Link>
          <Link
            href="/timeline"
            className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:border-green-400 hover:text-green-700"
          >
            <img src="/uin-logo.png" alt="uin? logo" className="h-9 w-auto" />
          </Link>
        </div>

        <DirectConversationThread
          currentUserId={user.id}
          detail={detail}
          messages={messages}
        />
      </div>
    </main>
  );
}
