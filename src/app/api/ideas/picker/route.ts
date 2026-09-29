import {NextResponse} from 'next/server';
import {createClient} from '@/utils/supabase/server';
import type {DiscoverPersonalIntent} from '@/components/discover/DiscoverPersonalIntentCard';
type SeedType={id:string;name:string;slug:string;icon:string};
type CataloguePlacement={id:string;canonical_target_id:string|null;item_kind:string};
export async function GET(){const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)return NextResponse.json({error:'Kart eklemek için giriş yap.'},{status:401});
  const [topicResult,seedTypeResult,adminResult]=await Promise.all([
    supabase.rpc("get_uin_catalogue_v64",{p_query:null,p_limit:200,p_offset:0,p_target_id:null}),
    supabase.rpc("get_active_seed_types"),
    supabase.rpc("get_admin_role"),
  ]);
  const topics=[...((topicResult.data??[]) as DiscoverPersonalIntent[])];
  let topicError=topicResult.error;
  for(let offset=topics.length;!topicError&&offset>0&&offset%200===0;offset+=200){
    const page=await supabase.rpc("get_uin_catalogue_v64",{p_query:null,p_limit:200,p_offset:offset,p_target_id:null});
    topicError=page.error;
    if(topicError)break;
    const rows=(page.data??[]) as DiscoverPersonalIntent[];
    topics.push(...rows);
    if(rows.length<200)break;
  }
  const seedTypes=(seedTypeResult.data??[]) as SeedType[];
  const targetIds=topics.map(item=>item.canonical_target_id);
  const placementPages=await Promise.all(Array.from({length:Math.ceil(targetIds.length/200)},(_,page)=>supabase.from("seed_catalog_items").select("id,canonical_target_id,item_kind").in("canonical_target_id",targetIds.slice(page*200,(page+1)*200))));
  const placementError=placementPages.find(page=>page.error)?.error;
  const placements=new Map(placementPages.flatMap(page=>(page.data??[]) as CataloguePlacement[]).map(item=>[item.canonical_target_id,item]));
  const ownSeedIds=[...new Set(topics.map(item=>item.own_seed_id).filter((id):id is string=>Boolean(id)))];
  const ownSeedPages=await Promise.all(Array.from({length:Math.ceil(ownSeedIds.length/200)},(_,page)=>supabase.from("seeds").select("id,status").in("id",ownSeedIds.slice(page*200,(page+1)*200))));
  const ownSeedStatus=new Map(ownSeedPages.flatMap(page=>page.data??[]).map(seed=>[seed.id,seed.status]));
  const [summaryResult,ratingResult,typeResult,coverResult,hierarchyResult]=await Promise.all([supabase.rpc("get_uin_card_summary_v81",{p_target_ids:targetIds}),supabase.rpc("get_uin_card_ratings_v85",{p_target_ids:targetIds}),supabase.from("uin_content_types").select("*").order("position").order("label"),supabase.rpc("get_uin_cover_positions_v62",{p_target_ids:targetIds}),supabase.rpc("get_uin_card_hierarchy_v81",{p_target_ids:targetIds})]);
  const summaries=new Map(((summaryResult.data||[]) as Array<Record<string,unknown>>).map(row=>[row.target_id,row]));
  const ratings=new Map(((ratingResult.data||[]) as Array<Record<string,unknown>>).map(row=>[row.target_id,row]));
  const covers=new Map(((coverResult.data||[]) as Array<{target_id:string;cover_position_y:number}>).map(row=>[row.target_id,row.cover_position_y]));
  const hierarchy=new Map(((hierarchyResult.data||[]) as Array<{target_id:string;parent_target_id:string|null;sort_order:number;section_title:string|null;depth:number}>).map(row=>[row.target_id,row]));
  const catalogue=topics.map(item=>({...item,average_rating:ratings.get(item.canonical_target_id)?.average_rating==null?null:Number(ratings.get(item.canonical_target_id)?.average_rating),rating_count:Number(ratings.get(item.canonical_target_id)?.rating_count||0),cover_position_y:Number(covers.get(item.canonical_target_id)??50),content_type_id:summaries.get(item.canonical_target_id)?.type_id as string|null,active_event_count:Number(summaries.get(item.canonical_target_id)?.active||0),completed_event_count:Number(summaries.get(item.canonical_target_id)?.completed||0),expired_event_count:Number(summaries.get(item.canonical_target_id)?.expired||0),cancelled_event_count:Number(summaries.get(item.canonical_target_id)?.cancelled||0),intent_people_count:Number(summaries.get(item.canonical_target_id)?.wanting||0),experience_people_count:Number(summaries.get(item.canonical_target_id)?.done||0),subtitle:(summaries.get(item.canonical_target_id)?.creator_name as string)||item.subtitle,catalog_cover_url:(summaries.get(item.canonical_target_id)?.editorial_cover_url as string)||item.catalog_cover_url,catalog_item_id:placements.get(item.canonical_target_id)?.id||null,item_kind:placements.get(item.canonical_target_id)?.item_kind||item.item_kind||null,own_seed_status:item.own_seed_id?ownSeedStatus.get(item.own_seed_id)||null:null,parent_target_id:hierarchy.get(item.canonical_target_id)?.parent_target_id||null,hierarchy_sort_order:Number(hierarchy.get(item.canonical_target_id)?.sort_order||0),hierarchy_section_title:hierarchy.get(item.canonical_target_id)?.section_title||null,hierarchy_depth:Number(hierarchy.get(item.canonical_target_id)?.depth||0),child_count:Number(summaries.get(item.canonical_target_id)?.child_count||0)}));

if(topicError||summaryResult.error||ratingResult.error||hierarchyResult.error||typeResult.error||seedTypeResult.error||placementError||ownSeedPages.some(page=>page.error))return NextResponse.json({error:'Kartlar yüklenemedi. Tekrar deneyebilirsin.'},{status:500});
return NextResponse.json({contentTypes:typeResult.data||[],seedTypes,catalogue,isAdmin:Boolean(adminResult.data)},{headers:{'Cache-Control':'private, no-store'}});
}
