import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createSupabaseClient, isAuthSessionMissingError } from "@supabase/supabase-js";
import { parseSeedDetailData } from "@/utils/seeds";
import { buildPlaceConnectionContext } from "@/utils/placeConnectionContext";

function visibleSubtitle(typeId:string,baseKind:string|undefined){
  const normalized=typeId.toLocaleLowerCase("tr-TR");
  return !/(festival|concert|konser)/.test(normalized)&&["artist","book","movie","series","game","director","actor","writer"].includes(baseKind||"");
}

type CardRelation={target_id:string;related_target_id:string;direction:"in"|"out";relation_type:string;sort_order:number;section_title:string|null;title:string};

function record(value:unknown):value is Record<string,unknown>{return Boolean(value)&&typeof value==="object"&&!Array.isArray(value)}
function finiteMetric(value:unknown,{integer=false}:{integer?:boolean}={}){
  if((typeof value!=="number"&&typeof value!=="string")||value==="")return false;
  const parsed=Number(value);
  return Number.isFinite(parsed)&&parsed>=0&&(!integer||Number.isSafeInteger(parsed));
}
function targetMetricRow(value:unknown,targetId:string):value is Record<string,unknown>{return record(value)&&value.target_id===targetId}
function optionalRecord(value:unknown){return value===null||value===undefined||record(value)}
function cardRelation(value:unknown):value is CardRelation{const sortOrder=record(value)?Number(value.sort_order):Number.NaN;return record(value)&&typeof value.target_id==="string"&&typeof value.related_target_id==="string"&&(value.direction==="in"||value.direction==="out")&&typeof value.relation_type==="string"&&Number.isSafeInteger(sortOrder)&&typeof value.title==="string"&&(value.section_title===null||typeof value.section_title==="string")}
function activityOption(value:unknown){return record(value)&&typeof value.id==="string"&&value.id.length>0&&typeof value.name==="string"&&value.name.trim().length>0&&(value.category_name===null||value.category_name===undefined||typeof value.category_name==="string")}
function cardPerson(value:unknown){return record(value)&&typeof value.user_id==="string"&&value.user_id.length>0&&typeof value.full_name==="string"&&value.full_name.trim().length>0}
function permissionRow(value:unknown){return record(value)&&typeof value.target_id==="string"&&typeof value.recipient_id==="string"&&typeof value.allowed==="boolean"&&(value.reason===null||value.reason===undefined||typeof value.reason==="string")&&(value.code===null||value.code===undefined||typeof value.code==="string")}

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
  if(canonicalResult.data!==null&&canonicalResult.data!==undefined&&(typeof canonicalResult.data!=="string"||!/^[0-9a-f-]{36}$/i.test(canonicalResult.data)))return NextResponse.json({error:"Kart kimliği eksik geldi. Lütfen tekrar dene."},{status:503});
  const targetId=typeof canonicalResult.data==="string"&&/^[0-9a-f-]{36}$/i.test(canonicalResult.data)?canonicalResult.data:requestedTargetId;
  async function expandDisplayRelations(value:unknown){
    const direct=(Array.isArray(value)?value:[]) as CardRelation[];
    if(!direct.every(row=>cardRelation(row)&&row.target_id===targetId))throw new Error("Kart bağlantıları eksik döndü.");
    const sourceIds=[...new Set(direct.filter(row=>row.relation_type==="source_material"&&row.direction==="out").map(row=>row.related_target_id))];
    if(sourceIds.length===0)return direct;
    const peersResult=await supabase.rpc("get_uin_card_relations_v87",{p_target_ids:sourceIds});
    if(peersResult.error||!Array.isArray(peersResult.data)||!peersResult.data.every(row=>cardRelation(row)&&sourceIds.includes(row.target_id)))throw new Error("Bağlı kartlar yüklenemedi.");
    const seen=new Set(direct.map(row=>row.related_target_id));
    const peers:CardRelation[]=[];
    for(const row of peersResult.data as CardRelation[]){
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
    if(!row)return NextResponse.json({error:"Kart bulunamadı."},{status:404});
    if(!record(row)||typeof row.title!=="string"||!row.title.trim()||!optionalRecord(row.metadata))return NextResponse.json({error:"Kart profili eksik geldi. Lütfen tekrar dene."},{status:503});
    const summaryRows=summary.data,ratingRows=rating.data,socialRows=social.data;
    const stats=Array.isArray(summaryRows)&&summaryRows.length===1?summaryRows[0]:null;
    const ratingStats=Array.isArray(ratingRows)&&ratingRows.length===1?ratingRows[0]:null;
    const socialStats=Array.isArray(socialRows)&&socialRows.length===1?socialRows[0]:null;
    if(!targetMetricRow(stats,targetId)||!["wanting","done","active"].every(field=>finiteMetric(stats[field],{integer:true}))){
      console.error("card summary metrics missing",{targetId,stats});
      return NextResponse.json({error:"Kart sayaçları eksik geldi. Lütfen tekrar dene."},{status:503});
    }
    if(!targetMetricRow(ratingStats,targetId)||!finiteMetric(ratingStats.rating_count,{integer:true})||(ratingStats.average_rating!==null&&!finiteMetric(ratingStats.average_rating))||(ratingStats.viewer_rating!==null&&!finiteMetric(ratingStats.viewer_rating))){
      return NextResponse.json({error:"Kart puanı eksik geldi. Lütfen tekrar dene."},{status:503});
    }
    if(!targetMetricRow(socialStats,targetId)||!["follower_count","rating_count","related_count"].every(field=>finiteMetric(socialStats[field],{integer:true}))||(socialStats.average_rating!==null&&!finiteMetric(socialStats.average_rating))||(socialStats.viewer_rating!==null&&!finiteMetric(socialStats.viewer_rating))){
      return NextResponse.json({error:"Kart sosyal bilgileri eksik geldi. Lütfen tekrar dene."},{status:503});
    }
    if(!Array.isArray(relations.data)||!relations.data.every(cardRelation))return NextResponse.json({error:"Kart bağlantıları eksik geldi. Lütfen tekrar dene."},{status:503});
    let typeId=String(stats.type_id||row.metadata?.content_type_id||"");
    if(!typeId){const catalog=await supabase.from("seed_catalog_items").select("item_kind").eq("canonical_target_id",targetId).eq("status","active").order("updated_at",{ascending:false}).limit(1);const itemKind=Array.isArray(catalog.data)&&catalog.data.length===1&&record(catalog.data[0])?catalog.data[0].item_kind:null;if(catalog.error||typeof itemKind!=="string"||!itemKind.trim())return NextResponse.json({error:"Kart kategorisi yüklenemedi. Lütfen tekrar dene."},{status:503});typeId=itemKind==="video"?"series":itemKind;}
    const type=await supabase.from("uin_content_types").select("id,label,icon,base_kind,ui_labels").eq("id",typeId).maybeSingle();
    const typeData=type.data;
    if(type.error||!typeData||typeof typeData.id!=="string"||!typeData.id.trim()||typeof typeData.label!=="string"||!typeData.label.trim()||typeof typeData.icon!=="string"||!typeData.icon.trim()||typeof typeData.base_kind!=="string"||!typeData.base_kind.trim()||!optionalRecord(typeData.ui_labels))return NextResponse.json({error:"Kart kategorisi yüklenemedi. Lütfen tekrar dene."},{status:503});
    let displayRelations:CardRelation[];
    try{displayRelations=await expandDisplayRelations(relations.data)}catch(problem){console.error("card related works unavailable",problem);return NextResponse.json({error:"Kart bağlantıları yüklenemedi. Lütfen tekrar dene."},{status:503})}
    return NextResponse.json({canonicalTargetId:targetId,contentType:typeData,communityCounts:[Number(stats.wanting),Number(stats.done),Number(stats.active)],averageRating:ratingStats.average_rating==null?null:Number(ratingStats.average_rating),ratingCount:Number(ratingStats.rating_count),viewerRating:ratingStats.viewer_rating==null?null:Number(ratingStats.viewer_rating),social:socialStats,relations:relations.data,displayRelations,hierarchy:null,card:{title:row.title,subtitle:visibleSubtitle(typeId,typeData.base_kind)?row.creator_name||null:null,cover_url:row.cover_url||null,catalog_item_id:row.catalog_item_id||null,metadata:row.metadata||{}},people:[],reviews:[],events:[]});
  }
  // The v81 readers follow the full card hierarchy (including legacy aliases),
  // so every modal uses the same descendant set as the catalogue summary.
  const identityTargetIds=[targetId];
  const [cardResult,contextResult,hierarchyResult,authResult]=await Promise.all([
    // The catalogue projection is the canonical card read model. Besides being
    // substantially faster than the legacy direct-only reader, it carries the
    // same hierarchy totals that are rendered on the Library card.
    supabase.rpc("get_uin_catalogue_for_targets_v123",{p_target_ids:[targetId]}),
    supabase.rpc("get_uin_card_profile_v60",{p_target_id:targetId}),
    supabase.rpc("get_place_hierarchy_v74",{p_target_ids:[targetId]}),
    supabase.auth.getUser(),
  ]);
  if(cardResult.error||contextResult.error){
    console.error("card detail header unavailable",{card:cardResult.error,context:contextResult.error});
    return NextResponse.json({error:"Kart ayrıntıları yüklenemedi. Lütfen tekrar dene."},{status:503});
  }
  if(authResult.error&&!isAuthSessionMissingError(authResult.error)){
    return NextResponse.json({error:"Oturum bilgileri doğrulanamadı. Lütfen tekrar dene."},{status:503});
  }
  if(!Array.isArray(cardResult.data))return NextResponse.json({error:"Kartın Kütüphane kaydı doğrulanamadı."},{status:503});
  if(cardResult.data.length===0)return NextResponse.json({error:"Kartın Kütüphane kaydı bulunamadı."},{status:404});
  if(cardResult.data.length!==1||!record(cardResult.data[0])||!record(contextResult.data))return NextResponse.json({error:"Kart ayrıntıları eksik geldi. Lütfen tekrar dene."},{status:503});
  const context=contextResult.data;
  const commonCard=cardResult.data[0];
  if(commonCard.canonical_target_id!==targetId||typeof commonCard.title!=="string"||!commonCard.title.trim())return NextResponse.json({error:"Kart ayrıntıları başka bir kayıtla eşleşti. Lütfen tekrar dene."},{status:503});
  if(typeof context.title!=="string"||!context.title.trim()||(context.creator_name!==null&&context.creator_name!==undefined&&typeof context.creator_name!=="string")||(context.cover_url!==null&&context.cover_url!==undefined&&typeof context.cover_url!=="string")||(context.catalog_item_id!==null&&context.catalog_item_id!==undefined&&typeof context.catalog_item_id!=="string"))return NextResponse.json({error:"Kart profili eksik geldi. Lütfen tekrar dene."},{status:503});
  if(!["intent_people_count","experience_people_count","active_event_count"].every(field=>finiteMetric(commonCard[field],{integer:true}))){
    console.error("card detail metrics missing",{targetId,card:commonCard});
    return NextResponse.json({error:"Kart sayaçları eksik geldi. Lütfen tekrar dene."},{status:503});
  }
  const card=commonCard;
  const viewerId=authResult.data.user?.id||null;
  if(!optionalRecord(card.metadata)||!optionalRecord(context.metadata))return NextResponse.json({error:"Kart meta verileri eksik geldi. Lütfen tekrar dene."},{status:503});
  const metadata={...(record(card.metadata)?card.metadata:{}),...(record(context.metadata)?context.metadata:{})} as Record<string,unknown>;
  let typeId=typeof card.content_type_id==="string"?card.content_type_id:typeof metadata.content_type_id==="string"?metadata.content_type_id:"";
  if(!typeId){const catalog=await supabase.from("seed_catalog_items").select("item_kind").eq("canonical_target_id",targetId).eq("status","active").order("updated_at",{ascending:false}).limit(1);const itemKind=Array.isArray(catalog.data)&&catalog.data.length===1&&record(catalog.data[0])?catalog.data[0].item_kind:null;if(catalog.error||typeof itemKind!=="string"||!itemKind.trim())return NextResponse.json({error:"Kart kategorisi yüklenemedi. Lütfen tekrar dene."},{status:503});typeId=itemKind==="video"?"series":itemKind;}

  // Start all independent, lightweight card requests while the hierarchy
  // lists are being read. Previously these requests formed another serial
  // waterfall after the three list readers had completed.
  const typePromise=supabase.from("uin_content_types").select("id,label,icon,base_kind,ui_labels").eq("id",typeId).maybeSingle();
  const backgroundPromise=Promise.all([
    supabase.rpc("get_uin_club_context_v60",{p_target_id:targetId}),
    viewerId?supabase.rpc("get_my_common_personal_intent_v39",{p_target_id:targetId}):Promise.resolve({data:null,error:null}),
    supabase.rpc("get_uin_card_social_v87",{p_target_ids:[targetId]}),
    supabase.rpc("get_uin_card_relations_v87",{p_target_ids:[targetId]}),
    supabase.rpc("get_uin_card_activity_options_v114",{p_target_id:targetId}),
  ]);
  const typeResult=await typePromise;
  const typeData=typeResult.data;
  if(typeResult.error||!typeData||typeof typeData.id!=="string"||!typeData.id.trim()||typeof typeData.label!=="string"||!typeData.label.trim()||typeof typeData.icon!=="string"||!typeData.icon.trim()||typeof typeData.base_kind!=="string"||!typeData.base_kind.trim()||!optionalRecord(typeData.ui_labels))return NextResponse.json({error:"Kart kategorisi yüklenemedi. Lütfen tekrar dene."},{status:503});
  if(typeData.base_kind==="place"&&hierarchyResult.error){
    console.error("card place hierarchy unavailable",{targetId,error:hierarchyResult.error});
    return NextResponse.json({error:"Yer kartının bağlantıları yüklenemedi. Lütfen tekrar dene."},{status:503});
  }
  const hierarchyRows=hierarchyResult.data;
  if(typeData.base_kind==="place"&&(!Array.isArray(hierarchyRows)||hierarchyRows.length!==1||!record(hierarchyRows[0])||!optionalRecord(hierarchyRows[0].place_hierarchy))){
    return NextResponse.json({error:"Yer kartının hiyerarşisi eksik geldi. Lütfen tekrar dene."},{status:503});
  }
  const hierarchyRow=(Array.isArray(hierarchyRows)&&record(hierarchyRows[0])?hierarchyRows[0]:null) as {place_hierarchy?:Record<string,unknown>|null}|null;

  let placeContext=null;
  if(typeData.base_kind==="place"){
    const catalogItemId=String(context.catalog_item_id||card.catalog_item_id||"");
    if(!catalogItemId)return NextResponse.json({error:"Yer kartının konum kaydı bulunamadı. Lütfen tekrar dene."},{status:503});
    const placeItemResult=await supabase.from("seed_catalog_items").select("id,external_id,metadata").eq("id",catalogItemId).eq("status","active").maybeSingle();
    if(placeItemResult.error||!placeItemResult.data||typeof placeItemResult.data.id!=="string"||(placeItemResult.data.external_id!==null&&typeof placeItemResult.data.external_id!=="string")||!optionalRecord(placeItemResult.data.metadata)){
      console.error("card place metadata unavailable",{targetId,error:placeItemResult.error});
      return NextResponse.json({error:"Yer kartının konum bilgileri yüklenemedi. Lütfen tekrar dene."},{status:503});
    }
    placeContext=buildPlaceConnectionContext({
      targetId,
      catalogItemId:placeItemResult.data.id,
      title:String(context.title||card.title||"Yer"),
      coverUrl:typeof (context.cover_url||card.cover_url)==="string"?String(context.cover_url||card.cover_url):null,
      externalId:placeItemResult.data.external_id,
      metadata:placeItemResult.data.metadata,
      hierarchy:hierarchyRow?.place_hierarchy,
      childCount:card.child_count,
    });
  }

  // Country cards can fan out over a very large place tree, so keep their
  // recursive readers sequential to protect the database statement budget.
  // An older place without hierarchy metadata also takes this safe path.
  // City, district and individual-place closures are now bounded by the v143
  // read model and are safe to fetch concurrently with ordinary cards.
  const placeKind=String(hierarchyRow?.place_hierarchy?.kind||"").trim().toLocaleLowerCase("tr-TR");
  const boundedPlaceKinds=["il","şehir","city","ilçe","district","yer","place"];
  const mustSerializePlaceReaders=typeData.base_kind==="place"&&!boundedPlaceKinds.includes(placeKind);
  const readPeople=()=>supabase.rpc("get_uin_card_people_v81",{p_target_id:targetId,p_group:"intent",p_limit:100,p_offset:0});
  const readReviews=()=>supabase.rpc("get_uin_card_people_v81",{p_target_id:targetId,p_group:"experience",p_limit:100,p_offset:0});
  const readEvents=()=>supabase.rpc("get_uin_card_events_v81",{p_target_id:targetId});
  const [peoplePage,reviewPage,eventPage]=mustSerializePlaceReaders
    ? [await readPeople(),await readReviews(),await readEvents()]
    : await Promise.all([readPeople(),readReviews(),readEvents()]);
  const peopleResults=[peoplePage],reviewResults=[reviewPage],eventResults=[eventPage];
  if(peopleResults.some(result=>result.error||!Array.isArray(result.data)||!result.data.every(cardPerson))||reviewResults.some(result=>result.error||!Array.isArray(result.data)||!result.data.every(cardPerson))||eventResults.some(result=>result.error||!Array.isArray(result.data)||!result.data.every(record))){
    console.error("card modal reader error",{people:peopleResults[0]?.error,reviews:reviewResults[0]?.error,events:eventResults[0]?.error});
    return NextResponse.json({error:"Kartın listeleri yüklenemedi."},{status:500});
  }
  async function allPeople(group:string,firstPages:typeof peopleResults){const rows:Array<Record<string,unknown>>=[];for(let index=0;index<identityTargetIds.length;index++){const initial=firstPages[index].data;if(!Array.isArray(initial)||!initial.every(cardPerson))throw new Error("Kartın kişi listesi eksik döndü.");const pageRows=[...initial];const total=pageRows.length===0?0:finiteMetric(pageRows[0].total_count,{integer:true})?Number(pageRows[0].total_count):-1;if(total<pageRows.length)throw new Error("Kartın kişi toplamı eksik döndü.");while(pageRows.length<total){const page=await supabase.rpc("get_uin_card_people_v81",{p_target_id:identityTargetIds[index],p_group:group,p_limit:100,p_offset:pageRows.length});if(page.error)throw new Error(page.error.message);if(!Array.isArray(page.data)||!page.data.every(cardPerson)||!page.data.length)throw new Error("Kartın kişi listesi eksik döndü.");pageRows.push(...page.data)}rows.push(...pageRows)}return [...new Map(rows.map(row=>[String(row.user_id),row])).values()]}
  let wantRows:Array<Record<string,unknown>>,doneRows:Array<Record<string,unknown>>;
  try{[wantRows,doneRows]=await Promise.all([allPeople("intent",peopleResults),allPeople("experience",reviewResults)])}catch(problem){console.error("card people pagination incomplete",problem);return NextResponse.json({error:"Kartın kişi listeleri eksik geldi. Lütfen tekrar dene."},{status:503})}
  const permissionRequests=viewerId?[...new Map(wantRows.filter(row=>row.user_id!==viewerId&&["personal","seed"].includes(String(row.source_kind||""))).map(row=>{const sourceTarget=String(row.source_target_id||targetId);const recipient=String(row.user_id);return[`${sourceTarget}:${recipient}`,{target_id:sourceTarget,recipient_id:recipient}]})).values()]:[];
  const permissionResult=permissionRequests.length?await supabase.rpc("get_uin_together_permissions_v83",{p_requests:permissionRequests}):{data:[],error:null};
  if(permissionResult.error||!Array.isArray(permissionResult.data)||!permissionResult.data.every(permissionRow))return NextResponse.json({error:"Birlikte yapma izinleri yüklenemedi."},{status:503});
  const permissions=new Map((permissionResult.data as Array<Record<string,unknown>>).map(row=>[`${row.target_id}:${row.recipient_id}`,row]));
  if(permissionRequests.some(request=>!permissions.has(`${request.target_id}:${request.recipient_id}`)))return NextResponse.json({error:"Birlikte yapma izinleri eksik geldi. Lütfen tekrar dene."},{status:503});
  const [clubResult,ownIntentResult,socialResult,relationsResult,activityOptionsResult]=await backgroundPromise;
  const clubError=clubResult.error;
  if(clubError||!optionalRecord(clubResult.data))return NextResponse.json({error:"Kart bağlamı yüklenemedi. Lütfen tekrar dene."},{status:503});
  const clubContext=clubResult.data as {personal?:Array<{user_id:string;context:object}>;events?:Array<{intent_id:string;context:object}>}|null;
  if(clubContext&&((clubContext.personal!==undefined&&(!Array.isArray(clubContext.personal)||!clubContext.personal.every(record)))||(clubContext.events!==undefined&&(!Array.isArray(clubContext.events)||!clubContext.events.every(record)))))return NextResponse.json({error:"Kart bağlamı eksik geldi. Lütfen tekrar dene."},{status:503});
  const people:Array<Record<string,unknown>>=wantRows.map(row=>{const sourceTarget=String(row.source_target_id||targetId);const permission=permissions.get(`${sourceTarget}:${row.user_id}`);const rowId=row.source_kind==="social"?`${String(row.source_id||sourceTarget)}:${String(row.user_id)}`:row.source_id||row.user_id;return{...row,has_completed_experience:doneRows.some(done=>done.user_id===row.user_id),viewing_context:clubContext?.personal?.find(person=>person.user_id===row.user_id)?.context||metadata.legacy_viewing_context||null,is_current:true,id:rowId,start_date:row.start_date??row.target_date,end_date:row.end_date??row.target_date,together_allowed:Boolean(permission?.allowed),together_reason:typeof permission?.reason==="string"?permission.reason:null,together_code:typeof permission?.code==="string"?permission.code:null}});
  const events=[...new Map(eventResults.flatMap(result=>(result.data||[]) as Array<Record<string,unknown>>).map(event=>[String(event.resource_id||event.plan_id||event.intent_id),event])).values()];
  if(events.some(event=>typeof (event.plan_id||event.intent_id)!=="string"||!String(event.plan_id||event.intent_id).trim()))return NextResponse.json({error:"Etkinlik bağlantıları eksik geldi. Lütfen tekrar dene."},{status:503});
  const resourceIds=events.map(event=>String(event.plan_id||event.intent_id));
  const eventPeopleResult=resourceIds.length?await supabase.rpc("get_visible_activity_people_batch",{p_resource_ids:resourceIds}):{data:[],error:null};
  if(eventPeopleResult.error||!Array.isArray(eventPeopleResult.data)||!eventPeopleResult.data.every(record))return NextResponse.json({error:"Etkinlik katılımcıları yüklenemedi."},{status:503});
  const eventPeople=eventPeopleResult.data as Array<Record<string,unknown>>;
  if(events.some(event=>event.participants!==null&&event.participants!==undefined&&(!Array.isArray(event.participants)||!event.participants.every(record))))return NextResponse.json({error:"Etkinlik katılımcıları eksik geldi. Lütfen tekrar dene."},{status:503});
  const enrichedEvents=events.map((event,index)=>{
    const members=new Map<string,Record<string,unknown>>();
    const listedParticipants=event.participants;
    for(const person of (Array.isArray(listedParticipants)?listedParticipants:[]) as Array<Record<string,unknown>>)members.set(String(person.user_id),person);
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
  if(ownIntentResult?.error||!optionalRecord(ownIntentResult?.data))return NextResponse.json({error:"İsteğin yüklenemedi."},{status:503});
  const ownRow=ownIntentResult?.data as Record<string,unknown>|null;
  const ownPerson=people.find(person=>person.user_id===viewerId&&person.is_current!==false&&["personal","seed"].includes(String(person.source_kind||"")));
  const hasOwnPersonalIntent=ownRow?.status==="active"||Boolean(ownPerson);
  const ownPersonSourceTargetId=ownPerson?.source_target_id;
  const ownWishTargetId=ownRow?.status==="active"?targetId:ownPerson&&typeof ownPersonSourceTargetId==="string"&&/^[0-9a-f-]{36}$/i.test(ownPersonSourceTargetId)?ownPersonSourceTargetId:ownPerson?targetId:null;
  const ownSeedId=typeof card.own_seed_id==="string"?card.own_seed_id:null;
  const ownDetailResult=ownSeedId?await supabase.rpc("get_visible_seed_detail",{p_seed_id:ownSeedId}):null;
  if(ownDetailResult?.error)return NextResponse.json({error:"Kişisel kart ayrıntın yüklenemedi. Lütfen tekrar dene."},{status:503});
  const ownDetail=ownDetailResult?parseSeedDetailData(ownDetailResult.data):null;
  if(ownDetailResult&&!ownDetail)return NextResponse.json({error:"Kişisel kart ayrıntın eksik geldi. Lütfen tekrar dene."},{status:503});
  const ownLoc=ownRow?.location_id?await supabase.from("locations").select("district,city,country_name").eq("id",String(ownRow.location_id)).maybeSingle():null;
  if(ownLoc&&(ownLoc.error||!record(ownLoc.data)))return NextResponse.json({error:"İstek konumu yüklenemedi. Lütfen tekrar dene."},{status:503});
  const ownWish=ownRow?.status==="active"?{user_id:viewerId,start_date:ownRow.start_date,end_date:ownRow.end_date,timing_precision:ownRow.timing_precision,date_options:ownRow.date_options,location:ownPerson?.location||[ownLoc?.data?.district,ownLoc?.data?.city,ownLoc?.data?.country_name].filter(Boolean).join(", ")||null,viewing_context:(clubResult.data as {own_context?:object}|null)?.own_context}:ownPerson?{user_id:viewerId,start_date:ownPerson.start_date,end_date:ownPerson.end_date,timing_precision:ownPerson.timing_precision,date_options:ownPerson.date_options,location:ownPerson.location,viewing_context:ownPerson.viewing_context}:null;
  const ownIntentDraft=ownRow?.status==="active"?{start_date:ownRow.start_date,end_date:ownRow.end_date,timing_precision:ownRow.timing_precision,date_options:ownRow.date_options,location_id:ownRow.location_id,notes:ownRow.notes,visibility:ownRow.visibility,collaboration_mode:ownRow.collaboration_mode}:ownPerson?{start_date:ownPerson.start_date,end_date:ownPerson.end_date,timing_precision:ownPerson.timing_precision,date_options:ownPerson.date_options,location_id:ownPerson.location_id,notes:ownPerson.notes,visibility:ownPerson.visibility||"everyone",collaboration_mode:"everyone"}:null;
  if(socialResult.error||relationsResult.error||activityOptionsResult.error)return NextResponse.json({error:"Kartın puan, takipçi ve bağlantı bilgileri yüklenemedi."},{status:503});
  const socialRows=socialResult.data;
  const social=Array.isArray(socialRows)&&socialRows.length===1?socialRows[0]:null;
  if(!targetMetricRow(social,targetId)||!["follower_count","rating_count","related_count"].every(field=>finiteMetric(social[field],{integer:true}))||(social.average_rating!==null&&!finiteMetric(social.average_rating))||(social.viewer_rating!==null&&!finiteMetric(social.viewer_rating))){
    return NextResponse.json({error:"Kartın sosyal bilgileri eksik geldi. Lütfen tekrar dene."},{status:503});
  }
  if(!Array.isArray(relationsResult.data)||!relationsResult.data.every(cardRelation)||!Array.isArray(activityOptionsResult.data)||!activityOptionsResult.data.every(activityOption))return NextResponse.json({error:"Kart bağlantıları eksik geldi. Lütfen tekrar dene."},{status:503});
  let displayRelations:CardRelation[];
  try{displayRelations=await expandDisplayRelations(relationsResult.data)}catch(problem){console.error("card related works unavailable",problem);return NextResponse.json({error:"Kart bağlantıları yüklenemedi. Lütfen tekrar dene."},{status:503})}
  return NextResponse.json({canonicalTargetId:targetId,ownWishTargetId,ownWish,ownIntentDraft,contentType:typeData,placeContext,communityCounts:[Number(card.intent_people_count),Number(card.experience_people_count),Number(card.active_event_count)],card:{...card,title:context.title||card.title,subtitle:visibleSubtitle(typeId,typeData.base_kind)?context.creator_name||card.subtitle:null,cover_url:context.cover_url||card.cover_url,metadata,catalog_item_id:context.catalog_item_id||card.catalog_item_id||null},clubContext:clubResult.data,social,relations:relationsResult.data,displayRelations,activityOptions:activityOptionsResult.data,viewerId,hasOwnPersonalIntent,people:finalPeople,events:enrichedEvents,reviews,ownDetail});
}
