import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

type SeedRow = { seed_id?: string | null; canonical_target_id?: string | null; status?: string | null };
type PersonalRow = { id?: string | null; target_id?: string | null; type_id?: string | null; start_date?: string | null; end_date?: string | null; location?: string | null };
type PlanTopicRow = { resource_id?: string | null; target_id?: string | null; type_id?: string | null; intent_id?: string|null; plan_id?:string|null; event_title?:string|null; start_date?:string|null; end_date?:string|null; location?:string|null; organizer_name?:string|null; organizer_avatar_url?:string|null; viewer_role?:string|null; personal_event_count?:number|string|null };
type ResolvedRow = { requested_id?: string | null; resolved_id?: string | null; type_id?: string | null };
type Row = Record<string, unknown>;

export async function GET(request: NextRequest) {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  const [seeds, presentations, personal, planTopics] = await Promise.all([
    db.rpc("get_my_canonical_seeds_v31", { p_status: null }),
    db.rpc("get_my_uin_seed_presentations_v70"),
    db.rpc("get_my_uin_personal_cards_v57"),
    db.rpc("get_my_uin_active_plan_topics_v153"),
  ]);
  const failed = [seeds, presentations, personal, planTopics].find((result) => result.error);
  if (failed?.error) {
    console.error("personal scope sources unavailable", failed.error);
    return NextResponse.json({ error: "Kişisel kart kapsamları yüklenemedi." }, { status: 503 });
  }
  const seedRows = (seeds.data ?? []) as SeedRow[];
  const presentationRows = (presentations.data ?? []) as Array<{ seed_id?: string | null; type_id?: string | null; start_date?:string|null; end_date?:string|null; location?:string|null }>;
  const personalRows = (personal.data ?? []) as PersonalRow[];
  const planTopicRows = (planTopics.data ?? []) as PlanTopicRow[];
  const unique = (values: Array<string | null | undefined>) => [...new Set(values.filter((value): value is string => Boolean(value)))];
  const rawTargetIds = unique([
    ...seedRows.map((row) => row.canonical_target_id),
    ...personalRows.map((row) => row.target_id),
    ...planTopicRows.map((row) => row.target_id),
  ]);
  const resolvedResult = rawTargetIds.length
    ? await db.rpc("resolve_uin_card_targets_v143", { p_target_ids: rawTargetIds })
    : { data: [], error: null };
  if (resolvedResult.error) {
    console.error("personal scope target resolution unavailable", resolvedResult.error);
    return NextResponse.json({ error: "Kişisel kart kimlikleri çözümlenemedi. Lütfen tekrar dene." }, { status: 503 });
  }
  const resolvedRows = (resolvedResult.data ?? []) as ResolvedRow[];
  const resolvedByRequested = new Map(resolvedRows
    .filter((row): row is ResolvedRow & { requested_id: string; resolved_id: string } => Boolean(row.requested_id && row.resolved_id))
    .map((row) => [row.requested_id, row.resolved_id]));
  const typeByResolved = new Map(resolvedRows
    .filter((row): row is ResolvedRow & { resolved_id: string; type_id: string } => Boolean(row.resolved_id && row.type_id))
    .map((row) => [row.resolved_id, row.type_id]));
  const unresolvedIds = rawTargetIds.filter((id) => !resolvedByRequested.has(id));
  if (unresolvedIds.length) {
    console.error("personal scope targets missing canonical identities", { unresolvedIds });
    return NextResponse.json({ error: "Bazı kişisel kartların kimliği bulunamadı. Lütfen tekrar dene." }, { status: 503 });
  }
  const missingTypeIds = unique([...resolvedByRequested.values()]).filter((id) => !typeByResolved.has(id));
  if (missingTypeIds.length) {
    console.error("personal scope targets missing canonical types", { missingTypeIds });
    return NextResponse.json({ error: "Bazı kişisel kartların kategorisi bulunamadı. Lütfen tekrar dene." }, { status: 503 });
  }
  const resolveTarget = (id: string | null | undefined) => id ? resolvedByRequested.get(id) ?? null : null;
  const presentationType = new Map(presentationRows.map((row) => [row.seed_id, row.type_id || "activity"]));
  const presentationBySeed = new Map(presentationRows.filter(row=>row.seed_id).map(row=>[row.seed_id!,row]));
  const plansByTarget = planTopicRows
    .map((row) => ({ ...row, resolved_target_id: resolveTarget(row.target_id) }))
    .filter((row): row is PlanTopicRow & { resolved_target_id: string } => Boolean(row.resolved_target_id));
  const activeSeeds = seedRows
    .filter((row) => row.status === "active")
    .map((row) => ({ ...row, resolved_target_id: resolveTarget(row.canonical_target_id) }))
    .filter((row): row is SeedRow & { resolved_target_id: string } => Boolean(row.resolved_target_id));
  const completedSeeds = seedRows
    .filter((row) => row.status === "completed")
    .map((row) => ({ ...row, resolved_target_id: resolveTarget(row.canonical_target_id) }))
    .filter((row): row is SeedRow & { resolved_target_id: string } => Boolean(row.resolved_target_id));
  const canonicalPersonalRows = personalRows
    .map((row) => ({ ...row, resolved_target_id: resolveTarget(row.target_id) }))
    .filter((row): row is PersonalRow & { resolved_target_id: string } => Boolean(row.resolved_target_id));

  // Personal membership stays direct. Tree propagation belongs to community
  // summary metrics and must never make an ancestor look like the user's wish.
  const wishes = unique([...activeSeeds.map((row) => row.resolved_target_id), ...canonicalPersonalRows.map((row) => row.resolved_target_id)]);
  const planTargets = unique(plansByTarget.map((row) => row.resolved_target_id));
  const experiences = unique(completedSeeds.map((row) => row.resolved_target_id));
  const includeCards = request.nextUrl.searchParams.get("cards") === "1";
  const requestedScope = request.nextUrl.searchParams.get("scope");
  const selectedScope = requestedScope === "plans" || requestedScope === "experiences" ? requestedScope : "wishes";
  const requestedKind = request.nextUrl.searchParams.get("kind") || "all";
  const selectedScopeIds = selectedScope === "plans" ? planTargets : selectedScope === "experiences" ? experiences : wishes;
  const targetIds = includeCards ? selectedScopeIds.filter((id) => requestedKind === "all" || typeByResolved.get(id) === requestedKind) : [];
  const countTypes = (ids: string[]) => ids.reduce<Record<string, number>>((counts, id) => {
    const type = typeByResolved.get(id)!;
    counts[type] = (counts[type] || 0) + 1;
    return counts;
  }, {});
  const counts = {
    wishes: countTypes(wishes),
    plans: countTypes(planTargets),
    experiences: countTypes(experiences),
  };
  if (!includeCards) {
    return NextResponse.json({ wishes, plans: planTargets, experiences, catalogue: [], counts }, { headers: { "Cache-Control": "private, no-store" } });
  }
  let cardsResult = targetIds.length
    ? await db.rpc("get_uin_catalogue_for_targets_v123", { p_target_ids: targetIds })
    : { data: [], error: null };
  if (cardsResult.error && targetIds.length) {
    cardsResult = await db.rpc("get_uin_catalogue_for_targets_v123", { p_target_ids: targetIds });
  }
  if (cardsResult.error) {
    console.error("personal scope card summaries unavailable", cardsResult.error);
    return NextResponse.json({ error: "Kişisel kart sayaçları yüklenemedi. Lütfen tekrar dene." }, { status: 503 });
  }
  const cardRows = (cardsResult.data ?? []) as Row[];
  const cardByTarget = new Map(cardRows.map((card) => [String(card.canonical_target_id || ""), card]));
  const missingIds = targetIds.filter((id) => !cardByTarget.has(id));
  if (missingIds.length) {
    console.error("personal scope cards missing summaries", { missingIds });
    return NextResponse.json({ error: "Bazı kişisel kartların sayaçları yüklenemedi. Lütfen tekrar dene." }, { status: 503 });
  }
  const metricFields = ["intent_people_count", "experience_people_count", "completed_event_count", "expired_event_count", "cancelled_event_count", "child_count"] as const;
  const invalidMetricIds = targetIds.filter((id) => { const card = cardByTarget.get(id)!; return metricFields.some((field) => card[field] == null || !Number.isFinite(Number(card[field]))) || (card.active_event_count == null && card.social_intent_count == null); });
  if (invalidMetricIds.length) {
    console.error("personal scope cards missing summary metrics", { invalidMetricIds });
    return NextResponse.json({ error: "Bazı kişisel kartların sayaçları eksik geldi. Lütfen tekrar dene." }, { status: 503 });
  }
  const chunks = <T,>(values: T[], size: number) => Array.from({ length: Math.ceil(values.length / size) }, (_, page) => values.slice(page * size, (page + 1) * size));
  const itemPages = targetIds.length ? await Promise.all(chunks(targetIds, 40).map((ids) => db.from("seed_catalog_items").select("id,canonical_target_id,item_kind,canonical_title,creator_name,cover_url,metadata").in("canonical_target_id", ids).eq("status", "active").order("updated_at", { ascending: false }))) : [];
  if (itemPages.some((page) => page.error)) {
    console.error("personal scope catalogue placements unavailable", itemPages.find((page) => page.error)?.error);
    return NextResponse.json({ error: "Kişisel kart ayrıntıları yüklenemedi." }, { status: 503 });
  }
  const items = itemPages.flatMap((page) => (page.data || []) as Row[]);
  const [ratingResult, socialResult, coverResult, hierarchyResult] = targetIds.length ? await Promise.all([
    db.rpc("get_uin_card_ratings_v85", { p_target_ids: targetIds }),
    db.rpc("get_uin_card_social_v87", { p_target_ids: targetIds }),
    db.rpc("get_uin_cover_positions_v62", { p_target_ids: targetIds }),
    db.rpc("get_uin_card_parent_edges_v143", { p_target_ids: targetIds }),
  ]) : [{ data: [], error: null }, { data: [], error: null }, { data: [], error: null }, { data: [], error: null }];
  if ([ratingResult, socialResult, coverResult, hierarchyResult].some((result) => result.error)) {
    console.error("personal scope card enrichment unavailable", { rating: ratingResult.error, social: socialResult.error, cover: coverResult.error, hierarchy: hierarchyResult.error });
    return NextResponse.json({ error: "Kişisel kart ayrıntıları yüklenemedi. Lütfen tekrar dene." }, { status: 503 });
  }
  const itemByTarget = new Map<string, Row>();
  items.forEach((item) => { const id = String(item.canonical_target_id || ""); if (id && !itemByTarget.has(id)) itemByTarget.set(id, item); });
  const ratings = new Map(((ratingResult.data || []) as Row[]).map((row) => [String(row.target_id || ""), row]));
  const social = new Map(((socialResult.data || []) as Row[]).map((row) => [String(row.target_id || ""), row]));
  const covers = new Map(((coverResult.data || []) as Row[]).map((row) => [String(row.target_id || ""), Number(row.cover_position_y || 50)]));
  const hierarchy = new Map(((hierarchyResult.data || []) as Row[]).map((row) => [String(row.target_id || ""), row]));
  const activeSeedByTarget = new Map(activeSeeds.map((row) => [row.resolved_target_id, row]));
  const completedSeedByTarget = new Map(completedSeeds.map((row) => [row.resolved_target_id, row]));
  const personalByTarget = new Map(canonicalPersonalRows.map((row) => [row.resolved_target_id, row]));
  const planPreviewByTarget = new Map(plansByTarget.map((row) => [row.resolved_target_id, row]));
  const typeByTarget = new Map<string, string>();
  plansByTarget.forEach((row) => { if (row.type_id) typeByTarget.set(row.resolved_target_id, row.type_id); });
  activeSeeds.forEach((row) => { const type = presentationType.get(row.seed_id); if (type) typeByTarget.set(row.resolved_target_id, type); });
  completedSeeds.forEach((row) => { const type = presentationType.get(row.seed_id); if (type && !typeByTarget.has(row.resolved_target_id)) typeByTarget.set(row.resolved_target_id, type); });
  canonicalPersonalRows.forEach((row) => { if (row.type_id) typeByTarget.set(row.resolved_target_id, row.type_id); });
  const catalogue = targetIds.map((id) => {
    const item = itemByTarget.get(id), card = cardByTarget.get(id)!, rating = ratings.get(id), stats = social.get(id), tree = hierarchy.get(id);
    const ownSeed = activeSeedByTarget.get(id) || completedSeedByTarget.get(id);
    const personalWish=personalByTarget.get(id); const seedWish=ownSeed?.seed_id?presentationBySeed.get(ownSeed.seed_id):undefined; const planPreview=planPreviewByTarget.get(id);
    return { ...card, canonical_target_id: id, catalog_item_id: item?.id || card.catalog_item_id || null, title: card.title || item?.canonical_title || "Kart", subtitle: card.subtitle || item?.creator_name || null, item_kind: item?.item_kind || card.item_kind || typeByTarget.get(id) || "activity", content_type_id: String(card.content_type_id || (item?.metadata as Row | undefined)?.content_type_id || typeByTarget.get(id) || "activity"), catalog_cover_url: card.catalog_cover_url || card.cover_url || item?.cover_url || null, cover_position_y: covers.get(id) ?? 50, own_seed_id: ownSeed?.seed_id || card.own_seed_id || null, own_seed_status: ownSeed?.status || null, own_common_intent_id: personalWish?.id || null, personal_start_date: personalWish?.start_date||seedWish?.start_date||null, personal_end_date: personalWish?.end_date||seedWish?.end_date||null, personal_location: personalWish?.location||seedWish?.location||null, personal_event: planPreview?{resource_id:planPreview.resource_id,intent_id:planPreview.intent_id,plan_id:planPreview.plan_id,title:planPreview.event_title,start_date:planPreview.start_date,end_date:planPreview.end_date,location:planPreview.location,organizer_name:planPreview.organizer_name,organizer_avatar_url:planPreview.organizer_avatar_url,viewer_role:planPreview.viewer_role,count:Number(planPreview.personal_event_count||1)}:null, intent_people_count: Number(card.intent_people_count), experience_people_count: Number(card.experience_people_count), active_event_count: Number(card.active_event_count ?? card.social_intent_count), completed_event_count: Number(card.completed_event_count), expired_event_count: Number(card.expired_event_count), cancelled_event_count: Number(card.cancelled_event_count), average_rating: rating?.average_rating == null ? null : Number(rating.average_rating), rating_count: Number(rating?.rating_count || 0), follower_count: Number(stats?.follower_count || 0), related_count: Number(stats?.related_count || 0), parent_target_id: tree?.parent_target_id || null, hierarchy_sort_order: Number(tree?.sort_order || 0), hierarchy_section_title: tree?.section_title || null, hierarchy_depth: Number(tree?.depth || 0), child_count: Number(card.child_count) };
  });
  return NextResponse.json({ wishes, plans: planTargets, experiences, catalogue, counts }, { headers: { "Cache-Control": "private, no-store" } });
}
