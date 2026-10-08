import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

type SeedRow = { seed_id?: string | null; canonical_target_id?: string | null; status?: string | null };
type PersonalRow = { target_id?: string | null; type_id?: string | null };
type SourceRow = { resource_id?: string | null; target_id?: string | null; type_id?: string | null };

export async function GET() {
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
  return NextResponse.json({
    wishes: unique([...seedRows.filter((row) => row.status === "active").map((row) => row.canonical_target_id), ...personalRows.map((row) => row.target_id)]),
    plans: unique(plansByTarget.map((row) => row.target_id)),
    experiences: unique(seedRows.filter((row) => row.status === "completed").map((row) => row.canonical_target_id)),
    counts: {
      wishes: countTypes([...seedRows.filter((row) => row.status === "active").map((row) => [row.canonical_target_id, presentationType.get(row.seed_id)] as [string | null | undefined, string | null | undefined]), ...personalRows.map((row) => [row.target_id, row.type_id] as [string | null | undefined, string | null | undefined])]),
      plans: countTypes(plansByTarget.map((row) => [row.target_id, row.type_id])),
      experiences: countTypes(seedRows.filter((row) => row.status === "completed").map((row) => [row.canonical_target_id, presentationType.get(row.seed_id)])),
    },
  }, { headers: { "Cache-Control": "private, no-store" } });
}
