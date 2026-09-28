import PrimaryNavLink from "@/components/navigation/PrimaryNavLink";
import Link from "next/link";

import type { ManagedProfileSwitcherRow } from "@/components/navigation/AccountContextSwitcher";
import UserAccountMenu from "@/components/navigation/UserAccountMenu";
import NotificationBellButton from "@/components/notifications/NotificationBellButton";

type TimelineHeaderProps = {
  email: string | null;
  personal: { fullName: string | null; username: string | null; avatarUrl: string | null };
  managedProfiles: ManagedProfileSwitcherRow[];
  activeMatchCount: number;
  inboxCount: number;
  directMessageCount?: number;
  unreadNotificationCount: number;
  isAdmin: boolean;
  [key: string]: unknown;
};

function SeedIcon() { return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21V10"/><path d="M12 13c-4 0-7-2.5-7-6 4 0 7 2.5 7 6Z"/><path d="M12 10c0-4 2.5-7 7-7 0 4-2.5 7-7 7Z"/></svg>; }
function DiscoverIcon() { return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2.1 4.9-4.9 2.1 2.1-4.9 4.9-2.1Z"/></svg>; }
function HomeIcon() { return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/></svg>; }
function FriendsIcon() { return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0"/><path d="M14 18.5a4 4 0 0 1 7 0"/></svg>; }

export default function TimelineHeader({ email, personal, managedProfiles, unreadNotificationCount, isAdmin }: TimelineHeaderProps) {
  return <>
    <header className="fixed inset-x-0 top-0 z-[90] border-b border-gray-200/80 bg-white/95 shadow-sm backdrop-blur-xl">
      <div className="mx-auto w-full max-w-[1320px] px-3 py-3 sm:px-5">
        <nav aria-label="Ana navigasyon" className="flex min-h-14 items-center gap-2 overflow-visible">
          <Link href="/ideas" aria-label="Ana Sayfa" className="mr-auto flex h-14 items-center rounded-2xl px-1.5 transition hover:bg-gray-50"><img src="/uin-logo.png" alt="uin? logo" className="h-12 w-auto"/></Link>
          <div className="hidden items-center gap-2 md:flex">
            <PrimaryNavLink href="/ideas"><HomeIcon/><span>Ana Sayfa</span></PrimaryNavLink>
            <PrimaryNavLink href="/timeline"><SeedIcon/><span>Niyetlerim</span></PrimaryNavLink>
            <PrimaryNavLink href="/discover"><DiscoverIcon/><span>Etkinlikler</span></PrimaryNavLink>
            <PrimaryNavLink href="/friends"><FriendsIcon/><span>Arkadaşlar</span></PrimaryNavLink>
          </div>
          <details className="group relative z-[110]">
            <summary title="Yeni kayıt oluştur" aria-label="Yeni kayıt oluştur" className="grid h-14 w-14 cursor-pointer list-none place-items-center rounded-[18px] bg-emerald-600 text-3xl font-light text-white shadow-sm transition hover:bg-emerald-700 [&::-webkit-details-marker]:hidden">+</summary>
            <div className="absolute right-0 top-full mt-2 w-[360px] max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-[26px] border border-gray-200 bg-white p-3 text-left shadow-[0_24px_70px_rgba(15,23,42,.20)] md:left-0 md:right-auto">
              <div className="px-3 pb-3 pt-1"><p className="text-lg font-black text-gray-950">Ne eklemek istiyorsun?</p><p className="mt-1 text-xs leading-5 text-gray-500">İstediğini, yaşadığını veya birlikte planlamak istediğini seç.</p></div>
              <Link href="/seeds/new?mode=personal" className="flex items-start gap-3 rounded-2xl p-3 transition hover:bg-emerald-50"><span className="text-2xl">🌱</span><span><b className="block text-sm text-gray-950">Kişisel niyet</b><small className="mt-1 block text-gray-500">Kendin için yapmak istediğin bir şey.</small></span></Link>
              <Link href="/onboarding" className="mt-1 flex items-start gap-3 rounded-2xl p-3 transition hover:bg-violet-50"><span className="text-2xl">👥</span><span><b className="block text-sm text-gray-950">Birlikte etkinlik</b><small className="mt-1 block text-gray-500">Başkalarıyla planlamak istediğin bir şey.</small></span></Link>
              <Link href="/seeds/explore?mode=experience" className="mt-1 flex items-start gap-3 rounded-2xl p-3 transition hover:bg-blue-50"><span className="text-2xl">✓</span><span><b className="block text-sm text-gray-950">Deneyim</b><small className="mt-1 block text-gray-500">Yaptığın, okuduğun, izlediğin veya gittiğin bir şey.</small></span></Link>
              <Link href="/seeds/explore?mode=favorite" className="mt-1 flex items-start gap-3 rounded-2xl p-3 transition hover:bg-rose-50"><span className="text-2xl">♡</span><span><b className="block text-sm text-gray-950">Sevdiğim</b><small className="mt-1 block text-gray-500">Sevdiğin kişi, eser, yer, kulüp veya aktivite.</small></span></Link>
            </div>
          </details>
          <UserAccountMenu fullName={personal.fullName} username={personal.username} email={email} avatarUrl={personal.avatarUrl} managedProfiles={managedProfiles} currentContext={{ type: "personal" }} isAdmin={isAdmin}/>
          <Link href="/friends" title="Arkadaşlar" aria-label="Arkadaşlar" className="hidden h-14 w-14 shrink-0 items-center justify-center rounded-[18px] border border-gray-200 bg-white text-gray-700 shadow-sm transition hover:border-emerald-300 hover:text-emerald-700 sm:flex md:hidden"><FriendsIcon/></Link>
          <NotificationBellButton initialUnreadCount={unreadNotificationCount}/>
        </nav>
      </div>
    </header>
    <div className="h-20" aria-hidden="true" />
    <nav aria-label="Mobil navigasyon" className="uin-mobile-nav fixed inset-x-0 bottom-0 z-[100] grid grid-cols-4 gap-1 border-t border-gray-200 bg-white/95 px-3 pb-[max(.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-8px_30px_rgba(15,23,42,.08)] backdrop-blur-xl md:hidden">
      <PrimaryNavLink href="/ideas" mobile><HomeIcon/><span>Ana Sayfa</span></PrimaryNavLink>
      <PrimaryNavLink href="/timeline" mobile><SeedIcon/><span>Niyetlerim</span></PrimaryNavLink>
      <PrimaryNavLink href="/discover" mobile><DiscoverIcon/><span>Etkinlikler</span></PrimaryNavLink>
      <PrimaryNavLink href="/friends" mobile><FriendsIcon/><span>Arkadaşlar</span></PrimaryNavLink>
    </nav>
  </>;
}