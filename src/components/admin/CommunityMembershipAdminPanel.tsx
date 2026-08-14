"use client";

import {
  FormEvent,
  useEffect,
  useState,
} from "react";

import { supabase } from "@/utils/supabase/client";

type CommunityMembershipCandidate = {
  user_id: string;
  full_name: string | null;
  username: string | null;
  email: string | null;
  avatar_url: string | null;
  membership_status:
    | "active"
    | "expired"
    | "revoked"
    | null;
  member_label: string | null;
  show_on_profile: boolean;
  verified_at: string | null;
  expires_at: string | null;
};

function formatMembershipStatus(
  candidate: CommunityMembershipCandidate
) {
  if (candidate.membership_status === "active") {
    return candidate.member_label || "Verified member";
  }

  if (candidate.membership_status === "expired") {
    return "Expired";
  }

  if (candidate.membership_status === "revoked") {
    return "Revoked";
  }

  return "Not verified";
}

export default function CommunityMembershipAdminPanel({
  communityId,
  communityName,
}: {
  communityId: string;
  communityName: string;
}) {
  const [query, setQuery] = useState("");
  const [memberLabel, setMemberLabel] = useState("Member");
  const [expiresOn, setExpiresOn] = useState("");
  const [note, setNote] = useState("");
  const [results, setResults] = useState<CommunityMembershipCandidate[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [message, setMessage] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);

  async function loadResults(searchQuery = query) {
    setIsLoading(true);

    try {
      const { data, error } = await supabase.rpc(
        "admin_search_community_memberships",
        {
          p_community_id: communityId,
          p_query: searchQuery.trim() || null,
          p_limit: 40,
        }
      );

      if (error) {
        throw error;
      }

      setResults(
        (data ?? []) as CommunityMembershipCandidate[]
      );
    } catch (error) {
      console.error(
        "Community membership search failed:",
        error
      );
      setMessage({
        tone: "error",
        text:
          error instanceof Error
            ? error.message
            : "Community members could not be loaded.",
      });
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadResults("");
    // communityId identifies an entirely new membership catalogue.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [communityId]);

  async function handleSearch(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    await loadResults();
  }

  async function setMembership(
    candidate: CommunityMembershipCandidate,
    active: boolean
  ) {
    setMessage(null);
    setBusyUserId(candidate.user_id);

    try {
      let expiresAt: string | null = null;

      if (active && expiresOn) {
        const date = new Date(`${expiresOn}T23:59:59`);

        if (Number.isNaN(date.getTime())) {
          throw new Error("Enter a valid membership expiry date.");
        }

        expiresAt = date.toISOString();
      }

      const { error } = await supabase.rpc(
        "admin_set_community_membership",
        {
          p_community_id: communityId,
          p_user_id: candidate.user_id,
          p_active: active,
          p_member_label:
            active
              ? memberLabel.trim() || "Member"
              : candidate.member_label || "Member",
          p_expires_at: active ? expiresAt : null,
          p_note: note.trim() || null,
        }
      );

      if (error) {
        throw error;
      }

      setMessage({
        tone: "success",
        text: active
          ? `${candidate.full_name || candidate.username || "User"} is now a verified member of ${communityName}.`
          : `${candidate.full_name || candidate.username || "User"}'s verified membership was revoked.`,
      });

      await loadResults();
    } catch (error) {
      console.error(
        "Community membership update failed:",
        error
      );
      setMessage({
        tone: "error",
        text:
          error instanceof Error
            ? error.message
            : "Community membership could not be updated.",
      });
    } finally {
      setBusyUserId(null);
    }
  }

  return (
    <section className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">
            Verified membership
          </p>
          <h3 className="mt-1 text-lg font-black text-gray-950">
            Who may represent {communityName} in an Intent?
          </h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-600">
            Following is only an interest signal. This list is the verified affiliation layer used by members-only Community Intents. A membership can also appear on the person&apos;s profile if they leave that visibility enabled.
          </p>
        </div>

        <span className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-emerald-800 shadow-sm">
          {results.filter((item) => item.membership_status === "active").length} visible in this result set
        </span>
      </div>

      <form
        onSubmit={handleSearch}
        className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,0.7fr)_180px_auto]"
      >
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search name, username or email"
          className="rounded-xl border border-emerald-200 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-500"
        />

        <input
          value={memberLabel}
          onChange={(event) => setMemberLabel(event.target.value)}
          maxLength={80}
          placeholder="Member label, e.g. Student"
          className="rounded-xl border border-emerald-200 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-500"
        />

        <input
          type="date"
          value={expiresOn}
          onChange={(event) => setExpiresOn(event.target.value)}
          className="rounded-xl border border-emerald-200 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-500"
          title="Optional membership expiry"
        />

        <button
          type="submit"
          disabled={isLoading}
          className="rounded-xl bg-emerald-700 px-5 py-3 text-sm font-bold text-white disabled:opacity-50"
        >
          {isLoading ? "Searching..." : "Search"}
        </button>
      </form>

      <textarea
        value={note}
        onChange={(event) => setNote(event.target.value)}
        maxLength={1000}
        placeholder="Private verification / revocation note, optional"
        className="mt-3 min-h-20 w-full resize-y rounded-xl border border-emerald-200 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-500"
      />

      {message && (
        <p
          className={`mt-3 rounded-xl border px-4 py-3 text-sm font-semibold ${
            message.tone === "success"
              ? "border-green-200 bg-white text-green-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {message.text}
        </p>
      )}

      <div className="mt-4 overflow-hidden rounded-2xl border border-emerald-100 bg-white">
        {results.length === 0 ? (
          <p className="px-5 py-6 text-sm text-gray-500">
            {isLoading
              ? "Loading people..."
              : "No matching profiles."}
          </p>
        ) : (
          <div className="divide-y divide-gray-100">
            {results.map((candidate) => {
              const active = candidate.membership_status === "active";
              const displayName =
                candidate.full_name ||
                candidate.username ||
                candidate.email ||
                "UIN member";

              return (
                <article
                  key={candidate.user_id}
                  className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    {candidate.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={candidate.avatar_url}
                        alt=""
                        className="h-10 w-10 shrink-0 rounded-full object-cover"
                      />
                    ) : (
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gray-100 text-sm font-black text-gray-500">
                        {displayName.slice(0, 1).toUpperCase()}
                      </span>
                    )}

                    <div className="min-w-0">
                      <p className="truncate font-bold text-gray-950">
                        {displayName}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-gray-500">
                        {candidate.username ? `@${candidate.username}` : candidate.email || "No public username"}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-wide">
                        <span
                          className={
                            active
                              ? "text-emerald-700"
                              : candidate.membership_status === "expired"
                                ? "text-amber-700"
                                : "text-gray-500"
                          }
                        >
                          {formatMembershipStatus(candidate)}
                        </span>
                        {active && (
                          <span className="text-gray-400">
                            {candidate.show_on_profile
                              ? "Profile badge visible"
                              : "Profile badge hidden"}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex shrink-0 gap-2">
                    {active ? (
                      <button
                        type="button"
                        disabled={busyUserId === candidate.user_id}
                        onClick={() => void setMembership(candidate, false)}
                        className="rounded-xl border border-red-200 bg-white px-4 py-2.5 text-xs font-bold text-red-700 hover:bg-red-50 disabled:opacity-50"
                      >
                        {busyUserId === candidate.user_id ? "Updating..." : "Revoke"}
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={busyUserId === candidate.user_id}
                        onClick={() => void setMembership(candidate, true)}
                        className="rounded-xl bg-emerald-700 px-4 py-2.5 text-xs font-bold text-white hover:bg-emerald-800 disabled:opacity-50"
                      >
                        {busyUserId === candidate.user_id ? "Updating..." : "Verify member"}
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
