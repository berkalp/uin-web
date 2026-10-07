import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@/utils/supabase/server";
import {placeCoverUrls,type PlaceCoverNode} from "@/utils/placeCovers";

export async function GET(request:NextRequest){
  try{
    const db=await createClient();
    const params=request.nextUrl.searchParams;
    const country=params.get("country")||"TR";
    const city=params.get("city")||null;
    const district=params.get("district")||null;
    const query=params.get("q")||null;
    const includeCountries=params.get("include_countries")==="1";
    const includeCards=params.get("include_cards")!=="0";
    const [countriesResult,levelResult]=await Promise.all([
      includeCountries?db.rpc("get_uin_place_countries_v123"):Promise.resolve({data:[],error:null}),
      db.rpc("get_uin_place_level_v123",{p_country_code:country,p_city_target_id:city,p_district_target_id:district,p_query:query,p_limit:500,p_offset:0}),
    ]);
    if(countriesResult.error)throw countriesResult.error;
    if(levelResult.error)throw levelResult.error;
    const nodes=Array.isArray(levelResult.data)?levelResult.data:[];
    const nodeById=new Map(nodes.map((node:{target_id?:string;parent_target_id?:string|null})=>[String(node.target_id||""),node]));
    const targetIds=nodes.map((node:{target_id?:string})=>node.target_id).filter(Boolean) as string[];
    const coordinateTargetIds=Array.from(new Set([...targetIds,...nodes.map((node:{parent_target_id?:string|null})=>node.parent_target_id).filter(Boolean)])) as string[];
    const [cardsResult,placementResult]=await Promise.all([
      includeCards&&targetIds.length?db.rpc("get_uin_catalogue_for_targets_v123",{p_target_ids:targetIds}):Promise.resolve({data:[],error:null}),
      includeCards&&coordinateTargetIds.length?db.from("seed_catalog_items").select("canonical_target_id,metadata").in("canonical_target_id",coordinateTargetIds):Promise.resolve({data:[],error:null}),
    ]);
    if(cardsResult.error)throw cardsResult.error;
    const coordinates=new Map<string,{latitude:number;longitude:number}>();
    if(!placementResult.error)for(const value of placementResult.data||[]){
      const row=value as {canonical_target_id?:string;metadata?:Record<string,unknown>|null};
      const latitude=Number(row.metadata?.latitude??row.metadata?.lat);
      const longitude=Number(row.metadata?.longitude??row.metadata?.lng??row.metadata?.lon);
      if(row.canonical_target_id&&Number.isFinite(latitude)&&Number.isFinite(longitude))coordinates.set(row.canonical_target_id,{latitude,longitude});
    }
    function resolvedCoordinates(id:string,seen=new Set<string>()):{latitude:number;longitude:number}|undefined{
      if(!id||seen.has(id))return undefined;
      const own=coordinates.get(id);if(own)return own;
      seen.add(id);const parent=String(nodeById.get(id)?.parent_target_id||"");
      return parent?resolvedCoordinates(parent,seen):undefined;
    }
    const coverUrls=await placeCoverUrls(nodes as PlaceCoverNode[]);
    const cards=(cardsResult.data||[]).map((value:unknown)=>{const row=value as Record<string,unknown>,id=String(row.canonical_target_id||""),node=nodeById.get(id);return {...row,parent_target_id:row.parent_target_id||node?.parent_target_id||null,catalog_cover_url:row.catalog_cover_url||row.cover_url||coverUrls.get(id)||null,...resolvedCoordinates(id)}});
    return NextResponse.json({countries:countriesResult.data||[],nodes,cards},{headers:{"Cache-Control":"private, max-age=30, stale-while-revalidate=300"}});
  }catch(error){
    const message=error&&typeof error==="object"&&"message" in error?String(error.message):"Yer hiyerarşisi yüklenemedi.";
    return NextResponse.json({error:message},{status:502});
  }
}
