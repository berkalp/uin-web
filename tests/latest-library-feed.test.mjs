import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function harness(){
 const values=[],effects=[],callbacks=[],pending=[],requests=[];let vi=0,ei=0,ci=0;
 const react={useState(initial){const i=vi++;if(!(i in values))values[i]=initial;return[values[i],next=>{values[i]=typeof next==='function'?next(values[i]):next}]},useRef(initial){const i=vi++;return values[i]??(values[i]={current:initial})},useCallback(fn,deps){const i=ci++;if(!callbacks[i]||deps.some((d,j)=>d!==callbacks[i].deps[j]))callbacks[i]={fn,deps};return callbacks[i].fn},useEffect(fn,deps){const i=ei++,old=effects[i];if(!old||deps.some((d,j)=>d!==old.deps[j])){old?.cleanup?.();pending.push(()=>effects[i]={deps,cleanup:fn()})}}};
 const file=fs.existsSync('lib/use-latest-library-feed.ts')?'lib/use-latest-library-feed.ts':'src/components/ideas/useLatestLibraryFeed.ts';
 const module={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module,exports:module.exports,require:()=>react,AbortController,setTimeout,clearTimeout,Set,Error});
 const load=(cursor,signal)=>new Promise((resolve,reject)=>requests.push({cursor,signal,resolve,reject})),id=card=>card.id;
 return {requests,render(enabled=true,owner='a',revision=0){vi=ei=ci=0;const result=module.exports.useLatestLibraryFeed(enabled,owner,revision,load,id);pending.splice(0).forEach(fn=>fn());return result},dispose(){effects.forEach(effect=>effect.cleanup?.())}};
}
const page=(start,count=20,nextCursor='next')=>({cards:Array.from({length:count},(_,i)=>({id:`card-${start+i}`})),nextCursor});
test('first page starts once, then append uses the cursor and retains all previous cards',async()=>{
 const h=harness();h.render();h.render();assert.equal(h.requests.length,1);h.requests[0].resolve(page(0));await tick();let result=h.render();assert.equal(result.cards.length,20);void result.loadMore();void result.loadMore();assert.equal(h.requests.length,2);assert.equal(h.requests[1].cursor,'next');h.requests[1].resolve(page(20,20,'third'));await tick();result=h.render();assert.equal(result.cards.length,40);assert.equal(result.cards[0].id,'card-0');assert.equal(result.cards[39].id,'card-39');h.dispose();
});
test('append failure keeps cards and cursor, so retry resumes without duplicates',async()=>{
 const h=harness();h.render();h.requests[0].resolve(page(0));await tick();void h.render().loadMore();h.requests[1].reject(Error('offline'));await tick();let result=h.render();assert.equal(result.cards.length,20);assert.ok(result.error);assert.equal(result.initialLoading,false);void result.loadMore();h.requests[2].resolve({cards:[{id:'card-19'},{id:'card-20'}],nextCursor:null});await tick();result=h.render();assert.equal(result.cards.length,21);assert.equal(result.cursor,null);assert.equal(result.error,'');h.dispose();
});
test('refresh keeps rendered cards while loading and rejects the abandoned append response',async()=>{
 const h=harness();h.render();h.requests[0].resolve(page(0));await tick();void h.render().loadMore();h.render(true,'a',1);assert.equal(h.requests[1].signal.aborted,true);assert.equal(h.render(true,'a',1).cards.length,20);h.requests[1].resolve(page(20));h.requests[2].resolve(page(40));await tick();assert.equal(h.render(true,'a',1).cards[0].id,'card-40');h.dispose();
});
test('switching account or category blocks stale responses and hides previous owner data immediately',async()=>{
 const h=harness();h.render();h.requests[0].resolve(page(0));await tick();assert.equal(h.render().cards.length,20);assert.equal(h.render(true,'b').cards.length,0);h.render(false,'b');assert.equal(h.requests[1].signal.aborted,true);h.requests[1].resolve(page(20));await tick();assert.equal(h.render(false,'b').cards.length,0);h.render(true,'b');h.requests[2].resolve(page(60,0,null));await tick();const result=h.render(true,'b');assert.equal(result.cards.length,0);assert.equal(result.loaded,true);assert.equal(result.initialLoading,false);h.dispose();
});
