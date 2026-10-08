import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { parseSeedDetailData } from "@/utils/seeds";

function visibleSubtitle(typeId:string,baseKind:string|undefined){
  const normalized=typeId.toLocaleLowerCase("tr-TR");
  return !/(festival|concert|konser)/.test(normalized)&&["artist","book","movie","series","game","director","actor","writer"].includes(baseKind||"");
}

type CardRelation={target_id:string;related_target_id:string;direction:"in"|"out";relation_type:string;sort_order:number;section_title:string|null;title:string};

async function requestClient(request:NextRequest){
  const token=(request.headers.get("authorization")||"").match(/^Bearer\s+(.+)$/i)?.[1];
  if(!token)return createClient();
  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,{global:{headers:{Authorization:`Bearer ${token}`}},auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
}

export async function GET(request:NextRequest,{params}:{params:Promise<{targetId:string}>}){
  const {targetId:requestedTargetId}=await params;
  if(!/^[0-9a-f-]{36}$/i.test(requestedTargetId))return NextResponse.json({error:"Kart bulunamadı."},{status:404});
  const supabase=await requestClient(request);
  const canonicalResult=await supabase.rpc("resolve_uin_card_target_v129",{p_target_id:requestedTargetId});
  if(canonicalResult.error){
    console.error("card identity resolution unavailable",canonicalResult.error);
    return NextResponse.json({error:"Kart kimliği çözümlenemedi. Lütfen tekrar dene."},{status:503});
  }
  const targetId=typeof canonicalResult.data==="string"&&/^[0-9a-f-]{36}$/i.test(canonicalResult.data)?canonicalResult.data:requestedTargetId;
  async function expandDisplayRelations(value:unknown){
    const direct=(Array.isArray(value)?value:[]) as CardRelation[];
    const sourceIds=[...new Set(direct.filter(row=>row.relation_type==="source_material"&&row.direction==="out").map(row=>row.related_target_id))];
    if(sourceIds.length===0)return direct;
    const peersResult=await supabase.rpc("get_uin_card_relations_v87",{p_target_ids:sourceIds});
    if(peersResult.error)return direct;
    const seen=new Set(direct.map(row=>row.related_target_id));
    const peers:CardRelation[]=[];
    for(const row of (peersResult.data||[]) as CardRelation[]){
      if(row.relation_type!=="source_material"||row.direction!=="in"||row.related_target_id===targetId||seen.has(row.related_target_id))continue;
      seen.add(row.related_target_id);
      peers.push({...row,relation_type:"related",section_title:"Aynı kaynağa bağlı eserler",sort_order:peers.length});
    }
    return [...direct,...peers];
  }
  if(request.nextUrl.searchParams.get("summary")==="1"){
    const [profile,summary,rating,social,relations]=await Promise.all([supabase.rpc("get_uin_card_profile_v60",{p_target_id:targetId}),supabase.rpc("get_uin_card_summary_v129",{p_target_ids:[targetId]}),supabase.rpc("get_uin_card_ratings_v85",{p_target_ids:[targetId]}),supabase.rpc("get_uin_card_social_v87",{p_target_ids:[targetId]}),supabase.rpc("get_uin_card_relations_v87",{p_target_ids:[targetId]})]);
    const row=profile.data as {title?:string;creator_name?:string;cover_url?:string;catalog_item_id?:string;metadata?:Record<string,unknown>}|null;
    if(profile.error||summary.error||rating.error||social.error||relations.error){
      console.error("card summary unavailable",{profile:profile.error,summary:summary.error,rating:rating.error,social:social.error,relations:relations.error});
      return NextResponse.json({error:"Kart özeti yüklenemedi. Lütfen tekrar dene."},{status:503});
    }
    if(!row?.title)return NextResponse.json({error:"Kart bulunamadı."},{status:404});
    const stats=(summary.data||[])[0];let typeId=String(stats?.type_id||row.metadata?.content_type_id||"");
    if(!stats||["wanting","done","active"].some(field=>stats[field]==null||!Number.isFinite(Number(stats[field])))){
      console.error("card summary metrics missing",{targetId,stats});
      return NextResponse.json({error:"Kart sayaçları eksik geldi. Lütfen tekrar dene."},{status:503});
    }
    if(!typeId){const catalog=await supabase.from("seed_catalog_items").select("item_kind").eq("canonical_target_id",targetId).order("updated_at",{ascending:false}).limit(1);typeId=catalog.data?.[0]?.item_kind||"activity";if(typeId==="video")typeId="series";}
    const type=await supabase.from("uin_content_types").select("id,label,icon,base_kind,ui_labels").eq("id",typeId).maybeSingle();
    if(type.error)return NextResponse.json({error:"Kart kategorisi yüklenemedi. Lütfen tekrar dene."},{status:503});
    const ratingStats=(rating.data||[])[0];
    const displayRelations=await expandDisplayRelations(relations.data);
    return NextResponse.json({canonicalTargetId:targetId,contentType:type.data,communityCounts:[Number(stats?.wanting||0),Number(stats?.done||0),Number(stats?.active||0)],averageRating:ratingStats?.average_rating==null?null:Number(ratingStats.average_rating),ratingCount:Number(ratingStats?.rating_count||0),viewerRating:ratingStats?.viewer_rating==null?null:Number(ratingStats.viewer_rating),social:(social.data||[])[0]||null,relations:relations.data||[],displayRelations,hierarchy:null,card:{title:row.title,subtitle:visibleSubtitle(typeId,type.data?.base_kind)?row.creator_name||null:null,cover_url:row.cover_url||null,catalog_item_id:row.catalog_item_id||null,metadata:row.metadata||{}},people:[],reviews:[],events:[]});
  }
  // The v81 readers follow the full card hierarchy (including legacy aliases),
  // so every modal uses the same descendant set as the catalogue summary.
  const identityTargetIds=[targetId];
  const [cardResult,contextResult,authResult]=await Promise.all([
    supabase.rpc("get_common_intent_cards_v38",{p_query:null,p_limit:1,p_offset:0,p_target_id:targetId}),
    supabase.rpc("get_uin_card_profile_v60",{p_target_id:targetId}),
    supabase.auth.getUser(),
  ]);
  if(cardResult.error||contextResult.error){
    console.error("card detail header unavailable",{card:cardResult.error,context:contextResult.error});
    return NextResponse.json({error:"Kart ayrıntıları yüklenemedi. Lütfen tekrar dene."},{status:503});
  }
  // Run the hierarchy readers one after another. Executing three recursive
  // readers concurrently can exhaust the database statement budget on large
  // place trees and intermittently return a timeout.
  const peopleResults=[await supabase.rpc("get_uin_card_people_v81",{p_target_id:targetId,p_group:"intent",p_limit:100,p_offset:0})];
  const reviewResults=[await supabase.rpc("get_uin_card_people_v81",{p_target_id:targetId,p_group:"experience",p_limit:100,p_offset:0})];
  const eventResults=[await supabase.rpc("get_uin_card_events_v81",{p_target_id:targetId})];
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
  if(peopleResults.some(result=>result.error)||reviewResults.some(result=>result.error)||eventResults.some(result=>result.error)){
    console.error("card modal reader error",{people:peopleResults[0]?.error,reviews:reviewResults[0]?.error,events:eventResults[0]?.error});
    return NextResponse.json({error:"Kartın listeleri yüklenemedi."},{status:500});
  }
  async function allPeople(group:string,firstPages:typeof peopleResults){const rows:Array<Record<string,unknown>>=[];for(let index=0;index<identityTargetIds.length;index++){const pageRows=[...((firstPages[index].data||[]) as Array<Record<string,unknown>>)];while(pageRows.length<Number(pageRows[0]?.total_count||0)){const page=await supabase.rpc("get_uin_card_people_v81",{p_target_id:identityTargetIds[index],p_group:group,p_limit:100,p_offset:pageRows.length});if(page.error)throw new Error(page.error.message);const next=(page.data||[]) as Array<Record<string,unknown>>;if(!next.length)break;pageRows.push(...next)}rows.push(...pageRows)}return [...new Map(rows.map(row=>[String(row.user_id||row.source_id||row.id),row])).values()]}
  const [wantRows,doneRows]=await Promise.all([allPeople("intent",peopleResults),allPeople("experience",reviewResults)]);
  const permissionRequests=viewerId?[...new Map(wantRows.filter(row=>row.user_id!==viewerId).map(row=>{const sourceTarget=String(row.source_target_id||targetId);const recipient=String(row.user_id);return[`${sourceTarget}:${recipient}`,{target_id:sourceTarget,recipient_id:recipient}]})).values()]:[];
  const permissionResult=permissionRequests.length?await supabase.rpc("get_uin_together_permissions_v83",{p_requests:permissionRequests}):{data:[],error:null};
  if(permissionResult.error)return NextResponse.json({error:"Birlikte yapma izinleri yüklenemedi."},{status:500});
  const permissions=new Map(((permissionResult.data||[]) as Array<Record<string,unknown>>).map(row=>[`${row.target_id}:${row.recipient_id}`,row]));
  const clubResult=await supabase.rpc("get_uin_club_context_v60",{p_target_id:targetId});
  if(clubResult.error)return NextResponse.json({error:"Kart bağlamı yüklenemedi. Lütfen tekrar dene."},{status:503});
  const clubContext=clubResult.data as {personal?:Array<{user_id:string;context:object}>;events?:Array<{intent_id:string;context:object}>}|null;
  const metadata={...((card.metadata||{}) as object),...((context.metadata||{}) as object)} as Record<string,unknown>;
  let typeId=typeof metadata.content_type_id==="string"?metadata.content_type_id:"";
  if(!typeId){const catalog=await supabase.from("seed_catalog_items").select("item_kind").eq("canonical_target_id",targetId).order("updated_at",{ascending:false}).limit(1);typeId=catalog.data?.[0]?.item_kind||"activity";if(typeId==="video")typeId="series";}
  const typeResult=await supabase.from("uin_content_types").select("id,label,icon,base_kind,ui_labels").eq("id",typeId).maybeSingle();
  if(typeResult.error)return NextResponse.json({error:"Kart kategorisi yüklenemedi. Lütfen tekrar dene."},{status:503});
  const people:Array<Record<string,unknown>>=wantRows.map(row=>{const sourceTarget=String(row.source_target_id||targetId);const permission=permissions.get(`${sourceTarget}:${row.user_id}`);return{...row,has_completed_experience:doneRows.some(done=>done.user_id===row.user_id),viewing_context:clubContext?.personal?.find(person=>person.user_id===row.user_id)?.context||metadata.legacy_viewing_context||null,is_current:true,id:row.source_id||row.user_id,start_date:row.start_date??row.target_date,end_date:row.end_date??row.target_date,together_allowed:Boolean(permission?.allowed),together_reason:typeof permission?.reason==="string"?permission.reason:null,together_code:typeof permission?.code==="string"?permission.code:null}});
  const events=[...new Map(eventResults.flatMap(result=>(result.data||[]) as Array<Record<string,unknown>>).map(event=>[String(event.resource_id||event.plan_id||event.intent_id),event])).values()];
  const resourceIds=events.map(event=>String(event.plan_id||event.intent_id));
  const eventPeopleResult=resourceIds.length?await supabase.rpc("get_visible_activity_people_batch",{p_resource_ids:resourceIds}):{data:[],error:null};
  if(eventPeopleResult.error)return NextResponse.json({error:"Etkinlik katılımcıları yüklenemedi."},{status:500});
  const eventPeople=(eventPeopleResult.data||[]) as Array<Record<string,unknown>>;
  const enrichedEvents=events.map((event,index)=>{
    const members=new Map<string,Record<string,unknown>>();
    for(const person of (event.participants||[]) as Array<Record<string,unknown>>)members.set(String(person.user_id),person);
    for(const person of eventPeople.filter(person=>person.resource_id===resourceIds[index]))members.set(String(person.user_id),{...person,role:person.user_id===event.owner_user_id?"owner":"participant"});
    return{...event,viewing_context:clubContext?.events?.find(item=>item.intent_id===event.intent_id)?.context||null,participants:[...members.values()],event_title:typeof event.subtitle==="string"?event.subtitle:null};
  }) as Array<Record<string,unknown>>;
  const today=new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Istanbul"}).format(new Date());
  const currentEvents=enrichedEvents.filter(event=>{
    const row=event as Record<string,unknown>;
    const status=String(row.plan_status||row.status||"").toLocaleLowerCase("tr-TR");
    return !["cancelled","canceled","completed"].includes(status)&&String(row.end_date||row.start_date||"").slice(0,10)>=today;
  });
  // Event attendance is shown in the event section. It must not inflate the
  // general-wish list or create duplicate people rows.
  const finalPeople=people.map(person=>{
    if(!viewerId||person.user_id===viewerId)return person;
    const shared=currentEvents.find(event=>{
      const memberIds=new Set([String(event.owner_user_id||""),...((event.participants||[]) as Array<Record<string,unknown>>).map(member=>String(member.user_id||""))]);
      return memberIds.has(viewerId)&&memberIds.has(String(person.user_id));
    });
    if(!shared)return person;
    const sharedTitle=String(shared.event_title||shared.subtitle||`${context.title||card.title} etkinliği`).trim();
    return{...person,together_allowed:false,together_code:"same_event",together_reason:`${sharedTitle} etkinliğinde birliktesiniz.`,shared_event:{intent_id:shared.intent_id,plan_id:shared.plan_id||null,resource_id:shared.resource_id||null,title:sharedTitle,start_date:shared.start_date,end_date:shared.end_date,location:shared.location||null}};
  });
  const reviews=doneRows.map(row=>({...row,seed_id:row.seed_id||row.source_id||row.user_id,body:row.experience_text,comment_count:0}));
  const ownIntentResult=viewerId?await supabase.rpc("get_my_common_personal_intent_v39",{p_target_id:targetId}):null;
  if(ownIntentResult?.error)return NextResponse.json({error:"İsteğin yüklenemedi."},{status:500});
  const ownPerson=people.find(person=>person.user_id===viewerId&&person.is_current!==false);
  const hasOwnPersonalIntent=Boolean(ownIntentResult?.data)||Boolean(ownPerson);
  const ownSeedId=typeof card.own_seed_id==="string"?card.own_seed_id:null;
  const ownDetailResult=ownSeedId?await supabase.rpc("get_visible_seed_detail",{p_seed_id:ownSeedId}):null;
  if(ownDetailResult?.error)return NextResponse.json({error:"Kişisel kart ayrıntın yüklenemedi. Lütfen tekrar dene."},{status:503});
  const ownDetail=ownDetailResult?parseSeedDetailData(ownDetailResult.data):null;
  const ownRow=ownIntentResult?.data as Record<string,unknown>|null;const ownLoc=ownRow?.location_id?await supabase.from("locations").select("district,city,country_name").eq("id",String(ownRow.location_id)).maybeSingle():null;
  const ownWish=ownRow?.status==="active"?{user_id:viewerId,start_date:ownRow.start_date,end_date:ownRow.end_date,timing_precision:ownRow.timing_precision,date_options:ownRow.date_options,location:ownPerson?.location||[ownLoc?.data?.district,ownLoc?.data?.city,ownLoc?.data?.country_name].filter(Boolean).join(", ")||null,viewing_context:(clubResult.data as {own_context?:object}|null)?.own_context}:ownPerson?{user_id:viewerId,start_date:ownPerson.start_date,end_date:ownPerson.end_date,timing_precision:ownPerson.timing_precision,date_options:ownPerson.date_options,location:ownPerson.location,viewing_context:ownPerson.viewing_context}:null;
  const ownIntentDraft=ownRow?.status==="active"?{start_date:ownRow.start_date,end_date:ownRow.end_date,timing_precision:ownRow.timing_precision,date_options:ownRow.date_options,location_id:ownRow.location_id,notes:ownRow.notes,visibility:ownRow.visibility,collaboration_mode:ownRow.collaboration_mode}:ownPerson?{start_date:ownPerson.start_date,end_date:ownPerson.end_date,timing_precision:ownPerson.timing_precision,date_options:ownPerson.date_options,location_id:ownPerson.location_id,notes:ownPerson.notes,visibility:ownPerson.visibility||"everyone",collaboration_mode:"everyone"}:null;
  const [socialResult,relationsResult,activityOptionsResult]=await Promise.all([supabase.rpc("get_uin_card_social_v87",{p_target_ids:[targetId]}),supabase.rpc("get_uin_card_relations_v87",{p_target_ids:[targetId]}),supabase.rpc("get_uin_card_activity_options_v114",{p_target_id:targetId})]);
  if(socialResult.error||relationsResult.error||activityOptionsResult.error)return NextResponse.json({error:"Kartın puan, takipçi ve bağlantı bilgileri yüklenemedi."},{status:500});
  const displayRelations=await expandDisplayRelations(relationsResult.data);
  return NextResponse.json({canonicalTargetId:targetId,ownWish,ownIntentDraft,contentType:typeResult.data,card:{...card,title:context.title||card.title,subtitle:visibleSubtitle(typeId,typeResult.data?.base_kind)?context.creator_name||card.subtitle:null,cover_url:context.cover_url||card.cover_url,metadata:{...((card.metadata||{}) as object),...((context.metadata||{}) as object)},catalog_item_id:context.catalog_item_id||card.catalog_item_id||null},clubContext:clubResult.data,social:(socialResult.data||[])[0]||null,relations:relationsResult.data||[],displayRelations,activityOptions:activityOptionsResult.data||[],viewerId,hasOwnPersonalIntent,people:finalPeople,events:enrichedEvents,reviews,ownDetail});
}
