import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import vm from "node:vm";
function compile(path){const module={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path,"utf8"),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText,{module,exports:module.exports,Promise,Array,Error});return module.exports}
const {boundedTargetProjection}=compile("src/utils/boundedTargetProjection.ts");
test("large catalogues keep every row while limiting batch size and concurrency",async()=>{
 let active=0,maxActive=0;const sizes=[];const ids=Array.from({length:1201},(_,i)=>String(i));
 const result=await boundedTargetProjection(ids,async batch=>{active++;maxActive=Math.max(maxActive,active);sizes.push(batch.length);await Promise.resolve();active--;return {data:batch,error:null}});
 assert.equal(result.error,null);assert.equal(result.data.length,1201);assert.equal(new Set(result.data).size,1201);assert.ok(maxActive<=3);assert.ok(sizes.every(size=>size<=100));
});
test("partial projection failure never returns fabricated or incomplete counters",async()=>{
 const result=await boundedTargetProjection(Array.from({length:301},(_,i)=>String(i)),async batch=>batch.includes("100")?{data:null,error:new Error("timeout")}:{data:batch,error:null});assert.equal(result.data,null);assert.ok(result.error);
 const malformed=await boundedTargetProjection(["x"],async()=>({data:null,error:null}));assert.equal(malformed.data,null);assert.ok(malformed.error);
});
test("empty projections issue no database requests",async()=>{const result=await boundedTargetProjection([],()=>{throw Error("unexpected read")});assert.equal(result.data.length,0);assert.equal(result.error,null)});
test("one-row-per-target projections fit 500 cards into one bounded request",async()=>{let calls=0;const ids=Array.from({length:500},(_,i)=>String(i));const result=await boundedTargetProjection(ids,async batch=>{calls++;return{data:batch,error:null}},500);assert.equal(calls,1);assert.equal(result.data.length,500)});
test("sport memberships remain unique within a club branch and exclude baseball",()=>{
 const groups=JSON.parse(fs.readFileSync("scripts/sports-expansion-v176.json","utf8"));assert.ok(groups.length>400);
 for(const group of groups){assert.ok(group.name.trim());assert.ok(group.teams.every(team=>team.name.trim()));const keys=group.teams.map(team=>`${team.sport}:${team.division}`);assert.equal(new Set(keys).size,keys.length);assert.ok(group.teams.every(team=>team.sport!=="Beyzbol"));}
 const leagues=new Set(groups.flatMap(group=>group.teams.flatMap(team=>team.competitions)));for(const league of ["Premier League","EFL Championship","UEFA Champions League","UEFA Europa League","NBA","Sultanlar Ligi","Efeler Ligi","Hentbol Erkekler Süper Lig"])assert.ok(leagues.has(league));
});
