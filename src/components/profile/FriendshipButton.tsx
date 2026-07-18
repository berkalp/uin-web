"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { supabase } from "@/utils/supabase/client";

type FriendshipStatus =
  | "pending"
  | "accepted"
  | "declined"
  | "removed"
  | null;

type FriendshipDirection =
  | "incoming"
  | "outgoing"
  | null;

type FriendshipButtonProps = {
  profileUserId: string;
  initialFriendshipId: string | null;
  initialStatus: FriendshipStatus;
  initialDirection: FriendshipDirection;
};

export default function FriendshipButton({
  profileUserId,
  initialFriendshipId,
  initialStatus,
  initialDirection,
}: FriendshipButtonProps) {
  const router = useRouter();

  const [
    friendshipId,
    setFriendshipId,
  ] = useState(
    initialFriendshipId
  );

  const [
    status,
    setStatus,
  ] = useState(
    initialStatus
  );

  const [
    direction,
    setDirection,
  ] = useState(
    initialDirection
  );

  const [
    isWorking,
    setIsWorking,
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  async function sendRequest() {
    setIsWorking(true);
    setErrorMessage("");

    try {
      const {
        data,
        error,
      } = await supabase.rpc(
        "send_friend_request",
        {
          p_other_user_id:
            profileUserId,
        }
      );

      if (error) {
        throw error;
      }

      setFriendshipId(
        typeof data === "string"
          ? data
          : friendshipId
      );

      setStatus(
        direction ===
          "incoming"
          ? "accepted"
          : "pending"
      );

      setDirection(
        direction ===
          "incoming"
          ? null
          : "outgoing"
      );

      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Friend request could not be sent."
      );
    } finally {
      setIsWorking(false);
    }
  }

  async function respond(
    response:
      | "accept"
      | "decline"
  ) {
    if (!friendshipId) {
      return;
    }

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

      setStatus(
        response === "accept"
          ? "accepted"
          : "declined"
      );

      setDirection(null);
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Friend request could not be updated."
      );
    } finally {
      setIsWorking(false);
    }
  }

  async function cancelRequest() {
    if (!friendshipId) {
      return;
    }

    setIsWorking(true);
    setErrorMessage("");

    try {
      const {
        error,
      } = await supabase.rpc(
        "cancel_friend_request",
        {
          p_friendship_id:
            friendshipId,
        }
      );

      if (error) {
        throw error;
      }

      setStatus(
        "removed"
      );

      setDirection(null);
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Friend request could not be cancelled."
      );
    } finally {
      setIsWorking(false);
    }
  }

  async function removeFriend() {
    if (!friendshipId) {
      return;
    }

    const confirmed =
      window.confirm(
        "Remove this person from your friends?"
      );

    if (!confirmed) {
      return;
    }

    setIsWorking(true);
    setErrorMessage("");

    try {
      const {
        error,
      } = await supabase.rpc(
        "remove_friendship",
        {
          p_friendship_id:
            friendshipId,
        }
      );

      if (error) {
        throw error;
      }

      setStatus(
        "removed"
      );

      setDirection(null);
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Friendship could not be removed."
      );
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <div>
      {status ===
      "accepted" ? (
        <button
          type="button"
          disabled={isWorking}
          onClick={removeFriend}
          className="rounded-xl border border-blue-200 bg-blue-50 px-5 py-3 text-sm font-semibold text-blue-700 transition hover:bg-blue-100 disabled:opacity-50"
        >
          Friends
        </button>
      ) : status ===
          "pending" &&
        direction ===
          "incoming" ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={isWorking}
            onClick={() =>
              respond("decline")
            }
            className="rounded-xl border border-red-200 bg-white px-4 py-3 text-sm font-semibold text-red-700"
          >
            Decline Friend
          </button>

          <button
            type="button"
            disabled={isWorking}
            onClick={() =>
              respond("accept")
            }
            className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white"
          >
            Accept Friend
          </button>
        </div>
      ) : status ===
          "pending" &&
        direction ===
          "outgoing" ? (
        <button
          type="button"
          disabled={isWorking}
          onClick={
            cancelRequest
          }
          className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-3 text-sm font-semibold text-amber-700 transition hover:bg-amber-100 disabled:opacity-50"
        >
          Friend Request Sent
        </button>
      ) : (
        <button
          type="button"
          disabled={isWorking}
          onClick={sendRequest}
          className="rounded-xl border border-blue-200 bg-white px-5 py-3 text-sm font-semibold text-blue-700 transition hover:bg-blue-50 disabled:opacity-50"
        >
          {isWorking
            ? "Sending..."
            : "Add Friend"}
        </button>
      )}

      {errorMessage && (
        <p className="mt-2 text-xs font-semibold text-red-700">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
