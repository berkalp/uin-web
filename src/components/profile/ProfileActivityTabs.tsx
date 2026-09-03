"use client";

import { useEffect, useMemo, useState } from "react";

import DiscoverIntentCard, {
  type DiscoverIntentRow,
  type IntentLifecycleStatus,
} from "@/components/discover/DiscoverIntentCard";
import ProfilePagination from "@/components/profile/ProfilePagination";

type ProfileActivityTab =
  | "all"
  | "hosting"
  | "participating";

type ProfileActivitySortMode =
  | "active"
  | "experience";

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
  mode: ProfileActivitySortMode
) {
  return [...cards].sort((left, right) => {
    if (mode === "experience") {
      const leftTimestamp = dateTimestamp(
        left.completed_at ?? left.scheduled_end ?? left.end_date
      );
      const rightTimestamp = dateTimestamp(
        right.completed_at ?? right.scheduled_end ?? right.end_date
      );

      return rightTimestamp - leftTimestamp;
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
  const [page, setPage] = useState(0);

  const sortedHostedCards = useMemo(
    () => sortProfileCards(deduplicateCards(hostedCards), sortMode),
    [hostedCards, sortMode]
  );

  const sortedParticipatingCards = useMemo(
    () =>
      sortProfileCards(
        deduplicateCards(participatingCards),
        sortMode
      ),
    [participatingCards, sortMode]
  );

  const allCards = useMemo(
    () =>
      sortProfileCards(
        deduplicateCards([
          ...sortedHostedCards,
          ...sortedParticipatingCards,
        ]),
        sortMode
      ),
    [sortedHostedCards, sortedParticipatingCards, sortMode]
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
      { value: "all", label: "TÃ¼mÃ¼" },
      { value: "open", label: "Aktif" },
      { value: "forming", label: "PlanlanÄ±yor" },
      { value: "planned", label: "PlanlandÄ±" },
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

  const filteredCards = useMemo(() => {
    if (sortMode !== "active") {
      return roleCards;
    }

    if (lifecycleMode === "active") {
      return roleCards.filter((card) => card.lifecycle_status === "open");
    }

    if (lifecycleMode === "forming") {
      return roleCards.filter((card) => card.lifecycle_status === "forming");
    }

    if (lifecycleMode === "upcoming") {
      return roleCards.filter(
        (card) =>
          card.lifecycle_status === "planned" ||
          card.lifecycle_status === "future"
      );
    }

    return roleCards.filter((card) =>
      lifecycleMatches(card.lifecycle_status, lifecycleFilter)
    );
  }, [lifecycleFilter, lifecycleMode, roleCards, sortMode]);

  const pageCount = Math.max(
    1,
    Math.ceil(filteredCards.length / PAGE_SIZE)
  );
  const safePage = Math.min(page, pageCount - 1);
  const visibleCards = filteredCards.slice(
    safePage * PAGE_SIZE,
    safePage * PAGE_SIZE + PAGE_SIZE
  );

  useEffect(() => {
    setPage(0);
  }, [activeTab, lifecycleFilter]);

  useEffect(() => {
    if (page > pageCount - 1) {
      setPage(Math.max(0, pageCount - 1));
    }
  }, [page, pageCount]);

  const tabs: Array<{
    value: ProfileActivityTab;
    label: string;
    count: number;
  }> = [
    {
      value: "all",
      label: "TÃ¼mÃ¼",
      count: allCards.length,
    },
    {
      value: "hosting",
      label: hostingLabel,
      count: sortedHostedCards.length,
    },
    {
      value: "participating",
      label: participatingLabel,
      count: sortedParticipatingCards.length,
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
                onClick={() => setActiveTab(tab.value)}
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
                onClick={() => setLifecycleFilter(item.value)}
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
          <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
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

          <ProfilePagination
            page={safePage}
            pageCount={pageCount}
            onPageChange={setPage}
            label={`${eyebrow} sayfalarÄ±`}
          />
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

