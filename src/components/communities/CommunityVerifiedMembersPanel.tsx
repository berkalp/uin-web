"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

export type CommunityVerifiedMember = {
  user_id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  member_label: string | null;
  verified_at: string | null;
  total_count?: number | string;
};

type CommunityVerifiedMembersPanelProps = {
  followerCount: number;
  verifiedMemberCount: number;
  openIntentCount: number;
  planningActivityCount: number;
  completedExperienceCount: number;
  members: CommunityVerifiedMember[];
};

function metricCardClass(tone: "indigo" | "emerald" | "blue" | "amber" | "green" | "violet") {
  switch (tone) {
    case "emerald":
      return "bg-emerald-50 text-emerald-700";
    case "blue":
      return "bg-blue-50 text-blue-700";
    case "amber":
      return "bg-amber-50 text-amber-700";
    case "green":
      return "bg-green-50 text-green-700";
    case "violet":
      return "bg-violet-50 text-violet-700";
    default:
      return "bg-indigo-50 text-indigo-700";
  }
}

function displayName(member: CommunityVerifiedMember) {
  return member.full_name || member.username || "UIN member";
}

function roleLabel(member: CommunityVerifiedMember) {
  return member.member_label?.trim() || "Verified member";
}

export default function CommunityVerifiedMembersPanel({
  followerCount,
  verifiedMemberCount,
  openIntentCount,
  planningActivityCount,
  completedExperienceCount,
  members,
}: CommunityVerifiedMembersPanelProps) {
  const [isDirectoryOpen, setIsDirectoryOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);

  const roleCounts = useMemo(() => {
    const counts = new Map<string, number>();

    members.forEach((member) => {
      const label = roleLabel(member);
      const normalized = label.toLocaleLowerCase("en");

      if (normalized === "member" || normalized === "verified member") {
        return;
      }

      counts.set(label, (counts.get(label) ?? 0) + 1);
    });

    return Array.from(counts.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
  }, [members]);

  const visibleMembers = useMemo(
    () =>
      selectedRole
        ? members.filter((member) => roleLabel(member) === selectedRole)
        : members,
    [members, selectedRole]
  );

  function openDirectory(role: string | null) {
    setSelectedRole(role);
    setIsDirectoryOpen(true);
  }

  return (
    <div className="p-6 md:p-8">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <div className={`rounded-2xl p-4 ${metricCardClass("indigo")}`}>
          <p className="text-xs font-semibold uppercase tracking-wide">Followers</p>
          <p className="mt-2 text-2xl font-black text-gray-950">{followerCount}</p>
          <p className="mt-1 text-xs text-gray-500">private follows shaping Discover</p>
        </div>

        {verifiedMemberCount > 0 && (
          <button
            type="button"
            onClick={() => openDirectory(null)}
            className={`rounded-2xl p-4 text-left transition hover:-translate-y-0.5 hover:shadow-sm ${metricCardClass("emerald")}`}
          >
            <p className="text-xs font-semibold uppercase tracking-wide">Verified members</p>
            <p className="mt-2 text-2xl font-black text-gray-950">{verifiedMemberCount}</p>
            <p className="mt-1 text-xs font-semibold text-emerald-700">View people →</p>
          </button>
        )}

        {roleCounts.map((role, index) => (
          <button
            key={role.label}
            type="button"
            onClick={() => openDirectory(role.label)}
            className={`rounded-2xl p-4 text-left transition hover:-translate-y-0.5 hover:shadow-sm ${metricCardClass(
              index % 2 === 0 ? "violet" : "emerald"
            )}`}
          >
            <p className="truncate text-xs font-semibold uppercase tracking-wide">{role.label}</p>
            <p className="mt-2 text-2xl font-black text-gray-950">{role.count}</p>
            <p className="mt-1 text-xs text-gray-500">verified affiliation</p>
          </button>
        ))}

        <div className={`rounded-2xl p-4 ${metricCardClass("blue")}`}>
          <p className="text-xs font-semibold uppercase tracking-wide">Open Intents</p>
          <p className="mt-2 text-2xl font-black text-gray-950">{openIntentCount}</p>
          <p className="mt-1 text-xs text-gray-500">visible current opportunities</p>
        </div>

        <div className={`rounded-2xl p-4 ${metricCardClass("amber")}`}>
          <p className="text-xs font-semibold uppercase tracking-wide">Planning</p>
          <p className="mt-2 text-2xl font-black text-gray-950">{planningActivityCount}</p>
          <p className="mt-1 text-xs text-gray-500">Forming or Planned Activities</p>
        </div>

        <div className={`rounded-2xl p-4 ${metricCardClass("green")}`}>
          <p className="text-xs font-semibold uppercase tracking-wide">Completed</p>
          <p className="mt-2 text-2xl font-black text-gray-950">{completedExperienceCount}</p>
          <p className="mt-1 text-xs text-gray-500">completed Experiences</p>
        </div>
      </div>

      {verifiedMemberCount > 0 && isDirectoryOpen && (
        <section className="mt-4 overflow-hidden rounded-2xl border border-emerald-100 bg-emerald-50/40">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-emerald-100 bg-white px-4 py-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-700">
                Verified members
              </p>
              <p className="mt-1 text-sm font-semibold text-gray-950">
                {selectedRole
                  ? `${selectedRole} · ${visibleMembers.length}`
                  : `${verifiedMemberCount} verified ${verifiedMemberCount === 1 ? "member" : "members"}`}
              </p>
            </div>

            <div className="flex items-center gap-2">
              {selectedRole && (
                <button
                  type="button"
                  onClick={() => setSelectedRole(null)}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50"
                >
                  All members
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsDirectoryOpen(false)}
                className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>

          <div className="grid gap-2 p-3 sm:grid-cols-2 xl:grid-cols-3">
            {visibleMembers.map((member) => {
              const name = displayName(member);
              const profileHref = member.username
                ? `/u/${encodeURIComponent(member.username)}`
                : null;

              const content = (
                <>
                  {member.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={member.avatar_url}
                      alt=""
                      className="h-11 w-11 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-emerald-100 text-sm font-black text-emerald-800">
                      {name.slice(0, 1).toUpperCase()}
                    </span>
                  )}

                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-gray-950">{name}</p>
                    <p className="mt-0.5 truncate text-xs text-gray-500">
                      {member.username ? `@${member.username}` : "Verified UIN member"}
                    </p>
                    <span className="mt-1.5 inline-flex rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                      {roleLabel(member)}
                    </span>
                  </div>
                </>
              );

              return profileHref ? (
                <Link
                  key={member.user_id}
                  href={profileHref}
                  className="flex items-center gap-3 rounded-xl border border-emerald-100 bg-white p-3 transition hover:border-emerald-300 hover:shadow-sm"
                >
                  {content}
                </Link>
              ) : (
                <div
                  key={member.user_id}
                  className="flex items-center gap-3 rounded-xl border border-emerald-100 bg-white p-3"
                >
                  {content}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
