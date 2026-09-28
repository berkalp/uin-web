import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { parseSeedDetailData } from "@/utils/seeds";

function visibleSubtitle(typeId:string,baseKind:string|undefined){
  const normalized=typeId.toLocaleLowerCase("tr-TR");
  return !/(festival|concert|konser)/.test(normalized)&&["artist","book","movie","series","game","director","actor","writer"].includes(baseKind||"");
}

async function requestClient(request:NextRequest){
  const token=(request.headers.get("authorization")||"").match(/^Bearer\s+(.+)$/i)?.[1];
  if(!token)return createClient();
  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,{global:{headers:{Authorization:`Bearer ${token}`}},auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
}

export async function GET(request:NextRequest,{params}:{params:Promise<{targetId:string}>}){
  const {targetId}=await params;
  if(!/^[0-9a-f-]{36}$/i.test(targetId))return NextResponse.json({error:"Kart bulunamadı."},{status:404});
  const supabase=await requestClient(request);
  if(request.nextUrl.searchParams.get("summary")==="1"){
    const [profile,summary]=await Promise.all([supabase.rpc("get_uin_card_profile_v60",{p_target_id:targetId}),supabase.rpc("get_uin_card_summary_v80",{p_target_ids:[targetId]})]);
    const row=profile.data as {title?:string;creator_name?:string;cover_url?:string;catalog_item_id?:string;metadata?:Record<string,unknown>}|null;
    if(profile.error||summary.error||!row?.title)return NextResponse.json({error:"Kart yüklenemedi."},{status:404});
    const stats=(summary.data||[])[0];let typeId=String(stats?.type_id||row.metadata?.content_type_id||"");
    if(!typeId){const catalog=await supabase.from("seed_catalog_items").select("item_kind").eq("canonical_target_id",targetId).order("updated_at",{ascending:false}).limit(1);typeId=catalog.data?.[0]?.item_kind||"activity";if(typeId==="video")typeId="series";}
    const type=await supabase.from("uin_content_types").select("id,label,icon,base_kind,ui_labels").eq("id",typeId).maybeSingle();
    return NextResponse.json({contentType:type.data,communityCounts:[Number(stats?.wanting||0),Number(stats?.done||0),Number(stats?.active||0)],card:{title:row.title,subtitle:visibleSubtitle(typeId,type.data?.base_kind)?row.creator_name||null:null,cover_url:row.cover_url||null,catalog_item_id:row.catalog_item_id||null},people:[],reviews:[],events:[]});
  }
  const [cardResult,contextResult,peopleResult,eventResult,reviewResult,authResult]=await Promise.all([
    supabase.rpc("get_common_intent_cards_v38",{p_query:null,p_limit:1,p_offset:0,p_target_id:targetId}),
    supabase.rpc("get_uin_card_profile_v60",{p_target_id:targetId}),
    supabase.rpc("get_uin_card_people_v80",{p_target_id:targetId,p_group:"intent",p_limit:100,p_offset:0}),
    supabase.rpc("get_uin_card_events_v80",{p_target_id:targetId}),
    supabase.rpc("get_uin_card_people_v80",{p_target_id:targetId,p_group:"experience",p_limit:100,p_offset:0}),
    supabase.auth.getUser(),
  ]);
  const card=((cardResult.data||[]) as Array<Record<string,unknown>>)[0];
  if(!card)return NextResponse.json({error:"Kart bulunamadı."},{status:404});
  const context=(contextResult.data||{}) as Record<string,unknown>;
  const viewerId=authResult.data.user?.id||null;
  if(peopleResult.error||reviewResult.error||eventResult.error)return NextResponse.json({error:"Kartın listeleri yüklenemedi."},{status:500});
  async function allPeople(first:Array<Record<string,unknown>>,group:string){const rows=[...first];while(rows.length<Number(rows[0]?.total_count||0)){const page=await supabase.rpc("get_uin_card_people_v80",{p_target_id:targetId,p_group:group,p_limit:100,p_offset:rows.length});if(page.error)throw new Error(page.error.message);const next=page.data as Array<Record<string,unknown>>;if(!next.length)break;rows.push(...next)}return rows}
  const [wantRows,doneRows]=await Promise.all([allPeople((peopleResult.data||[]) as Array<Record<string,unknown>>,"intent"),allPeople((reviewResult.data||[]) as Array<Record<string,unknown>>,"experience")]);
  const clubResult=await supabase.rpc("get_uin_club_context_v60",{p_target_id:targetId});
  const clubContext=clubResult.data as {personal?:Array<{user_id:string;context:object}>;events?:Array<{intent_id:string;context:object}>}|null;
  const metadata={...((card.metadata||{}) as object),...((context.metadata||{}) as object)} as Record<string,unknown>;
  let typeId=typeof metadata.content_type_id==="string"?metadata.content_type_id:"";
  if(!typeId){const catalog=await supabase.from("seed_catalog_items").select("item_kind").eq("canonical_target_id",targetId).order("updated_at",{ascending:false}).limit(1);typeId=catalog.data?.[0]?.item_kind||"activity";if(typeId==="video")typeId="series";}
  const typeResult=await supabase.from("uin_content_types").select("id,label,icon,base_kind,ui_labels").eq("id",typeId).maybeSingle();
  const people:Array<Record<string,unknown>>=wantRows.map(row=>({...row,has_completed_experience:doneRows.some(done=>done.user_id===row.user_id),viewing_context:clubContext?.personal?.find(person=>person.user_id===row.user_id)?.context||metadata.legacy_viewing_context||null,is_current:true,id:row.source_id||row.user_id,start_date:row.start_date??row.target_date,end_date:row.end_date??row.target_date}));
  const events=(eventResult.data||[]) as Array<Record<string,unknown>>;
  const eventDetails=await Promise.all(events.map(event=>supabase.rpc("get_activity_detail_page",{p_resource_id:typeof event.plan_id==="string"?event.plan_id:event.intent_id as string})));
  const resourceIds=events.map(event=>String(event.plan_id||event.intent_id));
  const eventPeopleResult=resourceIds.length?await supabase.rpc("get_visible_activity_people_batch",{p_resource_ids:resourceIds}):{data:[],error:null};
  if(eventPeopleResult.error)return NextResponse.json({error:"Etkinlik katılımcıları yüklenemedi."},{status:500});
  const eventPeople=(eventPeopleResult.data||[]) as Array<Record<string,unknown>>;
  const enrichedEvents=events.map((event,index)=>{
    const page=eventDetails[index]?.data as {activity?:{title?:string|null;status?:string|null}}|null;
    const members=new Map<string,Record<string,unknown>>();
    for(const person of (event.participants||[]) as Array<Record<string,unknown>>)members.set(String(person.user_id),person);
    for(const person of eventPeople.filter(person=>person.resource_id===resourceIds[index]))members.set(String(person.user_id),{...person,role:person.user_id===event.owner_user_id?"owner":"participant"});
    return{...event,viewing_context:clubContext?.events?.find(item=>item.intent_id===event.intent_id)?.context||null,participants:[...members.values()],event_title:page?.activity?.title||null,plan_status:page?.activity?.status||null};
  });
  const reviews=doneRows.map(row=>({...row,seed_id:row.seed_id||row.source_id||row.user_id,body:row.experience_text,comment_count:0}));
  const ownIntentResult=viewerId?await supabase.rpc("get_my_common_personal_intent_v39",{p_target_id:targetId}):null;
  if(ownIntentResult?.error)return NextResponse.json({error:"İsteğin yüklenemedi."},{status:500});
  const hasOwnPersonalIntent=(ownIntentResult?.data as {status?:string}|null)?.status==="active";
  const ownSeedId=typeof card.own_seed_id==="string"?card.own_seed_id:null;
  const ownDetailResult=ownSeedId?await supabase.rpc("get_visible_seed_detail",{p_seed_id:ownSeedId}):null;
  const ownDetail=ownDetailResult?parseSeedDetailData(ownDetailResult.data):null;
  const ownRow=ownIntentResult?.data as Record<string,unknown>|null;const ownLoc=ownRow?.location_id?await supabase.from("locations").select("district,city,country_name").eq("id",String(ownRow.location_id)).maybeSingle():null;
  const ownWish=ownRow?.status==="active"?{user_id:viewerId,start_date:ownRow.start_date,end_date:ownRow.end_date,timing_precision:ownRow.timing_precision,date_options:ownRow.date_options,location:people.find(person=>person.user_id===viewerId)?.location||[ownLoc?.data?.district,ownLoc?.data?.city,ownLoc?.data?.country_name].filter(Boolean).join(", ")||null,viewing_context:(clubResult.data as {own_context?:object}|null)?.own_context}:null;
  return NextResponse.json({ownWish,contentType:typeResult.data,card:{...card,title:context.title||card.title,subtitle:visibleSubtitle(typeId,typeResult.data?.base_kind)?context.creator_name||card.subtitle:null,cover_url:context.cover_url||card.cover_url,metadata:{...((card.metadata||{}) as object),...((context.metadata||{}) as object)},catalog_item_id:context.catalog_item_id||card.catalog_item_id||null},clubContext:clubResult.data,viewerId,hasOwnPersonalIntent,people,events:enrichedEvents,reviews,ownDetail});
}
