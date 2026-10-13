import {artistBadges,type ArtistStats} from '@/utils/artistListMetadata';
export default function ArtistPopularityBadges({stats}:{stats?:ArtistStats|null}){
  return <>{artistBadges(stats).map(badge=><a key={badge.text} href={badge.url} target="_blank" rel="noopener noreferrer" onClick={event=>event.stopPropagation()} title={badge.description} aria-label={badge.description} className="uin-layout-card-badge max-w-[210px] rounded-full bg-emerald-50/95 px-3 py-1.5 text-right text-[10px] font-black text-emerald-900 shadow-sm">🎧 {badge.text}</a>)}</>;
}
