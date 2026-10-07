import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@/utils/supabase/server";
import {placeCoverUrls,type PlaceCoverNode} from "@/utils/placeCovers";
import {COUNTRY_POPULATIONS} from "@/data/countryPopulations";
import cityPopulationCatalogue from "@/data/cityPopulationCatalogue.json";

const CITY_POPULATIONS=cityPopulationCatalogue.bySource as Record<string,number>;
const CITIES_BY_COUNTRY=cityPopulationCatalogue.citiesByCountry as Record<string,string[]>;
const TURKEY_CITY_POPULATIONS=cityPopulationCatalogue.turkeyByTitle as Record<string,number>;
const cityNameKey=(value:string)=>value.normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/ı/g,"i").toLocaleLowerCase("tr-TR");
const TURKEY_CITY_POPULATIONS_NORMALIZED=Object.fromEntries(Object.entries(TURKEY_CITY_POPULATIONS).map(([title,population])=>[cityNameKey(title),population]));

export async function GET(request:NextRequest){
  try{
    const db=await createClient();
    const params=request.nextUrl.searchParams;
    const country=params.get("country")||"TR";
    const city=params.get("city")||null;
    const district=params.get("district")||null;
    const query=params.get("q")||null;
    const limit=Math.max(1,Math.min(Number(params.get("limit")||500)||500,500));
    const citySort=params.get("city_sort")==="population_asc"?"population_asc":"population_desc";
    const includeCountries=params.get("include_countries")==="1";
    const includeCards=params.get("include_cards")!=="0"&&Boolean(city||district||country==="TR");
    const usePopulationCatalogue=country!=="TR"&&!city&&!district&&!query;
    const [countriesResult,levelResult]=await Promise.all([
      includeCountries?db.rpc("get_uin_place_countries_v123"):Promise.resolve({data:[],error:null}),
      usePopulationCatalogue?Promise.resolve({data:[],error:null}):db.rpc("get_uin_place_level_v123",{p_country_code:country,p_city_target_id:city,p_district_target_id:district,p_query:query,p_limit:limit,p_offset:0}),
    ]);
    if(countriesResult.error)throw countriesResult.error;
    if(levelResult.error)throw levelResult.error;
    const countries=(countriesResult.data||[]).map((value:unknown)=>{const row=value as Record<string,unknown>;return {...row,population:COUNTRY_POPULATIONS[String(row.country_code||"").toUpperCase()]||0}}).sort((a:Record<string,unknown>,b:Record<string,unknown>)=>Number(b.population||0)-Number(a.population||0)||String(a.country_name||"").localeCompare(String(b.country_name||""),"tr-TR"));
    let nodes=Array.isArray(levelResult.data)?levelResult.data:[];
    if(usePopulationCatalogue){
      const ordered=CITIES_BY_COUNTRY[country]||[];
      const sourceKeys=(citySort==="population_asc"?[...ordered].reverse():ordered).slice(0,limit);
      const popularResult=sourceKeys.length?await db.from("seed_catalog_items").select("canonical_target_id,canonical_title,external_id").eq("status","active").eq("item_kind","place").in("external_id",sourceKeys):{data:[],error:null};
      if(popularResult.error)throw popularResult.error;
      const bySource=new Map((popularResult.data||[]).map(row=>[String(row.external_id||""),row]));
      const parentTargetId=String((countriesResult.data||[]).find((value:Record<string,unknown>)=>String(value.country_code||"")===country)?.target_id||"")||null;
      nodes=sourceKeys.map(sourceKey=>{const row=bySource.get(sourceKey);return row?{target_id:row.canonical_target_id,title:row.canonical_title,scope:"city",parent_target_id:parentTargetId,source_key:sourceKey,child_count:0,population:CITY_POPULATIONS[sourceKey]||0}:null}).filter(Boolean);
    }else if(!city&&!district){
      nodes=nodes.map((value:Record<string,unknown>)=>({...value,population:country==="TR"?(TURKEY_CITY_POPULATIONS_NORMALIZED[cityNameKey(String(value.title||""))]||0):(CITY_POPULATIONS[String(value.source_key||"")]||0)})).sort((a:Record<string,unknown>,b:Record<string,unknown>)=>citySort==="population_asc"?Number(a.population||0)-Number(b.population||0):Number(b.population||0)-Number(a.population||0));
    }
    const nodeById=new Map(nodes.map((node:{target_id?:string;parent_target_id?:string|null})=>[String(node.target_id||""),node]));
    const targetIds=nodes.map((node:{target_id?:string})=>node.target_id).filter(Boolean) as string[];
    const coordinateTargetIds=Array.from(new Set([...targetIds,...nodes.map((node:{parent_target_id?:string|null})=>node.parent_target_id).filter(Boolean)])) as string[];
    const [cardsResult,placementResult,socialResult,summaryResult]=await Promise.all([
      includeCards&&targetIds.length?db.rpc("get_uin_catalogue_for_targets_v123",{p_target_ids:targetIds}):Promise.resolve({data:[],error:null}),
      includeCards&&coordinateTargetIds.length?db.from("seed_catalog_items").select("canonical_target_id,metadata").in("canonical_target_id",coordinateTargetIds):Promise.resolve({data:[],error:null}),
      includeCards&&targetIds.length?db.rpc("get_uin_card_social_v87",{p_target_ids:targetIds}):Promise.resolve({data:[],error:null}),
      includeCards&&targetIds.length?(async()=>{const data:Record<string,unknown>[]=[];for(let offset=0;offset<targetIds.length;offset+=10){const page=await db.rpc("get_uin_card_summary_v129",{p_target_ids:targetIds.slice(offset,offset+10)});if(page.error)return{data,error:page.error};data.push(...((page.data||[]) as Record<string,unknown>[]))}return{data,error:null}})():Promise.resolve({data:[],error:null}),
    ]);
    let cardRows=(cardsResult.data||[]) as Record<string,unknown>[];
    if(cardsResult.error&&includeCards){
      cardRows=[];
      for(let offset=0;offset<targetIds.length;offset+=15){
        const batch=await db.rpc("get_uin_catalogue_for_targets_v123",{p_target_ids:targetIds.slice(offset,offset+15)});
        if(!batch.error)cardRows.push(...((batch.data||[]) as Record<string,unknown>[]));
      }
    }
    let socialRows=(socialResult.data||[]) as Record<string,unknown>[];
    if(socialResult.error&&includeCards){
      socialRows=[];
      for(let offset=0;offset<targetIds.length;offset+=20){
        const batch=await db.rpc("get_uin_card_social_v87",{p_target_ids:targetIds.slice(offset,offset+20)});
        if(!batch.error)socialRows.push(...((batch.data||[]) as Record<string,unknown>[]));
      }
    }
    const coordinates=new Map<string,{latitude:number;longitude:number}>();
    if(!placementResult.error)for(const value of placementResult.data||[]){
      const row=value as {canonical_target_id?:string;metadata?:Record<string,unknown>|null};
      const latitude=Number(row.metadata?.latitude??row.metadata?.lat);
      const longitude=Number(row.metadata?.longitude??row.metadata?.lng??row.metadata?.lon);
      if(row.canonical_target_id&&Number.isFinite(latitude)&&Number.isFinite(longitude))coordinates.set(row.canonical_target_id,{latitude,longitude});
    }
    const social=new Map<string,Record<string,unknown>>(socialRows.map(row=>[String(row.target_id||""),row]));
    const summaries=new Map<string,Record<string,unknown>>(((summaryResult.data||[]) as Record<string,unknown>[]).map(row=>[String(row.target_id||""),row]));
    function resolvedCoordinates(id:string,seen=new Set<string>()):{latitude:number;longitude:number}|undefined{
      if(!id||seen.has(id))return undefined;
      const own=coordinates.get(id);if(own)return own;
      seen.add(id);const parent=String(nodeById.get(id)?.parent_target_id||"");
      return parent?resolvedCoordinates(parent,seen):undefined;
    }
    const coverUrls=await placeCoverUrls(nodes as PlaceCoverNode[]);
    if(includeCards&&cardRows.length<targetIds.length){
      const existingIds=new Set(cardRows.map(row=>String(row.canonical_target_id||"")));
      for(const value of nodes as Record<string,unknown>[]){
        const id=String(value.target_id||"");
        if(!id||existingIds.has(id))continue;
        cardRows.push({canonical_target_id:id,catalog_item_id:null,title:String(value.title||"Yer"),subtitle:value.scope==="district"?"ilçesi":String(value.scope||"Yer"),catalog_cover_url:null,cover_url:null,item_kind:"place",seed_type_slug:"place",seed_type_name:"Yer",canonical_kind:"place",intent_people_count:0,experience_people_count:0,active_event_count:0,completed_event_count:0,expired_event_count:0,cancelled_event_count:0,parent_target_id:value.parent_target_id||null,child_count:Number(value.child_count||0)});
      }
    }
    const cards=cardRows.map(row=>{const id=String(row.canonical_target_id||""),node=nodeById.get(id),stats=social.get(id),summary=summaries.get(id);return {...row,parent_target_id:row.parent_target_id||node?.parent_target_id||null,catalog_cover_url:row.catalog_cover_url||row.cover_url||coverUrls.get(id)||null,intent_people_count:Number(summary?.wanting??row.intent_people_count??0),experience_people_count:Number(summary?.done??row.experience_people_count??0),active_event_count:Number(summary?.active??row.active_event_count??row.social_intent_count??0),completed_event_count:Number(summary?.completed??row.completed_event_count??0),expired_event_count:Number(summary?.expired??row.expired_event_count??0),cancelled_event_count:Number(summary?.cancelled??row.cancelled_event_count??0),average_rating:stats?.average_rating==null?null:Number(stats.average_rating),rating_count:Number(stats?.rating_count||0),follower_count:Number(stats?.follower_count||0),related_count:Number(stats?.related_count||0),...resolvedCoordinates(id)}});
    return NextResponse.json({countries,nodes,cards},{headers:{"Cache-Control":"private, max-age=30, stale-while-revalidate=300"}});
  }catch(error){
    const message=error&&typeof error==="object"&&"message" in error?String(error.message):"Yer hiyerarşisi yüklenemedi.";
    return NextResponse.json({error:message},{status:502});
  }
}
