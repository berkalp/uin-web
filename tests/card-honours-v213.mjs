import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
function load(file){const module={exports:{}};const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;vm.runInNewContext(code,{module,exports:module.exports,URL,require:id=>id.startsWith('./')?load(path.resolve(path.dirname(file),id+'.ts')):require(id)});return module.exports;}
const {readCardHonours}=load('src/utils/cardHonours.ts'),{resolveUinCardWords}=load('src/utils/uinCardLanguage.ts');
const honour={label:'🏆 11 Oscar',kind:'award',url:'https://awardsdatabase.oscars.org/Search/Nominations?filmId=1',note:'Kazanan kayıtları; adaylık değildir.'};
test('honours accept source-backed data across all categories and reject unsafe links',()=>{
 for(const kind of ['artist','movie','series','book','club','place','sport','hobby','activity','game'])assert.equal(readCardHonours({item_kind:kind,card_honours:[honour]}).length,1);
 assert.equal(readCardHonours({card_honours:[honour,honour,{...honour,url:'javascript:alert(1)'},{...honour,url:'http://example.com'},{...honour,note:''},{...honour,kind:'invented'}]}).length,1);
 assert.equal(readCardHonours({}).length,0,'No prize is invented when a source is absent');
});
test('legacy awards preserve scope and historical years without a ten-year cutoff',()=>{
 const hs=readCardHonours({book_awards:[{label:'Nobel Edebiyat',scope:'author',recipient:'Yazar',year:1901,sourceUrl:'https://www.nobelprize.org/'}],series_awards:[{label:'Emmy',year:1955,years:[1955,1956],sourceUrl:'https://www.televisionacademy.com/'}],card_honours:[{...honour,year:1929}]});
 assert.ok(hs.some(h=>h.year===1929));assert.ok(hs.some(h=>h.year===1901&&h.label.includes('Yazar ödülü')&&h.note.includes('kitabın kendi ödülü değildir')));assert.ok(hs.some(h=>h.note.includes('1956, 1955')));
});
test('every category uses appropriate action language while multi-category context remains editable',()=>{
 for(const[k,want,done,doers]of [['game','Oynamak istiyorum','Oynadım','Oynayanlar'],['book','Okumak istiyorum','Okudum','Okuyanlar'],['movie','İzlemek istiyorum','İzledim','İzleyenler'],['series','İzlemek istiyorum','İzledim','İzleyenler'],['place','Gitmek istiyorum','Gittim','Gidenler'],['club','Maç izlemek istiyorum','Maç izledim','Maç izleyenler']]){const w=resolveUinCardWords(k);assert.equal(w.want,want);assert.equal(w.done,done);assert.equal(w.doers,doers)}
 assert.equal(resolveUinCardWords('game',{manual_fallback:'true'}).want,'Oynamak istiyorum');
 assert.equal(resolveUinCardWords('activity',{want:'Öğrenmek istiyorum',done:'Öğrendim'}).done,'Öğrendim');
});
test('compact API preserves honours and their sources',()=>{
 const {mobileCategoryPayload}=load('src/utils/mobileCardPayload.ts');
 assert.equal(mobileCategoryPayload({card_honours:[honour]}).card_honours[0].url,honour.url);
});
test('reviewed seed keeps individual club branches and award counts auditable',()=>{
 const rows=JSON.parse(fs.readFileSync('scripts/card-honours-v213.json','utf8'));
 assert.equal(new Set(rows.map(r=>r.id)).size,rows.length);
 const gs=rows.filter(r=>r.title.startsWith('Galatasaray'));
 assert.ok(gs.find(r=>r.title.includes('Futbol')).honours.some(h=>h.label==='🏆 26 Süper Lig şampiyonluğu'));
 assert.ok(!gs.find(r=>r.title.includes('Futbol')).honours.some(h=>h.label.includes('EuroLeague')));
 assert.ok(gs.find(r=>r.title.includes('Basketbol')&&r.title.includes('Kadın')).honours.every(h=>!h.label.includes('Süper Lig')));
 assert.ok(rows.find(r=>r.title==='Titanic').honours.some(h=>h.label==='🏆 11 Oscar'));
 for(const r of rows){assert.equal(new Set(r.honours.map(h=>h.label+'|'+h.url)).size,r.honours.length,r.title);assert.equal(readCardHonours({card_honours:r.honours}).length,r.honours.length,r.title)}
});
