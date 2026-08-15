import Link from "next/link";

type TimelineHomeLogoProps = {
  className?: string;
};

export default function TimelineHomeLogo({
  className = "",
}: TimelineHomeLogoProps) {
  return (
    <Link
      href="/timeline"
      aria-label="UIN Timeline"
      className={`inline-flex items-center rounded-xl px-2 py-1 transition hover:bg-white ${className}`}
    >
      <img
        src="/uin-logo.png"
        alt="uin? logo"
        className="h-10 w-auto"
      />
    </Link>
  );
}
