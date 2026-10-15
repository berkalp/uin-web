// Identical wire format on web and native. Category and branch defaults are independent.
export function librarySortKey(section:string,category:string,branch=''){
  return 'sort:'+JSON.stringify([section,category,branch.trim().toLocaleLowerCase('tr-TR')]);
}
export function libraryCategories(value:unknown):string[]{
  return Array.isArray(value)?[...new Set(value.filter((id):id is string=>typeof id==='string'&&id!=='all'&&/^[a-zA-Z0-9_-]{1,100}$/.test(id)))].sort().slice(0,100):[];
}
export function storedLibrarySort(sort:string,personal:boolean){
  if(sort==='uinRating'||sort==='rating')return 'ratingDesc';
  if(sort==='recommended')return 'wanting';
  return sort;
}
export function nativeLibrarySort(sort:string,personal:boolean){
  return sort==='ratingDesc'?(personal?'rating':'uinRating'):sort;
}
