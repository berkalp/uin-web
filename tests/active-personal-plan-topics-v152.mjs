import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const migration = readFileSync(
  new URL('../supabase/migrations/202610090004_active_personal_plan_topics_v152.sql', import.meta.url),
  'utf8',
);

test('planned scope is derived from the canonical active event projection', () => {
  assert.match(migration, /get_my_uin_active_plan_topics_v152/);
  assert.match(migration, /get_uin_card_event_projection_v143\(requested\.target_ids\)/);
  assert.match(migration, /where event\.event_state='active'/);
  assert.match(migration, /sources\.resource_id in\(events\.intent_id,events\.plan_id\)/);
  assert.match(migration, /plan\.status in\('forming','planned'\)/);
});

test('planned scope resolves card aliases before comparing event identities', () => {
  assert.match(migration, /resolve_uin_card_target_v129\(sources\.target_id\)/);
  assert.match(migration, /events\.requested_id=sources\.resolved_target_id/);
});
