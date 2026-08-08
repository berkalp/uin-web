import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import StaffConversationComposer from "@/components/messages/StaffConversationComposer";
import { createClient } from "@/utils/supabase/server";

type NewMessagePageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

type MessageTargetContext = {
  user_id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  is_staff_target: boolean;
  can_start: boolean;
  start_mode: "staff" | "member";
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function NewMessagePage({ searchParams }: NewMessagePageProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/");

  const resolved = await searchParams;
  const userId = first(resolved.userId)?.trim();
  if (!userId) notFound();

  const { data, error } = await supabase.rpc("get_staff_message_target_context", {
    p_target_user_id: userId,
  });

  if (error) {
    console.error("Message target context failed:", error);
    notFound();
  }

  const target = ((data ?? []) as unknown as MessageTargetContext[])[0] ?? null;
  if (!target) notFound();

  const displayName = target.full_name || target.username || "UIN member";

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8 md:px-6">
      <div className="mx-auto max-w-3xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href={`/admin/users/${encodeURIComponent(target.username || target.user_id)}`}
            className="text-sm font-semibold text-gray-600 transition hover:text-green-700"
          >
            ← Back to user
          </Link>
          <Link
            href="/messages"
            className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:border-green-400 hover:text-green-700"
          >
            Messages
          </Link>
        </div>

        <header className="mt-8">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-green-700">
            New direct conversation
          </p>
          <h1 className="mt-3 text-3xl font-bold text-gray-950">Message {displayName}</h1>
          <p className="mt-3 text-sm leading-7 text-gray-500">
            This opens a two-way UIN conversation. Member access can be time-limited; staff channels stay open while permissions remain active.
          </p>
        </header>

        {!target.can_start ? (
          <div className="mt-6 rounded-3xl border border-amber-200 bg-amber-50 p-6">
            <p className="font-bold text-amber-900">Messaging permission is not enabled for your staff account.</p>
            <p className="mt-2 text-sm leading-6 text-amber-800">
              The Owner must grant the appropriate messaging capability first.
            </p>
          </div>
        ) : (
          <div className="mt-6">
            <StaffConversationComposer
              target={{
                userId: target.user_id,
                fullName: displayName,
                username: target.username,
                avatarUrl: target.avatar_url,
                isStaffTarget: target.is_staff_target,
              }}
            />
          </div>
        )}
      </div>
    </main>
  );
}
