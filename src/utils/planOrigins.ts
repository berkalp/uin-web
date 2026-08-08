export type PlanOriginRow = {
  plan_id: string;
  source_count: number | string;
  source_intent_id: string | null;
  source_activity_name: string | null;
  source_owner_user_id: string | null;
  source_owner_full_name: string | null;
  source_owner_username: string | null;
  source_owner_avatar_url: string | null;
  source_relationship: string;
  source_member_role: string | null;
  viewer_is_owner: boolean;
  source_is_visible: boolean;
};

export type PlanOriginView = {
  planId: string;
  sourceCount: number;
  intentId: string | null;
  activityName: string | null;
  ownerUserId: string | null;
  ownerFullName: string | null;
  ownerUsername: string | null;
  ownerAvatarUrl: string | null;
  relationship: string;
  memberRole: string | null;
  viewerIsOwner: boolean;
  isVisible: boolean;
};

function toNumber(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function parsePlanOriginRows(rows: unknown): PlanOriginView[] {
  if (!Array.isArray(rows)) return [];

  return (rows as PlanOriginRow[]).map((row) => ({
    planId: row.plan_id,
    sourceCount: toNumber(row.source_count),
    intentId: row.source_intent_id,
    activityName: row.source_activity_name,
    ownerUserId: row.source_owner_user_id,
    ownerFullName: row.source_owner_full_name,
    ownerUsername: row.source_owner_username,
    ownerAvatarUrl: row.source_owner_avatar_url,
    relationship: row.source_relationship,
    memberRole: row.source_member_role,
    viewerIsOwner: row.viewer_is_owner === true,
    isVisible: row.source_is_visible === true,
  }));
}

export function getPlanOriginCount(origins: PlanOriginView[]) {
  return origins.reduce(
    (highest, origin) => Math.max(highest, origin.sourceCount),
    origins.length
  );
}
