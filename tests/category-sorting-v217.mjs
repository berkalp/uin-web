import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
const native=fs.existsSync('lib/library-feed-sort.ts');
function load(file){const module={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module,exports:module.exports,URL,require:id=>load(path.resolve(path.dirname(file),id+'.ts'))});return module.exports;}
const {categoryLibrarySorts,librarySortExplanation}=load(native?'lib/library-feed-sort.ts':'src/utils/libraryFeedSort.ts');
const {matchesWatchFilters}=load(native?'lib/watch-filters.ts':'src/utils/watchFilters.ts');
const src=fs.readFileSync(native?'components/mobile-v2/v2-web-home.tsx':'src/components/ideas/InlineTopicSearch.tsx','utf8');
const filters={providers:['Netflix'],access:'subscription'};
const availability=name=>({country:'TR',sourceUrl:'https://www.justwatch.com/tr/tv-sovu/sample',providers:[{name,url:'https://example.com',types:['FLATRATE']}]});
const cards=Array.from({length:70},(_,i)=>({targetId:String(i),canonical_target_id:String(i),title:'Dizi '+String(i).padStart(3,'0'),
 watchAvailability:availability(i<32?'Exxen':'Netflix'),watch_availability:availability(i<32?'Exxen':'Netflix'),
 averageRating:i===67?10:5,average_rating:i===67?10:5,ratingCount:1,rating_count:1,
 experienceLikeCount:i===66?40:0,experience_like_count:i===66?40:0,
 doneCount:i===65?30:1,experience_people_count:i===65?30:1,
 wantingCount:i===64?20:1,intent_people_count:i===64?20:1,activeEventCount:i===63?10:0,active_event_count:i===63?10:0,
 createdAt:`2026-01-${String(i===62?31:1).padStart(2,'0')}T00:00:00Z`,created_at:`2026-01-${String(i===62?31:1).padStart(2,'0')}T00:00:00Z`}));
// A more popular card outside Netflix must never win the filtered ranking.
Object.assign(cards[0],{averageRating:10,average_rating:10,ratingCount:100,rating_count:100,experienceLikeCount:999,experience_like_count:999,doneCount:999,experience_people_count:999});
function ranked(sort){
 if(!native){const functionSource=src.match(/function compareCards\([^\n]+/)[0];const compare=vm.runInNewContext(ts.transpileModule(functionSource+'\ncompareCards',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,{commonIntentTitle:x=>x,gameListForSort:()=>null,artistListForSort:()=>null,bookListForSort:()=>null,seriesListForSort:()=>null,eventCount:c=>c.active_event_count});return cards.filter(c=>matchesWatchFilters(c.watch_availability,filters)).sort((a,b)=>compare(a,b,sort));}
 const start=src.indexOf('const filtered=useMemo(')+'const filtered=useMemo('.length;
 const end=src.indexOf('},[watchEnabled',start)+1;
 const code=ts.transpileModule('('+src.slice(start,end)+')()',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
 return vm.runInNewContext(code,{sort:sort==='ratingDesc'?'uinRating':sort,librarySearchKey:x=>x,searchQuery:'',displayState:{cards},cardMutationSnapshot:()=>null,mergeSavedCardState:c=>c,viewerId:null,gameListForSort:()=>null,artistListForSort:()=>null,bookListForSort:()=>null,seriesListForSort:()=>null,watchEnabled:true,matchesWatchFilters,watchFilters:filters,group:'series',currentGroup:{baseKind:'series'},inGroup:()=>true,latestEnabled:false,sortPersonal:(a,b)=>new Date(b.createdAt)-new Date(a.createdAt)});
}
test('every category has the same six metrics with contextual labels',()=>{
 for(const kind of ['movie','series','book','game','board_game','artist','place','club','sport','hobby','writer','activity','new_custom_type']){
  const options=categoryLibrarySorts(kind);assert.equal(options.length,6);assert.equal(new Set(options.map(o=>o.id)).size,6);assert.ok(options.some(o=>o.id==='likes'));
 }
 for(const [kind,word] of [['series','izlenen'],['movie','izlenen'],['book','okunan'],['game','oynanan'],['board_game','oynanan'],['place','gidilen']])assert.ok(categoryLibrarySorts(kind).find(o=>o.id==='done').label.includes(word));
 assert.match(librarySortExplanation('done'),/UIN/);assert.match(librarySortExplanation('likes'),/kalpler/);
});
for(const [sort,winner] of [['ratingDesc','67'],['likes','66'],['done','65'],['wanting','64'],['active','63'],['recent','62']])test(`${sort}: filter the full Netflix catalogue before ordering and pagination`,()=>{
 const result=ranked(sort);assert.equal(result.length,38);assert.equal(result[0].targetId,winner);assert.equal(result.slice(0,20).length,20);assert.equal(result.slice(20).length,18);assert.equal(new Set(result.map(c=>c.targetId)).size,38);assert.ok(!result.some(c=>c.targetId==='0'));
});
