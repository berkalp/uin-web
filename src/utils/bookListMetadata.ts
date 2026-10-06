export const BOOK_LISTS = [
  {id:"most_read",label:"En çok okunan 100"},
  {id:"classics",label:"Klasikler 100"},
  {id:"science_fiction_fantasy",label:"Bilimkurgu & Fantastik 100"},
  {id:"mystery_thriller",label:"Polisiye & Gerilim 100"},
  {id:"turkish_literature",label:"Türk Edebiyatı 100"},
] as const;

export type BookListId=(typeof BOOK_LISTS)[number]["id"];
export type BookListMetadata={bookLists:BookListId[];bookListRanks:Partial<Record<BookListId,number>>};

export function readBookListMetadata(value:unknown):BookListMetadata{
  const metadata=value&&typeof value==="object"?value as Record<string,unknown>:{};
  const valid=new Set<string>(BOOK_LISTS.map(list=>list.id));
  const bookLists=Array.isArray(metadata.book_lists)?metadata.book_lists.filter((id):id is BookListId=>typeof id==="string"&&valid.has(id)):[];
  const rawRanks=metadata.book_list_ranks&&typeof metadata.book_list_ranks==="object"?metadata.book_list_ranks as Record<string,unknown>:{};
  const bookListRanks:Partial<Record<BookListId,number>>={};
  for(const id of bookLists){const rank=Number(rawRanks[id]);if(Number.isInteger(rank)&&rank>0&&rank<=100)bookListRanks[id]=rank}
  return {bookLists,bookListRanks};
}
