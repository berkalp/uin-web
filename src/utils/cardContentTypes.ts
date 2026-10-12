export function cardContentTypeIds(primary:string, memberships?:unknown):string[]{
  return [...new Set([primary,...(Array.isArray(memberships)?memberships.filter((id):id is string=>typeof id==="string"&&Boolean(id.trim())):[])].filter(Boolean))];
}

export function cardCategoryContext(primary:string,memberships:unknown,openedCategory?:string|null):string|undefined{
  const ids=cardContentTypeIds(primary,memberships);
  if(openedCategory&&ids.includes(openedCategory))return openedCategory;
  return ids.length===1?ids[0]:undefined;
}
