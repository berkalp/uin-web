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
    const [countriesResult,levelResult]=await Promise.all([
      db.rpc("get_uin_place_countries_v123"),
      db.rpc("get_uin_place_level_v123",{p_country_code:country,p_city_target_id:city,p_district_target_id:district,p_query:query,p_limit:500,p_offset:0}),
    ]);
    if(countriesResult.error)throw countriesResult.error;
    if(levelResult.error)throw levelResult.error;
    const nodes=Array.isArray(levelResult.data)?levelResult.data:[];
    const targetIds=nodes.map((node:{target_id?:string})=>node.target_id).filter(Boolean);
    const cardsResult=targetIds.length?await db.rpc("get_uin_catalogue_for_targets_v123",{p_target_ids:targetIds}):{data:[],error:null};
    if(cardsResult.error)throw cardsResult.error;
    return NextResponse.json({countries:countriesResult.data||[],nodes,cards:cardsResult.data||[]});
  }catch(error){
    return NextResponse.json({error:error instanceof Error?error.message:"Yer hiyerarşisi yüklenemedi."},{status:502});
  }
}
