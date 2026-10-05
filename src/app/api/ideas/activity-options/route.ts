import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@/utils/supabase/server";

const uuid=/^[0-9a-f-]{36}$/i;

export async function GET(request:NextRequest){
 const targetId=request.nextUrl.searchParams.get("targetId")||"";
 if(!uuid.test(targetId))return NextResponse.json({error:"Kart bulunamadı."},{status:400});
 const supabase=await createClient();
 const [{data:catalogue,error:catalogueError},{data:selected,error:selectedError}]=await Promise.all([
  supabase.from("activities").select("id,name,is_active,activity_categories(name)").eq("is_active",true).order("name"),
  supabase.rpc("get_uin_card_activity_options_v106",{p_target_id:targetId}),
 ]);
 if(catalogueError||selectedError)return NextResponse.json({error:"Etkinlik bağlantıları yüklenemedi."},{status:500});
 const activities=(catalogue||[]).map(row=>({id:row.id,name:row.name,category_name:(row.activity_categories as unknown as {name?:string|null}|null)?.name||null}));
 return NextResponse.json({activities,selectedIds:(selected||[]).map((row:{id:string})=>row.id)});
}

export async function POST(request:NextRequest){
 const body=await request.json() as {targetId?:string;activityIds?:unknown};
 if(!body.targetId||!uuid.test(body.targetId)||!Array.isArray(body.activityIds)||body.activityIds.some(id=>typeof id!=="string"||!uuid.test(id)))return NextResponse.json({error:"Etkinlik bağlantıları geçersiz."},{status:400});
 const supabase=await createClient();
 const {data:role}=await supabase.rpc("get_admin_role");
 if(!role)return NextResponse.json({error:"Bu işlem için admin yetkisi gerekir."},{status:403});
 const {error}=await supabase.rpc("admin_replace_uin_card_activity_options_v106",{p_target_id:body.targetId,p_activity_ids:body.activityIds});
 if(error)return NextResponse.json({error:error.message},{status:500});
 return NextResponse.json({updated:true});
}
