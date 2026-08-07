import type {
  ReactNode,
} from "react";

import type {
  BadgeIconKey,
} from "@/utils/badges";

type BadgeIconProps = {
  iconKey: BadgeIconKey;
  iconUrl?: string | null;
  className?: string;
  imageClassName?: string;
};

function SvgShell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className ?? "h-6 w-6"}
    >
      {children}
    </svg>
  );
}

export default function BadgeIcon({
  iconKey,
  iconUrl = null,
  className,
  imageClassName,
}: BadgeIconProps) {
  if (iconUrl) {
    return (
      <img
        src={iconUrl}
        alt=""
        aria-hidden="true"
        className={
          imageClassName ??
          className ??
          "h-6 w-6 object-contain"
        }
      />
    );
  }

  if (iconKey === "shield") {
    return (
      <SvgShell className={className}>
        <path d="M12 3 19 6v5c0 4.8-2.7 8.1-7 10-4.3-1.9-7-5.2-7-10V6l7-3Z" />
        <path d="m9 12 2 2 4-5" />
      </SvgShell>
    );
  }

  if (iconKey === "trophy") {
    return (
      <SvgShell className={className}>
        <path d="M8 4h8v4a4 4 0 0 1-8 0V4Z" />
        <path d="M8 6H5v1a4 4 0 0 0 4 4" />
        <path d="M16 6h3v1a4 4 0 0 1-4 4" />
        <path d="M12 12v5" />
        <path d="M9 21h6" />
        <path d="M10 17h4" />
      </SvgShell>
    );
  }

  if (iconKey === "medal") {
    return (
      <SvgShell className={className}>
        <path d="m8 3 4 7 4-7" />
        <circle cx="12" cy="15" r="5" />
        <path d="m10.5 15 1 1 2-2.5" />
      </SvgShell>
    );
  }

  if (iconKey === "crown") {
    return (
      <SvgShell className={className}>
        <path d="m4 8 4 3 4-6 4 6 4-3-2 10H6L4 8Z" />
        <path d="M7 21h10" />
      </SvgShell>
    );
  }

  if (iconKey === "sparkles") {
    return (
      <SvgShell className={className}>
        <path d="m12 3 1.2 3.8L17 8l-3.8 1.2L12 13l-1.2-3.8L7 8l3.8-1.2L12 3Z" />
        <path d="m18 13 .8 2.2L21 16l-2.2.8L18 19l-.8-2.2L15 16l2.2-.8L18 13Z" />
        <path d="m5 14 .7 1.8 1.8.7-1.8.7L5 19l-.7-1.8-1.8-.7 1.8-.7L5 14Z" />
      </SvgShell>
    );
  }

  if (iconKey === "heart") {
    return (
      <SvgShell className={className}>
        <path d="M20.8 5.8a5.2 5.2 0 0 0-7.4 0L12 7.2l-1.4-1.4a5.2 5.2 0 1 0-7.4 7.4L12 22l8.8-8.8a5.2 5.2 0 0 0 0-7.4Z" />
      </SvgShell>
    );
  }

  if (iconKey === "handshake") {
    return (
      <SvgShell className={className}>
        <path d="m8 11 3-3a2.5 2.5 0 0 1 3.5 0l1.5 1.5" />
        <path d="m3 8 4-4 4 4-5 5-3-3Z" />
        <path d="m21 8-4-4-3 3" />
        <path d="m8 13 5 5a2 2 0 0 0 3 0l3-3" />
        <path d="m10 15-2 2" />
      </SvgShell>
    );
  }

  if (iconKey === "compass") {
    return (
      <SvgShell className={className}>
        <circle cx="12" cy="12" r="9" />
        <path d="m15.5 8.5-2 5-5 2 2-5 5-2Z" />
      </SvgShell>
    );
  }

  if (iconKey === "people") {
    return (
      <SvgShell className={className}>
        <circle cx="9" cy="8" r="3" />
        <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
        <circle cx="17" cy="9" r="2.5" />
        <path d="M15.5 14.5A4.5 4.5 0 0 1 21 19" />
      </SvgShell>
    );
  }

  if (iconKey === "flame") {
    return (
      <SvgShell className={className}>
        <path d="M13 3s1 3-1 5c-2-2-5 1-5 5a5 5 0 0 0 10 0c0-3-1.5-5-4-7 0 2-1 3-2 4" />
      </SvgShell>
    );
  }

  if (iconKey === "leaf") {
    return (
      <SvgShell className={className}>
        <path d="M20 4C12 4 5 8 5 15c0 3 2 5 5 5 7 0 10-7 10-16Z" />
        <path d="M5 20c3-5 7-8 12-11" />
      </SvgShell>
    );
  }

  if (iconKey === "ball") {
    return (
      <SvgShell className={className}>
        <circle cx="12" cy="12" r="9" />
        <path d="m9 9 3-2 3 2-1 4h-4L9 9Z" />
        <path d="m12 7-1-4" />
        <path d="m15 9 4-1" />
        <path d="m14 13 3 4" />
        <path d="m10 13-3 4" />
        <path d="M9 9 5 8" />
      </SvgShell>
    );
  }

  if (iconKey === "flag") {
    return (
      <SvgShell className={className}>
        <path d="M5 21V4" />
        <path d="M5 5h11l-2 4 2 4H5" />
      </SvgShell>
    );
  }

  if (iconKey === "check") {
    return (
      <SvgShell className={className}>
        <circle cx="12" cy="12" r="9" />
        <path d="m8 12 2.5 2.5L16 9" />
      </SvgShell>
    );
  }

  if (iconKey === "lightning") {
    return (
      <SvgShell className={className}>
        <path d="m13 2-8 12h6l-1 8 9-13h-6V2Z" />
      </SvgShell>
    );
  }

  return (
    <SvgShell className={className}>
      <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-2.9-5.6 2.9 1.1-6.2L3 9.6l6.2-.9L12 3Z" />
    </SvgShell>
  );
}
