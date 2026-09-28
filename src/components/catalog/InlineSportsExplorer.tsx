import Link from "next/link";
import CatalogIntentCard from "@/components/catalog/CatalogIntentCard";
import SportsBreadcrumbs from "@/components/sports/SportsBreadcrumbs";
import type { DiscoverPersonalIntent } from "@/components/discover/DiscoverPersonalIntentCard";
import { metric, type SportBranchCard, type SportLeagueCard, type SportTeamCard } from "@/utils/sportsCatalogue";

const ROOT_HREF = "/ideas?type=sporu+yerinde+izle";

function sportHref(sport: string, league = "") {
  const params = new URLSearchParams({ type: "sporu yerinde izle", sport });
  if (league) params.set("league", league);
  return `/ideas?${params.toString()}`;
}

export default function InlineSportsExplorer({
  selectedSport,
  selectedLeague,
  branches,
  leagues,
  teams,
  catalogItems,
  error,
}: {
  selectedSport: string;
  selectedLeague: string;
  branches: SportBranchCard[];
  leagues: SportLeagueCard[];
  teams: SportTeamCard[];
  catalogItems: DiscoverPersonalIntent[];
  error?: string | null;
}) {
  const branch = branches.find(item => item.slug === selectedSport);
  const league = leagues.find(item => item.slug === selectedLeague);

  if (error) {
    return <p className="mt-6 rounded-2xl border border-red-200 bg-white p-6 text-red-700">Spor bilgileri şu anda yüklenemedi.</p>;
  }

  if (!selectedSport) {
    return <section className="mt-7">
      <p className="text-xs font-black uppercase tracking-[.18em] text-emerald-700">SPOR BRANŞLARI</p>
      <h2 className="mt-1 text-2xl font-black">Hangi sporu yerinde izlemek istiyorsun?</h2>
      <p className="mt-1 text-sm text-gray-500">Branşı seç; Türkiye’deki aktif ligleri ve takımları burada gör.</p>
      <div className="mt-5 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {branches.map(item => <Link key={item.id} href={sportHref(item.slug)} className="group rounded-3xl border border-gray-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md">
          <div className="text-5xl">{item.icon}</div>
          <h3 className="mt-5 text-2xl font-black group-hover:text-emerald-700">{item.name}</h3>
          <p className="mt-2 min-h-10 text-sm font-semibold text-gray-500">{item.federation_name}{item.federation_short_name ? ` (${item.federation_short_name})` : ""}</p>
          <div className="mt-6 grid grid-cols-3 gap-2">{[["Ligler", item.league_count], ["Takımlar", item.team_count], ["Etkinlikler", item.event_count]].map(([label, value]) => <div key={String(label)} className="rounded-2xl bg-gray-50 p-3"><p className="text-[10px] font-black uppercase text-gray-400">{label}</p><p className="mt-1 text-xl font-black">{metric(value as number | string)}</p></div>)}</div>
        </Link>)}
      </div>
    </section>;
  }

  if (!selectedLeague) {
    return <section className="mt-7">
      <SportsBreadcrumbs items={[{ label: "Sporu Yerinde İzle", href: ROOT_HREF }, { label: `${branch?.icon || "🏟️"} ${branch?.name || selectedSport}` }]}/>
      <p className="mt-7 text-xs font-black uppercase tracking-[.18em] text-emerald-700">{branch?.federation_short_name || "SPOR FEDERASYONU"}</p>
      <h2 className="mt-1 text-2xl font-black">{branch?.federation_name || "Türkiye ligleri"}</h2>
      <p className="mt-1 text-sm text-gray-500">Ligi seçerek bu sezon mücadele eden takımları gör.</p>
      {leagues.length ? <div className="mt-5 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{leagues.map(item => <Link key={item.id} href={sportHref(item.sport_slug, item.slug)} className="group rounded-3xl border border-gray-200 bg-white p-6 shadow-sm transition hover:border-emerald-300 hover:shadow-md">
        {item.logo_url && <img src={item.logo_url} alt="" className="h-16 w-16 object-contain"/>}
        <p className="text-xs font-black uppercase tracking-wide text-emerald-700">{item.sport_icon} {item.sport_name} · {item.federation_short_name}</p>
        <h3 className="mt-3 text-2xl font-black group-hover:text-emerald-700">{item.name}</h3>
        {item.season_label && <p className="mt-1 text-sm font-semibold text-gray-500">{item.season_label} sezonu</p>}
        <div className="mt-6 grid grid-cols-2 gap-3"><div className="rounded-2xl bg-emerald-50 p-4"><p className="text-xs font-black text-emerald-700">Takımlar</p><p className="mt-1 text-2xl font-black">{metric(item.team_count)}</p></div><div className="rounded-2xl bg-violet-50 p-4"><p className="text-xs font-black text-violet-700">Etkinlikler</p><p className="mt-1 text-2xl font-black">{metric(item.event_count)}</p></div></div>
      </Link>)}</div> : <p className="mt-5 rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center text-gray-500">Bu branşa henüz aktif lig eklenmedi.</p>}
    </section>;
  }

  return <section className="mt-7">
    <SportsBreadcrumbs items={[{ label: "Sporu Yerinde İzle", href: ROOT_HREF }, { label: `${branch?.icon || "🏟️"} ${branch?.name || selectedSport}`, href: sportHref(selectedSport) }, { label: league?.name || selectedLeague }]}/>
    <p className="mt-7 text-xs font-black uppercase tracking-[.18em] text-emerald-700">{branch?.federation_short_name}{league?.season_label ? ` · ${league.season_label}` : ""}</p>
    <h2 className="mt-1 text-2xl font-black">{league?.name || "Lig takımları"}</h2>
    <p className="mt-1 text-sm text-gray-500">Takımı açarak izlemek isteyenleri, izleyenleri ve açık etkinlikleri gör.</p>
    {teams.length ? <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">{teams.map(team => {
      if (!team.canonical_target_id) return <article key={team.id} className="flex h-[500px] flex-col items-center justify-center rounded-3xl border border-gray-200 bg-white p-6 text-center opacity-70 shadow-sm"><span className="text-6xl">{team.sport_icon}</span><h3 className="mt-4 text-xl font-black">{team.official_name}</h3><p className="mt-3 text-xs font-bold text-amber-700">Konu kaydı henüz bağlanmadı.</p></article>;
      const stored = catalogItems.find(item => item.canonical_target_id === team.canonical_target_id);
      const card: DiscoverPersonalIntent = {
        canonical_target_id: team.canonical_target_id,
        source_seed_id: stored?.source_seed_id || null,
        seed_type_icon: stored?.seed_type_icon || team.sport_icon || "🏟️",
        seed_type_name: stored?.seed_type_name || "Sporu Yerinde İzle",
        seed_type_slug: stored?.seed_type_slug || "sport-live",
        title: team.official_name,
        subtitle: team.league_name,
        cover_url: team.cover_url || team.logo_url || stored?.cover_url || null,
        catalog_cover_url: team.cover_url || team.logo_url || stored?.catalog_cover_url || null,
        own_seed_id: stored?.own_seed_id || null,
        own_common_intent_id: stored?.own_common_intent_id || null,
        intent_people_count: team.wanting_count,
        experience_people_count: team.watched_count,
        social_intent_count: team.event_count,
        item_kind: "sports_team",
        sport_name: team.sport_name,
        subject_type: team.sport_name,
      };
      return <CatalogIntentCard key={team.id} item={card}/>;
    })}</div> : <p className="mt-5 rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center text-gray-500">Bu lige henüz takım eklenmedi.</p>}
  </section>;
}
