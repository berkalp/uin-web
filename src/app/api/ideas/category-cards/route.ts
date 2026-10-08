import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@/utils/supabase/server";
import {readImdbMetadata} from "@/utils/imdbMetadata";
import {readBookListMetadata} from "@/utils/bookListMetadata";
import {readSeriesListMetadata} from "@/utils/seriesListMetadata";

type ContentType={id:string;base_kind:string;active:boolean};
type Row=Record<string,unknown>;

export async function GET(request:NextRequest){
  const db=await createClient();
  const kind=(request.nextUrl.searchParams.get("kind")||"").trim();
  const typeResult=await db.from("uin_content_types").select("id,base_kind,active").eq("id",kind).maybeSingle();
  const type=typeResult.data as ContentType|null;
  if(typeResult.error||!type?.active)return NextResponse.json({error:"Kategori bulunamadı."},{status:404});
  if(type.base_kind==="place")return NextResponse.json({catalogue:[]},{headers:{"Cache-Control":"private, no-store"}});
  const pageSize=500;
  const items:Row[]=[];
  for(let offset=0;;offset+=pageSize){
    let itemQuery=db.from("seed_catalog_items").select("id,canonical_target_id,item_kind,canonical_title,creator_name,cover_url,metadata").eq("status","active").not("canonical_target_id","is",null).order("updated_at",{ascending:false}).order("id",{ascending:false}).range(offset,offset+pageSize-1);
    if(type.id===type.base_kind)itemQuery=type.base_kind==="series"?itemQuery.in("item_kind",["series","video"]):itemQuery.eq("item_kind",type.base_kind);
    else itemQuery=itemQuery.contains("metadata",{content_type_id:type.id});
    const itemResult=await itemQuery;
    if(itemResult.error){
      console.error("category catalogue placements unavailable",{kind,offset,error:itemResult.error});
      return NextResponse.json({error:"Kategori kartları yüklenemedi."},{status:503});
    }
    const page=(itemResult.data||[]) as Row[];
    items.push(...page);
    if(page.length<pageSize)break;
  }
  const ids=[...new Set(items.map(item=>String(item.canonical_target_id||"")).filter(Boolean))];
  if(!ids.length)return NextResponse.json({catalogue:[]},{headers:{"Cache-Control":"private, no-store"}});
  // This existing security-definer RPC is the canonical visibility projection:
  // it returns every requested target except admin-hidden cards for non-admins.
  let visibilityResult=await db.rpc("get_uin_cover_positions_v62",{p_target_ids:ids});
  if(visibilityResult.error)visibilityResult=await db.rpc("get_uin_cover_positions_v62",{p_target_ids:ids});
  if(visibilityResult.error){
    console.error("category card visibility unavailable",{kind,error:visibilityResult.error});
    return NextResponse.json({error:"Kategori kartlarının görünürlüğü doğrulanamadı. Lütfen tekrar dene."},{status:503});
  }
  const visibilityRows=(visibilityResult.data||[]) as Row[];
  const visibleTargetIds=new Set(visibilityRows.map(row=>String(row.target_id||"")).filter(Boolean));
  const visibleIds=ids.filter(id=>visibleTargetIds.has(id));
  let cardsResult=await db.rpc("get_uin_catalogue_for_targets_v123",{p_target_ids:visibleIds});
  if(cardsResult.error)cardsResult=await db.rpc("get_uin_catalogue_for_targets_v123",{p_target_ids:visibleIds});
  if(cardsResult.error){
    console.error("category card summary unavailable",{kind,error:cardsResult.error});
    return NextResponse.json({error:"Kategori kartı sayaçları yüklenemedi. Lütfen tekrar dene."},{status:503});
  }
  const cardRows=(cardsResult.data||[]) as Row[];
  const cardByTarget=new Map(cardRows.map(card=>[String(card.canonical_target_id||""),card]));
  const missingIds=visibleIds.filter(id=>!cardByTarget.has(id));
  if(missingIds.length){
    console.error("visible category cards missing summaries",{kind,missingIds});
    return NextResponse.json({error:"Bazı görünür kategori kartlarının sayaçları yüklenemedi. Lütfen tekrar dene."},{status:503});
  }
  const metricFields=["intent_people_count","experience_people_count","completed_event_count","expired_event_count","cancelled_event_count","child_count"] as const;
  const invalidMetricIds=visibleIds.filter(id=>{const card=cardByTarget.get(id)!;return metricFields.some(field=>card[field]==null||!Number.isFinite(Number(card[field])))||(card.active_event_count==null&&card.social_intent_count==null)});
  if(invalidMetricIds.length){
    console.error("category cards missing summary metrics",{kind,invalidMetricIds});
    return NextResponse.json({error:"Bazı kategori kartlarının sayaçları eksik geldi. Lütfen tekrar dene."},{status:503});
  }
  const [ratingResult,socialResult,hierarchyResult]=await Promise.all([
    db.rpc("get_uin_card_ratings_v85",{p_target_ids:visibleIds}),
    db.rpc("get_uin_card_social_v87",{p_target_ids:visibleIds}),
    db.rpc("get_uin_card_parent_edges_v143",{p_target_ids:visibleIds}),
  ]);
  if([ratingResult,socialResult,hierarchyResult].some(result=>result.error)){
    console.error("category card enrichment unavailable",{kind,rating:ratingResult.error,social:socialResult.error,hierarchy:hierarchyResult.error});
    return NextResponse.json({error:"Kategori kartı ayrıntıları yüklenemedi."},{status:503});
  }
  const itemByTarget=new Map<string,Row>();
  items.forEach(item=>{const id=String(item.canonical_target_id||"");if(id&&!itemByTarget.has(id))itemByTarget.set(id,item)});
  const ratings=new Map(((ratingResult.data||[]) as Row[]).map(row=>[String(row.target_id||""),row]));
  const social=new Map(((socialResult.data||[]) as Row[]).map(row=>[String(row.target_id||""),row]));
  const covers=new Map(visibilityRows.map(row=>[String(row.target_id||""),Number(row.cover_position_y||50)]));
  const hierarchy=new Map(((hierarchyResult.data||[]) as Row[]).map(row=>[String(row.target_id||""),row]));
  const catalogue=visibleIds.map(id=>cardByTarget.get(id)!).map(card=>{
    const id=String(card.canonical_target_id||""),item=itemByTarget.get(id),rating=ratings.get(id),stats=social.get(id),tree=hierarchy.get(id);
    const metadata=item?.metadata;const imdb=readImdbMetadata(metadata);const book=readBookListMetadata(metadata);const series=readSeriesListMetadata(metadata);
    const placementType=String((item?.metadata as Row|undefined)?.content_type_id||type.id);
    const rawParentId=String(tree?.parent_target_id||"");
    const parentItem=rawParentId?itemByTarget.get(rawParentId):undefined;
    const parentPlacementType=parentItem?String((parentItem.metadata as Row|undefined)?.content_type_id||type.id):"";
    const parentTargetId=parentItem&&parentPlacementType===placementType?rawParentId:null;
    return {...card,catalog_item_id:item?.id||null,item_kind:item?.item_kind||card.item_kind||type.base_kind,content_type_id:placementType,subtitle:card.subtitle||item?.creator_name||null,catalog_cover_url:card.catalog_cover_url||card.cover_url||item?.cover_url||null,cover_position_y:covers.get(id)??50,intent_people_count:Number(card.intent_people_count),experience_people_count:Number(card.experience_people_count),active_event_count:Number(card.active_event_count??card.social_intent_count),completed_event_count:Number(card.completed_event_count),expired_event_count:Number(card.expired_event_count),cancelled_event_count:Number(card.cancelled_event_count),average_rating:rating?.average_rating==null?null:Number(rating.average_rating),rating_count:Number(rating?.rating_count||0),follower_count:Number(stats?.follower_count||0),related_count:Number(stats?.related_count||0),parent_target_id:parentTargetId,hierarchy_sort_order:Number(tree?.sort_order||0),hierarchy_section_title:tree?.section_title||null,hierarchy_depth:parentTargetId?Number(tree?.depth||0):0,child_count:Number(card.child_count),imdb_rank:imdb.imdbRank,imdb_rating:imdb.imdbRating,book_lists:book.bookLists,book_list_ranks:book.bookListRanks,book_awards:book.bookAwards,series_lists:series.seriesLists,series_list_ranks:series.seriesListRanks,series_awards:series.seriesAwards};
  });
  return NextResponse.json({catalogue},{headers:{"Cache-Control":"private, no-store"}});
}
