import Link from "next/link";

import AccountMenuSignOutButton from "@/components/auth/AccountMenuSignOutButton";
import LocaleSwitcher from "@/components/i18n/LocaleSwitcher";
import type {
  ManagedProfileSwitcherRow,
} from "@/components/navigation/AccountContextSwitcher";
import { createClient } from "@/utils/supabase/server";

type AccountContext =
  | {
      type: "personal";
    }
  | {
      type: "managed_profile";
      childUserId: string;
    };

type UserAccountMenuProps = {
  fullName: string | null;
  username: string | null;
  email: string | null;
  avatarUrl: string | null;
  managedProfiles: ManagedProfileSwitcherRow[];
  currentContext: AccountContext;
  isAdmin: boolean;
};

function getInitial(value: string) {
  return value.trim().charAt(0).toUpperCase() || "?";
}

function ContextAvatar({
  imageUrl,
  name,
  tone,
  size = "button",
}: {
  imageUrl: string | null;
  name: string;
  tone: "green" | "blue";
  size?: "button" | "row";
}) {
  const sizeClass =
    size === "row"
      ? "h-11 w-11 rounded-xl"
      : "h-8 w-8 rounded-lg";

  const toneClass =
    tone === "blue"
      ? "bg-blue-50 text-blue-700"
      : "bg-green-50 text-green-700";

  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={name}
        className={`${sizeClass} shrink-0 object-cover`}
      />
    );
  }

  return (
    <div
      className={`flex ${sizeClass} shrink-0 items-center justify-center font-bold ${toneClass}`}
    >
      {getInitial(name)}
    </div>
  );
}

export default async function UserAccountMenu({
  fullName,
  username,
  email,
  avatarUrl,
  managedProfiles,
  currentContext,
  isAdmin,
}: UserAccountMenuProps) {
  const personalDisplayName =
    fullName || username || email || "UIN member";

  const currentManagedProfile =
    currentContext.type === "managed_profile"
      ? managedProfiles.find(
          (profile) =>
            profile.child_user_id === currentContext.childUserId
        ) ?? null
      : null;

  const activeDisplayName = currentManagedProfile
    ? currentManagedProfile.child_full_name ||
      currentManagedProfile.child_username
    : personalDisplayName;

  const activeAvatarUrl = currentManagedProfile
    ? currentManagedProfile.child_avatar_url
    : avatarUrl;

  const activeContextLabel =
    currentContext.type === "managed_profile"
      ? "Managed profile"
      : "Personal";

  const supabase = await createClient();

  const {
    data: archivedResourceKeys,
    error: archiveCountError,
  } = await supabase.rpc(
    "get_my_archived_resource_keys"
  );

  if (archiveCountError) {
    console.error(
      "Account menu archive count query failed:",
      archiveCountError
    );
  }

  const archiveCount = Array.isArray(
    archivedResourceKeys
  )
    ? archivedResourceKeys.length
    : 0;

  return (
    <details className="group relative z-[100]">
      <summary
        title={`Active context: ${activeDisplayName}`}
        aria-label={`Open account menu. Active context: ${activeDisplayName}`}
        className="flex h-12 max-w-[230px] cursor-pointer list-none items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 font-semibold text-gray-700 shadow-sm transition hover:border-green-400 hover:text-green-700 [&::-webkit-details-marker]:hidden"
      >
        <ContextAvatar
          imageUrl={activeAvatarUrl}
          name={activeDisplayName}
          tone={
            currentContext.type === "managed_profile"
              ? "blue"
              : "green"
          }
        />

        <span className="min-w-0 text-left">
          <span className="block truncate text-sm font-bold text-gray-950">
            {activeDisplayName}
          </span>

          <span
            className={`block truncate text-[10px] font-semibold uppercase tracking-wide ${
              currentContext.type === "managed_profile"
                ? "text-blue-600"
                : "text-green-700"
            }`}
          >
            {activeContextLabel}
          </span>
        </span>

        <span className="ml-auto text-[10px] text-gray-400 transition group-open:rotate-180">
          ▼
        </span>
      </summary>

      <div className="absolute right-0 top-full mt-2 w-[340px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-3xl border border-gray-200 bg-white text-left shadow-2xl">
        <div className="p-3">
          <p className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
            Current context
          </p>

          <Link
            href="/timeline"
            className={`flex items-center gap-3 rounded-2xl p-3 transition ${
              currentContext.type === "personal"
                ? "bg-green-50"
                : "hover:bg-gray-50"
            }`}
          >
            <ContextAvatar
              imageUrl={avatarUrl}
              name={personalDisplayName}
              tone="green"
              size="row"
            />

            <div className="min-w-0 flex-1">
              <p className="truncate font-bold text-gray-950">
                {personalDisplayName}
              </p>

              <p className="mt-1 text-xs font-semibold text-green-700">
                Personal Timeline
              </p>
            </div>

            {currentContext.type === "personal" && (
              <span className="rounded-full bg-green-600 px-2.5 py-1 text-[11px] font-bold text-white">
                Active
              </span>
            )}
          </Link>

          {managedProfiles.length > 0 && (
            <div className="mt-2 border-t border-gray-100 pt-2">
              <p className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-blue-500">
                Managed profiles
              </p>

              <div className="space-y-1">
                {managedProfiles.map((profile) => {
                  const name =
                    profile.child_full_name ||
                    profile.child_username;

                  const pendingCount = Number(
                    profile.pending_invitation_count || 0
                  );

                  const isActive =
                    currentContext.type === "managed_profile" &&
                    currentContext.childUserId ===
                      profile.child_user_id;

                  return (
                    <Link
                      key={profile.child_user_id}
                      href={`/managed/${encodeURIComponent(
                        profile.child_user_id
                      )}`}
                      className={`flex items-center gap-3 rounded-2xl p-3 transition ${
                        isActive
                          ? "bg-blue-50"
                          : "hover:bg-gray-50"
                      }`}
                    >
                      <ContextAvatar
                        imageUrl={profile.child_avatar_url}
                        name={name}
                        tone="blue"
                        size="row"
                      />

                      <div className="min-w-0 flex-1">
                        <p className="truncate font-bold text-gray-950">
                          {name}
                        </p>

                        <p className="mt-1 text-xs font-semibold text-blue-700">
                          Managed Child Profile
                        </p>
                      </div>

                      {pendingCount > 0 && (
                        <span className="rounded-full bg-amber-500 px-2 py-1 text-[11px] font-bold text-white">
                          {pendingCount > 99
                            ? "99+"
                            : pendingCount}
                        </span>
                      )}

                      {isActive && (
                        <span className="rounded-full bg-blue-600 px-2.5 py-1 text-[11px] font-bold text-white">
                          Active
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-gray-100 p-2">
          {username && (
            <Link
              href={`/u/${encodeURIComponent(username)}`}
              className="block rounded-xl px-4 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 hover:text-green-700"
            >
              Public Profile
            </Link>
          )}


          <Link
            href="/settings/profile"
            className="block rounded-xl px-4 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 hover:text-green-700"
          >
            Profile Settings
          </Link>

          <Link
            href="/settings/professional"
            className="block rounded-xl px-4 py-3 text-sm font-semibold text-blue-700 transition hover:bg-blue-50"
          >
            Professional Profile
          </Link>

          <Link
            href="/archive"
            className="flex items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-amber-800 transition hover:bg-amber-50"
          >
            <span>Personal Archive</span>

            {archiveCount > 0 && (
              <span className="flex min-h-6 min-w-6 items-center justify-center rounded-full bg-amber-700 px-1.5 text-[11px] font-bold text-white">
                {archiveCount > 99
                  ? "99+"
                  : archiveCount}
              </span>
            )}
          </Link>

          {isAdmin && (
            <Link
              href="/admin"
              className="block rounded-xl px-4 py-3 text-sm font-semibold text-gray-950 transition hover:bg-gray-100"
            >
              Admin Dashboard
            </Link>
          )}
        </div>

        <LocaleSwitcher compact />

        <AccountMenuSignOutButton />
      </div>
    </details>
  );
}
