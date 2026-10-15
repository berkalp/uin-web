import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const module={exports:{}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/utils/cardDeck.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:module.exports,module,Intl,Date});
const {cardEventPhase:phase,unresolvedCardEvents:unresolved,selectedCardEvent:selected,adjacentCardEvent:adjacent}=module.exports;
const now=new Date('2026-10-16T00:30:00+03:00');
test('Istanbul dates and explicit lifecycle states do not turn overdue events into completed events',()=>{
 assert.equal(phase(['active'],'2026-10-15',null,now),'past');
 assert.equal(phase(['active'],'2026-10-15','2026-10-16',now),'active');
 assert.equal(phase(['active'],null,'2026-10-15T22:30:00Z',now),'active');
 assert.equal(phase(['expired'],null,null,now),'past');
 assert.equal(phase(['completed','expired'],null,null,now),'completed');
 assert.equal(phase(['active','cancelled'],null,null,now),'cancelled');
 assert.equal(phase(['forming'],null,null,now),'active');
});
test('one distinct list is used for counts and selection, including unresolved past events',()=>{
 const rows=[{id:'a',state:'active'},{id:'b',state:'past'},{id:'a',state:'active'},{id:'c',state:'completed'},{id:'d',state:'cancelled'}];
 const list=unresolved(rows,x=>x.id,x=>x.state);
 assert.equal(list.length,2);assert.equal(list[1].id,'b');
 assert.equal(selected(list,'b',x=>x.id).index,1);
 assert.equal(selected([...list].reverse(),'b',x=>x.id).index,0);
 assert.equal(selected(list.slice(0,1),'b',x=>x.id).event,undefined);
 assert.equal(selected([],null,x=>x.id).index,-1);
});
test('event navigation clamps endpoints and retains IDs for zero, one and many rows',()=>{
 const rows=Array.from({length:20},(_,i)=>({id:String(i)})),id=x=>x.id;
 assert.equal(adjacent(rows,'0',-1,id),'0');assert.equal(adjacent(rows,'19',1,id),'19');
 assert.equal(adjacent(rows,'0',1,id),'1');assert.equal(adjacent(rows,'1',-1,id),'0');
 assert.equal(adjacent(rows.slice(0,1),'0',1,id),'0');assert.equal(adjacent([],null,1,id),null);
 assert.equal(adjacent(rows,'deleted',1,id),null);
});
