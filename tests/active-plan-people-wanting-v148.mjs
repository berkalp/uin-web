import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const migration = readFileSync(
  new URL('../supabase/migrations/202610090001_active_plan_people_are_wanting_v148.sql', import.meta.url),
  'utf8',
);
const canonicalReadModel = readFileSync(
  new URL('../supabase/migrations/202610080012_canonical_card_read_model_v143.sql', import.meta.url),
  'utf8',
);

function functionBody(source, name) {
  const start = source.indexOf(`create or replace function public.${name}`);
  assert.notEqual(start, -1, `${name} must exist`);
  const bodyStart = source.indexOf('as $function$', start);
  const end = source.indexOf('$function$;', bodyStart + 1);
  assert.notEqual(bodyStart, -1, `${name} body must start`);
  assert.notEqual(end, -1, `${name} body must end`);
  return source.slice(bodyStart, end);
}

const projection = functionBody(migration, 'get_uin_card_people_projection_v143');
const summary = functionBody(canonicalReadModel, 'get_uin_card_summary_v143');
const events = functionBody(canonicalReadModel, 'get_uin_card_event_projection_v143');

test('the fix stays target-bounded instead of rescanning the complete social graph', () => {
  assert.doesNotMatch(projection, /visible_common_target_people_v38/);
  assert.match(projection, /from public\.visible_canonical_seeds_v31\(\) visible/);
  assert.match(projection, /from public\.canonical_personal_intents_v38 personal/);
  assert.match(projection, /active_events as materialized/);
});
test('active canonical events contribute their owner and active members as current wanting people', () => {
  assert.match(projection, /from public\.get_uin_card_event_projection_v143\([\s\S]*?where event\.event_state='active'/);
  assert.match(projection, /intent\.user_id,'social'::text source_kind,event\.intent_id source_id/);
  assert.match(projection, /join public\.intent_participants participant[\s\S]*?participant\.status='active'/);
  assert.match(projection, /join public\.plans plan on plan\.id=event\.plan_id[\s\S]*?plan\.host_user_id is not null/);
  assert.match(projection, /join public\.plan_members member[\s\S]*?member\.status='active'[\s\S]*?where event\.plan_id is not null/);
});

test('plan-backed events use current plan membership rather than stale intent participants', () => {
  const participantBranch = projection.slice(
    projection.indexOf('join public.intent_participants participant'),
    projection.indexOf('union all', projection.indexOf('join public.intent_participants participant')),
  );
  assert.match(participantBranch, /participant\.status='active'/);
  assert.match(participantBranch, /where event\.plan_id is null/);
});
test('a transferred or departed legacy intent owner is not counted for a plan-backed event', () => {
  const ownerBranch = projection.slice(
    projection.indexOf("intent.user_id,'social'::text source_kind"),
    projection.indexOf('union all', projection.indexOf("intent.user_id,'social'::text source_kind")),
  );
  assert.match(ownerBranch, /where event\.plan_id is null/);
  assert.doesNotMatch(ownerBranch, /plan_members/);
  assert.match(projection, /plan\.host_user_id,'social'::text/);
  assert.match(projection, /member\.user_id,'social'::text/);
});
test('completed, cancelled and expired social events cannot become wanting or experiences', () => {
  assert.match(events, /when coalesce\(intent\.status,''\) in\('cancelled','canceled'\)[\s\S]*?then 'cancelled'/);
  assert.match(events, /when coalesce\(intent\.status,''\)='completed' or coalesce\(plan\.status,''\)='completed' then 'completed'/);
  assert.match(events, /<\(now\(\) at time zone 'Europe\/Istanbul'\)::date then 'expired'/);
  assert.match(projection, /active_events as materialized \([\s\S]*?where event\.event_state='active'/);
  assert.match(projection, /social_candidates as materialized \([\s\S]*?'want'::text relationship_status/);
  assert.doesNotMatch(projection, /'social'::text[^;]*?'completed'::text/);
});

test('seed and personal experience semantics remain independent while duplicate relationships collapse', () => {
  assert.match(projection, /visible\.relationship_status='completed'/);
  assert.match(projection, /personal\.status in\('active','completed'\)/);
  assert.match(projection, /partition by candidates\.requested_id,candidates\.source_target_id,[\s\S]*?candidates\.user_id,candidates\.relationship_status/);
  assert.match(projection, /case candidates\.source_kind when 'seed' then 0 when 'personal' then 1 else 2 end/);
  assert.match(summary, /count\(distinct people\.user_id\) filter\(where people\.relationship_status='want'\)::integer wanting/);
  assert.match(summary, /count\(distinct people\.user_id\) filter\(where people\.relationship_status='completed'\)::integer done/);
});
