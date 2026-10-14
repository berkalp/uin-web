import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const source=fs.readFileSync('src/components/ideas/InlineTopicSearch.tsx','utf8');
const countCode=source.slice(source.indexOf('  const tabCount='),source.indexOf('  const scopeOptions='));
function count(id,overrides={}){
 const own={wishes:['w'],plans:['p','p2'],experiences:['e'],counts:{wishes:{place:1},plans:{place:2},experiences:{place:1}}};
 return vm.runInNewContext(ts.transpileModule(countCode+`;tabCount('${id}')`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,{audiences:{library:'everyone',plans:'me',experiences:'me'},hasCategoryCounts:true,categoryCountsLoading:false,scopeCount:()=>17731,viewerId:'viewer',kind:'all',tabMetadata:{'viewer:me':{data:own,error:false}},...overrides});
}
test('inactive library tabs show their own totals before navigation',()=>{
 assert.equal(count('library'),17731);assert.equal(count('plans'),2);assert.equal(count('experiences'),1);
 assert.match(source,/\{tabCount\(id\)\}/);
});
test('audience changes and account changes cannot expose another snapshot',()=>{
 assert.equal(count('plans',{audiences:{plans:'friends'}}),'…');
 assert.equal(count('plans',{viewerId:'other'}),'…');
 assert.equal(count('plans',{tabMetadata:{'viewer:me':{error:true,data:null}}}),'—');
 assert.equal(count('plans',{tabMetadata:{'viewer:me':{error:false,data:{plans:[],counts:{plans:{}}}}}}),0);
});
test('selected category resolves independently for every tab',()=>{
 assert.equal(count('plans',{kind:'place'}),2);assert.equal(count('experiences',{kind:'movie'}),0);
});
test('event covers have no library score badge; real errors remain distinct from empty invitations',()=>{
 for(const path of ['src/components/discover/DiscoverIntentCard.tsx','src/components/timeline/TimelineLibraryCardFace.tsx'])assert.doesNotMatch(fs.readFileSync(path,'utf8'),/CardRatingBadge/);
 const discover=fs.readFileSync('src/app/discover/page.tsx','utf8');
 assert.match(discover,/scopeOverride \?\? scope/);
 assert.match(discover,/runDiscoverSearch\(1,0,undefined,tabScope\)/);
 assert.match(discover,/Henüz katıldığın aktif bir etkinlik bulunmuyor/);
 assert.doesNotMatch(discover,/\{searchReadError\?\.message/);
 assert.match(discover,/!searchReadError &&/);
});
