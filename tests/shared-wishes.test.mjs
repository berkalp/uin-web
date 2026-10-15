import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function load(file,deps={}){const module={exports:{}};vm.runInNewContext(ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,{module,exports:module.exports,require:id=>{if(!(id in deps))throw Error(id);return deps[id]},setTimeout,clearTimeout,AbortController,document:{body:{}},console});return module.exports;}
function harness(){const values=[];let i=0;const react={useState(initial){const n=i++;if(!(n in values))values[n]=initial;return [values[n],value=>values[n]=typeof value==='function'?value(values[n]):value]},useEffect(){}};return {react,render(fn,props){i=0;return fn(props)}};}
const jsx=(type,props)=>({type,props});
const runtime={jsx,jsxs:jsx,Fragment:'fragment'};
function nodes(tree){if(!tree)return [];if(Array.isArray(tree))return tree.flatMap(nodes);if(typeof tree!=='object')return [];return [tree,...nodes(tree.props?.children)];}
function text(tree){if(tree==null)return '';if(Array.isArray(tree))return tree.map(text).join('');if(typeof tree!=='object')return String(tree);return text(tree.props?.children);}
const flush=()=>new Promise(resolve=>setImmediate(resolve));

const {hasSharedWish,sharedWishWords}=load('src/utils/sharedWish.ts');
test('only two active wishes on the same canonical target count as shared',()=>{
 const active={isOwner:false,status:'active',targetId:'book-a',cardTargetId:'book-a',ownSeedId:'mine',ownSeedStatus:'active'};
 assert.equal(hasSharedWish(active),true);
 for(const patch of [{isOwner:true},{status:'completed'},{status:'archived'},{ownSeedStatus:'completed'},{ownSeedStatus:null},{cardTargetId:'book-b'},{targetId:null},{ownSeedId:null}])assert.equal(hasSharedWish({...active,...patch}),false,JSON.stringify(patch));
 assert.equal(hasSharedWish({...active,ownSeedStatus:'completed',ownCommonIntentId:'current-personal-wish'}),true);
 assert.equal(hasSharedWish({...active,ownSeedId:null,ownCommonIntentId:null,rating:10,followerCount:1}),false);
});
test('invitation wording follows the card category',()=>{
 assert.equal(sharedWishWords('book','Berna Kalınbaçoğlu').button,'Birlikte okumayı öner');
 assert.equal(sharedWishWords('book','Berna').message,'İkiniz de bu kitabı okumak istiyorsunuz.');
 for(const [kind,verb] of [['place','gitmeyi'],['movie','izlemeyi'],['series','izlemeyi'],['game','oynamayı'],['artist','dinlemeyi'],['activity','yapmayı']])assert.equal(sharedWishWords(kind,'Berna').button,`Birlikte ${verb} öner`);
});

test('opening the centered proposal prepares only; sending requires its explicit submit button',async()=>{
 const h=harness(),calls=[];
 const supabase={rpc(name,args){calls.push({name,args});const response=Promise.resolve({error:null,data:name==='prepare_uin_together_v71'?{allowed:true}:name==='get_uin_card_activity_options_v106'?[{id:'read',name:'Birlikte okuma'}]:null});response.abortSignal=()=>response;return response}};
 const {default:Proposal}=load('src/components/seeds/TogetherProposal.tsx',{'react':h.react,'react/jsx-runtime':runtime,'react-dom':{createPortal:child=>child},'@/utils/supabase/client':{supabase}});
 const props={targetId:'original-book',recipientId:'berna-id',name:'Berna',title:'Kitap',loadOptionsOnOpen:true,buttonLabel:'Birlikte okumayı öner'};
 let tree=h.render(Proposal,props);assert.equal(calls.length,0);
 nodes(tree).find(n=>n.type==='button').props.onClick();await flush();
 tree=h.render(Proposal,props);assert.equal(calls.length,2);assert(calls.every(c=>!c.name.startsWith('send_')));assert(text(tree).includes('Berna'));
 nodes(tree).find(n=>n.type==='button'&&text(n)==='Vazgeç').props.onClick();tree=h.render(Proposal,props);assert(!nodes(tree).some(n=>n.props?.role==='dialog'));assert.equal(calls.length,2);
 nodes(tree).find(n=>n.type==='button').props.onClick();await flush();tree=h.render(Proposal,props);
 nodes(tree).find(n=>n.type==='button'&&text(n)==='Öneriyi gönder').props.onClick();await flush();
 const sent=calls.filter(c=>c.name.startsWith('send_'));assert.equal(sent.length,1);assert.equal(sent[0].args.p_target_id,'original-book');assert.equal(sent[0].args.p_recipient_id,'berna-id');assert.equal(sent[0].args.p_activity_id,'read');
});
test('permission denial cannot open the invitation form',async()=>{
 const h=harness();const supabase={rpc(){return {abortSignal:()=>Promise.resolve({data:{allowed:false,reason:'Öneri kabul etmiyor.'},error:null})}}};
 const {default:Proposal}=load('src/components/seeds/TogetherProposal.tsx',{'react':h.react,'react/jsx-runtime':runtime,'react-dom':{createPortal:child=>child},'@/utils/supabase/client':{supabase}});
 const props={targetId:'book',recipientId:'person',name:'Berna',title:'Kitap',activityOptions:[{id:'read',name:'Oku'}]};let tree=h.render(Proposal,props);nodes(tree).find(n=>n.type==='button').props.onClick();await flush();tree=h.render(Proposal,props);assert(!nodes(tree).some(n=>n.props?.role==='dialog'));assert(text(tree).includes('Öneri kabul etmiyor.'));
});

test('shared profile filter keeps only active mutual wishes and can return to all cards',()=>{
 const context={ready:true,onlyShared:true,sharedTargets:new Set(['book']),category:'',index:null,setOnlyShared(value){this.onlyShared=value}};
 const react={createContext:()=>({}),useContext:()=>context};
 const api=load('src/components/profile/ProfileCategoryFilter.tsx',{react,'react/jsx-runtime':runtime,'@/utils/supabase/client':{},'@/utils/libraryCategoryFilter':{matchesLibraryCategory:()=>true},'@/components/seeds/PublicSeedsPanel':{__esModule:true,default:'seeds'},'@/components/profile/ProfileActivityTabs':{__esModule:true,default:'events'}});
 const seeds=[{canonical_target_id:'book',status:'active'},{canonical_target_id:'other',status:'active'},{canonical_target_id:'book',status:'completed'}];
 assert.equal(api.CategoryPublicSeedsPanel({mode:'active',seeds}).props.seeds.length,1);
 assert.equal(api.CategoryPublicSeedsPanel({mode:'completed',seeds}),null);
 assert.equal(api.CategoryProfileActivityTabs({hostedCards:[],participatingCards:[]}),null);
 context.onlyShared=false;assert.equal(api.CategoryPublicSeedsPanel({mode:'active',seeds}).props.seeds.length,3);
});
