import type {
  CommunityIconKey,
} from "@/utils/communities";

type CommunityIconProps = {
  iconKey: CommunityIconKey;
  iconUrl?: string | null;
  className?: string;
};

function IconSvg({
  iconKey,
  className,
}: {
  iconKey: CommunityIconKey;
  className: string;
}) {
  const commonProps = {
    "aria-hidden": true,
    viewBox: "0 0 24 24",
    fill: "none",
    className,
    stroke: "currentColor",
    strokeWidth: 1.9,
    strokeLinecap:
      "round" as const,
    strokeLinejoin:
      "round" as const,
  };

  if (
    iconKey ===
    "football"
  ) {
    return (
      <svg {...commonProps}>
        <circle
          cx="12"
          cy="12"
          r="9"
        />
        <path d="m9.5 9 2.5-2 2.5 2-.9 3h-3.2Z" />
        <path d="m10.4 12-3 2.1" />
        <path d="m13.6 12 3 2.1" />
        <path d="m9.5 9-2.3-1.6" />
        <path d="m14.5 9 2.3-1.6" />
        <path d="m9.5 16.6.9-4.6" />
        <path d="m14.5 16.6-.9-4.6" />
      </svg>
    );
  }

  if (
    iconKey ===
    "music"
  ) {
    return (
      <svg {...commonProps}>
        <path d="M9 18V6l10-2v12" />
        <circle
          cx="6"
          cy="18"
          r="3"
        />
        <circle
          cx="16"
          cy="16"
          r="3"
        />
      </svg>
    );
  }

  if (
    iconKey ===
    "family"
  ) {
    return (
      <svg {...commonProps}>
        <circle
          cx="8"
          cy="8"
          r="3"
        />
        <circle
          cx="17"
          cy="9"
          r="2.5"
        />
        <path d="M3 20a5 5 0 0 1 10 0" />
        <path d="M13 20a4 4 0 0 1 8 0" />
      </svg>
    );
  }

  if (
    iconKey ===
    "travel"
  ) {
    return (
      <svg {...commonProps}>
        <path d="m3 11 18-7-7 18-2.5-7.5Z" />
        <path d="m11.5 14.5 4-4" />
      </svg>
    );
  }

  if (
    iconKey ===
    "book"
  ) {
    return (
      <svg {...commonProps}>
        <path d="M4 5.5A3.5 3.5 0 0 1 7.5 2H11v17H7.5A3.5 3.5 0 0 0 4 22Z" />
        <path d="M20 5.5A3.5 3.5 0 0 0 16.5 2H13v17h3.5A3.5 3.5 0 0 1 20 22Z" />
      </svg>
    );
  }

  if (
    iconKey ===
    "gaming"
  ) {
    return (
      <svg {...commonProps}>
        <path d="M8 7h8a5 5 0 0 1 4.7 6.7l-1.1 3.1a2.7 2.7 0 0 1-4.3 1.2l-1.7-1.4h-3.2L8.7 18a2.7 2.7 0 0 1-4.3-1.2l-1.1-3.1A5 5 0 0 1 8 7Z" />
        <path d="M7 11v4" />
        <path d="M5 13h4" />
        <circle
          cx="16.5"
          cy="12"
          r=".7"
          fill="currentColor"
          stroke="none"
        />
        <circle
          cx="18.5"
          cy="14"
          r=".7"
          fill="currentColor"
          stroke="none"
        />
      </svg>
    );
  }

  if (
    iconKey ===
    "technology"
  ) {
    return (
      <svg {...commonProps}>
        <rect
          x="5"
          y="5"
          width="14"
          height="14"
          rx="2"
        />
        <path d="M9 1v4M15 1v4M9 19v4M15 19v4M1 9h4M1 15h4M19 9h4M19 15h4" />
        <path d="M9 9h6v6H9Z" />
      </svg>
    );
  }

  if (
    iconKey ===
    "art"
  ) {
    return (
      <svg {...commonProps}>
        <path d="M12 3a9 9 0 1 0 0 18h1.5a2 2 0 0 0 0-4H12a2 2 0 0 1 0-4h3a6 6 0 0 0 0-12Z" />
        <circle
          cx="7.5"
          cy="10"
          r=".8"
          fill="currentColor"
          stroke="none"
        />
        <circle
          cx="9.5"
          cy="6.5"
          r=".8"
          fill="currentColor"
          stroke="none"
        />
        <circle
          cx="14"
          cy="6"
          r=".8"
          fill="currentColor"
          stroke="none"
        />
      </svg>
    );
  }

  if (
    iconKey ===
    "nature"
  ) {
    return (
      <svg {...commonProps}>
        <path d="M20 4C11 4 5 9 5 16c0 2 1 4 3 4 7 0 12-7 12-16Z" />
        <path d="M4 21c3-6 7-9 13-13" />
      </svg>
    );
  }

  if (
    iconKey ===
    "local"
  ) {
    return (
      <svg {...commonProps}>
        <path d="M12 22s7-6 7-13a7 7 0 1 0-14 0c0 7 7 13 7 13Z" />
        <circle
          cx="12"
          cy="9"
          r="2.5"
        />
      </svg>
    );
  }

  if (
    iconKey ===
    "star"
  ) {
    return (
      <svg {...commonProps}>
        <path d="m12 2.5 2.9 5.9 6.5.9-4.7 4.6 1.1 6.5-5.8-3.1-5.8 3.1 1.1-6.5-4.7-4.6 6.5-.9Z" />
      </svg>
    );
  }

  if (
    iconKey ===
    "flag"
  ) {
    return (
      <svg {...commonProps}>
        <path d="M5 22V3" />
        <path d="M5 4h11l-1 4 1 4H5" />
      </svg>
    );
  }

  return (
    <svg {...commonProps}>
      <circle
        cx="8"
        cy="8"
        r="3"
      />
      <circle
        cx="17"
        cy="9"
        r="2.5"
      />
      <path d="M3 20a5 5 0 0 1 10 0" />
      <path d="M13 20a4 4 0 0 1 8 0" />
    </svg>
  );
}

export default function CommunityIcon({
  iconKey,
  iconUrl = null,
  className =
    "h-5 w-5",
}: CommunityIconProps) {
  if (iconUrl) {
    return (
      <img
        src={iconUrl}
        alt=""
        className={`${className} object-contain`}
      />
    );
  }

  return (
    <IconSvg
      iconKey={iconKey}
      className={
        className
      }
    />
  );
}
