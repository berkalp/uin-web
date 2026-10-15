import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const file=fs.existsSync('lib/library-category-filter.ts')?'lib/library-category-filter.ts':'src/utils/libraryCategoryFilter.ts';
const module={exports:{}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module,exports:module.exports,Set,Map,Error});
const {readLibraryCategoryIndex,matchesLibraryCategory}=module.exports;
function clientFor(presentations,memberships){
 const calls=[];
 return {calls,rpc(name,args){calls.push({name,args});return{abortSignal:async signal=>{
  assert.equal(signal.aborted,false);
  return {error:null,data:name==='get_uin_event_presentations_v150'?args.p_resource_ids.map(id=>({resource_id:id,presentation:presentations[id]??null})):args.p_target_ids.filter(id=>id in memberships).map(id=>({target_id:id,content_type_ids:memberships[id]}))};
 }}}};
}
test('All preserves all records, including private cards with no canonical target',()=>{
 assert.equal(matchesLibraryCategory('',[null],{}),true);
 assert.equal(matchesLibraryCategory('artist',[null],{}),false);
 assert.equal(matchesLibraryCategory('artist',['x'],{x:['artist']}),true);
});
test('artist DNA and primary activity both categorize an event, without duplicating it',async()=>{
 const client=clientFor({event:{mainTarget:{targetId:'walk'},primaryDna:{targetId:'artist'},dnaCards:[{targetId:'city'},{targetId:'artist'},{targetId:'artist'}]}},{walk:['activity','hobby'],artist:['artist'],city:['place'],book:['book']});
 const index=await readLibraryCategoryIndex(client,['book'],['event','event'],new AbortController().signal);
 for(const category of ['artist','activity','hobby','place']) assert.equal(matchesLibraryCategory(category,['event'],index.events),true);
 assert.equal(matchesLibraryCategory('book',['event'],index.events),false);
 assert.equal(index.events.event.length,4);
 assert.equal(client.calls[0].args.p_resource_ids.length,1);
 assert.equal(client.calls[1].args.p_target_ids.length,4);
 const rows=[{id:'event'}];
 assert.equal(rows.filter(row=>matchesLibraryCategory('artist',[row.id],index.events)).length,1);
 assert.equal(rows.filter(row=>matchesLibraryCategory('movie',[row.id],index.events)).length,0);
 assert.equal(rows.filter(row=>matchesLibraryCategory('',[row.id],index.events)).length,1);
});
test('a hidden source never supplies a category; a hidden event is never invented',async()=>{
 const client=clientFor({visible:{mainTarget:{targetId:'artist'}},hidden:null},{artist:['artist']});
 const index=await readLibraryCategoryIndex(client,[],['visible','hidden'],new AbortController().signal);
 assert.equal(matchesLibraryCategory('artist',['hidden'],index.events),false);
 assert.equal(index.events.hidden.length,0);
});
test('membership requests are deduplicated and bounded without hydrating cards',async()=>{
 const ids=Array.from({length:1001},(_,i)=>`target${i}`);
 const client=clientFor({},Object.fromEntries(ids.map(id=>[id,['artist']])));
 await readLibraryCategoryIndex(client,[...ids,...ids],[],new AbortController().signal);
 assert.deepEqual(client.calls.map(call=>call.args.p_target_ids.length),[500,500,1]);
 assert.ok(client.calls.every(call=>call.name==='get_uin_card_content_types_v177'));
});
test('errors and missing presentation rows cannot masquerade as an empty category',async()=>{
 const failed={rpc(){return{abortSignal:async()=>({error:{message:'offline'},data:null})}}};
 await assert.rejects(readLibraryCategoryIndex(failed,[],['event'],new AbortController().signal),/yüklenemedi/);
 const missing={rpc(){return{abortSignal:async()=>({error:null,data:[]})}}};
 await assert.rejects(readLibraryCategoryIndex(missing,[],['event'],new AbortController().signal),/henüz yüklenemedi/);
});
