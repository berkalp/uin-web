import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { isAuthSessionMissingError } from "@supabase/supabase-js";
import AppNavigation from "@/components/navigation/AppNavigation";
import CollaborationChat, { type ChatCardContext, type ChatDetail, type ChatPlan } from "@/components/collaboration/CollaborationChat";
import { targetLanguage } from "@/utils/targetLanguage";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

type JsonRecord = Record<string, unknown>;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isNullableUuid(value: unknown): value is string | null {
  return value === null || isUuid(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function readFiniteMetric(value: unknown, label: string) {
  if ((typeof value !== "number" && typeof value !== "string") || value === "") {
    throw new Error(`${label} verisi eksik. Lütfen yeniden deneyin.`);
  }
  const metric = Number(value);
  if (!Number.isFinite(metric) || metric < 0) {
    throw new Error(`${label} verisi geçersiz. Lütfen yeniden deneyin.`);
  }
  return metric;
}

function assertTargetRow(row: JsonRecord, targetId: string, label: string) {
  if (!isUuid(row.target_id) || row.target_id !== targetId) {
    throw new Error(`${label} kartla eşleşmiyor. Lütfen yeniden deneyin.`);
  }
}

function parseChat(value: unknown): ChatDetail {
  if (
    !isRecord(value)
    || !isUuid(value.chat_id)
    || !isUuid(value.seed_id)
    || !isNullableUuid(value.canonical_target_id ?? null)
    || !isNonEmptyString(value.seed_title)
    || !isNonEmptyString(value.status)
    || !isNullableUuid(value.planning_proposed_by)
    || !isUuid(value.viewer_id)
    || !isUuid(value.other_user_id)
    || !isNonEmptyString(value.other_full_name)
    || !isNullableString(value.other_username)
    || !isNullableString(value.other_avatar_url)
    || !Array.isArray(value.messages)
  ) {
    throw new Error("Sohbet bilgileri eksik. Lütfen yeniden deneyin.");
  }
  readFiniteMetric(value.viewer_message_count, "Gönderilen mesaj sayısı");
  readFiniteMetric(value.other_message_count, "Alınan mesaj sayısı");
  const validMessages = value.messages.every((message) => isRecord(message)
    && isUuid(message.id)
    && isUuid(message.sender_user_id)
    && typeof message.body === "string"
    && isNonEmptyString(message.created_at)
    && isNonEmptyString(message.sender_full_name)
    && isNullableString(message.sender_username)
    && isNullableString(message.sender_avatar_url));
  if (!validMessages) throw new Error("Sohbet mesajları eksik. Lütfen yeniden deneyin.");
  return value as ChatDetail;
}

function parsePlan(value: unknown): ChatPlan {
  if (!isRecord(value)
    || !isNullableUuid(value.planning_creator_user_id)
    || !isNullableUuid(value.planning_intent_id)) {
    throw new Error("Planlama bilgileri eksik. Lütfen yeniden deneyin.");
  }
  return {
    planning_creator_user_id: value.planning_creator_user_id,
    planning_intent_id: value.planning_intent_id,
  };
}

function parseCanonical(value: unknown) {
  if (!Array.isArray(value) || value.length > 1 || (value.length === 1 && !isRecord(value[0]))) {
    throw new Error("Kart bağlantısı yüklenemedi. Lütfen yeniden deneyin.");
  }
  if (value.length === 0) return null;
  const row = value[0] as JsonRecord;
  if (!isUuid(row.canonical_target_id)
    || !isNonEmptyString(row.title)
    || (row.seed_type_slug !== null && row.seed_type_slug !== undefined && !isNonEmptyString(row.seed_type_slug))
    || !isNullableUuid(row.activity_id ?? null)) {
    throw new Error("Kart bağlantısı eksik. Lütfen yeniden deneyin.");
  }
  return row as { canonical_target_id: string; title: string; seed_type_slug?: string | null; activity_id?: string | null };
}

export default async function CollaborationChatPage({ params }: { params: Promise<{ suggestionId: string }> }) {
  const { suggestionId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(suggestionId)) notFound();
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError && !isAuthSessionMissingError(userError)) {
    throw new Error("Oturum bilgileri doğrulanamadı. Lütfen yeniden deneyin.");
  }
  if (!user) redirect("/");
  const [chatResult, planResult] = await Promise.all([
    supabase.rpc("get_personal_intent_collaboration_chat_v34", { p_suggestion_id: suggestionId }),
    supabase.rpc("get_personal_intent_collaboration_plan_v35", { p_suggestion_id: suggestionId }),
  ]);
  if (chatResult.error) {
    if (chatResult.error.message?.includes("Tanışma sohbeti bulunamadı")) notFound();
    throw new Error("Sohbet yüklenemedi. Lütfen yeniden deneyin.");
  }
  if (chatResult.data === null) notFound();
  if (planResult.error) throw new Error("Planlama bilgileri yüklenemedi. Lütfen yeniden deneyin.");
  const chat = parseChat(chatResult.data);
  const initialPlan = parsePlan(planResult.data);
  const canonicalResult = await supabase.rpc("get_canonical_seed_detail_v31", { p_source_seed_id: chat.seed_id });
  if (canonicalResult.error) throw new Error("Kart bağlantısı yüklenemedi. Lütfen yeniden deneyin.");
  const canonical = parseCanonical(canonicalResult.data);
  const targetId = chat.canonical_target_id || canonical?.canonical_target_id || null;
  let targetTitle = canonical?.title || chat.seed_title;
  let targetAction = targetLanguage(canonical?.seed_type_slug).action;
  let activityId = canonical?.activity_id || null;
  let cardContext: ChatCardContext | null = null;
  let cardContextUnavailable = false;
  if (targetId) {
    try {
    const [cards, profile, ratings, social, people] = await Promise.all([
      supabase.rpc("get_uin_catalogue_for_targets_v123", { p_target_ids: [targetId] }),
      supabase.rpc("get_uin_card_profile_v60", { p_target_id: targetId }),
      supabase.rpc("get_uin_card_ratings_v85", { p_target_ids: [targetId] }),
      supabase.rpc("get_uin_card_social_v87", { p_target_ids: [targetId] }),
      supabase.rpc("get_uin_card_people_v81", { p_target_id: targetId, p_group: "intent", p_limit: 6, p_offset: 0 }),
    ]);
    if (cards.error || profile.error || ratings.error || social.error || people.error) {
      throw new Error("Kütüphane kartı ayrıntıları yüklenemedi. Lütfen yeniden deneyin.");
    }
    if (!Array.isArray(cards.data) || cards.data.length !== 1 || !isRecord(cards.data[0])) {
      throw new Error("Kütüphane kartı bulunamadı. Lütfen yeniden deneyin.");
    }
    if (!isRecord(profile.data)) throw new Error("Kart profili yüklenemedi. Lütfen yeniden deneyin.");
    if (!Array.isArray(ratings.data) || ratings.data.length !== 1 || !isRecord(ratings.data[0])) {
      throw new Error("Kart puanı yüklenemedi. Lütfen yeniden deneyin.");
    }
    if (!Array.isArray(social.data) || social.data.length !== 1 || !isRecord(social.data[0])) {
      throw new Error("Kart sosyal bilgileri yüklenemedi. Lütfen yeniden deneyin.");
    }
    if (!Array.isArray(people.data) || !people.data.every(isRecord)) {
      throw new Error("Kartın kişi listesi yüklenemedi. Lütfen yeniden deneyin.");
    }

    const card = cards.data[0];
    const cardProfile = profile.data;
    const rating = ratings.data[0];
    const cardSocial = social.data[0];
    if (!isUuid(card.canonical_target_id) || card.canonical_target_id !== targetId) {
      throw new Error("Kütüphane kartı bağlantısı geçersiz. Lütfen yeniden deneyin.");
    }
    assertTargetRow(rating, targetId, "Kart puanı");
    assertTargetRow(cardSocial, targetId, "Kart sosyal bilgileri");

    const wantingCount = readFiniteMetric(card.intent_people_count, "İsteyen kişi sayısı");
    const doneCount = readFiniteMetric(card.experience_people_count, "Deneyimleyen kişi sayısı");
    const activeEventCount = readFiniteMetric(card.active_event_count, "Aktif etkinlik sayısı");
    const ratingCount = readFiniteMetric(rating.rating_count, "Puan sayısı");
    const averageRating = rating.average_rating === null
      ? null
      : readFiniteMetric(rating.average_rating, "Ortalama puan");
    if (rating.viewer_rating !== null) readFiniteMetric(rating.viewer_rating, "Kişisel puan");
    const followerCount = readFiniteMetric(cardSocial.follower_count, "Takipçi sayısı");
    for (const [key, label] of [
      ["rating_count", "Sosyal puan sayısı"],
      ["related_count", "Bağlı kart sayısı"],
    ] as const) readFiniteMetric(cardSocial[key], label);
    if (cardSocial.average_rating !== null) readFiniteMetric(cardSocial.average_rating, "Sosyal ortalama puan");
    if (cardSocial.viewer_rating !== null) readFiniteMetric(cardSocial.viewer_rating, "Sosyal kişisel puan");

    if (!isNonEmptyString(cardProfile.title)
      || !isNullableString(cardProfile.creator_name)
      || !isNullableString(cardProfile.cover_url)
      || !isRecord(cardProfile.metadata)
      || !isNonEmptyString(card.title)
      || (card.seed_type_slug !== null && card.seed_type_slug !== undefined && !isNonEmptyString(card.seed_type_slug))
      || !isNullableUuid(card.activity_id ?? null)) {
      throw new Error("Kart bağlamı eksik. Lütfen yeniden deneyin.");
    }
    const typeIdValue = card.content_type_id ?? cardProfile.metadata.content_type_id;
    if (!isNonEmptyString(typeIdValue)) throw new Error("Kart türü yüklenemedi. Lütfen yeniden deneyin.");
    const typeId = typeIdValue;
    const contentTypeResult = await supabase.from("uin_content_types").select("label,icon,base_kind").eq("id", typeId).maybeSingle();
    if (contentTypeResult.error || !isRecord(contentTypeResult.data)
      || !isNonEmptyString(contentTypeResult.data.label)
      || !isNonEmptyString(contentTypeResult.data.icon)
      || !isNonEmptyString(contentTypeResult.data.base_kind)) {
      throw new Error("Kart türü yüklenemedi. Lütfen yeniden deneyin.");
    }

    const validPeople = people.data.every((person) => isUuid(person.user_id)
      && (isNonEmptyString(person.full_name) || isNonEmptyString(person.username))
      && isNullableString(person.avatar_url));
    if (!validPeople) throw new Error("Kartın kişi listesi eksik. Lütfen yeniden deneyin.");

    targetTitle = cardProfile.title;
    targetAction = targetLanguage(card.seed_type_slug || typeId || canonical?.seed_type_slug).action;
    activityId = isUuid(card.activity_id) ? card.activity_id : activityId;
    cardContext = {
      targetId,
      title: targetTitle,
      subtitle: cardProfile.creator_name || null,
      coverUrl: cardProfile.cover_url || null,
      typeLabel: contentTypeResult.data.label,
      typeIcon: contentTypeResult.data.icon,
      wantingCount,
      doneCount,
      activeEventCount,
      averageRating,
      ratingCount,
      followerCount,
      people: people.data.map((person) => ({
        userId: person.user_id as string,
        name: (isNonEmptyString(person.full_name) ? person.full_name : person.username) as string,
        avatarUrl: typeof person.avatar_url === "string" ? person.avatar_url : null,
      })),
    };
    } catch (problem) {
      // Card enrichment is independent from the verified chat and plan reads.
      // Keep those usable, but make the unavailable card panel explicit.
      console.error("Collaboration card context unavailable", problem);
      cardContext = null;
      cardContextUnavailable = true;
    }
  }
  return <main className="min-h-screen bg-gray-50 px-4 py-6 md:px-6"><div className="relative z-50 mx-auto mb-8 max-w-[1500px]"><AppNavigation/></div><div className="mx-auto max-w-6xl"><Link href="/collaboration-suggestions" className="mb-5 inline-block text-sm font-bold text-emerald-800">← Öneriler ve sohbetler</Link><CollaborationChat initialChat={chat} initialPlan={initialPlan} targetId={targetId} targetTitle={targetTitle} targetAction={targetAction} initialActivityId={activityId} cardContext={cardContext} cardContextUnavailable={cardContextUnavailable}/></div></main>;
}
