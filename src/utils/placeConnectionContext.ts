import type {Place} from "@/utils/placeGeography";

export type PlaceConnectionContext={
  place:Place;
  childCount:number|null;
};

type BuildPlaceContextInput={
  targetId:string;
  catalogItemId:string;
  title:string;
  coverUrl:string|null;
  externalId:unknown;
  metadata:unknown;
  hierarchy:unknown;
  childCount:unknown;
};

const record=(value:unknown):Record<string,unknown>=>value&&typeof value==="object"?value as Record<string,unknown>:{};
const text=(value:unknown)=>typeof value==="string"?value.trim():"";
const number=(value:unknown)=>value==null||value===""?null:Number.isFinite(Number(value))?Number(value):null;

export function buildPlaceConnectionContext(input:BuildPlaceContextInput):PlaceConnectionContext{
  const metadata=record(input.metadata);
  const hierarchy=record(input.hierarchy);
  const globalKind=text(metadata.global_place_kind).toLocaleLowerCase("tr-TR");
  const kind=text(hierarchy.kind)||text(metadata.place_kind)||(globalKind==="country"?"Ülke":globalKind==="city"?"Şehir":"Yer");
  const parentTargetId=text(hierarchy.parent_target_id);
  const sourceKey=text(metadata.wikidata_id)||text(metadata.source_external_id)||text(input.externalId)||input.targetId;
  const country=text(metadata.country);
  const countryCode=text(metadata.country_code).toLocaleUpperCase("tr-TR");
  const city=text(metadata.city)||(kind==="Şehir"||kind==="İl"?input.title:"");
  const district=text(metadata.district)||(kind==="İlçe"?input.title:"");
  const latitude=number(metadata.latitude??metadata.lat);
  const longitude=number(metadata.longitude??metadata.lng??metadata.lon);
  const rawChildCount=number(input.childCount);
  const childCount=rawChildCount!=null&&Number.isInteger(rawChildCount)&&rawChildCount>=0?rawChildCount:null;

  return{
    childCount,
    place:{
      id:input.targetId,
      catalogItemId:input.catalogItemId,
      title:input.title,
      coverUrl:input.coverUrl,
      wikiId:sourceKey,
      kind,
      adminKind:text(hierarchy.kind),
      parentTargetId,
      countryId:countryCode?`country:${countryCode}`:"",
      country,
      cityId:kind==="Şehir"||kind==="İl"?sourceKey:parentTargetId,
      city,
      district,
      sourceUrl:text(metadata.reference_url),
      mapUrl:latitude!=null&&longitude!=null
        ?`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${latitude},${longitude}`)}`
        :"",
    },
  };
}
