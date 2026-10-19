import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const module={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/utils/boundedTargetProjection.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module,exports:module.exports});
const {boundedTargetProjection:project}=module.exports;
test('a slow group splits without replaying successful groups, losing cards or exceeding concurrency',async()=>{
 const ids=Array.from({length:70},(_,i)=>String(i)),successful=[],calls=[];let active=0,max=0;
 const result=await project(ids,async batch=>{active++;max=Math.max(max,active);calls.push([...batch]);await new Promise(r=>setImmediate(r));active--;if(batch.includes('23')&&batch.length>2)return {data:null,error:{code:'57014'}};successful.push(...batch);return{data:batch,error:null}},15,true);
 assert.equal(result.error,null);assert.equal(result.data.length,70);assert.equal(new Set(result.data).size,70);assert.deepEqual([...successful].sort(),[...ids].sort());assert.ok(max<=3);assert.equal(calls.filter(b=>b.includes('0')).length,1);assert.ok(calls.filter(b=>b.includes('23')).length>1);
});
test('a single card timeout fails closed; authorization and malformed responses are never retried as smaller groups',async()=>{
 for(const error of [{code:'57014'},{code:'42501'}]){let calls=0;const result=await project(['1','2'],async()=>{calls++;return {data:null,error}},2,true);assert.equal(result.data,null);assert.equal(result.error,error);assert.equal(calls,error.code==='57014'?2:1);}
 const incomplete=await project(['1'],async()=>({data:null,error:null}),15,true);assert.equal(incomplete.data,null);assert.ok(incomplete.error);
});
