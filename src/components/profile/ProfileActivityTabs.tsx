"use client";

import { useMemo, useState } from "react";

import DiscoverIntentCard, {
  type DiscoverIntentRow,
  type IntentLifecycleStatus,
} from "@/components/discover/DiscoverIntentCard";

type ProfileActivityTab =
  | "all"
  | "hosting"
  | "participating";

type ProfileActivitySortMode =
  | "active"
  | "experience";

type ExperienceDateSort =
  | "date-desc"
  | "date-asc";

type ProfileLifecycleMode =
  | "all"
  | "active"
  | "forming"
  | "upcoming";

type ActiveLifecycleFilter =
  | "all"
  | "open"
  | "forming"
  | "planned"
  | "future";

type ProfileActivityTabsProps = {
  eyebrow: string;
  title: string;
  description: string;
  hostedCards: DiscoverIntentRow[];
  participatingCards: DiscoverIntentRow[];
  currentUserId: string;
  isAuthenticated: boolean;
  hostingLabel?: string;
  participatingLabel?: string;
  emptyTitle: string;
  emptyDescription: string;
  sortMode?: ProfileActivitySortMode;
  lifecycleMode?: ProfileLifecycleMode;
};

const PAGE_SIZE = 6;

function cardKey(card: DiscoverIntentRow) {
  return card.resource_id ?? card.plan_id ?? card.intent_id;
}

function deduplicateCards(cards: DiscoverIntentRow[]) {
  return Array.from(
    new Map(cards.map((card) => [cardKey(card), card])).values()
  );
}

function dateTimestamp(value: string | null | undefined) {
  if (!value) {
    return Number.POSITIVE_INFINITY;
  }

  const timestamp = new Date(value).getTime();

  return Number.isFinite(timestamp)
    ? timestamp
    : Number.POSITIVE_INFINITY;
}

function nullableDateTimestamp(value: string | null | undefined) {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

function compareExperienceDates(
  left: number | null,
  right: number | null,
  direction: ExperienceDateSort
) {
  if (left === null && right === null) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return direction === "date-asc" ? left - right : right - left;
}

function activeJourneyRank(card: DiscoverIntentRow) {
  if (
    card.lifecycle_status === "planned" &&
    card.scheduled_start
  ) {
    return 0;
  }

  if (card.lifecycle_status === "forming") {
    return 1;
  }

  if (
    card.lifecycle_status === "open" ||
    card.lifecycle_status === "future"
  ) {
    return 2;
  }

  return 3;
}

function sortProfileCards(
  cards: DiscoverIntentRow[],
  mode: ProfileActivitySortMode,
  experienceDateSort: ExperienceDateSort = "date-desc"
) {
  return [...cards].sort((left, right) => {
    if (mode === "experience") {
      const leftTimestamp = nullableDateTimestamp(
        left.completed_at ?? left.scheduled_end ?? left.end_date
      );
      const rightTimestamp = nullableDateTimestamp(
        right.completed_at ?? right.scheduled_end ?? right.end_date
      );

      const dateComparison = compareExperienceDates(
        leftTimestamp,
        rightTimestamp,
        experienceDateSort
      );

      if (dateComparison !== 0) return dateComparison;
      return compareExperienceDates(
        nullableDateTimestamp(left.created_at),
        nullableDateTimestamp(right.created_at),
        "date-desc"
      );
    }

    const rankComparison =
      activeJourneyRank(left) - activeJourneyRank(right);

    if (rankComparison !== 0) {
      return rankComparison;
    }

    const leftTimestamp = dateTimestamp(
      left.scheduled_start ?? left.start_date
    );
    const rightTimestamp = dateTimestamp(
      right.scheduled_start ?? right.start_date
    );

    if (leftTimestamp !== rightTimestamp) {
      return leftTimestamp - rightTimestamp;
    }

    return dateTimestamp(left.created_at) - dateTimestamp(right.created_at);
  });
}

function lifecycleMatches(
  lifecycle: IntentLifecycleStatus,
  filter: ActiveLifecycleFilter
) {
  return filter === "all" || lifecycle === filter;
}

export function filterProfileCardsForLifecycle(
  cards: DiscoverIntentRow[],
  sortMode: ProfileActivitySortMode,
  lifecycleMode: ProfileLifecycleMode,
  lifecycleFilter: ActiveLifecycleFilter
) {
  if (sortMode !== "active") {
    return cards;
  }

  if (lifecycleMode === "active") {
    return cards.filter((card) => card.lifecycle_status === "open");
  }

  if (lifecycleMode === "forming") {
    return cards.filter((card) => card.lifecycle_status === "forming");
  }

  if (lifecycleMode === "upcoming") {
    return cards.filter(
      (card) =>
        card.lifecycle_status === "planned" ||
        card.lifecycle_status === "future"
    );
  }

  return cards.filter((card) =>
    lifecycleMatches(card.lifecycle_status, lifecycleFilter)
  );
}

export default function ProfileActivityTabs({
  eyebrow,
  title,
  description,
  hostedCards,
  participatingCards,
  currentUserId,
  isAuthenticated,
  hostingLabel = "Yürüttükleri",
  participatingLabel = "Katıldıkları",
  emptyTitle,
  emptyDescription,
  sortMode = "active",
  lifecycleMode = "all",
}: ProfileActivityTabsProps) {
  const [activeTab, setActiveTab] =
    useState<ProfileActivityTab>("all");
  const [lifecycleFilter, setLifecycleFilter] =
    useState<ActiveLifecycleFilter>("all");
  const [experienceDateSort, setExperienceDateSort] =
    useState<ExperienceDateSort>("date-desc");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const sortedHostedCards = useMemo(
    () =>
      sortProfileCards(
        deduplicateCards(hostedCards),
        sortMode,
        experienceDateSort
      ),
    [experienceDateSort, hostedCards, sortMode]
  );

  const sortedParticipatingCards = useMemo(
    () =>
      sortProfileCards(
        deduplicateCards(participatingCards),
        sortMode,
        experienceDateSort
      ),
    [experienceDateSort, participatingCards, sortMode]
  );

  const allCards = useMemo(
    () =>
      sortProfileCards(
        deduplicateCards([
          ...sortedHostedCards,
          ...sortedParticipatingCards,
        ]),
        sortMode,
        experienceDateSort
      ),
    [experienceDateSort, sortedHostedCards, sortedParticipatingCards, sortMode]
  );

  const roleCards =
    activeTab === "hosting"
      ? sortedHostedCards
      : activeTab === "participating"
        ? sortedParticipatingCards
        : allCards;

  const lifecycleFilters: Array<{
    value: ActiveLifecycleFilter;
    label: string;
    count: number;
  }> = useMemo(() => {
    const choices: Array<{
      value: ActiveLifecycleFilter;
      label: string;
    }> = [
      { value: "all", label: "Tümü" },
      { value: "open", label: "Aktif" },
      { value: "forming", label: "Planlanıyor" },
      { value: "planned", label: "Planlandı" },
      { value: "future", label: "Gelecek" },
    ];

    return choices.map((choice) => ({
      ...choice,
      count:
        choice.value === "all"
          ? roleCards.length
          : roleCards.filter((card) =>
              lifecycleMatches(card.lifecycle_status, choice.value)
            ).length,
    }));
  }, [roleCards]);

  const lifecycleFilteredCardsByTab = useMemo(
    () => ({
      all: filterProfileCardsForLifecycle(
        allCards,
        sortMode,
        lifecycleMode,
        lifecycleFilter
      ),
      hosting: filterProfileCardsForLifecycle(
        sortedHostedCards,
        sortMode,
        lifecycleMode,
        lifecycleFilter
      ),
      participating: filterProfileCardsForLifecycle(
        sortedParticipatingCards,
        sortMode,
        lifecycleMode,
        lifecycleFilter
      ),
    }),
    [
      allCards,
      lifecycleFilter,
      lifecycleMode,
      sortMode,
      sortedHostedCards,
      sortedParticipatingCards,
    ]
  );
  const filteredCards = lifecycleFilteredCardsByTab[activeTab];

  const visibleCards = filteredCards.slice(0, visibleCount);
  const hasMoreCards = visibleCount < filteredCards.length;
  const hasExpandedCards = filteredCards.length > PAGE_SIZE;

  const tabs: Array<{
    value: ProfileActivityTab;
    label: string;
    count: number;
  }> = [
    {
      value: "all",
      label: "Tümü",
      count: lifecycleFilteredCardsByTab.all.length,
    },
    {
      value: "hosting",
      label: hostingLabel,
      count: lifecycleFilteredCardsByTab.hosting.length,
    },
    {
      value: "participating",
      label: participatingLabel,
      count: lifecycleFilteredCardsByTab.participating.length,
    },
  ];

  return (
    <section className="mt-8 scroll-mt-8">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-green-700">
            {eyebrow}
          </p>
          <h2 className="mt-2 text-2xl font-bold text-gray-950">
            {title}
          </h2>
          <p className="mt-2 text-sm leading-6 text-gray-500">
            {description}
          </p>
        </div>

        <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
          <div
            className="inline-flex w-full overflow-x-auto rounded-2xl border border-gray-200 bg-white p-1 shadow-sm lg:w-auto"
            role="tablist"
            aria-label={`${eyebrow} rol filtreleri`}
          >
            {tabs.map((tab) => {
            const isActive = activeTab === tab.value;

            return (
              <button
                key={tab.value}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => {
                  setActiveTab(tab.value);
                  setVisibleCount(PAGE_SIZE);
                }}
                className={`flex min-w-max items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                  isActive
                    ? "bg-gray-950 text-white shadow-sm"
                    : "text-gray-500 hover:bg-gray-50 hover:text-gray-950"
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] ${
                    isActive
                      ? "bg-white/15 text-white"
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
            })}
          </div>

          {sortMode === "experience" && filteredCards.length > 0 && (
            <label className="flex min-w-[205px] items-center gap-2 rounded-2xl border border-gray-200 bg-white px-3 py-2 shadow-sm">
              <span className="shrink-0 text-[10px] font-black uppercase tracking-[0.14em] text-gray-400">
                Sırala
              </span>
              <select
                value={experienceDateSort}
                onChange={(event) => {
                  setExperienceDateSort(event.target.value as ExperienceDateSort);
                  setVisibleCount(PAGE_SIZE);
                }}
                className="min-w-0 flex-1 border-0 bg-transparent p-1 text-sm font-bold text-gray-700 outline-none"
                aria-label="Sosyal deneyimleri sırala"
              >
                <option value="date-desc">En yeni</option>
                <option value="date-asc">En eski</option>
              </select>
            </label>
          )}
        </div>
      </div>

      {sortMode === "active" && lifecycleMode === "all" && roleCards.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="mr-1 text-[10px] font-bold uppercase tracking-[0.16em] text-gray-400">
            Durum
          </span>
          {lifecycleFilters.map((item) => {
            const active = lifecycleFilter === item.value;

            return (
              <button
                key={item.value}
                type="button"
                onClick={() => {
                  setLifecycleFilter(item.value);
                  setVisibleCount(PAGE_SIZE);
                }}
                className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                  active
                    ? "border-green-700 bg-green-700 text-white"
                    : "border-gray-200 bg-white text-gray-600 hover:border-green-300 hover:text-green-800"
                }`}
              >
                {item.label}
                <span className="ml-1.5 opacity-70">{item.count}</span>
              </button>
            );
          })}
        </div>
      )}

      {filteredCards.length > 0 ? (
        <>
          <div className="uin-card-grid mt-5 grid gap-5">
            {visibleCards.map((intent) => (
              <DiscoverIntentCard
                key={`${eyebrow}-${activeTab}-${cardKey(intent)}`}
                intent={intent}
                currentUserId={currentUserId}
                isAuthenticated={isAuthenticated}
                actionMode="profile"
              />
            ))}
          </div>

        {hasExpandedCards && (
          <div className="mt-6 flex justify-center">
            <button
              type="button"
              onClick={() =>
                setVisibleCount((current) =>
                  hasMoreCards
                    ? Math.min(current + PAGE_SIZE, filteredCards.length)
                    : PAGE_SIZE
                )
              }
              className="rounded-2xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-bold text-gray-700 shadow-sm transition hover:border-green-300 hover:bg-green-50 hover:text-green-800"
            >
              {hasMoreCards ? "Devamını gör" : "Daha az göster"}
            </button>
          </div>
        )}
        </>
      ) : (
        <div className="mt-5 rounded-3xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <h3 className="text-lg font-bold text-gray-950">
            {emptyTitle}
          </h3>
          <p className="mt-2 text-sm leading-6 text-gray-500">
            {emptyDescription}
          </p>
        </div>
      )}
    </section>
  );
}

