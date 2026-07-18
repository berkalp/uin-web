"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { supabase } from "@/utils/supabase/client";

type ProfileFollowButtonProps = {
  profileUserId: string;
  initialFollowing: boolean;
};

export default function ProfileFollowButton({
  profileUserId,
  initialFollowing,
}: ProfileFollowButtonProps) {
  const router = useRouter();

  const [
    isFollowing,
    setIsFollowing,
  ] = useState(
    initialFollowing
  );

  const [
    isWorking,
    setIsWorking,
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  async function toggleFollow() {
    setIsWorking(true);
    setErrorMessage("");

    try {
      const {
        data,
        error,
      } = await supabase.rpc(
        "toggle_profile_follow",
        {
          p_followed_user_id:
            profileUserId,
        }
      );

      if (error) {
        throw error;
      }

      setIsFollowing(
        data === true
      );

      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Follow status could not be updated."
      );
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        disabled={isWorking}
        onClick={toggleFollow}
        className={`rounded-xl px-5 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
          isFollowing
            ? "border border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
            : "bg-green-600 text-white hover:bg-green-700"
        }`}
      >
        {isWorking
          ? "Updating..."
          : isFollowing
            ? "Following"
            : "Follow"}
      </button>

      {errorMessage && (
        <p className="mt-2 text-xs font-semibold text-red-700">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
