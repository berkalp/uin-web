export type MovieTrailer = { videoId: string; title: string; url: string; channel: string; language?: string };
type Row = Record<string, any>;
const officialHandles = new Set(['universalpictures', 'warnerbrospictures', 'sonypictures', 'paramountpictures', 'disneystudios', 'lionsgate', 'a24', 'netflix', 'amazonmgmstudios', 'appletv']);
export async function movieTrailers(entity: Row, readJson: (url: string) => Promise<any>): Promise<MovieTrailer[]> {
  const candidates = (entity.claims?.P1651 || []).filter((claim: Row) => claim.rank !== 'deprecated' && /^[A-Za-z0-9_-]{11}$/.test(claim.mainsnak?.datavalue?.value || '') && claim.qualifiers?.P3831?.some((q: Row) => q.datavalue?.value?.id === 'Q622550'));
  candidates.sort((a: Row, b: Row) => Number(!!b.qualifiers?.P407?.some((q: Row) => q.datavalue?.value?.id === 'Q256')) - Number(!!a.qualifiers?.P407?.some((q: Row) => q.datavalue?.value?.id === 'Q256')));
  const results = await Promise.all(candidates.slice(0, 3).map(async (claim: Row): Promise<MovieTrailer | null> => {
    try {
      const videoId = claim.mainsnak.datavalue.value;
      const url = 'https://www.youtube.com/watch?v=' + videoId;
      const info = await readJson('https://www.youtube.com/oembed?format=json&url=' + encodeURIComponent(url));
      const author = new URL(info.author_url);
      const handle = author.pathname.replace(/^\/@/, '').replace(/\/$/, '').toLowerCase();
      if (author.protocol !== 'https:' || author.hostname !== 'www.youtube.com' || !officialHandles.has(handle)) return null;
      const language = claim.qualifiers?.P407?.some((q: Row) => q.datavalue?.value?.id === 'Q256') ? 'Türkçe' : undefined;
      return { videoId, title: String(info.title || 'Resmî fragman'), url, channel: String(info.author_name), language };
    } catch { return null; }
  }));
  return results.filter((r): r is MovieTrailer => r !== null).filter((r, i, all) => all.findIndex(x => x.videoId === r.videoId) === i);
}
