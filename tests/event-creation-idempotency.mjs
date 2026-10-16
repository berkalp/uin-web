import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const migration = fs.readFileSync('supabase/migrations/20261016100956_prevent_duplicate_card_events.sql', 'utf8');
const u = '10000000-0000-4000-8000-000000000001';
const other = '10000000-0000-4000-8000-000000000002';
const t = '20000000-0000-4000-8000-000000000001';
const alias = '20000000-0000-4000-8000-000000000002';
const activity = '30000000-0000-4000-8000-000000000001';
const location = '40000000-0000-4000-8000-000000000001';
async function setup() {
 const db = new PGlite();
 await db.exec(`
 create role anon; create role authenticated; create schema auth;
 create table auth.users(id uuid primary key);
 insert into auth.users values ('${u}'),('${other}');
 create function auth.uid() returns uuid language sql stable as $$
 select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 create table canonical_targets(id uuid primary key, editorial_metadata jsonb default '{}', title text, alias_of uuid);
 insert into canonical_targets(id,alias_of) values ('${t}',null),('${alias}','${t}');
 create function resolve_uin_card_target_v129(p_target_id uuid) returns uuid language sql stable as $$
 select coalesce((select alias_of from canonical_targets where id=p_target_id),p_target_id) $$;
 create table intents(id uuid primary key default gen_random_uuid(),user_id uuid,canonical_target_id uuid,activity_id uuid,sport_id uuid,location_id uuid,
 start_date date,end_date date,status text default 'active',budget numeric,uin_main_card_explicit boolean default false,created_at timestamptz default now());
 create table plans(id uuid primary key default gen_random_uuid(),status text,created_at timestamptz default now());
 create table plan_intents(intent_id uuid,plan_id uuid,relationship text,status text);
 create table uin_event_related_cards_v72(intent_id uuid,target_id uuid);
 create function create_my_intent_with_communities_eligibility_and_join_settings(
 p_start_date date,p_end_date date,p_people text,p_location_id uuid,p_activity_id uuid,p_sport_id uuid,p_budget numeric,p_recurrence text,p_visibility text,p_notes text,p_intent_type text,p_max_participants integer,p_community_ids uuid[],p_participant_eligibility text,p_join_message_mode text,p_join_message_prompt text,p_professional_requirement text,p_professional_role_id uuid)
 returns uuid language plpgsql as $$
 declare v_id uuid;
 begin
 insert into intents(user_id,start_date,end_date,location_id,activity_id,sport_id,budget)
 values(auth.uid(),p_start_date,p_end_date,p_location_id,p_activity_id,p_sport_id,p_budget) returning id into v_id;
 return v_id;end $$;
 create function attach_my_social_intent_to_common_target_v38(p_intent_id uuid,p_target_id uuid,p_subtitle text) returns uuid language plpgsql as $$
 begin update intents set canonical_target_id=p_target_id,uin_main_card_explicit=true where id=p_intent_id;return p_intent_id;end $$;
 `);
 await db.exec(migration);
 await db.query("select set_config('request.jwt.claim.sub',$1,false)", [u]);
 return db;
}
const details = (key, extra = {}) => ({
 p_creation_request_id: key, p_activity_id: activity, p_location_id: location,
 p_start_date: '2026-10-26', p_end_date: '2026-10-27', p_budget: 2000,
 p_community_ids: [], ...extra,
});
async function create(db, key, extra = {}, target=t) {
 return (await db.query('select create_my_card_event_v72($1::uuid,$2::jsonb,$3::uuid[]) id', [target,JSON.stringify(details(key,extra)),[]])).rows[0].id;
}
const count = async db => (await db.query('select count(*)::int n from intents')).rows[0].n;
test('retry reuses the committed result, changed request payload fails, new requests cannot duplicate it', async () => {
 const db=await setup();
 try {
  const id=await create(db,'request-a');
  assert.equal(await create(db,'request-a'),id);
  await assert.rejects(create(db,'request-a',{p_budget:10}), e=>e.code==='22023');
  await assert.rejects(create(db,'request-b',{p_budget:null,p_people:'anyone',p_recurrence:'one-time'}), e=>{
   assert.equal(e.code,'23505'); assert.equal(JSON.parse(e.detail).intent_id,id); return true;
  });
  assert.equal(await count(db),1);
  assert.equal((await db.query('select budget from intents where id=$1',[id])).rows[0].budget,'2000');
  assert.equal((await db.query('select count(*)::int n from card_event_creation_receipts')).rows[0].n,1);
 } finally { await db.close(); }
});
test('aliases and older clients without request keys cannot create duplicates; separate owners and dates can', async () => {
 const db=await setup();
 try {
  await create(db,'first');
  await assert.rejects(create(db,undefined,{},alias),e=>e.code==='23505');
  await create(db,'different-date',{p_start_date:'2026-10-28',p_end_date:'2026-10-29'});
  await create(db,'different-kind',{p_activity_id:'30000000-0000-4000-8000-000000000002'});
  await create(db,'different-place',{p_location_id:'40000000-0000-4000-8000-000000000002'});
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[other]);
  await create(db,'first');
  assert.equal(await count(db),5);
 } finally { await db.close(); }
});
test('host plan is reported; cancelled/completed history does not block a new event', async () => {
 const db=await setup();
 try {
  const id=await create(db,'first');
  const plan=(await db.query("insert into plans(status) values ('forming') returning id")).rows[0].id;
  await db.query("insert into plan_intents values ($1,$2,'host_source','active')",[id,plan]);
  await assert.rejects(create(db,'second'),e=>JSON.parse(e.detail).plan_id===plan);
  await db.query("update plans set status='cancelled' where id=$1",[plan]);
  const second=await create(db,'second');
  await db.query("update intents set status='completed' where id=$1",[second]);
  await create(db,'third');
  assert.equal(await count(db),3);
 } finally { await db.close(); }
});
test('direct insertion followed by DNA attachment is rejected at commit and leaves no orphan', async () => {
 const db=await setup();
 try {
  await create(db,'first');
  await db.exec('begin');
  await db.query(`insert into intents(user_id,activity_id,location_id,start_date,end_date)
   values ($1,$2,$3,'2026-10-26','2026-10-27')`,[u,activity,location]);
  await db.query('update intents set canonical_target_id=$1,uin_main_card_explicit=true where canonical_target_id is null',[t]);
  await assert.rejects(db.exec('commit'),e=>e.code==='23505');
  await db.exec('rollback');
  assert.equal(await count(db),1);
 } finally { await db.close(); }
});
test('receipt and internal helpers are unavailable to clients; anonymous creation fails', async () => {
 const db=await setup();
 try {
  const privileges=(await db.query(`select
   has_table_privilege('authenticated','card_event_creation_receipts','select') can_read,
   has_function_privilege('authenticated','begin_card_event_creation(uuid,jsonb,uuid[])','execute') can_call,
   has_function_privilege('anon','create_my_card_event_v72(uuid,jsonb,uuid[])','execute') anon_create`)).rows[0];
  assert.deepEqual(privileges,{can_read:false,can_call:false,anon_create:false});
  await db.query("select set_config('request.jwt.claim.sub','',false)");
  await assert.rejects(create(db,'anonymous'));
  assert.equal(await count(db),0);
 } finally { await db.close(); }
});
