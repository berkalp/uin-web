import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

test('summary and full detail start independent header reads while membership is pending, and still fail closed',async()=>{
 for(const summary of [false,true]){
  const calls=[];let release;const gate=new Promise(resolve=>release=resolve);
  const target='8dd157cd-9d2b-42e0-bca8-f5123fa98fc9';
  const db={rpc:async(name)=>{calls.push(name);if(name==='resolve_uin_card_target_v129')return{data:target};if(name==='get_uin_card_content_types_v177'){await gate;return{error:Error('unavailable')}}return{data:[]}},auth:{getUser:async()=>({data:{user:null}})}};
  const m={exports:{}};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/app/api/ideas/[targetId]/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:m,exports:m.exports,require:id=>id==='next/server'?{NextResponse:{json:(body,options)=>({body,...options})}}:id==='@/utils/supabase/server'?{createClient:async()=>db}:{},console,Map,Set,Date,Promise,Intl});
  const pending=m.exports.GET({headers:{get:()=>null},nextUrl:{searchParams:new URLSearchParams(summary?'summary=1':'')}},{params:Promise.resolve({targetId:target})});
  await new Promise(r=>setImmediate(r));
  assert.ok(calls.includes('get_uin_card_profile_v60'));
  assert.ok(calls.includes(summary?'get_uin_card_summary_v129':'get_uin_catalogue_for_targets_v123'));
  release();assert.equal((await pending).status,503);
 }
});
