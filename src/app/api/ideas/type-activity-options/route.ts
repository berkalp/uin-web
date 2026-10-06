import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@/utils/supabase/server";

const contentTypeId=/^[a-z0-9_:-]{1,120}$/i;

export async function GET(request:NextRequest){
 const typeId=request.nextUrl.searchParams.get("contentTypeId")||"";
 if(!contentTypeId.test(typeId))return NextResponse.json({error:"İçerik türü bulunamadı."},{status:400});
 const supabase=await createClient();
 const [{data:catalogue,error:catalogueError},{data:categories,error:categoriesError},{data:selected,error:selectedError},{data:selectedCategories,error:selectedCategoriesError}]=await Promise.all([
  supabase.from("activities").select("id,name,is_active,category_id,activity_categories(id,name)").eq("is_active",true).order("name"),
  supabase.from("activity_categories").select("id,name,is_active").eq("is_active",true).order("name"),
  supabase.rpc("get_uin_content_type_activity_selections_v115",{p_content_type_id:typeId}),
  supabase.rpc("get_uin_content_type_activity_categories_v115",{p_content_type_id:typeId}),
 ]);
 if(catalogueError||categoriesError||selectedError||selectedCategoriesError)return NextResponse.json({error:"Kategori etkinlik izinleri yüklenemedi."},{status:500});
 const activities=(catalogue||[]).map(row=>({id:row.id,name:row.name,category_id:row.category_id,category_name:(row.activity_categories as unknown as {name?:string|null}|null)?.name||null}));
 const categoryRows=(categories||[]).map(category=>({id:category.id,name:category.name,activity_count:activities.filter(activity=>activity.category_id===category.id).length}));
 return NextResponse.json({activities,categories:categoryRows,selectedIds:(selected||[]).map((row:{id:string})=>row.id),selectedCategoryIds:(selectedCategories||[]).map((row:{id:string})=>row.id)});
}

export async function POST(request:NextRequest){
 const body=await request.json() as {contentTypeId?:string;activityIds?:unknown;categoryIds?:unknown};
 if(!body.contentTypeId||!contentTypeId.test(body.contentTypeId)||!Array.isArray(body.activityIds)||body.activityIds.some(id=>typeof id!=="string")||!Array.isArray(body.categoryIds)||body.categoryIds.some(id=>typeof id!=="string"))return NextResponse.json({error:"Kategori etkinlik izinleri geçersiz."},{status:400});
 const supabase=await createClient();
 const {data:role}=await supabase.rpc("get_admin_role");
 if(!role)return NextResponse.json({error:"Bu işlem için admin yetkisi gerekir."},{status:403});
 const {error}=await supabase.rpc("admin_replace_uin_content_type_activity_permissions_v115",{p_content_type_id:body.contentTypeId,p_activity_ids:body.activityIds,p_category_ids:body.categoryIds});
 if(error)return NextResponse.json({error:error.message},{status:500});
 return NextResponse.json({updated:true});
}
