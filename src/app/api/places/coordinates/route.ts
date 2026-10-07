import {createClient as createSupabaseClient} from "@supabase/supabase-js";
import {NextRequest,NextResponse} from "next/server";

import {geocodeLocation,normalizeGeocodeQuery} from "@/utils/maps/geocode";
import {createClient} from "@/utils/supabase/server";

async function requestClient(request:NextRequest){
  const token=(request.headers.get("authorization")||"").match(/^Bearer\s+(.+)$/i)?.[1];
  return token?createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,{global:{headers:{Authorization:`Bearer ${token}`}},auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}}):createClient();
}

export async function POST(request:NextRequest){
  try{
    const body=await request.json() as Record<string,unknown>;
    const targetId=typeof body.targetId==="string"?body.targetId:"";
    const query=normalizeGeocodeQuery(typeof body.query==="string"?body.query:"");
    if(!/^[0-9a-f-]{36}$/i.test(targetId))return NextResponse.json({error:"Yer kartı bulunamadı."},{status:400});
    if(query.length<2)return NextResponse.json({error:"Haritada aranacak yer adını yaz."},{status:400});
    const db=await requestClient(request);
    const {data:role,error:roleError}=await db.rpc("get_admin_role");
    if(roleError||!role)return NextResponse.json({error:"Bu işlem için admin yetkisi gerekir."},{status:403});
    const location=await geocodeLocation(query,{countryCode:"TR",language:"tr,en;q=0.8"});
    if(!location)return NextResponse.json({error:"Bu adla bir konum bulunamadı. İlçe, il ve ülkeyi de yazarak tekrar dene."},{status:404});
    const saved=await db.rpc("admin_save_place_coordinates_v128",{p_target_id:targetId,p_latitude:location.latitude,p_longitude:location.longitude});
    if(saved.error)return NextResponse.json({error:saved.error.message},{status:500});
    return NextResponse.json({latitude:location.latitude,longitude:location.longitude,displayName:location.displayName});
  }catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Konum kaydedilemedi."},{status:500});}
}
