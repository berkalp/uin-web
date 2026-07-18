export type ActivityVisibility =
  | "public"
  | "friends"
  | "except_friends"
  | "invite_only"
  | "private";

export type ActivityVisibilityOption = {
  value: ActivityVisibility;
  label: string;
  description: string;
  discovery: string;
  request: string;
  invitation: string;
};

export const ACTIVITY_VISIBILITY_OPTIONS:
  ActivityVisibilityOption[] = [
  {
    value: "public",
    label: "Anyone",
    description:
      "Everyone can see this Activity. Signed-in users can request to join.",
    discovery:
      "Visible on the profile",
    request:
      "Join requests enabled",
    invitation:
      "Direct invitations enabled",
  },
  {
    value: "friends",
    label: "Friends only",
    description:
      "Only accepted friends can see this Activity and request to join.",
    discovery:
      "Visible only to friends",
    request:
      "Friend join requests enabled",
    invitation:
      "Direct invitations enabled",
  },
  {
    value: "except_friends",
    label:
      "Anyone except friends",
    description:
      "People outside your accepted friend network can see and request to join.",
    discovery:
      "Hidden from friends",
    request:
      "Non-friend join requests enabled",
    invitation:
      "Direct invitations enabled",
  },
  {
    value: "invite_only",
    label: "Invite only",
    description:
      "Only active members and directly invited people can see this Activity.",
    discovery:
      "Hidden from discovery",
    request:
      "Join requests disabled",
    invitation:
      "Direct invitations enabled",
  },
  {
    value: "private",
    label: "Only me",
    description:
      "Only you can see this Activity. Pending requests and invitations are closed.",
    discovery:
      "Completely private",
    request:
      "Join requests disabled",
    invitation:
      "Direct invitations disabled",
  },
];

export function normalizeActivityVisibility(
  value: string
): ActivityVisibility {
  if (
    value === "public" ||
    value === "friends" ||
    value === "except_friends" ||
    value === "invite_only" ||
    value === "private"
  ) {
    return value;
  }

  if (value === "members") {
    return "invite_only";
  }

  if (
    value ===
    "all_except_friends"
  ) {
    return "except_friends";
  }

  if (value === "only_me") {
    return "private";
  }

  return "private";
}

export function getActivityVisibilityLabel(
  value: string
) {
  const normalized =
    normalizeActivityVisibility(
      value
    );

  return (
    ACTIVITY_VISIBILITY_OPTIONS.find(
      (option) =>
        option.value ===
        normalized
    )?.label ??
    normalized
  );
}
