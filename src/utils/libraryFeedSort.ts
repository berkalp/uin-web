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
