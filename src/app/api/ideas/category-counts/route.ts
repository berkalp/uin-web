import {NextResponse} from "next/server";
import {createClient} from "@/utils/supabase/server";

type ContentType={id:string;base_kind:string;active:boolean};

export async function GET(){
  const db=await createClient();
  const canonical=await db.rpc("get_uin_category_counts_v129");
  if(!canonical.error&&canonical.data&&typeof canonical.data==="object"){
    return NextResponse.json({categoryCounts:canonical.data},{headers:{"Cache-Control":"private, no-store"}});
  }
  const [typesResult,placeResult]=await Promise.all([
    db.from("uin_content_types").select("*").order("position").order("label"),
    db.rpc("get_global_place_counts_v122"),
  ]);
  if(typesResult.error)return NextResponse.json({error:"Kategori adetleri yüklenemedi."},{status:500});
  const contentTypes=(typesResult.data||[]) as ContentType[];
  const entries=await Promise.all(contentTypes.filter(type=>type.active).map(async type=>{
    if(type.base_kind==="place")return [type.id,Number((placeResult.data as {cities?:number}|null)?.cities||0)] as const;
    let query=db.from("seed_catalog_items").select("id",{count:"exact",head:true}).eq("status","active").not("canonical_target_id","is",null);
    if(type.id===type.base_kind)query=type.base_kind==="series"?query.in("item_kind",["series","video"]):query.eq("item_kind",type.base_kind);
    else query=query.contains("metadata",{content_type_id:type.id});
    const result=await query;
    return [type.id,result.error?0:Number(result.count||0)] as const;
  }));
  return NextResponse.json({categoryCounts:Object.fromEntries(entries)},{headers:{"Cache-Control":"private, no-store"}});
}
