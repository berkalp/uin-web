import type {
  ReactNode,
} from "react";
import Link from "next/link";

import type {
  ManagedProfileSwitcherRow,
} from "@/components/navigation/AccountContextSwitcher";
import UserAccountMenu from "@/components/navigation/UserAccountMenu";
import NotificationBellButton from "@/components/notifications/NotificationBellButton";

type TimelineHeaderProps = {
  email: string | null;

  personal: {
    fullName: string | null;
    username: string | null;
    avatarUrl: string | null;
  };

  managedProfiles: ManagedProfileSwitcherRow[];

  activeMatchCount: number;
  inboxCount: number;
  directMessageCount?: number;
  unreadNotificationCount: number;
  isAdmin: boolean;

  /*
   * Temporary compatibility for callers that still pass legacy props.
   * Remove this index signature after timeline and managed-profile pages
   * stop sending those obsolete values.
   */
  [key: string]: unknown;
};

function formatBadge(value: number) {
  return value > 9
    ? "9+"
    : String(value);
}


function SeedIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      className="h-5 w-5"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 21V10" />
      <path d="M12 13c-4 0-7-2.5-7-6 4 0 7 2.5 7 6Z" />
      <path d="M12 10c0-4 2.5-7 7-7 0 4-2.5 7-7 7Z" />
    </svg>
  );
}

function DiscoverIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      className="h-5 w-5"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="m15.5 8.5-2.1 4.9-4.9 2.1 2.1-4.9 4.9-2.1Z" />
    </svg>
  );
}

function ExperienceIcon() {
  return <span aria-hidden="true" className="text-lg">✓</span>;
}

function FavoriteIcon() {
  return <span aria-hidden="true" className="text-lg">♡</span>;
}

function FriendsIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      className="h-5 w-5"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="9" cy="8" r="3" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
      <path d="M14 18.5a4 4 0 0 1 7 0" />
    </svg>
  );
}


function CommunitiesIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      className="h-5 w-5"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="8" cy="8" r="3" />
      <circle cx="17" cy="7" r="2.5" />
      <path d="M3.5 19a4.5 4.5 0 0 1 9 0" />
      <path d="M13.5 18.5a3.5 3.5 0 0 1 7 0" />
    </svg>
  );
}


export default function TimelineHeader({
  email,
  personal,
  managedProfiles,
  unreadNotificationCount,
  isAdmin,
}: TimelineHeaderProps) {
  return (
    <header className="relative z-[60]">
      <nav
        aria-label="Primary navigation"
        className="relative z-[70] flex flex-wrap items-center justify-center gap-3"
      >
        <Link
          href="/timeline"
          aria-label="UIN Timeline"
          className="mr-1 flex h-12 items-center rounded-xl px-2 transition hover:bg-white"
        >
          <img
            src="/uin-logo.png"
            alt="uin? logo"
            className="h-11 w-auto"
          />
        </Link>
        <details className="group relative z-[90]">
          <summary className="flex h-12 cursor-pointer list-none items-center gap-2 rounded-xl bg-green-600 px-5 font-semibold text-white shadow-sm transition hover:bg-green-700 [&::-webkit-details-marker]:hidden">
            Create
            <span className="text-[10px] transition group-open:rotate-180">▼</span>
          </summary>

          <div className="absolute left-0 top-full mt-2 w-[390px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-3xl border border-gray-200 bg-white p-3 text-left shadow-2xl">
            <div className="px-3 pb-3 pt-1">
              <p className="text-lg font-black text-gray-950">Ne eklemek istiyorsun?</p>
              <p className="mt-1 text-xs leading-5 text-gray-500">Yapmak istediğini Niyet, yaptığını Deneyim olarak ekle. Başkalarıyla yapacaksan Sosyal Niyet oluştur.</p>
            </div>
            <Link
              href="/seeds/new?mode=personal"
              className="flex items-start gap-3 rounded-2xl border border-gray-100 px-4 py-3 transition hover:border-green-200 hover:bg-green-50"
            >
              <span className="text-2xl" aria-hidden="true">🌱</span>
              <span>
                <span className="inline-flex rounded-full bg-green-50 px-2 py-0.5 text-[9px] font-black tracking-wide text-green-800">KENDİM İÇİN</span>
                <span className="mt-1 block text-sm font-black text-gray-950">Kişisel Niyet oluştur</span>
                <span className="mt-1 block text-xs leading-5 text-gray-500">Okumak, izlemek, öğrenmek, gitmek, denemek veya yapmak istediğin bir şey.</span>
              </span>
            </Link>

            <Link
              href="/onboarding"
              className="mt-2 flex items-start gap-3 rounded-2xl border border-gray-100 px-4 py-3 transition hover:border-violet-200 hover:bg-violet-50"
            >
              <span className="text-2xl" aria-hidden="true">👥</span>
              <span>
                <span className="inline-flex rounded-full bg-violet-50 px-2 py-0.5 text-[9px] font-black tracking-wide text-violet-800">BİRLİKTE</span>
                <span className="mt-1 block text-sm font-black text-gray-950">Sosyal Niyet oluştur</span>
                <span className="mt-1 block text-xs leading-5 text-gray-500">Başkalarıyla gerçekleştirmek istediğin gezi, konser, spor veya buluşma.</span>
              </span>
            </Link>

            <Link href="/seeds/explore?mode=experience" className="mt-2 flex items-start gap-3 rounded-2xl border border-gray-100 px-4 py-3 transition hover:border-purple-200 hover:bg-purple-50">
              <span className="text-2xl" aria-hidden="true">✅</span><span><span className="inline-flex rounded-full bg-purple-50 px-2 py-0.5 text-[9px] font-black tracking-wide text-purple-800">YAPTIM / YAŞADIM</span><span className="mt-1 block text-sm font-black text-gray-950">Deneyim ekle</span><span className="mt-1 block text-xs leading-5 text-gray-500">Daha önce yaptığın, okuduğun, izlediğin, dinlediğin, öğrendiğin veya gittiğin bir şey.</span></span>
            </Link>

            <Link href="/seeds/explore?mode=favorite" className="mt-2 flex items-start gap-3 rounded-2xl border border-gray-100 px-4 py-3 transition hover:border-rose-200 hover:bg-rose-50">
              <span className="text-2xl" aria-hidden="true">♡</span><span><span className="inline-flex rounded-full bg-rose-50 px-2 py-0.5 text-[9px] font-black tracking-wide text-rose-700">SEVİYORUM</span><span className="mt-1 block text-sm font-black text-gray-950">Sevdiğin bir şey ekle</span><span className="mt-1 block text-xs leading-5 text-gray-500">Kişi, eser, yer, kulüp, spor, hobi veya aktivite.</span></span>
            </Link>
          </div>
        </details>

        <Link
          href="/timeline"
          className="flex h-12 items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 font-semibold text-green-800 shadow-sm transition hover:border-green-400 hover:bg-green-100"
        >
          <SeedIcon />
          <span>Niyetlerim</span>
        </Link>

        <Link
          href="/experiences"
          className="flex h-12 items-center gap-2 rounded-xl border border-purple-200 bg-purple-50 px-4 font-semibold text-purple-700 shadow-sm transition hover:border-purple-400 hover:bg-purple-100"
        >
          <ExperienceIcon />
          <span>Deneyimlerim</span>
        </Link>

        <Link
          href="/favorites"
          className="flex h-12 items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 font-semibold text-rose-700 shadow-sm transition hover:border-rose-400 hover:bg-rose-100"
        >
          <FavoriteIcon />
          <span>Sevdiklerim</span>
        </Link>

        <Link
          href="/discover"
          className="flex h-12 items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 font-semibold text-blue-700 shadow-sm transition hover:border-blue-400 hover:bg-blue-100"
        >
          <DiscoverIcon />

          <span>Keşfet</span>
        </Link>


        <Link
          href="/friends"
          className="flex h-12 items-center gap-2 rounded-xl border border-cyan-200 bg-cyan-50 px-4 font-semibold text-cyan-700 shadow-sm transition hover:border-cyan-400 hover:bg-cyan-100"
        >
          <FriendsIcon />

          <span>Arkadaşlar</span>
        </Link>

        <Link
          href="/communities"
          className="flex h-12 items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-4 font-semibold text-violet-700 shadow-sm transition hover:border-violet-400 hover:bg-violet-100"
        >
          <CommunitiesIcon />

          <span>Topluluklar</span>
        </Link>

        <NotificationBellButton
          initialUnreadCount={unreadNotificationCount}
        />

        <UserAccountMenu
          fullName={personal.fullName}
          username={personal.username}
          email={email}
          avatarUrl={personal.avatarUrl}
          managedProfiles={managedProfiles}
          currentContext={{
            type: "personal",
          }}
          isAdmin={isAdmin}
        />
      </nav>
    </header>
  );
}
