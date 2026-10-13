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
test('web main card preserves badges, counts and original planned actions while removing its event-name preview',()=>{
  let deck;
  const {default:Card}=load('src/components/cards/LibraryTopicCard.tsx',{
    './LibraryCardDeck':{default:props=>{deck=props;return React.createElement('article',null,props.children);}},
    '@/components/cards/ArtistPopularityBadges':{default:()=>null},'@/utils/uinCardLanguage':load('src/utils/uinCardLanguage.ts'),
    '@/utils/cardStyle':{cardFrameStyle:()=>({})},'@/utils/club-card-labels':{clubCardLabels:()=>null},'@/utils/commonIntentTitle':load('src/utils/commonIntentTitle.ts'),
    '@/components/cards/CardRatingBadge':{default:()=>React.createElement('span',null,'UIN ★ 10/10 · 2')},
    '@/components/cards/LibraryPlanActions':{default:()=>React.createElement('button',null,'Plan action preserved')},
  });
  const item={canonical_target_id:'bolu',title:'Bolu',item_kind:'place',cover_url:'cover.jpg',catalog_cover_url:null,seed_type_slug:'visit',intent_people_count:1,experience_people_count:2,active_event_count:2,child_count:9,own_common_intent_id:'wish',own_seed_status:'completed',personal_event:{resource_id:'event',title:'Araba Yolculuğu',viewer_role:'owner'}};
  const props={item,contentTypes:[{id:'place',base_kind:'place',label:'Yer'}],scope:'plans',onOpen:()=>{},onCancel:()=>{}};
  const html=renderToStaticMarkup(React.createElement(Card,props));
  for(const text of ['Bolu','cover.jpg','9 bağlı kart','Gitmek isteyenler','Gidenler','Aktif etkinlikler','Deneyimimi düzenle','Gezi etkinliği','Plan action preserved'])assert.ok(html.includes(text),text);
  assert.ok(!html.includes('Araba Yolculuğu'));assert.equal(deck.targetId,'bolu');
  const actions=renderToStaticMarkup(React.createElement(React.Fragment,null,deck.wantAction,deck.doneAction));assert.ok(actions.includes('Düzenle'));assert.ok(actions.includes('İptal'));assert.ok(actions.includes('Deneyimimi düzenle'));
  item.item_kind='hobby';props.contentTypes=[{id:'learn',base_kind:'hobby',label:'Öğrenme',ui_labels:{want:'Öğrenmek istiyorum',done:'Öğrendim',wanting:'Öğrenmek isteyenler',doers:'Öğrenenler'}}];props.categoryContextId='learn';item.own_common_intent_id=null;item.own_seed_status=null;
  renderToStaticMarkup(React.createElement(Card,props));assert.equal(deck.wanting,'Öğrenmek isteyenler');assert.equal(deck.doers,'Öğrenenler');assert.ok(renderToStaticMarkup(deck.wantAction).includes('Öğrenmek istiyorum'));
});
