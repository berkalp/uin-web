"use client";
import {buildExperienceEntries} from "@/utils/experienceEntries";

import CanonicalTargetPeople from "@/components/seeds/CanonicalTargetPeople";
import UinCard from "@/components/cards/UinCard";
import { useEffect, useMemo, useState } from "react";

import { getPublicFavoriteId, type PublicFavoriteItem } from "@/components/profile/PublicFavoritesPanel";
import SeedCard from "@/components/seeds/SeedCard";
import { favoriteLabels } from "@/utils/favoriteLabels";
import {
  getLocalDateKey,
  getSeedDashboardStatus,
  type SeedRecord,
} from "@/utils/seeds";

type SeedWithReminder = SeedRecord & {
  reminder_target_time?: string | null;
  reminder_timezone?: string | null;
};

export type SocialExperienceItem = {
  id: string;
  title: string;
  categoryName: string;
  coverUrl: string | null;
  locationLabel: string | null;
  sortAt: string;
  roleLabel: string;
  href: string;
};

type ExperienceDashboardProps = {
  seeds: SeedWithReminder[];
  socialExperiences: SocialExperienceItem[];
  favorites: PublicFavoriteItem[];
  initialFilter?: ExperienceFilter;
  lovedOnly?:boolean;
  typeFilter?:string;query?:string;sourceTypes?:Array<{resource_id:string;target_id:string;type_id:string}>;
  isAuthenticated: boolean;
};

type ExperienceFilter = "all" | "loved" | "social" | "personal";

const EXPERIENCE_PAGE_SIZE = 24;

function formatDate(value: string) {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function SocialExperienceCard({ item,targetId }: { item: SocialExperienceItem;targetId?:string }) {
  return <UinCard title={item.title} subtitle={item.locationLabel} coverUrl={item.coverUrl}
    href={item.href} category={item.categoryName} icon="✓" badge="DENEYİMİM" tone="experience">
    <p className="rounded-xl bg-blue-50 p-3 text-xs text-blue-900">✓ {formatDate(item.sortAt) || "Tarih belirtilmedi"}</p>
    <p className="mt-3 text-xs text-gray-500">{item.roleLabel}</p>{targetId&&<div className="mt-3"><CanonicalTargetPeople targetId={targetId}/></div>}
  </UinCard>;
}

function LovedExperienceCard({ item }: { item: PublicFavoriteItem }) {
  const itemId = getPublicFavoriteId(item);
  const words = favoriteLabels[item.item_kind || "other"] || favoriteLabels.other;
  const href = item.source_type === "subject" ? `/loved/subject/${itemId}` : `/seeds/subjects/${itemId}`;

  return <UinCard title={item.title} subtitle={item.creator_name} coverUrl={item.cover_url}
    href={href} category={words.label} icon={words.icon} badge="SEVDİĞİM DENEYİM" tone="favorite">
    <p className="rounded-xl bg-rose-50 p-3 text-xs font-bold text-rose-800">♥ Sevdiğim deneyimler arasında</p>
    {item.is_featured && <p className="mt-3 text-xs text-amber-700">★ Profil vitrininde</p>}
  </UinCard>;
}

export default function ExperienceDashboard({
  seeds,
  socialExperiences,
  favorites,
  initialFilter = "all",
  lovedOnly=false,typeFilter="",query="",sourceTypes=[],
  isAuthenticated,
}: ExperienceDashboardProps) {
  const [filter, setFilter] =
    useState<ExperienceFilter>(initialFilter);

  const [page, setPage] = useState(1);

  const today = useMemo(
    () => getLocalDateKey(),
    []
  );

  const completedSeeds = useMemo(
    () =>
      seeds.filter(
        (seed) =>
          getSeedDashboardStatus(
            seed,
            today
          ) === "completed"
      ),
    [seeds, today]
  );

  const allEntries=useMemo(()=>buildExperienceEntries(seeds,socialExperiences,favorites,today).filter(entry=>{
    const title=entry.kind==="personal"?entry.seed.title:entry.item.title;
    const id=String(entry.kind==="personal"?entry.seed.seed_id:entry.item.id||"");
    const type=entry.kind==="personal"?entry.seed.wish_presentation?.type_id||sourceTypes.find(s=>s.resource_id===id)?.type_id||"activity":sourceTypes.find(s=>s.resource_id===id.replace(/^(plan|intent)-/,""))?.type_id||"activity";
    return (!typeFilter||type===typeFilter)&&(!query||title.toLocaleLowerCase("tr-TR").includes(query));
  }),[seeds,socialExperiences,favorites,today,typeFilter,query,sourceTypes]);

  const filteredEntries = useMemo(() => {
    if (filter === "loved") {
      return allEntries.filter(
        (entry) => entry.loved
      );
    }

    if(filter==="personal")return allEntries.filter(entry=>entry.kind==="personal");
    if (filter === "social") {
      return allEntries.filter(
        (entry) =>
          entry.kind === "social"
      );
    }

    return allEntries;
  }, [allEntries, filter]);

  const pageCount = Math.max(
    1,
    Math.ceil(
      filteredEntries.length /
        EXPERIENCE_PAGE_SIZE
    )
  );

  const safePage = Math.min(
    page,
    pageCount
  );

  const visibleEntries =
    filteredEntries.slice(
      (safePage - 1) *
        EXPERIENCE_PAGE_SIZE,
      safePage *
        EXPERIENCE_PAGE_SIZE
    );

  useEffect(() => {
    setPage(1);
  }, [filter,typeFilter,query]);

  useEffect(() => {
    if (page > pageCount) {
      setPage(pageCount);
    }
  }, [page, pageCount]);

  const tabClass = (
    active: boolean
  ) =>
    `rounded-2xl px-5 py-4 text-center font-black transition ${
      active
        ? "bg-gray-950 text-white"
        : "bg-gray-50 text-gray-700 hover:bg-gray-100"
    }`;

  return (
    <>
      {!lovedOnly&&<nav className="mt-6 grid gap-3 rounded-[28px] border border-gray-200 bg-white p-3 shadow-sm sm:grid-cols-3">
        <button
          type="button"
          onClick={() =>
            setFilter("all")
          }
          className={tabClass(
            filter === "all"
          )}
        >
          Tümü · {allEntries.length}
        </button>

        <button
          type="button"
          onClick={() => setFilter("personal")}
          className={tabClass(
            filter === "personal"
          )}
        >
          Kişisel · {completedSeeds.length}
        </button>

        <button
          type="button"
          onClick={() =>
            setFilter("social")
          }
          className={tabClass(
            filter === "social"
          )}
        >
          Birlikte · {socialExperiences.length}
        </button>
      </nav>}

      {filteredEntries.length > 0 ? (
        <>
          <section className="mt-6 grid grid-cols-1 items-stretch gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {visibleEntries.map(
              (entry) =>
                entry.kind ===
                "personal" ? (
                  <SeedCard editable
                    key={entry.key}
                    seed={entry.seed}
                    isAuthenticated={
                      isAuthenticated
                    }
                    reminderTargetTime={
                      entry.seed
                        .reminder_target_time
                    }
                    reminderTimezone={
                      entry.seed
                        .reminder_timezone
                    }
                  />
                ) : entry.kind === "social" ? (
                  <SocialExperienceCard targetId={sourceTypes.find(s=>s.resource_id===entry.item.id.replace(/^(plan|intent)-/,""))?.target_id}
                    key={entry.key}
                    item={entry.item}
                  />
                ) : (
                  <LovedExperienceCard key={entry.key} item={entry.item} />
                )
            )}
          </section>

          {pageCount > 1 && (
            <nav
              className="mt-6 flex flex-wrap items-center justify-center gap-2"
              aria-label="Deneyimler sayfaları"
            >
              <button
                type="button"
                aria-label="Önceki sayfa"
                disabled={
                  safePage === 1
                }
                onClick={() =>
                  setPage((value) =>
                    Math.max(
                      1,
                      value - 1
                    )
                  )
                }
                className="rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-sm font-bold text-gray-700 transition hover:border-purple-300 hover:text-purple-700 disabled:cursor-not-allowed disabled:border-gray-100 disabled:bg-gray-100 disabled:text-gray-300"
              >
                ←
              </button>

              {Array.from(
                {
                  length:
                    pageCount,
                },
                (_, index) =>
                  index + 1
              ).map(
                (pageNumber) => (
                  <button
                    key={
                      pageNumber
                    }
                    type="button"
                    onClick={() =>
                      setPage(
                        pageNumber
                      )
                    }
                    className={`min-w-10 rounded-xl px-3.5 py-2 text-center text-sm font-black transition ${
                      pageNumber ===
                      safePage
                        ? "bg-gray-950 text-white"
                        : "border border-gray-200 bg-white text-gray-700 hover:border-purple-300 hover:text-purple-700"
                    }`}
                  >
                    {
                      pageNumber
                    }
                  </button>
                )
              )}

              <button
                type="button"
                aria-label="Sonraki sayfa"
                disabled={
                  safePage ===
                  pageCount
                }
                onClick={() =>
                  setPage((value) =>
                    Math.min(
                      pageCount,
                      value + 1
                    )
                  )
                }
                className="rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-sm font-bold text-gray-700 transition hover:border-purple-300 hover:text-purple-700 disabled:cursor-not-allowed disabled:border-gray-100 disabled:bg-gray-100 disabled:text-gray-300"
              >
                →
              </button>
            </nav>
          )}
        </>
      ) : (
        <section className="mt-6 rounded-[32px] border border-dashed border-gray-300 bg-white p-10 text-center">
          <h2 className="text-2xl font-black text-gray-950">
            {filter === "social"
              ? "Henüz sosyal deneyimin yok"
              : filter === "loved"
                ? "Henüz sevdiğin bir deneyim yok"
                : "Henüz deneyimin yok"}
          </h2>
        </section>
      )}
    </>
  );
}
