import type {SupabaseClient} from '@supabase/supabase-js';

export const PHOTO_BUCKET='personal-experience-photos';
export type ExperiencePhoto={path:string;url:string};
export type ExperienceExtra={seedId:string;updatedAt:string|null;photos:ExperiencePhoto[];likeCount:number;viewerLiked:boolean;commentCount:number;canComment:boolean};
export type ExperienceReview={id:string;userId:string;name:string;username:string|null;avatarUrl:string|null;date:string|null;rating:number|null;body:string|null;isViewer:boolean};
export type ExperienceComment={comment_id:string;body:string;full_name:string;username:string|null;user_id:string;is_viewer_comment:boolean;deleted_at:string|null;created_at:string};
export type ExperienceSort='recent'|'liked';
export type DraftPhoto={url:string;path?:string;file?:Blob;mime?:string;uploadPath?:string};
export function orderExperienceReviews<T extends {id:string;isViewer:boolean}>(reviews:T[],extras:Record<string,ExperienceExtra>,sort:ExperienceSort):T[]{
  return [...reviews].sort((a,b)=>Number(b.isViewer)-Number(a.isViewer)
    ||(sort==='liked'?(extras[b.id]?.likeCount??0)-(extras[a.id]?.likeCount??0):0)
    || (Date.parse(extras[b.id]?.updatedAt??'')||0)-(Date.parse(extras[a.id]?.updatedAt??'')||0)
    ||a.id.localeCompare(b.id));
}
export async function loadExperienceExtras(client:SupabaseClient,ids:string[]):Promise<Record<string,ExperienceExtra>>{
  const unique=[...new Set(ids.filter(id=>/^[\da-f-]{36}$/i.test(id)))];
  const rows:ExperienceExtra[]=[];
  for(let offset=0;offset<unique.length;offset+=100){
    const result=await client.rpc('get_personal_experience_extras',{p_seed_ids:unique.slice(offset,offset+100)});
    if(result.error)throw result.error;
    rows.push(...result.data as ExperienceExtra[]);
  }
  const paths=[...new Set(rows.flatMap(row=>row.photos.map(photo=>photo.path)))];
  const urls=new Map<string,string>();
  for(let offset=0;offset<paths.length;offset+=100){
    const result=await client.storage.from(PHOTO_BUCKET).createSignedUrls(paths.slice(offset,offset+100),900);
    if(result.error)throw result.error;
    for(const photo of result.data??[])if(photo.path&&photo.signedUrl)urls.set(photo.path,photo.signedUrl);
  }
  return Object.fromEntries(rows.map(row=>[row.seedId,{...row,photos:row.photos.map(photo=>({...photo,url:urls.get(photo.path)??''}))}]));
}
export async function saveExperiencePhotos(client:SupabaseClient,seedId:string,photos:DraftPhoto[],expected:string[],visibility='everyone'){
  if(photos.length>6)throw Error('En fazla 6 fotoğraf ekleyebilirsin.');
  const {data:{user},error}=await client.auth.getUser();
  if(error||!user)throw Error('Fotoğraf eklemek için giriş yapmalısın.');
  const paths:string[]=[];
  for(const photo of photos){
    if(photo.path){paths.push(photo.path);continue;}
    const bytes=photo.file?await photo.file.arrayBuffer():await (await fetch(photo.url)).arrayBuffer();
    const mime=photo.mime||photo.file?.type||'image/jpeg';
    if(!['image/jpeg','image/png','image/webp','image/heic','image/heif'].includes(mime))throw Error('JPEG, PNG, WebP veya HEIC fotoğraf seç.');
    if(!bytes.byteLength||bytes.byteLength>8*1024*1024)throw Error('Her fotoğraf en fazla 8 MB olabilir.');
    photo.uploadPath??=`${user.id}/${seedId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${mime.split('/')[1]}`;
    const upload=await client.storage.from(PHOTO_BUCKET).upload(photo.uploadPath,bytes,{contentType:mime,upsert:false});
    if(upload.error&&String((upload.error as {statusCode?:string}).statusCode)!=='409')throw upload.error;
    paths.push(photo.uploadPath);
  }
  const saved=await client.rpc('save_my_experience_photos',{p_seed_id:seedId,p_paths:paths,p_expected_paths:expected,p_visibility:visibility});
  if(saved.error)throw saved.error;
  photos.forEach((photo,index)=>{photo.path=paths[index];});
  const removed=expected.filter(path=>!paths.includes(path));
  // A failed object cleanup must not turn an already committed save into a retry.
  if(removed.length)await client.storage.from(PHOTO_BUCKET).remove(removed).catch(()=>undefined);
  return paths;
}
export async function loadExperienceComments(client:SupabaseClient,seedId:string,offset=0){
  const result=await client.rpc('get_seed_experience_comments',{p_seed_id:seedId,p_limit:30,p_offset:offset});
  if(result.error)throw result.error;
  return result.data as ExperienceComment[];
}

/** Compact display only: keep the full name on the profile and detail link. */
export function compactPersonName(name:string):string {
 const [first,...rest]=name.trim().split(/\s+/);
 return [first,...rest.map(part=>`${Array.from(part)[0].toLocaleUpperCase('tr-TR')}.`)].join(' ');
}
export function experienceDate(row:{experience_precision?:unknown;experience_date?:unknown;experience_year?:unknown}):string|null {
 if(row.experience_precision==='unknown')return null;
 if(row.experience_precision==='year')return row.experience_year?String(row.experience_year):null;
 return typeof row.experience_date==='string'?row.experience_date:row.experience_year?String(row.experience_year):null;
}
export function experienceDateLabel(value:string|null):string {
 if(!value)return '';
 if(/^\d{4}$/.test(value))return value;
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return '';
 const date=new Date(value+'T12:00:00');
 return Number.isFinite(date.getTime())?new Intl.DateTimeFormat('tr-TR',{day:'numeric',month:'short',year:'numeric'}).format(date):'';
}
