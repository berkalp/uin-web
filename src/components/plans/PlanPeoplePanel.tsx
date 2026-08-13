"use client";

import {
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";

import IntentInvitePeopleButton from "../intents/IntentInvitePeopleButton";
import ProfileNameLink from "../profile/ProfileNameLink";
import PlanMemberManagementControls from "./PlanMemberManagementControls";
import { supabase } from "../../utils/supabase/client";

type PlanStatus =
  | "forming"
  | "planned"
  | "completed"
  | "cancelled";

type RoomPhase =
  | "planning"
  | "activity";

type RecruitmentStatus =
  | "open"
  | "full"
  | "closed";

type MemberRole =
  | "host"
  | "co_host"
  | "participant";

type AttendanceStatus =
  | "pending"
  | "attended"
  | "no_show"
  | "cancelled";

type InvitationStatus =
  | "pending"
  | "accepted"
  | "declined"
  | "revoked"
  | "expired";

export type PlanPeopleMember = {
  id: string;
  userId: string;
  fullName: string | null;
  username: string | null;
  avatarUrl: string | null;
  role: MemberRole;
  budgetCommitment: number;
  attendanceStatus: AttendanceStatus;
};

export type PlanPeopleInvitation = {
  invitationId: string;
  intentId: string;
  invitedUserId: string;
  invitedUserFullName: string | null;
  invitedUserUsername: string | null;
  invitedUserAvatarUrl: string | null;
  invitedByUserId: string;
  invitedByFullName: string | null;
  invitedByUsername: string | null;
  status: InvitationStatus;
  message: string | null;
  expiresAt: string;
  respondedAt: string | null;
  createdAt: string;
};

type PlanPeoplePanelProps = {
  planId: string;
  planStatus: PlanStatus;
  roomPhase: RoomPhase;
  recruitmentStatus: RecruitmentStatus;
  visibility:
    | "public"
    | "friends"
    | "except_friends"
    | "invite_only"
    | "private";
  actorUserId: string;
  actorRole:
    | "host"
    | "co_host"
    | "participant";
  sourceIntentId: string | null;
  activityLabel: string;
  members: PlanPeopleMember[];
  invitations: PlanPeopleInvitation[];
};

type PeopleTab =
  | "members"
  | "invitations";

function getInitial(
  value: string
) {
  return (
    value
      .trim()
      .charAt(0)
      .toUpperCase() || "?"
  );
}

function getRoleLabel(
  role: MemberRole
) {
  if (role === "host") {
    return "Primary Host";
  }

  if (role === "co_host") {
    return "Co-host";
  }

  return "Participant";
}

function getRoleClasses(
  role: MemberRole
) {
  if (role === "host") {
    return "border-gray-900 bg-gray-900 text-white";
  }

  if (role === "co_host") {
    return "border-purple-200 bg-purple-50 text-purple-700";
  }

  return "border-blue-200 bg-blue-50 text-blue-700";
}

function getAttendanceLabel(
  status: AttendanceStatus
) {
  if (status === "attended") {
    return "Attended";
  }

  if (status === "no_show") {
    return "Did not attend";
  }

  return "Not recorded";
}

function getAttendanceClasses(
  status: AttendanceStatus
) {
  if (status === "attended") {
    return "text-green-700";
  }

  if (status === "no_show") {
    return "text-red-700";
  }

  return "text-gray-500";
}

function getInvitationStatusLabel(
  status: InvitationStatus
) {
  if (status === "accepted") {
    return "Joined";
  }

  if (status === "declined") {
    return "Declined";
  }

  if (status === "revoked") {
    return "Revoked";
  }

  if (status === "expired") {
    return "Expired";
  }

  return "Pending";
}

function getInvitationStatusClasses(
  status: InvitationStatus
) {
  if (status === "accepted") {
    return "border-green-200 bg-green-50 text-green-700";
  }

  if (status === "pending") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  if (status === "declined") {
    return "border-red-200 bg-red-50 text-red-700";
  }

  return "border-gray-200 bg-gray-100 text-gray-600";
}

function formatDateTime(
  value: string
) {
  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "Not available";
  }

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }
  ).format(date);
}

function PersonAvatar({
  src,
  name,
  className,
}: {
  src: string | null;
  name: string;
  className: string;
}) {
  const [
    failed,
    setFailed,
  ] = useState(false);

  if (
    src &&
    !failed
  ) {
    return (
      <img
        src={src}
        alt={name}
        onError={() =>
          setFailed(true)
        }
        className={className}
      />
    );
  }

  return (
    <div
      className={`${className} flex items-center justify-center bg-white font-bold text-gray-500`}
    >
      {getInitial(name)}
    </div>
  );
}

export default function PlanPeoplePanel({
  planId,
  planStatus,
  roomPhase,
  recruitmentStatus,
  visibility,
  actorUserId,
  actorRole,
  sourceIntentId,
  activityLabel,
  members,
  invitations,
}: PlanPeoplePanelProps) {
  const router = useRouter();

  const [
    selectedTab,
    setSelectedTab,
  ] = useState<PeopleTab>(
    "members"
  );

  const [
    revokingInvitationId,
    setRevokingInvitationId,
  ] = useState<
    string | null
  >(null);

  const [
    revokeError,
    setRevokeError,
  ] = useState("");

  const sortedInvitations =
    useMemo(
      () =>
        [...invitations].sort(
          (
            first,
            second
          ) => {
            if (
              first.status ===
                "pending" &&
              second.status !==
                "pending"
            ) {
              return -1;
            }

            if (
              first.status !==
                "pending" &&
              second.status ===
                "pending"
            ) {
              return 1;
            }

            return (
              new Date(
                second.createdAt
              ).getTime() -
              new Date(
                first.createdAt
              ).getTime()
            );
          }
        ),
      [invitations]
    );

  const pendingInvitationCount =
    invitations.filter(
      (invitation) =>
        invitation.status ===
        "pending"
    ).length;

  const canInvite =
    (
      (
        roomPhase ===
          "planning" &&
        planStatus ===
          "forming"
      ) ||
      (
        roomPhase ===
          "activity" &&
        planStatus ===
          "planned"
      )
    ) &&
    recruitmentStatus ===
      "open" &&
    visibility !==
      "private" &&
    sourceIntentId !==
      null &&
    (
      actorRole ===
        "host" ||
      actorRole ===
        "co_host"
    );

  async function revokeInvitation(
    invitation: PlanPeopleInvitation
  ) {
    const invitedName =
      invitation.invitedUserFullName ||
      invitation.invitedUserUsername ||
      "this person";

    const confirmed =
      window.confirm(
        `Revoke the invitation sent to ${invitedName}?`
      );

    if (!confirmed) {
      return;
    }

    setRevokingInvitationId(
      invitation.invitationId
    );
    setRevokeError("");

    try {
      const {
        error,
      } = await supabase.rpc(
        "revoke_intent_invitation",
        {
          p_invitation_id:
            invitation.invitationId,
        }
      );

      if (error) {
        throw error;
      }

      router.refresh();
    } catch (error) {
      setRevokeError(
        error instanceof Error
          ? error.message
          : "The invitation could not be revoked."
      );
    } finally {
      setRevokingInvitationId(
        null
      );
    }
  }

  return (
    <aside className="h-fit overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-green-700">
              People
            </p>

            <h2 className="mt-2 text-xl font-bold text-gray-950">
              Team & Invitations
            </h2>

            <p className="mt-2 text-sm leading-6 text-gray-500">
              Active members and direct
              invitations for this Shared
              Plan.
            </p>
          </div>

          {canInvite &&
            sourceIntentId && (
            <IntentInvitePeopleButton
              intentId={
                sourceIntentId
              }
              activityLabel={
                activityLabel
              }
              compact
            />
          )}
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2 rounded-2xl bg-gray-100 p-1.5">
          <button
            type="button"
            onClick={() =>
              setSelectedTab(
                "members"
              )
            }
            className={`rounded-xl px-3 py-3 text-sm font-semibold transition ${
              selectedTab ===
              "members"
                ? "bg-white text-gray-950 shadow-sm"
                : "text-gray-500 hover:text-gray-800"
            }`}
          >
            Members
            <span className="ml-2 rounded-full bg-gray-200 px-2 py-0.5 text-xs">
              {members.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() =>
              setSelectedTab(
                "invitations"
              )
            }
            className={`rounded-xl px-3 py-3 text-sm font-semibold transition ${
              selectedTab ===
              "invitations"
                ? "bg-white text-gray-950 shadow-sm"
                : "text-gray-500 hover:text-gray-800"
            }`}
          >
            Invited
            <span
              className={`ml-2 rounded-full px-2 py-0.5 text-xs ${
                pendingInvitationCount >
                0
                  ? "bg-amber-100 text-amber-700"
                  : "bg-gray-200 text-gray-600"
              }`}
            >
              {
                pendingInvitationCount
              }
            </span>
          </button>
        </div>
      </div>

      {selectedTab ===
        "members" && (
        <div className="max-h-[680px] space-y-3 overflow-y-auto p-4">
          {members.map(
            (member) => {
              const displayName =
                member.fullName ||
                member.username ||
                "UIN member";

              return (
                <article
                  key={
                    member.id
                  }
                  className="rounded-2xl border border-gray-200 bg-gray-50 p-4"
                >
                  <div className="flex items-start gap-3">
                    <ProfileNameLink
                      username={
                        member.username
                      }
                      title={`View ${displayName}'s profile`}
                      className="shrink-0"
                    >
                      <PersonAvatar
                        src={
                          member.avatarUrl
                        }
                        name={
                          displayName
                        }
                        className="h-12 w-12 rounded-full object-cover ring-2 ring-white"
                      />
                    </ProfileNameLink>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <ProfileNameLink
                            username={
                              member.username
                            }
                            className="block truncate font-bold text-gray-950 transition hover:text-green-700 hover:underline"
                          >
                            {
                              displayName
                            }

                            {member.userId ===
                              actorUserId && (
                              <span className="ml-1 text-xs font-normal text-gray-400">
                                You
                              </span>
                            )}
                          </ProfileNameLink>

                          {member.username && (
                            <p className="mt-1 truncate text-xs text-gray-500">
                              @
                              {
                                member.username
                              }
                            </p>
                          )}
                        </div>

                        <span
                          className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getRoleClasses(
                            member.role
                          )}`}
                        >
                          {getRoleLabel(
                            member.role
                          )}
                        </span>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                          {member.budgetCommitment.toLocaleString(
                            "en-US"
                          )}{" "}
                          TL committed
                        </span>

                        {roomPhase ===
                          "activity" && (
                          <span
                            className={`rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold ${getAttendanceClasses(
                              member.attendanceStatus
                            )}`}
                          >
                            {getAttendanceLabel(
                              member.attendanceStatus
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <PlanMemberManagementControls
                    planId={
                      planId
                    }
                    planStatus={
                      planStatus
                    }
                    actorUserId={
                      actorUserId
                    }
                    actorRole={
                      actorRole
                    }
                    memberUserId={
                      member.userId
                    }
                    memberName={
                      displayName
                    }
                    memberRole={
                      member.role
                    }
                  />
                </article>
              );
            }
          )}
        </div>
      )}

      {selectedTab ===
        "invitations" && (
        <div className="max-h-[680px] space-y-3 overflow-y-auto p-4">
          {sortedInvitations.length ===
          0 ? (
            <div className="rounded-2xl bg-gray-50 p-6 text-center">
              <p className="font-semibold text-gray-800">
                No direct invitations yet
              </p>

              <p className="mt-2 text-sm leading-6 text-gray-500">
                Invited users and their
                responses will appear
                here.
              </p>
            </div>
          ) : (
            sortedInvitations.map(
              (invitation) => {
                const invitedName =
                  invitation.invitedUserFullName ||
                  invitation.invitedUserUsername ||
                  "Invited UIN member";

                const inviterName =
                  invitation.invitedByFullName ||
                  invitation.invitedByUsername ||
                  "Plan manager";

                return (
                  <article
                    key={
                      invitation.invitationId
                    }
                    className="rounded-2xl border border-gray-200 bg-gray-50 p-4"
                  >
                    <div className="flex items-start gap-3">
                      <PersonAvatar
                        src={
                          invitation.invitedUserAvatarUrl
                        }
                        name={
                          invitedName
                        }
                        className="h-12 w-12 shrink-0 rounded-full object-cover ring-2 ring-white"
                      />

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate font-bold text-gray-950">
                              {
                                invitedName
                              }
                            </p>

                            {invitation.invitedUserUsername && (
                              <p className="mt-1 truncate text-xs text-gray-500">
                                @
                                {
                                  invitation.invitedUserUsername
                                }
                              </p>
                            )}
                          </div>

                          <span
                            className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getInvitationStatusClasses(
                              invitation.status
                            )}`}
                          >
                            {getInvitationStatusLabel(
                              invitation.status
                            )}
                          </span>
                        </div>

                        <p className="mt-3 text-xs leading-5 text-gray-500">
                          Invited by{" "}
                          <span className="font-semibold text-gray-700">
                            {
                              inviterName
                            }
                          </span>
                          {" · "}
                          {formatDateTime(
                            invitation.createdAt
                          )}
                        </p>

                        {invitation.status ===
                          "pending" && (
                          <p className="mt-1 text-xs leading-5 text-amber-700">
                            Expires{" "}
                            {formatDateTime(
                              invitation.expiresAt
                            )}
                          </p>
                        )}

                        {invitation.message && (
                          <p className="mt-3 rounded-xl bg-white p-3 text-xs leading-5 text-gray-600">
                            {
                              invitation.message
                            }
                          </p>
                        )}
                      </div>
                    </div>

                    {invitation.status ===
                      "pending" &&
                      (
                        actorRole ===
                          "host" ||
                        actorRole ===
                          "co_host"
                      ) && (
                      <button
                        type="button"
                        disabled={
                          revokingInvitationId ===
                          invitation.invitationId
                        }
                        onClick={() =>
                          revokeInvitation(
                            invitation
                          )
                        }
                        className="mt-4 w-full rounded-xl border border-red-200 bg-white px-4 py-2.5 text-xs font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {revokingInvitationId ===
                        invitation.invitationId
                          ? "Revoking..."
                          : "Revoke Invitation"}
                      </button>
                    )}
                  </article>
                );
              }
            )
          )}

          {revokeError && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4">
              <p className="text-sm font-semibold text-red-800">
                {revokeError}
              </p>
            </div>
          )}

          {pendingInvitationCount >
            0 && (
            <p className="px-2 pb-2 text-xs leading-5 text-gray-400">
              Pending invitations do not
              reserve participant capacity.
              Capacity is checked again
              when an invitation is
              accepted.
            </p>
          )}
        </div>
      )}
    </aside>
  );
}
