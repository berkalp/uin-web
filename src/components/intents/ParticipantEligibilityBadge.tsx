import {
  getParticipantEligibilityClasses,
  getParticipantEligibilityLabel,
  type ParticipantEligibility,
} from "@/utils/participationEligibility";

type ParticipantEligibilityBadgeProps = {
  eligibility: ParticipantEligibility;
};

export default function ParticipantEligibilityBadge({
  eligibility,
}: ParticipantEligibilityBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${getParticipantEligibilityClasses(
        eligibility
      )}`}
    >
      {getParticipantEligibilityLabel(eligibility)}
    </span>
  );
}
