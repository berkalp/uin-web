import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import DirectConversationThread from "@/components/messages/DirectConversationThread";
import type {
  DirectConversationDetail,
  DirectConversationMessage,
} from "@/services/directMessageService";
import { createClient } from "@/utils/supabase/server";

type ConversationPageProps = {
  params: Promise<Record<string, string>>;
};

export default async function ConversationPage({ params }: ConversationPageProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/");

  const resolvedParams = await params;
  const conversationId =
    resolvedParams.conversationId || Object.values(resolvedParams)[0];

  if (!conversationId) notFound();

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
    console.error("Direct conversation load failed:", {
      detail: detailResponse.error,
      messages: messagesResponse.error,
    });
    notFound();
  }

  const detail =
    ((detailResponse.data ?? []) as unknown as DirectConversationDetail[])[0] ?? null;
  if (!detail) notFound();

  const messages = (messagesResponse.data ?? []) as unknown as DirectConversationMessage[];

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
            Timeline
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
