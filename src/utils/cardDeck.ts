// Signed positions: experienced -2, wanting -1, main 0, active events 1..n.
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
