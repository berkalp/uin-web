import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import AppNavigation from "@/components/navigation/AppNavigation";
import CollaborationChat, { type ChatDetail, type ChatPlan } from "@/components/collaboration/CollaborationChat";
import { targetLanguage } from "@/utils/targetLanguage";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

export default async function CollaborationChatPage({ params }: { params: Promise<{ suggestionId: string }> }) {
  const { suggestionId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(suggestionId)) notFound();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");
  const [chatResult, planResult] = await Promise.all([
    supabase.rpc("get_personal_intent_collaboration_chat_v34", { p_suggestion_id: suggestionId }),
    supabase.rpc("get_personal_intent_collaboration_plan_v35", { p_suggestion_id: suggestionId }),
  ]);
  if (chatResult.error || !chatResult.data) notFound();
  const chat = chatResult.data as ChatDetail;
  const canonicalResult = await supabase.rpc("get_canonical_seed_detail_v31", { p_source_seed_id: chat.seed_id });
  const canonical = (Array.isArray(canonicalResult.data) ? canonicalResult.data[0] : canonicalResult.data) as { canonical_target_id?: string; title?: string; seed_type_slug?: string; activity_id?: string | null } | null;
  const targetId = canonical?.canonical_target_id || null;
  let targetTitle = canonical?.title || chat.seed_title;
  let targetAction = targetLanguage(canonical?.seed_type_slug).action;
  let activityId = canonical?.activity_id || null;
  if (targetId) {
    const { data } = await supabase.rpc("get_common_intent_cards_v38", { p_query: null, p_limit: 1, p_offset: 0, p_target_id: targetId });
    const card = (data || [])[0] as { title?: string; seed_type_slug?: string; activity_id?: string | null } | undefined;
    targetTitle = card?.title || targetTitle;
    targetAction = targetLanguage(card?.seed_type_slug || canonical?.seed_type_slug).action;
    activityId = card?.activity_id || activityId;
  }
  return <main className="min-h-screen bg-gray-50 px-4 py-6 md:px-6"><div className="relative z-50 mx-auto mb-8 max-w-[1500px]"><AppNavigation/></div><div className="mx-auto max-w-6xl"><Link href="/collaboration-suggestions" className="mb-5 inline-block text-sm font-bold text-emerald-800">← Öneriler ve sohbetler</Link><CollaborationChat initialChat={chat} initialPlan={(planResult.data || { planning_creator_user_id: null, planning_intent_id: null }) as ChatPlan} targetId={targetId} targetTitle={targetTitle} targetAction={targetAction} initialActivityId={activityId}/></div></main>;
}
