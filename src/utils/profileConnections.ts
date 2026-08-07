export type ProfileSectionVisibility =
  | "public"
  | "friends"
  | "private";

export type ProfileConnectionSummary = {
  followers_count:
    | number
    | string
    | null;

  following_count:
    | number
    | string
    | null;

  friends_count:
    | number
    | string
    | null;

  mutual_friends_count:
    | number
    | string;

  mutual_friends: Array<{
    user_id: string;
    full_name: string | null;
    username: string;
    avatar_url: string | null;
  }>;
};

export type RawFamilyData = {
  children: Record<
    string,
    unknown
  >[];

  relationships: Record<
    string,
    unknown
  >[];
};

export type FamilyVisibilityRow = {
  family_key: string;
  visibility:
    ProfileSectionVisibility;
};

export type ProfileConnectionsFamilySettings = {
  connection_visibility: {
    followers_count_visibility:
      ProfileSectionVisibility;

    following_count_visibility:
      ProfileSectionVisibility;

    friends_count_visibility:
      ProfileSectionVisibility;

    mutual_friends_visibility:
      ProfileSectionVisibility;
  };

  family: RawFamilyData;

  family_visibility:
    FamilyVisibilityRow[];
};

export type NormalizedFamilyMember = {
  key: string;

  kind:
    | "child"
    | "relationship";

  userId: string | null;
  fullName: string;
  username: string | null;
  avatarUrl: string | null;
  relationship: string;

  raw: Record<
    string,
    unknown
  >;
};

function firstText(
  item: Record<
    string,
    unknown
  >,
  keys: string[]
) {
  for (const key of keys) {
    const value =
      item[key];

    if (
      typeof value ===
        "string" &&
      value.trim()
    ) {
      return value.trim();
    }
  }

  return null;
}

function fallbackHash(
  value: string
) {
  let hash = 0;

  for (
    let index = 0;
    index < value.length;
    index += 1
  ) {
    hash =
      (
        hash * 31 +
        value.charCodeAt(
          index
        )
      ) |
      0;
  }

  return Math.abs(
    hash
  ).toString(36);
}

export function getFamilyItemKey(
  kind:
    | "child"
    | "relationship",
  item: Record<
    string,
    unknown
  >
) {
  const identity =
    kind === "child"
      ? firstText(
          item,
          [
            "child_user_id",
          ]
        )
      : firstText(
          item,
          [
            "relationship_id",
          ]
        );

  return `${kind}:${
    identity ??
    fallbackHash(
      JSON.stringify(
        item
      )
    )
  }`.toLocaleLowerCase(
    "en-US"
  );
}

function humanize(
  value: string
) {
  return value
    .replaceAll(
      "_",
      " "
    )
    .replace(
      /\b\w/g,
      (
        character
      ) =>
        character.toUpperCase()
    );
}

export function normalizeFamilyMember(
  kind:
    | "child"
    | "relationship",
  item: Record<
    string,
    unknown
  >
): NormalizedFamilyMember {
  const username =
    kind === "child"
      ? firstText(
          item,
          [
            "username",
          ]
        )
      : firstText(
          item,
          [
            "other_username",
          ]
        );

  const fullName =
    (
      kind === "child"
        ? firstText(
            item,
            [
              "full_name",
            ]
          )
        : firstText(
            item,
            [
              "other_full_name",
            ]
          )
    ) ??
    username ??
    "Family member";

  const relationshipValue =
    kind === "child"
      ? "child"
      : firstText(
          item,
          [
            "relationship_type",
          ]
        ) ??
        "family";

  return {
    key:
      getFamilyItemKey(
        kind,
        item
      ),

    kind,

    userId:
      kind === "child"
        ? firstText(
            item,
            [
              "child_user_id",
            ]
          )
        : firstText(
            item,
            [
              "other_user_id",
            ]
          ),

    fullName,
    username,

    avatarUrl:
      kind === "child"
        ? firstText(
            item,
            [
              "avatar_url",
            ]
          )
        : firstText(
            item,
            [
              "other_avatar_url",
            ]
          ),

    relationship:
      humanize(
        relationshipValue
      ),

    raw: item,
  };
}

export function getNormalizedFamilyMembers(
  family: RawFamilyData
) {
  return [
    ...(
      family.relationships ??
      []
    ).map(
      (
        item
      ) =>
        normalizeFamilyMember(
          "relationship",
          item
        )
    ),

    ...(
      family.children ??
      []
    ).map(
      (
        item
      ) =>
        normalizeFamilyMember(
          "child",
          item
        )
    ),
  ];
}

export function toNumberOrNull(
  value:
    | number
    | string
    | null
    | undefined
) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const parsed =
    typeof value ===
      "number"
      ? value
      : Number(
          value
        );

  return Number.isFinite(
    parsed
  )
    ? parsed
    : null;
}
