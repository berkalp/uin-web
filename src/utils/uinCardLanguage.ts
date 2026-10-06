export type Kind = "artist"|"book"|"movie"|"series"|"game"|"place"|"director"|"actor"|"writer"|"comedian"|"theatre_artist"|"athlete"|"club"|"sport"|"hobby"|"activity";
export type SearchProvider="auto"|"wikidata"|"open_library"|"google_books"|"spotify"|"tvmaze"|"igdb"|"manual";
export type CardLabels=Partial<Record<"want"|"done"|"wanting"|"doers"|"event"|"action"|"question",string>> & {search_provider?:SearchProvider;search_entity?:string;manual_fallback?:"true"|"false"};
function language(kind:Kind){
  if(kind==="movie"||kind==="series"||kind==="director"||kind==="actor")return{want:"İzlemek istiyorum",done:"İzledim",question:`Hangi ${kind==="series"?"diziyi":"filmi"} arıyorsun?`,seed:/watch|izle/,categories:["Kültür ve Etkinlikler"]};
  if(kind==="book"||kind==="writer")return{want:"Okumak istiyorum",done:"Okudum",question:"Ne okumak istiyorsun?",seed:/read|oku/,categories:["Öğrenme","Kültür ve Etkinlikler"]};
  if(kind==="artist")return{want:"Dinlemek istiyorum",done:"Dinledim",question:"Ne dinlemek istiyorsun?",seed:/listen|dinle/,categories:["Kültür ve Etkinlikler"]};
  if(kind==="game")return{want:"Oynamak istiyorum",done:"Oynadım",question:"Ne oynamak istiyorsun?",seed:/play|oyna/,categories:["Oyun ve Eğlence"]};
  if(kind==="place"||kind==="club")return{want:"Gitmek istiyorum",done:"Gittim",question:"Nereye gitmek istiyorsun?",seed:/visit|git|ziyaret/,categories:["Seyahat","Açık Hava ve Doğa"]};
  return{want:"Yapmak istiyorum",done:"Yaptım",question:"Ne yapmak istiyorsun?",seed:/try|do|make|dene|yap|learn|öğren/,categories:["Yaratıcı Aktiviteler","Spor","İş ve Üretim"]};
}
function defaultCardWords(kind:Kind){
  const base=language(kind);
  if(kind==="movie"||kind==="series")return{...base,wanting:"İzlemek isteyenler",doers:"İzleyenler",event:"İzleme etkinliği"};
  if(kind==="book")return{...base,wanting:"Okumak isteyenler",doers:"Okuyanlar",event:"Okuma etkinliği"};
  if(kind==="artist")return{...base,want:"Dinlemek / Konsere Gitmek İstiyorum",wanting:"Dinlemek / Konsere Gitmek İsteyenler",doers:"Dinleyen / Konsere Gidenler",event:"Müzik etkinliği"};
  if(kind==="game")return{...base,wanting:"Oynamak isteyenler",doers:"Oynayanlar",event:"Oyun etkinliği"};
  if(kind==="place")return{...base,wanting:"Gitmek isteyenler",doers:"Gidenler",event:"Gezi etkinliği"};
  if(kind==="sport")return{...base,wanting:"Yapmak isteyenler",doers:"Yapanlar",event:"Spor etkinliği"};
  if(kind==="club")return{...base,want:"Maç izlemek istiyorum",done:"Maç izledim",wanting:"Maç izlemek isteyenler",doers:"Maç izleyenler",event:"Maç izleme etkinliği",question:"Hangi kulübü arıyorsun?"};
  if(kind==="writer")return{...base,want:"Eserlerini okumak istiyorum",done:"Eserlerini okudum",wanting:"Okumak isteyenler",doers:"Okuyanlar",event:"Kitap etkinliği"};
  if(kind==="director"||kind==="actor"||kind==="comedian"||kind==="theatre_artist")return{...base,want:"İzlemek istiyorum",done:"İzledim",wanting:"İzlemek isteyenler",doers:"İzleyenler",event:"Gösteri etkinliği"};
  if(kind==="athlete")return{...base,want:"Takip etmek istiyorum",done:"Takip ettim",wanting:"Takip etmek isteyenler",doers:"Takip edenler",event:"Spor etkinliği"};
  return{...base,wanting:"Yapmak isteyenler",doers:"Yapanlar",event:"Etkinlik düzenle"};
}


export function resolveUinCardWords(kind:Kind,labels?:CardLabels|null){const base=defaultCardWords(kind);const actions:Partial<Record<Kind,string>>={movie:"İZLE",series:"İZLE",book:"OKU",writer:"OKU",artist:"DİNLE",game:"OYNA",place:"GİT",club:"MAÇ İZLE",director:"İZLE",actor:"İZLE",comedian:"İZLE",theatre_artist:"İZLE",athlete:"TAKİP ET"};const copyKeys=new Set(["want","done","wanting","doers","event","action","question"]);const custom=Object.fromEntries(Object.entries(labels||{}).filter(([key,value])=>copyKeys.has(key)&&typeof value==="string"&&value.trim()).map(([key,value])=>[key,value!.trim()]));return {...base,action:actions[kind]||"YAP",...custom} as typeof base & {action:string};}
