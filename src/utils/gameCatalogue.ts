export const GAME_PLATFORMS = [
  {id:'pc',label:'Bilgisayar (PC / Mac / Linux)'},
  {id:'playstation',label:'PlayStation'},
  {id:'xbox',label:'Xbox'},
  {id:'nintendo',label:'Nintendo'},
  {id:'retro',label:'Diğer konsollar'},
] as const;
export const GAME_GENRES = [
  {id:'action',label:'Aksiyon'},{id:'adventure',label:'Macera'},
  {id:'strategy',label:'Strateji'},{id:'rpg',label:'Rol Yapma (RPG)'},
  {id:'sports',label:'Spor'},{id:'racing',label:'Yarış'},
  {id:'simulation',label:'Simülasyon'},{id:'shooter',label:'Nişancı'},
  {id:'puzzle',label:'Bulmaca'},{id:'platform',label:'Platform'},
  {id:'fighting',label:'Dövüş'},{id:'music',label:'Müzik / Ritim'},
  {id:'arcade',label:'Atari / Arcade'},{id:'card',label:'Dijital Kart / Masa Oyunu'},
  {id:'moba',label:'MOBA'},{id:'visual_novel',label:'Görsel Roman'},
] as const;
export const GAME_LISTS = [
  {id:'xbox_most_played',label:'Xbox · En çok oynananlar (ABD)'},
  {id:'steam_most_played',label:'Steam · En çok oynananlar'},
  {id:'tga_2025',label:'The Game Awards 2025 · Ödüllüler'},
] as const;
export type GameListId = typeof GAME_LISTS[number]['id'];
export type GameListEntry = {rank:number;source_url:string;as_of:string;region?:string};
export type GameCatalogue = {platforms:string[];platform_names:string[];genres:string[];lists:Partial<Record<GameListId,GameListEntry>>;awards:{label:string;year:number;source_url:string}[]};
const object=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
const strings=(v:unknown)=>Array.isArray(v)?v.filter((s):s is string=>typeof s==='string'&&Boolean(s.trim())):[];
const unique=(v:string[])=>[...new Set(v)];
export function platformFamily(name:string):string|null{
  if(/android|ios|iphone|ipad|mobile|symbian|windows phone/i.test(name))return 'mobile';
  if(/^(pc|mac|linux|dos|windows|steam)/i.test(name)||/microsoft windows|web browser|browser|amiga|atari st/i.test(name))return 'pc';
  if(/playstation|^ps[1-5pv]|^psp|^vita/i.test(name))return 'playstation';
  if(/xbox/i.test(name))return 'xbox';
  if(/nintendo|^wii|game boy|gamecube|^nes$|^snes$|famicom|^ds$|^3ds$/i.test(name))return 'nintendo';
  if(/sega|dreamcast|saturn|genesis|atari|neo geo|arcade|3do|coleco|odyssey|intellivision|commodore/i.test(name))return 'retro';
  return null;
}
export function genreId(name:string):string|null{
  const n=name.toLowerCase();
  if(/strategy|tactical|strateji|taktik/.test(n))return 'strategy';
  if(/role-playing|role playing|rpg|rol yap/.test(n))return 'rpg';
  if(/adventure|macera|point-and-click/.test(n))return 'adventure';
  if(/shooter|nişancı/.test(n))return 'shooter';
  if(/sport/.test(n))return 'sports';
  if(/racing|yarış/.test(n))return 'racing';
  if(/simulat|simülasyon/.test(n))return 'simulation';
  if(/puzzle|bulmaca|quiz|trivia/.test(n))return 'puzzle';
  if(/platform/.test(n))return 'platform';
  if(/fighting|dövüş/.test(n))return 'fighting';
  if(/music|rhythm|müzik|ritim/.test(n))return 'music';
  if(/card|board game|kart/.test(n))return 'card';
  if(/moba/.test(n))return 'moba';
  if(/visual novel|görsel roman/.test(n))return 'visual_novel';
  if(/arcade/.test(n))return 'arcade';
  if(/action|aksiyon|hack and slash|beat.*up/.test(n))return 'action';
  return null;
}
export function readGameCatalogue(value:unknown):GameCatalogue{
  const outer=object(value),data=object(outer.game_catalog??value);
  const platformNames=strings(data.platform_names).length?strings(data.platform_names):strings(data.platforms);
  const platforms=unique(strings(data.platforms).flatMap(n=>['pc','playstation','xbox','nintendo','retro','mobile'].includes(n)?[n]:platformFamily(n)?[platformFamily(n)!]:[]));
  const genres=unique(strings(data.genres).flatMap(n=>GAME_GENRES.some(g=>g.id===n)?[n]:genreId(n)?[genreId(n)!]:[]));
  const lists:GameCatalogue['lists']={};
  for(const {id} of GAME_LISTS){const v=object(object(data.lists)[id]);const rank=Number(v.rank);if(Number.isInteger(rank)&&rank>0&&rank<=10000&&typeof v.source_url==='string'&&/^https:\/\//.test(v.source_url)&&typeof v.as_of==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v.as_of))lists[id]={rank,source_url:v.source_url,as_of:v.as_of,region:typeof v.region==='string'?v.region:undefined};}
  const awards=Array.isArray(data.awards)?data.awards.flatMap(v=>{const a=object(v);return typeof a.label==='string'&&Number.isInteger(a.year)&&typeof a.source_url==='string'&&/^https:\/\//.test(a.source_url)?[{label:a.label,year:Number(a.year),source_url:a.source_url}]:[]}):[];
  return {platforms,platform_names:unique(platformNames),genres,lists,awards};
}
export function gameMatches(game:GameCatalogue|undefined,platform='',genre='',list?:GameListId|null){
  const mobileOnly=Boolean(game?.platforms.length&&game.platforms.every(id=>id==='mobile'));
  return !mobileOnly&&(!platform||Boolean(game?.platforms.includes(platform)))&&(!genre||Boolean(game?.genres.includes(genre)))&&(!list||Boolean(game?.lists[list]));
}
export function gamePlatformLabels(game:GameCatalogue){return game.platforms.map(id=>id==='pc'?'PC':id==='mobile'?'Mobil':GAME_PLATFORMS.find(p=>p.id===id)?.label||id)}
export function gameGenreLabels(game:GameCatalogue){return game.genres.map(id=>GAME_GENRES.find(g=>g.id===id)?.label||id)}
