import Link from "next/link";
import { redirect } from "next/navigation";
import AppNavigation from "@/components/navigation/AppNavigation";
import InboxSectionNav from "@/components/inbox/InboxSectionNav";
import CollaborationInbox, { type CollaborationChatSummary, type CollaborationRequest } from "@/components/collaboration/CollaborationInbox";
import { parseCollaborationActivity } from "@/lib/collaborationActivity";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isCount(value: unknown): value is number | string {
  return (typeof value === "number" || typeof value === "string")
    && value !== ""
    && Number.isFinite(Number(value))
    && Number(value) >= 0;
}

function isCollaborationRequest(value: unknown): value is CollaborationRequest {
  return isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.seed_id === "string" &&
    typeof value.seed_title === "string" &&
    typeof value.requester_user_id === "string" &&
    typeof value.full_name === "string";
}

function parseCollaborationChat(value: unknown): CollaborationChatSummary {
  if (!isRecord(value)
    || !isUuid(value.chat_id)
    || !isNullableString(value.seed_id)
    || (value.seed_id !== null && !isUuid(value.seed_id))
    || !isNullableString(value.canonical_target_id)
    || (value.canonical_target_id !== null && !isUuid(value.canonical_target_id))
    || (value.seed_id === null && value.canonical_target_id === null)
    || typeof value.seed_title !== "string"
    || !value.seed_title.trim()
    || !isUuid(value.other_user_id)
    || typeof value.other_full_name !== "string"
    || !value.other_full_name.trim()
    || !isNullableString(value.other_username)
    || !isNullableString(value.other_avatar_url)
    || typeof value.status !== "string"
    || !value.status.trim()
    || !isCount(value.viewer_message_count)
    || !isCount(value.other_message_count)
    || !isCount(value.unread_count)
    || !isNullableString(value.last_message_body)
    || !isNullableString(value.last_message_at)
    || (value.last_message_at !== null && !Number.isFinite(Date.parse(value.last_message_at)))) {
    throw new Error("Tanışma sohbeti özeti eksik. Lütfen yeniden deneyin.");
  }
  return {
    chat_id: value.chat_id,
    seed_id: value.seed_id,
    canonical_target_id: value.canonical_target_id,
    seed_title: value.seed_title,
    other_user_id: value.other_user_id,
    other_full_name: value.other_full_name,
    other_username: value.other_username,
    other_avatar_url: value.other_avatar_url,
    status: value.status,
    viewer_message_count: value.viewer_message_count,
    other_message_count: value.other_message_count,
    unread_count: value.unread_count,
    last_message_body: value.last_message_body,
    last_message_at: value.last_message_at,
    activity: parseCollaborationActivity(value, value.seed_title),
  };
}

export default async function CollaborationSuggestionsPage({ searchParams }: { searchParams: Promise<{ focus?: string }> }) {
  const { focus } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");
  const [requests, chats] = await Promise.all([
    supabase.rpc("get_my_personal_intent_collaboration_requests_v30"),
    supabase.rpc("get_my_personal_intent_collaboration_chats_v170"),
  ]);
  const requestsValid=Array.isArray(requests.data)&&requests.data.every(isCollaborationRequest);
  let parsedChats: CollaborationChatSummary[] = [];
  let chatsValid = Array.isArray(chats.data);
  if (chatsValid) {
    try {
      parsedChats = (chats.data as unknown[]).map(parseCollaborationChat);
    } catch (problem) {
      chatsValid = false;
      console.error("Collaboration chat summaries are incomplete.", problem);
    }
  }
  const readFailed=Boolean(requests.error||chats.error||!requestsValid||!chatsValid);
  if(readFailed)console.error("Collaboration inbox queries failed or returned malformed payloads.");
  return <main className="min-h-screen bg-gray-50 px-4 py-6 md:px-6"><div className="relative z-50 mx-auto mb-8 max-w-[1500px]"><AppNavigation/></div><div className="mx-auto max-w-5xl"><Link href="/timeline" className="inline-block text-sm font-bold text-emerald-800">← Niyetlerime dön</Link><InboxSectionNav active="messages"/><div className="mt-8">{readFailed ? <p role="alert" className="rounded-2xl bg-red-50 p-5 font-semibold text-red-700">Öneriler ve sohbetler yüklenemedi. Lütfen yeniden dene.</p> : <CollaborationInbox initialRequests={requests.data as CollaborationRequest[]} initialChats={parsedChats} focusedId={focus || null}/>}</div></div></main>;
}
