import Link from "next/link";

import AccountMenuSignOutButton from "@/components/auth/AccountMenuSignOutButton";

type UserAccountMenuProps = {
  fullName: string | null;
  username: string | null;
  email: string | null;
  avatarUrl: string | null;
  isAdmin: boolean;
};

function AccountIcon() {
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
      <circle
        cx="12"
        cy="8"
        r="3"
      />

      <path d="M6.5 19a5.5 5.5 0 0 1 11 0" />

      <path d="M19 4.5 20 5l1-.5.5 1-.5 1 .5 1-1 .5-1-.5-1 .5-.5-1 .5-1-.5-1 1-.5Z" />
    </svg>
  );
}

export default function UserAccountMenu({
  fullName,
  username,
  email,
  avatarUrl,
  isAdmin,
}: UserAccountMenuProps) {
  const displayName =
    fullName ||
    username ||
    email ||
    "UIN member";

  return (
    <details className="group relative z-[100]">
      <summary
        title="Account menu"
        aria-label="Open account menu"
        className="flex h-12 cursor-pointer list-none items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 font-semibold text-gray-700 shadow-sm transition hover:border-green-400 hover:text-green-700 [&::-webkit-details-marker]:hidden"
      >
        <AccountIcon />

        <span>
          Account
        </span>

        <span className="text-[10px] text-gray-400 transition group-open:rotate-180">
          ▼
        </span>
      </summary>

      <div className="absolute right-0 top-full mt-2 w-72 overflow-hidden rounded-3xl border border-gray-200 bg-white text-left shadow-2xl">
        <div className="flex items-center gap-3 border-b border-gray-100 p-4">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={displayName}
              className="h-12 w-12 shrink-0 rounded-xl object-cover"
            />
          ) : (
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-green-50 text-lg font-bold text-green-700">
              {displayName
                .trim()
                .charAt(0)
                .toUpperCase() || "?"}
            </div>
          )}

          <div className="min-w-0">
            <p className="truncate font-bold text-gray-950">
              {displayName}
            </p>

            {username && (
              <p className="mt-1 truncate text-sm text-gray-500">
                @{username}
              </p>
            )}

            {email && (
              <p className="mt-1 truncate text-xs text-gray-400">
                {email}
              </p>
            )}
          </div>
        </div>

        <div className="p-2">
          {username && (
            <Link
              href={`/u/${encodeURIComponent(
                username
              )}`}
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
            href="/settings/family"
            className="block rounded-xl px-4 py-3 text-sm font-semibold text-amber-700 transition hover:bg-amber-50"
          >
            Age & Family
          </Link>

          <Link
            href="/friends"
            className="block rounded-xl px-4 py-3 text-sm font-semibold text-blue-700 transition hover:bg-blue-50"
          >
            Friends
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

        <AccountMenuSignOutButton />
      </div>
    </details>
  );
}
