import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import AppNavigation from "@/components/navigation/AppNavigation";
import CollaborationChat, { type ChatCardContext, type ChatDetail, type ChatPlan } from "@/components/collaboration/CollaborationChat";
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
  const targetId = chat.canonical_target_id || canonical?.canonical_target_id || null;
  let targetTitle = canonical?.title || chat.seed_title;
  let targetAction = targetLanguage(canonical?.seed_type_slug).action;
  let activityId = canonical?.activity_id || null;
  let cardContext: ChatCardContext | null = null;
  if (targetId) {
    const [cards, profile, summary, ratings, social, people] = await Promise.all([
      supabase.rpc("get_common_intent_cards_v38", { p_query: null, p_limit: 1, p_offset: 0, p_target_id: targetId }),
      supabase.rpc("get_uin_card_profile_v60", { p_target_id: targetId }),
      supabase.rpc("get_uin_card_summary_v81", { p_target_ids: [targetId] }),
      supabase.rpc("get_uin_card_ratings_v85", { p_target_ids: [targetId] }),
      supabase.rpc("get_uin_card_social_v87", { p_target_ids: [targetId] }),
      supabase.rpc("get_uin_card_people_v81", { p_target_id: targetId, p_group: "intent", p_limit: 6, p_offset: 0 }),
    ]);
    const card = (cards.data || [])[0] as { title?: string; seed_type_slug?: string; activity_id?: string | null } | undefined;
    const cardProfile = (profile.data || {}) as { title?: string; creator_name?: string | null; cover_url?: string | null; metadata?: Record<string, unknown> };
    const stats = (summary.data || [])[0] as Record<string, unknown> | undefined;
    const rating = (ratings.data || [])[0] as Record<string, unknown> | undefined;
    const cardSocial = (social.data || [])[0] as Record<string, unknown> | undefined;
    const typeId = String(stats?.type_id || cardProfile.metadata?.content_type_id || "activity");
    const { data: contentType } = await supabase.from("uin_content_types").select("label,icon,base_kind").eq("id", typeId).maybeSingle();
    targetTitle = cardProfile.title || card?.title || targetTitle;
    targetAction = targetLanguage(card?.seed_type_slug || canonical?.seed_type_slug).action;
    activityId = card?.activity_id || activityId;
    cardContext = {
      targetId,
      title: targetTitle,
      subtitle: cardProfile.creator_name || null,
      coverUrl: cardProfile.cover_url || null,
      typeLabel: contentType?.label || "Kütüphane kartı",
      typeIcon: contentType?.icon || "▦",
      wantingCount: Number(stats?.wanting || 0),
      doneCount: Number(stats?.done || 0),
      activeEventCount: Number(stats?.active || 0),
      averageRating: rating?.average_rating == null ? null : Number(rating.average_rating),
      ratingCount: Number(rating?.rating_count || 0),
      followerCount: Number(cardSocial?.follower_count || 0),
      people: ((people.data || []) as Array<Record<string, unknown>>).map((person) => ({
        userId: String(person.user_id || ""),
        name: String(person.full_name || person.username || "UIN üyesi"),
        avatarUrl: typeof person.avatar_url === "string" ? person.avatar_url : null,
      })).filter((person) => person.userId),
    };
  }
  return <main className="min-h-screen bg-gray-50 px-4 py-6 md:px-6"><div className="relative z-50 mx-auto mb-8 max-w-[1500px]"><AppNavigation/></div><div className="mx-auto max-w-6xl"><Link href="/collaboration-suggestions" className="mb-5 inline-block text-sm font-bold text-emerald-800">← Öneriler ve sohbetler</Link><CollaborationChat initialChat={chat} initialPlan={(planResult.data || { planning_creator_user_id: null, planning_intent_id: null }) as ChatPlan} targetId={targetId} targetTitle={targetTitle} targetAction={targetAction} initialActivityId={activityId} cardContext={cardContext}/></div></main>;
}
