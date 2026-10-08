import {NextResponse} from "next/server";
import {createClient} from "@/utils/supabase/server";

export async function GET(){
  const db=await createClient();
  let canonical=await db.rpc("get_uin_category_counts_v129");
  if(canonical.error||!canonical.data||typeof canonical.data!=="object"||Object.keys(canonical.data).length===0){
    canonical=await db.rpc("get_uin_category_counts_v129");
  }
  if(canonical.error||!canonical.data||typeof canonical.data!=="object"||Object.keys(canonical.data).length===0){
    console.error("category counts unavailable",canonical.error);
    return NextResponse.json({error:"Kategori adetleri şu anda yüklenemedi. Lütfen tekrar dene."},{status:503});
  }
  return NextResponse.json({categoryCounts:canonical.data},{headers:{"Cache-Control":"private, no-store"}});
}
