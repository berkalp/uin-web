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
    const [profile,summary,rating,social,relations,hierarchy]=await Promise.all([supabase.rpc("get_uin_card_profile_v60",{p_target_id:targetId}),supabase.rpc("get_uin_card_summary_v81",{p_target_ids:[targetId]}),supabase.rpc("get_uin_card_ratings_v85",{p_target_ids:[targetId]}),supabase.rpc("get_uin_card_social_v87",{p_target_ids:[targetId]}),supabase.rpc("get_uin_card_relations_v87",{p_target_ids:[targetId]}),supabase.rpc("get_uin_card_hierarchy_v81",{p_target_ids:[targetId]})]);
    const row=profile.data as {title?:string;creator_name?:string;cover_url?:string;catalog_item_id?:string;metadata?:Record<string,unknown>}|null;
    if(profile.error||summary.error||rating.error||!row?.title)return NextResponse.json({error:"Kart yüklenemedi."},{status:404});
    const stats=(summary.data||[])[0];let typeId=String(stats?.type_id||row.metadata?.content_type_id||"");
    if(!typeId){const catalog=await supabase.from("seed_catalog_items").select("item_kind").eq("canonical_target_id",targetId).order("updated_at",{ascending:false}).limit(1);typeId=catalog.data?.[0]?.item_kind||"activity";if(typeId==="video")typeId="series";}
    const type=await supabase.from("uin_content_types").select("id,label,icon,base_kind,ui_labels").eq("id",typeId).maybeSingle();
    const ratingStats=(rating.data||[])[0];
    return NextResponse.json({contentType:type.data,communityCounts:[Number(stats?.wanting||0),Number(stats?.done||0),Number(stats?.active||0)],averageRating:ratingStats?.average_rating==null?null:Number(ratingStats.average_rating),ratingCount:Number(ratingStats?.rating_count||0),viewerRating:ratingStats?.viewer_rating==null?null:Number(ratingStats.viewer_rating),social:(social.data||[])[0]||null,relations:relations.data||[],hierarchy:(hierarchy.data||[])[0]||null,card:{title:row.title,subtitle:visibleSubtitle(typeId,type.data?.base_kind)?row.creator_name||null:null,cover_url:row.cover_url||null,catalog_item_id:row.catalog_item_id||null,metadata:row.metadata||{}},people:[],reviews:[],events:[]});
  }
  const [cardResult,contextResult,peopleResult,eventResult,reviewResult,authResult]=await Promise.all([
    supabase.rpc("get_common_intent_cards_v38",{p_query:null,p_limit:1,p_offset:0,p_target_id:targetId}),
    supabase.rpc("get_uin_card_profile_v60",{p_target_id:targetId}),
    supabase.rpc("get_uin_card_people_v81",{p_target_id:targetId,p_group:"intent",p_limit:100,p_offset:0}),
    supabase.rpc("get_uin_card_events_v81",{p_target_id:targetId}),
    supabase.rpc("get_uin_card_people_v81",{p_target_id:targetId,p_group:"experience",p_limit:100,p_offset:0}),
    supabase.auth.getUser(),
  ]);
  const context=(contextResult.data||{}) as Record<string,unknown>;
  const commonCard=((cardResult.data||[]) as Array<Record<string,unknown>>)[0];
  const card=commonCard||(typeof context.title==="string"&&context.title.trim()?{
    canonical_target_id:targetId,
    title:context.title,
    subtitle:typeof context.creator_name==="string"?context.creator_name:null,
    cover_url:typeof context.cover_url==="string"?context.cover_url:null,
    catalog_item_id:typeof context.catalog_item_id==="string"?context.catalog_item_id:null,
    metadata:context.metadata&&typeof context.metadata==="object"?context.metadata:{},
    own_seed_id:null,
  }:null);
  if(!card)return NextResponse.json({error:"Kart bulunamadı."},{status:404});
  const viewerId=authResult.data.user?.id||null;
  if(peopleResult.error||reviewResult.error||eventResult.error)return NextResponse.json({error:"Kartın listeleri yüklenemedi."},{status:500});
  async function allPeople(first:Array<Record<string,unknown>>,group:string){const rows=[...first];while(rows.length<Number(rows[0]?.total_count||0)){const page=await supabase.rpc("get_uin_card_people_v81",{p_target_id:targetId,p_group:group,p_limit:100,p_offset:rows.length});if(page.error)throw new Error(page.error.message);const next=page.data as Array<Record<string,unknown>>;if(!next.length)break;rows.push(...next)}return rows}
  const [wantRows,doneRows]=await Promise.all([allPeople((peopleResult.data||[]) as Array<Record<string,unknown>>,"intent"),allPeople((reviewResult.data||[]) as Array<Record<string,unknown>>,"experience")]);
  const permissionRequests=viewerId?[...new Map(wantRows.filter(row=>row.user_id!==viewerId).map(row=>{const sourceTarget=String(row.source_target_id||targetId);const recipient=String(row.user_id);return[`${sourceTarget}:${recipient}`,{target_id:sourceTarget,recipient_id:recipient}]})).values()]:[];
  const permissionResult=permissionRequests.length?await supabase.rpc("get_uin_together_permissions_v83",{p_requests:permissionRequests}):{data:[],error:null};
  if(permissionResult.error)return NextResponse.json({error:"Birlikte yapma izinleri yüklenemedi."},{status:500});
  const permissions=new Map(((permissionResult.data||[]) as Array<Record<string,unknown>>).map(row=>[`${row.target_id}:${row.recipient_id}`,row]));
  const clubResult=await supabase.rpc("get_uin_club_context_v60",{p_target_id:targetId});
  const clubContext=clubResult.data as {personal?:Array<{user_id:string;context:object}>;events?:Array<{intent_id:string;context:object}>}|null;
  const metadata={...((card.metadata||{}) as object),...((context.metadata||{}) as object)} as Record<string,unknown>;
  let typeId=typeof metadata.content_type_id==="string"?metadata.content_type_id:"";
  if(!typeId){const catalog=await supabase.from("seed_catalog_items").select("item_kind").eq("canonical_target_id",targetId).order("updated_at",{ascending:false}).limit(1);typeId=catalog.data?.[0]?.item_kind||"activity";if(typeId==="video")typeId="series";}
  const typeResult=await supabase.from("uin_content_types").select("id,label,icon,base_kind,ui_labels").eq("id",typeId).maybeSingle();
  const people:Array<Record<string,unknown>>=wantRows.map(row=>{const sourceTarget=String(row.source_target_id||targetId);const permission=permissions.get(`${sourceTarget}:${row.user_id}`);return{...row,has_completed_experience:doneRows.some(done=>done.user_id===row.user_id),viewing_context:clubContext?.personal?.find(person=>person.user_id===row.user_id)?.context||metadata.legacy_viewing_context||null,is_current:true,id:row.source_id||row.user_id,start_date:row.start_date??row.target_date,end_date:row.end_date??row.target_date,together_allowed:Boolean(permission?.allowed),together_reason:typeof permission?.reason==="string"?permission.reason:null,together_code:typeof permission?.code==="string"?permission.code:null}});
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
  const ownPerson=people.find(person=>person.user_id===viewerId&&person.is_current!==false);
  const hasOwnPersonalIntent=Boolean(ownIntentResult?.data)||Boolean(ownPerson);
  const ownSeedId=typeof card.own_seed_id==="string"?card.own_seed_id:null;
  const ownDetailResult=ownSeedId?await supabase.rpc("get_visible_seed_detail",{p_seed_id:ownSeedId}):null;
  const ownDetail=ownDetailResult?parseSeedDetailData(ownDetailResult.data):null;
  const ownRow=ownIntentResult?.data as Record<string,unknown>|null;const ownLoc=ownRow?.location_id?await supabase.from("locations").select("district,city,country_name").eq("id",String(ownRow.location_id)).maybeSingle():null;
  const ownWish=ownRow?.status==="active"?{user_id:viewerId,start_date:ownRow.start_date,end_date:ownRow.end_date,timing_precision:ownRow.timing_precision,date_options:ownRow.date_options,location:ownPerson?.location||[ownLoc?.data?.district,ownLoc?.data?.city,ownLoc?.data?.country_name].filter(Boolean).join(", ")||null,viewing_context:(clubResult.data as {own_context?:object}|null)?.own_context}:ownPerson?{user_id:viewerId,start_date:ownPerson.start_date,end_date:ownPerson.end_date,timing_precision:ownPerson.timing_precision,date_options:ownPerson.date_options,location:ownPerson.location,viewing_context:ownPerson.viewing_context}:null;
  const ownIntentDraft=ownRow?.status==="active"?{start_date:ownRow.start_date,end_date:ownRow.end_date,timing_precision:ownRow.timing_precision,date_options:ownRow.date_options,location_id:ownRow.location_id,notes:ownRow.notes,visibility:ownRow.visibility,collaboration_mode:ownRow.collaboration_mode}:ownPerson?{start_date:ownPerson.start_date,end_date:ownPerson.end_date,timing_precision:ownPerson.timing_precision,date_options:ownPerson.date_options,location_id:ownPerson.location_id,notes:ownPerson.notes,visibility:ownPerson.visibility||"everyone",collaboration_mode:"everyone"}:null;
  const [socialResult,relationsResult]=await Promise.all([supabase.rpc("get_uin_card_social_v87",{p_target_ids:[targetId]}),supabase.rpc("get_uin_card_relations_v87",{p_target_ids:[targetId]})]);
  if(socialResult.error||relationsResult.error)return NextResponse.json({error:"Kartın puan, takipçi ve bağlantı bilgileri yüklenemedi."},{status:500});
  return NextResponse.json({ownWish,ownIntentDraft,contentType:typeResult.data,card:{...card,title:context.title||card.title,subtitle:visibleSubtitle(typeId,typeResult.data?.base_kind)?context.creator_name||card.subtitle:null,cover_url:context.cover_url||card.cover_url,metadata:{...((card.metadata||{}) as object),...((context.metadata||{}) as object)},catalog_item_id:context.catalog_item_id||card.catalog_item_id||null},clubContext:clubResult.data,social:(socialResult.data||[])[0]||null,relations:relationsResult.data||[],viewerId,hasOwnPersonalIntent,people,events:enrichedEvents,reviews,ownDetail});
}
