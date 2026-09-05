"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import SeedCard from "@/components/seeds/SeedCard";
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
  isAuthenticated: boolean;
};

type ExperienceFilter = "all" | "personal" | "social";

type ExperienceEntry =
  | {
      kind: "personal";
      key: string;
      sortAt: string;
      seed: SeedWithReminder;
    }
  | {
      kind: "social";
      key: string;
      sortAt: string;
      item: SocialExperienceItem;
    };

const EXPERIENCE_PAGE_SIZE = 24;

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

function timestamp(value: string) {
  const result = new Date(value).getTime();
  return Number.isFinite(result) ? result : 0;
}

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

function SocialExperienceCard({
  item,
}: {
  item: SocialExperienceItem;
}) {
  const dateLabel = formatDate(item.sortAt);

  return (
    <Link
      href={item.href}
      className="group flex min-h-[330px] min-w-0 flex-col overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="relative h-40 shrink-0 overflow-hidden bg-gray-950">
        {item.coverUrl ? (
          <img
            src={item.coverUrl}
            alt={item.title}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="h-full bg-gradient-to-br from-purple-950 via-gray-900 to-gray-950" />
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-black/30" />

        <span className="absolute left-3 top-3 rounded-full bg-purple-600/95 px-2.5 py-1 text-[9px] font-black uppercase tracking-wide text-white">
          Sosyal deneyim
        </span>

        <div className="absolute inset-x-3 bottom-3">
          <p className="truncate text-[9px] font-black uppercase tracking-[0.12em] text-purple-200">
            {item.categoryName}
          </p>

          <h3 className="mt-1 line-clamp-2 text-lg font-black leading-tight text-white">
            {item.title}
          </h3>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-4">
        {dateLabel && (
          <p className="text-xs font-bold text-gray-700">
            {dateLabel}
          </p>
        )}

        {item.locationLabel && (
          <p className="mt-2 line-clamp-2 text-xs leading-5 text-gray-500">
            {item.locationLabel}
          </p>
        )}

        <div className="mt-auto flex items-center justify-between gap-2 pt-5">
          <span className="rounded-full bg-purple-50 px-2.5 py-1 text-[10px] font-black text-purple-700">
            {item.roleLabel}
          </span>

          <span className="text-xs font-black text-gray-500 transition group-hover:text-purple-700">
            Görüntüle →
          </span>
        </div>
      </div>
    </Link>
  );
}

export default function ExperienceDashboard({
  seeds,
  socialExperiences,
  isAuthenticated,
}: ExperienceDashboardProps) {
  const [filter, setFilter] =
    useState<ExperienceFilter>("all");

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

  const allEntries =
    useMemo<ExperienceEntry[]>(() => {
      const personalEntries: ExperienceEntry[] =
        completedSeeds.map((seed) => ({
          kind: "personal",
          key: `personal-${seed.seed_id}`,
          sortAt: getPersonalSortAt(seed),
          seed,
        }));

      const socialEntries: ExperienceEntry[] =
        socialExperiences.map((item) => ({
          kind: "social",
          key: `social-${item.id}`,
          sortAt: item.sortAt,
          item,
        }));

      return [
        ...personalEntries,
        ...socialEntries,
      ].sort(
        (first, second) =>
          timestamp(second.sortAt) -
          timestamp(first.sortAt)
      );
    }, [completedSeeds, socialExperiences]);

  const filteredEntries = useMemo(() => {
    if (filter === "personal") {
      return allEntries.filter(
        (entry) =>
          entry.kind === "personal"
      );
    }

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
  }, [filter]);

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
      <nav className="mt-6 grid gap-3 rounded-[28px] border border-gray-200 bg-white p-3 shadow-sm sm:grid-cols-3">
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
          onClick={() =>
            setFilter("personal")
          }
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
          Sosyal deneyimler · {socialExperiences.length}
        </button>
      </nav>

      {filteredEntries.length > 0 ? (
        <>
          <section className="mt-6 grid items-stretch gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
            {visibleEntries.map(
              (entry) =>
                entry.kind ===
                "personal" ? (
                  <SeedCard
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
                ) : (
                  <SocialExperienceCard
                    key={entry.key}
                    item={entry.item}
                  />
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
              : filter ===
                  "personal"
                ? "Henüz kişisel deneyimin yok"
                : "Henüz deneyimin yok"}
          </h2>
        </section>
      )}
    </>
  );
}