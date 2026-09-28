/** Enrich generic live-sport targets without replacing an organizer's title. */
export function liveSportTitle(title: string, sport?: string | null, entity?: string | null) {
  const normalized = title.trim().toLowerCase();
  if (["concert", "konser", "go to a concert", "attend a concert"].includes(normalized)) return entity?.trim() ? `${entity.trim()} Konserine Gitmek` : "Konsere Gitmek";
  const generic = ["live sports match", "watch sports live at the venue", "watch sports live", "sporu yerinde canlı izlemek", "sporu yerinde canli izlemek"];
  if (!generic.includes(normalized) || !sport?.trim()) return title;
  const names: Record<string, string> = { football: "Futbol", soccer: "Futbol", basketball: "Basketbol", volleyball: "Voleybol", tennis: "Tenis", "combat sports": "Dövüş Sporları" };
  const name = names[sport.trim().toLowerCase()] || sport.trim();
  return `${entity?.trim() ? `${entity.trim()} ` : ""}${name} ${/^(futbol|basketbol|voleybol|tenis)$/i.test(name) ? "Maçını" : "Müsabakasını"} Yerinde Canlı İzlemek`;
}
