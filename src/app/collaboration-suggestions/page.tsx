import Link from "next/link";
import { redirect } from "next/navigation";
import AppNavigation from "@/components/navigation/AppNavigation";
import CollaborationInbox, { type CollaborationChatSummary, type CollaborationRequest } from "@/components/collaboration/CollaborationInbox";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isCollaborationRequest(value: unknown): value is CollaborationRequest {
  return isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.seed_id === "string" &&
    typeof value.seed_title === "string" &&
    typeof value.requester_user_id === "string" &&
    typeof value.full_name === "string";
}

function isCollaborationChat(value: unknown): value is CollaborationChatSummary {
  return isRecord(value) &&
    typeof value.chat_id === "string" &&
    typeof value.seed_id === "string" &&
    typeof value.seed_title === "string" &&
    typeof value.other_user_id === "string" &&
    typeof value.other_full_name === "string";
}

export default async function CollaborationSuggestionsPage({ searchParams }: { searchParams: Promise<{ focus?: string }> }) {
  const { focus } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");
  const [requests, chats] = await Promise.all([
    supabase.rpc("get_my_personal_intent_collaboration_requests_v30"),
    supabase.rpc("get_my_personal_intent_collaboration_chats_v34"),
  ]);
  const requestsValid=Array.isArray(requests.data)&&requests.data.every(isCollaborationRequest);
  const chatsValid=Array.isArray(chats.data)&&chats.data.every(isCollaborationChat);
  const readFailed=Boolean(requests.error||chats.error||!requestsValid||!chatsValid);
  if(readFailed)console.error("Collaboration inbox queries failed or returned malformed payloads.");
  return <main className="min-h-screen bg-gray-50 px-4 py-6 md:px-6"><div className="relative z-50 mx-auto mb-8 max-w-[1500px]"><AppNavigation/></div><div className="mx-auto max-w-5xl"><Link href="/timeline" className="mb-5 inline-block text-sm font-bold text-emerald-800">← Niyetlerime dön</Link>{readFailed ? <p role="alert" className="rounded-2xl bg-red-50 p-5 font-semibold text-red-700">Öneriler ve sohbetler yüklenemedi. Lütfen yeniden dene.</p> : <CollaborationInbox initialRequests={requests.data} initialChats={chats.data} focusedId={focus || null}/>}</div></main>;
}
