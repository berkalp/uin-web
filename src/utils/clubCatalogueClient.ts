import type {ClubCard} from "@/utils/clubHierarchy";

const CLUB_CATALOGUE_TTL_MS=30_000;
const UUID_PATTERN=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

let cached:{clubs:ClubCard[];loadedAt:number}|null=null;
let generation=0;
let inFlight:{generation:number;promise:Promise<ClubCard[]>}|null=null;

function isRecord(value:unknown):value is Record<string,unknown>{
  return Boolean(value)&&typeof value==="object"&&!Array.isArray(value);
}

function isNullableString(value:unknown){
  return value===null||typeof value==="string";
}

function isCount(value:unknown){
  return typeof value==="number"&&Number.isSafeInteger(value)&&value>=0;
}

function isClubCard(value:unknown):value is ClubCard{
  if(!isRecord(value))return false;
  return typeof value.target_id==="string"&&UUID_PATTERN.test(value.target_id)
    &&(value.parent_target_id===null||(typeof value.parent_target_id==="string"&&UUID_PATTERN.test(value.parent_target_id)))
    &&["sport","division","league","season","displayName","title"].every(field=>typeof value[field]==="string")
    &&typeof value.catalogItemId==="string"&&UUID_PATTERN.test(value.catalogItemId)
    &&isNullableString(value.coverUrl)
    &&isNullableString(value.logoUrl)
    &&isCount(value.wanting)
    &&isCount(value.done)
    &&isCount(value.active);
}

async function requestClubCatalogue(force:boolean){
  const response=await fetch("/api/clubs/catalogue",{cache:force?"no-store":"default"});
  const body:unknown=await response.json().catch(()=>null);
  if(!response.ok){
    const message=isRecord(body)&&typeof body.error==="string"?body.error:"Kulüp ve takım bilgileri yüklenemedi.";
    throw new Error(message);
  }
  if(!isRecord(body)||!Array.isArray(body.clubs)||!body.clubs.every(isClubCard)){
    throw new Error("Kulüp ve takım bilgileri eksik geldi. Lütfen tekrar dene.");
  }
  return body.clubs;
}

export function loadClubCatalogue(force=false):Promise<ClubCard[]>{
  if(!force&&cached&&Date.now()-cached.loadedAt<CLUB_CATALOGUE_TTL_MS)return Promise.resolve(cached.clubs);
  const requestGeneration=generation;
  if(inFlight?.generation===requestGeneration)return inFlight.promise;
  const pending:{generation:number;promise:Promise<ClubCard[]>}={generation:requestGeneration,promise:Promise.resolve([])};
  const request=requestClubCatalogue(force).then(clubs=>{
    if(generation===requestGeneration)cached={clubs,loadedAt:Date.now()};
    return clubs;
  });
  pending.promise=request.finally(()=>{if(inFlight===pending)inFlight=null});
  inFlight=pending;
  return pending.promise;
}

export function invalidateClubCatalogueCache(){
  generation+=1;
  cached=null;
  inFlight=null;
}

let directoryCache:{clubs:ClubCard[];loadedAt:number;generation:number}|null=null;
let directoryPending:{generation:number;promise:Promise<ClubCard[]>}|null=null;
export function loadClubDirectory(force=false):Promise<ClubCard[]>{
 if(!force&&directoryCache?.generation===generation&&Date.now()-directoryCache.loadedAt<CLUB_CATALOGUE_TTL_MS)return Promise.resolve(directoryCache.clubs);
 const version=generation;if(directoryPending?.generation===version)return directoryPending.promise;
 const promise=(async()=>{
  const response=await fetch("/api/clubs/catalogue?metadata=1",{cache:force?"no-store":"default"});const body:unknown=await response.json();
  if(!response.ok||!isRecord(body)||!Array.isArray(body.clubs)||!body.clubs.every(row=>isRecord(row)&&typeof row.target_id==="string"&&UUID_PATTERN.test(row.target_id)&&typeof row.catalogItemId==="string"&&UUID_PATTERN.test(row.catalogItemId)&&["sport","league","division","title","displayName"].every(key=>typeof row[key]==="string")))throw new Error("Kulüp dizini yüklenemedi. Lütfen tekrar dene.");
  const clubs=body.clubs as ClubCard[];if(version===generation)directoryCache={clubs,loadedAt:Date.now(),generation:version};return clubs;
 })().finally(()=>{if(directoryPending?.generation===version)directoryPending=null});directoryPending={generation:version,promise};return promise;
}
