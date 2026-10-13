// Run with @electric-sql/pglite installed, or point PGLITE_MODULE at its module.
// Executes PostgreSQL SQL, using a deliberately small closure/visibility fixture.
// Production EXPLAIN and full-schema parity must still run before migration.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
const {PGlite}=await import(process.env.PGLITE_MODULE||'@electric-sql/pglite');
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const id=n=>`${String(n).padStart(8,'0')}-1111-4111-8111-111111111111`;

test('migration preserves ratings, aliases, hidden descendants and viewer identity',async()=>{
 const db=new PGlite();
 try{
 await db.exec(`
 create role anon;create role authenticated;create schema auth;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.viewer',true),'')::uuid$$;
 create function public.is_admin() returns boolean language sql stable as $$select current_setting('test.admin',true)='true'$$;
 create table seed_catalog_items(id uuid primary key,canonical_target_id uuid,status text,updated_at timestamptz);
 create table seeds(id uuid primary key,canonical_target_id uuid,user_id uuid,status text,catalog_item_id uuid,updated_at timestamptz);
 create table seed_personal_state_v15(seed_id uuid,user_id uuid,relationship_status text,rating numeric);
 create table fixture_closure(root uuid,resolved uuid,target uuid,hidden boolean);
 create function public.get_uin_card_closure_v143(p_target_ids uuid[],p_include_self boolean default true)
 returns table(requested_id uuid,resolved_id uuid,target_id uuid,depth integer)
 language sql stable security definer set search_path=public,pg_temp as $$
 select input.id,c.resolved,c.target,case when c.target=c.resolved then 0 else 1 end
 from unnest(p_target_ids) input(id) join fixture_closure c on c.root=input.id
 where (public.is_admin() or not c.hidden) and (p_include_self or c.target<>c.resolved)$$;
 create function public.get_uin_catalogue_for_targets_v123(p_target_ids uuid[]) returns jsonb language sql stable security definer as $$select jsonb_build_object('viewer',auth.uid(),'admin',public.is_admin())$$;
 create function public.get_uin_card_people_projection_v143(p_target_ids uuid[]) returns jsonb language sql stable security definer as $$select jsonb_build_object('viewer',auth.uid(),'admin',public.is_admin())$$;
 create function public.get_uin_cover_positions_v62(p_target_ids uuid[]) returns jsonb language sql stable security definer as $$select jsonb_build_object('viewer',auth.uid(),'admin',public.is_admin())$$;
 insert into fixture_closure values
 ('${id(1)}','${id(1)}','${id(1)}',false),('${id(1)}','${id(1)}','${id(2)}',false),('${id(1)}','${id(1)}','${id(3)}',true),
 ('${id(4)}','${id(1)}','${id(1)}',false),('${id(4)}','${id(1)}','${id(2)}',false),('${id(4)}','${id(1)}','${id(3)}',true),
 ('${id(2)}','${id(2)}','${id(2)}',false);
 insert into seed_catalog_items values ('${id(50)}','${id(1)}','active',now()),('${id(51)}','${id(2)}','rejected',now());
 insert into seeds values
 ('${id(10)}','${id(1)}','${id(20)}','completed','${id(50)}','2026-10-01'),
 ('${id(11)}','${id(2)}','${id(20)}','completed',null,'2026-10-02'),
 ('${id(12)}','${id(2)}','${id(21)}','active',null,'2026-10-02'),
 ('${id(13)}','${id(3)}','${id(22)}','completed',null,'2026-10-02'),
 ('${id(14)}','${id(2)}','${id(23)}','completed','${id(51)}','2026-10-02');
 insert into seed_personal_state_v15 values
 ('${id(10)}','${id(20)}','completed',4),('${id(11)}','${id(20)}','completed',8),
 ('${id(12)}','${id(21)}','completed',6),('${id(13)}','${id(22)}','completed',10),('${id(14)}','${id(23)}','completed',1);
 `);
 const original=read('supabase/migrations/20261012140000_catalogue_ratings_friends_v175.sql').match(/create or replace function public\.get_uin_card_ratings_v85[\s\S]*?\$fn\$;/i)[0];
 await db.exec(original+`revoke all on function public.get_uin_card_ratings_v85(uuid[]) from public;grant execute on function public.get_uin_card_ratings_v85(uuid[]) to anon,authenticated;`);
 const groups=[[],[id(1)],[id(4)],[id(1),id(2),id(4),id(1),id(99),null]];
 const cases=[['',false],[id(20),false],[id(22),true]];
 const query=ids=>`select coalesce(jsonb_agg(value order by value->>'target_id'),'[]'::jsonb) result from public.get_uin_card_ratings_v85(array[${ids.map(x=>x===null?'null':"'"+x+"'").join(',')}]::uuid[]) value`;
 const snapshot=async()=>{
  const rows=[];
  for(const [viewer,admin] of cases){
   await db.query(`select set_config('test.viewer',$1,false),set_config('test.admin',$2,false)`,[viewer,String(admin)]);
   for(const ids of groups)rows.push((await db.query(query(ids))).rows[0].result);
   rows.push((await db.query(`select get_uin_catalogue_for_targets_v123('{}'),get_uin_card_people_projection_v143('{}'),get_uin_cover_positions_v62('{}')`)).rows);
  }
  return rows;
 };
 const before=await snapshot();
 const acl=(await db.query(`select proacl::text from pg_proc where oid='public.get_uin_card_ratings_v85(uuid[])'::regprocedure`)).rows;
 await db.exec(read('supabase/migrations/20261012190000_card_read_budget_v178.sql'));
 assert.deepEqual(await snapshot(),before);
 assert.deepEqual((await db.query(`select proacl::text from pg_proc where oid='public.get_uin_card_ratings_v85(uuid[])'::regprocedure`)).rows,acl);
 assert.equal(before[1][0].rating_count,2);assert.equal(before[1][0].average_rating,7);
 assert.equal(before[11][0].rating_count,3);assert.equal(before[11][0].average_rating,8);
 }finally{await db.close()}
});
