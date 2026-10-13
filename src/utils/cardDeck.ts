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
