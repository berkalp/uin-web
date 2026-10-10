import {NextResponse} from "next/server";
import {createClient} from "@/utils/supabase/server";

type Row=Record<string,unknown>;
const UUID_PATTERN=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CACHE_HEADERS={"Cache-Control":"private, max-age=30, must-revalidate","Vary":"Cookie, Authorization"};

function isRow(value:unknown):value is Row{
  return Boolean(value)&&typeof value==="object"&&!Array.isArray(value);
}

function targetId(row:Row,key:"target_id"|"canonical_target_id"="target_id"){
  const value=row[key];
  return typeof value==="string"&&UUID_PATTERN.test(value)?value:"";
}

function count(row:Row,key:"intent_people_count"|"experience_people_count"|"active_event_count"){
  const raw=row[key];
  if(raw==null||raw==="")throw new Error(`Missing club ${key} count`);
  const value=Number(raw);
  if(!Number.isSafeInteger(value)||value<0)throw new Error(`Invalid club ${key} count`);
  return value;
}

export async function GET(){
  try{
    const db=await createClient();
    const hierarchy=await db.rpc("get_club_hierarchy_v78");
    if(hierarchy.error)throw hierarchy.error;
    if(!Array.isArray(hierarchy.data)||!hierarchy.data.every(isRow))throw new Error("Invalid club hierarchy payload");

    const hierarchyRows=hierarchy.data as Row[];
    const malformedHierarchy=hierarchyRows.some(row=>!targetId(row)||(row.parent_target_id!=null&&(typeof row.parent_target_id!=="string"||!UUID_PATTERN.test(row.parent_target_id))));
    if(malformedHierarchy)throw new Error("Incomplete club hierarchy payload");
    const ids=[...new Set(hierarchyRows.map(row=>targetId(row)))];
    if(!ids.length)return NextResponse.json({clubs:[]},{headers:CACHE_HEADERS});

    // Every dependent reader is bounded by the hierarchy ids and starts in the
    // same batch. This replaces the old full-catalogue pagination waterfall.
    const [catalogue,placements,styles]=await Promise.all([
      db.rpc("get_uin_catalogue_for_targets_v123",{p_target_ids:ids}),
      db.from("seed_catalog_items").select("id,canonical_target_id,status").in("canonical_target_id",ids),
      db.rpc("get_uin_card_styles_v76",{p_target_ids:ids}),
    ]);
    if(catalogue.error||placements.error||styles.error)throw catalogue.error||placements.error||styles.error;
    if(!Array.isArray(catalogue.data)||!catalogue.data.every(isRow)
      ||!Array.isArray(placements.data)||!placements.data.every(isRow)
      ||!Array.isArray(styles.data)||!styles.data.every(isRow))throw new Error("Incomplete club catalogue payload");

    const cardByTarget=new Map<string,Row>();
    for(const row of catalogue.data as Row[]){const id=targetId(row,"canonical_target_id");if(id)cardByTarget.set(id,row)}
    const styleByTarget=new Map<string,Row>();
    for(const row of styles.data as Row[]){const id=targetId(row);if(id)styleByTarget.set(id,row)}
    const placementByTarget=new Map<string,Row>();
    for(const row of placements.data as Row[]){
      const id=targetId(row,"canonical_target_id");
      if(!id)continue;
      const current=placementByTarget.get(id);
      if(!current||(row.status==="active"&&current.status!=="active"))placementByTarget.set(id,row);
    }

    // The canonical projection proves which root clubs and child teams this
    // viewer may see. Every returned card must have all dependent projections;
    // otherwise the endpoint fails instead of inventing empty ids or counters.
    const visibleRows=hierarchyRows.filter(row=>{
      const id=targetId(row),placement=placementByTarget.get(id);
      return cardByTarget.has(id)&&Boolean(row.parent_target_id||placement?.status==="active");
    });
    const incompleteIds=visibleRows.map(row=>targetId(row)).filter(id=>{
      const placement=placementByTarget.get(id);
      return !placement||typeof placement.id!=="string"||!UUID_PATTERN.test(placement.id)||!styleByTarget.has(id);
    });
    if(incompleteIds.length)throw new Error("Club catalogue projections are incomplete");

    const labels=new Map<string,string>();
    const label=(value:unknown)=>{
      const clean=typeof value==="string"?value.trim().replace(/\s+/g," "):"";
      const key=clean.toLocaleLowerCase("tr");
      if(!labels.has(key))labels.set(key,clean);
      return labels.get(key)||"";
    };
    const titleCase=(value:unknown)=>label(value).toLocaleLowerCase("tr").replace(/^./,character=>character.toLocaleUpperCase("tr"));

    const clubs=visibleRows.map(row=>{
      const id=targetId(row);
      const card=cardByTarget.get(id)!;
      const style=styleByTarget.get(id);
      const placement=placementByTarget.get(id);
      const displayName=String(row.display_name||card?.title||row.title||"").trim();
      if(!displayName)throw new Error("Club display name is missing");
      return{
        ...row,
        displayName,
        cardStyle:style?.card_style??null,
        ownStyle:style?.own_style??null,
        sport:titleCase(row.sport),
        division:titleCase(row.division),
        league:label(row.league),
        title:String(card?.title||displayName),
        coverUrl:card?.catalog_cover_url||card?.cover_url||row.logo_url||null,
        logoUrl:typeof row.logo_url==="string"?row.logo_url:null,
        catalogItemId:String(placement?.id),
        wanting:count(card,"intent_people_count"),
        done:count(card,"experience_people_count"),
        active:count(card,"active_event_count"),
      };
    });

    return NextResponse.json({clubs},{headers:CACHE_HEADERS});
  }catch(error){
    console.error("club catalogue unavailable",error);
    return NextResponse.json({error:"Kulüp ve takım bilgileri yüklenemedi."},{status:503,headers:{"Cache-Control":"no-store"}});
  }
}
