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

test('direct deck orders current events ahead of dated history and recovers missing IDs',()=>{
 const {cardDeckEvents:list,currentCardEvent:current}=module.exports;
 const rows=[{id:'past',phase:'past',date:'2026-01-01'},{id:'far',phase:'active',date:'2027-02-01'},{id:'near',phase:'active',date:'2027-01-01'},{id:'cancelled',phase:'cancelled',date:'2026-03-01'},{id:'done',phase:'completed',date:'2026-01-01'},{id:'near',phase:'active',date:'2027-01-01'}];
 const events=list(rows,e=>e.id,e=>e.phase,e=>e.date);
 assert.equal(events.map(e=>e.id).join(','),'near,far,cancelled,done,past');assert.equal(rows.length,6);
 assert.equal(current(events,null,e=>e.id).event.id,'near');
 assert.equal(current(events,'far',e=>e.id).index,1);
 assert.equal(current(events,'removed',e=>e.id).event.id,'near');
 assert.equal(current([],null,e=>e.id).index,-1);
});

test('library display prefers a single matching plan without deleting or conflating independent events',()=>{
 const group=module.exports.preferPlannedCardEvents;
 const base={ownerId:'host',activityId:'activity',title:'Sırt Çantalı Gezi · Eskişehir',location:'Eskişehir',start:'2099-10-26',end:'2099-10-27',visibility:'public',dna:['Eskişehir'],phase:'active',participants:0};
 const intent={...base,id:'intent'},plan={...base,id:'plan',planId:'plan'};
 const ids=rows=>Array.from(group(rows,x=>x),x=>x.id);
 assert.deepEqual(ids([intent,plan]),['plan']);assert.deepEqual(ids([plan,intent]),['plan']);
 assert.equal(intent.id,'intent'); // Source records remain untouched.
 for(const change of [{ownerId:'other'},{activityId:'other'},{start:'2099-11-01'},{end:'2099-11-02'},{location:'Ankara'},{title:'Özel gezi'},{dna:['Bolu']},{visibility:'private'},{phase:'cancelled'},{phase:'past'},{activityId:null},{participants:1},{viewerIsMember:true},{viewerRequest:'pending'},{viewerInvitation:'pending'}])assert.equal(ids([{...intent,...change},plan]).length,2,JSON.stringify(change));
 assert.equal(ids([intent,plan,{...plan,id:'plan2',planId:'plan2'}]).length,3,'two distinct plans are never merged');
 assert.equal(ids([intent,{...intent,id:'other-intent'}]).length,2,'standalone intentions remain independent');
});
test('personal badge includes only active owned or joined records, retaining historical cards for navigation',()=>{
 const rows=[{id:'active',state:'planned',date:'2099-01-01'},{id:'past',state:'planned',date:'2020-01-01'},{id:'cancelled',state:'cancelled',date:'2099-02-01'},{id:'completed',state:'completed',date:'2099-03-01'}];
 const visible=module.exports.cardDeckEvents(rows,x=>x.id,x=>phase([x.state],x.date,null,now),x=>x.date);
 assert.equal(visible.length,4);
 assert.equal(visible.filter(x=>phase([x.state],x.date,null,now)==='active').length,1);
});

test('active metric and navigation exclude history without losing historical records',()=>{
 const {cardDeckEvents:list,partitionCardEvents:split,currentCardEvent:current}=module.exports;
 const rows=[{id:'live',state:'planned',date:'2099-01-01'},{id:'past',state:'planned',date:'2020-01-01'},{id:'cancelled',state:'cancelled',date:'2099-02-01'},{id:'done',state:'completed',date:'2020-02-01'}];
 const classify=row=>phase([row.state],row.date,null,now),id=row=>row.id;
 const groups=split(list(rows,id,classify,row=>row.date),classify);
 assert.equal(groups.active.length,1);assert.equal(groups.history.length,3);
 assert.equal(current(groups.active,null,id).event.id,'live');
 assert.equal(adjacent(groups.active,'live',1,id),'live');
 assert.equal(current(groups.history,'past',id).event.id,'past');
 assert.equal(current(groups.active,'past',id).event.id,'live');
 const refreshed=split(rows.map(row=>row.id==='live'?{...row,state:'cancelled'}:row),classify);
 assert.equal(refreshed.active.length,0);assert.equal(refreshed.history.length,4);
 assert.equal(current(refreshed.active,'live',id).index,-1);
 assert.equal(current(refreshed.history,'past',id).event.id,'past');
 assert.equal(split([],classify).active.length,0);assert.equal(split([],classify).history.length,0);
 assert.equal(rows[0].state,'planned');
});
