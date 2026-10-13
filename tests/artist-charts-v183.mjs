import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
function load(file,stubs={}){const m={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText,{module:m,exports:m.exports,require:id=>stubs[id]??require(id),Intl});return m.exports}
const lib=load('src/utils/artistListMetadata.ts');
const sample={spotify_monthly_listeners:154000001,spotify_listener_rank:1,spotify_chart_as_of:'2026-10-12',spotify_chart_source:'https://kworb.net/spotify/listeners.html'};
test('world lists have exact cutoffs, preserve source/date, and never turn missing data into zero',()=>{
 const stats=lib.readArtistMetadata(sample);assert.equal(stats.monthlyListeners,154000001);assert.equal(lib.artistListRank(stats,'spotify_global_100'),1);
 assert.equal(lib.artistListRank(lib.readArtistMetadata({...sample,spotify_listener_rank:101}),'spotify_global_100'),null);
 assert.equal(lib.artistListRank(lib.readArtistMetadata({...sample,spotify_listener_rank:500}),'spotify_global_500'),500);
 assert.equal(lib.artistListRank(lib.readArtistMetadata({...sample,spotify_listener_rank:501}),'spotify_global_500'),null);
 for(const value of [null,{}, {...sample,spotify_monthly_listeners:null},{...sample,spotify_chart_as_of:null},{...sample,spotify_chart_source:'javascript:alert(1)'},{...sample,spotify_monthly_listeners:-2}]){assert.equal(lib.readArtistMetadata(value).monthlyListeners,null);assert.equal(lib.readArtistMetadata(value).globalRank,null)}
 assert.equal(lib.readArtistMetadata(stats).monthlyListeners,154000001);
});
test('Türkiye annual rankings stay separate from global monthly listener ranks',()=>{
 const stats=lib.readArtistMetadata({artist_list_ranks:{tr_wrapped_2025:1,tr_groups_wrapped_2025:10,unknown:1},artist_list_source_url:'https://example.com/2025'});
 assert.equal(stats.monthlyListeners,null);assert.equal(lib.artistListRank(stats,'spotify_global_100'),null);assert.equal(lib.artistListRank(stats,'tr_wrapped_2025'),1);
 assert.equal(lib.artistListRank(lib.readArtistMetadata({artist_list_ranks:{tr_wrapped_2025:21},artist_list_source_url:'https://example.com/2025'}),'tr_wrapped_2025'),null);
 assert.equal(lib.artistListRank(lib.readArtistMetadata({artist_list_ranks:{tr_wrapped_2025:1}}),'tr_wrapped_2025'),null);
 const badges=lib.artistBadges(stats);assert.equal(badges.length,2);assert.ok(badges[0].text.includes('2025'));assert.ok(badges[0].description.includes('Türkiye’deki dinlenmeler'));
});
test('existing card badges render verified statistics with clickable attribution',()=>{
 const Component=load('src/components/cards/ArtistPopularityBadges.tsx',{'@/utils/artistListMetadata':lib}).default;
 const html=renderToStaticMarkup(React.createElement(Component,{stats:lib.readArtistMetadata(sample)}));
 assert.ok(html.includes('aylık dinleyici'));assert.ok(html.includes('Dünya Top 100'));assert.ok(html.includes('#1'));assert.ok(html.includes('12.10.2026'));assert.ok(html.includes('href="https://kworb.net/spotify/listeners.html"'));
 assert.equal(renderToStaticMarkup(React.createElement(Component,{})),'');
});
test('curated Türkiye list ranks are complete, unique, sourced, and reuse Spotify identities',()=>{
 const data=JSON.parse(fs.readFileSync('scripts/artist-charts-v183.json','utf8'));assert.equal(data.period,'2025');assert.equal(new Set(data.artists.map(a=>a.spotify_id)).size,28);
 for(const [id,size] of [['tr_wrapped_2025',20],['tr_groups_wrapped_2025',10]])assert.deepEqual(data.artists.flatMap(a=>a.ranks[id]?[a.ranks[id]]:[]).sort((a,b)=>a-b),Array.from({length:size},(_,i)=>i+1));
 assert.equal(data.artists.find(a=>a.ranks.tr_wrapped_2025===1).title,'BLOK3');assert.equal(data.artists.find(a=>a.ranks.tr_groups_wrapped_2025===1).title,'Dedublüman');
});
test('the actual library comparator orders chart positions numerically and keeps existing UIN sorts',()=>{
 const source=fs.readFileSync('src/components/ideas/InlineTopicSearch.tsx','utf8').match(/function compareCards\([^\n]+/)[0];
 const compare=vm.runInNewContext(ts.transpileModule(source+'\ncompareCards',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,{commonIntentTitle:x=>x,artistListForSort:s=>s.startsWith('artist:')?s.slice(7):null,artistListRank:lib.artistListRank,bookListForSort:()=>null,seriesListForSort:()=>null,eventCount:c=>c.active_event_count});
 const cards=[10,2,1].map(rank=>({title:`Artist ${rank}`,intent_people_count:rank,artist_stats:lib.readArtistMetadata({...sample,spotify_listener_rank:rank})}));
 assert.deepEqual(cards.slice().sort((a,b)=>compare(a,b,'artist:spotify_global_100')).map(c=>c.artist_stats.globalRank),[1,2,10]);
 assert.deepEqual(cards.slice().sort((a,b)=>compare(a,b,'wanting')).map(c=>c.intent_people_count),[10,2,1]);
});

const {readArtistMetadata,artistListRank,artistBadges}=lib;

test('regional ranks require the verified market, date and official artist chart URL',()=>{
 const row={rank:2,weekly_views:12345,as_of:'2026-10-08',region:'US',source_url:'https://charts.youtube.com/charts/TopArtists/us/weekly/2026-10-08'};
 const stats=readArtistMetadata({artist_regional_charts:{youtube_us_100:row}});
 assert.equal(artistListRank(stats,'youtube_us_100'),2);
 assert.equal(artistListRank(readArtistMetadata(stats),'youtube_us_100'),2);
 assert.equal(artistListRank(stats,'spotify_global_100'),null);
 assert.equal(stats.monthlyListeners,null);
 for(const patch of [{region:'FR'},{rank:101},{weekly_views:null},{source_url:'https://example.com/origin-list'},{as_of:null}])assert.equal(artistListRank(readArtistMetadata({artist_regional_charts:{youtube_us_100:{...row,...patch}}}),'youtube_us_100'),null);
 assert.match(artistBadges(stats)[0].text,/YouTube ABD/);
});
