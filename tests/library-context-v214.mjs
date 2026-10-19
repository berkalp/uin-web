import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
function load(file){const module={exports:{}};const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;vm.runInNewContext(code,{module,exports:module.exports,URL,require:id=>id.startsWith('./')?load(path.resolve(path.dirname(file),id+'.ts')):require(id)});return module.exports;}
const {readWatchAvailability,watchProviderTypes}=load('src/utils/watchAvailability.ts');
const sourceUrl='https://www.justwatch.com/tr/tv-sovu/gibi';
test('Turkey availability supports multiple providers and distinguishes rental from subscription',()=>{
 const a=readWatchAvailability({watch_availability:{country:'TR',sourceUrl,providers:[{name:'Exxen',url:'https://www.exxen.com/tr/',type:'FLATRATE'},{name:'Prime Video',url:'https://www.primevideo.com/',types:['RENT','BUY']},{name:'Exxen',url:'https://www.exxen.com/tr/',type:'FLATRATE'}]}});
 assert.equal(a.providers.length,2);assert.equal(watchProviderTypes(a.providers[0]),'Abonelik');assert.equal(watchProviderTypes(a.providers[1]),'Kiralama / Satın alma');
 assert.equal(readWatchAvailability({...a,country:'US'}),null);
 assert.equal(readWatchAvailability({...a,sourceUrl:'https://www.justwatch.com.evil/tr/x'}),null);
 assert.equal(readWatchAvailability({...a,providers:[{name:'Unsafe',url:'javascript:alert(1)',type:'FLATRATE'}]}).providers.length,0);
 assert.equal(readWatchAvailability({...a,providers:[]}).providers.length,0,'No service is invented for unavailable titles');
});
test('compact mobile payload retains streaming availability',()=>{
 const {mobileCategoryPayload}=load('src/utils/mobileCardPayload.ts');
 assert.equal(mobileCategoryPayload({watch_availability:{country:'TR',sourceUrl,providers:[]}}).watch_availability.sourceUrl,sourceUrl);
});
test('all ten requested supported regions validate their own country and period',()=>{
 const {readArtistMetadata,artistListRank,ARTIST_LISTS}=load('src/utils/artistListMetadata.ts');
 for(const region of ['TR','GB','DE','US','JP','KR','SA','IN','BR','FR']){
  const id='youtube_'+region.toLowerCase()+'_100',date='2026-10-15';assert.ok(ARTIST_LISTS.some(x=>x.id===id));
  const row={rank:1,weekly_views:100,as_of:date,region,source_url:`https://charts.youtube.com/charts/TopArtists/${region.toLowerCase()}/weekly/${date}`};
  assert.equal(artistListRank(readArtistMetadata({artist_regional_charts:{[id]:row}}),id),1);
  assert.equal(artistListRank(readArtistMetadata({artist_regional_charts:{[id]:{...row,region:'XX'}}}),id),null);
 }
 assert.ok(!ARTIST_LISTS.some(x=>['youtube_cn_100','youtube_qa_100'].includes(x.id)));
});
test('verification dates are hidden while award years and source links remain',()=>{
 const {readCardHonours}=load('src/utils/cardHonours.ts');
 const [h]=readCardHonours({card_honours:[{kind:'award',label:'UEFA Süper Kupa',url:'https://www.uefa.com/',note:'Kazandığı yıllar: 2000. Kontrol: 19.10.2026.'}]});
 assert.equal(h.note,'Kazandığı yıllar: 2000.');assert.ok(h.url.includes('uefa.com'));
});
test('verified import has unique identities and exactly 100 ranks in each supported region',()=>{
 const d=JSON.parse(fs.readFileSync('scripts/library-context-v214.json','utf8'));
 assert.equal(new Set(d.media.map(x=>x.justwatch_id)).size,d.media.length);
 assert.equal(new Set(d.artists.map(x=>x.youtube_artist_id)).size,d.artists.length);
 for(const region of d.regions){const key='youtube_'+region.toLowerCase()+'_100',rows=d.artists.flatMap(a=>a.charts[key]?[a.charts[key]]:[]);assert.equal(rows.length,100);assert.equal(new Set(rows.map(x=>x.rank)).size,100);}
 for(const r of d.media.filter(x=>!x.catalog_id)){assert.match(r.imdb_id,/^tt\d+$/);assert.match(r.cover,/^https:\/\/images.justwatch.com\//);}
 const gibi=d.media.find(x=>x.imdb_id==='tt13675832');assert.ok(gibi.watch_availability.providers.some(x=>x.name==='Exxen'));
});
