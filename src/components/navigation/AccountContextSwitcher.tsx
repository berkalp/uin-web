import Link from "next/link";

export type ManagedProfileSwitcherRow = {
  child_user_id: string;
  child_full_name: string | null;
  child_username: string;
  child_avatar_url: string | null;
  guardian_role: "primary_guardian" | "guardian";
  pending_invitation_count: number | string;
};

type AccountContextSwitcherProps = {
  personal: {
    fullName: string | null;
    username: string | null;
    avatarUrl: string | null;
  };

  managedProfiles: ManagedProfileSwitcherRow[];

  currentContext:
    | {
        type: "personal";
      }
    | {
        type: "managed_profile";
        childUserId: string;
      };
};

function getInitial(value: string) {
  return value.trim().charAt(0).toUpperCase() || "?";
}

export default function AccountContextSwitcher({
  personal,
  managedProfiles,
  currentContext,
}: AccountContextSwitcherProps) {
  const currentManagedProfile =
    currentContext.type === "managed_profile"
      ? managedProfiles.find(
          (profile) =>
            profile.child_user_id === currentContext.childUserId
        ) ?? null
      : null;

  const currentName = currentManagedProfile
    ? currentManagedProfile.child_full_name ||
      currentManagedProfile.child_username
    : personal.fullName || personal.username || "Personal";

  const currentAvatarUrl = currentManagedProfile
    ? currentManagedProfile.child_avatar_url
    : personal.avatarUrl;

  const currentBadge =
    currentContext.type === "managed_profile"
      ? "Managed Profile"
      : "Personal";

  return (
    <details className="group relative z-[80] w-full">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-2xl border border-green-200 bg-white px-4 py-3 shadow-sm transition hover:border-green-400 [&::-webkit-details-marker]:hidden">
        <div className="flex min-w-0 items-center gap-3">
          {currentAvatarUrl ? (
            <img
              src={currentAvatarUrl}
              alt={currentName}
              className="h-10 w-10 shrink-0 rounded-xl object-cover"
            />
          ) : (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-green-50 font-bold text-green-700">
              {getInitial(currentName)}
            </div>
          )}

          <div className="min-w-0 text-left">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
              Current Context
            </p>

            <p className="truncate text-sm font-bold text-gray-950">
              {currentName}
            </p>

            <p className="mt-0.5 text-xs font-semibold text-green-700">
              {currentBadge}
            </p>
          </div>
        </div>

        <span className="text-xs text-gray-400 transition group-open:rotate-180">
          ▼
        </span>
      </summary>

      <div className="absolute left-0 top-full z-[100] mt-2 w-full min-w-[340px] overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-2xl">
        <div className="p-3">
          <p className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
            Personal
          </p>

          <Link
            href="/timeline"
            className={`flex items-center gap-3 rounded-2xl p-3 transition ${
              currentContext.type === "personal"
                ? "bg-green-50"
                : "hover:bg-gray-50"
            }`}
          >
            {personal.avatarUrl ? (
              <img
                src={personal.avatarUrl}
                alt={
                  personal.fullName ||
                  personal.username ||
                  "Personal"
                }
                className="h-12 w-12 rounded-xl object-cover"
              />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-50 font-bold text-green-700">
                {getInitial(
                  personal.fullName ||
                    personal.username ||
                    "Personal"
                )}
              </div>
            )}

            <div className="min-w-0 flex-1">
              <p className="truncate font-bold text-gray-950">
                {personal.fullName ||
                  personal.username ||
                  "Personal"}
              </p>

              <p className="mt-1 text-xs text-green-700">
                Intent Timeline
              </p>
            </div>

            {currentContext.type === "personal" && (
              <span className="rounded-full bg-green-600 px-3 py-1 text-xs font-semibold text-white">
                Active
              </span>
            )}
          </Link>
        </div>

        {managedProfiles.length > 0 && (
          <div className="border-t border-gray-100 p-3">
            <p className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-blue-500">
              Managed Profiles
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
                    {profile.child_avatar_url ? (
                      <img
                        src={profile.child_avatar_url}
                        alt={name}
                        className="h-12 w-12 rounded-xl object-cover"
                      />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 font-bold text-blue-700">
                        {getInitial(name)}
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <p className="truncate font-bold text-gray-950">
                        {name}
                      </p>

                      <p className="mt-1 text-xs text-blue-700">
                        Managed Child Profile
                      </p>
                    </div>

                    {pendingCount > 0 && (
                      <span className="rounded-full bg-amber-500 px-2.5 py-1 text-xs font-bold text-white">
                        {pendingCount}
                      </span>
                    )}

                    <span className="text-gray-300">→</span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </details>
  );
  }