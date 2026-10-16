import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import {PGlite} from '@electric-sql/pglite';
const source=fs.readFileSync('src/utils/personalExperiences.ts','utf8');
const module={exports:{}};
new Function('module','exports',ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(module,module.exports);
const {orderExperienceReviews,saveExperiencePhotos}=module.exports;
test('own review stays pinned for both sorts; updated date, likes and stable ID break ties without mutating input',()=>{
 const reviews=[{id:'old',isViewer:false},{id:'mine',isViewer:true},{id:'new',isViewer:false}];
 const extra={old:{updatedAt:'2026-01-01',likeCount:9},mine:{updatedAt:'2020-01-01',likeCount:0},new:{updatedAt:'2026-10-16',likeCount:2}};
 assert.deepEqual(orderExperienceReviews(reviews,extra,'recent').map(r=>r.id),['mine','new','old']);
 assert.deepEqual(orderExperienceReviews(reviews,extra,'liked').map(r=>r.id),['mine','old','new']);
 extra.new.likeCount=9;assert.equal(orderExperienceReviews(reviews,extra,'liked')[1].id,'new');
 assert.equal(reviews[0].id,'old');assert.deepEqual(orderExperienceReviews([],{},'recent'),[]);
});
const owner='10000000-0000-4000-8000-000000000001',other='10000000-0000-4000-8000-000000000002',seed='20000000-0000-4000-8000-000000000001';
test('photo ownership, optimistic concurrency, hidden notes, rating-only visibility and idempotent likes',async()=>{
 const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create schema auth;create schema storage;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create table profiles(id uuid primary key);insert into profiles values('${owner}'),('${other}');
 create table seeds(id uuid primary key,user_id uuid,status text,visibility text,updated_at timestamptz default now());
 insert into seeds(id,user_id,status,visibility) values('${seed}','${owner}','completed','everyone');
 create table seed_personal_state_v15(seed_id uuid,updated_at timestamptz);
 create table seed_journal_entries(seed_id uuid,entry_kind text,visibility text,updated_at timestamptz);
 create table seed_experience_comments(seed_id uuid,deleted_at timestamptz);
 create function seed_is_visible_to_viewer(uuid,text,uuid) returns boolean language sql as $$select $1=$3 or $2='everyone'$$;
 create function can_comment_on_seed_experience(uuid,uuid) returns boolean language sql as $$select true$$;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(bucket_id text,name text);alter table storage.objects enable row level security;
 create function storage.foldername(text) returns text[] language sql as $$select string_to_array($1,'/')$$;
 `);
 await db.exec(fs.readFileSync('supabase/migrations/20261016104400_personal_experience_photos_likes.sql','utf8'));
 await db.exec(fs.readFileSync('supabase/migrations/20261016110613_restrict_experience_media_rpc_grants.sql','utf8'));
 assert.equal((await db.query("select has_function_privilege('anon','public.set_my_experience_like(uuid,boolean)','EXECUTE') ok")).rows[0].ok,false);
 const auth=async id=>db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);
 await auth(owner);const path=`${owner}/${seed}/photo.jpg`;
 await db.query("insert into storage.objects values('personal-experience-photos',$1)",[path]);
 await db.query('select save_my_experience_photos($1,$2,$3)',[seed,[path],[]]);
 await db.query('select save_my_experience_photos($1,$2,$3)',[seed,[path],[]]); // lost-response retry
 await assert.rejects(db.query('select save_my_experience_photos($1,$2,$3)',[seed,[],[]]),e=>e.code==='40001');
 await auth(other);
 assert.equal((await db.query('select seed_experience_is_visible_to_viewer($1,auth.uid()) visible',[seed])).rows[0].visible,true);
 await assert.rejects(db.query('select save_my_experience_photos($1,$2,$3)',[seed,[],[path]]),e=>e.code==='42501');
 await db.query('select set_my_experience_like($1,true)',[seed]);await db.query('select set_my_experience_like($1,true)',[seed]);
 assert.equal((await db.query('select count(*)::int n from seed_experience_likes')).rows[0].n,1);
 await db.query("insert into seed_journal_entries values($1,'reflection','only_me',now())",[seed]);
 assert.equal((await db.query('select can_read_personal_experience_photo($1) visible',[path])).rows[0].visible,false);
 await assert.rejects(db.query('select set_my_experience_like($1,true)',[seed]),e=>e.code==='42501');
 await auth(owner);assert.equal((await db.query('select can_read_personal_experience_photo($1) visible',[path])).rows[0].visible,true);
 await assert.rejects(db.query('select save_my_experience_photos($1,$2,$3)',[seed,[`${other}/${seed}/x.jpg`],[path]]),e=>e.code==='22023');
 await auth('');await assert.rejects(db.query('select set_my_experience_like($1,true)',[seed]),e=>e.code==='42501');
 assert.equal((await db.query("select has_table_privilege('authenticated','seed_experience_likes','INSERT') ok")).rows[0].ok,false);
 }finally{await db.close();}
});
test('photo retry retains upload identity; committed save is not reported failed because cleanup failed',async()=>{
 let fail=true;const uploaded=[],saved=[];
 const client={auth:{getUser:async()=>({data:{user:{id:owner}}})},storage:{from:()=>({upload:async(path)=>{uploaded.push(path);return{};},remove:async()=>{throw Error('offline');}})},rpc:async(name,args)=>{saved.push(args);return{error:fail?Error('offline'):null};}};
 const draft=[{url:'unused',file:new Blob(['photo'],{type:'image/jpeg'})}];
 await assert.rejects(saveExperiencePhotos(client,seed,draft,['old']));fail=false;
 const result=await saveExperiencePhotos(client,seed,draft,['old']);
 assert.equal(uploaded[0],uploaded[1]);assert.equal(result[0],draft[0].path);assert.equal(saved[1].p_expected_paths[0],'old');
});

test('compact names preserve first names and Turkish initials; experience dates honor unknown/year precision',()=>{
 const {compactPersonName,experienceDate,experienceDateLabel}=module.exports;
 assert.equal(compactPersonName(' Zeynep   Tuğçe Kaya '),'Zeynep T. K.');
 assert.equal(compactPersonName('Berna'),'Berna');
 assert.equal(compactPersonName('Berkalp istanbullu ışık'),'Berkalp İ. I.');
 assert.equal(experienceDate({experience_precision:'unknown',experience_date:'2026-08-30',experience_year:2026}),null);
 assert.equal(experienceDate({experience_precision:'year',experience_date:'2026-08-30',experience_year:2020}),'2020');
 assert.equal(experienceDate({experience_precision:'exact',experience_date:'2026-08-30'}),'2026-08-30');
 assert.equal(experienceDate({experience_precision:'exact'}),null);
 assert.equal(experienceDateLabel(null),'');assert.equal(experienceDateLabel('2020'),'2020');
 assert.equal(experienceDateLabel('2026-08-30'),'30 Ağu 2026');
});
