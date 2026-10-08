import {NextRequest,NextResponse} from "next/server";
import {getCachedIdeaCategoryCounts} from "@/utils/ideaCategoryCounts";
import {createClient} from "@/utils/supabase/server";

function validCounts(value:unknown):value is Record<string,number>{return Boolean(value&&typeof value==="object"&&Object.keys(value).length>0)}

export async function GET(request:NextRequest){
  if(request.nextUrl.searchParams.get("admin")==="1"){
    const db=await createClient();
    const admin=await db.rpc("get_admin_role");
    if(admin.error)return NextResponse.json({error:"Yönetici rolü doğrulanamadı. Lütfen tekrar dene."},{status:503});
    if(!admin.data)return NextResponse.json({error:"Bu görünüm için yönetici yetkisi gerekli."},{status:403});
    let canonical=await db.rpc("get_uin_category_counts_v129");
    if(canonical.error||!validCounts(canonical.data))canonical=await db.rpc("get_uin_category_counts_v129");
    if(canonical.error||!validCounts(canonical.data)){
      console.error("admin category counts unavailable",canonical.error);
      return NextResponse.json({error:"Kategori adetleri şu anda yüklenemedi. Lütfen tekrar dene."},{status:503});
    }
    return NextResponse.json({categoryCounts:canonical.data},{headers:{"Cache-Control":"private, max-age=15, stale-while-revalidate=60"}});
  }
  try{
    const categoryCounts=await getCachedIdeaCategoryCounts();
    return NextResponse.json({categoryCounts},{headers:{"Cache-Control":"public, max-age=15, s-maxage=60, stale-while-revalidate=300"}});
  }catch(error){
    console.error("category counts unavailable",error);
    return NextResponse.json({error:"Kategori adetleri şu anda yüklenemedi. Lütfen tekrar dene."},{status:503});
  }
}
