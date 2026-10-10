import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const read=path=>fs.readFileSync(path,"utf8");

function compileContextBuilder(){
  const source=read("src/utils/placeConnectionContext.ts");
  const code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText;
  const compiledModule={exports:{}};
  vm.runInNewContext(code,{module:compiledModule,exports:compiledModule.exports,require:()=>({}),Number,Object,String,encodeURIComponent});
  return compiledModule.exports.buildPlaceConnectionContext;
}

test("place card derives its bounded connection context from one card metadata row",()=>{
  const build=compileContextBuilder();
  const result=build({
    targetId:"fc6f828c-ea2e-406b-9be1-3b57d6b72531",
    catalogItemId:"0aefe34d-a8f9-4bf5-bbc9-7048457b4bfa",
    title:"Ankara",
    coverUrl:null,
    externalId:"city:323786",
    metadata:{country:"Türkiye",country_code:"TR",global_place_kind:"city",latitude:39.9207759,longitude:32.8540497,reference_url:"https://www.geonames.org/323786"},
    hierarchy:{kind:"İl",parent_target_id:"26ca10f8-d7d6-4c69-8022-ebf66217baeb"},
    childCount:25,
  });
  assert.equal(result.place.kind,"İl");
  assert.equal(result.place.country,"Türkiye");
  assert.equal(result.place.city,"Ankara");
  assert.equal(result.place.parentTargetId,"26ca10f8-d7d6-4c69-8022-ebf66217baeb");
  assert.match(result.place.mapUrl,/39\.9207759%2C32\.8540497/);
  assert.equal(result.childCount,25);
});

test("unknown coordinates and child totals stay unknown instead of becoming false zeroes",()=>{
  const build=compileContextBuilder();
  const result=build({targetId:"target",catalogItemId:"item",title:"Bilinmeyen yer",coverUrl:null,externalId:"",metadata:{latitude:null,longitude:null},hierarchy:{kind:"Yer"},childCount:null});
  assert.equal(result.place.mapUrl,"");
  assert.equal(result.childCount,null);
});

test("place connections never download the full place catalogue or hide missing data",()=>{
  const component=read("src/components/media/PlaceConnections.tsx");
  assert.doesNotMatch(component,/api\/places\/catalogue/);
  assert.doesNotMatch(component,/\bfetch\s*\(/);
  assert.doesNotMatch(component,/catch\(\(\)=>\{\}\)/);
  assert.match(component,/places\.find\(item=>item\.id===targetId\)\|\|context\?\.place/);
  assert.match(component,/item\.parentTargetId===place\.id\|\|item\.cityId===place\.id\|\|item\.cityId===place\.wikiId/);
  assert.match(component,/role="alert"/);
  assert.match(component,/const childrenKnown=knownChildCount!==null&&knownChildCount!==undefined/);
  assert.match(component,/Bağlı yer listesi bu görünümde doğrulanamadı/);
});

test("card detail reads only the selected place metadata and returns it with the existing detail",()=>{
  const route=read("src/app/api/ideas/[targetId]/route.ts");
  assert.match(route,/from\("seed_catalog_items"\)\.select\("id,external_id,metadata"\)\.eq\("id",catalogItemId\)\.eq\("status","active"\)\.maybeSingle\(\)/);
  assert.match(route,/placeContext=buildPlaceConnectionContext/);
  assert.match(route,/contentType:typeData,placeContext,communityCounts/);
  assert.doesNotMatch(route,/get_uin_catalogue_fast_v122/);
  assert.match(route,/Array\.isArray\(socialRows\)&&socialRows\.length===1/);
  assert.match(route,/targetMetricRow\(social,targetId\)/);
  assert.match(route,/!Array\.isArray\(relationsResult\.data\)/);
  assert.match(route,/!Array\.isArray\(activityOptionsResult\.data\)/);
  assert.doesNotMatch(route,/social:\(socialResult\.data\|\|\[\]\)\[0\]\|\|null/);
  assert.doesNotMatch(route,/relations:relationsResult\.data\|\|\[\]/);

  const modal=read("src/components/ideas/TopicCardModal.tsx");
  assert.match(modal,/context=\{detail\.placeContext\}/);
  assert.match(modal,/role="alert"[\s\S]*onClick=\{\(\)=>void load\(\)\}[\s\S]*Tekrar dene/);
});
