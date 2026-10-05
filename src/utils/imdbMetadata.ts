export type ImdbMetadata={imdbRank:number|null;imdbRating:number|null};

function numeric(value:unknown){
  if(value===null||value===undefined||value==='')return null;
  const result=Number(value);
  return Number.isFinite(result)?result:null;
}

export function readImdbMetadata(value:unknown):ImdbMetadata{
  const metadata=value&&typeof value==='object'?value as Record<string,unknown>:{};
  const rank=numeric(metadata.imdb_top_250_rank??metadata.imdb_top_100_rank);
  const rating=numeric(metadata.imdb_rating);
  return{
    imdbRank:rank!==null&&rank>=1&&rank<=250?rank:null,
    imdbRating:rating!==null&&rating>=0&&rating<=10?rating:null,
  };
}
