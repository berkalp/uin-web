import {commonIntentTitle} from "@/utils/commonIntentTitle";
import type {MyPersonalIntent} from "@/components/seeds/MyPersonalIntentCard";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";

import type { PublicFavoriteItem } from "@/components/profile/PublicFavoritesPanel";
import ExperienceDashboard, { type SocialExperienceItem } from "@/components/seeds/ExperienceDashboard";


import {
  parseSeedLinks,
  parseSeedReactionContexts,
  type SeedRecord,
} from "@/utils/seeds";
import { createClient } from "@/utils/supabase/server";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isOptionalNullableString(value: unknown) {
  return value === undefined || isNullableString(value);
}

function isRecordArray(value: unknown): value is Record<string, unknown>[] {
  return Array.isArray(value) && value.every(isRecord);
}

function isRecordRelation(value: unknown) {
  return value === null || isRecord(value) || isRecordArray(value);
}

function isNonnegativeCount(value: unknown) {
  if (
    (typeof value !== "number" && typeof value !== "string") ||
    (typeof value === "string" && !value.trim())
  ) {
    return false;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && Number.isInteger(parsed) && parsed >= 0;
}

function isSeedRecordRow(value: unknown) {
  if (!isRecord(value)) return false;

  return (
    typeof value.seed_id === "string" &&
    typeof value.seed_type_id === "string" &&
    typeof value.seed_type_name === "string" &&
    typeof value.seed_type_slug === "string" &&
    typeof value.seed_type_icon === "string" &&
    typeof value.title === "string" &&
    isNullableString(value.subtitle) &&
    isNullableString(value.notes) &&
    isNullableString(value.cover_url) &&
    (value.seed_scope === "library" || value.seed_scope === "private") &&
    typeof value.status === "string" &&
    isOptionalNullableString(value.canonical_target_id)
  );
}

function isProfileRow(value: unknown) {
  return (
    isRecord(value) &&
    isNullableString(value.full_name) &&
    isNullableString(value.username) &&
    isNullableString(value.avatar_url)
  );
}

function isPersonalIntentRow(value: unknown) {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.target_id === "string" &&
    typeof value.title === "string" &&
    typeof value.type_id === "string" &&
    typeof value.type_label === "string" &&
    typeof value.type_icon === "string" &&
    typeof value.base_kind === "string" &&
    isNullableString(value.subtitle) &&
    isNullableString(value.cover_url) &&
    isNullableString(value.catalog_item_id) &&
    isNullableString(value.start_date) &&
    isNullableString(value.end_date) &&
    typeof value.timing_precision === "string" &&
    Array.isArray(value.date_options) &&
    value.date_options.every((option) => typeof option === "string") &&
    isNullableString(value.location) &&
    isNullableString(value.notes) &&
    typeof value.created_at === "string"
  );
}

function isRatingRow(value: unknown) {
  return (
    isRecord(value) &&
    typeof value.seed_id === "string" &&
    (value.rating === null ||
      (typeof value.rating === "number" && Number.isFinite(value.rating)))
  );
}

function isPresentationRow(value: unknown) {
  return isRecord(value) && typeof value.seed_id === "string";
}

function isFavoriteRow(value: unknown) {
  if (!isRecord(value) || typeof value.title !== "string") return false;

  return (
    isOptionalNullableString(value.id) &&
    isOptionalNullableString(value.catalog_item_id) &&
    isOptionalNullableString(value.canonical_target_id) &&
    isOptionalNullableString(value.source_type) &&
    (typeof value.id === "string" || typeof value.catalog_item_id === "string")
  );
}

function isFavoriteTargetRow(value: unknown) {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    isNullableString(value.canonical_target_id)
  );
}

function isReminderRow(value: unknown) {
  return (
    isRecord(value) &&
    typeof value.resource_id === "string" &&
    isNullableString(value.seed_target_time) &&
    isNullableString(value.timezone)
  );
}

function isReactionRow(value: unknown) {
  return (
    isRecord(value) &&
    typeof value.seed_id === "string" &&
    isNonnegativeCount(value.save_count) &&
    isNonnegativeCount(value.water_count) &&
    typeof value.viewer_saved === "boolean" &&
    typeof value.viewer_watered === "boolean" &&
    isNonnegativeCount(value.friend_water_count) &&
    isRecordArray(value.friend_water_preview) &&
    value.friend_water_preview.every(
      (friend) =>
        typeof friend.user_id === "string" &&
        isNullableString(friend.full_name) &&
        isNullableString(friend.username) &&
        isNullableString(friend.avatar_url)
    ) &&
    typeof value.viewer_can_react === "boolean" &&
    isNullableString(value.reaction_disabled_reason)
  );
}

export async function loadMySeedsData({ searchParams, user }: { searchParams: Promise<{ alan?: string | string[]; gorunum?: string | string[] }>; user: User }) {
  const resolvedSearchParams = await searchParams;
  const requestedArea = resolvedSearchParams.alan;
  const areaValue = Array.isArray(requestedArea) ? requestedArea[0] : requestedArea;
  const requestedView = Array.isArray(resolvedSearchParams.gorunum) ? resolvedSearchParams.gorunum[0] : resolvedSearchParams.gorunum;
  const activeArea = areaValue === "deneyimler" || areaValue === "sevdiklerim" ? "deneyimler" : "niyetler";

  const supabase = await createClient();

  const [mySeedsResult, profileResult,personalCardsResult,ratingsResult,presentationResult] = await Promise.all([
    supabase.rpc("get_my_canonical_seeds_v31", {
      p_status: null,
    }),
    supabase.from("profiles").select("full_name, username, avatar_url").eq("id", user.id).maybeSingle(),
    supabase.rpc("get_my_uin_personal_cards_v57"),
    supabase.rpc("get_my_uin_ratings_v57"),
    supabase.rpc("get_my_uin_seed_presentations_v70"),
  ]);

  const mySeedsPayloadValid =
    Array.isArray(mySeedsResult.data) &&
    mySeedsResult.data.every(isSeedRecordRow);
  const profilePayloadValid = isProfileRow(profileResult.data);
  const personalCardsPayloadValid =
    Array.isArray(personalCardsResult.data) &&
    personalCardsResult.data.every(isPersonalIntentRow);
  const ratingsPayloadValid =
    Array.isArray(ratingsResult.data) &&
    ratingsResult.data.every(isRatingRow);
  const presentationsPayloadValid =
    Array.isArray(presentationResult.data) &&
    presentationResult.data.every(isPresentationRow);

  let loadFailed = Boolean(
    mySeedsResult.error ||
    profileResult.error ||
    personalCardsResult.error ||
    ratingsResult.error ||
    presentationResult.error ||
    !mySeedsPayloadValid ||
    !profilePayloadValid ||
    !personalCardsPayloadValid ||
    !ratingsPayloadValid ||
    !presentationsPayloadValid
  );

  if (mySeedsResult.error) {
    console.error("My Seeds query failed:", mySeedsResult.error);
  }

  const ratings=(ratingsPayloadValid?ratingsResult.data:[]) as Array<{seed_id:string;rating:number|null}>;
  const presentations=(presentationsPayloadValid?presentationResult.data:[]) as Array<import("@/components/cards/PersonalWishSummary").WishPresentation & {seed_id:string}>;
  const baseSeeds = ((mySeedsPayloadValid?mySeedsResult.data:[]) as SeedRecord[]).map(
    (seed) => ({
      ...seed,
      wish_presentation:presentations.find(p=>p.seed_id===seed.seed_id),
      title:seed.seed_scope==="private"?seed.title:commonIntentTitle(seed.title),
      personal_rating:ratings.find(state=>state.seed_id===seed.seed_id)?.rating??null,
      links: parseSeedLinks(seed.links),
    })
  );

  const username =
    profilePayloadValid && typeof profileResult.data?.username === "string"
      ? profileResult.data.username
      : null;

  const adminRoleResult = await supabase.rpc("is_admin");
  loadFailed ||= Boolean(
    adminRoleResult.error || typeof adminRoleResult.data !== "boolean"
  );
  const isAdmin = adminRoleResult.data === true;
  const favoritesResult = await supabase.rpc("get_my_preferences_v2922");
  const favoritesPayloadValid = Boolean(
    favoritesResult.data &&
    typeof favoritesResult.data === "object" &&
    !Array.isArray(favoritesResult.data) &&
    Array.isArray((favoritesResult.data as { favorites?: unknown }).favorites) &&
    (favoritesResult.data as { favorites: unknown[] }).favorites.every(isFavoriteRow)
  );
  loadFailed ||= Boolean(favoritesResult.error || !favoritesPayloadValid);
  const preferences = (favoritesPayloadValid ? favoritesResult.data : {}) as { favorites?: PublicFavoriteItem[] };
  const rawFavorites = Array.isArray(preferences.favorites) ? preferences.favorites : [];
  const favoriteIds=rawFavorites.filter(item=>item.source_type!=="subject").map(item=>item.id||item.catalog_item_id||"").filter(Boolean);
  const favoriteTargets=favoriteIds.length?await supabase.from("seed_catalog_items").select("id,canonical_target_id").in("id",favoriteIds):{data:[],error:null};
  const favoriteTargetsPayloadValid =
    Array.isArray(favoriteTargets.data) &&
    favoriteTargets.data.every(isFavoriteTargetRow);
  loadFailed ||= Boolean(favoriteTargets.error || !favoriteTargetsPayloadValid);
  const favoriteTargetRows: Array<{
    id: string;
    canonical_target_id: string | null;
  }> = favoriteTargetsPayloadValid && Array.isArray(favoriteTargets.data)
    ? favoriteTargets.data
    : [];
  const favorites=rawFavorites.map(item=>({...item,canonical_target_id:item.canonical_target_id||favoriteTargetRows.find(target=>target.id===(item.id||item.catalog_item_id))?.canonical_target_id||null}));

  const reminderResult =
    baseSeeds.length > 0
      ? await supabase
          .from("user_resource_reminder_settings")
          .select("resource_id, seed_target_time, timezone")
          .eq("resource_type", "seed")
          .in("resource_id", baseSeeds.map((seed) => seed.seed_id))
      : { data: [], error: null };

  if (reminderResult.error) {
    console.warn(
      "Seed reminder times are temporarily unavailable:",
      reminderResult.error.message
    );
  }
  const reminderPayloadValid =
    Array.isArray(reminderResult.data) &&
    reminderResult.data.every(isReminderRow);
  loadFailed ||= Boolean(reminderResult.error || !reminderPayloadValid);

  const reminderRows: Array<{
    resource_id: string;
    seed_target_time: string | null;
    timezone: string | null;
  }> = reminderPayloadValid && Array.isArray(reminderResult.data)
    ? reminderResult.data
    : [];

  const reminderBySeedId = new Map(
    reminderRows.map((row) => [
      String(row.resource_id),
      {
        targetTime:
          typeof row.seed_target_time === "string"
            ? row.seed_target_time.slice(0, 5)
            : "09:00",
        timezone:
          typeof row.timezone === "string" && row.timezone
            ? row.timezone
            : "Europe/Istanbul",
      },
    ])
  );

  const reactionSeedIds = [
    ...new Set([
      ...baseSeeds.map((seed) => seed.seed_id),
    ]),
  ];

  const reactionResult =
    reactionSeedIds.length > 0
      ? await supabase.rpc("get_visible_seed_reaction_context", {
          p_seed_ids: reactionSeedIds,
        })
      : { data: [], error: null };

  if (reactionResult.error) {
    console.warn(
      "Seed reaction counts are temporarily unavailable:",
      reactionResult.error.message
    );
  }
  const reactionPayloadValid =
    Array.isArray(reactionResult.data) &&
    reactionResult.data.every(isReactionRow);
  loadFailed ||= Boolean(reactionResult.error || !reactionPayloadValid);

  const reactionBySeedId = new Map(
    parseSeedReactionContexts(reactionPayloadValid ? reactionResult.data : []).map((context) => [
      context.seed_id,
      context,
    ])
  );

  const seeds = baseSeeds.map((seed) => {
    const reminder = reminderBySeedId.get(seed.seed_id);
    return {
      ...seed,
      reaction_context: reactionBySeedId.get(seed.seed_id) ?? null,
      reminder_target_time: reminder?.targetTime ?? "09:00",
      reminder_timezone: reminder?.timezone ?? "Europe/Istanbul",
    };
  });


  let socialExperiences: SocialExperienceItem[] = [];

  if (activeArea === "deneyimler") {
    type ExperienceCategoryRow = {
      name: string | null;
      default_cover_url: string | null;
    };

    type ExperienceActivityRow = {
      name: string | null;
      default_cover_url: string | null;
      activity_categories:
        | ExperienceCategoryRow
        | ExperienceCategoryRow[]
        | null;
    };

    type ExperienceLocationRow = {
      country_name: string | null;
      city: string | null;
      district: string | null;
    };

    type CompletedIntentRow = {
      id: string;
      end_date: string | null;
      expired_at: string | null;
      created_at: string;
      locations:
        | ExperienceLocationRow
        | ExperienceLocationRow[]
        | null;
      activities:
        | ExperienceActivityRow
        | ExperienceActivityRow[]
        | null;
    };

    type ExperiencePlanMemberRow = {
      user_id: string;
      role: string | null;
      status: string | null;
    };

    type ExperiencePlanIntentRow = {
      intent_id: string;
      status: string | null;
    };

    type ExperiencePlanRow = {
      id: string;
      host_user_id: string;
      title: string | null;
      cover_url: string | null;
      activity_location_name: string | null;
      activity_address_text: string | null;
      scheduled_end: string | null;
      window_end: string | null;
      completed_at: string | null;
      expired_at: string | null;
      status: string | null;
      created_at: string;
      locations:
        | ExperienceLocationRow
        | ExperienceLocationRow[]
        | null;
      activities:
        | ExperienceActivityRow
        | ExperienceActivityRow[]
        | null;
      plan_members: ExperiencePlanMemberRow[] | null;
      plan_intents: ExperiencePlanIntentRow[] | null;
    };

    const firstExperienceRelation = <T,>(
      value: T | T[] | null | undefined
    ): T | null => {
      if (!value) return null;
      return Array.isArray(value)
        ? value[0] ?? null
        : value;
    };

    const [completedIntentResult, experiencePlanResult] =
      await Promise.all([
        supabase
          .from("intents")
          .select(`
            id,
            end_date,
            expired_at,
            created_at,
            locations (
              country_name,
              city,
              district
            ),
            activities (
              name,
              default_cover_url,
              activity_categories (
                name,
                default_cover_url
              )
            )
          `)
          .eq("user_id", user.id)
          .eq("status", "completed")
          .order("created_at", { ascending: false }),

        supabase
          .from("plans")
          .select(`
            id,
            host_user_id,
            title,
            cover_url,
            activity_location_name,
            activity_address_text,
            scheduled_end,
            window_end,
            completed_at,
            expired_at,
            status,
            created_at,
            locations (
              country_name,
              city,
              district
            ),
            activities (
              name,
              default_cover_url,
              activity_categories (
                name,
                default_cover_url
              )
            ),
            plan_members (
              user_id,
              role,
              status
            ),
            plan_intents (
              intent_id,
              status
            )
          `)
          .order("created_at", { ascending: false }),
      ]);

    const completedIntentPayloadValid =
      Array.isArray(completedIntentResult.data) &&
      completedIntentResult.data.every(
        (row) =>
          isRecord(row) &&
          typeof row.id === "string" &&
          isNullableString(row.end_date) &&
          isNullableString(row.expired_at) &&
          typeof row.created_at === "string" &&
          isRecordRelation(row.locations) &&
          isRecordRelation(row.activities)
      );
    const experiencePlanPayloadValid =
      Array.isArray(experiencePlanResult.data) &&
      experiencePlanResult.data.every(
        (row) =>
          isRecord(row) &&
          typeof row.id === "string" &&
          typeof row.host_user_id === "string" &&
          isNullableString(row.title) &&
          isNullableString(row.status) &&
          typeof row.created_at === "string" &&
          isRecordRelation(row.locations) &&
          isRecordRelation(row.activities) &&
          (row.plan_members === null ||
            (isRecordArray(row.plan_members) &&
              row.plan_members.every(
                (member) =>
                  typeof member.user_id === "string" &&
                  isNullableString(member.role) &&
                  isNullableString(member.status)
              ))) &&
          (row.plan_intents === null ||
            (isRecordArray(row.plan_intents) &&
              row.plan_intents.every(
                (link) =>
                  typeof link.intent_id === "string" &&
                  isNullableString(link.status)
              )))
      );

    if (completedIntentResult.error) {
      console.error(
        "Completed social intents could not be loaded:",
        completedIntentResult.error
      );
    }

    if (experiencePlanResult.error) {
      console.error(
        "Social experience plans could not be loaded:",
        experiencePlanResult.error
      );
    }
    loadFailed ||= Boolean(
      completedIntentResult.error ||
      experiencePlanResult.error ||
      !completedIntentPayloadValid ||
      !experiencePlanPayloadValid
    );

    const allExperiencePlans =
      (experiencePlanPayloadValid ? experiencePlanResult.data : []) as unknown as ExperiencePlanRow[];

    const linkedIntentIds = new Set<string>();

    allExperiencePlans.forEach((plan) => {
      (plan.plan_intents ?? [])
        .filter((link) => link.status === "active")
        .forEach((link) => {
          linkedIntentIds.add(link.intent_id);
        });
    });

    const completedPlanExperiences =
      allExperiencePlans
        .filter((plan) => {
          if (plan.expired_at) {
            return false;
          }

          if (plan.status !== "completed") {
            return false;
          }

          if (!plan.completed_at) {
            return false;
          }

          if (plan.host_user_id === user.id) {
            return true;
          }

          return (plan.plan_members ?? []).some(
            (member) =>
              member.user_id === user.id &&
              member.status === "active"
          );
        })
        .map((plan) => {
          const activity =
            firstExperienceRelation(plan.activities);

          const category =
            firstExperienceRelation(
              activity?.activity_categories
            );

          const location =
            firstExperienceRelation(plan.locations);

          const membership =
            (plan.plan_members ?? []).find(
              (member) =>
                member.user_id === user.id &&
                member.status === "active"
            ) ?? null;

          const roleLabel =
            plan.host_user_id === user.id
              ? "Yürüten"
              : membership?.role === "co_host"
                ? "Birlikte yürüten"
                : "Katılımcı";

          const locationLabel =
            [
              plan.activity_location_name,
              plan.activity_address_text,
            ]
              .filter(Boolean)
              .join(", ") ||
            [
              location?.district,
              location?.city,
              location?.country_name,
            ]
              .filter(Boolean)
              .join(", ") ||
            null;

          return {
            id: `plan-${plan.id}`,
            title:
              activity?.name ||
              plan.title ||
              "Sosyal deneyim",
            categoryName:
              category?.name || "Sosyal",
            coverUrl:
              plan.cover_url ||
              activity?.default_cover_url ||
              category?.default_cover_url ||
              null,
            locationLabel,
            sortAt:
              plan.completed_at ||
              plan.scheduled_end ||
              plan.window_end ||
              plan.created_at,
            roleLabel,
            href: `/activities/${encodeURIComponent(
              plan.id
            )}`,
          } satisfies SocialExperienceItem;
        });

    const completedStandaloneIntents =
      (
        (completedIntentPayloadValid ? completedIntentResult.data : []) as unknown as CompletedIntentRow[]
      )
        .filter(
          (intent) =>
            !intent.expired_at &&
            !linkedIntentIds.has(intent.id)
        )
        .map((intent) => {
          const activity =
            firstExperienceRelation(intent.activities);

          const category =
            firstExperienceRelation(
              activity?.activity_categories
            );

          const location =
            firstExperienceRelation(intent.locations);

          return {
            id: `intent-${intent.id}`,
            title:
              activity?.name ||
              "Sosyal deneyim",
            categoryName:
              category?.name || "Sosyal",
            coverUrl:
              activity?.default_cover_url ||
              category?.default_cover_url ||
              null,
            locationLabel:
              [
                location?.district,
                location?.city,
                location?.country_name,
              ]
                .filter(Boolean)
                .join(", ") ||
              null,
            sortAt:
              intent.end_date ||
              intent.created_at,
            roleLabel: "Yürüten",
            href: `/activities/${encodeURIComponent(
              intent.id
            )}`,
          } satisfies SocialExperienceItem;
        });

    socialExperiences = [
      ...completedPlanExperiences,
      ...completedStandaloneIntents,
    ].sort(
      (first, second) =>
        new Date(second.sortAt).getTime() -
        new Date(first.sortAt).getTime()
    );
  }
  return {independentIntents:((personalCardsPayloadValid?personalCardsResult.data:[]) as MyPersonalIntent[]).map(intent=>({...intent,has_completed_experience:baseSeeds.some(seed=>seed.status==="completed"&&seed.canonical_target_id===intent.target_id)})),personalCardsError:personalCardsResult.error,seeds,socialExperiences,favorites,isAdmin,user,username,profileResult,mySeedsResult,requestedView,activeArea,loadFailed};
}
export default function MySeedsContent({data,filter="all",lovedOnly=false,typeFilter="",query="",sourceTypes=[]}:{data:Awaited<ReturnType<typeof loadMySeedsData>>;filter?:"all"|"personal"|"social"|"loved";lovedOnly?:boolean;typeFilter?:string;query?:string;sourceTypes?:Array<{resource_id:string;target_id:string;type_id:string}>}){
 if(data.loadFailed)return <div role="alert" className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-5 text-red-700"><p className="font-bold">Kartların eksiksiz yüklenemedi.</p><p className="mt-2 text-sm">Eksik veya yanlış kayıt göstermemek için listeyi gizledik.</p><Link href="/timeline" className="mt-4 inline-flex rounded-xl bg-red-700 px-4 py-2 text-sm font-bold text-white">Yeniden dene</Link></div>;
 return <ExperienceDashboard key={filter} seeds={data.seeds} socialExperiences={data.socialExperiences} favorites={data.favorites} typeFilter={typeFilter} query={query} sourceTypes={sourceTypes} initialFilter={filter} lovedOnly={lovedOnly} isAuthenticated/>;
}
