import {NextResponse} from 'next/server';
import {createClient} from '@/utils/supabase/server';
type SeedType={id:string;name:string;slug:string;icon:string};
export async function GET(){const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)return NextResponse.json({error:'Kart eklemek için giriş yap.'},{status:401});
  const [seedTypeResult,adminResult,typeResult]=await Promise.all([
    supabase.rpc("get_active_seed_types"),
    supabase.rpc("get_admin_role"),
    supabase.from("uin_content_types").select("*").order("position").order("label"),
  ]);
  const seedTypes=(seedTypeResult.data??[]) as SeedType[];
  if(typeResult.error||seedTypeResult.error){
    console.error('card picker configuration unavailable',{types:typeResult.error,seedTypes:seedTypeResult.error});
    return NextResponse.json({error:'Kart ekleme seçenekleri yüklenemedi. Tekrar deneyebilirsin.'},{status:503});
  }
  return NextResponse.json({contentTypes:typeResult.data||[],seedTypes,catalogue:[],isAdmin:Boolean(adminResult.data)},{headers:{'Cache-Control':'private, no-store'}});
}
