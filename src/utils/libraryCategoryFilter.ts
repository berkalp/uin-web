import type { SupabaseClient } from '@supabase/supabase-js';

export type LibraryCategoryIndex = { targets: Record<string, string[]>; events: Record<string, string[]> };
export const ALL_LIBRARY_CATEGORIES = '';

export function matchesLibraryCategory(category: string, ids: readonly (string | null | undefined)[], index: Record<string, string[]>) {
  return !category || ids.some(id => id && index[id]?.includes(category));
}

// Read only category membership, never full cards, social counts or images.
// The presentation RPC enforces visibility of the event and its DNA sources.
export async function readLibraryCategoryIndex(client: SupabaseClient, targetIds: string[], eventIds: string[], signal: AbortSignal): Promise<LibraryCategoryIndex> {
  const targets = new Set(targetIds.filter(Boolean));
  const eventTargets: Record<string, string[]> = {};
  const resources = [...new Set(eventIds.filter(Boolean))];
  for (let offset = 0; offset < resources.length; offset += 100) {
    const response = await client.rpc('get_uin_event_presentations_v150', { p_resource_ids: resources.slice(offset, offset + 100) }).abortSignal(signal);
    if (response.error || !Array.isArray(response.data)) throw new Error('Etkinlik kategorileri yüklenemedi.');
    for (const row of response.data) {
      if (typeof row.resource_id !== 'string') throw new Error('Etkinlik kategorileri doğrulanamadı.');
      const presentation = row.presentation;
      const ids = [presentation?.mainTarget?.targetId, presentation?.primaryDna?.targetId,
        ...(Array.isArray(presentation?.dnaCards) ? presentation.dnaCards.map((card: { targetId?: unknown }) => card.targetId) : [])]
        .filter((id): id is string => typeof id === 'string' && Boolean(id));
      eventTargets[row.resource_id] = [...new Set(ids)];
      ids.forEach(id => targets.add(id));
    }
    if (resources.slice(offset, offset + 100).some(id => !(id in eventTargets))) throw new Error('Bazı etkinlik kategorileri henüz yüklenemedi.');
  }
  const index: LibraryCategoryIndex = { targets: {}, events: {} };
  const ids = [...targets];
  for (let offset = 0; offset < ids.length; offset += 500) {
    const response = await client.rpc('get_uin_card_content_types_v177', { p_target_ids: ids.slice(offset, offset + 500) }).abortSignal(signal);
    if (response.error || !Array.isArray(response.data)) throw new Error('Kart kategorileri yüklenemedi.');
    for (const row of response.data) {
      if (typeof row.target_id !== 'string' || !Array.isArray(row.content_type_ids) || row.content_type_ids.some((id: unknown) => typeof id !== 'string')) throw new Error('Kart kategorileri doğrulanamadı.');
      index.targets[row.target_id] = row.content_type_ids;
    }
  }
  for (const [id, targetIds] of Object.entries(eventTargets)) {
    index.events[id] = [...new Set(targetIds.flatMap(target => index.targets[target] ?? []))];
  }
  return index;
}
