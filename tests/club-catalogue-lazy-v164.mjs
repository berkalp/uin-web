import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const read=path=>fs.readFileSync(path,"utf8");
const secondId="223e4567-e89b-42d3-a456-426614174000";
const catalogueIds=["323e4567-e89b-42d3-a456-426614174000","423e4567-e89b-42d3-a456-426614174000"];

function compileRoute(db){
  const source=read("src/app/api/clubs/catalogue/route.ts");
  const code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText;
  const compiledModule={exports:{}};
  const NextResponse={json:(body,init={})=>({body,status:init.status||200,headers:init.headers||{}})};
  vm.runInNewContext(code,{module:compiledModule,exports:compiledModule.exports,console:{error:()=>{}},Number,Map,Set,Error,Promise,require:name=>name==="next/server"?{NextResponse}:name==="@/utils/supabase/server"?{createClient:async()=>db}:{}});
  return compiledModule.exports;
}

test("club catalogue endpoint stays bounded and parallel",()=>{
  const source=read("src/app/api/clubs/catalogue/route.ts");
  assert.doesNotMatch(source,/get_uin_catalogue_fast_v122/);
  assert.doesNotMatch(source,/for\s*\(let offset/);
  assert.match(source,/const ids=\[\.\.\.new Set\(hierarchyRows\.map\(row=>targetId\(row\)\)\)\]/);
  const parallel=source.match(/const \[catalogue,summary,placements,styles\]=await Promise\.all\(\[([\s\S]*?)\]\);/)?.[1]||"";
  assert.match(parallel,/get_uin_catalogue_for_targets_v123/);
  assert.match(parallel,/get_uin_card_summary_v129/);
  assert.match(parallel,/seed_catalog_items/);
  assert.match(parallel,/get_uin_card_styles_v76/);
  assert.match(source,/const cardByTarget=new Map/);
  assert.match(source,/const summaryByTarget=new Map/);
  assert.match(source,/const styleByTarget=new Map/);
  assert.match(source,/const placementByTarget=new Map/);
  assert.doesNotMatch(source,/\.find\(/);
  assert.match(source,/if\(incompleteIds\.length\)throw/);
  assert.doesNotMatch(source,/Number\(stats\?\.(?:wanting|done|active)\s*\|\|\s*0\)/);
});

function endpointDb({dropSummary=false}={}){
  const calls=[];
  const hierarchy=[
    {target_id:validClub.target_id,parent_target_id:null,sport:"FUTBOL",division:"ERKEK",league:"Süper Lig",season:"2026",display_name:"Örnek Kulüp",logo_url:null},
    {target_id:secondId,parent_target_id:validClub.target_id,sport:"FUTBOL",division:"KADIN",league:"Süper Lig",season:"2026",display_name:"Örnek Takım",logo_url:null},
  ];
  const catalogue=hierarchy.map(row=>({canonical_target_id:row.target_id,title:row.display_name,catalog_cover_url:null,cover_url:null}));
  const summaries=hierarchy.filter((_,index)=>!dropSummary||index===0).map((row,index)=>({target_id:row.target_id,wanting:index+1,done:index+2,active:index}));
  const styles=hierarchy.map(row=>({target_id:row.target_id,card_style:null,own_style:null}));
  const placements=hierarchy.map((row,index)=>({id:catalogueIds[index],canonical_target_id:row.target_id,status:"active"}));
  return{
    calls,
    rpc:async name=>{calls.push(name);if(name==="get_club_hierarchy_v78")return{data:hierarchy,error:null};if(name==="get_uin_catalogue_for_targets_v123")return{data:catalogue,error:null};if(name==="get_uin_card_summary_v129")return{data:summaries,error:null};if(name==="get_uin_card_styles_v76")return{data:styles,error:null};return{data:null,error:new Error("unexpected rpc")}},
    from:()=>({select:()=>({in:async()=>({data:placements,error:null})})}),
  };
}

test("club endpoint keeps complete rows and fails closed when a projection is missing",async()=>{
  const completeDb=endpointDb();
  const complete=await compileRoute(completeDb).GET();
  assert.equal(complete.status,200);
  assert.equal(complete.body.clubs.length,2);
  assert.deepEqual(Array.from(complete.body.clubs,club=>[club.wanting,club.done,club.active]),[[1,2,0],[2,3,1]]);
  assert.ok(!completeDb.calls.includes("get_uin_catalogue_fast_v122"));

  const incomplete=await compileRoute(endpointDb({dropSummary:true})).GET();
  assert.equal(incomplete.status,503);
  assert.equal(incomplete.body.error,"Kulüp ve takım bilgileri yüklenemedi.");
});

test("ideas page loads club data only when club UI needs it",()=>{
  const source=read("src/components/ideas/InlineTopicSearch.tsx");
  assert.match(source,/import \{invalidateClubCatalogueCache,loadClubCatalogue\} from "@\/utils\/clubCatalogueClient"/);
  assert.match(source,/const needsClubCatalogue=viewerId!==undefined&&\(effectiveKind==="club"\|\|adminNeedsClubCatalogue\)/);
  assert.match(source,/useEffect\(\(\)=>\{if\(!needsClubCatalogue\)/);
  assert.match(source,/loadClubCatalogue\(geoRetry>0\)/);
  assert.doesNotMatch(source,/fetch\("\/api\/clubs\/catalogue"/);
});

test("club modals share the same validated catalogue request",()=>{
  const source=read("src/components/ideas/TopicCardModal.tsx");
  assert.match(source,/import \{loadClubCatalogue\} from "@\/utils\/clubCatalogueClient"/);
  assert.match(source,/if\(!isClub\)return/);
  assert.match(source,/loadClubCatalogue\(\)/);
  assert.match(source,/loadClubCatalogue\(true\)/);
  assert.doesNotMatch(source,/fetch\("\/api\/clubs\/catalogue"/);
});

function compileClient(fetchImpl){
  const source=read("src/utils/clubCatalogueClient.ts");
  const code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText;
  const compiledModule={exports:{}};
  vm.runInNewContext(code,{module:compiledModule,exports:compiledModule.exports,require:()=>({}),fetch:fetchImpl,Date,Error,Number,Promise});
  return compiledModule.exports;
}

const validClub={
  target_id:"123e4567-e89b-42d3-a456-426614174000",
  parent_target_id:null,
  sport:"Futbol",
  division:"Erkek",
  league:"Süper Lig",
  season:"2026",
  displayName:"Örnek Kulüp",
  title:"Örnek Kulüp",
  coverUrl:null,
  logoUrl:null,
  catalogItemId:catalogueIds[0],
  wanting:2,
  done:3,
  active:1,
};

test("shared loader deduplicates concurrent calls and rejects incomplete payloads",async()=>{
  let requests=0;
  const client=compileClient(async()=>{requests+=1;return{ok:true,json:async()=>({clubs:[validClub]})}});
  const [first,second]=await Promise.all([client.loadClubCatalogue(),client.loadClubCatalogue()]);
  assert.equal(requests,1);
  assert.equal(first[0].title,"Örnek Kulüp");
  assert.equal(second[0].active,1);
  await client.loadClubCatalogue();
  assert.equal(requests,1,"fresh successful data should be reused");
  client.invalidateClubCatalogueCache();
  await client.loadClubCatalogue();
  assert.equal(requests,2);

  const malformed=compileClient(async()=>({ok:true,json:async()=>({clubs:[{...validClub,wanting:null}]})}));
  await assert.rejects(()=>malformed.loadClubCatalogue(),/eksik geldi/);
});
