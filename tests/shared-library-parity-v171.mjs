import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),cache=new Map();
function load(file,extra=''){
 const key=file+extra;if(cache.has(key))return cache.get(key);
 const output=ts.transpileModule(fs.readFileSync(file,'utf8')+extra,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true,target:ts.ScriptTarget.ES2022}}).outputText;
 const m={exports:{}};cache.set(key,m.exports);
 vm.runInNewContext(output,{module:m,exports:m.exports,URL,require(id){if(id==='next/navigation')return {useRouter:()=>({push(){},refresh(){}})};if(id==='next/link')return {__esModule:true,default:({children,...props})=>React.createElement('a',props,children)};if(id==='next/dynamic')return {__esModule:true,default:()=>()=>null};if(id==='@/utils/supabase/client')return {supabase:{rpc(){throw Error('Card render must never query')}}};if(id.startsWith('./'))return load(['.ts','.tsx'].map(ext=>path.resolve(path.dirname(file),id+ext)).find(fs.existsSync));if(id.startsWith('@/')){const base='src/'+id.slice(2),path=['.tsx','.ts'].map(ext=>base+ext).find(fs.existsSync);return load(path)}return require(id)}}, {filename:file});cache.set(key,m.exports);return m.exports;
}
const item={canonical_target_id:'topic-1',title:'Bolu',subtitle:'Türkiye',item_kind:'place',content_type_id:'place',cover_url:null,catalog_cover_url:null,seed_type_slug:'visit',average_rating:null,rating_count:0,intent_people_count:1,experience_people_count:2,active_event_count:0,follower_count:0};
const types=[{id:'place',label:'Yer',icon:'📍',base_kind:'place',active:true}];
const Card=load('src/components/cards/LibraryTopicCard.tsx').default;
function renderCard(overrides={}){return renderToStaticMarkup(React.createElement(Card,{item,contentTypes:types,scope:'library',onOpen(){},onCancel(){},...overrides}))}
test('shared profile and Library card keeps three viewer actions and separate wish editing',()=>{
 const html=renderCard({item:{...item,own_seed_id:'own-wish',own_seed_status:'active'}});
 for(const label of ['İsteğimi düzenle','İsteğimi iptal et','Gittim','Gezi etkinliği'])assert.ok(html.includes(label),label);
 const visitor=renderCard({personalRating:10,personalRatingLabel:'Verdiği puan'});
 for(const label of ['Verdiği puan 10/10','Gitmek istiyorum','Gittim','Gezi etkinliği'])assert.ok(visitor.includes(label),label);
 assert.ok(!visitor.includes('Deneyimimi düzenle'));
});
test('unavailable summaries never become zero totals or unrated badges',()=>{
 const html=renderCard({countsReady:false});
 assert.ok(html.includes('Puan · —'));assert.ok(html.includes('— takipçi'));
 assert.ok(!html.includes('Henüz puan yok'));assert.ok(!html.includes('0 tamamlandı'));
 assert.equal((html.match(/>—<\/span>/g)||[]).length,3);
});
test('experience cards also show the existing owner plan and its actions',()=>{
 const html=renderCard({scope:'experiences',item:{...item,own_seed_id:'experience',own_seed_status:'completed',personal_event:{resource_id:'event-1',plan_id:'plan-1',viewer_role:'owner',title:'Araba Yolculuğu',start_date:'2027-05-19'}}});
 for(const label of ['Etkinliği düzenle','Etkinliği iptal et','Deneyimimi düzenle','Gezi etkinliği'])assert.ok(html.includes(label),label);
});
test('plans enforce different owner, member, visitor and archived actions',()=>{
 const Actions=load('src/components/cards/LibraryPlanActions.tsx').default;
 const render=role=>renderToStaticMarkup(React.createElement(Actions,{event:{plan_id:'plan-1',viewer_role:role,lifecycle_status:'forming'}}));
 for(const role of ['participant','member']){const html=render(role);assert.ok(html.includes('Planı aç'));assert.ok(html.includes('Katılımdan ayrıl'));assert.ok(!html.includes('Etkinliği iptal et'))}
 assert.ok(render('owner').includes('Etkinliği iptal et'));assert.ok(render('owner').includes('manage=1'));
 assert.ok(!render('visitor').includes('Ayrıl'));
 for(const status of ['completed','cancelled','expired','closed']){const html=renderToStaticMarkup(React.createElement(Actions,{event:{plan_id:'plan-1',viewer_role:'owner',lifecycle_status:status}}));assert.ok(html.includes('Etkinliği aç'));assert.ok(!html.includes('İptal'))}
});
test('all profile event sorts preserve rows and put unknown values last',()=>{
 const {sortProfileCards}=load('src/components/profile/ProfileActivityTabs.tsx');
 const rows=[{resource_id:'unknown',library_card:{average_rating:null}},{resource_id:'old',scheduled_start:'2020-01-01',created_at:'2026-01-01',library_card:{average_rating:9}},{resource_id:'new',scheduled_start:'2026-01-01',created_at:'2020-01-01',library_card:{average_rating:4}}];
 for(const [sort,expected]of [['date-desc',['new','old','unknown']],['date-asc',['old','new','unknown']],['created-desc',['old','new','unknown']]])assert.deepEqual(Array.from(sortProfileCards(rows,'active',sort),r=>r.resource_id),expected);
 assert.equal(rows[0].resource_id,'unknown');
});
test('card parity reads stay batched and sorting does not issue requests',()=>{
 for(const path of ['src/components/cards/LibraryTopicCard.tsx','src/components/profile/ProfileLibraryActivityCard.tsx'])assert.doesNotMatch(fs.readFileSync(path,'utf8'),/useEffect|fetch\s*\(|supabase\.rpc/);
 const migration=fs.readFileSync('supabase/migrations/20261011130000_shared_library_profile_parity_v171.sql','utf8');assert.match(migration,/cardinality\(v_all\), 0\) > 6/);assert.match(migration,/s\.user_id=auth\.uid\(\)/);assert.match(migration,/ps\.seed_id=s\.id and ps\.user_id=s\.user_id/);
});

test('sports branch cards distinguish team, group, league and season using the shared Library renderer',()=>{
 const team={target_id:'team',parent_target_id:'root',displayName:'Beşiktaş A.Ş.',sport:'Futbol',division:'Erkek',league:'Trendyol Süper Lig',season:'2026–2027'};
 const html=renderCard({item:{...item,title:'Beşiktaş A.Ş. · Futbol · Erkek',item_kind:'club',content_type_id:'club'},club:team});
 assert.ok(html.includes('Beşiktaş A.Ş.'));assert.ok(html.includes('text-amber-300'));assert.ok(html.includes('⚽ Futbol – Erkek'));
 assert.equal((html.match(/Trendyol Süper Lig/g)||[]).length,1);assert.ok(html.includes('2026–2027'));
 for(const text of ['Maç izlemek istiyorum','Maç izledim','Maç izleme etkinliği'])assert.ok(html.includes(text),text);
 const {clubMatches}=load('src/utils/clubHierarchy.ts');
 assert.equal(clubMatches({...team,parent_target_id:null,sport:''},'','',''),false);
 assert.equal(clubMatches(team,'Futbol','Trendyol Süper Lig','Erkek'),true);
 assert.equal(clubMatches(team,'Basketbol','',''),false);
 const {clubCardLabels}=load('src/utils/club-card-labels.ts');
 assert.equal(clubCardLabels('Beşiktaş A.Ş.').branch,'','an unspecified old club wish must not become football');
 assert.equal(clubCardLabels('Beşiktaş A.Ş. · Basketbol · Kadın').branch,'🏀 Basketbol – Kadın');
});

test('linked Library projection verifies every target and count before showing a list',async()=>{
 const {loadLinkedLibraryCards}=load('src/utils/linkedLibraryCards.ts');
 const requests=[];
 const client={rpc:async(name,args)=>{requests.push(args.p_target_ids.length);return{error:null,data:args.p_target_ids.map(id=>name.includes('catalogue')?{...item,canonical_target_id:id}:name.includes('ratings')?{target_id:id,rating_count:0,average_rating:null}:{target_id:id,follower_count:0,related_count:0})}}};
 const metadata=async ids=>({error:null,data:ids.map(id=>({canonical_target_id:id,metadata:{card_honours:[{label:'🏆 1 ödül',url:'https://example.org/award',note:'Doğrulanmış kaynak',kind:'award'}]}}))});
 const ids=Array.from({length:205},(_,i)=>'card-'+i),rows=await loadLinkedLibraryCards(client,ids,metadata);
 assert.equal(rows[204].card_honours[0].label,'🏆 1 ödül');
 assert.equal(rows.length,205);assert.equal(rows[204].canonical_target_id,ids[204]);assert.deepEqual(requests,[100,100,100,100,100,100,100,100,5,5,5,5]);
 const broken=(change)=>({rpc:async(name,args)=>{const reply=await client.rpc(name,args);return{...reply,data:change(name,reply.data)}}});
 await assert.rejects(()=>loadLinkedLibraryCards(broken((name,rows)=>name.includes('social')?[]:rows),['one'],metadata),/yüklenemedi/);
 await assert.rejects(()=>loadLinkedLibraryCards(broken((name,rows)=>name.includes('catalogue')?rows.map(r=>({...r,intent_people_count:-1})):rows),['one'],metadata),/doğrulanamadı/);
 await assert.rejects(()=>loadLinkedLibraryCards(broken((name,rows)=>name.includes('catalogue')?[rows[0],rows[0]]:rows),['one','two'],metadata),/kimlikleri/);
});
