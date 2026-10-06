import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@/utils/supabase/server';
import {bookJson,googleBookDetails,openLibraryBookDetails,searchOpenLibraryBooks,wikiBookDetails} from '@/utils/bookDetails';

const normalized=(value:string)=>value.toLocaleLowerCase('tr-TR').normalize('NFD').replace(/\p{M}/gu,'').replace(/ı/g,'i').replace(/[^\p{L}\p{N}]/gu,'');

async function openLibraryDetails(id:string){
 if(!/^OL\d+W$/.test(id))throw Error('Geçersiz Open Library kaydı.');
 const work=await bookJson(`https://openlibrary.org/works/${encodeURIComponent(id)}.json`);
 let rows=await searchOpenLibraryBooks(`key:${id}`);
 let row=rows.find((candidate:Record<string,unknown>)=>String(candidate.key).replace(/^\/works\//,'')===id);
 if(!row&&work?.title){rows=await searchOpenLibraryBooks(String(work.title));row=rows.find((candidate:Record<string,unknown>)=>String(candidate.key).replace(/^\/works\//,'')===id)}
 return openLibraryBookDetails(row||{key:`/works/${id}`,title:work?.title},work);
}

export async function GET(req:NextRequest){try{
 let id=req.nextUrl.searchParams.get('id')||'',provider=req.nextUrl.searchParams.get('provider')||'';const targetId=req.nextUrl.searchParams.get('targetId');let title='',creator='';let cached:ReturnType<typeof googleBookDetails>|null=null;
 if(targetId){
  if(!/^[0-9a-f-]{36}$/i.test(targetId))return NextResponse.json({error:'Kart bulunamadı.'},{status:404});
  const db=await createClient();const profile=await db.rpc('get_uin_card_profile_v60',{p_target_id:targetId});if(profile.error||!profile.data?.title)return NextResponse.json({error:'Kart bulunamadı.'},{status:404});
  const result=await db.from('seed_catalog_items').select('external_id,external_source,item_kind,metadata').eq('canonical_target_id',targetId).eq('status','active');const item=result.data?.find(row=>row.item_kind==='book')||result.data?.[0];const meta={...(item?.metadata||{}),...(profile.data.metadata||{})};const type=await db.from('uin_content_types').select('base_kind').eq('id',String(meta.content_type_id||item?.item_kind||'')).maybeSingle();if(item?.item_kind!=='book'&&type.data?.base_kind!=='book')return NextResponse.json({error:'Bu kart bir kitap değil.'},{status:400});
  title=profile.data.title;creator=profile.data.creator_name||'';
  if(item?.external_source==='google_books')cached=meta.book_details||googleBookDetails({id:item.external_id,volumeInfo:{title,authors:meta.authors||[creator].filter(Boolean),description:meta.description,publisher:meta.publisher,publishedDate:meta.published_date,pageCount:meta.page_count,language:meta.language,categories:meta.categories,industryIdentifiers:meta.isbn||[{type:'ISBN_13',identifier:meta.isbn_13},{type:'ISBN_10',identifier:meta.isbn_10}],imageLinks:{thumbnail:profile.data.cover_url},infoLink:meta.info_url||meta.source_url}});
  if(!id){provider=String(meta.source_provider||item?.external_source||'');id=String(meta.open_library_work_id||meta.wikidata_id||meta.source_external_id||item?.external_id||'')}
 }
 if(provider==='open_library'&&/^OL\d+W$/.test(id))return NextResponse.json(await openLibraryDetails(id));
 if(provider==='wikidata'&&/^Q[1-9]\d*$/.test(id))return NextResponse.json(await wikiBookDetails(id));
 if(!title)return NextResponse.json({error:'Kaynakta bir kitap seç.'},{status:400});
 const rows=await searchOpenLibraryBooks([title,creator].filter(Boolean).join(' '));const exact=rows.filter((row:Record<string,unknown>)=>normalized(String(row.title||''))===normalized(title));const authorParts=creator.split(/[^\p{L}\p{N}]+/u).filter(part=>part.length>1).map(normalized);const matches=exact.filter((row:Record<string,unknown>)=>{const authors=Array.isArray(row.author_name)?row.author_name.join(' '):'';return !authorParts.length||authorParts.every(part=>normalized(authors).includes(part))});
 if(matches.length===1){const workId=String(matches[0].key).replace(/^\/works\//,'');return NextResponse.json(await openLibraryDetails(workId))}
 if(cached&&cached.facts.length&&matches.length===0)return NextResponse.json({...cached,source:'Kayıtlı kitap bilgisi',links:cached.links.filter(link=>!link.url.includes('books.google.')),notice:'Bu eski kart henüz Open Library’deki eser kaydıyla kesin olarak eşleşmedi. Kayıtlı bilgiler gösteriliyor.'});
 const candidates=(matches.length?matches:exact.length?exact:rows).slice(0,8).map((row:Record<string,unknown>)=>({id:String(row.key).replace(/^\/works\//,''),title:String(row.title||''),description:Array.isArray(row.author_name)?row.author_name.join(', '):'',provider:'open_library'}));
 return NextResponse.json({error:'Doğru Open Library eser kaydını seç.',candidates},{status:409});
 }catch{return NextResponse.json({error:'Kitap detayları şu anda alınamadı. Tekrar deneyebilirsin.'},{status:502})}}
