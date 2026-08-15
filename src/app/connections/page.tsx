import Link from "next/link";
import { redirect } from "next/navigation";

import TimelineHomeLogo from "@/components/navigation/TimelineHomeLogo";
import { createClient } from "@/utils/supabase/server";

type ConnectionView = "followers" | "following" | "friends";

type ConnectionRow = {
  connection_type: "follower" | "following" | "friend";
  user_id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  city: string | null;
  country: string | null;
  connected_at: string;
};

type ConnectionsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const VIEW_META: Record<
  ConnectionView,
  {
    label: string;
    rowType: ConnectionRow["connection_type"];
    description: string;
  }
> = {
  followers: {
    label: "Followers",
    rowType: "follower",
    description: "People who follow your UIN profile.",
  },
  following: {
    label: "Following",
    rowType: "following",
    description: "People whose UIN profiles you follow.",
  },
  friends: {
    label: "Friends",
    rowType: "friend",
    description: "Your accepted mutual UIN connections.",
  },
};

function parseView(value: string | string[] | undefined): ConnectionView {
  const normalized = Array.isArray(value) ? value[0] : value;

  if (
    normalized === "followers" ||
    normalized === "following" ||
    normalized === "friends"
  ) {
    return normalized;
  }

  return "friends";
}

function getInitial(value: string) {
  return value.trim().charAt(0).toUpperCase() || "?";
}

function PersonCard({ row }: { row: ConnectionRow }) {
  const name = row.full_name || row.username || "UIN member";
  const location = [row.city, row.country].filter(Boolean).join(", ");

  const content = (
    <>
      {row.avatar_url ? (
        <img
          src={row.avatar_url}
          alt={name}
          className="h-16 w-16 shrink-0 rounded-full object-cover"
        />
      ) : (
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-gray-100 text-lg font-black text-gray-500">
          {getInitial(name)}
        </div>
      )}

      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-black text-gray-950">{name}</p>

        {row.username && (
          <p className="mt-1 truncate text-sm text-gray-500">@{row.username}</p>
        )}

        {location && (
          <p className="mt-2 truncate text-sm text-gray-500">📍 {location}</p>
        )}
      </div>

      <span className="shrink-0 text-lg text-gray-300" aria-hidden="true">
        →
      </span>
    </>
  );

  return row.username ? (
    <Link
      href={`/u/${encodeURIComponent(row.username)}`}
      className="flex items-center gap-4 rounded-3xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-green-300 hover:bg-green-50/30"
    >
      {content}
    </Link>
  ) : (
    <article className="flex items-center gap-4 rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
      {content}
    </article>
  );
}

export default async function ConnectionsPage({
  searchParams,
}: ConnectionsPageProps) {
  const params = await searchParams;
  const selectedView = parseView(params.view);
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  const { data, error } = await supabase.rpc("get_my_profile_connections");

  if (error) {
    console.error("Profile connection-list query failed:", error);
  }

  const rows = (data ?? []) as ConnectionRow[];
  const counts: Record<ConnectionView, number> = {
    followers: rows.filter((row) => row.connection_type === "follower").length,
    following: rows.filter((row) => row.connection_type === "following").length,
    friends: rows.filter((row) => row.connection_type === "friend").length,
  };

  const selectedRows = rows.filter(
    (row) => row.connection_type === VIEW_META[selectedView].rowType
  );

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8 md:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-center gap-4">
          <TimelineHomeLogo />
        </div>

        <header className="mt-6 rounded-[32px] border border-gray-200 bg-white p-6 shadow-sm md:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-green-700">
            Connections
          </p>

          <h1 className="mt-2 text-3xl font-black text-gray-950 md:text-4xl">
            {VIEW_META[selectedView].label}
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-7 text-gray-500">
            {VIEW_META[selectedView].description}
          </p>

          <nav
            aria-label="Connection lists"
            className="mt-6 inline-flex flex-wrap gap-2 rounded-2xl border border-gray-200 bg-gray-50 p-1.5"
          >
            {(Object.keys(VIEW_META) as ConnectionView[]).map((view) => {
              const active = view === selectedView;

              return (
                <Link
                  key={view}
                  href={`/connections?view=${view}`}
                  className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition ${
                    active
                      ? "bg-gray-950 text-white shadow-sm"
                      : "text-gray-600 hover:bg-white hover:text-green-700"
                  }`}
                >
                  <span>{VIEW_META[view].label}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      active ? "bg-white/15 text-white" : "bg-white text-gray-500"
                    }`}
                  >
                    {counts[view]}
                  </span>
                </Link>
              );
            })}
          </nav>
        </header>

        {error ? (
          <div className="mt-6 rounded-3xl border border-red-200 bg-red-50 p-6 text-sm font-semibold text-red-800">
            Connection list could not be loaded.
          </div>
        ) : selectedRows.length > 0 ? (
          <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {selectedRows.map((row) => (
              <PersonCard
                key={`${row.connection_type}-${row.user_id}`}
                row={row}
              />
            ))}
          </section>
        ) : (
          <section className="mt-6 rounded-3xl border border-dashed border-gray-300 bg-white p-10 text-center">
            <p className="text-lg font-black text-gray-950">
              No {VIEW_META[selectedView].label.toLowerCase()} yet
            </p>
            <p className="mt-2 text-sm text-gray-500">
              This list will appear here when there are connections to show.
            </p>
          </section>
        )}
      </div>
    </main>
  );
}
