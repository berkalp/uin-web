"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";

import { supabase } from "@/utils/supabase/client";

type IntentInvitePeopleButtonProps = {
  intentId: string;
  activityLabel: string;
  compact?: boolean;
};

type InvitableFriendRow = {
  user_id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  city: string | null;
  country: string | null;
  invitation_status: string | null;
};

function getErrorMessage(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  return "The Intent invitation could not be sent.";
}

function getInitial(value: string) {
  return value.trim().charAt(0).toUpperCase() || "?";
}

function isUnavailableInvitationStatus(status: string | null) {
  return status === "pending" || status === "accepted";
}

function getInvitationStatusLabel(status: string | null) {
  if (status === "pending") {
    return "Invitation pending";
  }

  if (status === "accepted") {
    return "Already participating";
  }

  return null;
}

export default function IntentInvitePeopleButton({
  intentId,
  activityLabel,
  compact = false,
}: IntentInvitePeopleButtonProps) {
  const router = useRouter();

  const [isOpen, setIsOpen] = useState(false);
  const [friends, setFriends] = useState<InvitableFriendRow[]>([]);
  const [selectedFriendId, setSelectedFriendId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [message, setMessage] = useState("");
  const [isLoadingFriends, setIsLoadingFriends] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const selectedFriend = useMemo(
    () => friends.find((friend) => friend.user_id === selectedFriendId) ?? null,
    [friends, selectedFriendId]
  );

  const filteredFriends = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLocaleLowerCase();

    if (!normalizedQuery) {
      return friends;
    }

    return friends.filter((friend) => {
      const haystack = [
        friend.full_name,
        friend.username,
        friend.city,
        friend.country,
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase();

      return haystack.includes(normalizedQuery);
    });
  }, [friends, searchQuery]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isSending) {
        setIsOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, isSending]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    let isCancelled = false;

    async function loadFriends() {
      setIsLoadingFriends(true);
      setErrorMessage("");

      try {
        const { data, error } = await supabase.rpc(
          "get_invitable_friends_for_intent",
          {
            p_intent_id: intentId,
            p_query: null,
          }
        );

        if (error) {
          throw error;
        }

        if (!isCancelled) {
          setFriends((data ?? []) as InvitableFriendRow[]);
        }
      } catch (error) {
        if (!isCancelled) {
          setFriends([]);
          setErrorMessage(getErrorMessage(error));
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingFriends(false);
        }
      }
    }

    void loadFriends();

    return () => {
      isCancelled = true;
    };
  }, [intentId, isOpen]);

  function resetModalState() {
    setSelectedFriendId("");
    setSearchQuery("");
    setMessage("");
    setErrorMessage("");
    setSuccessMessage("");
  }

  function closeModal() {
    if (isSending) {
      return;
    }

    setIsOpen(false);
    resetModalState();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedFriend) {
      setErrorMessage("Select one of your accepted friends.");
      return;
    }

    if (isUnavailableInvitationStatus(selectedFriend.invitation_status)) {
      setErrorMessage("This friend already has an active invitation or participation.");
      return;
    }

    setIsSending(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const { error } = await supabase.rpc(
        "create_friend_intent_invitation",
        {
          p_intent_id: intentId,
          p_invited_user_id: selectedFriend.user_id,
          p_message: message.trim() || null,
        }
      );

      if (error) {
        throw error;
      }

      const displayName =
        selectedFriend.full_name ||
        (selectedFriend.username ? `@${selectedFriend.username}` : "your friend");

      setFriends((currentFriends) =>
        currentFriends.map((friend) =>
          friend.user_id === selectedFriend.user_id
            ? {
                ...friend,
                invitation_status: "pending",
              }
            : friend
        )
      );
      setSelectedFriendId("");
      setMessage("");
      setSuccessMessage(`Invitation sent to ${displayName}.`);
      router.refresh();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSending(false);
    }
  }

  const modal =
    isOpen && typeof document !== "undefined"
      ? createPortal(
          <div
            className="fixed inset-0 z-[1000] flex items-center justify-center overflow-y-auto bg-gray-950/65 px-4 py-8 backdrop-blur-[2px]"
            role="dialog"
            aria-modal="true"
            aria-labelledby={`intent-invite-title-${intentId}`}
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                closeModal();
              }
            }}
          >
            <div
              className="my-auto w-full max-w-xl rounded-3xl bg-white p-6 shadow-2xl md:p-7"
              onMouseDown={(event) => event.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-purple-700">
                    Intent Invitation
                  </p>

                  <h2
                    id={`intent-invite-title-${intentId}`}
                    className="mt-2 text-2xl font-bold text-gray-950"
                  >
                    Invite a friend to join
                  </h2>

                  <p className="mt-2 text-sm leading-6 text-gray-500">
                    Invitations can only be sent to accepted friends.
                  </p>
                </div>

                <button
                  type="button"
                  disabled={isSending}
                  onClick={closeModal}
                  className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-600 transition hover:bg-gray-50 disabled:opacity-50"
                >
                  Close
                </button>
              </div>

              <div className="mt-5 rounded-2xl border border-purple-100 bg-purple-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-purple-700">
                  Activity
                </p>

                <p className="mt-2 font-bold text-purple-950">{activityLabel}</p>

                <p className="mt-2 text-sm leading-6 text-purple-700">
                  The invited friend joins as a Participant after accepting. A
                  Shared Plan is created automatically when needed.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <div>
                  <div className="flex items-end justify-between gap-3">
                    <label
                      htmlFor={`friend-search-${intentId}`}
                      className="text-sm font-semibold text-gray-700"
                    >
                      Choose a friend
                    </label>

                    <a
                      href="/friends"
                      className="text-xs font-semibold text-purple-700 underline-offset-4 hover:underline"
                    >
                      Manage friends
                    </a>
                  </div>

                  <input
                    id={`friend-search-${intentId}`}
                    type="search"
                    value={searchQuery}
                    disabled={isSending || isLoadingFriends}
                    placeholder="Search by name or username"
                    onChange={(event) => {
                      setSearchQuery(event.target.value);
                      setErrorMessage("");
                      setSuccessMessage("");
                    }}
                    className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-purple-500 focus:ring-2 focus:ring-purple-100 disabled:bg-gray-100"
                  />

                  <div className="mt-3 max-h-64 space-y-2 overflow-y-auto rounded-2xl border border-gray-200 bg-gray-50 p-2">
                    {isLoadingFriends ? (
                      <div className="px-4 py-8 text-center text-sm text-gray-500">
                        Loading friends...
                      </div>
                    ) : filteredFriends.length === 0 ? (
                      <div className="px-4 py-8 text-center">
                        <p className="text-sm font-semibold text-gray-700">
                          {friends.length === 0
                            ? "No eligible friends are available."
                            : "No friends match this search."}
                        </p>

                        {friends.length === 0 && (
                          <p className="mt-2 text-xs leading-5 text-gray-500">
                            Friends who do not meet this Intent&apos;s participant
                            eligibility rule are not shown.
                          </p>
                        )}
                      </div>
                    ) : (
                      filteredFriends.map((friend) => {
                        const name =
                          friend.full_name || friend.username || "UIN member";
                        const location = [friend.city, friend.country]
                          .filter(Boolean)
                          .join(", ");
                        const statusLabel = getInvitationStatusLabel(
                          friend.invitation_status
                        );
                        const isUnavailable = isUnavailableInvitationStatus(
                          friend.invitation_status
                        );
                        const isSelected = selectedFriendId === friend.user_id;

                        return (
                          <button
                            key={friend.user_id}
                            type="button"
                            disabled={isSending || isUnavailable}
                            onClick={() => {
                              setSelectedFriendId(friend.user_id);
                              setErrorMessage("");
                              setSuccessMessage("");
                            }}
                            className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${
                              isSelected
                                ? "border-purple-500 bg-purple-50 ring-2 ring-purple-100"
                                : "border-transparent bg-white hover:border-purple-200"
                            }`}
                          >
                            {friend.avatar_url ? (
                              <img
                                src={friend.avatar_url}
                                alt={name}
                                className="h-11 w-11 shrink-0 rounded-full object-cover"
                              />
                            ) : (
                              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gray-100 text-sm font-bold text-gray-500">
                                {getInitial(name)}
                              </div>
                            )}

                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="truncate text-sm font-bold text-gray-950">
                                  {name}
                                </p>

                                {isSelected && !isUnavailable && (
                                  <span className="rounded-full bg-purple-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                                    Selected
                                  </span>
                                )}
                              </div>

                              <p className="mt-0.5 truncate text-xs text-gray-500">
                                {friend.username ? `@${friend.username}` : "No username"}
                                {location ? ` · ${location}` : ""}
                              </p>

                              {statusLabel && (
                                <p className="mt-1 text-xs font-semibold text-amber-700">
                                  {statusLabel}
                                </p>
                              )}
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>

                <label className="block">
                  <span className="text-sm font-semibold text-gray-700">
                    Invitation message
                  </span>

                  <textarea
                    value={message}
                    disabled={isSending}
                    maxLength={500}
                    rows={4}
                    placeholder="Optional"
                    onChange={(event) => {
                      setMessage(event.target.value);
                      setErrorMessage("");
                      setSuccessMessage("");
                    }}
                    className="mt-2 w-full resize-y rounded-xl border border-gray-200 px-4 py-3 text-sm leading-6 outline-none transition focus:border-purple-500 focus:ring-2 focus:ring-purple-100 disabled:bg-gray-100"
                  />

                  <p className="mt-2 text-right text-xs text-gray-400">
                    {message.length}/500
                  </p>
                </label>

                {errorMessage && (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                    <p className="text-sm font-semibold text-red-800">
                      {errorMessage}
                    </p>
                  </div>
                )}

                {successMessage && (
                  <div className="rounded-xl border border-green-200 bg-green-50 p-4">
                    <p className="text-sm font-semibold text-green-800">
                      {successMessage}
                    </p>

                    <a
                      href="/intent-invitations?view=sent"
                      className="mt-2 inline-flex text-sm font-semibold text-green-700 underline"
                    >
                      View sent invitations
                    </a>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={
                    isSending ||
                    isLoadingFriends ||
                    !selectedFriend ||
                    isUnavailableInvitationStatus(
                      selectedFriend?.invitation_status ?? null
                    )
                  }
                  className="w-full rounded-xl bg-purple-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSending ? "Sending Invitation..." : "Send Invitation"}
                </button>
              </form>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          resetModalState();
          setIsOpen(true);
        }}
        className={
          compact
            ? "inline-flex h-7 w-full items-center justify-center rounded-md border border-purple-200 bg-purple-50 px-2 text-[9.5px] font-semibold leading-none text-purple-700 transition hover:bg-purple-100"
            : "rounded-xl bg-purple-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-purple-700"
        }
      >
        Invite Friends
      </button>

      {modal}
    </>
  );
}
