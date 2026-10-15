export type LatestLibraryCursor={time:string;id:string};
export function decodeLatestLibraryCursor(raw:string|null):LatestLibraryCursor|null {
  if(raw===null)return null;
  if(raw.length>400)throw new Error('Geçersiz sayfa.');
  let value:LatestLibraryCursor;
  try { value=JSON.parse(Buffer.from(raw,'base64url').toString('utf8')); }
  catch { throw new Error('Geçersiz sayfa.'); }
  if(!value||typeof value.time!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,6})?(?:Z|[+-]\d\d:\d\d)$/.test(value.time)||!Number.isFinite(Date.parse(value.time))||typeof value.id!=='string'||!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value.id))throw new Error('Geçersiz sayfa.');
  return value;
}
export function encodeLatestLibraryCursor(time:string,id:string){
  return Buffer.from(JSON.stringify({time,id})).toString('base64url');
}
