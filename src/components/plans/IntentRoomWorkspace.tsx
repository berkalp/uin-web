"use client";

import {
  Children,
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";

export type IntentRoomNavItem = {
  id: string;
  label: string;
  description: string;
  meta?: string;
  icon: string;
  secondary?: boolean;
};

export type IntentRoomStat = {
  label: string;
  value: string;
  icon: string;
  tone?: "default" | "good" | "warning";
};

export type IntentRoomTeamMember = {
  id: string;
  name: string;
  avatarUrl: string | null;
  role: "host" | "co_host" | "participant";
};

type IntentRoomWorkspaceProps = {
  hero: ReactNode;
  stats: IntentRoomStat[];
  navItems: IntentRoomNavItem[];
  defaultSectionId: string;
  children: ReactNode;
  team: {
    total: number;
    hostCount: number;
    coHostCount: number;
    participantCount: number;
    members: IntentRoomTeamMember[];
  };
  teamInviteAction?: ReactNode;
  chat: ReactNode;
  chatExpanded?: ReactNode;
  reminders: ReactNode;
  nextStep?: {
    sectionId: string;
    label: string;
    hint?: string;
  } | null;
  origins?: ReactNode;
  originCount?: number;
};

function initial(value: string) {
  return value.trim().charAt(0).toUpperCase() || "?";
}

function teamRoleRing(role: IntentRoomTeamMember["role"]) {
  if (role === "host") return "ring-gray-900";
  if (role === "co_host") return "ring-purple-400";
  return "ring-white";
}

export default function IntentRoomWorkspace({
  hero,
  stats,
  navItems,
  defaultSectionId,
  children,
  team,
  teamInviteAction,
  chat,
  chatExpanded,
  reminders,
  nextStep,
  origins,
  originCount = 0,
}: IntentRoomWorkspaceProps) {
  const panels = Children.toArray(children);
  const initialSection = navItems.some((item) => item.id === defaultSectionId)
    ? defaultSectionId
    : navItems[0]?.id ?? "";

  const [activeSectionId, setActiveSectionId] = useState(initialSection);
  const [chatWindowOpen, setChatWindowOpen] = useState(false);
  const [chatFullscreen, setChatFullscreen] = useState(false);

  const activeIndex = Math.max(
    0,
    navItems.findIndex((item) => item.id === activeSectionId)
  );
  const activeItem = navItems[activeIndex] ?? navItems[0];
  const activePanel = panels[activeIndex] ?? panels[0] ?? null;

  const primaryItems = useMemo(
    () => navItems.filter((item) => !item.secondary),
    [navItems]
  );
  const secondaryItems = useMemo(
    () => navItems.filter((item) => item.secondary),
    [navItems]
  );

  const visibleMembers = team.members.slice(0, 8);
  const remainingMembers = Math.max(0, team.total - visibleMembers.length);

  useEffect(() => {
    if (!chatWindowOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setChatWindowOpen(false);
        setChatFullscreen(false);
      }
    }

    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [chatWindowOpen]);

  function selectSection(id: string) {
    if (!navItems.some((item) => item.id === id)) return;
    setActiveSectionId(id);
  }

  function closeChatWindow() {
    setChatWindowOpen(false);
    setChatFullscreen(false);
  }

  function renderNavItem(item: IntentRoomNavItem) {
    const active = item.id === activeSectionId;

    return (
      <button
        key={item.id}
        type="button"
        onClick={() => selectSection(item.id)}
        className={`group flex w-full items-center gap-3.5 rounded-2xl border px-4 py-3.5 text-left transition ${
          active
            ? "border-green-200 bg-green-50 text-green-950 shadow-sm"
            : "border-transparent bg-transparent text-gray-700 hover:border-gray-200 hover:bg-white"
        }`}
      >
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-base font-black ${
            active
              ? "bg-green-100 text-green-700"
              : "bg-gray-100 text-gray-600 group-hover:bg-gray-200"
          }`}
          aria-hidden="true"
        >
          {item.icon}
        </span>

        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-black leading-5">
            {item.label}
          </span>
          {item.meta && (
            <span
              className={`mt-1 block truncate text-xs font-bold ${
                active ? "text-green-700" : "text-gray-400"
              }`}
            >
              {item.meta}
            </span>
          )}
        </span>

        <span
          className={`text-lg transition ${
            active ? "translate-x-0 text-green-600" : "-translate-x-1 text-gray-300"
          }`}
          aria-hidden="true"
        >
          ›
        </span>
      </button>
    );
  }

  return (
    <>
      <section className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_420px] 2xl:grid-cols-[minmax(0,1fr)_440px]">
        <div className="min-w-0 space-y-5">
          {hero}

          {stats.length > 0 && (
            <section className="grid overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm sm:grid-cols-2 lg:grid-cols-5">
              {stats.map((stat) => (
                <div
                  key={stat.label}
                  className="flex min-w-0 items-center gap-3.5 border-b border-gray-100 px-5 py-4 last:border-b-0 sm:border-r sm:[&:nth-child(2n)]:border-r-0 lg:border-b-0 lg:[&:nth-child(2n)]:border-r lg:last:border-r-0"
                >
                  <span
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-lg ${
                      stat.tone === "warning"
                        ? "bg-red-50 text-red-700"
                        : stat.tone === "good"
                          ? "bg-green-50 text-green-700"
                          : "bg-gray-50 text-gray-700"
                    }`}
                    aria-hidden="true"
                  >
                    {stat.icon}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-bold uppercase tracking-wide text-gray-400">
                      {stat.label}
                    </span>
                    <span
                      className={`mt-1 block truncate text-base font-black ${
                        stat.tone === "warning" ? "text-red-700" : "text-gray-950"
                      }`}
                    >
                      {stat.value}
                    </span>
                  </span>
                </div>
              ))}
            </section>
          )}

          <section className="grid min-h-[700px] gap-5 rounded-[32px] border border-gray-200 bg-white p-4 shadow-sm lg:grid-cols-[280px_minmax(0,1fr)] xl:p-5">
            <nav
              className="rounded-[26px] bg-gray-50 p-2.5"
              aria-label="Niyet Odası bölümleri"
            >
              <div className="space-y-1.5">{primaryItems.map(renderNavItem)}</div>

              {secondaryItems.length > 0 && (
                <div className="mt-4 border-t border-gray-200 pt-4">
                  <p className="px-3 pb-2 text-[10px] font-black uppercase tracking-[0.16em] text-gray-400">
                    Diğer
                  </p>
                  <div className="space-y-1.5">{secondaryItems.map(renderNavItem)}</div>
                </div>
              )}
            </nav>

            <div className="min-w-0 rounded-[26px] border border-gray-100 bg-white p-5 md:p-6 xl:p-7 [&_.text-xs]:!text-[13px] [&_.text-sm]:!text-[15px]">
              {activeItem && (
                <div className="mb-6 border-b border-gray-100 pb-5">
                  <div className="flex items-start gap-3.5">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-green-50 text-lg text-green-700">
                      {activeItem.icon}
                    </span>
                    <div className="min-w-0">
                      <h2 className="text-2xl font-black tracking-tight text-gray-950">
                        {activeItem.label}
                      </h2>
                      <p className="mt-1.5 text-[15px] leading-6 text-gray-500">
                        {activeItem.description}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="min-w-0">{activePanel}</div>
            </div>
          </section>

          {nextStep && (
            <button
              type="button"
              onClick={() => selectSection(nextStep.sectionId)}
              className="flex w-full items-center gap-3.5 rounded-2xl border border-amber-200 bg-amber-50/70 px-5 py-4 text-left transition hover:border-amber-300 hover:bg-amber-50"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-amber-600 shadow-sm">
                💡
              </span>
              <span className="min-w-0 flex-1 text-[15px] text-gray-700">
                <strong className="mr-2 text-gray-950">Sıradaki adım:</strong>
                {nextStep.label}
                {nextStep.hint && (
                  <span className="ml-2 text-sm text-gray-400">{nextStep.hint}</span>
                )}
              </span>
              <span className="text-2xl text-gray-400" aria-hidden="true">
                ›
              </span>
            </button>
          )}

          {origins && originCount > 0 && (
            <details className="group rounded-2xl border border-gray-200 bg-white/70 shadow-sm">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-3.5 text-left">
                <span className="flex items-center gap-2 text-sm font-bold text-gray-500">
                  <span className="text-green-600" aria-hidden="true">
                    ⌁
                  </span>
                  Origins · {originCount} kaynak Niyet
                </span>
                <span
                  className="text-sm text-gray-400 transition group-open:rotate-180"
                  aria-hidden="true"
                >
                  ⌄
                </span>
              </summary>
              <div className="border-t border-gray-100 p-4">{origins}</div>
            </details>
          )}
        </div>

        <aside className="min-w-0 space-y-5 xl:sticky xl:top-5">
          <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-baseline gap-2">
                <h2 className="text-xl font-black text-gray-950">Ekip</h2>
                <span className="text-sm font-semibold text-gray-400">{team.total} kişi</span>
              </div>
              {navItems.some((item) => item.id === "team") && (
                <button
                  type="button"
                  onClick={() => selectSection("team")}
                  className="text-sm font-black text-green-700 transition hover:text-green-800"
                >
                  Tümünü Gör →
                </button>
              )}
            </div>

            <dl className="mt-5 grid grid-cols-3 divide-x divide-gray-100 text-center">
              <div className="px-2">
                <dt className="text-xs font-semibold text-gray-400">Ana Yürüten</dt>
                <dd className="mt-1.5 text-base font-black text-gray-950">{team.hostCount}</dd>
              </div>
              <div className="px-2">
                <dt className="text-xs font-semibold text-gray-400">Birlikte</dt>
                <dd className="mt-1.5 text-base font-black text-gray-950">{team.coHostCount}</dd>
              </div>
              <div className="px-2">
                <dt className="text-xs font-semibold text-gray-400">Katılımcı</dt>
                <dd className="mt-1.5 text-base font-black text-gray-950">{team.participantCount}</dd>
              </div>
            </dl>

            <div className="mt-5 flex items-center -space-x-2">
              {visibleMembers.map((member) =>
                member.avatarUrl ? (
                  <img
                    key={member.id}
                    src={member.avatarUrl}
                    alt={member.name}
                    title={member.name}
                    className={`h-11 w-11 rounded-full border-2 border-white object-cover ring-1 ${teamRoleRing(member.role)}`}
                  />
                ) : (
                  <span
                    key={member.id}
                    title={member.name}
                    className={`flex h-11 w-11 items-center justify-center rounded-full border-2 border-white bg-gray-100 text-sm font-black text-gray-600 ring-1 ${teamRoleRing(member.role)}`}
                  >
                    {initial(member.name)}
                  </span>
                )
              )}
              {remainingMembers > 0 && (
                <span className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-white bg-gray-50 text-xs font-black text-gray-500 ring-1 ring-gray-200">
                  +{remainingMembers}
                </span>
              )}
            </div>

            {teamInviteAction && <div className="mt-5">{teamInviteAction}</div>}
          </section>

          <div id="room-chat" className="relative">
            {!chatWindowOpen ? (
              <>
                <button
                  type="button"
                  onClick={() => setChatWindowOpen(true)}
                  className="absolute right-5 top-4 z-10 rounded-full border border-gray-200 bg-white/95 px-3 py-1.5 text-xs font-black text-gray-700 shadow-sm backdrop-blur transition hover:border-green-200 hover:text-green-700"
                  aria-label="Sohbeti ayrı pencerede aç"
                >
                  ↗ Aç
                </button>
                {chat}
              </>
            ) : (
              <button
                type="button"
                onClick={() => setChatWindowOpen(true)}
                className="flex w-full items-center justify-between rounded-3xl border border-green-200 bg-green-50 px-5 py-5 text-left shadow-sm"
              >
                <span>
                  <span className="block text-lg font-black text-green-950">Sohbet açık</span>
                  <span className="mt-1 block text-sm text-green-700">
                    Konuşma ayrı pencerede devam ediyor.
                  </span>
                </span>
                <span className="text-xl text-green-700">↗</span>
              </button>
            )}
          </div>

          <div id="room-reminders">{reminders}</div>
        </aside>
      </section>

      {chatWindowOpen && (
        <div
          className={`fixed inset-0 z-[100] bg-gray-950/40 backdrop-blur-sm ${
            chatFullscreen ? "p-0" : "flex items-center justify-center p-4 md:p-8"
          }`}
          role="dialog"
          aria-modal="true"
          aria-label="Niyet Odası sohbeti"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target && !chatFullscreen) {
              closeChatWindow();
            }
          }}
        >
          <section
            className={`flex min-h-0 flex-col overflow-hidden bg-white shadow-2xl ${
              chatFullscreen
                ? "h-full w-full rounded-none"
                : "h-[min(900px,calc(100vh-64px))] w-[min(980px,calc(100vw-64px))] rounded-[30px] border border-white/60"
            }`}
          >
            <header className="flex shrink-0 items-center justify-between gap-4 border-b border-gray-200 bg-white px-5 py-4 md:px-6">
              <div className="min-w-0">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-50 text-lg text-green-700">
                    ◌
                  </span>
                  <div className="min-w-0">
                    <h2 className="truncate text-xl font-black text-gray-950">Niyet Odası Sohbeti</h2>
                    <p className="mt-0.5 text-sm text-gray-500">
                      Ekip konuşması aynı odada Niyetten Aktiviteye devam eder.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => setChatFullscreen((value) => !value)}
                  className="rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm font-black text-gray-700 transition hover:bg-gray-50"
                >
                  {chatFullscreen ? "Pencere" : "Tam ekran"}
                </button>
                <button
                  type="button"
                  onClick={closeChatWindow}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-xl font-bold text-gray-600 transition hover:bg-gray-200"
                  aria-label="Sohbeti kapat"
                >
                  ×
                </button>
              </div>
            </header>

            <div className="min-h-0 flex-1 bg-gray-100 p-3 md:p-5">
              <div className="h-full min-h-0 [&>section]:h-full [&>section]:min-h-0">
                {chatExpanded ?? chat}
              </div>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
