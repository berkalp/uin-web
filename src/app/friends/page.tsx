import AppNavigation from "@/components/navigation/AppNavigation";
import WebCardLayoutPicker from "@/components/cards/WebCardLayoutPicker";
import Link from "next/link";
import { redirect } from "next/navigation";
import { isAuthSessionMissingError } from "@supabase/supabase-js";

import PageDataUnavailable from "@/components/common/PageDataUnavailable";
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

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isFriendshipRow(value: unknown): value is FriendshipRow {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;

  return typeof row.friendship_id === "string" &&
    (row.friendship_status === "pending" || row.friendship_status === "accepted") &&
    (row.direction === "incoming" || row.direction === "outgoing" || row.direction === "friend") &&
    typeof row.created_at === "string" &&
    isNullableString(row.responded_at) &&
    typeof row.other_user_id === "string" &&
    isNullableString(row.other_full_name) &&
    isNullableString(row.other_username) &&
    isNullableString(row.other_avatar_url) &&
    isNullableString(row.other_city) &&
    isNullableString(row.other_country);
}

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
    "UIN üyesi";

  const location = [
    row.other_city,
    row.other_country,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <article className="uin-profile-card rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
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
          {row.other_username ? (
            <Link
              href={`/u/${encodeURIComponent(row.other_username)}`}
              className="font-bold text-gray-950 transition hover:text-green-700"
            >
              {name}
            </Link>
          ) : (
            <p className="font-bold text-gray-950">{name}</p>
          )}

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
    error: userError,
  } =
    await supabase.auth.getUser();

  if (userError && !isAuthSessionMissingError(userError)) {
    console.error("Friendship session query failed:", userError);
    return (
      <PageDataUnavailable
        title="Arkadaşların şu anda yüklenemedi"
        retryHref="/friends"
        backHref="/timeline"
        backLabel="Ana sayfaya dön"
      />
    );
  }

  if (!user) {
    redirect("/");
  }

  const {
    data,
    error,
  } = await supabase.rpc(
    "get_my_friendships"
  );

  let readFailed = Boolean(error || !Array.isArray(data));
  const incompleteRows = !readFailed && !(data as unknown[]).every(isFriendshipRow);
  readFailed = readFailed || incompleteRows;

  if (readFailed) {
    console.error(
      "Friendship query failed:",
      error ?? "Unexpected payload"
    );
  }

  const rows = readFailed ? [] : data as FriendshipRow[];

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
      <div className="relative z-[60] mx-auto mb-8 max-w-[1320px]"><AppNavigation /></div>
      <div className="mx-auto max-w-6xl">


        <header className="rounded-[32px] border border-gray-200 bg-white p-6 shadow-sm md:p-8">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
            BAĞLANTILAR
          </p>

          <h1 className="mt-3 text-3xl font-bold text-gray-950 md:text-4xl">
            Arkadaşların
          </h1>

          <p className="mt-3 max-w-3xl text-sm leading-7 text-gray-500">
            Arkadaşlık karşılıklıdır. Arkadaşlara özel görünürlükte kullanılır; takip etmek ise ayrı ve tek yönlüdür.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-2">
            <WebCardLayoutPicker className="mr-auto"/>
            {!readFailed && (
              <>
                <span className="rounded-full bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700">
                  {friends.length} arkadaş
                </span>

                <span className="rounded-full bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700">
                  {incoming.length} gelen istek
                </span>

                <span className="rounded-full bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-600">
                  {outgoing.length} gönderilen
                </span>
              </>
            )}
          </div>
        </header>

        {readFailed && (
          <div className="mt-6 rounded-3xl border border-red-200 bg-red-50 p-6 text-red-800">
            <p className="font-semibold">Arkadaşlık listesi şu anda yüklenemedi.</p>
            <Link href="/friends" className="mt-3 inline-flex rounded-xl bg-red-700 px-4 py-2 text-sm font-bold text-white">
              Yeniden dene
            </Link>
          </div>
        )}

        {!readFailed &&
          incoming.length >
            0 && (
            <section className="mt-8">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                YANIT BEKLEYENLER
              </p>

              <h2 className="mt-2 text-2xl font-bold text-gray-950">
                Gelen arkadaşlık istekleri
              </h2>

              <div className="uin-profile-grid mt-5 grid gap-4">
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

        {!readFailed &&
          friends.length >
            0 && (
            <section className="mt-10">
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
                ARKADAŞLAR
              </p>

              <h2 className="mt-2 text-2xl font-bold text-gray-950">
                Arkadaşların
              </h2>

              <div className="uin-profile-grid mt-5 grid gap-4">
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

        {!readFailed &&
          outgoing.length >
            0 && (
            <section className="mt-10">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                GÖNDERİLENLER
              </p>

              <h2 className="mt-2 text-2xl font-bold text-gray-950">
                Gönderilen istekler
              </h2>

              <div className="uin-profile-grid mt-5 grid gap-4">
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

        {!readFailed &&
          rows.length ===
            0 && (
            <section className="mt-8 rounded-3xl border border-gray-200 bg-white p-10 text-center shadow-sm">
              <h2 className="text-xl font-bold text-gray-950">
                Henüz arkadaşın yok
              </h2>

              <p className="mt-3 text-sm leading-7 text-gray-500">
                Başka bir kişinin profilini açarak arkadaşlık isteği gönderebilirsin.
              </p>
            </section>
          )}
      </div>
    </main>
  );
}
