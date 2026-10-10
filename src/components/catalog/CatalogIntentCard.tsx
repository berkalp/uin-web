import Link from "next/link";
import CardQuickDetails from "@/components/cards/CardQuickDetails";
import CommonIntentQuickDetails from "@/components/intentions/CommonIntentQuickDetails";
import CanonicalTargetPeople from "@/components/seeds/CanonicalTargetPeople";
import type { DiscoverPersonalIntent } from "@/components/discover/DiscoverPersonalIntentCard";
import { commonIntentTitle } from "@/utils/commonIntentTitle";
import { initialCommunityCountProps } from "@/utils/communityCounts";
import { topicDisplayIdentity, topicPresentation } from "@/utils/topicPresentation";

export default function CatalogIntentCard({ item }: { item: DiscoverPersonalIntent }) {
  const words = topicPresentation(item);
  const detailHref = `/intentions/${encodeURIComponent(item.canonical_target_id)}`;
  const personalHref = `${detailHref}/personal`;
  const hasIntent = Boolean(item.own_seed_id || item.own_common_intent_id);
  const cover = item.catalog_cover_url || item.cover_url;
  const identity = topicDisplayIdentity(item);
  const displayTitle = commonIntentTitle(identity.title);
  const communityCountProps = initialCommunityCountProps(
    item.intent_people_count,
    item.experience_people_count,
    item.social_intent_count
  );

  return <article className="flex h-[500px] min-w-0 flex-col overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm transition hover:shadow-md">
    <div className="relative h-52 shrink-0 overflow-hidden bg-emerald-50">
      <Link href={detailHref} className="block h-full" aria-label={`${displayTitle} detayını aç`}>
        {cover ? <img src={cover} alt="" loading="lazy" className="h-full w-full object-cover"/> : <span className="grid h-full place-items-center text-5xl">{words.icon}</span>}
      </Link>
      <span className="absolute left-3 top-3 max-w-[calc(100%-1.5rem)] truncate rounded-full bg-emerald-50 px-3 py-1.5 text-[10px] font-black tracking-wide text-emerald-800 shadow-sm">{words.badge}</span>
      <p className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-4 pb-3 pt-9 text-[11px] font-black uppercase tracking-wide text-white">{words.icon} {words.action}</p>
    </div>
    <div className="px-4 pt-4">
      <h2 className="line-clamp-2 min-h-12 text-lg font-black leading-6"><Link href={detailHref} className="hover:text-emerald-700">{displayTitle}</Link></h2>
      {identity.subtitle && <p className="mt-1 truncate text-xs text-gray-500">{identity.subtitle}</p>}
    </div>
    <div className="px-4 pt-4">
      <CanonicalTargetPeople targetId={item.canonical_target_id} seedId={item.source_seed_id} seedType={item.seed_type_slug} {...communityCountProps} socialHref={`${detailHref}#social-intents`}/>
    </div>
    <div className="mt-auto flex items-center gap-2 px-4 pb-4 pt-4">
      <Link href={detailHref} title="Fikri aç" aria-label="Fikri aç" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50">◉</Link>
      <CardQuickDetails title={displayTitle} subtitle="Konu"><CommonIntentQuickDetails targetId={item.canonical_target_id} title={displayTitle}/></CardQuickDetails>
      <div className="grid min-w-0 flex-1 grid-cols-2 gap-2"><Link href={personalHref} className="flex min-h-10 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 px-2 text-center text-[11px] font-black text-emerald-800">{hasIntent ? "✓ Planlarımda" : "Kendim için planla"}</Link><Link href={`/onboarding?target=${encodeURIComponent(item.canonical_target_id)}`} className="flex min-h-10 items-center justify-center rounded-xl bg-violet-600 px-2 text-center text-[11px] font-black text-white hover:bg-violet-700">Birlikte etkinlik</Link></div>
    </div>
  </article>;
}
