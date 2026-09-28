export type ClubTeam={id:string;sport:string;name:string;division:string;venue:string;logo_url?:string;league?:string;season?:string;map_url?:string;venue_id?:string};
export type ClubVenue={id:string;name:string;address:string;photo_url:string;map_url:string;capacity:string};
export type ClubFixture={id:string;sport:string;opponent:string;start_at:string;venue_id:string;competition:string;venue?:string};
export type ClubSocialLink={id:string;label:string;url:string};
export type ClubProfile={logo_url?:string;city?:string;colors?:string;website?:string;founded_year?:string;teams?:ClubTeam[];history?:string;venues?:ClubVenue[];fixtures?:ClubFixture[];social_links?:ClubSocialLink[]};
export type ViewingContext={fixture_id?:string;match_start_at?:string;team_id?:string;sport?:string;team_name?:string;mode:"undecided"|"venue"|"home"|"cafe"|"cinema"|"screening"|"online";media_kind?:"movie"|"series";season?:string;episode?:string;venue_name?:string;cinema_hall?:string;session_time?:string;match?:string};
export const VIEWING_MODES={undecided:"Henüz belli değil",venue:"Tribünde / yerinde",home:"Evde / TV'de",cafe:"Kafede / dışarıda"};
export function viewingSummary(context?:Partial<ViewingContext>|null){if(context?.media_kind)return [({undecided:"Henüz karar vermedim",home:"Evde",cinema:"Sinemada",screening:"Mekânda / açık hava gösteriminde",online:"Çevrim içi"} as Record<string,string>)[context.mode||"undecided"],context.season&&`${context.season}. sezon`,context.episode&&`${context.episode}. bölüm`,context.venue_name,context.cinema_hall&&`Salon ${context.cinema_hall}`,context.session_time].filter(Boolean).join(" · ");return [context?.sport,context?.team_name,context?.match,context?.mode&&context.mode!=="undecided"?(VIEWING_MODES as Record<string,string>)[context.mode]:null].filter(Boolean).join(" · ")}

export function defaultClubViewing(profile?:ClubProfile):ViewingContext{const sports=[...new Set((profile?.teams||[]).map(team=>team.sport).filter(Boolean))];const team=profile?.teams?.length===1?profile.teams[0]:undefined;return {mode:"undecided",sport:team?.sport||(sports.length===1?sports[0]:""),team_id:team?.id,team_name:team?.name}}

export function fixtureDate(value:string){return value?new Date(/[zZ]|[+-]\d{2}:\d{2}$/.test(value)?value:value+"+03:00"):null}

export function clubTeamsWithVenues(profile:ClubProfile):ClubTeam[]{return (profile.teams||[]).map(team=>{const venue=profile.venues?.find(venue=>Boolean(team.venue_id&&team.venue_id===venue.id)||Boolean(team.venue&&venue.name&&team.venue.trim().toLocaleLowerCase("tr-TR")===venue.name.trim().toLocaleLowerCase("tr-TR")));return {...team,venue:team.venue||venue?.name||"",map_url:team.map_url||venue?.map_url||""}})}
