import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function harness({audienceError=false,authenticated=true}={}){
 let clientOptions;const calls=[];
 const db={auth:{getUser:async()=>({data:{user:authenticated?{id:'viewer'}:null}})},rpc:async(name,args)=>{
  calls.push({name,args});const values={
   get_my_canonical_seeds_v31:[{seed_id:'own-seed',canonical_target_id:'own',status:'active'}],get_my_uin_seed_presentations_v70:[],get_my_uin_personal_cards_v57:[],get_my_uin_active_plan_topics_v153:[],
   get_uin_library_audience_v20261014:[{scope:'wishes',target_id:'friend-target',user_ids:['friend'],event_ids:[],content_type_ids:['place']}],
   resolve_uin_card_targets_v143:args?.p_target_ids?.map(id=>({requested_id:id,resolved_id:id,type_id:'place'})),
   get_uin_card_content_types_v177:args?.p_target_ids?.map(id=>({target_id:id,content_type_ids:['place']})),
   get_uin_catalogue_for_targets_v123:args?.p_target_ids?.map(id=>({canonical_target_id:id,title:'Place',intent_people_count:7,experience_people_count:4,completed_event_count:2,expired_event_count:1,cancelled_event_count:0,child_count:0,active_event_count:3})),
  };return{data:values[name]??[],error:audienceError&&name==='get_uin_library_audience_v20261014'?{message:'offline'}:null};
 },from:()=>({select(){return this;},in(){return this;},eq(){return this;},order:async()=>({data:[],error:null})})};
 const module={exports:{}};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/app/api/ideas/scopes/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module,exports:module.exports,process:{env:{}},console:{error(){}},require:id=>({
  '@supabase/supabase-js':{createClient:(_url,_key,options)=>{clientOptions=options;return db;}},'@/utils/supabase/server':{createClient:async()=>db},
  'next/server':{NextResponse:{json:(body,options)=>({body,status:options?.status??200})}},'@/utils/artistListMetadata':{readArtistMetadata:()=>null},'@/utils/boundedTargetProjection':{boundedTargetProjection:async(ids,fn)=>fn(ids)},
 })[id]});
 return{calls,options:()=>clientOptions,request:async(query,token)=>module.exports.GET({nextUrl:new URL('https://uin.onl/api/ideas/scopes?'+query),headers:new Headers(token?{Authorization:'Bearer '+token}:{})})};
}
test('friends selects distinct social targets without replacing viewer ownership or global metrics',async()=>{
 const h=harness();const r=await h.request('audience=friends&scope=wishes&kind=place&cards=1','native-session');assert.equal(r.status,200);assert.deepEqual(Array.from(r.body.wishes),['friend-target']);assert.equal(r.body.counts.wishes.place,1);const card=r.body.catalogue[0];assert.equal(card.intent_people_count,7);assert.equal(card.own_seed_id,null);assert.equal(card.own_common_intent_id,null);assert.equal(h.options().global.headers.Authorization,'Bearer native-session');
});
test('own scopes retain original personal membership and do not call the social aggregate',async()=>{
 const h=harness();const r=await h.request('audience=me&cards=0');assert.equal(r.status,200);assert.deepEqual(Array.from(r.body.wishes),['own']);assert.ok(!h.calls.some(c=>c.name==='get_uin_library_audience_v20261014'));
});
test('failed aggregate is an error rather than a zero count; guests cannot query it',async()=>{
 const h=harness({audienceError:true});assert.equal((await h.request('audience=friends')).status,503);
 const guest=harness({authenticated:false});assert.equal((await guest.request('audience=friends')).status,401);assert.equal(guest.calls.length,0);
});
