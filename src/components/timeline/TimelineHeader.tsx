import type {
  ReactNode,
} from "react";
import Link from "next/link";

import AccountContextSwitcher, {
  type ManagedProfileSwitcherRow,
} from "@/components/navigation/AccountContextSwitcher";
import UserAccountMenu from "@/components/navigation/UserAccountMenu";

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

function BellIcon() {
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
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
      <path d="M10 21h4" />
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
  unreadNotificationCount,
  isAdmin,
}: TimelineHeaderProps) {
  return (
    <header className="relative z-[60] text-center">
      <img
        src="/uin-logo.png"
        alt="uin? logo"
        className="mx-auto h-16 w-auto"
      />

      <h1 className="mt-7 text-4xl font-bold text-gray-900">
        Your Intent Timeline
      </h1>

      {email && (
        <p className="mt-3 text-gray-500">
          {email}
        </p>
      )}

      <div className="relative z-[80] mx-auto mt-7 w-full max-w-md">
        <AccountContextSwitcher
          personal={personal}
          managedProfiles={managedProfiles}
          currentContext={{
            type: "personal",
          }}
        />
      </div>

      <nav
        aria-label="Primary navigation"
        className="relative z-[70] mt-4 flex flex-wrap items-center justify-center gap-3"
      >
        <Link
          href="/onboarding"
          className="flex h-12 items-center rounded-xl bg-green-600 px-5 font-semibold text-white shadow-sm transition hover:bg-green-700"
        >
          Create New Intent
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

        <IconNavigationButton
          href="/inbox"
          label="Inbox"
          count={inboxCount}
        >
          <InboxIcon />
        </IconNavigationButton>

        <IconNavigationButton
          href="/notifications"
          label="Notifications"
          count={unreadNotificationCount}
        >
          <BellIcon />
        </IconNavigationButton>

        <UserAccountMenu
          fullName={personal.fullName}
          username={personal.username}
          email={email}
          avatarUrl={personal.avatarUrl}
          isAdmin={isAdmin}
        />
      </nav>
    </header>
  );
}