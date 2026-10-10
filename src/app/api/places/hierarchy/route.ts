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
const TARGET_BATCH_THRESHOLD=15;
const TARGET_BATCH_CONCURRENCY=2;
const finiteCount=(value:unknown)=>{
  if((typeof value!=="number"&&typeof value!=="string")||value==="")return false;
  const parsed=Number(value);
  return Number.isSafeInteger(parsed)&&parsed>=0;
};

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
    if(includeCountries&&!Array.isArray(countriesResult.data))throw new Error("Ülke listesi eksik döndü.");
    if(!usePopulationCatalogue&&!Array.isArray(levelResult.data))throw new Error("Yer hiyerarşisi eksik döndü.");
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
    const coverPromise=includeCards?placeCoverUrls(nodes as PlaceCoverNode[]):Promise.resolve(new Map<string,string>());
    const batchTargets=includeCards&&targetIds.length>TARGET_BATCH_THRESHOLD;
    const [cardsResult,placementResult,socialResult]=await Promise.all([
      includeCards&&targetIds.length&&!batchTargets?db.rpc("get_uin_catalogue_for_targets_v123",{p_target_ids:targetIds}):Promise.resolve({data:[],error:null}),
      includeCards&&coordinateTargetIds.length?db.from("seed_catalog_items").select("canonical_target_id,metadata").in("canonical_target_id",coordinateTargetIds):Promise.resolve({data:[],error:null}),
      includeCards&&targetIds.length?db.rpc("get_uin_card_social_v87",{p_target_ids:targetIds}):Promise.resolve({data:[],error:null}),
    ]);
    let cardRows=(cardsResult.data||[]) as Record<string,unknown>[];
    let socialRows=(socialResult.data||[]) as Record<string,unknown>[];
    const readCardBatches=batchTargets||Boolean(cardsResult.error);
    const readSocialBatches=Boolean(socialResult.error);
    if(includeCards&&targetIds.length&&(readCardBatches||readSocialBatches)){
      const cardTargets=readCardBatches?Array.from({length:Math.ceil(targetIds.length/15)},(_,index)=>targetIds.slice(index*15,index*15+15)):[];
      const socialTargets=readSocialBatches?Array.from({length:Math.ceil(targetIds.length/20)},(_,index)=>targetIds.slice(index*20,index*20+20)):[];
      const cardBatches=cardTargets.map(()=>[] as Record<string,unknown>[]);
      const socialBatches=socialTargets.map(()=>[] as Record<string,unknown>[]);
      const jobs=[
        ...cardTargets.map((ids,batchIndex)=>({kind:"card" as const,ids,batchIndex})),
        ...socialTargets.map((ids,batchIndex)=>({kind:"social" as const,ids,batchIndex})),
      ];
      let nextJob=0;
      const worker=async()=>{
        while(nextJob<jobs.length){
          const job=jobs[nextJob++];
          const batch=job.kind==="card"
            ?await db.rpc("get_uin_catalogue_for_targets_v123",{p_target_ids:job.ids})
            :await db.rpc("get_uin_card_social_v87",{p_target_ids:job.ids});
          if(batch.error)throw batch.error;
          if(!Array.isArray(batch.data))throw new Error(job.kind==="card"?"Yer kartları eksik döndü.":"Yer kartı sosyal verileri eksik döndü.");
          if(job.kind==="card")cardBatches[job.batchIndex]=batch.data as Record<string,unknown>[];
          else socialBatches[job.batchIndex]=batch.data as Record<string,unknown>[];
        }
      };
      await Promise.all(Array.from({length:Math.min(TARGET_BATCH_CONCURRENCY,jobs.length)},()=>worker()));
      if(readCardBatches)cardRows=cardBatches.flat();
      if(readSocialBatches)socialRows=socialBatches.flat();
    }
    if(includeCards&&placementResult.error)throw placementResult.error;
    if(includeCards&&(!Array.isArray(cardRows)||!Array.isArray(socialRows)||!Array.isArray(placementResult.data)))throw new Error("Yer kartı verileri eksik döndü.");
    if(includeCards){
      const cardIds=new Set(cardRows.map(row=>String(row.canonical_target_id||"")));
      const socialIds=new Set(socialRows.map(row=>String(row.target_id||"")));
      if(targetIds.some(id=>!cardIds.has(id))||targetIds.some(id=>!socialIds.has(id)))throw new Error("Bazı yer kartları eksik döndü.");
      const cardMetricKeys=["intent_people_count","experience_people_count","active_event_count","completed_event_count","expired_event_count","cancelled_event_count"];
      if(cardRows.some(row=>cardMetricKeys.some(key=>!finiteCount(row[key]))))throw new Error("Bazı yer kartı sayaçları eksik döndü.");
      const socialMetricKeys=["rating_count","follower_count","related_count"];
      if(socialRows.some(row=>socialMetricKeys.some(key=>!finiteCount(row[key]))||(row.average_rating!=null&&!Number.isFinite(Number(row.average_rating)))))throw new Error("Bazı yer kartı sosyal sayaçları eksik döndü.");
    }
    const coordinates=new Map<string,{latitude:number;longitude:number}>();
    for(const value of placementResult.data||[]){
      const row=value as {canonical_target_id?:string;metadata?:Record<string,unknown>|null};
      const latitude=Number(row.metadata?.latitude??row.metadata?.lat);
      const longitude=Number(row.metadata?.longitude??row.metadata?.lng??row.metadata?.lon);
      if(row.canonical_target_id&&Number.isFinite(latitude)&&Number.isFinite(longitude))coordinates.set(row.canonical_target_id,{latitude,longitude});
    }
    const social=new Map<string,Record<string,unknown>>(socialRows.map(row=>[String(row.target_id||""),row]));
    function resolvedCoordinates(id:string,seen=new Set<string>()):{latitude:number;longitude:number}|undefined{
      if(!id||seen.has(id))return undefined;
      const own=coordinates.get(id);if(own)return own;
      seen.add(id);const parent=String(nodeById.get(id)?.parent_target_id||"");
      return parent?resolvedCoordinates(parent,seen):undefined;
    }
    const coverUrls=await coverPromise;
    const cards=cardRows.map(row=>{const id=String(row.canonical_target_id||""),node=nodeById.get(id),stats=social.get(id);return {...row,parent_target_id:row.parent_target_id||node?.parent_target_id||null,catalog_cover_url:row.catalog_cover_url||row.cover_url||coverUrls.get(id)||null,intent_people_count:Number(row.intent_people_count),experience_people_count:Number(row.experience_people_count),active_event_count:Number(row.active_event_count??row.social_intent_count),completed_event_count:Number(row.completed_event_count),expired_event_count:Number(row.expired_event_count),cancelled_event_count:Number(row.cancelled_event_count),average_rating:stats?.average_rating==null?null:Number(stats.average_rating),rating_count:Number(stats?.rating_count),follower_count:Number(stats?.follower_count),related_count:Number(stats?.related_count),...resolvedCoordinates(id)}});
    return NextResponse.json({countries,nodes,cards},{headers:{"Cache-Control":"private, max-age=30, stale-while-revalidate=300"}});
  }catch(error){
    const message=error&&typeof error==="object"&&"message" in error?String(error.message):"Yer hiyerarşisi yüklenemedi.";
    return NextResponse.json({error:message},{status:502,headers:{"Cache-Control":"private, no-store"}});
  }
}
