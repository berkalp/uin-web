import Link from "next/link";
import { redirect } from "next/navigation";
import AppNavigation from "@/components/navigation/AppNavigation";
import CollaborationInbox, { type CollaborationChatSummary, type CollaborationRequest } from "@/components/collaboration/CollaborationInbox";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

export default async function CollaborationSuggestionsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");
  const [requests, chats] = await Promise.all([
    supabase.rpc("get_my_personal_intent_collaboration_requests_v30"),
    supabase.rpc("get_my_personal_intent_collaboration_chats_v34"),
  ]);
  return <main className="min-h-screen bg-gray-50 px-4 py-6 md:px-6"><div className="relative z-50 mx-auto mb-8 max-w-[1500px]"><AppNavigation/></div><div className="mx-auto max-w-5xl"><Link href="/timeline" className="mb-5 inline-block text-sm font-bold text-emerald-800">← Niyetlerime dön</Link>{requests.error || chats.error ? <p role="alert" className="rounded-2xl bg-red-50 p-5 font-semibold text-red-700">Öneriler ve sohbetler yüklenemedi. Lütfen yeniden dene.</p> : <CollaborationInbox initialRequests={(requests.data || []) as CollaborationRequest[]} initialChats={(chats.data || []) as CollaborationChatSummary[]}/>}</div></main>;
}
