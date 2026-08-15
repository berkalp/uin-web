import Link from "next/link";

import {
  getNormalizedFamilyMembers,
  toNumberOrNull,
  type ProfileConnectionSummary,
  type RawFamilyData,
} from "@/utils/profileConnections";

type ConnectionMetricKey = "followers" | "following" | "friends";

type Props = {
  connections: ProfileConnectionSummary | null;
  family: RawFamilyData;
  metricLinks?: Partial<Record<ConnectionMetricKey, string>>;
};

function getInitial(value: string) {
  return value.trim().charAt(0).toUpperCase() || "?";
}

export default function ProfileConnectionsFamilyPanel({
  connections,
  family,
  metricLinks,
}: Props) {
  const followers = toNumberOrNull(connections?.followers_count);
  const following = toNumberOrNull(connections?.following_count);
  const friends = toNumberOrNull(connections?.friends_count);
  const mutualCount = toNumberOrNull(connections?.mutual_friends_count) ?? 0;
  const mutualFriends = connections?.mutual_friends ?? [];
  const familyMembers = getNormalizedFamilyMembers(family);

  const metrics: Array<{
    key: ConnectionMetricKey;
    label: string;
    value: number | null;
  }> = [
    { key: "followers", label: "Followers", value: followers },
    { key: "following", label: "Following", value: following },
    { key: "friends", label: "Friends", value: friends },
  ].filter((metric) => metric.value !== null);

  if (
    metrics.length === 0 &&
    mutualCount === 0 &&
    familyMembers.length === 0
  ) {
    return null;
  }

  return (
    <section className="min-w-0 space-y-6">
      {familyMembers.length > 0 && (
        <div>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-purple-700">
                Family
              </p>

              <p className="mt-1 text-sm leading-6 text-gray-500">
                Family members this person chose to show.
              </p>
            </div>

            <span className="rounded-full bg-purple-50 px-3 py-1.5 text-xs font-semibold text-purple-700">
              {familyMembers.length} visible
            </span>
          </div>

          <div className="mt-4 space-y-3">
            {familyMembers.map((member) => {
              const content = (
                <>
                  {member.avatarUrl ? (
                    <img
                      src={member.avatarUrl}
                      alt={member.fullName}
                      className="h-14 w-14 shrink-0 rounded-2xl object-cover"
                    />
                  ) : (
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-purple-100 text-lg font-bold text-purple-700">
                      {getInitial(member.fullName)}
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold text-gray-950">
                      {member.fullName}
                    </p>

                    <p className="mt-1 text-xs font-semibold text-purple-700">
                      {member.relationship}
                    </p>

                    {member.username && (
                      <p className="mt-1 truncate text-xs text-gray-400">
                        @{member.username}
                      </p>
                    )}
                  </div>
                </>
              );

              return member.username ? (
                <Link
                  key={member.key}
                  href={`/u/${encodeURIComponent(member.username)}`}
                  className="flex items-center gap-3 rounded-2xl border border-purple-100 bg-white p-3 transition hover:border-purple-300 hover:bg-purple-50/40"
                >
                  {content}
                </Link>
              ) : (
                <article
                  key={member.key}
                  className="flex items-center gap-3 rounded-2xl border border-purple-100 bg-white p-3"
                >
                  {content}
                </article>
              );
            })}
          </div>
        </div>
      )}

      {(metrics.length > 0 || mutualCount > 0) && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-green-700">
            Connections
          </p>

          {metrics.length > 0 && (
            <div className="mt-3 grid grid-cols-3 gap-3">
              {metrics.map((metric) => {
                const metricClassName =
                  "block min-w-0 rounded-2xl bg-gray-50 px-3 py-3 text-left transition";
                const content = (
                  <>
                    <p className="text-xl font-black text-gray-950">
                      {metric.value?.toLocaleString("en-US")}
                    </p>

                    <p className="mt-1 truncate text-xs font-semibold text-gray-500">
                      {metric.label}
                    </p>
                  </>
                );
                const href = metricLinks?.[metric.key];

                return href ? (
                  <Link
                    key={metric.key}
                    href={href}
                    className={`${metricClassName} hover:bg-green-50 hover:ring-1 hover:ring-green-200`}
                  >
                    {content}
                  </Link>
                ) : (
                  <div key={metric.key} className={metricClassName}>
                    {content}
                  </div>
                );
              })}
            </div>
          )}

          {mutualCount > 0 && (
            <div className="mt-3 rounded-2xl border border-blue-100 bg-blue-50/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
                Mutual friends
              </p>

              <div className="mt-3 flex items-center gap-3">
                <div className="flex -space-x-2">
                  {mutualFriends.map((friend) => {
                    const name = friend.full_name || friend.username;

                    return friend.avatar_url ? (
                      <Link
                        key={friend.user_id}
                        href={`/u/${encodeURIComponent(friend.username)}`}
                        title={name}
                      >
                        <img
                          src={friend.avatar_url}
                          alt={name}
                          className="h-9 w-9 rounded-full border-2 border-white object-cover"
                        />
                      </Link>
                    ) : (
                      <Link
                        key={friend.user_id}
                        href={`/u/${encodeURIComponent(friend.username)}`}
                        title={name}
                        className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-blue-100 text-xs font-bold text-blue-700"
                      >
                        {getInitial(name)}
                      </Link>
                    );
                  })}

                  {mutualCount > mutualFriends.length && (
                    <div className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-gray-950 text-[11px] font-bold text-white">
                      +{mutualCount - mutualFriends.length}
                    </div>
                  )}
                </div>

                <p className="text-sm font-semibold text-blue-950">
                  {mutualCount} mutual {mutualCount === 1 ? "friend" : "friends"}
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
