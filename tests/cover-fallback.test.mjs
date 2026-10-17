import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),ts=require('typescript');
const mobile=fs.existsSync('lib/cover-policy.ts');
const policyPath=mobile?'lib/cover-policy.ts':'src/utils/coverPolicy.ts';
function load(file,stubs={}) {
 const m={exports:{}};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText,{module:m,exports:m.exports,require:id=>stubs[id]??require(id),encodeURIComponent,Set});
 return m.exports;
}
const policy=load(policyPath);
test('Turkish/English category equivalents and short-token false positives',()=>{
 for(const [name,expected]of [['trail running','sport'],['painting','art'],['basketball','sport'],['basketbol','sport'],['YÜRÜYÜŞ','sport'],['YAZILIM','technology'],['yapay zekâ','technology'],['ai','technology'],['chair','activity'],['fair','activity'],['MÜZİK','music'],['kitap','book'],['dizi','film'],['oyun','game'],['şehir','place'],['gönüllülük','community']])assert.equal(policy.coverCategory({activityName:name}),expected,name);
});
test('explicit type and category override title; generic kinds permit refinement',()=>{
 assert.equal(policy.coverCategory({cardType:'book',categoryName:'sports',activityName:'AI'}),'book');
 assert.equal(policy.coverCategory({cardType:'activity',categoryName:'spor',activityName:'AI'}),'sport');
 assert.equal(policy.coverCategory({cardType:'hobby',activityName:'painting'}),'art');
 assert.equal(policy.coverCategory({cardType:'club',activityName:'The Art Club'}),'sport');
 assert.equal(policy.coverCategory({cardType:'unknown',categoryName:null}),'activity');
});
test('fallback images are embedded category drawings, never remote dependencies',()=>{
 const images=Object.keys(policy.coverThemes).map(category=>policy.categoryCover(category));
 assert.equal(new Set(images).size,Object.keys(policy.coverThemes).length);
 for(const image of images){assert.ok(image.startsWith('data:image/svg+xml;'));assert.match(decodeURIComponent(image),/<path d=/);assert.ok(!decodeURIComponent(image).includes('<script'));}
 assert.deepEqual(Array.from(policy.coverSources('  a.jpg ','a.jpg','sport')),['a.jpg',policy.categoryCover('sport')]);
 assert.deepEqual(Array.from(policy.coverSources(' ',null,'book')),[policy.categoryCover('book')]);
});

// Exercise actual component error handlers with a small hook host. No browser/native render is claimed.
function mountCover(initialProps) {
 let state=[],cursor=0,key,props=initialProps;
 const react={useState(initial){const slot=cursor++,own=state;if(!(slot in own))own[slot]=initial;return[own[slot],value=>{own[slot]=typeof value==='function'?value(own[slot]):value;}];}};
 const stubs={'react':react,'@/utils/coverPolicy':policy,'@/lib/cover-policy':policy,'expo-image':{Image:'Image'},'react-native':{View:'View',Text:'Text',StyleSheet:{create:x=>x}}};
 const Component=mobile?load('components/mobile/mobile-cover-image.tsx',stubs).MobileCoverImage:load('src/components/media/ActivityCoverImage.tsx',stubs).default;
 function render(next=props){props=next;const child=Component(props);if(key!==child.key){state=[];key=child.key;}cursor=0;return child.type(child.props);}
 return {render};
}
function source(node){return mobile?node.props.source?.uri:node.props.src;}
test('broken primary and secondary reach category drawing then permanent local presentation',()=>{
 const style={opacity:0.8},mount=mountCover({src:'broken.jpg',fallbackSrc:'backup.jpg',cardType:'sport',alt:'Cover',style,className:'existing-layout'});
 let node=mount.render();assert.equal(source(node),'broken.jpg');assert.equal(node.props.style,style);
 const oldError=node.props.onError;oldError();oldError();node=mount.render();assert.equal(source(node),'backup.jpg');
 oldError();node=mount.render();assert.equal(source(node),'backup.jpg','late primary errors cannot skip the fallback');
 node.props.onError();node=mount.render();assert.equal(source(node),policy.categoryCover('sport'));
 node.props.onError();node=mount.render();assert.equal(node.type,mobile?'View':'svg');assert.equal(node.props.onError,undefined);
 if(!mobile){assert.equal(node.props.className,'existing-layout');assert.equal(node.props['data-cover-fallback'],'sport');}
});
test('missing source and duplicate fallback do not create retries or empty output',()=>{
 const mount=mountCover({src:' ',fallbackSrc:null,categoryName:'Kitap',alt:''});
 let node=mount.render();assert.equal(source(node),policy.categoryCover('book'));
 node.props.onError();node=mount.render();assert.equal(node.type,mobile?'View':'svg');
 const duplicate=mountCover({src:'same.jpg',fallbackSrc:'same.jpg',alt:''});node=duplicate.render();node.props.onError();assert.equal(source(duplicate.render()),policy.categoryCover('activity'));
});
test('new source, fallback or category resets failures and ignores detached callbacks',()=>{
 const mount=mountCover({src:'old.jpg',cardType:'book',alt:''});let node=mount.render();const detached=node.props.onError;detached();
 node=mount.render({src:'new.jpg',cardType:'sport',alt:''});assert.equal(source(node),'new.jpg');detached();assert.equal(source(mount.render()),'new.jpg');
 node.props.onError();assert.equal(source(mount.render()),policy.categoryCover('sport'));
 node=mount.render({src:'new.jpg',fallbackSrc:'new-backup.jpg',cardType:'sport',alt:''});assert.equal(source(node),'new.jpg');node.props.onError();assert.equal(source(mount.render()),'new-backup.jpg');
});
if(!mobile)test('existing explicit cover precedence is preserved',()=>{
 const {resolveActivityCover}=load('src/utils/activityCover.ts',{'@/utils/coverPolicy':policy});
 assert.equal(resolveActivityCover({planCoverUrl:' plan.jpg ',activityCoverUrl:'activity.jpg',categoryCoverUrl:'category.jpg'}),'plan.jpg');
 assert.equal(resolveActivityCover({planCoverUrl:' ',activityCoverUrl:'activity.jpg',categoryCoverUrl:'category.jpg'}),'activity.jpg');
 assert.equal(resolveActivityCover({categoryCoverUrl:'category.jpg'}),'category.jpg');
 assert.equal(resolveActivityCover({categoryName:'Spor',activityName:'AI'}),policy.categoryCover('sport'));
});
