import TimelineHeader from "@/components/timeline/TimelineHeader";
import type { ManagedProfileSwitcherRow } from "./AccountContextSwitcher";
import { createClient } from "@/utils/supabase/server";
import { getViewerContext } from "@/utils/viewerContext";

export default async function AppNavigation() {
  const [{ user, adminRole }, supabase] = await Promise.all([
    getViewerContext(),
    createClient(),
  ]);
  if (!user) return null;
  const [profile, managed, notifications] = await Promise.all([
    supabase.from("profiles").select("full_name, username, avatar_url").eq("id", user.id).maybeSingle(),
    supabase.rpc("get_my_managed_profile_switcher"),
    supabase.rpc("get_my_unread_update_notification_count"),
  ]);
  return <TimelineHeader email={user.email ?? null}
    personal={{ fullName: profile.data?.full_name ?? null, username: profile.data?.username ?? null, avatarUrl: profile.data?.avatar_url ?? null }}
    managedProfiles={(managed.data ?? []) as ManagedProfileSwitcherRow[]}
    unreadNotificationCount={Number(notifications.data ?? 0)} isAdmin={adminRole === "owner" || adminRole === "admin"}
    activeMatchCount={0} inboxCount={0} />;
}
