export type ActivityPersonRole =
  | "host"
  | "co_host"
  | "participant"
  | string;

export type ActivityPersonView = {
  userId: string;
  fullName: string | null;
  username: string | null;
  avatarUrl: string | null;
  role: ActivityPersonRole;
};

export type ActivityPeopleBatchRow = {
  resource_id: string;
  user_id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  role: ActivityPersonRole;
};

export function getActivityPersonRoleLabel(
  role: ActivityPersonRole
) {
  if (role === "host") return "Host";
  if (role === "co_host") return "Co-host";
  return "Participant";
}

export function sortActivityPeople(
  people: ActivityPersonView[]
) {
  const priority = (role: ActivityPersonRole) => {
    if (role === "host") return 0;
    if (role === "co_host") return 1;
    return 2;
  };

  return [...people].sort((left, right) => {
    const roleDifference = priority(left.role) - priority(right.role);
    if (roleDifference !== 0) return roleDifference;

    return (left.fullName ?? left.username ?? left.userId).localeCompare(
      right.fullName ?? right.username ?? right.userId
    );
  });
}

export function dedupeActivityPeople(
  people: ActivityPersonView[]
) {
  const byUserId = new Map<string, ActivityPersonView>();

  sortActivityPeople(people).forEach((person) => {
    if (!byUserId.has(person.userId)) {
      byUserId.set(person.userId, person);
    }
  });

  return Array.from(byUserId.values());
}

export function groupActivityPeopleByResourceId(
  rows: ActivityPeopleBatchRow[]
) {
  const grouped = new Map<string, ActivityPersonView[]>();

  rows.forEach((row) => {
    const people = grouped.get(row.resource_id) ?? [];

    people.push({
      userId: row.user_id,
      fullName: row.full_name,
      username: row.username,
      avatarUrl: row.avatar_url,
      role: row.role,
    });

    grouped.set(row.resource_id, people);
  });

  grouped.forEach((people, resourceId) => {
    grouped.set(resourceId, dedupeActivityPeople(people));
  });

  return grouped;
}
