export function hasSharedWish(input: {isOwner:boolean;status:string;targetId?:string|null;cardTargetId?:string|null;ownSeedId?:string|null;ownSeedStatus?:string|null;ownCommonIntentId?:string|null}) {
 return !input.isOwner && input.status==='active' && Boolean(input.targetId) && input.targetId===input.cardTargetId
  && Boolean(input.ownCommonIntentId || input.ownSeedId && input.ownSeedStatus==='active');
}
export function sharedWishWords(kind:string,name:string) {
 const first=name.trim().split(/\s+/)[0]||'Bu kişi';
 const action=kind==='book'||kind==='writer'?'okumayı':kind==='place'?'gitmeyi':kind==='game'?'oynamayı':kind==='artist'?'dinlemeyi':['movie','series','video','director','actor','club','comedian','theatre_artist'].includes(kind)?'izlemeyi':'yapmayı';
 const desire=kind==='book'?'bu kitabı okumak':kind==='writer'?'bu yazarın kitaplarını okumak':kind==='series'||kind==='video'?'bu diziyi izlemek':kind==='movie'?'bu filmi izlemek':kind==='place'?'buraya gitmek':kind==='artist'?'bu sanatçıyı dinlemek':kind==='game'?'bu oyunu oynamak':'bunu yapmak';
 return {button:`Birlikte ${action} öner`,message:`İkiniz de ${desire} istiyorsunuz.`,recipient:first};
}
