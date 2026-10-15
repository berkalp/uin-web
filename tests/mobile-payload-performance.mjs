import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const module={exports:{}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/utils/mobileCardPayload.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module,exports:module.exports});
const{mobileCategoryPayload,mobileClubPayload}=module.exports;
test('compact cards retain every field consumed by the native parser, including null ratings and ownership',()=>{
  const consumed=['canonical_target_id','title','catalog_item_id','subtitle','catalog_cover_url','cover_url','cover_position_y','latitude','longitude','content_type_id','content_type_ids','own_seed_id','own_common_intent_id','own_seed_status','parent_target_id','hierarchy_sort_order','hierarchy_section_title','hierarchy_depth','child_count','average_rating','rating_count','follower_count','related_count','artist_stats','imdb_rank','imdb_rating','imdb_id','book_lists','book_list_ranks','series_lists','series_list_ranks','series_awards'];
  const full=Object.fromEntries(consumed.map(key=>[key,key]));full.average_rating=null;full.created_at='2026-10-15T12:00:00Z';full.catalog_cover_url='cover';full.cover_url='cover';
  const compact=mobileCategoryPayload(full);
  for(const key of consumed)if(!['cover_url','social_intent_count'].includes(key))assert.equal(compact[key],full[key],key);
  assert.equal(compact.average_rating,null);assert.equal(compact.created_at,full.created_at);assert.ok(!('cover_url' in compact));
  assert.ok(!('rating_count' in mobileCategoryPayload({title:'incomplete'})));
  assert.equal(mobileCategoryPayload({cover_url:'fallback'}).cover_url,'fallback');
});
test('directory preserves identities, league memberships, colors and logos without duplicate aliases',()=>{
  const full={target_id:'a',parent_target_id:'parent',title:'Team',catalogItemId:'catalog',sport:'Futbol',league:'League',leagues:['League','UEFA'],division:'Erkek',season:'2026',displayName:'Team',display_name:'Team',coverUrl:'cover',logoUrl:'logo',logo_url:'logo',cardStyle:{primary:'red'},ownStyle:null};
  const compact=mobileClubPayload(full);
  for(const key of Object.keys(full).filter(key=>!['display_name','logo_url'].includes(key)))assert.deepEqual(compact[key],full[key]);
  assert.ok(!('logo_url' in compact));assert.ok(!('display_name' in compact));assert.ok(!('wanting' in compact));
});
