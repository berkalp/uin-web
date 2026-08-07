"use client";

import {
  useState,
  useTransition,
} from "react";
import {
  useRouter,
} from "next/navigation";

import {
  communityAccentWithAlpha,
  getCommunityAccentForeground,
  normalizeCommunityAccent,
  normalizeCommunitySecondary,
} from "@/utils/communities";
import {
  supabase,
} from "@/utils/supabase/client";

type CommunityFollowButtonProps = {
  communityId: string;
  communityName: string;
  initialIsFollowing: boolean;
  compact?: boolean;
  hero?: boolean;
  accentColor?: string;
  secondaryColor?: string | null;
};

export default function CommunityFollowButton({
  communityId,
  communityName,
  initialIsFollowing,
  compact = false,
  hero = false,
  accentColor = "#4F46E5",
  secondaryColor = null,
}: CommunityFollowButtonProps) {
  const router =
    useRouter();

  const [
    isFollowing,
    setIsFollowing,
  ] = useState(
    initialIsFollowing
  );

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const [
    isPending,
    startTransition,
  ] = useTransition();

  const normalizedAccentColor =
    normalizeCommunityAccent(
      accentColor
    );

  const normalizedSecondaryColor =
    normalizeCommunitySecondary(
      secondaryColor
    );

  const heroButtonColor =
    normalizedSecondaryColor ??
    normalizedAccentColor;

  const heroButtonForeground =
    getCommunityAccentForeground(
      heroButtonColor
    );

  const heroCopyColor =
    getCommunityAccentForeground(
      normalizedAccentColor
    );

  function toggleFollow() {
    setErrorMessage("");

    startTransition(
      async () => {
        const nextIsFollowing =
          !isFollowing;

        const {
          error,
        } = await supabase.rpc(
          nextIsFollowing
            ? "follow_community"
            : "unfollow_community",
          {
            p_community_id:
              communityId,
          }
        );

        if (error) {
          console.error(
            "Community follow update failed:",
            error
          );

          setErrorMessage(
            error.message ||
              "Could not update Community follow status."
          );

          return;
        }

        setIsFollowing(
          nextIsFollowing
        );

        router.refresh();
      }
    );
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        type="button"
        onClick={
          toggleFollow
        }
        disabled={
          isPending
        }
        aria-pressed={
          isFollowing
        }
        className={`rounded-xl font-semibold transition disabled:cursor-wait disabled:opacity-60 ${
          compact
            ? "border border-indigo-200 bg-white px-3 py-2 text-xs text-indigo-700 hover:border-indigo-400 hover:bg-indigo-50"
            : hero
              ? "border px-5 py-3 text-sm shadow-sm hover:-translate-y-0.5"
              : isFollowing
                ? "border border-indigo-200 bg-indigo-50 px-5 py-3 text-sm text-indigo-800 hover:border-indigo-400 hover:bg-indigo-100"
                : "bg-indigo-600 px-5 py-3 text-sm text-white hover:bg-indigo-700"
        }`}
        style={
          hero
            ? {
                backgroundColor:
                  isFollowing
                    ? communityAccentWithAlpha(
                        heroButtonColor,
                        0.18
                      )
                    : heroButtonColor,
                borderColor:
                  communityAccentWithAlpha(
                    heroButtonColor,
                    0.82
                  ),
                color:
                  isFollowing
                    ? heroButtonColor
                    : heroButtonForeground,
              }
            : undefined
        }
      >
        {isPending
          ? "Updating…"
          : isFollowing
            ? "Following"
            : `Follow ${communityName}`}
      </button>

      {!compact && (
        <p
          className="max-w-xs text-xs leading-5"
          style={{
            color: hero
              ? communityAccentWithAlpha(
                  heroCopyColor,
                  0.68
                )
              : undefined,
          }}
        >
          Following personalises Discover. It does not make you a member or reveal your interest publicly.
        </p>
      )}

      {errorMessage && (
        <p className="text-xs font-medium text-red-700">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
