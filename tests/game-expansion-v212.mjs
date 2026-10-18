import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const mod={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/utils/gameCatalogue.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:mod,exports:mod.exports});
const {readGameCatalogue,gameMatches,tabletopMatches,gameHonours,platformFamily,GAME_LISTS}=mod.exports;
test('arcade, Atari consoles and retro ports remain distinct filters on one card',()=>{
 const game=readGameCatalogue({platforms:['Arcade','PlayStation','Atari 2600','Nintendo Entertainment System']});
 for(const platform of ['arcade','playstation','atari','nintendo','retro'])assert.ok(gameMatches(game,platform));
 assert.equal(platformFamily('Atari ST/STE'),'pc');
 assert.equal(platformFamily('Arcade'),'arcade');
 assert.equal(gameMatches(readGameCatalogue({platforms:['Android','iOS']})),false);
});
test('awards are not numbered as rankings and both kinds fit the compact preview',()=>{
 const game=readGameCatalogue({lists:{tga_2024:{rank:1,source_url:'https://thegameawards.com/rewind/year-2024',as_of:'2026-10-18'},xbox_most_played:{rank:8,source_url:'https://www.xbox.com/',as_of:'2026-10-18'}},awards:[{label:'TGA · Yılın Oyunu',year:2024,source_url:'https://thegameawards.com/rewind/year-2024'},{label:'TGA · En İyi Aile Oyunu',year:2024,source_url:'https://thegameawards.com/rewind/year-2024'}]});
 const honours=gameHonours(game);assert.equal(honours.length,3);assert.match(honours[0].label,/2024/);assert.equal(honours[1].label,'Xbox #8');assert.ok(honours.every(h=>!h.label.includes('TGA #')));
 assert.equal(GAME_LISTS.filter(l=>/^tga_/.test(l.id)).length,10);
});
test('tabletop roleplaying and fantasy are shared facets, with no console leakage',()=>{
 const game=readGameCatalogue({game_catalog:{tabletop_types:['tabletop_rpg','fantasy','made_up'],platforms:[],lists:{ennie:{rank:1,source_url:'https://ennie-awards.com/2025-winners/',as_of:'2026-10-18'}}}});
 assert.ok(tabletopMatches(game,'tabletop_rpg','ennie'));assert.ok(tabletopMatches(game,'fantasy'));assert.equal(tabletopMatches(game,'strategy'),false);assert.equal(gameMatches(game,'pc'),false);assert.equal(game.tabletop_types.length,2);
});
test('new catalogue covers ten award years without duplicate game identities',()=>{
 const data=JSON.parse(fs.readFileSync('scripts/game-expansion-v212.json','utf8'));
 assert.equal(new Set(data.games.map(g=>g.externalId)).size,data.games.length);
 for(let year=2016;year<=2025;year++)assert.ok(data.games.some(g=>g.metadata.game_catalog.awards.some(a=>a.year===year)));
 const god=data.games.find(g=>g.externalId==='19560');assert.equal(god.title,'God of War (2018)');assert.equal(god.existing_id,null);
 const sf=data.games.find(g=>g.externalId==='3186');assert.equal(sf.existing_id,'940fe426-3fb1-4b39-814a-cf18c35fb530');
 for(const title of ['Dungeons & Dragons','Pathfinder','Shadowdark RPG'])assert.ok(data.boards.find(b=>b.title===title)?.metadata.game_catalog.tabletop_types.includes('tabletop_rpg'));
 assert.equal(data.boards.filter(b=>b.metadata.game_catalog.lists.bgg_top10).length,10);
 assert.ok(data.boards.every(b=>b.cover?.url?.startsWith('https://')));
});
