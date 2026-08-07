export type ProfileActivityVisibility =
  | "public"
  | "friends"
  | "private";

export const PROFILE_ACTIVITY_VISIBILITY_OPTIONS: Array<{
  value: ProfileActivityVisibility;
  label: string;
  description: string;
}> = [
  {
    value: "public",
    label: "Everyone",
    description:
      "People who can view the Intent may also see your participant role on your profile.",
  },
  {
    value: "friends",
    label: "Friends",
    description:
      "Only accepted friends can see Activities you joined as a participant.",
  },
  {
    value: "private",
    label: "Only me",
    description:
      "Participant Activities stay hidden from everyone else on your profile.",
  },
];
