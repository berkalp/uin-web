import Link from "next/link";
import type {
  ReactNode,
} from "react";

type ProfileNameLinkProps = {
  username:
    | string
    | null
    | undefined;
  children: ReactNode;
  className?: string;
  title?: string;
};

export default function ProfileNameLink({
  username,
  children,
  className = "",
  title,
}: ProfileNameLinkProps) {
  const cleanedUsername =
    username?.trim();

  if (!cleanedUsername) {
    return (
      <span
        className={className}
        title={title}
      >
        {children}
      </span>
    );
  }

  return (
    <Link
      href={`/u/${encodeURIComponent(
        cleanedUsername
      )}`}
      className={className}
      title={title}
    >
      {children}
    </Link>
  );
}