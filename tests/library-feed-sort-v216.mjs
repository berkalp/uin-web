import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

function load(file){
 const module={exports:{}};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module,exports:module.exports,Buffer,require:id=>load(path.resolve(path.dirname(file),id+'.ts'))});
 return module.exports;
}
const {LIBRARY_FEED_SORTS,libraryFeedSort,isLibraryFeedSort}=load('src/utils/libraryFeedSort.ts');
const {encodeRankedLibraryCursor:encode,decodeRankedLibraryCursor:decode}=load('src/utils/rankedLibraryCursor.ts');
const scope=JSON.stringify(['everyone',['movie','series']]);
const value={sort:'ratingDesc',scope,value:9.4,tie:10,time:'2026-10-19T08:00:00.123456+00:00',id:'12345678-1234-1234-1234-123456789abc'};

test('all six choices have stable shared values and the native rating preference maps correctly',()=>{
 assert.equal(LIBRARY_FEED_SORTS.length,6);
 for(const sort of LIBRARY_FEED_SORTS)assert.equal(isLibraryFeedSort(sort.id),true);
 assert.equal(libraryFeedSort('uinRating'),'ratingDesc');
 assert.equal(libraryFeedSort('imdbTop100'),'recent');
 assert.equal(isLibraryFeedSort('invalid'),false);
});
test('ranked pagination preserves score, tie breaker and full timestamp precision',()=>{
 assert.equal(JSON.stringify(decode(encode(value),'ratingDesc',scope)),JSON.stringify(value));
 assert.equal(decode(null,'likes',scope),null);
});
test('old pages cannot be reused after changing the sort, audience or selected categories',()=>{
 assert.throws(()=>decode(encode(value),'likes',scope));
 assert.throws(()=>decode(encode(value),'ratingDesc',JSON.stringify(['me',['series']])));
});
test('malformed and partial cursors fail closed',()=>{
 for(const overrides of [{value:-1},{value:'9'},{tie:0.2},{time:'invalid'},{id:'invalid'},{tie:-1},{sort:'recent'},{value:null}])
  assert.throws(()=>decode(encode({...value,...overrides}),'ratingDesc',scope));
 for(const raw of ['not-base64','e30','x'.repeat(16001)])assert.throws(()=>decode(raw,'ratingDesc',scope));
});
