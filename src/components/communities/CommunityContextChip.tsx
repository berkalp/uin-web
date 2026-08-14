import Link from "next/link";

import CommunityIcon from "@/components/communities/CommunityIcon";

import {
  getCommunityBrandSurface,
  getCommunityVisibleBorder,
  normalizeCommunityAccent,
  normalizeCommunitySecondary,
  type CommunityIconKey,
} from "@/utils/communities";

type CommunityContextChipValue = {
  name: string;
  slug: string;
  iconKey: CommunityIconKey;
  iconUrl: string | null;
  accentColor?: string;
  secondaryColor?: string | null;
};

export default function CommunityContextChip({
  community,
  compact = false,
  className = "",
  tone = "surface",
}: {
  community: CommunityContextChipValue;
  compact?: boolean;
  className?: string;
  tone?: "surface" | "overlay";
}) {
  const accentColor =
    normalizeCommunityAccent(
      community.accentColor
    );

  const secondaryColor =
    normalizeCommunitySecondary(
      community.secondaryColor
    );


  const visibleBorder =
    getCommunityVisibleBorder(
      accentColor,
      secondaryColor
    );

  const isOverlay =
    tone === "overlay";

  return (
    <Link
      href={`/communities/${encodeURIComponent(
        community.slug
      )}`}
      title={`Open the ${community.name} Community page`}
      className={`inline-flex min-w-0 items-center gap-2 rounded-full border transition hover:-translate-y-0.5 hover:shadow-sm ${
        compact
          ? "px-2 py-1 text-[10px]"
          : "px-2.5 py-1.5 text-xs"
      } ${
        isOverlay
          ? "font-normal text-white"
          : "font-semibold text-gray-900"
      } ${className}`}
      style={{
        borderColor:
          isOverlay
            ? "rgba(255,255,255,0.58)"
            : visibleBorder,
        background:
          getCommunityBrandSurface(
            accentColor,
            secondaryColor,
            isOverlay
              ? 0.72
              : 0.09
          ),
        color:
          isOverlay
            ? "#FFFFFF"
            : undefined,
        fontWeight:
          isOverlay
            ? 400
            : undefined,
        textShadow:
          isOverlay
            ? "0 1px 3px rgba(0,0,0,0.95)"
            : undefined,
        boxShadow:
          isOverlay
            ? "0 2px 8px rgba(0,0,0,0.34), inset 0 0 0 1px rgba(255,255,255,0.16)"
            : undefined,
      }}
    >
      <span
        className={`flex shrink-0 items-center justify-center ${compact ? "h-5 w-5" : "h-6 w-6"}`}
        style={{ color: isOverlay ? "#FFFFFF" : accentColor }}
      >
        <CommunityIcon
          iconKey={
            community.iconKey
          }
          iconUrl={
            community.iconUrl
          }
          className={
            compact
              ? "h-4 w-4"
              : "h-5 w-5"
          }
        />
      </span>

      <span
        className={
          isOverlay
            ? "truncate font-normal text-white"
            : "truncate"
        }
      >
        {community.name}
      </span>
    </Link>
  );
}