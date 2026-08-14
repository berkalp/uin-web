import Link from "next/link";

import CommunityIcon from "@/components/communities/CommunityIcon";
import {
  getCommunityAccentForeground,
  getCommunityVisibleBorder,
  normalizeCommunityAccent,
  normalizeCommunitySecondary,
} from "@/utils/communities";
import type { PublicCommunityMembership } from "@/utils/communityMemberships";

export default function PublicCommunityMembershipsPanel({
  memberships,
  isOwner = false,
}: {
  memberships: PublicCommunityMembership[];
  isOwner?: boolean;
}) {
  if (memberships.length === 0) {
    return null;
  }

  return (
    <section className="mt-6 rounded-3xl border border-gray-200 bg-white p-5 shadow-sm md:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
            Community membership
          </p>
          <h2 className="mt-1.5 text-xl font-bold text-gray-950">
            Verified affiliations
          </h2>
          <p className="mt-1.5 max-w-3xl text-sm leading-6 text-gray-500">
            These are verified Community affiliations, not follows and not reputation badges. They can grant access to members-only Community Intents.
          </p>
        </div>

        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
          {memberships.length} verified {memberships.length === 1 ? "membership" : "memberships"}
        </span>
      </div>

      {isOwner && (
        <p className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50/60 px-4 py-3 text-xs leading-5 text-gray-600">
          You control whether each verified membership appears here from that Community&apos;s page. Hiding the badge does not remove the membership or its Intent access.
        </p>
      )}

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {memberships.map((membership) => {
          const accent = normalizeCommunityAccent(
            membership.community_accent_color
          );
          const secondary = normalizeCommunitySecondary(
            membership.community_secondary_color
          );
          const border = getCommunityVisibleBorder(
            accent,
            secondary
          );

          return (
            <Link
              key={membership.community_id}
              href={`/communities/${encodeURIComponent(
                membership.community_slug
              )}`}
              className="min-w-0 rounded-2xl border bg-white p-3 transition hover:-translate-y-0.5 hover:shadow-md"
              style={{ borderColor: border }}
              title={
                membership.community_description ||
                membership.community_name
              }
            >
              <span
                className="flex h-10 w-10 items-center justify-center rounded-xl shadow-sm"
                style={{
                  backgroundColor: accent,
                  color: getCommunityAccentForeground(accent),
                  boxShadow: `inset 0 0 0 2px ${border}`,
                }}
              >
                <CommunityIcon
                  iconKey={membership.community_icon_key}
                  iconUrl={membership.community_icon_url}
                  className="h-5 w-5"
                />
              </span>

              <h3 className="mt-3 truncate text-sm font-bold text-gray-950">
                {membership.community_name}
              </h3>

              <p className="mt-1 truncate text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                {membership.member_label || "Verified member"}
              </p>

              <p className="mt-2 text-[10px] font-semibold text-gray-400">
                Verified affiliation
              </p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
