import Link from "next/link";

import {
  dedupeActivityPeople,
  getActivityPersonRoleLabel,
  type ActivityPersonView,
} from "@/utils/activityPeople";

type ActivityPeopleStripProps = {
  people: ActivityPersonView[];
  currentUserId?: string | null;
  activityHref?: string | null;
  variant?: "compact" | "full";
  maxVisible?: number;
  className?: string;
};

function getInitial(person: ActivityPersonView) {
  return (
    person.fullName?.trim().charAt(0).toUpperCase() ||
    person.username?.trim().charAt(0).toUpperCase() ||
    "?"
  );
}

function getDisplayName(person: ActivityPersonView) {
  return person.fullName || person.username || "UIN member";
}

function getProfileHref(person: ActivityPersonView) {
  return person.username
    ? `/u/${encodeURIComponent(person.username)}`
    : null;
}

function PersonAvatar({
  person,
  sizeClasses,
}: {
  person: ActivityPersonView;
  sizeClasses: string;
}) {
  const displayName = getDisplayName(person);

  return person.avatarUrl ? (
    <img
      src={person.avatarUrl}
      alt={displayName}
      className={`${sizeClasses} shrink-0 rounded-full border-2 border-white object-cover shadow-sm`}
    />
  ) : (
    <span
      className={`${sizeClasses} grid shrink-0 place-items-center rounded-full border-2 border-white bg-gray-100 text-[10px] font-black text-gray-700 shadow-sm`}
      aria-hidden="true"
    >
      {getInitial(person)}
    </span>
  );
}

export default function ActivityPeopleStrip({
  people,
  currentUserId = null,
  activityHref = null,
  variant = "compact",
  maxVisible = 5,
  className = "",
}: ActivityPeopleStripProps) {
  const resolvedPeople = dedupeActivityPeople(people);

  if (resolvedPeople.length === 0) return null;

  const leaders = resolvedPeople
    .filter((person) => person.role === "host" || person.role === "co_host")
    .slice(0, variant === "full" ? 3 : 2);

  const leaderIds = new Set(leaders.map((person) => person.userId));
  const nonLeaders = resolvedPeople.filter(
    (person) => !leaderIds.has(person.userId)
  );

  const namedPeople =
    variant === "full"
      ? [...leaders, ...nonLeaders].slice(0, 3)
      : leaders;

  const namedIds = new Set(namedPeople.map((person) => person.userId));
  const remainingPeople = resolvedPeople.filter(
    (person) => !namedIds.has(person.userId)
  );

  const avatarSlots = Math.max(0, maxVisible - namedPeople.length);
  const avatarPeople = remainingPeople.slice(0, avatarSlots);
  const hiddenCount = Math.max(
    0,
    remainingPeople.length - avatarPeople.length
  );

  return (
    <div className={className}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-black uppercase tracking-[0.1em] text-gray-500">
          People
        </p>

        <p className="text-[10px] font-bold text-gray-500">
          {resolvedPeople.length} {resolvedPeople.length === 1 ? "person" : "people"}
        </p>
      </div>

      <div className="mt-2 flex min-w-0 flex-wrap items-center gap-2">
        {namedPeople.map((person) => {
          const displayName = getDisplayName(person);
          const roleLabel = getActivityPersonRoleLabel(person.role);
          const isCurrentUser = person.userId === currentUserId;
          const href = getProfileHref(person);

          const content = (
            <span className="flex min-w-0 items-center gap-2 rounded-full border border-gray-200 bg-white py-1 pl-1 pr-2.5 shadow-sm transition hover:border-green-300 hover:bg-green-50">
              <PersonAvatar
                person={person}
                sizeClasses={variant === "full" ? "h-8 w-8" : "h-7 w-7"}
              />

              <span className="min-w-0">
                <span className="block max-w-[130px] truncate text-[12px] font-black leading-tight text-gray-950">
                  {displayName}
                </span>
                <span className="block text-[9px] font-black uppercase tracking-[0.05em] text-gray-500">
                  {isCurrentUser ? `You · ${roleLabel}` : roleLabel}
                </span>
              </span>
            </span>
          );

          return href ? (
            <Link
              key={person.userId}
              href={href}
              title={`${displayName} · ${isCurrentUser ? `You · ${roleLabel}` : roleLabel}`}
              className="min-w-0"
            >
              {content}
            </Link>
          ) : (
            <span
              key={person.userId}
              title={`${displayName} · ${isCurrentUser ? `You · ${roleLabel}` : roleLabel}`}
              className="min-w-0"
            >
              {content}
            </span>
          );
        })}

        {avatarPeople.length > 0 && (
          <div className="flex -space-x-2 pl-1">
            {avatarPeople.map((person) => {
              const displayName = getDisplayName(person);
              const roleLabel = getActivityPersonRoleLabel(person.role);
              const isCurrentUser = person.userId === currentUserId;
              const href = getProfileHref(person);

              const avatar = (
                <PersonAvatar
                  person={person}
                  sizeClasses={variant === "full" ? "h-8 w-8" : "h-7 w-7"}
                />
              );

              return href ? (
                <Link
                  key={person.userId}
                  href={href}
                  title={`${displayName} · ${isCurrentUser ? `You · ${roleLabel}` : roleLabel}`}
                  className="relative transition hover:z-10 hover:-translate-y-0.5"
                >
                  {avatar}
                </Link>
              ) : (
                <span
                  key={person.userId}
                  title={`${displayName} · ${isCurrentUser ? `You · ${roleLabel}` : roleLabel}`}
                  className="relative"
                >
                  {avatar}
                </span>
              );
            })}
          </div>
        )}

        {hiddenCount > 0 &&
          (activityHref ? (
            <Link
              href={`${activityHref}#people`}
              className="grid h-8 min-w-8 place-items-center rounded-full border border-gray-200 bg-gray-950 px-2 text-[10px] font-black text-white transition hover:bg-gray-800"
              title={`View ${hiddenCount} more ${hiddenCount === 1 ? "person" : "people"}`}
            >
              +{hiddenCount}
            </Link>
          ) : (
            <span className="grid h-8 min-w-8 place-items-center rounded-full border border-gray-200 bg-gray-950 px-2 text-[10px] font-black text-white">
              +{hiddenCount}
            </span>
          ))}
      </div>
    </div>
  );
}
