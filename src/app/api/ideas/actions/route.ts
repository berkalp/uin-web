import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

type Body = { action?: "completed" | "favorite"; catalogItemId?: string; rating?: number; visibility?: "only_me" | "friends" | "everyone" };

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as Body;
    const catalogItemId = typeof body.catalogItemId === "string" ? body.catalogItemId : "";
    const visibility = ["only_me", "friends", "everyone"].includes(body.visibility || "") ? body.visibility! : "everyone";
    if (!catalogItemId || !body.action) return NextResponse.json({ error: "İşlem bilgisi eksik." }, { status: 400 });
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Giriş yapmalısın." }, { status: 401 });
    if (body.action === "favorite") {
      const { error } = await supabase.rpc("toggle_my_favorite_v2921", { p_catalog_item_id: catalogItemId, p_favorite: true });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ favorite: true });
    }
    const rating = Number(body.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 10) return NextResponse.json({ error: "1 ile 10 arasında puan seç." }, { status: 400 });
    const { data: seedId, error: plantError } = await supabase.rpc("plant_seed_from_catalog", { p_catalog_item_id: catalogItemId, p_visibility: visibility, p_note: null, p_target_date: null, p_custom_title: null, p_catalog_edition_id: null, p_inspired_by_seed_id: null });
    if (plantError || typeof seedId !== "string") return NextResponse.json({ error: plantError?.message || "Deneyim oluşturulamadı." }, { status: 500 });
    const { error: stateError } = await supabase.rpc("save_my_seed_v17_state", { p_seed_id: seedId, p_relationship_status: "completed", p_experience_precision: "unknown", p_experience_date: null, p_experience_year: null, p_personal_cover_url: null, p_rating: rating });
    if (stateError) return NextResponse.json({ error: stateError.message }, { status: 500 });
    await supabase.rpc("record_product_analytics_event_v81", { p_event_name: "experience_created", p_target_id: null, p_intent_id: null, p_plan_id: null, p_resource_id: seedId, p_surface: "web", p_properties: { source: "idea_quick_action" } });
    if (rating >= 9) {
      const { error: favoriteError } = await supabase.rpc("toggle_my_favorite_v2921", { p_catalog_item_id: catalogItemId, p_favorite: true });
      if (favoriteError) return NextResponse.json({ error: favoriteError.message }, { status: 500 });
    }
    return NextResponse.json({ seedId, favorite: rating >= 9 });
  } catch (cause) {
    return NextResponse.json({ error: cause instanceof Error ? cause.message : "İşlem tamamlanamadı." }, { status: 500 });
  }
}
