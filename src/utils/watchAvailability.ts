export type WatchProvider={name:string;url:string;types:string[]};
export type WatchAvailability={country:'TR';sourceUrl:string;providers:WatchProvider[]};
const names:Record<string,string>={FLATRATE:'Abonelik',FREE:'Ücretsiz',ADS:'Reklamlı',RENT:'Kiralama',BUY:'Satın alma',FLATRATE_AND_BUY:'Abonelik / satın alma'};
function https(value:unknown){try{const u=new URL(String(value));return u.protocol==='https:'&&!u.username&&!u.password?u.href:''}catch{return ''}}
/** Only explicit Turkey offers. The distributor or original broadcast network is not availability. */
export function readWatchAvailability(value:unknown):WatchAvailability|null{
 const meta=value&&typeof value==='object'?value as Record<string,unknown>:{};
 const raw=(meta.watch_availability??meta) as Record<string,unknown>;
 const source=https(raw.sourceUrl);if(raw.country!=='TR'||!source.startsWith('https://www.justwatch.com/tr/'))return null;
 const grouped=new Map<string,WatchProvider>();
 for(const row of Array.isArray(raw.providers)?raw.providers:[]){if(!row||typeof row!=='object')continue;const r=row as Record<string,unknown>,name=typeof r.name==='string'?r.name.trim():'',url=https(r.url);if(!name||!url)continue;
  const types=(Array.isArray(r.types)?r.types:[r.type]).filter((t):t is string=>typeof t==='string'&&Boolean(names[t]));if(!types.length)continue;
  const old=grouped.get(name);if(old)old.types=[...new Set([...old.types,...types])];else grouped.set(name,{name,url,types:[...new Set(types)]});
 }
 const providers=[...grouped.values()].sort((a,b)=>Number(b.types.includes('FLATRATE'))-Number(a.types.includes('FLATRATE'))||a.name.localeCompare(b.name,'tr'));
 return {country:'TR',sourceUrl:source,providers};
}
export const watchProviderTypes=(provider:WatchProvider)=>provider.types.map(t=>names[t]).join(' / ');
