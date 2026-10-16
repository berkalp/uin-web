import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function load(path,require=()=>{throw Error('Unexpected import')}){const module={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module,exports:module.exports,require});return module.exports;}
const common=load('src/utils/commonIntentTitle.ts'); const {activityEventLabel:event}=load('src/utils/eventPresentation.ts',()=>common); const title=common.commonIntentTitle;
 test('catalogue aliases survive spacing, case and apostrophe variants',()=>{
 assert.equal(title('  BACKPACKING  '),'Sırt Çantalı Gezi');
 assert.equal(title('Forest   walk'),'Orman Yürüyüşü');
 assert.equal(title("Children’s theatre visit"),'Çocuk Tiyatrosuna Gitmek');
 assert.equal(title("Children's theatre visit"),'Çocuk Tiyatrosuna Gitmek');
 });
 test('event titles translate only the activity segment and preserve DNA and custom names',()=>{
 assert.equal(event('Host a house gathering·Eskişehir'),'Ev Buluşması · Eskişehir');
 assert.equal(event('Backpacking  ·  Eskişehir'),'Sırt Çantalı Gezi · Eskişehir');
 assert.equal(event('My birthday · London'),'My birthday · London');
 assert.equal(event('Book club · Finding the Mother Tree'),'Kitap Kulübü · Finding the Mother Tree');
 });
