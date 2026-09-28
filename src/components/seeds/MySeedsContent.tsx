import {commonIntentTitle} from "@/utils/commonIntentTitle";
import type {MyPersonalIntent} from "@/components/seeds/MyPersonalIntentCard";
import { redirect } from "next/navigation";

import type { PublicFavoriteItem } from "@/components/profile/PublicFavoritesPanel";
import ExperienceDashboard, { type SocialExperienceItem } from "@/components/seeds/ExperienceDashboard";


import {
  parseSeedLinks,
  parseSeedReactionContexts,
  type SeedRecord,
} from "@/utils/seeds";
import { createClient } from "@/utils/supabase/server";

export async function loadMySeedsData({ searchParams }: { searchParams: Promise<{ alan?: string | string[]; gorunum?: string | string[] }> }) {
  const resolvedSearchParams = await searchParams;
  const requestedArea = resolvedSearchParams.alan;
  const areaValue = Array.isArray(requestedArea) ? requestedArea[0] : requestedArea;
  const requestedView = Array.isArray(resolvedSearchParams.gorunum) ? resolvedSearchParams.gorunum[0] : resolvedSearchParams.gorunum;
  const activeArea = areaValue === "deneyimler" || areaValue === "sevdiklerim" ? "deneyimler" : "niyetler";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  const [mySeedsResult, profileResult,personalCardsResult,ratingsResult,presentationResult] = await Promise.all([
    supabase.rpc("get_my_canonical_seeds_v31", {
      p_status: null,
    }),
    supabase.from("profiles").select("full_name, username, avatar_url").eq("id", user.id).maybeSingle(),
    supabase.rpc("get_my_uin_personal_cards_v57"),
    supabase.rpc("get_my_uin_ratings_v57"),
    supabase.rpc("get_my_uin_seed_presentations_v70"),
  ]);

  if (mySeedsResult.error) {
    console.error("My Seeds query failed:", mySeedsResult.error);
  }

  const ratings=(ratingsResult.data||[]) as Array<{seed_id:string;rating:number|null}>;
  const presentations=(presentationResult.data||[]) as Array<import("@/components/cards/PersonalWishSummary").WishPresentation & {seed_id:string}>;
  const baseSeeds = ((mySeedsResult.data ?? []) as SeedRecord[]).map(
    (seed) => ({
      ...seed,
      wish_presentation:presentations.find(p=>p.seed_id===seed.seed_id),
      title:seed.seed_scope==="private"?seed.title:commonIntentTitle(seed.title),
      personal_rating:ratings.find(state=>state.seed_id===seed.seed_id)?.rating??null,
      links: parseSeedLinks(seed.links),
    })
  );

  const username =
    typeof profileResult.data?.username === "string"
      ? profileResult.data.username
      : null;

  const adminRoleResult = await supabase.rpc("get_admin_role");
  const isAdmin =
    typeof adminRoleResult.data === "string" &&
    adminRoleResult.data.length > 0;
  const favoritesResult = await supabase.rpc("get_my_preferences_v2922");
  const preferences = (favoritesResult.data ?? {}) as { favorites?: PublicFavoriteItem[] };
  const rawFavorites = Array.isArray(preferences.favorites) ? preferences.favorites : [];
  const favoriteIds=rawFavorites.filter(item=>item.source_type!=="subject").map(item=>item.id||item.catalog_item_id||"").filter(Boolean);
  const favoriteTargets=favoriteIds.length?await supabase.from("seed_catalog_items").select("id,canonical_target_id").in("id",favoriteIds):{data:[],error:null};
  const favorites=rawFavorites.map(item=>({...item,canonical_target_id:item.canonical_target_id||favoriteTargets.data?.find(target=>target.id===(item.id||item.catalog_item_id))?.canonical_target_id||null}));

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

  const reminderBySeedId = new Map(
    (reminderResult.data ?? []).map((row) => [
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

  const reactionBySeedId = new Map(
    parseSeedReactionContexts(reactionResult.data).map((context) => [
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

    const allExperiencePlans =
      (experiencePlanResult.data ?? []) as unknown as ExperiencePlanRow[];

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
        (completedIntentResult.data ?? []) as unknown as CompletedIntentRow[]
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
  return {independentIntents:((personalCardsResult.data||[]) as MyPersonalIntent[]).map(intent=>({...intent,has_completed_experience:baseSeeds.some(seed=>seed.status==="completed"&&seed.canonical_target_id===intent.target_id)})),personalCardsError:personalCardsResult.error,seeds,socialExperiences,favorites,isAdmin,user,username,profileResult,mySeedsResult,requestedView,activeArea};
}
export default function MySeedsContent({data,filter="all",lovedOnly=false,typeFilter="",query="",sourceTypes=[]}:{data:Awaited<ReturnType<typeof loadMySeedsData>>;filter?:"all"|"personal"|"social"|"loved";lovedOnly?:boolean;typeFilter?:string;query?:string;sourceTypes?:Array<{resource_id:string;target_id:string;type_id:string}>}){
 if(data.mySeedsResult.error)return <p className="mt-6 rounded-2xl bg-red-50 p-5 text-red-700">Kartların yüklenemedi. Lütfen yeniden dene.</p>;
 return <ExperienceDashboard key={filter} seeds={data.seeds} socialExperiences={data.socialExperiences} favorites={data.favorites} typeFilter={typeFilter} query={query} sourceTypes={sourceTypes} initialFilter={filter} lovedOnly={lovedOnly} isAuthenticated/>;
}
