// Shared wire values for the initial Library feed on web and native.
export const LIBRARY_FEED_SORTS = [
  {id:'recent',label:'En yeni hareketler'},
  {id:'likes',label:'Deneyimleri en çok beğenilenler'},
  {id:'ratingDesc',label:'En yüksek UIN puanlılar'},
  {id:'wanting',label:'En çok istenenler'},
  {id:'done',label:'En çok deneyimlenenler'},
  {id:'active',label:'En çok aktif etkinliği olanlar'},
] as const;
export type LibraryFeedSort = typeof LIBRARY_FEED_SORTS[number]['id'];
export function isLibraryFeedSort(value:unknown):value is LibraryFeedSort {
  return LIBRARY_FEED_SORTS.some(option=>option.id===value);
}
export function libraryFeedSort(value:string):LibraryFeedSort {
  if(value==='uinRating')return 'ratingDesc';
  return isLibraryFeedSort(value)?value:'recent';
}

// The metric is shared; only the action changes with the category's context.
export function categoryLibrarySorts(kind:string):Array<{id:LibraryFeedSort;label:string}> {
  const action:Record<string,[string,string]>={
    movie:['izlenmek','izlenenler'],series:['izlenmek','izlenenler'],
    book:['okunmak','okunanlar'],game:['oynanmak','oynananlar'],board_game:['oynanmak','oynananlar'],
    artist:['dinlenmek','dinlenenler'],place:['gidilmek','gidilenler'],
    club:['maçı izlenmek','maçı izlenenler'],
  };
  return LIBRARY_FEED_SORTS.map(option=>({...option,label:option.id==='recent'?'En yeni eklenenler':
    option.id==='wanting'&&action[kind]?`En çok ${action[kind][0]} istenenler`:
    option.id==='done'&&action[kind]?`En çok ${action[kind][1]}`:option.label}));
}

export function librarySortExplanation(sort:string):string {
  return sort==='likes'?'Beğeni sırası, görünür deneyimlere gelen kalplerin toplamına göredir.':
    sort==='done'?'Bu sıralama, UIN’de deneyimini kaydeden kişi sayısına göredir.':
    sort==='ratingDesc'||sort==='uinRating'?'Bu sıralama, UIN kullanıcılarının verdiği deneyim puanlarına göredir.':'';
}
