"use client";

import {
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";

import { supabase } from "@/utils/supabase/client";

export default function CommunityMembershipVisibilityToggle({
  communityId,
  initialShowOnProfile,
}: {
  communityId: string;
  initialShowOnProfile: boolean;
}) {
  const router = useRouter();
  const [showOnProfile, setShowOnProfile] = useState(
    initialShowOnProfile
  );
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  function toggle() {
    const nextValue = !showOnProfile;
    setMessage("");

    startTransition(async () => {
      const { error } = await supabase.rpc(
        "set_my_community_membership_visibility",
        {
          p_community_id: communityId,
          p_show_on_profile: nextValue,
        }
      );

      if (error) {
        console.error(
          "Community membership visibility update failed:",
          error
        );
        setMessage(
          error.message ||
            "Membership visibility could not be updated."
        );
        return;
      }

      setShowOnProfile(nextValue);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        onClick={toggle}
        disabled={isPending}
        aria-pressed={showOnProfile}
        className="rounded-xl border border-white/35 bg-white/15 px-3 py-2 text-xs font-bold text-white transition hover:bg-white/25 disabled:opacity-60"
      >
        {isPending
          ? "Updating…"
          : showOnProfile
            ? "Membership badge visible"
            : "Show membership on profile"}
      </button>

      {message && (
        <p className="max-w-xs text-[11px] font-semibold text-red-100">
          {message}
        </p>
      )}
    </div>
  );
}
