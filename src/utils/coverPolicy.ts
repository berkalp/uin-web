// Kept identical in web and mobile; the cross-platform regression test guards parity.
export type CoverContext = { cardType?: string | null; categoryName?: string | null; activityName?: string | null };
export const coverThemes = {
  technology: { label: 'Teknoloji', symbol: '⌘', color: '#164e63', path: 'M6 6h12v9H6z M4 18h16 M10 15v3 M14 15v3' },
  sport: { label: 'Spor', symbol: '⚽', color: '#14532d', path: 'M12 3a9 9 0 1 0 0 18 9 9 0 1 0 0-18 M3 12h18 M12 3v18 M5 5l14 14 M19 5L5 19' },
  art: { label: 'Sanat', symbol: '🎨', color: '#701a75', path: 'M4 4h16v16H4z M7 16l4-5 3 3 3-6 M7 8h1' },
  community: { label: 'Topluluk', symbol: '♧', color: '#064e3b', path: 'M9 8a3 3 0 1 0 6 0 3 3 0 1 0-6 0 M6 21v-3a6 6 0 0 1 12 0v3 M3 11v7 M21 11v7' },
  book: { label: 'Kitap', symbol: '▤', color: '#78350f', path: 'M12 6Q7 3 3 5v14q5-2 9 1 4-3 9-1V5q-4-2-9 1v14' },
  film: { label: 'Film ve dizi', symbol: '▶', color: '#312e81', path: 'M3 5h18v14H3z M9 9l6 3-6 3z M6 5v14 M18 5v14' },
  music: { label: 'Müzik', symbol: '♫', color: '#4c1d95', path: 'M9 17V5l11-2v12 M9 8l11-2 M3 18a3 2 0 1 0 6 0 3 2 0 1 0-6 0 M14 16a3 2 0 1 0 6 0 3 2 0 1 0-6 0' },
  game: { label: 'Oyun', symbol: '✚', color: '#1e3a8a', path: 'M6 7h12l3 12-6-3H9l-6 3z M6 11h6 M9 8v6 M16 11h1 M18 13h1' },
  place: { label: 'Yer', symbol: '⌖', color: '#134e4a', path: 'M12 22S4 14 4 9a8 8 0 1 1 16 0c0 5-8 13-8 13 M9 9a3 3 0 1 0 6 0 3 3 0 1 0-6 0' },
  activity: { label: 'Aktivite', symbol: '◇', color: '#0f172a', path: 'M12 3l9 9-9 9-9-9z M8 12h8 M12 8v8' },
} as const;
export type CoverCategory = keyof typeof coverThemes;
const words: Record<CoverCategory, string[]> = {
  technology: ['technology','tech','software','coding','code','computer','digital','artificial intelligence','ai','learning','education','course','teknoloji','yazilim','kodlama','bilgisayar','yapay zeka','egitim','ogrenme','kurs'],
  sport: ['sport','sports','club','athlete','walking','running','basketball','football','fitness','hiking','cycling','outdoor','spor','kulup','sporcu','yuruyus','kosu','basketbol','futbol','bisiklet','doga yuruyusu'],
  art: ['art','culture','cultural','theatre','theater','museum','exhibition','painting','director','actor','comedian','theatre artist','sanat','kultur','tiyatro','muze','sergi','resim','resim yapmak','yonetmen','oyuncu','komedyen','tiyatrocu'],
  community: ['community','volunteer','volunteering','social','solidarity','charity','support','topluluk','gonullu','gonulluluk','sosyal','dayanisma','yardim'],
  book: ['book','writer','reading','read','kitap','yazar','okuma','oku'],
  film: ['movie','film','series','video','cinema','watch','dizi','sinema','izle'],
  music: ['artist','music','concert','listen','sanatci','muzik','konser','dinle'],
  game: ['game','gaming','play','oyun','oyna'],
  place: ['place','city','country','travel','visit','yer','sehir','ulke','gezi','seyahat','ziyaret'],
  activity: ['activity','hobby','aktivite','etkinlik','hobi'],
};
function normalize(value?: string | null) {
  return (value ?? '').toLowerCase().replace(/ı/g,'i').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
}
function match(value?: string | null): CoverCategory | undefined {
  const text = ` ${normalize(value)} `;
  return (Object.keys(words) as CoverCategory[]).find(category => words[category].some(word => text.includes(` ${word} `)));
}
export function coverCategory(context: CoverContext = {}): CoverCategory {
  // Explicit kind and category outrank free-form titles. Generic kinds may be refined.
  const kind = match(context.cardType), category = match(context.categoryName);
  if (kind && kind !== 'activity') return kind;
  if (category && category !== 'activity') return category;
  return match(context.activityName) ?? category ?? kind ?? 'activity';
}
export function categoryCover(category: CoverCategory): string {
  const theme = coverThemes[category];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 480"><rect width="640" height="480" fill="${theme.color}"/><circle cx="320" cy="210" r="140" fill="white" opacity=".04"/><path d="${theme.path}" transform="translate(224 114) scale(8)" fill="none" stroke="#e2e8f0" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
export function coverSources(primary: string | null | undefined, fallback: string | null | undefined, category: CoverCategory): string[] {
  return [...new Set([primary?.trim(), fallback?.trim(), categoryCover(category)].filter((url): url is string => Boolean(url)))];
}
