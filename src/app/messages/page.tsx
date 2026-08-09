import Link from "next/link";
import { redirect } from "next/navigation";

import DirectConversationList from "@/components/messages/DirectConversationList";
import type { DirectConversationSummary } from "@/services/directMessageService";
import { createClient } from "@/utils/supabase/server";

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

        <DirectConversationList
          initialConversations={conversations}
          initialLoadFailed={Boolean(error)}
        />
      </div>
    </main>
  );
}
