export type InitialCommunityCountProps = {
  initialCounts?: [number, number];
  socialCount?: number;
};

function toAuthoritativeCount(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isSafeInteger(value) && value >= 0 ? value : null;
  }

  if (typeof value !== "string" || !/^\d+$/.test(value.trim())) {
    return null;
  }

  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

export function parseCommunityCounts(
  wanting: unknown,
  done: unknown,
  active: unknown
): [number, number, number] | null {
  const values = [wanting, done, active].map(toAuthoritativeCount);
  if (values.some((value) => value === null)) return null;
  return values as [number, number, number];
}

export function initialCommunityCountProps(
  wanting: unknown,
  done: unknown,
  active: unknown
): InitialCommunityCountProps {
  const counts = parseCommunityCounts(wanting, done, active);
  return counts
    ? { initialCounts: [counts[0], counts[1]], socialCount: counts[2] }
    : {};
}
