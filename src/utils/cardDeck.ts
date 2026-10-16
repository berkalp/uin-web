// Left: wanting (-1), then experienced (-2). Right: events (1). Details use stable IDs.
export function deckPosition(position: number, direction: -1 | 1, eventCount: number | null) {
  return Math.max(-2, Math.min(eventCount === null ? 1 : Math.max(1, eventCount), position + direction));
}
export function deckSwipe(dx: number, dy: number): -1 | 0 | 1 {
  return Math.abs(dx) >= 45 && Math.abs(dx) > Math.abs(dy) * 1.5 ? dx < 0 ? -1 : 1 : 0;
}
export function reviewPreview(body: string) {
  const text = body.trim();
  const end = text.search(/[.!?…](?:\s|$)|\n/);
  return end >= 0 ? text.slice(0, end + 1).trim() : text.length > 240 ? `${text.slice(0, 240).trim()}…` : text;
}
export function nearestEvents<T>(events: T[], start: (event: T) => string | null | undefined, id: (event: T) => string) {
  const time = (event: T) => { const value = Date.parse(start(event) || ''); return Number.isFinite(value) ? value : Infinity; };
  return [...events].sort((a, b) => time(a) - time(b) || id(a).localeCompare(id(b)));
}

export function cardDate(start?:string|null,end?:string|null,precision?:string|null,options?:string[]):string {
  if(options?.length)return options.map(value=>cardDate(value)).join(' / ');
  if(!start)return 'Tarih belirtilmemiş';
  if(/^\d{4}$/.test(start)||precision==='year')return start.slice(0,4);
  const parsed=new Date(start.slice(0,10)+'T12:00:00');
  if(!Number.isFinite(parsed.getTime()))return 'Tarih belirtilmemiş';
  const format=(value:string)=>new Intl.DateTimeFormat('tr-TR',{day:'numeric',month:'short',year:'numeric'}).format(new Date(value.slice(0,10)+'T12:00:00'));
  if(precision==='month')return new Intl.DateTimeFormat('tr-TR',{month:'long',year:'numeric'}).format(parsed);
  return end&&end.slice(0,10)!==start.slice(0,10)&&Number.isFinite(Date.parse(end))?format(start)+' – '+format(end):format(start);
}
export function newestReviews<T>(rows:T[],date:(row:T)=>string|null|undefined) {
  const time=(row:T)=>{const value=Date.parse(date(row)||'');return Number.isFinite(value)?value:-Infinity;};
  return [...rows].sort((a,b)=>time(b)-time(a));
}

// Match the card projection: Istanbul calendar days, never infer completion from age.
export function cardEventPhase(states: (string | null | undefined)[], start?: string | null, end?: string | null, now = new Date()): 'active' | 'past' | 'completed' | 'cancelled' {
  const values = states.map(value => (value || '').toLowerCase());
  if (values.some(value => ['cancelled', 'canceled'].includes(value))) return 'cancelled';
  if (values.includes('completed')) return 'completed';
  if (values.some(value => ['expired', 'past'].includes(value))) return 'past';
  const day = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleDateString('sv-SE', {timeZone:'Europe/Istanbul'}) : '';
  const lastDay = day(end || start || '');
  return lastDay && lastDay < now.toLocaleDateString('sv-SE', {timeZone:'Europe/Istanbul'}) ? 'past' : 'active';
}
export function unresolvedCardEvents<T>(rows:T[], id:(row:T)=>string, phase:(row:T)=>string) {
  const seen=new Set<string>();
  return rows.filter(row=>{const key=id(row);if(seen.has(key)||!['active','past'].includes(phase(row)))return false;seen.add(key);return true;});
}
export function selectedCardEvent<T>(rows:T[], selected:string|null, id:(row:T)=>string) {
  const index=selected===null?-1:rows.findIndex(row=>id(row)===selected);
  return {index, event:index<0?undefined:rows[index]};
}
export function adjacentCardEvent<T>(rows:T[], selected:string|null, direction:-1|1, id:(row:T)=>string) {
  const {index}=selectedCardEvent(rows,selected,id);
  return index<0?null:id(rows[Math.max(0,Math.min(rows.length-1,index+direction))]);
}

// Current events first; recent history follows. Keep cancelled history distinct.
export function cardDeckEvents<T>(rows:T[], id:(row:T)=>string, phase:(row:T)=>string, date:(row:T)=>string|null|undefined) {
  const unique=[...new Map(rows.map(row=>[id(row),row])).values()];
  const rank=(row:T)=>phase(row)==='active'?0:1;
  const time=(row:T)=>{const n=Date.parse(date(row)||'');return Number.isFinite(n)?n:null;};
  return unique.sort((a,b)=>{const group=rank(a)-rank(b);if(group)return group;const x=time(a),y=time(b);if(x===null||y===null)return x===y?id(a).localeCompare(id(b)):x===null?1:-1;return (rank(a)===0?x-y:y-x)||id(a).localeCompare(id(b));});
}
export function currentCardEvent<T>(rows:T[], selected:string|null, id:(row:T)=>string) {
  const found=selectedCardEvent(rows,selected,id);
  return found.event?found:{index:rows.length?0:-1,event:rows[0]};
}

type CardEventDisplay = {
  planId?: string | null; ownerId?: string | null; activityId?: string | null;
  title?: string | null; location?: string | null; start?: string | null; end?: string | null;
  visibility?: string | null; dna?: string[]; phase: string;
  participants?: number; viewerIsMember?: boolean; viewerRequest?: string | null; viewerInvitation?: string | null;
};
// A standalone, unjoined intention can repeat an already organised plan on the
// same library card. Prefer the sole matching plan for display only. Keep distinct
// plans, custom titles, missing identities and existing participation untouched.
export function preferPlannedCardEvents<T>(rows:T[], describe:(row:T)=>CardEventDisplay) {
  const entries=rows.map(row=>({row,info:describe(row)}));
  const key=(e:CardEventDisplay)=>e.phase==='active'&&e.ownerId&&e.activityId&&e.start&&e.location&&e.title
    ?JSON.stringify([e.ownerId,e.activityId,e.title,e.start,e.end||e.start,e.location,e.visibility,[...(e.dna||[])].sort()]) : null;
  const plans=new Map<string,number>();
  for(const {info} of entries){const k=key(info);if(info.planId&&k)plans.set(k,(plans.get(k)||0)+1);}
  return entries.filter(({info})=>{
    const k=key(info);
    return info.planId||!k||plans.get(k)!==1||info.participants!==0||info.viewerIsMember||info.viewerRequest||info.viewerInvitation;
  }).map(({row})=>row);
}

// Both the metric and default navigation use this same active collection.
// Historical records remain available separately, including completed events.
export function partitionCardEvents<T>(rows:T[], phase:(row:T)=>string) {
  const active:T[]=[], history:T[]=[];
  for(const row of rows)(phase(row)==='active'?active:history).push(row);
  return {active,history};
}
