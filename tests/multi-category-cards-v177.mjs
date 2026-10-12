import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function compile(file,require=()=>({})){const module={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module,exports:module.exports,require,URL,process:{env:{}},Response,console});return module.exports;}
const {cardContentTypeIds,cardCategoryContext}=compile('src/utils/cardContentTypes.ts');
const {resolveUinCardWords}=compile('src/utils/uinCardLanguage.ts');
test('one photography card belongs to three categories without duplicating its identity',()=>{
 const ids=cardContentTypeIds('hobby',['hobby','writer','activity','writer']);assert.equal(ids.length,3);
 for(const category of ids)assert.equal(cardCategoryContext('hobby',ids,category),category);
 assert.equal(cardCategoryContext('hobby',ids,'all'),undefined);
 assert.equal(cardCategoryContext('hobby',ids,'movie'),undefined);
 assert.equal(cardCategoryContext('hobby',undefined,'all'),'hobby');
});
test('category context gives the same card the correct action language',()=>{
 const ids=['hobby','activity','writer'];
 const categories={hobby:{base:'hobby'},activity:{base:'activity'},writer:{base:'activity',labels:{want:'Öğrenmek istiyorum',done:'Öğrendim'}}};
 for(const category of ids){const context=cardCategoryContext('hobby',ids,category);const type=categories[context];const words=resolveUinCardWords(type.base,type.labels);assert.equal(words.want,category==='writer'?'Öğrenmek istiyorum':'Yapmak istiyorum');}
});
function searchEndpoint({failed=false}={}){
 const calls=[];const db={auth:{getUser:async()=>({data:{user:{id:'viewer'}}})},rpc:async(name,args)=>{calls.push({name,args});if(name==='search_uin_category_topics_v177')return{data:[{catalogItemId:'placement',canonicalTargetId:'one-card',title:'Doğa Fotoğrafçılığı'}],error:null};if(name==='get_uin_card_content_types_v177')return{data:[{target_id:'one-card',content_type_ids:['hobby','activity','writer']}],error:failed?{message:'timeout'}:null};throw Error('Unexpected '+name)},from:()=>({select:()=>({in:async()=>({data:[{id:'placement',item_kind:'hobby',metadata:{content_type_id:'hobby'}}],error:null})})})};
 const route=compile('src/app/api/ideas/route.ts',id=>id==='next/server'?{NextResponse:{json:(body,init)=>new Response(JSON.stringify(body),{status:init?.status||200})}}:id==='@/utils/supabase/server'?{createClient:async()=>db}:{});
 return{get:route.GET,calls};
}
test('learning search finds the hobby card before limiting results, regardless of seed action',async()=>{
 const {get,calls}=searchEndpoint();const response=await get({headers:new Headers(),nextUrl:new URL('https://uin.onl/api/ideas?q=doğa&kind=writer&seedTypeId=learn')});assert.equal(response.status,200);const body=await response.json();assert.equal(body.items.length,1);assert.equal(body.items[0].canonicalTargetId,'one-card');assert.equal(body.items[0].contentTypeId,'writer');assert.equal(calls[0].name,'search_uin_category_topics_v177');assert.equal(calls[0].args.p_content_type_id,'writer');
});
test('search fails closed when category membership cannot be verified',async()=>{
 const {get}=searchEndpoint({failed:true});const response=await get({headers:new Headers(),nextUrl:new URL('https://uin.onl/api/ideas?q=doğa&kind=writer')});assert.equal(response.status,503);
});
