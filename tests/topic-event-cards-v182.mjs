import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
function load(file,stubs={}){
 const m={exports:{}};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true,target:ts.ScriptTarget.ES2022}}).outputText,{module:m,exports:m.exports,require:id=>stubs[id]??require(id),console,Map,Set,Date,Promise,Intl});return m.exports;
}
const {loadTopicEventCards}=load('src/utils/topicEventCards.ts',{'@/utils/activityCover':{resolveActivityCover:({activityCoverUrl})=>activityCoverUrl}});
const event={intent_id:'i',plan_id:'p',resource_id:'p',event_state:'active',status:'active',participants:[{user_id:'host',full_name:'Merve',role:'owner',avatar_url:'host.jpg'},{user_id:'guest',full_name:'Guest',role:'participant',avatar_url:'guest.jpg'}]};
function db({fail=null,hidden=false,count=1}={}){
 const calls=[];
 const client={calls,rpc:async(name,args)=>{calls.push({name,args});if(name===fail)return{error:Error('offline'),data:null};if(name==='get_visible_event_card_details_batch_v182')return{data:hidden?[]:[{resource_id:'p',detail:{activity:{intent_id:'i',resource_id:'p',plan_id:'p',host_user_id:'host',host_full_name:'Merve',host_avatar_url:'host.jpg',activity_name:'Festival',category_name:'Culture',status:'forming',participant_count:count,city:'İstanbul',window_start:'2026-10-17',window_end:'2026-10-18',visibility:'public',max_participants:10,recruitment_status:'open'},viewer:{can_request:true,is_member:false}}}]};if(name==='get_uin_event_presentations_v150')return{data:[{resource_id:'p',presentation:{activityId:'a',categoryId:'c',displayTitle:'Festival',dnaCards:[{title:'İstanbul'}]}}]};return{data:[]};},from:()=>({select:()=>({in:async()=>({data:[{id:'a',cover_url:'festival.jpg',activity_categories:{cover_url:'category.jpg'}}]})})})};return client;
}
test('topic cards use actual event identity, canonical cover, participant count and viewer permissions',async()=>{
 const client=db(),cards=await loadTopicEventCards(client,[event]),card=cards.get('i');
 assert.equal(card.event_display_title,'Festival');assert.deepEqual(Array.from(card.event_dna_titles),['İstanbul']);assert.equal(card.context_cover_url,'festival.jpg');
 assert.equal(card.active_participant_count,1);assert.equal(card.viewer_can_request,true);assert.equal(card.viewer_is_member,false);assert.equal(card.owner_avatar_url,'host.jpg');
 assert.deepEqual(Array.from(card.activity_people,p=>p.userId),['host','guest']);assert.equal(client.calls.filter(c=>c.name==='get_visible_event_card_details_batch_v182').length,1);
});
test('empty participant counts remain zero; hidden resources and failed reads never become invented cards',async()=>{
 assert.equal((await loadTopicEventCards(db({count:0}),[event])).get('i').active_participant_count,0);
 assert.equal((await loadTopicEventCards(db({hidden:true}),[event])).size,0);
 await assert.rejects(loadTopicEventCards(db({fail:'get_visible_event_card_details_batch_v182'}),[event]),/yüklenemedi/);
 await assert.rejects(loadTopicEventCards(db({count:null}),[event]),/eksik/);
});
test('event detail loads use batches of at most 100 instead of per-card network calls',async()=>{
 const client=db();await loadTopicEventCards(client,Array.from({length:205},()=>event));
 assert.deepEqual(client.calls.filter(c=>c.name==='get_visible_event_card_details_batch_v182').map(c=>c.args.p_resource_ids.length),[100,100,5]);
});
function loadCard(file){
 const cache=new Map();
 function recurse(path){if(cache.has(path))return cache.get(path);const m={exports:{}};cache.set(path,m.exports);
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true,target:ts.ScriptTarget.ES2022}}).outputText,{module:m,exports:m.exports,require(id){
   if(id==='next/link')return{__esModule:true,default:({children,...props})=>React.createElement('a',props,children)};
   if(id==='next/navigation')return{useRouter:()=>({push(){},refresh(){}})};
   if(id==='@/utils/supabase/client')return{supabase:{rpc(){throw Error('No render-time RPC')}}};
   if(/weather|ReactionBar|PublicIntentJoinButton|UserDiscoveryControlsMenu/.test(id))return{__esModule:true,default:()=>null};
   if(id.startsWith('@/')){const base='src/'+id.slice(2),p=['.tsx','.ts'].map(ext=>base+ext).find(fs.existsSync);return recurse(p)}return require(id);
  },console,Map,Set,Date,Intl,URL});cache.set(path,m.exports);return m.exports;
 }return recurse(file);
}
test('main event renderer separates organizer, shows four participant photos and overflow, and keeps archived actions',async()=>{
 const Card=loadCard('src/components/discover/DiscoverIntentCard.tsx').default;
 const card=(await loadTopicEventCards(db(),[event])).get('i');
 card.active_participant_count=6;card.activity_people.push(...Array.from({length:5},(_,i)=>({userId:'guest'+i,fullName:'Person'+i,avatarUrl:'photo'+i+'.jpg',role:'participant'})));
 let html=renderToStaticMarkup(React.createElement(Card,{intent:card,currentUserId:'other'}));
 assert.ok(html.includes('🧬 İstanbul'));assert.ok(html.includes('Düzenleyen: Merve'));assert.ok(html.includes('guest.jpg'));assert.ok(html.includes('+2'));
 card.active_participant_count=0;card.activity_people=card.activity_people.slice(0,1);card.lifecycle_status='expired';
 html=renderToStaticMarkup(React.createElement(Card,{intent:card,currentUserId:'host'}));assert.ok(html.includes('Henüz katılımcı yok'));assert.ok(html.includes('Etkinliği görüntüle'));assert.ok(!html.includes('Etkinliği düzenle'));
});
test('parent list reuses the exact main renderer and keeps both archived sections initially collapsed',()=>{
 const source=fs.readFileSync('src/components/ideas/TopicCardModal.tsx','utf8');
 assert.match(source,/<DiscoverIntentCard intent=\{event.card_payload\}/);assert.match(source,/<EventList[^>]*viewerId=\{detail\?\.viewerId/);
 assert.equal((source.match(/<details onToggle=/g)||[]).length,2);assert.match(source,/completedOpen&&completed.map/);assert.match(source,/pastOpen&&past.map/);
 const sql=fs.readFileSync('supabase/migrations/20261013072527_event_card_details_batch_v182.sql','utf8');assert.match(sql,/security invoker/);assert.match(sql,/limit 100/);assert.match(sql,/get_activity_detail_page/);assert.match(sql,/where projected.detail is not null/);
  assert.match(fs.readFileSync('src/utils/topicEventCards.ts','utf8'),/activity_categories\(cover_url:default_cover_url\)/);
});
