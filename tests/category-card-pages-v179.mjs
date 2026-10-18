import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function compile(path,modules={}){const compiled={exports:{}};const code=ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;vm.runInNewContext(code,{module:compiled,exports:compiled.exports,require:name=>modules[name]||{},URL,Number,Map,Set,Array,Error,Promise,Buffer,console:{error(){}}});return compiled.exports}
const titles=compile('src/utils/commonIntentTitle.ts');
const pageModule=compile('src/utils/categoryCardPage.ts',{'@/utils/commonIntentTitle':titles});
const {categoryCardPage}=pageModule;
const cards=Array.from({length:57},(_,i)=>({canonical_target_id:`id-${i}`,title:['İzmir','Isparta','Ankara','Zonguldak'][i%4]+String(i),item_kind:'book',content_type_id:'book',intent_people_count:i%7,experience_people_count:(56-i)%9,active_event_count:i%3,average_rating:i%10,rating_count:2,parent_target_id:i===5?'id-2':null,child_count:i===2?1:0}));
const legacySource=fs.readFileSync('src/components/ideas/InlineTopicSearch.tsx','utf8').match(/function compareCards\([^\n]+/)[0];
const legacy=vm.runInNewContext(ts.transpileModule(legacySource+'\ncompareCards',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,{commonIntentTitle:titles.commonIntentTitle,gameListForSort:()=>null,artistListForSort:()=>null,bookListForSort:()=>null,seriesListForSort:()=>null,eventCount:c=>Number(c.active_event_count??c.social_intent_count??0)});
for(const sort of pageModule.CATEGORY_PAGE_SORTS)test(`every ${sort} page matches complete legacy ranking and hierarchy`,()=>{
 const baseline=cards.filter(c=>!c.parent_target_id).sort((a,b)=>legacy(a,b,sort));
 const merged=[];
 for(let n=1;n<=3;n++){const result=categoryCardPage(cards,n,sort);assert.equal(result.pagination.total,56);assert.equal(result.pagination.pages,3);assert.equal(result.pagination.page,n);assert.deepEqual(Array.from(result.catalogue),baseline.slice((n-1)*20,n*20));merged.push(...result.catalogue)}
 assert.deepEqual(merged,baseline);assert.equal(new Set(merged.map(c=>c.canonical_target_id)).size,56);
});
test('cross-category parents and unavailable parents remain browseable; complete row data is retained',()=>{const rows=[{...cards[0],canonical_target_id:'parent',content_type_id:'writer'},{...cards[1],parent_target_id:'parent'},{...cards[2],parent_target_id:'hidden-parent'}];const result=categoryCardPage(rows,1,'alphabetical');assert.equal(result.pagination.total,3);for(const row of result.catalogue)assert.ok(rows.includes(row))});
test('empty categories and out-of-range pages use the existing clamp semantics',()=>{assert.deepEqual(JSON.parse(JSON.stringify(categoryCardPage([],100,'wanting'))),{catalogue:[],pagination:{page:1,pages:1,total:0}});assert.equal(categoryCardPage(cards,100,'wanting').pagination.page,3)});
test('mixed geography and team categories preserve the complete-data path',()=>{for(const kind of ['place','club'])assert.equal(categoryCardPage([...cards,{...cards[0],item_kind:kind}],1,'wanting'),null)});
function categoryRoute(failure=null,latest=false){
 const rows=latest?cards.map((card,i)=>({...card,canonical_target_id:`00000000-0000-0000-0000-${String(1000-i).padStart(12,'0')}`,created_at:'2025-01-01T00:00:00Z',last_activity_at:'2026-10-15T12:00:00.123456+00:00'})):cards;
 const batches=[];const calls=[];const latestArgs=[];const db={from:table=>{let ids;const chain={select:()=>chain,eq:()=>chain,not:()=>chain,order:()=>chain,range:()=>chain,in:(_key,value)=>{ids=value;return chain},then:resolve=>Promise.resolve({data:table==='uin_content_types'?[{id:'book',base_kind:'book',active:true}]:rows.filter(c=>!ids||ids.includes(c.canonical_target_id)).map(c=>({canonical_target_id:c.canonical_target_id,card_honours:[]})),error:null}).then(resolve)};return chain},rpc:async(name,args)=>{calls.push(name);if(args?.p_target_ids)batches.push(args.p_target_ids.length);if(name===failure)return {data:null,error:{code:'57014'}};let data;
 if(name==='get_uin_latest_placements_v187'||name==='get_uin_latest_placements_v188'){latestArgs.push(args);const start=args.p_before_id?rows.findIndex(row=>row.canonical_target_id===args.p_before_id)+1:0;data=rows.slice(start,start+21).map(row=>({...row,id:row.canonical_target_id}))}
 else if(name==='get_uin_type_placements_v177')data=rows.map(c=>({id:c.canonical_target_id,canonical_target_id:c.canonical_target_id,item_kind:'book',content_type_id:'book'}));
 else if(name==='get_uin_cover_positions_v62')data=rows.slice(0,-1).map(c=>({target_id:c.canonical_target_id,cover_position_y:50}));
 else if(name==='get_uin_catalogue_for_targets_v123')data=rows.map(c=>({...c,completed_event_count:0,expired_event_count:0,cancelled_event_count:0}));
 else if(name==='get_uin_card_social_v87')data=rows.map(c=>({target_id:c.canonical_target_id,average_rating:c.average_rating,rating_count:2,follower_count:1,related_count:0}));
 else if(name==='get_uin_card_parent_edges_v143')data=rows.map(c=>({target_id:c.canonical_target_id,parent_target_id:c.parent_target_id}));
 else throw Error(name);if(args?.p_target_ids)data=data.filter(r=>args.p_target_ids.includes(r.target_id??r.canonical_target_id));return {data,error:null}}};
 const route=compile('src/app/api/ideas/category-cards/route.ts',{'next/server':{NextResponse:{json:(body,options={})=>({body,status:options.status||200,headers:options.headers})}},'@/supabase/supabase-js':{},'@/utils/supabase/server':{createClient:async()=>db},'@/utils/boundedTargetProjection':compile('src/utils/boundedTargetProjection.ts'),'@/utils/latestLibraryCursor':compile('src/utils/latestLibraryCursor.ts'),'@/utils/mobileCardPayload':compile('src/utils/mobileCardPayload.ts'),'@/utils/categoryCardPage':pageModule,'@/utils/cardHonours':{readCardHonours:r=>r.card_honours??[]},'@/utils/artistListMetadata':compile('src/utils/artistListMetadata.ts'),'@/utils/imdbMetadata':{readImdbMetadata:()=>({})},'@/utils/bookListMetadata':{readBookListMetadata:()=>({})},'@/utils/seriesListMetadata':{readSeriesListMetadata:()=>({})}});
 return {calls,batches,latestArgs,request:params=>route.GET({headers:{get:()=>null},nextUrl:new URL(`https://example.invalid/api/ideas/category-cards?kind=${latest?'all':'book'}&`+params)})};
}
test('paged API equals slicing the complete visibility-checked response; hidden targets do not enter totals',async()=>{const route=categoryRoute();const full=await route.request('');const paged=await route.request('page=2&sort=wanting');assert.equal(paged.status,200);const expected=categoryCardPage(full.body.catalogue,2,'wanting');assert.deepEqual(JSON.parse(JSON.stringify(paged.body)),JSON.parse(JSON.stringify(expected)));assert.equal(paged.body.catalogue.length,20);assert.equal(paged.body.pagination.total,55);assert.equal(paged.headers['Cache-Control'],'private, max-age=60, must-revalidate')});
test('invalid paging is rejected and projection failures never produce a partial page',async()=>{for(const params of ['page=0','page=-1','page=1.5','page=9007199254740993','page=1&sort=friendsRating'])assert.equal((await categoryRoute().request(params)).status,400);for(const rpc of ['get_uin_cover_positions_v62','get_uin_catalogue_for_targets_v123','get_uin_card_social_v87','get_uin_card_parent_edges_v143']){const result=await categoryRoute(rpc).request('page=1');assert.equal(result.status,503);assert.equal(result.body.catalogue,undefined);assert.equal(result.body.pagination,undefined)}});

test('opt-in compact API retains visible identities and metrics; legacy response remains complete',async()=>{const full=await categoryRoute().request('');const compact=await categoryRoute().request('compact=1');assert.equal(compact.status,200);const {mobileCategoryPayload}=compile('src/utils/mobileCardPayload.ts');assert.deepEqual(JSON.parse(JSON.stringify(compact.body.catalogue)),JSON.parse(JSON.stringify(full.body.catalogue.map(mobileCategoryPayload))));assert.equal(compact.headers.Vary,'Cookie, Authorization');for(const rpc of ['get_uin_cover_positions_v62','get_uin_catalogue_for_targets_v123','get_uin_card_social_v87'])assert.equal((await categoryRoute(rpc).request('compact=1')).status,503)});

test('latest feed enriches only 20 targets, retains microsecond cursor and advances without repetition',async()=>{
 const route=categoryRoute(null,true);const first=await route.request('compact=1');assert.equal(first.status,200);assert.equal(first.body.catalogue.length,20);assert.ok(first.body.nextCursor);
 const cursor=JSON.parse(Buffer.from(first.body.nextCursor,'base64url'));assert.equal(cursor.time,'2026-10-15T12:00:00.123456+00:00');
 const next=await route.request('cursor='+first.body.nextCursor);assert.equal(next.body.catalogue.length,20);assert.equal(new Set([...first.body.catalogue,...next.body.catalogue].map(row=>row.canonical_target_id)).size,40);
 assert.ok(route.batches.every(size=>size===20));assert.ok(!route.calls.includes('get_uin_type_placements_v177'));
 assert.equal((await route.request('cursor=bad')).status,400);
});
test('latest feed failures return retryable errors, never a false empty page',async()=>{
 for(const failure of ['get_uin_latest_placements_v187','get_uin_cover_positions_v62','get_uin_catalogue_for_targets_v123','get_uin_card_social_v87']){
   const response=await categoryRoute(failure,true).request('');assert.equal(response.status,503);assert.equal(response.body.catalogue,undefined);
 }
});

// The feed cursor follows action time even when catalogue dates disagree.
test('activity feed forwards each audience and preserves both timestamps',async()=>{
 const route=categoryRoute(null,true);
 for(const audience of ['everyone','friends','me']){
  const result=await route.request('audience='+audience+'&compact=1');
  assert.equal(result.status,200);assert.equal(route.latestArgs.at(-1).p_audience,audience);
  const row=result.body.catalogue[0];assert.equal(row.created_at,'2025-01-01T00:00:00Z');
  assert.equal(row.last_activity_at,'2026-10-15T12:00:00.123456+00:00');
  assert.equal(JSON.parse(Buffer.from(result.body.nextCursor,'base64url')).time,row.last_activity_at);
 }
 assert.equal((await route.request('audience=someone-else')).status,400);
});

test('personalized feed passes selected categories to the database before the bounded page projection',async()=>{
 const route=categoryRoute(null,true),result=await route.request('categories=movie,artist,movie&audience=friends');
 assert.equal(result.status,200);assert.ok(route.calls.includes('get_uin_latest_placements_v188'));assert.ok(!route.calls.includes('get_uin_latest_placements_v187'));
 assert.deepEqual(Array.from(route.latestArgs[0].p_categories),['artist','movie']);assert.equal(route.latestArgs[0].p_audience,'friends');assert.ok(route.batches.every(size=>size===20));
 const next=await route.request('categories=movie,artist&cursor='+result.body.nextCursor);assert.equal(next.status,200);assert.deepEqual(Array.from(route.latestArgs[1].p_categories),['artist','movie']);assert.ok(route.latestArgs[1].p_before_id);
 for(const categories of ['all','artist,,movie','artist%26audience%3Dme',Array.from({length:101},(_,i)=>'c'+i).join(',')])assert.equal((await categoryRoute(null,true).request('categories='+categories)).status,400);
 assert.equal((await categoryRoute('get_uin_latest_placements_v188',true).request('categories=artist')).status,503);
});
