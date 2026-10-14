import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
function load(path,modules={},append=""){const module={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path,'utf8')+append,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText,{module,exports:module.exports,require:id=>modules[id]??require(id),Intl,Date});return module.exports;}
test('web main card preserves badges, counts and original planned actions while removing its event-name preview',()=>{
  let deck;
  const {default:Card}=load('src/components/cards/LibraryTopicCard.tsx',{
    './LibraryCardDeck':{default:props=>{deck=props;return React.createElement('article',null,typeof props.children==='function'?props.children(()=>{}):props.children);}},
    '@/components/cards/ArtistPopularityBadges':{default:()=>null},'@/utils/uinCardLanguage':load('src/utils/uinCardLanguage.ts'),
    '@/utils/cardStyle':{cardFrameStyle:()=>({})},'@/utils/club-card-labels':{clubCardLabels:()=>null},'@/utils/commonIntentTitle':load('src/utils/commonIntentTitle.ts'),
    '@/components/cards/CardRatingBadge':{default:()=>React.createElement('span',null,'UIN ★ 10/10 · 2')},
    '@/components/cards/LibraryPlanActions':{default:()=>React.createElement('button',null,'Plan action preserved')},
  });
  const item={canonical_target_id:'bolu',title:'Bolu',item_kind:'place',cover_url:'cover.jpg',catalog_cover_url:null,seed_type_slug:'visit',intent_people_count:1,experience_people_count:2,active_event_count:2,child_count:9,own_common_intent_id:'wish',own_seed_status:'completed',personal_event:{resource_id:'event',title:'Araba Yolculuğu',viewer_role:'owner'}};
  const props={item,contentTypes:[{id:'place',base_kind:'place',label:'Yer'}],scope:'plans',onOpen:()=>{},onCancel:()=>{}};
  const html=renderToStaticMarkup(React.createElement(Card,props));
  for(const text of ['Bolu','cover.jpg','9 bağlı kart','Gitmek isteyenler','Gidenler','Aktif etkinlikler','Deneyimimi düzenle','Gezi etkinliği','Plan action preserved'])assert.ok(html.includes(text),text);
  assert.ok(!html.includes('Araba Yolculuğu'));assert.equal(deck.targetId,'bolu');assert.equal(deck.initialPlans,true);
  props.scope='wishes';item.personal_start_date=null;
  const undated=renderToStaticMarkup(React.createElement(Card,props));assert.ok(undated.includes('Tarih belirtilmemiş'));assert.ok(undated.includes('Niyet tarihini düzenle'));assert.ok(!undated.includes('uin-layout-card-preview'));
  item.item_kind='hobby';props.contentTypes=[{id:'learn',base_kind:'hobby',label:'Öğrenme',ui_labels:{want:'Öğrenmek istiyorum',done:'Öğrendim',wanting:'Öğrenmek isteyenler',doers:'Öğrenenler'}}];props.categoryContextId='learn';item.own_common_intent_id=null;item.own_seed_status=null;
  renderToStaticMarkup(React.createElement(Card,props));assert.equal(deck.wanting,'Öğrenmek isteyenler');assert.equal(deck.doers,'Öğrenenler');assert.equal(deck.actions.wantLabel,'Öğrenmek istiyorum');
});

test('metric buttons navigate the deck directly, including empty events',()=>{
 const moves=[];let opens=0;
 const {default:Card}=load('src/components/cards/LibraryTopicCard.tsx',{
 './LibraryCardDeck':{default:props=>React.createElement('article',null,props.children(face=>moves.push(face)))},
 '@/components/cards/ArtistPopularityBadges':{default:()=>null},'@/utils/uinCardLanguage':load('src/utils/uinCardLanguage.ts'),
 '@/utils/cardStyle':{cardFrameStyle:()=>({})},'@/utils/club-card-labels':{clubCardLabels:()=>null},'@/utils/commonIntentTitle':{commonIntentTitle:x=>x},
 '@/components/cards/CardRatingBadge':{default:()=>null},'@/components/cards/LibraryPlanActions':{default:()=>null},
 });
 const element=Card({item:{canonical_target_id:'artist',title:'Artist',item_kind:'artist',intent_people_count:2,experience_people_count:1,active_event_count:0},contentTypes:[],scope:'library',onOpen:()=>opens++,onCancel:()=>{}});
 const main=element.props.children(face=>moves.push(face));
 const walk=node=>{if(!node)return;if(Array.isArray(node)){node.forEach(walk);return;}if(node.props?.['aria-label']?.endsWith('Listeyi gör'))node.props.onClick();if(node.props)walk(node.props.children);};walk(main);
 assert.deepEqual(moves,[-1,-2,1]);assert.equal(opens,0);
});

test('web faces include the viewer first, real rating and compact own actions; empty events keep the cover',()=>{
 let position=-1,states;const clicks=[];
 const community={viewerId:'viewer',card:{title:'Artist'},events:[],social:{average_rating:8,rating_count:1},people:[{id:'other',user_id:'friend',full_name:'Friend',is_current:true},{id:'own',user_id:'viewer',full_name:'Self',is_current:true}],reviews:[{seed_id:'own-review',user_id:'viewer',full_name:'Self review',rating:8,experience_date:'2026-10-01',body:'Harikaydı.'}]};
 const {Deck}=load('src/components/cards/LibraryCardDeck.tsx',{
 react:{...React,useState:initial=>[states.length?states.shift():initial,()=>{}]},
 '@/utils/libraryAudience':{useLibraryAudience:()=>({audience:'friends',rows:[{target_id:'artist',scope:'wishes',user_ids:['friend']}]})},
 '@/utils/cardDeckAccount':{useCardDeckAccount:()=> 'viewer'},
 '@/utils/cardDeck':load('src/utils/cardDeck.ts'),
 '@/components/discover/DiscoverIntentCard':{default:()=>null},'@/components/seeds/TogetherProposal':{default:()=>null},
 },'\nexports.Deck=Deck;');
 const actions={editWish:()=>clicks.push('wish'),cancelWish:()=>clicks.push('cancel'),editExperience:()=>clicks.push('review'),createEvent:()=>clicks.push('event'),wantLabel:'Dinlemek istiyorum',doneLabel:'Dinledim'};
 const render=()=>{states=[position,community,'',0,430];return renderToStaticMarkup(React.createElement(Deck,{targetId:'artist',account:'viewer',coverUrl:'artist.jpg',wanting:'İsteyenler',doers:'Dinleyenler',actions}));};
 let html=render();assert.ok(html.indexOf('Self')<html.indexOf('Friend'));assert.equal((html.match(/Düzenle/g)||[]).length,1);assert.ok(html.includes('İptal'));
 position=-2;html=render();assert.ok(html.includes('Self review'));assert.ok(html.includes('★ 8/10'));assert.ok(html.includes('Deneyimimi düzenle'));assert.ok(!html.includes('＋ Dinledim'));
 community.reviews=[];html=render();assert.ok(html.includes('＋ Dinledim'));
 position=1;html=render();assert.ok(html.includes('artist.jpg'));assert.ok(html.includes('İlk buluşmayı sen başlatabilirsin'));assert.ok(html.includes('＋ Etkinlik düzenle'));
});
