import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@/utils/supabase/server';
export async function GET(request:NextRequest){
 const p=request.nextUrl.searchParams,id=p.get('target');
 if(!id||!/^\w{8}-\w{4}-\w{4}-\w{4}-\w{12}$/.test(id))return NextResponse.json({error:'Yer kimliği gerekli.'},{status:400});
 const db=await createClient(),r=await db.rpc('get_uin_place_children_v172',{p_target_id:id,p_limit:20,p_offset:Math.max(0,Number(p.get('offset'))||0)});
 if(r.error||!r.data||!Array.isArray(r.data.nodes)||!Number.isSafeInteger(r.data.total))return NextResponse.json({error:'Bağlı yerler yüklenemedi. Tekrar dene.'},{status:502});
 return NextResponse.json(r.data,{headers:{'Cache-Control':'private, max-age=30'}});
}
