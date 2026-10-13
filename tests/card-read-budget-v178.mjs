import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

const target='11111111-1111-4111-8111-111111111111';
function compile(path,modules={}){
 const compiled={exports:{}};
 const code=ts.transpileModule(readFileSync(new URL('../'+path,import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText;
 vm.runInNewContext(code,{module:compiled,exports:compiled.exports,require:name=>modules[name]||{},console:{error(){}},process:{env:{}},URL,Number,Map,Set,Error,Promise});
 return compiled.exports;
}
function summaryRoute(social){
 const calls=[];
 const db={rpc:async name=>{
  calls.push(name);
  const data={resolve_uin_card_target_v129:target,get_uin_card_content_types_v177:[{content_type_ids:['book'],content_types:[]}],get_uin_card_profile_v60:{title:'Book',creator_name:'Writer',metadata:{},cover_url:null,catalog_item_id:null},get_uin_card_summary_v129:[{target_id:target,wanting:3,done:2,active:1,type_id:'book'}],get_uin_card_social_v87:social,get_uin_card_relations_v87:[]};
  assert.ok(name in data,'unexpected or duplicated expensive reader: '+name);
  return {data:data[name],error:null};
 },from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:{id:'book',label:'Books',icon:'B',base_kind:'book',ui_labels:{}},error:null})})})})};
 const route=compile('src/app/api/ideas/[targetId]/route.ts',{'next/server':{NextResponse:{json:(body,options={})=>({body,status:options.status||200})}},'@/utils/supabase/server':{createClient:async()=>db}});
 return {calls,request:()=>route.GET({headers:{get:()=>null},nextUrl:new URL('https://example.invalid/api/ideas/'+target+'?summary=1')},{params:Promise.resolve({targetId:target})})};
}
const social={target_id:target,follower_count:4,average_rating:8.5,rating_count:2,viewer_rating:9,related_count:0};
test('summary retains exact ratings and counters with one authoritative social read',async()=>{
 const route=summaryRoute([social]);const response=await route.request();
 assert.equal(response.status,200);
 assert.equal(response.body.averageRating,8.5);assert.equal(response.body.ratingCount,2);assert.equal(response.body.viewerRating,9);
 assert.equal(response.body.communityCounts.join(','),'3,2,1');
 assert.equal(route.calls.filter(name=>name==='get_uin_card_social_v87').length,1);
 assert.ok(!route.calls.includes('get_uin_card_ratings_v85'));
});
test('null ratings stay null rather than becoming a fabricated zero',async()=>{
 const response=await summaryRoute([{...social,average_rating:null,viewer_rating:null,rating_count:0}]).request();
 assert.equal(response.status,200);assert.equal(response.body.averageRating,null);assert.equal(response.body.viewerRating,null);
});
test('missing, mismatched and malformed social data still fail closed',async()=>{
 for(const rows of [[],[{...social,target_id:'other'}],[{...social,rating_count:null}],[{...social,average_rating:'invalid'}],[{...social,viewer_rating:undefined}]]){
  const response=await summaryRoute(rows).request();assert.equal(response.status,503);assert.equal(response.body.card,undefined);
 }
});
test('failed batch stops new work and never returns partial catalogue rows',async()=>{
 const {boundedTargetProjection}=compile('src/utils/boundedTargetProjection.ts');
 const calls=[];const failure={code:'57014'};
 const result=await boundedTargetProjection(Array.from({length:10},(_,i)=>String(i)),async batch=>{
  calls.push(batch[0]);return batch[0]==='0'?{data:null,error:failure}:{data:batch,error:null};
 },1);
 assert.equal(result.error,failure);assert.equal(result.data,null);assert.equal(calls.length,3);
});
test('successful batch retains every result with bounded concurrency',async()=>{
 const {boundedTargetProjection}=compile('src/utils/boundedTargetProjection.ts');
 let active=0,peak=0;
 const ids=Array.from({length:11},(_,i)=>String(i));
 const result=await boundedTargetProjection(ids,async batch=>{active++;peak=Math.max(peak,active);await Promise.resolve();active--;return {data:batch,error:null}},2);
 assert.equal(result.error,null);assert.equal(result.data.length,ids.length);assert.ok(peak<=3);assert.deepEqual([...result.data].sort(),[...ids].sort());
});
