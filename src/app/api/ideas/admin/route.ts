import {validCardStyle} from "@/utils/cardStyle";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import {createClient as createSupabaseClient} from "@supabase/supabase-js";
async function requestClient(request:NextRequest){const token=(request.headers.get("authorization")||"").match(/^Bearer\s+(.+)$/i)?.[1];return token?createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,{global:{headers:{Authorization:`Bearer ${token}`}},auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}}):createClient()}

export async function POST(request:NextRequest){
  try{
    const body=await request.json() as Record<string,unknown>;const action=body.action;const targetId=typeof body.canonicalTargetId==="string"?body.canonicalTargetId:"";const catalogItemId=typeof body.catalogItemId==="string"?body.catalogItemId:null;
    if(!targetId||!["update","delete"].includes(String(action)))return NextResponse.json({error:"Admin işlemi geçersiz."},{status:400});
    const supabase=await requestClient(request);const {data:role}=await supabase.rpc("get_admin_role");
    if(!role)return NextResponse.json({error:"Bu işlem için admin yetkisi gerekir."},{status:403});
    if(action==="delete"){
      const {error}=await supabase.rpc("admin_hide_uin_card_v53",{p_target_id:targetId});
      if(error)return NextResponse.json({error:error.message},{status:500});
      return NextResponse.json({deleted:true});
    }
    const title=typeof body.title==="string"?body.title.trim():"";const itemKind=typeof body.itemKind==="string"?body.itemKind:"";
    const field=(name:string)=>typeof body[name]==="string"?(body[name] as string).trim():"";
    for(const name of ["coverUrl","referenceUrl"]){const value=field(name);if(value){try{const url=new URL(value);if(!["https:","http:"].includes(url.protocol))throw new Error();}catch{return NextResponse.json({error:"Geçerli bir görsel veya kaynak bağlantısı gir."},{status:400});}}}
    const coverPosition=body.coverPositionY??50;
    if(typeof coverPosition!=="number"||!Number.isFinite(coverPosition)||coverPosition<0||coverPosition>100)return NextResponse.json({error:"Kapak konumu 0 ile 100 arasında olmalı."},{status:400});
    const profile=body.clubProfile;
    if(profile&&typeof profile==="object"){for(const key of ["logo_url","website"]){const value=(profile as Record<string,unknown>)[key];if(value){try{if(typeof value!=="string"||!["https:","http:"].includes(new URL(value).protocol))throw new Error();}catch{return NextResponse.json({error:"Logo ve resmi site için geçerli bağlantı gir."},{status:400});}}}}
    if(profile&&typeof profile==="object"){const document=profile as Record<string,unknown>;for(const key of ["teams","venues","fixtures","social_links"]){const rows=document[key];if(rows===undefined)continue;if(!Array.isArray(rows)||rows.length>50)return NextResponse.json({error:"Her bölümde en fazla 50 kayıt ekleyebilirsin."},{status:400});for(const row of rows){if(!row||typeof row!=="object")return NextResponse.json({error:"Profil kaydı geçersiz."},{status:400});for(const name of ["url","logo_url","photo_url","map_url"]){const value=(row as Record<string,unknown>)[name];if(value){try{if(typeof value!=="string"||!["https:","http:"].includes(new URL(value).protocol))throw new Error();}catch{return NextResponse.json({error:"Profildeki bağlantıları kontrol et."},{status:400});}}}}}}
    const cardHierarchy=body.cardHierarchy as {parentTargetId?:unknown;sortOrder?:unknown;sectionTitle?:unknown}|undefined;if(cardHierarchy&&(cardHierarchy.parentTargetId&&(!/^[0-9a-f-]{36}$/i.test(String(cardHierarchy.parentTargetId))||cardHierarchy.parentTargetId===targetId)||cardHierarchy.sortOrder!==undefined&&(!Number.isInteger(Number(cardHierarchy.sortOrder))||Number(cardHierarchy.sortOrder)<-10000||Number(cardHierarchy.sortOrder)>10000)||typeof(cardHierarchy.sectionTitle??"")!=="string"||String(cardHierarchy.sectionTitle??"").length>120))return NextResponse.json({error:"Üst kart bağlantısını, sırasını ve bölüm başlığını kontrol et."},{status:400});
    const placeHierarchy=body.placeHierarchy as {kind?:unknown;parentTargetId?:unknown}|undefined;if(placeHierarchy&&(typeof placeHierarchy.kind!=="string"||!["","Ülke","İl","Şehir","İlçe","Yer"].includes(placeHierarchy.kind)||placeHierarchy.parentTargetId&&(!/^[0-9a-f-]{36}$/i.test(String(placeHierarchy.parentTargetId))||placeHierarchy.parentTargetId===targetId)))return NextResponse.json({error:"Yer türünü ve bağlı kartı kontrol et."},{status:400});
    let clubHierarchy=body.clubHierarchy;const clubType=await supabase.from('uin_content_types').select('base_kind').eq('id',itemKind).maybeSingle();if(clubType.error)return NextResponse.json({error:'İçerik türü yüklenemedi.'},{status:500});const creatorAllowed=!/(festival|concert|konser)/i.test(itemKind)&&['artist','book','movie','series','game','director','actor','writer'].includes(clubType.data?.base_kind||'');if(clubType.data?.base_kind==='club'&&!clubHierarchy){const h=await supabase.rpc('get_club_hierarchy_v75');if(h.error)return NextResponse.json({error:'Takım bağlantısı yüklenemedi.'},{status:500});clubHierarchy=(h.data||[]).find((r:{target_id:string})=>r.target_id===targetId)||{};}
    const saveStyle=Object.prototype.hasOwnProperty.call(body,'cardStyle');if(saveStyle&&body.cardStyle!==null&&!validCardStyle(body.cardStyle))return NextResponse.json({error:'Kart renklerini kontrol et.'},{status:400});
    const {error}=await supabase.rpc(clubHierarchy&&saveStyle?"admin_save_coloured_club_v76":clubHierarchy?"admin_save_club_card_v75":placeHierarchy?"admin_save_place_card_v74":"admin_save_uin_card_v62",{...(clubHierarchy&&saveStyle?{p_card_style:body.cardStyle}:{}),...(clubHierarchy?{p_hierarchy:clubHierarchy}:{}),...(placeHierarchy?{p_place_kind:placeHierarchy.kind,p_parent_target_id:placeHierarchy.parentTargetId||null}:{}),p_target_id:targetId,p_title:title,p_type_id:itemKind,p_creator_name:creatorAllowed?field("creatorName"):"",p_cover_url:field("coverUrl"),p_description:field("description"),p_reference_url:field("referenceUrl"),p_profile:profile||{},p_cover_position_y:coverPosition});
    if(error)return NextResponse.json({error:error.message},{status:500});
    const typeSync=await supabase.rpc("admin_sync_uin_card_type_v87",{p_target_id:targetId,p_type_id:itemKind});
    if(typeSync.error)return NextResponse.json({error:typeSync.error.message},{status:500});
    if(cardHierarchy){const hierarchySave=await supabase.rpc("admin_save_card_hierarchy_v81",{p_target_id:targetId,p_parent_target_id:cardHierarchy.parentTargetId||null,p_sort_order:Number(cardHierarchy.sortOrder||0),p_section_title:String(cardHierarchy.sectionTitle||"")||null});if(hierarchySave.error)return NextResponse.json({error:hierarchySave.error.message},{status:500});}
    if(Object.prototype.hasOwnProperty.call(body,"cardRelations")){
      if(!Array.isArray(body.cardRelations))return NextResponse.json({error:"Bağlı kart listesi geçersiz."},{status:400});
      const relationSave=await supabase.rpc("admin_replace_uin_card_relations_v87",{p_target_id:targetId,p_relations:body.cardRelations});
      if(relationSave.error)return NextResponse.json({error:relationSave.error.message},{status:500});
    }
    return NextResponse.json({updated:true});
  }catch(cause){return NextResponse.json({error:cause instanceof Error?cause.message:"İşlem tamamlanamadı."},{status:500})}
}
