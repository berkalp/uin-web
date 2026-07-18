"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { supabase } from "@/utils/supabase/client";

type FriendRequestActionsProps = {
  friendshipId: string;
};

export default function FriendRequestActions({
  friendshipId,
}: FriendRequestActionsProps) {
  const router = useRouter();

  const [
    isWorking,
    setIsWorking,
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  async function respond(
    response:
      | "accept"
      | "decline"
  ) {
    setIsWorking(true);
    setErrorMessage("");

    try {
      const {
        error,
      } = await supabase.rpc(
        "respond_friend_request",
        {
          p_friendship_id:
            friendshipId,

          p_response:
            response,
        }
      );

      if (error) {
        throw error;
      }

      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Friend request could not be updated."
      );
      setIsWorking(false);
    }
  }

  return (
    <div className="mt-4">
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          disabled={isWorking}
          onClick={() =>
            respond("decline")
          }
          className="rounded-xl border border-red-200 bg-white px-4 py-3 text-sm font-semibold text-red-700"
        >
          Decline
        </button>

        <button
          type="button"
          disabled={isWorking}
          onClick={() =>
            respond("accept")
          }
          className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white"
        >
          Accept
        </button>
      </div>

      {errorMessage && (
        <p className="mt-3 text-sm font-semibold text-red-700">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
