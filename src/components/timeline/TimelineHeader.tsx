import type {
  ReactNode,
} from "react";
import Link from "next/link";

import type {
  ManagedProfileSwitcherRow,
} from "@/components/navigation/AccountContextSwitcher";
import UserAccountMenu from "@/components/navigation/UserAccountMenu";
import NotificationBellButton from "@/components/notifications/NotificationBellButton";
import MessageCenterButton from "@/components/messages/MessageCenterButton";

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

function MatchesIcon() {
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
      <circle cx="6" cy="6" r="2" />
      <circle cx="18" cy="6" r="2" />
      <circle cx="12" cy="18" r="2" />
      <path d="M7.8 7.2 10.7 16" />
      <path d="m16.2 7.2-2.9 8.8" />
      <path d="M8 6h8" />
    </svg>
  );
}

function InboxIcon() {
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
      <path d="M4 5h16l2 9v5H2v-5l2-9Z" />
      <path d="M2.5 14h5l1.5 2h6l1.5-2h5" />
    </svg>
  );
}

function IconNavigationButton({
  href,
  label,
  count,
  children,
}: {
  href: string;
  label: string;
  count: number;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      title={label}
      aria-label={
        count > 0
          ? `${label}, ${count}`
          : label
      }
      className="relative flex h-12 w-12 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-700 shadow-sm transition hover:border-green-400 hover:text-green-700"
    >
      {children}

      {count > 0 && (
        <span className="absolute -right-2 -top-2 flex min-h-6 min-w-6 items-center justify-center rounded-full bg-gray-950 px-1.5 text-[11px] font-bold text-white ring-2 ring-gray-50">
          {formatBadge(count)}
        </span>
      )}
    </Link>
  );
}

export default function TimelineHeader({
  email,
  personal,
  managedProfiles,
  activeMatchCount,
  inboxCount,
  directMessageCount = 0,
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

          <div className="absolute left-0 top-full mt-2 w-72 overflow-hidden rounded-2xl border border-gray-200 bg-white p-2 text-left shadow-2xl">
            <Link
              href="/seeds/new"
              className="flex items-start gap-3 rounded-xl px-4 py-3 transition hover:bg-green-50"
            >
              <span className="text-2xl" aria-hidden="true">🌱</span>
              <span>
                <span className="block text-sm font-bold text-gray-950">Plant a Seed</span>
                <span className="mt-1 block text-xs leading-5 text-gray-500">Choose a shared subject or create something personal.</span>
              </span>
            </Link>

            <Link
              href="/onboarding"
              className="mt-1 flex items-start gap-3 rounded-xl px-4 py-3 transition hover:bg-blue-50"
            >
              <span className="text-2xl" aria-hidden="true">◎</span>
              <span>
                <span className="block text-sm font-bold text-gray-950">Create an Intent</span>
                <span className="mt-1 block text-xs leading-5 text-gray-500">Find people for a shared Activity.</span>
              </span>
            </Link>
          </div>
        </details>

        <Link
          href="/seeds"
          className="flex h-12 items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 font-semibold text-green-800 shadow-sm transition hover:border-green-400 hover:bg-green-100"
        >
          <SeedIcon />
          <span>Seeds</span>
        </Link>

        <Link
          href="/discover"
          className="flex h-12 items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 font-semibold text-blue-700 shadow-sm transition hover:border-blue-400 hover:bg-blue-100"
        >
          <DiscoverIcon />

          <span>Discover</span>
        </Link>


        <Link
          href="/friends"
          className="flex h-12 items-center gap-2 rounded-xl border border-cyan-200 bg-cyan-50 px-4 font-semibold text-cyan-700 shadow-sm transition hover:border-cyan-400 hover:bg-cyan-100"
        >
          <FriendsIcon />

          <span>Friends</span>
        </Link>

        <Link
          href="/communities"
          className="flex h-12 items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-4 font-semibold text-violet-700 shadow-sm transition hover:border-violet-400 hover:bg-violet-100"
        >
          <CommunitiesIcon />

          <span>Communities</span>
        </Link>

        <Link
          href="/matches"
          className="flex h-12 items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 font-semibold text-green-700 shadow-sm transition hover:border-green-400 hover:bg-green-100"
        >
          <MatchesIcon />

          <span>Matches</span>

          {activeMatchCount > 0 && (
            <span className="rounded-full bg-green-600 px-2.5 py-1 text-xs font-bold text-white">
              {formatBadge(activeMatchCount)}
            </span>
          )}
        </Link>

        <MessageCenterButton
          initialUnreadCount={directMessageCount}
        />

        <IconNavigationButton
          href="/inbox"
          label="Karar Merkezi"
          count={inboxCount}
        >
          <InboxIcon />
        </IconNavigationButton>

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