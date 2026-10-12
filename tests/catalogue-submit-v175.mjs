import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function endpoint({duplicate=null,duplicateError=null}={}){
 const calls=[];
 const db={auth:{getUser:async()=>({data:{user:{id:'member'}}})},from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:{active:true,base_kind:'hobby',ui_labels:{}},error:null})})})}),rpc:async(name,args)=>{calls.push({name,args});if(name==='get_admin_role')return{data:null,error:null};if(name==='find_uin_duplicate_v73')return{data:duplicate,error:duplicateError};if(name==='suggest_seed_catalog_item')return{data:'suggestion',error:null};throw new Error('Unexpected RPC '+name)}};
 const module={exports:{}};
 const code=ts.transpileModule(fs.readFileSync('src/app/api/ideas/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(code,{module,exports:module.exports,URL,process:{env:{}},console:{error:()=>{}},require:id=>id==='next/server'?{NextResponse:{json:(data,init)=>new Response(JSON.stringify(data),{status:init?.status??200})}}:id==='@/utils/supabase/server'?{createClient:async()=>db}:id==='@/utils/referenceLinks'?{normalizeReferenceLinks:links=>links}:{} });
 return{post:module.exports.POST,calls};
}
const request=body=>({headers:new Headers(),json:async()=>body});
const manual={mode:'manual',seedTypeId:'try',kind:'hobby',contentTypeId:'hobby',title:'Gümüş Takı Tasarımı'};
test('a member can suggest a hobby without a source link or manual provider flag',async()=>{const{post,calls}=endpoint();const result=await post(request(manual));assert.equal(result.status,200);assert.equal((await result.json()).status,'pending');assert(calls.some(x=>x.name==='suggest_seed_catalog_item'&&x.args.p_metadata.content_type_id==='hobby'));});
test('an existing active card returns its identity without creating a duplicate',async()=>{const{post,calls}=endpoint({duplicate:{status:'active',catalogItemId:'catalogue',canonicalTargetId:'target'}});const result=await post(request(manual));assert.equal(result.status,200);const body=await result.json();assert.equal(body.canonicalTargetId,'target');assert.equal(body.existing,true);assert(!calls.some(x=>x.name==='suggest_seed_catalog_item'));});
test('an existing pending suggestion is a successful pending outcome',async()=>{const{post}=endpoint({duplicate:{status:'pending',catalogItemId:'catalogue'}});const result=await post(request(manual));assert.equal(result.status,200);assert.equal((await result.json()).status,'pending');});
test('database failure never pretends to be a submitted suggestion',async()=>{const{post,calls}=endpoint({duplicateError:{code:'57014',message:'timeout'}});const result=await post(request(manual));assert.equal(result.status,503);assert(!calls.some(x=>x.name==='suggest_seed_catalog_item'));});
