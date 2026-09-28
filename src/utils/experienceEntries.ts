import {getPublicFavoriteId,type PublicFavoriteItem} from "@/components/profile/PublicFavoritesPanel";
import {getSeedDashboardStatus,getLocalDateKey,type SeedRecord} from "@/utils/seeds";
import type {SocialExperienceItem} from "@/components/seeds/ExperienceDashboard";
type SeedWithReminder=SeedRecord & {reminder_target_time?:string|null;reminder_timezone?:string|null};
type ExperienceEntry =
  | {
      kind: "personal";
      key: string;
      sortAt: string;
      seed: SeedWithReminder;
      loved: boolean;
    }
  | {
      kind: "social";
      key: string;
      sortAt: string;
      item: SocialExperienceItem;
      loved: false;
    }
  | {
      kind: "favorite";
      key: string;
      sortAt: string;
      item: PublicFavoriteItem;
      loved: true;
    };

function getPersonalSortAt(seed: SeedRecord) {
  const record = seed as unknown as Record<string, unknown>;

  for (const key of [
    "completed_at",
    "experience_date",
    "target_date",
    "updated_at",
    "created_at",
  ]) {
    const value = record[key];

    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }

  return "";
}

function getCatalogItemId(seed: SeedRecord) {
  const value = (seed as unknown as Record<string, unknown>).catalog_item_id;
  return typeof value === "string" && value ? value : null;
}

function timestamp(value: string) {
  const result = new Date(value).getTime();
  return Number.isFinite(result) ? result : 0;
}


export function buildExperienceEntries(seeds:SeedWithReminder[],socialExperiences:SocialExperienceItem[],favorites:PublicFavoriteItem[],today=getLocalDateKey()):ExperienceEntry[]{
 const completedSeeds=seeds.filter(seed=>getSeedDashboardStatus(seed,today)==="completed");
 const favoriteTargetIds=new Set(favorites.map(item=>item.canonical_target_id).filter(Boolean));
 const favoriteCatalogIds=new Set(favorites.filter(item=>item.source_type!=="subject").map(getPublicFavoriteId).filter(Boolean));
      const personalEntries: ExperienceEntry[] =
        completedSeeds.map((seed) => ({
          kind: "personal",
          key: `personal-${seed.seed_id}`,
          sortAt: getPersonalSortAt(seed),
          seed,
          loved: Number(seed.personal_rating||0)>=9 || Boolean((seed.canonical_target_id&&favoriteTargetIds.has(seed.canonical_target_id))||(getCatalogItemId(seed) && favoriteCatalogIds.has(getCatalogItemId(seed)!))),
        }));

      const socialEntries: ExperienceEntry[] =
        socialExperiences.map((item) => ({
          kind: "social",
          key: `social-${item.id}`,
          sortAt: item.sortAt,
          item,
          loved: false,
        }));

      return [
        ...personalEntries,
        ...socialEntries,

      ].sort(
        (first, second) =>
          timestamp(second.sortAt) -
          timestamp(first.sortAt)
      );

}
export function getExperienceTotals(seeds:SeedWithReminder[],social:SocialExperienceItem[],favorites:PublicFavoriteItem[]){const entries=buildExperienceEntries(seeds,social,favorites);return {all:entries.length,loved:entries.filter(entry=>entry.loved).length,personal:entries.filter(entry=>entry.kind==="personal").length,social:entries.filter(entry=>entry.kind==="social").length};}
