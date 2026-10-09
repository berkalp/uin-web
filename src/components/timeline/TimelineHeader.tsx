import Link from "next/link";
import type { ReactNode } from "react";

import type { ManagedProfileSwitcherRow } from "@/components/navigation/AccountContextSwitcher";
import PrimaryNavLink from "@/components/navigation/PrimaryNavLink";
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
  activeMatchCount?: number | null;
  inboxCount?: number | null;
  directMessageCount?: number | null;
  unreadNotificationCount: number | null;
  isAdmin: boolean;
};

function DiscoverIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2.1 4.9-4.9 2.1 2.1-4.9 4.9-2.1Z"/></svg>;
}

function HomeIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/></svg>;
}

function FriendsIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0"/><path d="M14 18.5a4 4 0 0 1 7 0"/></svg>;
}

function InboxIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M4 5h16v13H4z"/><path d="m4 13 4 4h8l4-4"/></svg>;
}

function MessageIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M4 5h16v12H8l-4 3V5Z"/><path d="M8 9h8M8 13h5"/></svg>;
}

function MatchIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M8.5 14.5 4 19m11.5-9.5L20 5"/><circle cx="8" cy="9" r="4"/><circle cx="16" cy="15" r="4"/></svg>;
}

function HeaderActionLink({
  href,
  label,
  count,
  children,
}: {
  href: string;
  label: string;
  count?: number | null;
  children: ReactNode;
}) {
  const showBadge = count === null || (typeof count === "number" && count > 0);
  const badgeLabel = count === null ? "sayı yüklenemedi" : `${count} yeni`;

  return (
    <Link
      href={href}
      prefetch={false}
      title={label}
      aria-label={showBadge ? `${label}, ${badgeLabel}` : label}
      className="relative hidden h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-gray-200 bg-white text-gray-700 shadow-sm transition hover:border-emerald-300 hover:text-emerald-700 lg:flex"
    >
      {children}
      {showBadge && (
        <span className={`absolute -right-1.5 -top-1.5 flex min-h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-black text-white ${count === null ? "bg-amber-500" : "bg-rose-600"}`}>
          {count === null ? "?" : count > 99 ? "99+" : count}
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
  directMessageCount,
  unreadNotificationCount,
  isAdmin,
}: TimelineHeaderProps) {
  return (
    <>
      <header className="fixed inset-x-0 top-0 z-[90] border-b border-gray-200/80 bg-white/95 shadow-sm backdrop-blur-xl">
        <div className="mx-auto w-full max-w-[1320px] px-3 py-3 sm:px-5">
          <nav aria-label="Ana navigasyon" className="flex min-h-14 items-center gap-2 overflow-visible">
            <Link href="/ideas" aria-label="Kütüphane" className="mr-auto flex h-14 items-center rounded-2xl px-1.5 transition hover:bg-gray-50"><img src="/uin-logo.png" alt="uin? logo" className="h-12 w-auto"/></Link>
            <div className="hidden items-center gap-2 md:flex">
              <PrimaryNavLink href="/ideas"><HomeIcon/><span>Kütüphane</span></PrimaryNavLink>
              <PrimaryNavLink href="/discover"><DiscoverIcon/><span>Etkinlikler</span></PrimaryNavLink>
              <PrimaryNavLink href="/friends"><FriendsIcon/><span>Arkadaşlar</span></PrimaryNavLink>
            </div>
            <div className="hidden items-center gap-2 lg:flex">
              <HeaderActionLink href="/inbox" label="Karar Merkezi" count={inboxCount}><InboxIcon/></HeaderActionLink>
              <HeaderActionLink href="/messages" label="Mesajlar" count={directMessageCount}><MessageIcon/></HeaderActionLink>
              <HeaderActionLink href="/matches" label="Eşleşmeler" count={activeMatchCount}><MatchIcon/></HeaderActionLink>
            </div>
            <UserAccountMenu fullName={personal.fullName} username={personal.username} email={email} avatarUrl={personal.avatarUrl} managedProfiles={managedProfiles} currentContext={{ type: "personal" }} isAdmin={isAdmin}/>
            <Link href="/friends" title="Arkadaşlar" aria-label="Arkadaşlar" className="hidden h-14 w-14 shrink-0 items-center justify-center rounded-[18px] border border-gray-200 bg-white text-gray-700 shadow-sm transition hover:border-emerald-300 hover:text-emerald-700 sm:flex md:hidden"><FriendsIcon/></Link>
            <NotificationBellButton initialUnreadCount={unreadNotificationCount}/>
          </nav>
        </div>
      </header>
      <div className="h-20" aria-hidden="true" />
      <nav aria-label="Mobil navigasyon" className="uin-mobile-nav fixed inset-x-0 bottom-0 z-[100] grid grid-cols-5 gap-1 border-t border-gray-200 bg-white/95 px-2 pb-[max(.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-8px_30px_rgba(15,23,42,.08)] backdrop-blur-xl md:hidden">
        <PrimaryNavLink href="/ideas" mobile><HomeIcon/><span>Kütüphane</span></PrimaryNavLink>
        <PrimaryNavLink href="/discover" mobile><DiscoverIcon/><span>Etkinlikler</span></PrimaryNavLink>
        <PrimaryNavLink href="/inbox" mobile><InboxIcon/><span>Kararlar</span></PrimaryNavLink>
        <PrimaryNavLink href="/messages" mobile><MessageIcon/><span>Mesajlar</span></PrimaryNavLink>
        <PrimaryNavLink href="/friends" mobile><FriendsIcon/><span>Arkadaşlar</span></PrimaryNavLink>
      </nav>
    </>
  );
}
