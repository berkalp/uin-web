export type ReferenceLink={label:string;url:string};

function httpUrl(value:unknown){
  if(typeof value!=="string")return "";
  const cleaned=value.trim();
  if(!cleaned)return "";
  try{const parsed=new URL(cleaned);return ["http:","https:"].includes(parsed.protocol)?parsed.toString():""}catch{return ""}
}

export function normalizeReferenceLinks(value:unknown):ReferenceLink[]{
  if(!Array.isArray(value))return [];
  const seen=new Set<string>();
  const links:ReferenceLink[]=[];
  for(const item of value){
    if(!item||typeof item!=="object")continue;
    const row=item as Record<string,unknown>;
    const url=httpUrl(row.url);
    if(!url||seen.has(url))continue;
    seen.add(url);
    const label=typeof row.label==="string"&&row.label.trim()?row.label.trim().slice(0,80):"Kaynak";
    links.push({label,url});
    if(links.length===20)break;
  }
  return links;
}

export function referenceLinksFromMetadata(metadata?:Record<string,unknown>|null):ReferenceLink[]{
  const links=normalizeReferenceLinks(metadata?.reference_links);
  if(links.length)return links;
  const legacy=httpUrl(metadata?.reference_url)||httpUrl(metadata?.source_url);
  return legacy?[{label:"Kaynak",url:legacy}]:[];
}
