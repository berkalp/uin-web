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
    label: "Herkese Açık",
    description:
      "Herkes bu etkinliği görebilir. Giriş yapan kullanıcılar katılma isteği gönderebilir.",
    discovery:
      "Profilde görünür",
    request:
      "Katılma istekleri açık",
    invitation:
      "Doğrudan davetler açık",
  },
  {
    value: "friends",
    label: "Yalnızca Arkadaşlar",
    description:
      "Yalnızca arkadaşların bu etkinliği görebilir ve katılma isteği gönderebilir.",
    discovery:
      "Yalnızca arkadaşlara görünür",
    request:
      "Arkadaşların katılma istekleri açık",
    invitation:
      "Doğrudan davetler açık",
  },
  {
    value: "except_friends",
    label:
      "Arkadaşlar Hariç Herkes",
    description:
      "Arkadaşların dışındaki kişiler görebilir ve katılma isteği gönderebilir.",
    discovery:
      "Arkadaşlardan gizli",
    request:
      "Arkadaş olmayanların katılma istekleri açık",
    invitation:
      "Doğrudan davetler açık",
  },
  {
    value: "invite_only",
    label: "Yalnızca Davetliler",
    description:
      "Yalnızca mevcut katılımcılar ve doğrudan davet edilen kişiler görebilir.",
    discovery:
      "Etkinlikler sayfasında görünmez",
    request:
      "Katılma istekleri kapalı",
    invitation:
      "Doğrudan davetler açık",
  },
  {
    value: "private",
    label: "Yalnızca Ben",
    description:
      "Bu etkinliği yalnızca sen görebilirsin. Bekleyen istekler ve davetler kapatılır.",
    discovery:
      "Tamamen özel",
    request:
      "Katılma istekleri kapalı",
    invitation:
      "Doğrudan davetler kapalı",
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
