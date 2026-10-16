import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import ts from 'typescript';
const module={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/utils/commonIntentTitle.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{module,exports:module.exports});
test('catalogue activity labels translate exact names without rewriting personal titles',()=>{const label=module.exports.commonIntentTitle;assert.equal(label('Backpacking'),'Sırt Çantalı Gezi');assert.equal(label('Photography Walk'),'Fotoğraf Yürüyüşü');assert.equal(label('Berkalp ile Backpacking anıları'),'Berkalp ile Backpacking anıları');assert.equal(label('Eskişehir'),'Eskişehir');});

test('full bundled activity catalogue is Turkish before remote translations arrive',()=>{
 const label=module.exports.commonIntentTitle;
 for(const [source,tr] of [['Woodworking','Ahşap İşçiliği'],['Camping Trip','Kamp Gezisi'],['Academic Writing','Akademik Yazım'],['Networking Meetup','İş Çevresi Buluşması'],['Pitch Practice','Fikir Sunumu Pratiği'],['Tabletop RPG','Masaüstü Rol Yapma Oyunu']])assert.equal(label(source),tr);
});

const presentation={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/utils/eventPresentation.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{module:presentation,exports:presentation.exports,require:()=>module.exports});
test('presentation labels translate explicit and compound catalogue titles, preserving custom titles',()=>{
 assert.equal(presentation.exports.activityEventLabel('Backpacking','Backpacking'),'Sırt Çantalı Gezi');
 assert.equal(presentation.exports.eventTitleFromPresentation({displayTitle:'Backpacking · Eskişehir'}),'Sırt Çantalı Gezi · Eskişehir');
 assert.equal(presentation.exports.activityEventLabel('Backpacking','Zeynep ile özel gezi'),'Zeynep ile özel gezi');
});
