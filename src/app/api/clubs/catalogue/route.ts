import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET() {
  try {
    const db = await createClient();
    const hierarchy = await db.rpc('get_club_hierarchy_v78');
    if (hierarchy.error) throw hierarchy.error;

    const cards: any[] = [];
    const labels = new Map<string, string>();
    const label = (value = '') => {
      const clean = value.trim().replace(/\s+/g, ' ');
      const key = clean.toLocaleLowerCase('tr');
      if (!labels.has(key)) labels.set(key, clean);
      return labels.get(key) || '';
    };

    for (let offset = 0; ; offset += 200) {
      const result = await db.rpc('get_uin_catalogue_v64', {
        p_query: null,
        p_limit: 200,
        p_offset: offset,
        p_target_id: null,
      });
      if (result.error) throw result.error;
      cards.push(...(result.data || []));
      if ((result.data || []).length < 200) break;
    }

    const ids = (hierarchy.data || []).map((row: any) => row.target_id);
    const summary = ids.length
      ? await db.rpc('get_uin_card_summary_v80', { p_target_ids: ids })
      : { data: [], error: null };
    const placements = ids.length
      ? await db.from('seed_catalog_items').select('id,canonical_target_id,status').in('canonical_target_id', ids)
      : { data: [], error: null };
    const styles = ids.length
      ? await db.rpc('get_uin_card_styles_v76', { p_target_ids: ids })
      : { data: [], error: null };
    if (styles.error) throw styles.error;
    if (summary.error || placements.error) throw new Error('Club details failed');

    return NextResponse.json({
      clubs: (hierarchy.data || []).flatMap((row: any) => {
        const card = cards.find((item) => item.canonical_target_id === row.target_id);
        // Root clubs must be active catalogue cards. Child teams remain hidden in
        // the main catalogue, but mobile still needs them for the same hierarchy,
        // filters and team count that the web card uses.
        if (!card && !row.parent_target_id) return [];
        const stats = (summary.data || []).find((item: any) => item.target_id === row.target_id);
        const style = (styles.data || []).find((item: any) => item.target_id === row.target_id);
        const displayName = row.display_name || card?.title || row.title;
        return [{
          ...row,
          displayName,
          cardStyle: style?.card_style || null,
          ownStyle: style?.own_style || null,
          sport: label(row.sport).toLocaleLowerCase('tr').replace(/^./, (value) => value.toLocaleUpperCase('tr')),
          division: label(row.division).toLocaleLowerCase('tr').replace(/^./, (value) => value.toLocaleUpperCase('tr')),
          league: label(row.league),
          title: card?.title || displayName,
          coverUrl: card?.catalog_cover_url || card?.cover_url || row.logo_url || null,
          logoUrl: row.logo_url || null,
          catalogItemId: (placements.data || []).find((item: any) => item.canonical_target_id === row.target_id && item.status === 'active')?.id || (placements.data || []).find((item: any) => item.canonical_target_id === row.target_id)?.id || '',
          wanting: Number(stats?.wanting || 0),
          done: Number(stats?.done || 0),
          active: Number(stats?.active || 0),
        }];
      }),
    });
  } catch {
    return NextResponse.json({ error: 'Kulüp ve takım bilgileri yüklenemedi.' }, { status: 502 });
  }
}
