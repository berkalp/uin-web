type Team={sport:string;division:string;league:string;season:string;displayName:string};
export function clubCardLabels(title:string,team?:Team){
 const parts=title.split(' · '),known=['Futbol','Basketbol','Voleybol','Hentbol'];const index=parts.findIndex(p=>known.includes(p));const sport=team?.sport||(index>0?parts[index]:'');const division=team?.division||(index>0?parts[index+1]??'':'');const icon=({Futbol:'⚽',Basketbol:'🏀',Voleybol:'🏐',Hentbol:'🤾'} as Record<string,string>)[sport]??'🏅';
 return{name:team?.displayName||(index>0?parts.slice(0,index).join(' · '):title),branch:sport?`${icon} ${sport}${division?` – ${division}`:''}`:'',competition:[team?.league,team?.season].filter(Boolean).join(' · ')};
}
