import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
function load(path,modules={}){const module={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText,{module,exports:module.exports,require:id=>modules[id]??require(id),Intl,Date});return module.exports;}
const categories=[{id:'sport',label:'Spor',icon:'🏇',base_kind:'sport',active:true,ui_labels:{want:'Spor yapmak istiyorum'}},{id:'writer',label:'Öğrenme & Beceri',icon:'🎓',base_kind:'activity',active:true,ui_labels:{want:'Öğrenmek istiyorum'}},{id:'hobby',label:'Hobi',icon:'🧩',base_kind:'hobby',active:true}];
test('one main card shows all categories, shared counters and the selected learning action',()=>{
 let deck;
 const {default:Card}=load('src/components/cards/LibraryTopicCard.tsx',{
 './LibraryCardDeck':{default:p=>{deck=p;return React.createElement('article',null,p.children(()=>{}));}},
 '@/components/media/ActivityCoverImage':{default:()=>null},
 '@/components/cards/ArtistPopularityBadges':{default:()=>null},
 '@/utils/uinCardLanguage':load('src/utils/uinCardLanguage.ts'),
 '@/utils/cardStyle':{cardFrameStyle:()=>({})},'@/utils/club-card-labels':{clubCardLabels:()=>null},
 '@/utils/commonIntentTitle':{commonIntentTitle:x=>x},'@/components/cards/CardRatingBadge':{default:()=>null},
 '@/components/cards/LibraryPlanActions':{default:()=>null},
 });
 const item={canonical_target_id:'one-riding-card',title:'At Biniciliği',content_type_id:'sport',content_type_ids:categories.map(c=>c.id),content_types:categories,item_kind:'sport',intent_people_count:2,experience_people_count:3,active_event_count:0};
 // Profile callers only know the primary type; the shared card still shows every membership.
 const html=renderToStaticMarkup(React.createElement(Card,{item,contentTypes:[categories[0]],categoryContextId:'sport',scope:'library',onOpen:()=>{},onCancel:()=>{}}));
 for(const label of ['Spor','Öğrenme &amp; Beceri','Hobi','At Biniciliği','İsteyenler'])assert.ok(html.includes(label),label);
 assert.equal(deck.targetId,'one-riding-card');assert.equal(deck.wanting,'İsteyenler');
 renderToStaticMarkup(React.createElement(Card,{item,contentTypes:categories,categoryContextId:'writer',scope:'library',onOpen:()=>{},onCancel:()=>{}}));
 assert.equal(deck.targetId,'one-riding-card');assert.equal(deck.actions.wantLabel,'Öğrenmek istiyorum');assert.equal(deck.wanting,'İsteyenler');
});
test('compact mobile transport preserves category names and purpose language',()=>{
 const {mobileCategoryPayload}=load('src/utils/mobileCardPayload.ts');
 const payload=mobileCategoryPayload({canonical_target_id:'one-card',content_type_ids:categories.map(c=>c.id),content_types:categories});
 assert.equal(payload.content_types.length,3);assert.equal(payload.content_types[1].ui_labels.want,'Öğrenmek istiyorum');
});

