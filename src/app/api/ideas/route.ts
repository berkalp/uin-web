import {GET as searchSource} from "@/app/api/favorites/search/route";
import {normalizeReferenceLinks} from "@/utils/referenceLinks";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import {createClient as createSupabaseClient} from "@supabase/supabase-js";
async function requestClient(request:NextRequest){const token=(request.headers.get("authorization")||"").match(/^Bearer\s+(.+)$/i)?.[1];return token?createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,{global:{headers:{Authorization:`Bearer ${token}`}},auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}}):createClient()}

const PROVIDERS = new Set(["spotify", "open_library", "google_books", "tvmaze", "igdb", "wikidata"]);
const KINDS = new Set(["artist", "book", "movie", "series", "watch", "game", "place", "director", "actor", "writer", "comedian", "theatre_artist", "athlete", "club", "sport", "hobby", "activity", "podcast"]);
function clean(value: unknown, max = 2000) { return typeof value === "string" ? value.trim().slice(0, max) : ""; }
function itemKind(kind: string, metadata?: Record<string, unknown>) { if (kind === "watch") return metadata?.uin_item_kind === "series" ? "series" : "movie"; return kind; }

export async function GET(request: NextRequest) {
  const query = clean(request.nextUrl.searchParams.get("q"), 240);
  const seedTypeId = clean(request.nextUrl.searchParams.get("seedTypeId"), 80);
  const requestedKind = clean(request.nextUrl.searchParams.get("kind"), 40);
  if (query.length < 2 || !seedTypeId) return NextResponse.json({ items: [] });
  const supabase = await requestClient(request);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Konu aramak için giriş yapmalısın." }, { status: 401 });
  let { data, error } = await supabase.rpc("search_existing_topics_v44", { p_query: query, p_seed_type_id: seedTypeId, p_limit: 12 });
  if (!error && (!data || data.length === 0)) {
    const fallback = await supabase.rpc("search_existing_topics_v44", { p_query: query, p_seed_type_id: null, p_limit: 12 });
    data = fallback.data;
    error = fallback.error;
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  let items = (data ?? []) as Array<Record<string, unknown>>;
  if (requestedKind && KINDS.has(requestedKind) && items.length) {
    const ids = items.map(row => clean(row.catalogItemId, 80)).filter(Boolean);
    const catalogue = ids.length ? await supabase.from("seed_catalog_items").select("id,item_kind,metadata").in("id", ids) : { data: [], error: null };
    if (!catalogue.error) {
      const kinds = new Map((catalogue.data ?? []).map(row => [row.id, { itemKind: row.item_kind, metadata: row.metadata as Record<string, unknown> | null }]));
      items = items.map(row => ({ ...row, itemKind: kinds.get(clean(row.catalogItemId, 80))?.itemKind || null })).filter(row => {
        const stored = clean(row.itemKind, 40).toLocaleLowerCase("tr-TR");
        if (requestedKind === "series") return stored === "series" || stored === "video";
        if (requestedKind === "movie") return stored === "movie";
        return !stored || stored === requestedKind;
      });
    }
  }
  return NextResponse.json({ items });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const mode = body.mode === "manual" ? "manual" : "verified";
    const seedTypeId = clean(body.seedTypeId, 80); const kind = clean(body.kind, 40);
    if (!seedTypeId || !KINDS.has(kind)) return NextResponse.json({ error: "Konu eylemi geçersiz." }, { status: 400 });
    const supabase = await requestClient(request); const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Konu eklemek için giriş yapmalısın." }, { status: 401 });

    const {data:adminRole}=await supabase.rpc("get_admin_role");
    const adminDirectCreate=Boolean(adminRole)&&body.adminDirectCreate===true;
    const contentTypeId=clean(body.contentTypeId,100);
    let configuredProvider=clean(body.searchProvider,40)||"auto",configuredEntity=clean(body.searchEntity,120),configuredManualFallback=false;
    if(contentTypeId){const lookup=await supabase.from("uin_content_types").select("base_kind,active,ui_labels").eq("id",contentTypeId).maybeSingle();const labels=lookup.data?.ui_labels&&typeof lookup.data.ui_labels==="object"?lookup.data.ui_labels as Record<string,unknown>:{};if(lookup.error||!lookup.data?.active||lookup.data.base_kind!==kind)return NextResponse.json({error:"İçerik türü geçersiz veya kullanıma kapalı."},{status:400});configuredProvider=clean(labels.search_provider,40)||"auto";configuredEntity=clean(labels.search_entity,120);configuredManualFallback=labels.manual_fallback==="true";}
    let raw = body.item && typeof body.item === "object" ? body.item as Record<string, unknown> : {};
    if(mode==="manual"&&!adminDirectCreate&&kind!=="club"&&configuredProvider!=="manual"&&!configuredManualFallback)return NextResponse.json({error:"Bu içerik türünde kullanıcı önerisine izin verilmiyor."},{status:403});
    if(mode==="verified"){
      const url=new URL("/api/favorites/search",request.url);url.searchParams.set("kind",kind);url.searchParams.set("q",clean(raw.title,240));url.searchParams.set("provider",configuredProvider);url.searchParams.set("entity",configuredEntity);
      const checked=await searchSource(new NextRequest(url));const payload=await checked.json();
      const match=checked.ok&&Array.isArray(payload.items)?payload.items.find((item:Record<string,unknown>)=>item.provider===raw.provider&&item.externalId===raw.externalId):null;
      if(!match)return NextResponse.json({error:"Kart kaynaktan doğrulanamadı. Yeniden arayıp sonuçlardan seç."},{status:422});raw=match;
    }
    const provider = clean(raw.provider, 40); const externalId = clean(raw.externalId, 240);
    const title = mode === "verified" ? clean(raw.title, 240) : clean(body.title, 240);
    if (!title) return NextResponse.json({ error: "Konunun adı gerekli." }, { status: 400 });
    if (mode === "verified" && (!PROVIDERS.has(provider) || !externalId)) return NextResponse.json({ error: "Doğrulanmış kaynak bilgisi eksik." }, { status: 400 });

const submittedLinks=body.referenceLinks===undefined?(clean(body.referenceUrl)?[{label:"Kaynak",url:clean(body.referenceUrl)}]:[]):body.referenceLinks;
    if(!Array.isArray(submittedLinks)||submittedLinks.length>20)return NextResponse.json({error:"En fazla 20 kaynak bağlantısı ekleyebilirsin."},{status:400});
    for(const row of submittedLinks){if(!row||typeof row!=="object")return NextResponse.json({error:"Kaynak bağlantısı geçersiz."},{status:400});const link=row as Record<string,unknown>;const label=clean(link.label,81);const url=clean(link.url);if(!label&&!url)continue;if(!url||label.length>80)return NextResponse.json({error:"Kaynak adını ve bağlantısını kontrol et."},{status:400});try{if(!["http:","https:"].includes(new URL(url).protocol))throw new Error();}catch{return NextResponse.json({error:"Kaynak bağlantılarını kontrol et."},{status:400});}}
    const referenceLinks=normalizeReferenceLinks(submittedLinks);
    const sourceUrl = mode === "verified" ? clean(raw.sourceUrl) : referenceLinks[0]?.url||clean(body.referenceUrl);
    if(mode==="manual"&&!adminDirectCreate&&kind!=="club"&&!sourceUrl)return NextResponse.json({error:"Öneriyi doğrulayabilmemiz için kaynak bağlantısı gerekli."},{status:400});
    const sourceMetadata = mode === "verified" && raw.metadata && typeof raw.metadata === "object" ? raw.metadata as Record<string, unknown> : { description: clean(body.description, 1000), submission: "manual", ...(referenceLinks.length?{reference_links:referenceLinks}: {}) };
    const metadata = { ...sourceMetadata };
    const {data:duplicate,error:duplicateError}=await supabase.rpc("find_uin_duplicate_v73",{p_title:title,p_kind:kind,p_creator:mode==="verified"?clean(raw.creatorName||raw.subtitle,240):clean(body.creatorName,240)});
    if(duplicateError)return NextResponse.json({error:"Kart kontrol edilemedi."},{status:500});
    if(duplicate)return NextResponse.json({error:"Bu kayıt Kütüphanede zaten var. Mevcut kaydı açabilirsin.",canonicalTargetId:duplicate.canonicalTargetId||null,status:duplicate.status},{status:409});
    if (mode === "verified") {
      const { data: verified, error: verifiedError } = await supabase.rpc("add_verified_seed_catalog_item_v42", {
        p_seed_type_id: seedTypeId, p_item_kind: itemKind(kind, sourceMetadata), p_canonical_title: title,
        p_creator_name: clean(raw.creatorName || raw.subtitle, 240) || null,
        p_cover_url: clean(raw.coverUrl) || null, p_provider: provider,
        p_external_id: externalId, p_source_url: sourceUrl || null, p_metadata: metadata,
      });
      if (verifiedError) return NextResponse.json({ error: verifiedError.message }, { status: 500 });
      const row = Array.isArray(verified) ? verified[0] : verified;
      const catalogItemId = row && typeof row === "object" ? clean((row as Record<string, unknown>).catalog_item_id, 80) : "";
      const canonicalTargetId = row && typeof row === "object" ? clean((row as Record<string, unknown>).canonical_target_id, 80) : "";
      if (!catalogItemId) return NextResponse.json({ error: "Konu kaydı oluşturulamadı." }, { status: 500 });
      if (body.createTopicOnly === true) return NextResponse.json({ catalogItemId, canonicalTargetId: canonicalTargetId || null, status: "active" });
      const { data: seedId, error: plantError } = await supabase.rpc("plant_seed_from_catalog", { p_catalog_item_id: catalogItemId, p_visibility: "everyone", p_note: null, p_target_date: null, p_custom_title: null, p_catalog_edition_id: null, p_inspired_by_seed_id: null });
      if (plantError || typeof seedId !== "string") return NextResponse.json({ error: plantError?.message || "Konu eklenemedi." }, { status: 500 });
      return NextResponse.json({ catalogItemId, canonicalTargetId: canonicalTargetId || null, seedId, status: "active" });
    }

    for(const value of [clean(body.coverUrl),sourceUrl]){if(value){try{if(!["http:","https:"].includes(new URL(value).protocol))throw new Error();}catch{return NextResponse.json({error:"Geçerli bir görsel veya kaynak bağlantısı gir."},{status:400});}}}
    const selectedContentTypeId=contentTypeId||kind;
    const {data:contentType,error:typeError}=await supabase.from("uin_content_types").select("id,base_kind,active").eq("id",selectedContentTypeId).maybeSingle();
    if(typeError||!contentType?.active||contentType.base_kind!==kind)return NextResponse.json({error:"Geçerli bir içerik türü seç."},{status:400});
    if(adminDirectCreate){
      const {data:targetId,error:createError}=await supabase.rpc(kind==="club"?"admin_create_club_card_v75":"admin_create_uin_card_v59",{p_seed_type_id:seedTypeId,p_type_id:selectedContentTypeId,p_title:title,p_creator_name:clean(body.creatorName,240)||null,p_cover_url:clean(body.coverUrl)||null,p_description:clean(body.description,1000)||null,p_reference_url:sourceUrl||null,...(kind==="club"?{p_profile:body.clubProfile||{}}:{})});
      if(createError)return NextResponse.json({error:createError.message},{status:400});
      const sourceSave=await supabase.rpc("admin_save_uin_card_reference_links_v93",{p_target_id:targetId,p_links:referenceLinks});
      if(sourceSave.error)return NextResponse.json({error:sourceSave.error.message},{status:500});
      return NextResponse.json({canonicalTargetId:targetId,status:"active",...(kind==="club"?{redirectUrl:`/clubs/${targetId}`}:{})});
    }
    const { data: catalogItemId, error: suggestionError } = await supabase.rpc("suggest_seed_catalog_item", {
      p_seed_type_id: seedTypeId, p_item_kind: ["book","movie","series","game","artist","place","podcast"].includes(kind)?itemKind(kind):"generic", p_canonical_title: title,
      p_creator_name: clean(body.creatorName,240)||null,
      p_original_title: null, p_release_year: null, p_cover_url: clean(body.coverUrl)||null,
      p_language_code: "tr", p_metadata: { ...metadata, content_type_id:selectedContentTypeId, ...(sourceUrl ? { reference_url: sourceUrl } : {}), ...(referenceLinks.length ? { reference_links: referenceLinks } : {}) },
    });
    if (suggestionError || typeof catalogItemId !== "string") return NextResponse.json({ error: suggestionError?.message || "Konu eklenemedi." }, { status: 500 });
    return NextResponse.json({ catalogItemId, status: "pending" });
  } catch (cause) { return NextResponse.json({ error: cause instanceof Error ? cause.message : "Konu eklenemedi." }, { status: 500 }); }
}
