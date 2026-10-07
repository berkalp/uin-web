export type PlaceCoverNode={target_id:string;title:string;scope?:string;parent_target_id?:string|null};

type WikiPage={title?:string;missing?:boolean;thumbnail?:{source?:string}};
type WikiAlias={from?:string;to?:string};
type WikiPayload={query?:{pages?:WikiPage[];normalized?:WikiAlias[];redirects?:WikiAlias[]}};

function key(value:string){return value.trim().toLocaleLowerCase("tr-TR")}
function lookupTitle(node:PlaceCoverNode,nodes:PlaceCoverNode[]){
  const clean=node.title.replace(/\s+\([^()]+\)\s*$/u,"").trim();
  if(clean.toLocaleLowerCase("tr-TR")==="merkez")return nodes.find(item=>item.target_id===node.parent_target_id)?.title||clean;
  return clean;
}

export async function placeCoverUrls(nodes:PlaceCoverNode[]){
  const result=new Map<string,string>();
  const queries=[...new Set(nodes.map(node=>lookupTitle(node,nodes)).filter(Boolean))].slice(0,50);
  if(!queries.length)return result;
  try{
    const params=new URLSearchParams({action:"query",format:"json",formatversion:"2",redirects:"1",prop:"pageimages",piprop:"thumbnail",pithumbsize:"1000",pilicense:"any",titles:queries.join("|")});
    const response=await fetch(`https://tr.wikipedia.org/w/api.php?${params}`,{headers:{"User-Agent":"UIN/1.0 place-covers"},signal:AbortSignal.timeout(5000),next:{revalidate:604800}});
    if(!response.ok)return result;
    const body=await response.json() as WikiPayload;
    const aliases=new Map<string,string>();
    for(const alias of [...(body.query?.normalized||[]),...(body.query?.redirects||[])])if(alias.from&&alias.to)aliases.set(key(alias.from),key(alias.to));
    const images=new Map<string,string>();
    for(const page of body.query?.pages||[])if(!page.missing&&page.title&&page.thumbnail?.source)images.set(key(page.title),page.thumbnail.source);
    const imageFor=(title:string)=>{let current=key(title);for(let i=0;i<4;i++){const next=aliases.get(current);if(!next||next===current)break;current=next}return images.get(current)||null};
    for(const node of nodes){const image=imageFor(lookupTitle(node,nodes));if(image)result.set(node.target_id,image)}
    for(let pass=0;pass<3;pass++)for(const node of nodes)if(!result.has(node.target_id)&&node.parent_target_id&&result.has(node.parent_target_id))result.set(node.target_id,result.get(node.parent_target_id)!);
    return result;
  }catch{return result}
}
