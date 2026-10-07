import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@/utils/supabase/server";

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
    const targetIds=nodes.map((node:{target_id?:string})=>node.target_id).filter(Boolean);
    const cardsResult=includeCards&&targetIds.length?await db.rpc("get_uin_catalogue_for_targets_v123",{p_target_ids:targetIds}):{data:[],error:null};
    if(cardsResult.error)throw cardsResult.error;
    return NextResponse.json({countries:countriesResult.data||[],nodes,cards:cardsResult.data||[]},{headers:{"Cache-Control":"private, max-age=30, stale-while-revalidate=300"}});
  }catch(error){
    const message=error&&typeof error==="object"&&"message" in error?String(error.message):"Yer hiyerarşisi yüklenemedi.";
    return NextResponse.json({error:message},{status:502});
  }
}
