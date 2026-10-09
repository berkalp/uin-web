import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const migration = readFileSync(
  new URL('../supabase/migrations/202610090002_batch_event_presentations_v150.sql', import.meta.url),
  'utf8',
);

test('event presentations are fetched through one bounded batch function', () => {
  assert.match(migration, /get_uin_event_presentations_v150\(p_resource_ids uuid\[\]\)/);
  assert.match(migration, /unnest\(coalesce\(p_resource_ids,array\[\]::uuid\[\]\)\)/);
  assert.match(migration, /group by input\.resource_id/);
  assert.match(migration, /limit 100/);
  assert.match(migration, /projected as materialized/);
  assert.match(migration, /get_uin_event_presentation_v86\(requested\.resource_id\)/);
});

test('batch projection preserves v86 visibility and omits unavailable resources', () => {
  assert.match(migration, /where projected\.presentation is not null/);
  assert.match(migration, /security definer/);
  assert.match(migration, /grant execute on function public\.get_uin_event_presentations_v150\(uuid\[\]\) to anon,authenticated/);
});
