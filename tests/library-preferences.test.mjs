import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const native=fs.existsSync('lib/library-preferences.ts');
const utilPath=native?'lib/library-preferences.ts':'src/utils/libraryPreferences.ts';
const hookPath=native?'lib/use-library-preferences.ts':'src/components/ideas/useLibraryPreferences.ts';
const compile=(file,require=()=>({}),extra={})=>{const module={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module,exports:module.exports,require,AbortController,Map,Set,Error,Promise,...extra});return module.exports};
const util=compile(utilPath),plain=value=>JSON.parse(JSON.stringify(value)),tick=()=>new Promise(resolve=>setImmediate(resolve));
function harness(){
 const values=[],effects=[],callbacks=[],pending=[],requests=[],timers=new Map();let vi=0,ei=0,ci=0,ti=0;
 const react={useState(initial){const i=vi++;if(!(i in values))values[i]=initial;return[values[i],next=>{values[i]=typeof next==='function'?next(values[i]):next}]},useRef(initial){const i=vi++;return values[i]??(values[i]={current:initial})},useCallback(fn,deps){const i=ci++;if(!callbacks[i]||deps.some((d,j)=>d!==callbacks[i].deps[j]))callbacks[i]={fn,deps};return callbacks[i].fn},useEffect(fn,deps){const i=ei++,old=effects[i];if(!old||deps.some((d,j)=>d!==old.deps[j])){old?.cleanup?.();pending.push(()=>effects[i]={deps,cleanup:fn()})}}};
 const db={from(table){assert.equal(table,'uin_library_preferences');let payload=null,owner=null;const chain={select(){return chain},eq(key,value){assert.equal(key,'user_id');owner=value;return chain},upsert(value,options){payload=value;assert.equal(options.onConflict,'user_id,preference_key');return chain},abortSignal(signal){return new Promise((resolve,reject)=>requests.push({payload,owner,signal,resolve,reject}))}};return chain}};
 const mod=compile(hookPath,id=>id==='react'?react:id.includes('supabase')?{supabase:db}:util,{setTimeout(fn){const id=++ti;timers.set(id,fn);return id},clearTimeout(id){timers.delete(id)}});
 return {requests,render(owner='a'){vi=ei=ci=0;const result=mod.useLibraryPreferences(owner);pending.splice(0).forEach(fn=>fn());return result},timeout(){[...timers.values()].forEach(fn=>fn())},dispose(){effects.forEach(e=>e.cleanup?.())}};
}
test('category IDs are normalized, deduplicated and cannot inject query parameters',()=>{
 assert.deepEqual(plain(util.libraryCategories(['movie','artist','movie','all','x&audience=me',null])),['artist','movie']);
 assert.deepEqual(plain(util.libraryCategories({movie:true})),[]);
});
test('sort defaults are isolated by category, section and branch and share web/native IDs',()=>{
 const keys=[util.librarySortKey('library','movie'),util.librarySortKey('library','series'),util.librarySortKey('plans','movie'),util.librarySortKey('library','club','Futbol'),util.librarySortKey('library','club','Basketbol')];
 assert.equal(new Set(keys).size,5);assert.equal(util.librarySortKey('library','club',' Futbol '),util.librarySortKey('library','club','futbol'));
 for(const sort of ['imdbTop100','friendsRating','friendsDone','artist:youtube_global','ratingAsc','alphabeticalDesc'])assert.equal(util.nativeLibrarySort(util.storedLibrarySort(sort,false),false),sort);
 assert.equal(util.nativeLibrarySort('ratingDesc',false),'uinRating');assert.equal(util.nativeLibrarySort('ratingDesc',true),'rating');
});
test('preferences load once and a single-key save preserves other defaults and categories',async()=>{
 const h=harness();h.render();h.render();assert.equal(h.requests.length,1);assert.equal(h.requests[0].owner,'a');
 h.requests[0].resolve({data:[{preference_key:'categories',value:['series','movie']},{preference_key:'sort:series',value:'imdbTop100'}]});await tick();
 let current=h.render();assert.equal(current.ready,true);assert.deepEqual(plain(current.categories),['movie','series']);
 const saving=current.save('sort:movie','friendsRating');assert.deepEqual(plain(h.requests[1].payload),{user_id:'a',preference_key:'sort:movie',value:'friendsRating'});
 h.requests[1].resolve({data:[{preference_key:'sort:movie',value:'friendsRating'}]});assert.equal(await saving,true);current=h.render();
 assert.equal(current.values['sort:series'],'imdbTop100');assert.equal(current.values['sort:movie'],'friendsRating');assert.deepEqual(plain(current.categories),['movie','series']);h.dispose();
});
test('stalled preferences stop after the read deadline even when the client ignores abort',async()=>{
 const h=harness();h.render();h.timeout();await tick();const current=h.render();assert.equal(current.ready,true);assert.ok(current.error);assert.equal(h.requests[0].signal.aborted,true);h.dispose();
});
test('a failed save keeps the saved selection and allows an explicit retry',async()=>{
 const h=harness();h.render();h.requests[0].resolve({data:[{preference_key:'categories',value:['movie']}]});await tick();
 let current=h.render(),saving=current.save('categories',['artist']);h.requests[1].resolve({data:null,error:{message:'offline'}});assert.equal(await saving,false);current=h.render();
 assert.deepEqual(plain(current.categories),['movie']);assert.ok(current.error);assert.equal(current.saving,false);
 saving=current.save('categories',['artist']);h.requests[2].resolve({data:[{preference_key:'categories',value:['artist']}]});assert.equal(await saving,true);assert.deepEqual(plain(h.render().categories),['artist']);h.dispose();
});
test('switching accounts hides old defaults immediately and ignores late read/write responses',async()=>{
 const h=harness();h.render();h.requests[0].resolve({data:[{preference_key:'categories',value:['movie']}]});await tick();
 const saving=h.render().save('categories',['artist']);let current=h.render('b');assert.deepEqual(plain(current.categories),[]);
 h.requests[1].resolve({data:[{preference_key:'categories',value:['artist']}]});assert.equal(await saving,false);
 h.requests[2].resolve({data:[{preference_key:'categories',value:['book']}]});await tick();current=h.render('b');assert.deepEqual(plain(current.categories),['book']);assert.equal(current.saving,false);h.dispose();
});
test('refresh response cannot overwrite a newer save and a null sort resets only that key',async()=>{
 const h=harness();h.render();h.requests[0].resolve({data:[{preference_key:'categories',value:['book']},{preference_key:'sort:book',value:'recent'}]});await tick();
 h.render().retry();h.render();const saving=h.render().save('sort:book',null);
 h.requests[2].resolve({data:[{preference_key:'sort:book',value:null}]});assert.equal(await saving,true);
 h.requests[1].resolve({data:[{preference_key:'categories',value:['movie']},{preference_key:'sort:book',value:'recent'}]});await tick();
 const current=h.render();assert.deepEqual(plain(current.categories),['book']);assert.equal(current.values['sort:book'],null);h.dispose();
});

test('defaults restore per context, late loads preserve manual choices and unavailable sorts fall back',()=>{
 const refs=[],effects=[],pending=[];let ri=0,ei=0,selected='recent';const set=value=>{selected=value};
 const react={useRef(initial){const i=ri++;return refs[i]??(refs[i]={current:initial})},useEffect(fn,deps){const i=ei++;if(!effects[i]||deps.some((d,j)=>d!==effects[i][j])){effects[i]=deps;pending.push(fn)}}};
 const {useLibrarySortDefault}=compile(native?'lib/use-library-sort-default.ts':'src/components/ideas/useLibrarySortDefault.ts',()=>react);
 const render=(key,saved,ready=true,allowed='recent,imdbTop100,friendsRating',fallback='recent')=>{ri=ei=0;const result=useLibrarySortDefault(key,saved,ready,allowed,fallback,set);pending.splice(0).forEach(fn=>fn());return result};
 render('series','imdbTop100');assert.equal(selected,'imdbTop100');
 render('movie','friendsRating');assert.equal(selected,'friendsRating');
 render('series','imdbTop100');assert.equal(selected,'imdbTop100');
 render('club/futbol','wanting',true,'wanting,done','wanting');assert.equal(selected,'wanting');
 render('club/basketbol','done',true,'wanting,done','wanting');assert.equal(selected,'done');
 render('movie',null,false).select('recent');render('movie','friendsRating');assert.equal(selected,'recent');
 render('movie','friendsRating').reset();render('movie',null);assert.equal(selected,'recent');
 render('series','deleted:list');assert.equal(selected,'recent');
});
