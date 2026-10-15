import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function endpoint({typesError=null}={}) {
 const calls=[];let bearer=null;
 const db={rpc:async name=>{calls.push(name);return name==='get_admin_role'?{data:null,error:null}:{data:null,error:{message:'timeout'}}},from:name=>{const result={data:name==='uin_content_types'?[{id:'activity',label:'Aktivite',icon:'✨',base_kind:'activity'}]:[{id:'try-id',slug:'try',name:'Dene'}],error:typesError};const query={select:()=>query,eq:()=>query,order:()=>query,then:resolve=>Promise.resolve(result).then(resolve)};return query}};
 const module={exports:{}};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/app/api/ideas/catalogue/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module,exports:module.exports,process:{env:{}},require:id=>id==='next/server'?{NextResponse:{json:(body,init)=>new Response(JSON.stringify(body),init)}}:id==='@supabase/supabase-js'?{createClient:(_url,_key,options)=>{bearer=options.global.headers.Authorization;return db}}:{createClient:async()=>db}});
 return {get:module.exports.GET,calls,bearer:()=>bearer};
}
test('mobile import metadata bypasses a failing card search and preserves bearer context',async()=>{
 const e=endpoint();const response=await e.get({headers:new Headers({authorization:'Bearer mobile-session'}),nextUrl:new URL('https://uin.onl/api/ideas/catalogue?metadata=1')});
 assert.equal(response.status,200);const body=await response.json();assert.equal(body.types[0].id,'activity');assert.equal(body.seedTypes[0].slug,'try');assert.equal(e.bearer(),'Bearer mobile-session');assert(!e.calls.includes('get_uin_catalogue_fast_v122'));assert.equal(body.canAddSports,false);
});
test('real metadata failures remain retryable instead of masquerading as empty types',async()=>{
 const e=endpoint({typesError:{message:'offline'}});const response=await e.get({headers:new Headers(),nextUrl:new URL('https://uin.onl/api/ideas/catalogue?metadata=1')});assert.equal(response.status,503);
});
test('normal catalogue requests still report a card-query failure',async()=>{
 const e=endpoint();const response=await e.get({headers:new Headers(),nextUrl:new URL('https://uin.onl/api/ideas/catalogue?q=Laser')});assert.equal(response.status,503);assert(e.calls.includes('get_uin_catalogue_fast_v122'));
});

test('activity search retains laser tag while excluding the same-name video game',async()=>{
 const source=fs.readFileSync('src/app/api/favorites/search/route.ts','utf8');const start=source.indexOf('const KIND_HINTS:');const end=source.indexOf('export async function GET',start);const rows=[{id:'Q1',label:'Laser tag',description:'recreational shooting sport'},{id:'Q2',label:'LASER TAG MASSACRE',description:'2025 video oyunu'},{id:'Q3',label:'Laser Tag',description:'American film'},{id:'Q4',label:'Laser',description:'company'}];
 const search=vm.runInNewContext(ts.transpileModule(source.slice(start,end)+'\nwikidata',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,{URL,text:v=>typeof v==='string'?v:null,fetch:async url=>({ok:true,json:async()=>String(url).includes('wbsearchentities')?{search:rows}:{entities:{}}})});
 const results=await search('Laser tag','activity');assert.deepEqual(Array.from(results,item=>item.externalId),['Q1']);
});
