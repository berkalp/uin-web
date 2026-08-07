type VerificationMarkProps = {
  label?: string;
  compact?: boolean;
};

export default function VerificationMark({
  label = "Identity verified by UIN",
  compact = false,
}: VerificationMarkProps) {
  const sizeClasses = compact
    ? "h-5 w-5"
    : "h-6 w-6";

  return (
    <span
      title={label}
      aria-label={label}
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-blue-600 text-white shadow-sm ${sizeClasses}`}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        className={compact ? "h-3.5 w-3.5" : "h-4 w-4"}
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m7.5 12.5 3 3 6-7" />
      </svg>
    </span>
  );
}
