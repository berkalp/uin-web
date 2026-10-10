import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@/utils/supabase/server";

const unavailable=(message:string)=>NextResponse.json(
  {error:message},
  {status:503,headers:{"Cache-Control":"private, no-store"}},
);
const record=(value:unknown):value is Record<string,unknown>=>Boolean(value)&&typeof value==="object";
const catalogueCard=(value:unknown):value is Record<string,unknown>=>record(value)&&typeof value.canonical_target_id==="string"&&typeof value.title==="string";
const contentType=(value:unknown)=>record(value)&&typeof value.id==="string"&&typeof value.label==="string"&&typeof value.icon==="string"&&typeof value.base_kind==="string";
const seedType=(value:unknown)=>record(value)&&typeof value.id==="string"&&typeof value.slug==="string"&&typeof value.name==="string";

export async function GET(request:NextRequest){
  try{
    const db=await createClient();
    const query=(request.nextUrl.searchParams.get("q")||"").trim().slice(0,120);
    const [cards,types,seeds,role]=await Promise.all([
      db.rpc("get_uin_catalogue_fast_v122",{p_query:query||null,p_limit:30,p_offset:0,p_target_id:null}),
      db.from("uin_content_types").select("id,label,icon,base_kind,ui_labels").eq("active",true).order("position"),
      db.from("seed_types").select("id,slug,name").eq("is_active",true),
      db.rpc("get_admin_role"),
    ]);
    if(cards.error||types.error||seeds.error)return unavailable("Kütüphane araması şu anda tamamlanamadı. Lütfen tekrar dene.");
    if(!Array.isArray(cards.data)||!cards.data.every(catalogueCard)||!Array.isArray(types.data)||!types.data.every(contentType)||!Array.isArray(seeds.data)||!seeds.data.every(seedType))return unavailable("Kütüphane araması eksik veri döndürdü. Lütfen tekrar dene.");
    const roleDenied=role.error?.code==="42501";
    if(role.error&&!roleDenied)return unavailable("Kullanıcı yetkileri doğrulanamadı. Lütfen tekrar dene.");
    return NextResponse.json({
      canAddSports:!roleDenied&&Boolean(role.data),
      cards:cards.data.map((c:Record<string,unknown>)=>({id:c.canonical_target_id,title:c.title,coverUrl:c.catalog_cover_url||c.cover_url,activityId:c.activity_id,categoryId:c.category_id})),
      types:types.data,
      seedTypeId:seeds.data[0]?.id||null,
      seedTypes:seeds.data,
    },{headers:{"Cache-Control":"private, max-age=15, must-revalidate","Vary":"Cookie, Authorization"}});
  }catch{
    return unavailable("Kütüphane araması şu anda tamamlanamadı. Lütfen tekrar dene.");
  }
}
