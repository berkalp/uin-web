import Link from "next/link";
import { redirect } from "next/navigation";

import FriendRequestActions from "@/components/profile/FriendRequestActions";
import { createClient } from "@/utils/supabase/server";

type FriendshipRow = {
  friendship_id: string;
  friendship_status:
    | "pending"
    | "accepted";
  direction:
    | "incoming"
    | "outgoing"
    | "friend";
  created_at: string;
  responded_at: string | null;

  other_user_id: string;
  other_full_name: string | null;
  other_username: string | null;
  other_avatar_url: string | null;
  other_city: string | null;
  other_country: string | null;
};

function getInitial(
  value: string
) {
  return (
    value
      .trim()
      .charAt(0)
      .toUpperCase() || "?"
  );
}

function PersonCard({
  row,
  showActions,
}: {
  row: FriendshipRow;
  showActions: boolean;
}) {
  const name =
    row.other_full_name ||
    row.other_username ||
    "UIN member";

  const location = [
    row.other_city,
    row.other_country,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <article className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start gap-4">
        {row.other_avatar_url ? (
          <img
            src={
              row.other_avatar_url
            }
            alt={name}
            className="h-14 w-14 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 font-bold text-gray-500">
            {getInitial(name)}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <Link
            href={`/u/${encodeURIComponent(
              row.other_username ??
                ""
            )}`}
            className="font-bold text-gray-950 transition hover:text-green-700"
          >
            {name}
          </Link>

          {row.other_username && (
            <p className="mt-1 text-sm text-gray-500">
              @
              {
                row.other_username
              }
            </p>
          )}

          {location && (
            <p className="mt-2 text-sm text-gray-500">
              📍 {location}
            </p>
          )}

          {showActions && (
            <FriendRequestActions
              friendshipId={
                row.friendship_id
              }
            />
          )}
        </div>
      </div>
    </article>
  );
}

export default async function FriendsPage() {
  const supabase =
    await createClient();

  const {
    data: { user },
  } =
    await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  const {
    data,
    error,
  } = await supabase.rpc(
    "get_my_friendships"
  );

  if (error) {
    console.error(
      "Friendship query failed:",
      error
    );
  }

  const rows =
    (
      data ??
      []
    ) as FriendshipRow[];

  const incoming =
    rows.filter(
      (row) =>
        row.direction ===
        "incoming"
    );

  const outgoing =
    rows.filter(
      (row) =>
        row.direction ===
        "outgoing"
    );

  const friends =
    rows.filter(
      (row) =>
        row.direction ===
        "friend"
    );

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8 md:px-6">
      <div className="mx-auto max-w-6xl">
        <Link
          href="/timeline"
          className="text-sm font-semibold text-gray-600 transition hover:text-green-700"
        >
          ← Back to Timeline
        </Link>

        <header className="mt-8 rounded-[32px] border border-gray-200 bg-white p-6 shadow-sm md:p-8">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
            Mutual Connections
          </p>

          <h1 className="mt-3 text-3xl font-bold text-gray-950 md:text-4xl">
            Friends
          </h1>

          <p className="mt-3 max-w-3xl text-sm leading-7 text-gray-500">
            Friendship is mutual and is
            used only for Friends-only and
            Anyone-except-friends Activity
            visibility. Following remains a
            separate one-way subscription.
          </p>

          <div className="mt-6 flex flex-wrap gap-2">
            <span className="rounded-full bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700">
              {friends.length} friends
            </span>

            <span className="rounded-full bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700">
              {incoming.length} incoming
            </span>

            <span className="rounded-full bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-600">
              {outgoing.length} sent
            </span>
          </div>
        </header>

        {error && (
          <div className="mt-6 rounded-3xl border border-red-200 bg-red-50 p-6 text-red-800">
            {error.message}
          </div>
        )}

        {!error &&
          incoming.length >
            0 && (
            <section className="mt-8">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                Action Required
              </p>

              <h2 className="mt-2 text-2xl font-bold text-gray-950">
                Incoming Requests
              </h2>

              <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
                {incoming.map(
                  (row) => (
                    <PersonCard
                      key={
                        row.friendship_id
                      }
                      row={row}
                      showActions
                    />
                  )
                )}
              </div>
            </section>
          )}

        {!error &&
          friends.length >
            0 && (
            <section className="mt-10">
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
                Friends
              </p>

              <h2 className="mt-2 text-2xl font-bold text-gray-950">
                Accepted Friends
              </h2>

              <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
                {friends.map(
                  (row) => (
                    <PersonCard
                      key={
                        row.friendship_id
                      }
                      row={row}
                      showActions={
                        false
                      }
                    />
                  )
                )}
              </div>
            </section>
          )}

        {!error &&
          outgoing.length >
            0 && (
            <section className="mt-10">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                Sent
              </p>

              <h2 className="mt-2 text-2xl font-bold text-gray-950">
                Pending Friend Requests
              </h2>

              <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
                {outgoing.map(
                  (row) => (
                    <PersonCard
                      key={
                        row.friendship_id
                      }
                      row={row}
                      showActions={
                        false
                      }
                    />
                  )
                )}
              </div>
            </section>
          )}

        {!error &&
          rows.length ===
            0 && (
            <section className="mt-8 rounded-3xl border border-gray-200 bg-white p-10 text-center shadow-sm">
              <h2 className="text-xl font-bold text-gray-950">
                No friendships yet
              </h2>

              <p className="mt-3 text-sm leading-7 text-gray-500">
                Open another person&apos;s
                profile to send a friend
                request.
              </p>
            </section>
          )}
      </div>
    </main>
  );
}
