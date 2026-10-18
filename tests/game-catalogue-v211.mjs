import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const load=(file,imports={})=>{const module={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module,exports:module.exports,require:id=>imports[id]});return module.exports};
const {readGameCatalogue,gameMatches,gameGenreLabels,platformFamily}=load('src/utils/gameCatalogue.ts');
const {mobileCategoryPayload}=load('src/utils/mobileCardPayload.ts');
const {categoryCardPage}=load('src/utils/categoryCardPage.ts',{'@/utils/commonIntentTitle':{commonIntentTitle:s=>s}});
const data=JSON.parse(fs.readFileSync('scripts/game-catalogue-v211.json','utf8'));
test('FC 27 is the same shared card in PC, PlayStation and Xbox sport filters',()=>{
 const card=data.games.find(g=>g.source_title==='EA Sports FC 27');assert.ok(card);
 const game=readGameCatalogue(card.metadata);
 const projections=['pc','playstation','xbox'].map(p=>[card].filter(c=>gameMatches(readGameCatalogue(c.metadata),p,'sports')));
 assert.ok(projections.every(rows=>rows.length===1&&rows[0]===card));
 assert.equal(gameMatches(game,'pc','strategy'),false);
 assert.ok(gameGenreLabels(game).includes('Spor'));
});
test('unverified ranks and mobile-only games cannot enter PC/console lists',()=>{
 assert.equal(platformFamily('Windows Phone'),'mobile');
 assert.equal(gameMatches(readGameCatalogue({platforms:['Android','iOS']})),false);
 assert.equal(gameMatches(readGameCatalogue({platforms:['Android','PC (Microsoft Windows)']}),'pc'),true);
 const game=readGameCatalogue({lists:{xbox_most_played:{rank:1,as_of:'2026-10-18',source_url:'javascript:alert(1)'}}});
 assert.equal(gameMatches(game,'','','xbox_most_played'),false);
 assert.equal(gameMatches(undefined,'xbox'),false);
});
test('the compact mobile projection preserves all game facets and ranking evidence',()=>{
 const row={canonical_target_id:'one',game_catalog:readGameCatalogue(data.games.find(g=>g.source_title==='EA Sports FC 27').metadata)};
 assert.deepEqual(mobileCategoryPayload(row).game_catalog,row.game_catalog);
 for(const game of data.games)for(const list of Object.values(game.metadata.game_catalog.lists)){assert.match(list.source_url,/^https:\/\//);assert.match(list.as_of,/^\d{4}-\d{2}-\d{2}$/);assert.ok(Number.isInteger(list.rank)&&list.rank>0)}
});
test('source-ranked pagination retains ranking order, not popularity inside UIN',()=>{
 const rows=Array.from({length:25},(_,i)=>({canonical_target_id:String(i),title:`Game ${i}`,intent_people_count:i,item_kind:'game'}));
 const result=categoryCardPage(rows,2,'wanting',()=>0);
 assert.deepEqual(Array.from(result.catalogue,r=>r.canonical_target_id),['20','21','22','23','24']);
 assert.equal(result.pagination.total,25);
});
test('the catalogue contains one record per source game and illustrated physical games',()=>{
 assert.equal(new Set(data.games.map(g=>g.externalId)).size,data.games.length);
 assert.equal(data.boards.length,26);
 for(const name of ['Satranç','Tavla','Okey','Mangala','Go Oyunu','Catan'])assert.ok(data.boards.some(b=>b.title===name));
 assert.ok(data.boards.every(b=>b.cover.url.startsWith('https://')&&b.cover.attribution.license&&b.description));
 assert.ok(data.boards.find(b=>b.title==='Satranç').existing_target);
 assert.ok(data.boards.find(b=>b.title==='Go Oyunu').existing_target);
});
