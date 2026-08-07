export type ProfileGender =
  | "female"
  | "male"
  | "non_binary"
  | "prefer_not_to_say";

export type ParticipantEligibility =
  | "everyone"
  | "women_only"
  | "men_only";

export const PROFILE_GENDER_OPTIONS: Array<{
  value: ProfileGender;
  label: string;
}> = [
  { value: "female", label: "Woman" },
  { value: "male", label: "Man" },
  { value: "non_binary", label: "Non-binary" },
  {
    value: "prefer_not_to_say",
    label: "Prefer not to say",
  },
];

export const PARTICIPANT_ELIGIBILITY_OPTIONS: Array<{
  value: ParticipantEligibility;
  label: string;
  badgeLabel: string;
}> = [
  {
    value: "everyone",
    label: "Everyone",
    badgeLabel: "Open to Everyone",
  },
  {
    value: "women_only",
    label: "Women only",
    badgeLabel: "Women Only",
  },
  {
    value: "men_only",
    label: "Men only",
    badgeLabel: "Men Only",
  },
];

export function normalizeProfileGender(
  value: unknown
): ProfileGender | null {
  return PROFILE_GENDER_OPTIONS.some(
    (option) => option.value === value
  )
    ? (value as ProfileGender)
    : null;
}

export function normalizeParticipantEligibility(
  value: unknown
): ParticipantEligibility {
  return PARTICIPANT_ELIGIBILITY_OPTIONS.some(
    (option) => option.value === value
  )
    ? (value as ParticipantEligibility)
    : "everyone";
}

export function getProfileGenderLabel(
  gender: ProfileGender
) {
  return (
    PROFILE_GENDER_OPTIONS.find(
      (option) => option.value === gender
    )?.label ?? gender
  );
}

export function canGenderUseEligibility(
  gender: ProfileGender | null,
  eligibility: ParticipantEligibility
) {
  if (eligibility === "everyone") {
    return true;
  }

  if (eligibility === "women_only") {
    return gender === "female";
  }

  return gender === "male";
}

export function getParticipantEligibilityLabel(
  eligibility: ParticipantEligibility
) {
  return (
    PARTICIPANT_ELIGIBILITY_OPTIONS.find(
      (option) => option.value === eligibility
    )?.badgeLabel ?? "Open to Everyone"
  );
}

export function getParticipantEligibilityClasses(
  eligibility: ParticipantEligibility
) {
  if (eligibility === "women_only") {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }

  if (eligibility === "men_only") {
    return "border-sky-200 bg-sky-50 text-sky-700";
  }

  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}
