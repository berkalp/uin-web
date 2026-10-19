import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source=fs.readFileSync('src/components/ideas/InlineTopicSearch.tsx','utf8');
const start=source.indexOf('useEffect(()=>{const type=contentTypes.find(item=>item.id===kind);');
const end=source.indexOf('},[addingOnly,categoryLanding,scope,kind,categoryCardsRetry',start);
assert.ok(start>=0&&end>start);
const effect=source.slice(start+'useEffect('.length,end+1);
const code=ts.transpileModule(`(${effect})()`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
test('category waits for the session and starts one cancellable read for guests or signed-in users',async()=>{
 for(const viewerId of [undefined,null,'viewer-a']){
  const calls=[];
  const cleanup=vm.runInNewContext(code,{contentTypes:[{id:'series',base_kind:'series'}],kind:'series',viewerId,addingOnly:false,categoryLanding:false,scope:'library',AbortController,Error,setCategoryCardsLoading(){},setCategoryCardsError(){},loadCategoryCatalogue:async(kind,signal)=>calls.push({kind,signal})});
  assert.equal(calls.length,viewerId===undefined?0:1);
  if(viewerId!==undefined){assert.equal(calls[0].kind,'series');assert.equal(calls[0].signal.aborted,false);cleanup();assert.equal(calls[0].signal.aborted,true)}
 }
});
