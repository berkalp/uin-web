export const GAME_PLATFORMS = [
  {id:'pc',label:'Bilgisayar (PC / Mac / Linux)'},
  {id:'playstation',label:'PlayStation'},
  {id:'xbox',label:'Xbox'},
  {id:'nintendo',label:'Nintendo'},
  {id:'arcade',label:'Arcade / Atari Salonu'},
  {id:'atari',label:'Atari (ev konsolları)'},
  {id:'retro',label:'Retro Konsollar'},
] as const;
export const GAME_GENRES = [
  {id:'action',label:'Aksiyon'},{id:'adventure',label:'Macera'},
  {id:'strategy',label:'Strateji'},{id:'rpg',label:'Rol Yapma (RPG)'},
  {id:'sports',label:'Spor'},{id:'racing',label:'Yarış'},
  {id:'simulation',label:'Simülasyon'},{id:'shooter',label:'Nişancı'},
  {id:'puzzle',label:'Bulmaca'},{id:'platform',label:'Platform'},
  {id:'fighting',label:'Dövüş'},{id:'music',label:'Müzik / Ritim'},
  {id:'arcade',label:'Arcade tarzı'},{id:'card',label:'Dijital Kart / Masa Oyunu'},
  {id:'moba',label:'MOBA'},{id:'visual_novel',label:'Görsel Roman'},
] as const;
export const TABLETOP_TYPES = [
  {id:'tabletop_rpg',label:'Masaüstü Rol Yapma'}, {id:'fantasy',label:'Fantastik Macera'},
  {id:'strategy',label:'Strateji'}, {id:'cooperative',label:'İş Birliği'},
  {id:'party',label:'Parti / Aile'}, {id:'abstract',label:'Soyut / Klasik'},
  {id:'cards',label:'Kart Oyunu'}, {id:'mystery',label:'Gizem / Dedektiflik'},
] as const;
export type GameListId = 'xbox_most_played'|'steam_most_played'|`tga_${number}`|'bgg_top10'|'spiel'|'kennerspiel'|'ennie';
export const GAME_LISTS:{id:GameListId;label:string;group:'video'|'tabletop';kind:'ranking'|'award'}[] = [
  {id:'xbox_most_played',label:'Xbox · En çok oynananlar (ABD)',group:'video',kind:'ranking'},
  {id:'steam_most_played',label:'Steam · En çok oynananlar',group:'video',kind:'ranking'},
  ...Array.from({length:10},(_,i)=>({id:`tga_${2025-i}` as GameListId,label:`The Game Awards ${2025-i} · Ödüllüler`,group:'video' as const,kind:'award' as const})),
  {id:'bgg_top10',label:'BoardGameGeek · İlk 10',group:'tabletop',kind:'ranking'},
  {id:'spiel',label:'Spiel des Jahres · Yılın Oyunları',group:'tabletop',kind:'award'},
  {id:'kennerspiel',label:'Kennerspiel · Uzman Oyuncu Ödülleri',group:'tabletop',kind:'award'},
  {id:'ennie',label:'ENNIE · Rol Yapma Ödülleri',group:'tabletop',kind:'award'},
];
export type GameListEntry = {rank:number;source_url:string;as_of:string;region?:string;note?:string};
export type GameCatalogue = {platforms:string[];platform_names:string[];genres:string[];tabletop_types?:string[];lists:Partial<Record<GameListId,GameListEntry>>;awards:{label:string;year:number;source_url:string}[]};
const object=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
const strings=(v:unknown)=>Array.isArray(v)?v.filter((s):s is string=>typeof s==='string'&&Boolean(s.trim())):[];
const unique=(v:string[])=>[...new Set(v)];
export function platformFamily(name:string):string|null{
  if(/android|ios|iphone|ipad|mobile|symbian|windows phone/i.test(name))return 'mobile';
  if(/arcade|coin.op/i.test(name))return 'arcade';
  if(/^(pc|mac|linux|dos|windows|steam)/i.test(name)||/microsoft windows|web browser|browser|amiga|atari st/i.test(name))return 'pc';
  if(/playstation|^ps[1-5pv]|^psp|^vita/i.test(name))return 'playstation';
  if(/xbox/i.test(name))return 'xbox';
  if(/nintendo|^wii|game boy|gamecube|^nes$|^snes$|famicom|^ds$|^3ds$/i.test(name))return 'nintendo';
  if(/atari/i.test(name))return 'atari';
  if(/sega|dreamcast|saturn|genesis|neo geo|3do|coleco|odyssey|intellivision|commodore/i.test(name))return 'retro';
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
  const platforms=unique([...strings(data.platforms).flatMap(n=>['pc','playstation','xbox','nintendo','retro','mobile','arcade','atari'].includes(n)?[n]:platformFamily(n)?[platformFamily(n)!]:[]),...platformNames.flatMap(n=>platformFamily(n)?[platformFamily(n)!]:[])]);
  if(platformNames.some(n=>/atari (2600|5200|7800|jaguar|lynx)|sega|dreamcast|saturn|genesis|neo geo|game boy|gamecube|super nintendo|nintendo (64|entertainment)|^(nes|snes|famicom|playstation|playstation 2)$/i.test(n))&&!platforms.includes('retro'))platforms.push('retro');
  const genres=unique(strings(data.genres).flatMap(n=>GAME_GENRES.some(g=>g.id===n)?[n]:genreId(n)?[genreId(n)!]:[]));
  const lists:GameCatalogue['lists']={};
  for(const {id} of GAME_LISTS){const v=object(object(data.lists)[id]);const rank=Number(v.rank);if(Number.isInteger(rank)&&rank>0&&rank<=10000&&typeof v.source_url==='string'&&/^https:\/\//.test(v.source_url)&&typeof v.as_of==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v.as_of))lists[id]={rank,source_url:v.source_url,as_of:v.as_of,region:typeof v.region==='string'?v.region:undefined,note:typeof v.note==='string'?v.note:undefined};}
  const awards=Array.isArray(data.awards)?data.awards.flatMap(v=>{const a=object(v);return typeof a.label==='string'&&Number.isInteger(a.year)&&typeof a.source_url==='string'&&/^https:\/\//.test(a.source_url)?[{label:a.label,year:Number(a.year),source_url:a.source_url}]:[]}):[];
  return {platforms,platform_names:unique(platformNames),genres,tabletop_types:unique(strings(data.tabletop_types).filter(id=>TABLETOP_TYPES.some(t=>t.id===id))),lists,awards};
}
export function tabletopMatches(game:GameCatalogue|undefined,type='',list?:GameListId|null){return (!type||Boolean(game?.tabletop_types?.includes(type)))&&(!list||Boolean(game?.lists[list]))}
export function tabletopLabels(game:GameCatalogue){return (game.tabletop_types||[]).map(id=>TABLETOP_TYPES.find(t=>t.id===id)?.label||id)}
export function gameHonours(game:GameCatalogue){
  const awards=[...game.awards].sort((a,b)=>b.year-a.year||Number(/Yılın Oyunu|En İyi Oyun$/.test(b.label))-Number(/Yılın Oyunu|En İyi Oyun$/.test(a.label))||a.label.localeCompare(b.label,'tr')).map(a=>({label:`🏆 ${a.year} · ${a.label}`,url:a.source_url,note:'Ödül kazananı'}));
  const ranks=GAME_LISTS.filter(l=>l.kind==='ranking'&&game.lists[l.id]).map(l=>{const v=game.lists[l.id]!;return {label:`${l.id==='bgg_top10'?'BGG':l.id==='xbox_most_played'?'Xbox':'Steam'} #${v.rank}`,url:v.source_url,note:`Kaynak kontrolü: ${v.as_of.split('-').reverse().join('.')} · ${v.region||''} ${v.note||'Anlık sıralama değildir.'}`.trim()}});
  // Keep both an award and a ranking in the compact card preview when available.
  return [...awards.slice(0,1),...ranks,...awards.slice(1)];
}
export function gameMatches(game:GameCatalogue|undefined,platform='',genre='',list?:GameListId|null){
  const mobileOnly=Boolean(game?.platforms.length&&game.platforms.every(id=>id==='mobile'));
  return !mobileOnly&&(!platform||Boolean(game?.platforms.includes(platform)))&&(!genre||Boolean(game?.genres.includes(genre)))&&(!list||Boolean(game?.lists[list]));
}
export function gamePlatformLabels(game:GameCatalogue){return game.platforms.map(id=>id==='pc'?'PC':id==='mobile'?'Mobil':GAME_PLATFORMS.find(p=>p.id===id)?.label||id)}
export function gameGenreLabels(game:GameCatalogue){return game.genres.map(id=>GAME_GENRES.find(g=>g.id===id)?.label||id)}
