import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@/utils/supabase/server";

type ContentType={id:string;base_kind:string;active:boolean};
type Row=Record<string,unknown>;

export async function GET(request:NextRequest){
  const db=await createClient();
  const kind=(request.nextUrl.searchParams.get("kind")||"").trim();
  const typeResult=await db.from("uin_content_types").select("id,base_kind,active").eq("id",kind).maybeSingle();
  const type=typeResult.data as ContentType|null;
  if(typeResult.error||!type?.active)return NextResponse.json({error:"Kategori bulunamadı."},{status:404});
  if(type.base_kind==="place")return NextResponse.json({catalogue:[]},{headers:{"Cache-Control":"private, no-store"}});
  let itemQuery=db.from("seed_catalog_items").select("id,canonical_target_id,item_kind,canonical_title,creator_name,cover_url,metadata").eq("status","active").not("canonical_target_id","is",null).order("updated_at",{ascending:false}).limit(40);
  if(type.id===type.base_kind)itemQuery=type.base_kind==="series"?itemQuery.in("item_kind",["series","video"]):itemQuery.eq("item_kind",type.base_kind);
  else itemQuery=itemQuery.contains("metadata",{content_type_id:type.id});
  const itemResult=await itemQuery;
  if(itemResult.error)return NextResponse.json({error:"Kategori kartları yüklenemedi."},{status:500});
  const items=(itemResult.data||[]) as Array<Row>;
  const ids=[...new Set(items.map(item=>String(item.canonical_target_id||"")).filter(Boolean))];
  if(!ids.length)return NextResponse.json({catalogue:[]},{headers:{"Cache-Control":"private, no-store"}});
  const cardPages=await Promise.all(Array.from({length:Math.ceil(ids.length/10)},(_,page)=>db.rpc("get_uin_catalogue_for_targets_v123",{p_target_ids:ids.slice(page*10,(page+1)*10)})));
  const cardRows=cardPages.filter(page=>!page.error).flatMap(page=>(page.data||[]) as Row[]);
  const [summaryResult,ratingResult,socialResult,coverResult,hierarchyResult]=await Promise.all([
    db.rpc("get_uin_card_summary_v107",{p_target_ids:ids}),
    db.rpc("get_uin_card_ratings_v85",{p_target_ids:ids}),
    db.rpc("get_uin_card_social_v87",{p_target_ids:ids}),
    db.rpc("get_uin_cover_positions_v62",{p_target_ids:ids}),
    db.rpc("get_uin_card_hierarchy_v81",{p_target_ids:ids}),
  ]);
  const itemByTarget=new Map(items.map(item=>[String(item.canonical_target_id||""),item]));
  const summaries=new Map(((summaryResult.data||[]) as Row[]).map(row=>[String(row.target_id||""),row]));
  const ratings=new Map(((ratingResult.data||[]) as Row[]).map(row=>[String(row.target_id||""),row]));
  const social=new Map(((socialResult.data||[]) as Row[]).map(row=>[String(row.target_id||""),row]));
  const covers=new Map(((coverResult.data||[]) as Row[]).map(row=>[String(row.target_id||""),Number(row.cover_position_y||50)]));
  const hierarchy=new Map(((hierarchyResult.data||[]) as Row[]).map(row=>[String(row.target_id||""),row]));
  const cardByTarget=new Map(cardRows.map(card=>[String(card.canonical_target_id||""),card]));
  const catalogue=ids.map(id=>cardByTarget.get(id)||{canonical_target_id:id,title:itemByTarget.get(id)?.canonical_title||"Kart",subtitle:itemByTarget.get(id)?.creator_name||null,cover_url:itemByTarget.get(id)?.cover_url||null,intent_people_count:0,experience_people_count:0,social_intent_count:0}).map(card=>{
    const id=String(card.canonical_target_id||""),item=itemByTarget.get(id),summary=summaries.get(id),rating=ratings.get(id),stats=social.get(id),tree=hierarchy.get(id);
    return {...card,catalog_item_id:item?.id||null,item_kind:item?.item_kind||card.item_kind||type.base_kind,content_type_id:String((item?.metadata as Row|undefined)?.content_type_id||summary?.type_id||type.id),subtitle:summary?.creator_name||card.subtitle||item?.creator_name||null,catalog_cover_url:summary?.editorial_cover_url||card.catalog_cover_url||card.cover_url||item?.cover_url||null,cover_position_y:covers.get(id)??50,intent_people_count:Number(summary?.wanting??card.intent_people_count??0),experience_people_count:Number(summary?.done??card.experience_people_count??0),active_event_count:Number(summary?.active??card.social_intent_count??0),completed_event_count:Number(summary?.completed||0),expired_event_count:Number(summary?.expired||0),cancelled_event_count:Number(summary?.cancelled||0),average_rating:rating?.average_rating==null?null:Number(rating.average_rating),rating_count:Number(rating?.rating_count||0),follower_count:Number(stats?.follower_count||0),related_count:Number(stats?.related_count||0),parent_target_id:tree?.parent_target_id||null,hierarchy_sort_order:Number(tree?.sort_order||0),hierarchy_section_title:tree?.section_title||null,hierarchy_depth:Number(tree?.depth||0),child_count:Number(summary?.child_count||0)};
  });
  return NextResponse.json({catalogue},{headers:{"Cache-Control":"private, no-store"}});
}
