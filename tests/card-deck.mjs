import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const code=ts.transpileModule(fs.readFileSync('src/utils/cardDeck.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
const module={exports:{}};vm.runInNewContext(code,{module,exports:module.exports});
const {deckPosition,deckSwipe,nearestEvents,reviewPreview}=module.exports;
test('left gestures show wanting then experiences; right gestures show chronological events without wrapping',()=>{
  let p=0;p=deckPosition(p,deckSwipe(-80,10),3);assert.equal(p,-1);
  p=deckPosition(p,-1,3);assert.equal(p,-2);assert.equal(deckPosition(p,-1,3),-2);
  assert.equal(deckPosition(0,deckSwipe(80,10),3),1);
  assert.equal(deckPosition(3,1,3),3);assert.equal(deckPosition(1,-1,3),0);
  assert.equal(deckPosition(0,1,null),1);assert.equal(deckPosition(1,1,null),1);
  assert.equal(deckPosition(1,1,0),1);assert.equal(deckPosition(1,-1,0),0);
  assert.equal(deckSwipe(20,0),0);assert.equal(deckSwipe(50,90),0);
});
test('events sort by actual start, unknown dates last, input order is not mutated',()=>{
  const events=[{id:'late',start:'2027-02-01'},{id:'unknown',start:null},{id:'early',start:'2026-11-01'}];
  assert.deepEqual(Array.from(nearestEvents(events,x=>x.start,x=>x.id),x=>x.id),['early','late','unknown']);
  assert.equal(events[0].id,'late');
});
test('review preview preserves the first sentence and supports multiline and unpunctuated long reviews',()=>{
  assert.equal(reviewPreview('Harika bir yer. Uzun yorumun devamı.'),'Harika bir yer.');
  assert.equal(reviewPreview('Nasıl güzel! İkinci cümle.'),'Nasıl güzel!');
  assert.equal(reviewPreview('İlk satır\nİkinci satır'),'İlk satır');
  assert.equal(reviewPreview('Kısa yorum'),'Kısa yorum');assert.equal(reviewPreview('x'.repeat(500)).length,241);
});

