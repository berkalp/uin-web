import {NextRequest,NextResponse} from "next/server";
import {placeCoverUrls,type PlaceCoverNode} from "@/utils/placeCovers";

export async function POST(request:NextRequest){
  try{
    const body=await request.json() as {nodes?:PlaceCoverNode[]};
    const nodes=(Array.isArray(body.nodes)?body.nodes:[]).filter(node=>node&&typeof node.target_id==="string"&&typeof node.title==="string").slice(0,50).map(node=>({target_id:node.target_id.slice(0,80),title:node.title.slice(0,240),scope:typeof node.scope==="string"?node.scope.slice(0,40):undefined,parent_target_id:typeof node.parent_target_id==="string"?node.parent_target_id.slice(0,80):null}));
    return NextResponse.json({covers:Object.fromEntries(await placeCoverUrls(nodes,{throwOnError:true}))},{headers:{"Cache-Control":"public, max-age=3600, stale-while-revalidate=604800"}});
  }catch{
    return NextResponse.json(
      {error:"Yer kapakları yüklenemedi. Lütfen tekrar dene."},
      {status:502,headers:{"Cache-Control":"private, no-store"}},
    );
  }
}
