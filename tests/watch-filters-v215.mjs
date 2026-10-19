import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

function load(file) {
  const module={exports:{}};
  const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  vm.runInNewContext(code,{module,exports:module.exports,URL,require:id=>load(path.resolve(path.dirname(file),id+'.ts'))});
  return module.exports;
}
const file=fs.existsSync('lib/watch-filters.ts')?'lib/watch-filters.ts':'src/utils/watchFilters.ts';
const {matchesWatchFilters,watchPlatformOptions,supportsWatchFilters}=load(file);
const offer=(name,types)=>({name,types,url:'https://example.com/title'});
const availability=providers=>({country:'TR',sourceUrl:'https://www.justwatch.com/tr/tv-sovu/sample',providers});
const netflix=availability([offer('Netflix',['FLATRATE']),offer('Amazon Video',['BUY'])]);
const exxen=availability([offer('Exxen',['FLATRATE'])]);

test('selecting several platforms includes either one, preserving a single shared card',()=>{
  const rows=[{id:1,a:netflix},{id:2,a:exxen},{id:3,a:availability([offer('Netflix',['FLATRATE']),offer('Exxen',['FLATRATE'])])}];
  const filters={providers:['Netflix','Exxen'],access:'subscription'};
  assert.deepEqual(rows.filter(row=>matchesWatchFilters(row.a,filters)).map(row=>row.id),[1,2,3]);
});
test('access must match the chosen provider, not another offer on the card',()=>{
  assert.equal(matchesWatchFilters(netflix,{providers:['Amazon Video'],access:'subscription'}),false);
  assert.equal(matchesWatchFilters(netflix,{providers:['Amazon Video'],access:'rent_buy'}),true);
  assert.equal(matchesWatchFilters(netflix,{providers:['Netflix'],access:'rent_buy'}),false);
  assert.equal(matchesWatchFilters(availability([offer('tabii',['FREE','ADS'])]),{providers:[],access:'free'}),true);
});
test('unknown or foreign availability stays visible without filters but never invents a platform match',()=>{
  for(const value of [null,undefined,{},availability([]),{...netflix,country:'US'}]){
    assert.equal(matchesWatchFilters(value,{providers:[],access:'all'}),true);
    assert.equal(matchesWatchFilters(value,{providers:['Netflix'],access:'all'}),false);
  }
});
test('provider options reflect the full catalogue and keep store, subscription and extra channels distinct',()=>{
  const options=watchPlatformOptions([netflix,exxen,netflix,availability([offer('Amazon Prime Video',['FLATRATE']),offer('MUBI',['FLATRATE']),offer('MUBI Amazon Channel',['FLATRATE'])])]);
  assert.equal(options.length,6);
  assert.ok(options.some(option=>option.id==='Amazon Prime Video'&&option.label==='Prime Video'));
  assert.ok(options.some(option=>option.id==='Amazon Video'&&option.label.includes('kirala')));
  assert.equal(new Set(options.map(option=>option.id)).size,options.length);
});
test('filtering before slicing includes matches beyond the first page and gives correct totals',()=>{
  const rows=Array.from({length:65},(_,id)=>({id,a:id<31?exxen:netflix}));
  const filtered=rows.filter(row=>matchesWatchFilters(row.a,{providers:['Netflix'],access:'subscription'}));
  assert.equal(filtered.length,34);
  assert.equal(filtered.slice(0,20)[0].id,31);
  assert.equal(filtered.slice(20).length,14);
});
test('watch filtering is contextual to movies and series',()=>{
  assert.equal(supportsWatchFilters('series'),true);assert.equal(supportsWatchFilters('movie'),true);
  for(const kind of ['book','artist','game','board_game','club','place','all'])assert.equal(supportsWatchFilters(kind),false);
});
