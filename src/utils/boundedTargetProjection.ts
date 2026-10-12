// Limit projection work and response rows independently of catalogue size.
type ProjectionResult={data:unknown;error:unknown};
export async function boundedTargetProjection(ids:string[],read:(batch:string[])=>PromiseLike<ProjectionResult>){
 const batches:Array<string[]>=[];for(let offset=0;offset<ids.length;offset+=100)batches.push(ids.slice(offset,offset+100));
 const rows:unknown[]=[];let error:unknown=null;let cursor=0;
 await Promise.all(Array.from({length:Math.min(3,batches.length)},async()=>{while(cursor<batches.length){const batch=batches[cursor++];const result=await read(batch);if(result.error){error=result.error;return}if(!Array.isArray(result.data)){error=new Error("Incomplete projection payload");return}rows.push(...result.data)}}));
 return {data:error?null:rows,error};
}
