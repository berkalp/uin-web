import Link from "next/link";

import LocaleSwitcher from "@/components/i18n/LocaleSwitcher";

type MyProfileMenuProps = {
  username: string | null;
};

export default function MyProfileMenu({
  username,
}: MyProfileMenuProps) {
  return (
    <details className="group relative">
      <summary className="cursor-pointer list-none rounded-xl border border-gray-200 bg-white px-5 py-3 font-semibold text-gray-700 transition hover:border-green-400 [&::-webkit-details-marker]:hidden">
        My Profile
        <span className="ml-2 inline-block text-xs text-gray-400 transition group-open:rotate-180">
          ▼
        </span>
      </summary>

      <div className="absolute right-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-2xl border border-gray-200 bg-white p-2 shadow-2xl">
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
          href="/seeds"
          className="block rounded-xl px-4 py-3 text-sm font-semibold text-green-800 transition hover:bg-green-50"
        >
          My Seeds
        </Link>

        <Link
          href="/seeds/explore"
          className="block rounded-xl px-4 py-3 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50"
        >
          Seed Library
        </Link>

        <Link
          href="/settings/profile"
          className="block rounded-xl px-4 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 hover:text-green-700"
        >
          Profile Settings
        </Link>

        <Link
          href="/settings/profile#age-family"
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

        <Link
          href="/join-requests"
          className="block rounded-xl px-4 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
        >
          Join Requests
        </Link>

        <LocaleSwitcher compact />
      </div>
    </details>
  );
}
