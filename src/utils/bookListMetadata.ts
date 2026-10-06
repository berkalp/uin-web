export const BOOK_LISTS = [
  {id:"most_read",label:"En çok okunan 100",rangeLabel:"1’den 100’e"},
  {id:"classics",label:"Klasikler 100",rangeLabel:"1’den 100’e"},
  {id:"science_fiction_fantasy",label:"Bilimkurgu & Fantastik 100",rangeLabel:"1’den 100’e"},
  {id:"mystery_thriller",label:"Polisiye & Gerilim 100",rangeLabel:"1’den 100’e"},
  {id:"turkish_literature",label:"Türk Edebiyatı 100",rangeLabel:"1’den 100’e"},
  {id:"pulitzer_fiction_30",label:"Pulitzer Kurgu · Son 30 yıl",rangeLabel:"1’den 30’a"},
  {id:"nobel_literature_30",label:"Nobel Edebiyat Yazarları · Son 30 yıl",rangeLabel:"1’den 30’a"},
] as const;

export type BookListId=(typeof BOOK_LISTS)[number]["id"];
export type BookAward={id:string;label:string;year:number;scope:"book"|"author";recipient?:string;sourceUrl?:string};
export type BookListMetadata={bookLists:BookListId[];bookListRanks:Partial<Record<BookListId,number>>;bookAwards:BookAward[]};

export function readBookListMetadata(value:unknown):BookListMetadata{
  const metadata=value&&typeof value==="object"?value as Record<string,unknown>:{};
  const valid=new Set<string>(BOOK_LISTS.map(list=>list.id));
  const bookLists=Array.isArray(metadata.book_lists)?metadata.book_lists.filter((id):id is BookListId=>typeof id==="string"&&valid.has(id)):[];
  const rawRanks=metadata.book_list_ranks&&typeof metadata.book_list_ranks==="object"?metadata.book_list_ranks as Record<string,unknown>:{};
  const bookListRanks:Partial<Record<BookListId,number>>={};
  for(const id of bookLists){const rank=Number(rawRanks[id]);if(Number.isInteger(rank)&&rank>0&&rank<=100)bookListRanks[id]=rank}
  const bookAwards=Array.isArray(metadata.book_awards)?metadata.book_awards.flatMap((value):BookAward[]=>{
    if(!value||typeof value!=="object")return [];
    const award=value as Record<string,unknown>;const year=Number(award.year);const scope=award.scope;
    if(typeof award.id!=="string"||typeof award.label!=="string"||!Number.isInteger(year)||(scope!=="book"&&scope!=="author"))return [];
    return [{id:award.id,label:award.label,year,scope,recipient:typeof award.recipient==="string"?award.recipient:undefined,sourceUrl:typeof award.source_url==="string"?award.source_url:undefined}];
  }):[];
  return {bookLists,bookListRanks,bookAwards};
}
