import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

type SeedRow = { seed_id?: string | null; canonical_target_id?: string | null; status?: string | null };
type PersonalRow = { target_id?: string | null; type_id?: string | null };
type SourceRow = { resource_id?: string | null; target_id?: string | null; type_id?: string | null };
type Row = Record<string, unknown>;

export async function GET(request: NextRequest) {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  const [seeds, presentations, personal, sources, plans, intents] = await Promise.all([
    db.rpc("get_my_canonical_seeds_v31", { p_status: null }),
    db.rpc("get_my_uin_seed_presentations_v70"),
    db.rpc("get_my_uin_personal_cards_v57"),
    db.rpc("get_my_uin_topic_sources_v71"),
    db.from("plans").select("id,status").in("status", ["forming", "planned", "active"]),
    db.from("intents").select("id,status").in("status", ["open", "future", "forming", "planned"]),
  ]);
  const failed = [seeds, presentations, personal, sources, plans, intents].find((result) => result.error);
  if (failed?.error) return NextResponse.json({ error: "Kişisel kart kapsamları yüklenemedi." }, { status: 500 });
  const seedRows = (seeds.data ?? []) as SeedRow[];
  const presentationRows = (presentations.data ?? []) as Array<{ seed_id?: string | null; type_id?: string | null }>;
  const presentationType = new Map(presentationRows.map((row) => [row.seed_id, row.type_id || "activity"]));
  const personalRows = (personal.data ?? []) as PersonalRow[];
  const sourceRows = (sources.data ?? []) as SourceRow[];
  const plannedResources = new Set([...(plans.data ?? []).map((row) => row.id), ...(intents.data ?? []).map((row) => row.id)]);
  const unique = (values: Array<string | null | undefined>) => [...new Set(values.filter((value): value is string => Boolean(value)))];
  const plansByTarget = sourceRows.filter((row) => row.resource_id && plannedResources.has(row.resource_id));
  const countTypes = (entries: Array<[string | null | undefined, string | null | undefined]>) => [...new Map(entries.filter((entry): entry is [string, string | null | undefined] => Boolean(entry[0]))).values()].reduce<Record<string, number>>((counts, type) => { const id = type || "activity"; counts[id] = (counts[id] || 0) + 1; return counts; }, {});
  const wishes = unique([...seedRows.filter((row) => row.status === "active").map((row) => row.canonical_target_id), ...personalRows.map((row) => row.target_id)]);
  const planTargets = unique(plansByTarget.map((row) => row.target_id));
  const experiences = unique(seedRows.filter((row) => row.status === "completed").map((row) => row.canonical_target_id));
  const includeCards = request.nextUrl.searchParams.get("cards") === "1";
  const targetIds = includeCards ? unique([...wishes, ...planTargets, ...experiences]) : [];
  const chunks = <T,>(values: T[], size: number) => Array.from({ length: Math.ceil(values.length / size) }, (_, page) => values.slice(page * size, (page + 1) * size));
  const itemPages = targetIds.length ? await Promise.all(chunks(targetIds, 40).map((ids) => db.from("seed_catalog_items").select("id,canonical_target_id,item_kind,canonical_title,creator_name,cover_url,metadata").in("canonical_target_id", ids).eq("status", "active"))) : [];
  if (itemPages.some((page) => page.error)) return NextResponse.json({ error: "Kişisel kart kapsamları yüklenemedi." }, { status: 500 });
  const items = itemPages.flatMap((page) => (page.data || []) as Row[]);
  const cardRows: Row[] = [];
  for (const ids of chunks(targetIds, 4)) {
    let loaded = false;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const page = await db.rpc("get_uin_catalogue_for_targets_v123", { p_target_ids: ids });
      if (!page.error) {
        cardRows.push(...((page.data || []) as Row[]));
        loaded = true;
        break;
      }
    }
    if (!loaded) return NextResponse.json({ error: "Kişisel kart sayaçları yüklenemedi. Lütfen tekrar dene." }, { status: 503 });
  }
  const [ratingResult, socialResult, coverResult, hierarchyResult] = targetIds.length ? await Promise.all([
    db.rpc("get_uin_card_ratings_v85", { p_target_ids: targetIds }),
    db.rpc("get_uin_card_social_v87", { p_target_ids: targetIds }),
    db.rpc("get_uin_cover_positions_v62", { p_target_ids: targetIds }),
    db.rpc("get_uin_card_hierarchy_v81", { p_target_ids: targetIds }),
  ]) : [{ data: [], error: null }, { data: [], error: null }, { data: [], error: null }, { data: [], error: null }];
  const itemByTarget = new Map(items.map((item) => [String(item.canonical_target_id || ""), item]));
  const cardByTarget = new Map(cardRows.map((card) => [String(card.canonical_target_id || ""), card]));
  const ratings = new Map(((ratingResult.data || []) as Row[]).map((row) => [String(row.target_id || ""), row]));
  const social = new Map(((socialResult.data || []) as Row[]).map((row) => [String(row.target_id || ""), row]));
  const covers = new Map(((coverResult.data || []) as Row[]).map((row) => [String(row.target_id || ""), Number(row.cover_position_y || 50)]));
  const hierarchy = new Map(((hierarchyResult.data || []) as Row[]).map((row) => [String(row.target_id || ""), row]));
  const typeByTarget = new Map<string, string>();
  personalRows.forEach((row) => { if (row.target_id && row.type_id) typeByTarget.set(row.target_id, row.type_id); });
  plansByTarget.forEach((row) => { if (row.target_id && row.type_id) typeByTarget.set(row.target_id, row.type_id); });
  seedRows.forEach((row) => { const type = presentationType.get(row.seed_id); if (row.canonical_target_id && type) typeByTarget.set(row.canonical_target_id, type); });
  const catalogue = targetIds.map((id) => {
    const item = itemByTarget.get(id), card = cardByTarget.get(id) || {}, rating = ratings.get(id), stats = social.get(id), tree = hierarchy.get(id);
    return { ...card, canonical_target_id: id, catalog_item_id: item?.id || card.catalog_item_id || null, title: card.title || item?.canonical_title || "Kart", subtitle: card.subtitle || item?.creator_name || null, item_kind: item?.item_kind || card.item_kind || typeByTarget.get(id) || "activity", content_type_id: String((item?.metadata as Row | undefined)?.content_type_id || card.content_type_id || typeByTarget.get(id) || "activity"), catalog_cover_url: card.catalog_cover_url || card.cover_url || item?.cover_url || null, cover_position_y: covers.get(id) ?? 50, intent_people_count: Number(card.intent_people_count ?? 0), experience_people_count: Number(card.experience_people_count ?? 0), active_event_count: Number(card.active_event_count ?? card.social_intent_count ?? 0), completed_event_count: Number(card.completed_event_count || 0), expired_event_count: Number(card.expired_event_count || 0), cancelled_event_count: Number(card.cancelled_event_count || 0), average_rating: rating?.average_rating == null ? null : Number(rating.average_rating), rating_count: Number(rating?.rating_count || 0), follower_count: Number(stats?.follower_count || 0), related_count: Number(stats?.related_count || 0), parent_target_id: tree?.parent_target_id || null, hierarchy_sort_order: Number(tree?.sort_order || 0), hierarchy_section_title: tree?.section_title || null, hierarchy_depth: Number(tree?.depth || 0), child_count: Number(card.child_count || 0) };
  });
  return NextResponse.json({
    wishes,
    plans: planTargets,
    experiences,
    catalogue,
    counts: {
      wishes: countTypes([...seedRows.filter((row) => row.status === "active").map((row) => [row.canonical_target_id, presentationType.get(row.seed_id)] as [string | null | undefined, string | null | undefined]), ...personalRows.map((row) => [row.target_id, row.type_id] as [string | null | undefined, string | null | undefined])]),
      plans: countTypes(plansByTarget.map((row) => [row.target_id, row.type_id])),
      experiences: countTypes(seedRows.filter((row) => row.status === "completed").map((row) => [row.canonical_target_id, presentationType.get(row.seed_id)])),
    },
  }, { headers: { "Cache-Control": "private, no-store" } });
}
