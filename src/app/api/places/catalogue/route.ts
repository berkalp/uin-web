import {NextResponse} from 'next/server';
import {createClient} from '@/utils/supabase/server';
import {readPlaces} from '@/utils/placeGeography';
export async function GET(){try{return NextResponse.json({places:await readPlaces(await createClient())})}catch{return NextResponse.json({error:'Yerlerin şehir bağlantıları şu anda yüklenemedi. Tekrar deneyebilirsin.'},{status:502})}}
