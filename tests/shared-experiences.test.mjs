import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import ts from 'typescript';
const module={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/utils/sharedExperiences.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{module,exports:module.exports});
const {companionPayload,sharedAction}=module.exports;
test('optional companions and ratings, with mandatory context only when sharing',()=>{
 assert.equal(companionPayload('',{}).friends.length,0);assert.throws(()=>companionPayload('',{emir:'10'}));
 for(const invalid of ['0','11','1.5','abc'])assert.throws(()=>companionPayload('concert',{emir:invalid}));
 assert.equal(companionPayload('concert',{emir:''}).friends[0].score,null);
 assert.equal(companionPayload('concert',{emir:'10'}).friends[0].score,10);
});
test('RPC errors and unavailable responses never masquerade as saved experiences',async()=>{
 await assert.rejects(sharedAction(null,'save'));
 await assert.rejects(sharedAction({rpc:async()=>({error:{message:'Denied'},data:null})},'save'),/Denied/);
 await assert.rejects(sharedAction({rpc:async()=>({error:null,data:null})},'save'));
 let call;await sharedAction({rpc:async(name,args)=>{call={name,args};return{data:{id:'shared'},error:null}}},'respond',{id:'shared',accept:true});
 assert.equal(call.name,'shared_experience_action');assert.equal(call.args.p_payload.accept,true);
});
