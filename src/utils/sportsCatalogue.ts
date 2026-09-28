export type SportBranchCard = {
  id: string; slug: string; name: string; icon: string;
  federation_name: string | null; federation_short_name: string | null; federation_url: string | null;
  league_count: number | string; team_count: number | string; event_count: number | string;
};

export type SportLeagueCard = {
  id: string; slug: string; name: string; short_name: string | null; season_label: string | null;
  logo_url: string | null; official_url: string | null; sport_slug: string; sport_name: string; sport_icon: string;
  federation_name: string | null; federation_short_name: string | null;
  team_count: number | string; event_count: number | string;
};

export type SportTeamCard = {
  id: string; slug: string; official_name: string; short_name: string | null; city: string | null;
  logo_url: string | null; cover_url: string | null; official_url: string | null; description: string | null;
  canonical_target_id: string | null; sport_slug: string; sport_name: string; sport_icon: string;
  federation_name: string | null; federation_short_name: string | null;
  league_slug: string; league_name: string; season_label: string | null;
  wanting_count: number | string; watched_count: number | string; event_count: number | string;
};

export type SportTargetContext = {
  sport_slug: string; sport_name: string; sport_icon: string;
  federation_name: string | null; federation_short_name: string | null;
  league_slug: string; league_name: string; season_label: string | null;
  team_slug: string; team_name: string;
};

export function metric(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed.toLocaleString("tr-TR") : "0";
}
