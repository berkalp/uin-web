type Row = Record<string, any>;
export type BookDetails = {title:string;subtitle?:string;summary:string;image?:string;source:string;sourceUrl:string;facts:[string,string][];links:{label:string;url:string}[];notice?:string};
export const bookPlain=(value:unknown)=>typeof value==='string'?value.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,'').replace(/<(?:br\s*\/?|\/p)>/gi,'\n').replace(/<[^>]+>/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&nbsp;/g,' ').replace(/[ \t]+/g,' ').replace(/ *\n */g,'\n').trim():'';
export function bookUrl(value:unknown){if(typeof value!=='string')return undefined;try{const u=new URL(value);return ['http:','https:'].includes(u.protocol)?u.href.replace(/^http:/,'https:'):undefined}catch{return undefined}}
const strings=(v:unknown):string[]=>Array.isArray(v)?v.filter(x=>typeof x==='string'):[];
const language=(v:string)=>({tr:'Türkçe',en:'İngilizce',de:'Almanca',fr:'Fransızca',es:'İspanyolca',it:'İtalyanca'} as Record<string,string>)[v]||v;
export function googleBookDetails(row:Row):BookDetails{
 const v=row.volumeInfo||{},a=row.accessInfo||{},s=row.saleInfo||{};
 const image=Object.values({large:v.imageLinks?.large,medium:v.imageLinks?.medium,small:v.imageLinks?.small,thumbnail:v.imageLinks?.thumbnail}).map(bookUrl).find(Boolean);
 const identifiers=(v.industryIdentifiers||[]).filter((x:Row)=>['ISBN_10','ISBN_13'].includes(x.type)&&typeof x.identifier==='string');
 const facts:[string,string][]=[['Yazar',strings(v.authors).join(' · ')],['Yayınevi',bookPlain(v.publisher)],['Yayın tarihi',bookPlain(v.publishedDate)],['Sayfa sayısı',Number.isInteger(v.pageCount)&&v.pageCount>0?String(v.pageCount):''],['Dil',language(v.language||'')],['Konular',strings(v.categories).join(' · ')],...identifiers.map((x:Row)=>[x.type==='ISBN_13'?'ISBN-13':'ISBN-10',x.identifier] as [string,string]),['Google Books puanı',typeof v.averageRating==='number'?v.averageRating+'/5'+(v.ratingsCount?' · '+v.ratingsCount+' değerlendirme':''):'']];
 const links=[{label:'Google Books’ta görüntüle',url:bookUrl(v.canonicalVolumeLink)||bookUrl(v.infoLink)||'https://books.google.com/books?id='+encodeURIComponent(row.id)},...(['PARTIAL','ALL_PAGES'].includes(a.viewability)&&bookUrl(v.previewLink)?[{label:a.viewability==='ALL_PAGES'?'Kitabı oku':'Önizlemeyi oku',url:bookUrl(v.previewLink)!}]:[]),...(bookUrl(s.buyLink)?[{label:'Satın alma bilgileri',url:bookUrl(s.buyLink)!}]:[])];
 return {title:bookPlain(v.title),subtitle:bookPlain(v.subtitle),summary:bookPlain(v.description),image,source:'Google Books',sourceUrl:links[0].url,facts:facts.filter(x=>x[1]),links,notice:'Yayın tarihi, sayfa sayısı, dil ve ISBN bu kaynakta listelenen baskıya aittir.'};
}
export async function bookJson(url:string):Promise<any>{const r=await fetch(url,{headers:{Accept:'application/json','User-Agent':'UIN/1.0 book-details'},signal:AbortSignal.timeout(12000),next:{revalidate:3600}});if(!r.ok)throw Error('Kitap kaynağı şu anda yanıt vermiyor.');return r.json()}
const values=(e:Row,p:string)=>(e.claims?.[p]||[]).filter((c:Row)=>c.rank!=='deprecated').map((c:Row)=>c.mainsnak?.datavalue?.value).filter(Boolean);
const name=(e:Row)=>e.labels?.tr?.value||e.labels?.en?.value||e.sitelinks?.trwiki?.title||e.sitelinks?.enwiki?.title||e.id;
export async function wikiBookEntity(id:string){if(!/^Q[1-9]\d*$/.test(id))throw Error('Geçersiz kitap kaydı.');const d=await bookJson('https://www.wikidata.org/wiki/Special:EntityData/'+id+'.json');const e=d.entities?.[id];if(!e||!values(e,'P50').length)throw Error('Kitap kaydı bulunamadı.');return e as Row}
export async function wikiBookDetails(id:string):Promise<BookDetails>{
 const e=await wikiBookEntity(id),props=['P50','P123','P136','P364','P407','P179','P655'];const ids=[...new Set(props.flatMap(p=>values(e,p).map((v:Row)=>v.id).filter(Boolean)))].slice(0,50);let labels:Row={};if(ids.length){const d=await bookJson('https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=labels%7Csitelinks&sitefilter=trwiki%7Cenwiki&languages=tr%7Cen&ids='+ids.join('|'));labels=d.entities||{}}
 const names=(p:string)=>values(e,p).map((v:Row)=>labels[v.id]?name(labels[v.id]):'').filter(Boolean).join(' · ');
 const site=e.sitelinks?.trwiki||e.sitelinks?.enwiki,lang=e.sitelinks?.trwiki?'tr':'en';const sourceUrl=site?'https://'+lang+'.wikipedia.org/wiki/'+encodeURIComponent(site.title.replace(/ /g,'_')):'https://www.wikidata.org/wiki/'+id;
 const wiki=site?await bookJson('https://'+lang+'.wikipedia.org/api/rest_v1/page/summary/'+encodeURIComponent(site.title)).catch(()=>null):null;
 const dates=[...new Set(values(e,'P577').map((v:Row)=>v.time?.replace(/^\+/,'').slice(0,10).replace(/-00-00$/,'').replace(/-00$/,'')))].filter(Boolean).join(' · ');
 const pic=values(e,'P18')[0];const page=values(e,'P1104')[0]?.amount;
 const facts:[string,string][]=[['Yazar',names('P50')],['Yayınevi',names('P123')],['Yayın tarihi',dates],['Sayfa sayısı',page&&Number(page)>0?String(Number(page)):''],['Dil',names('P364')||names('P407')],['Türler',names('P136')],['Seri',names('P179')],['Çevirmen',names('P655')],['ISBN-13',values(e,'P212').join(' · ')],['ISBN-10',values(e,'P957').join(' · ')]];
 return {title:name(e),summary:bookPlain(wiki?.extract||e.descriptions?.tr?.value||e.descriptions?.en?.value),image:pic?'https://commons.wikimedia.org/wiki/Special:FilePath/'+encodeURIComponent(pic)+'?width=900':undefined,source:'Wikidata / Wikipedia',sourceUrl,facts:facts.filter(x=>x[1]),links:[{label:'Kaynakta görüntüle',url:sourceUrl}],notice:'Bu kaynak eser düzeyinde bilgi içerebilir. Yayın ve baskı bilgileri kaynağın belirttiği kayıt için gösterilir.'};
}
export async function searchWikiBooks(query:string){
 const found:Row[]=[];for(const lang of ['tr','en']){const d=await bookJson('https://www.wikidata.org/w/api.php?action=wbsearchentities&format=json&language='+lang+'&uselang=tr&limit=12&search='+encodeURIComponent(query));for(const row of d.search||[])if(!found.some(x=>x.id===row.id)&&/book|novel|kitap|roman|literary work/i.test(row.description||''))found.push(row)}
 return found.slice(0,8).map(r=>({id:r.id,title:r.label,description:r.description}));
}
