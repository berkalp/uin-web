import {readCardHonours} from "./cardHonours";
import type {Catalogue} from '@/components/cards/LibraryTopicCard';

type Row = Record<string, unknown>;
type Client = {rpc(name: string, args: {p_target_ids: string[]}): PromiseLike<{data: unknown; error: unknown}>};
type MetadataReader = (ids: string[]) => PromiseLike<{data: unknown; error: unknown}>;
const countFields = ['intent_people_count', 'experience_people_count', 'active_event_count', 'rating_count', 'follower_count', 'related_count'];
function rows(value: unknown): Row[] {
  if (!Array.isArray(value) || value.some(row => !row || typeof row !== 'object' || Array.isArray(row))) throw Error('Bağlı kartlar doğrulanamadı.');
  return value;
}
function index(values: Row[], key: string, ids: string[]) {
  const result = new Map<string, Row>();
  for (const row of values) {
    const id = row[key];
    if (typeof id !== 'string' || !ids.includes(id) || result.has(id)) throw Error('Bağlı kart kimlikleri doğrulanamadı.');
    result.set(id, row);
  }
  if (result.size !== ids.length) throw Error('Bazı bağlı kartlar yüklenemedi.');
  return result;
}
export async function loadLinkedLibraryCards(client: Client, requested: string[], readMetadata: MetadataReader): Promise<Catalogue[]> {
  const ids = [...new Set(requested)], result: Catalogue[] = [];
  for (let offset = 0; offset < ids.length; offset += 100) {
    const batch = ids.slice(offset, offset + 100);
    const replies = await Promise.all([
      client.rpc('get_uin_catalogue_for_targets_v123', {p_target_ids: batch}),
      client.rpc('get_uin_card_ratings_v85', {p_target_ids: batch}),
      client.rpc('get_uin_card_social_v87', {p_target_ids: batch}),
      client.rpc('get_uin_card_content_types_v177', {p_target_ids: batch}),
      readMetadata(batch),
    ]);
    if (replies.some(reply => reply.error)) throw Error('Bağlı kartlar yüklenemedi.');
    const cards = index(rows(replies[0].data), 'canonical_target_id', batch);
    const ratings = index(rows(replies[1].data), 'target_id', batch);
    const social = index(rows(replies[2].data), 'target_id', batch);
    const categories=index(rows(replies[3].data),'target_id',batch);
    for (const id of batch) {
      const card: Row = {...cards.get(id), ...ratings.get(id), ...social.get(id),...categories.get(id),card_honours:readCardHonours(rows(replies[4].data).find(row=>row.canonical_target_id===id)?.metadata)};
      if (typeof card.title !== 'string' || !card.title.trim() || countFields.some(key => card[key] == null || card[key] === '' || !Number.isSafeInteger(Number(card[key])) || Number(card[key]) < 0)) throw Error('Bazı kart bilgileri doğrulanamadı.');
      if (Number(card.rating_count) > 0 && (card.average_rating == null || !Number.isFinite(Number(card.average_rating)) || Number(card.average_rating) < 0 || Number(card.average_rating) > 10)) throw Error('Kart puanı doğrulanamadı.');
      result.push(card as Catalogue);
    }
  }
  return result;
}
