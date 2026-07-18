"use client";

import {
  FormEvent,
  useState,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { supabase } from "@/utils/supabase/client";

type PublicFamilySettingsData = {
  self: {
    user_id: string;
    full_name: string | null;
    username: string;
    age_state: string;
    can_invite_relationship: boolean;
  };

  managed_children: {
    guardian_link_id: string;
    child_user_id: string;
    full_name: string | null;
    username: string;
    avatar_url: string | null;
    relationship:
      | "parent"
      | "legal_guardian";
    guardian_role:
      | "primary_guardian"
      | "guardian";
    show_child_on_profile: boolean;
  }[];

  accepted_relationships: {
    relationship_id: string;
    relationship_type:
      | "spouse"
      | "partner";
    other_user_id: string;
    other_full_name: string | null;
    other_username: string;
    other_avatar_url: string | null;
    my_public: boolean;
    other_public: boolean;
    public_visible: boolean;
  }[];

  incoming_invitations: {
    relationship_id: string;
    relationship_type:
      | "spouse"
      | "partner";
    requester_user_id: string;
    requester_full_name: string | null;
    requester_username: string;
    requester_avatar_url: string | null;
    created_at: string;
  }[];

  outgoing_invitations: {
    relationship_id: string;
    relationship_type:
      | "spouse"
      | "partner";
    target_user_id: string;
    target_full_name: string | null;
    target_username: string;
    target_avatar_url: string | null;
    created_at: string;
  }[];
};

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

function Avatar({
  url,
  name,
}: {
  url: string | null;
  name: string;
}) {
  if (url) {
    return (
      <img
        src={url}
        alt={name}
        className="h-14 w-14 rounded-full object-cover"
      />
    );
  }

  return (
    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 text-lg font-bold text-gray-500">
      {getInitial(name)}
    </div>
  );
}

function ActionButton({
  label,
  workingLabel,
  onClick,
  tone = "default",
}: {
  label: string;
  workingLabel: string;
  onClick: () => Promise<void>;
  tone?:
    | "default"
    | "danger";
}) {
  const [
    isWorking,
    setIsWorking,
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  async function run() {
    setIsWorking(true);
    setErrorMessage("");

    try {
      await onClick();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "The action could not be completed."
      );
      setIsWorking(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        disabled={isWorking}
        onClick={run}
        className={`rounded-xl border px-4 py-2.5 text-sm font-semibold transition disabled:opacity-50 ${
          tone === "danger"
            ? "border-red-200 bg-white text-red-700 hover:bg-red-50"
            : "border-gray-200 bg-white text-gray-700 hover:border-green-300 hover:text-green-700"
        }`}
      >
        {isWorking
          ? workingLabel
          : label}
      </button>

      {errorMessage && (
        <p className="mt-2 max-w-xs text-xs font-semibold text-red-700">
          {errorMessage}
        </p>
      )}
    </div>
  );
}

export default function PublicFamilyManager({
  initialData,
}: {
  initialData: PublicFamilySettingsData;
}) {
  const router = useRouter();

  const [
    targetUsername,
    setTargetUsername,
  ] = useState("");

  const [
    relationshipType,
    setRelationshipType,
  ] = useState<
    "spouse" |
    "partner"
  >("spouse");

  const [
    isInviting,
    setIsInviting,
  ] = useState(false);

  const [
    inviteError,
    setInviteError,
  ] = useState("");

  const [
    inviteSuccess,
    setInviteSuccess,
  ] = useState("");

  async function refreshAction(
    action: () => Promise<{
      error: {
        message: string;
      } | null;
    }>
  ) {
    const {
      error,
    } = await action();

    if (error) {
      throw new Error(
        error.message
      );
    }

    router.refresh();
  }

  async function inviteRelationship(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setIsInviting(true);
    setInviteError("");
    setInviteSuccess("");

    try {
      const {
        error,
      } = await supabase.rpc(
        "invite_profile_relationship",
        {
          p_target_username:
            targetUsername.trim(),

          p_relationship_type:
            relationshipType,
        }
      );

      if (error) {
        throw error;
      }

      setTargetUsername("");

      setInviteSuccess(
        `${relationshipType === "spouse" ? "Spouse" : "Partner"} invitation sent.`
      );

      router.refresh();
    } catch (error) {
      setInviteError(
        error instanceof Error
          ? error.message
          : "Relationship invitation could not be sent."
      );
    } finally {
      setIsInviting(false);
    }
  }

  return (
    <section className="rounded-[32px] border border-amber-200 bg-white p-6 shadow-sm md:p-8">
      <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
        Public Family Display
      </p>

      <h2 className="mt-3 text-3xl font-bold text-gray-950">
        Family connections
      </h2>

      <p className="mt-3 max-w-3xl text-sm leading-7 text-gray-500">
        Child connections are controlled
        by each guardian. Spouse or partner
        relationships appear publicly only
        after both adults accept the
        relationship and enable public
        visibility.
      </p>

      {initialData.managed_children.length >
        0 && (
        <div className="mt-8">
          <p className="text-xs font-semibold uppercase tracking-wide text-green-700">
            Children
          </p>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            {initialData.managed_children.map(
              (child) => {
                const childName =
                  child.full_name ||
                  child.username;

                return (
                  <article
                    key={
                      child.guardian_link_id
                    }
                    className="rounded-3xl border border-green-200 bg-green-50/40 p-5"
                  >
                    <div className="flex items-start gap-4">
                      <Avatar
                        url={
                          child.avatar_url
                        }
                        name={
                          childName
                        }
                      />

                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/u/${encodeURIComponent(
                            child.username
                          )}`}
                          className="font-bold text-gray-950 transition hover:text-green-700"
                        >
                          {childName}
                        </Link>

                        <p className="mt-1 text-sm text-gray-500">
                          @
                          {
                            child.username
                          }
                        </p>

                        <p className="mt-3 text-sm leading-6 text-gray-600">
                          Managed Child
                          Profile
                        </p>

                        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-4">
                          <div>
                            <p className="text-sm font-semibold text-gray-950">
                              Show on my public profile
                            </p>

                            <p className="mt-1 text-xs leading-5 text-gray-500">
                              Only the safe
                              child profile
                              link is shown.
                            </p>
                          </div>

                          <ActionButton
                            label={
                              child.show_child_on_profile
                                ? "Visible"
                                : "Hidden"
                            }
                            workingLabel="Saving..."
                            onClick={() =>
                              refreshAction(
                                async () =>
                                  await supabase.rpc(
                                    "set_child_profile_visibility",
                                    {
                                      p_guardian_link_id:
                                        child.guardian_link_id,

                                      p_visible:
                                        !child.show_child_on_profile,
                                    }
                                  )
                              )
                            }
                          />
                        </div>
                      </div>
                    </div>
                  </article>
                );
              }
            )}
          </div>
        </div>
      )}

      {initialData.incoming_invitations.length >
        0 && (
        <div className="mt-8">
          <p className="text-xs font-semibold uppercase tracking-wide text-purple-700">
            Action Required
          </p>

          <h3 className="mt-2 text-xl font-bold text-gray-950">
            Relationship invitations
          </h3>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            {initialData.incoming_invitations.map(
              (invitation) => {
                const requesterName =
                  invitation.requester_full_name ||
                  invitation.requester_username;

                return (
                  <article
                    key={
                      invitation.relationship_id
                    }
                    className="rounded-3xl border border-purple-200 bg-purple-50/40 p-5"
                  >
                    <div className="flex items-start gap-4">
                      <Avatar
                        url={
                          invitation.requester_avatar_url
                        }
                        name={
                          requesterName
                        }
                      />

                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-gray-950">
                          {requesterName}
                        </p>

                        <p className="mt-1 text-sm text-gray-500">
                          @
                          {
                            invitation.requester_username
                          }
                        </p>

                        <p className="mt-3 text-sm text-gray-600">
                          Invited you as{" "}
                          <span className="font-semibold capitalize">
                            {
                              invitation.relationship_type
                            }
                          </span>
                          .
                        </p>

                        <div className="mt-4 flex flex-wrap gap-3">
                          <ActionButton
                            label="Decline"
                            workingLabel="Declining..."
                            tone="danger"
                            onClick={() =>
                              refreshAction(
                                async () =>
                                  await supabase.rpc(
                                    "respond_profile_relationship_invitation",
                                    {
                                      p_relationship_id:
                                        invitation.relationship_id,

                                      p_response:
                                        "decline",
                                    }
                                  )
                              )
                            }
                          />

                          <ActionButton
                            label="Accept"
                            workingLabel="Accepting..."
                            onClick={() =>
                              refreshAction(
                                async () =>
                                  await supabase.rpc(
                                    "respond_profile_relationship_invitation",
                                    {
                                      p_relationship_id:
                                        invitation.relationship_id,

                                      p_response:
                                        "accept",
                                    }
                                  )
                              )
                            }
                          />
                        </div>
                      </div>
                    </div>
                  </article>
                );
              }
            )}
          </div>
        </div>
      )}

      {initialData.accepted_relationships.length >
        0 && (
        <div className="mt-8">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
            Accepted Relationships
          </p>

          <div className="mt-4 space-y-4">
            {initialData.accepted_relationships.map(
              (relationship) => {
                const otherName =
                  relationship.other_full_name ||
                  relationship.other_username;

                return (
                  <article
                    key={
                      relationship.relationship_id
                    }
                    className="rounded-3xl border border-blue-200 bg-blue-50/30 p-5"
                  >
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                      <div className="flex items-center gap-4">
                        <Avatar
                          url={
                            relationship.other_avatar_url
                          }
                          name={
                            otherName
                          }
                        />

                        <div>
                          <Link
                            href={`/u/${encodeURIComponent(
                              relationship.other_username
                            )}`}
                            className="font-bold text-gray-950 transition hover:text-green-700"
                          >
                            {otherName}
                          </Link>

                          <p className="mt-1 text-sm text-gray-500">
                            @
                            {
                              relationship.other_username
                            }
                          </p>

                          <div className="mt-2 flex flex-wrap gap-2">
                            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold capitalize text-blue-700">
                              {
                                relationship.relationship_type
                              }
                            </span>

                            <span
                              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                relationship.public_visible
                                  ? "bg-green-50 text-green-700"
                                  : "bg-amber-50 text-amber-700"
                              }`}
                            >
                              {relationship.public_visible
                                ? "Visible on both profiles"
                                : relationship.my_public
                                  ? "Waiting for the other person"
                                  : "Private"}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-3">
                        <ActionButton
                          label={
                            relationship.my_public
                              ? "Public: On"
                              : "Public: Off"
                          }
                          workingLabel="Saving..."
                          onClick={() =>
                            refreshAction(
                              async () =>
                                await supabase.rpc(
                                  "set_profile_relationship_visibility",
                                  {
                                    p_relationship_id:
                                      relationship.relationship_id,

                                    p_visible:
                                      !relationship.my_public,
                                  }
                                )
                            )
                          }
                        />

                        <ActionButton
                          label="End Relationship"
                          workingLabel="Ending..."
                          tone="danger"
                          onClick={async () => {
                            const confirmed =
                              window.confirm(
                                "End this public family relationship?"
                              );

                            if (!confirmed) {
                              return;
                            }

                            await refreshAction(
                              async () =>
                                await supabase.rpc(
                                  "end_profile_relationship",
                                  {
                                    p_relationship_id:
                                      relationship.relationship_id,
                                  }
                                )
                            );
                          }}
                        />
                      </div>
                    </div>

                    <div className="mt-4 rounded-2xl bg-white p-4 text-sm leading-6 text-gray-600">
                      Your visibility:{" "}
                      <span className="font-semibold">
                        {relationship.my_public
                          ? "On"
                          : "Off"}
                      </span>
                      {" · "}
                      Other person:{" "}
                      <span className="font-semibold">
                        {relationship.other_public
                          ? "On"
                          : "Off"}
                      </span>
                    </div>
                  </article>
                );
              }
            )}
          </div>
        </div>
      )}

      {initialData.outgoing_invitations.length >
        0 && (
        <div className="mt-8">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
            Pending
          </p>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            {initialData.outgoing_invitations.map(
              (invitation) => {
                const targetName =
                  invitation.target_full_name ||
                  invitation.target_username;

                return (
                  <article
                    key={
                      invitation.relationship_id
                    }
                    className="rounded-3xl border border-gray-200 bg-gray-50 p-5"
                  >
                    <p className="font-bold text-gray-950">
                      {targetName}
                    </p>

                    <p className="mt-1 text-sm text-gray-500">
                      @
                      {
                        invitation.target_username
                      }
                    </p>

                    <p className="mt-3 text-sm capitalize text-gray-600">
                      {
                        invitation.relationship_type
                      }{" "}
                      invitation pending
                    </p>
                  </article>
                );
              }
            )}
          </div>
        </div>
      )}

      {initialData.self.can_invite_relationship ? (
        <form
          onSubmit={
            inviteRelationship
          }
          className="mt-8 rounded-3xl border border-amber-200 bg-amber-50 p-6"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
            Add Relationship
          </p>

          <h3 className="mt-2 text-xl font-bold text-amber-950">
            Invite a spouse or partner
          </h3>

          <p className="mt-3 text-sm leading-6 text-amber-900">
            The other adult must accept.
            The relationship remains
            private until both people
            enable public visibility.
          </p>

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_180px]">
            <input
              value={
                targetUsername
              }
              required
              disabled={
                isInviting
              }
              placeholder="Exact UIN username"
              onChange={(event) => {
                setTargetUsername(
                  event.target.value
                );
                setInviteError("");
                setInviteSuccess("");
              }}
              className="rounded-xl border border-amber-200 bg-white px-4 py-3 text-sm outline-none focus:border-amber-500"
            />

            <select
              value={
                relationshipType
              }
              disabled={
                isInviting
              }
              onChange={(event) =>
                setRelationshipType(
                  event.target.value as
                    | "spouse"
                    | "partner"
                )
              }
              className="rounded-xl border border-amber-200 bg-white px-4 py-3 text-sm outline-none focus:border-amber-500"
            >
              <option value="spouse">
                Spouse
              </option>

              <option value="partner">
                Partner
              </option>
            </select>
          </div>

          {inviteError && (
            <p className="mt-3 text-sm font-semibold text-red-700">
              {inviteError}
            </p>
          )}

          {inviteSuccess && (
            <p className="mt-3 text-sm font-semibold text-green-700">
              {inviteSuccess}
            </p>
          )}

          <button
            type="submit"
            disabled={
              isInviting ||
              !targetUsername.trim()
            }
            className="mt-4 w-full rounded-xl bg-amber-600 px-5 py-3 font-semibold text-white transition hover:bg-amber-700 disabled:opacity-50"
          >
            {isInviting
              ? "Sending..."
              : "Send Relationship Invitation"}
          </button>
        </form>
      ) : (
        <div className="mt-8 rounded-3xl border border-gray-200 bg-gray-50 p-6">
          <h3 className="font-bold text-gray-950">
            Adult age verification required
          </h3>

          <p className="mt-2 text-sm leading-6 text-gray-600">
            Record an adult date of birth
            above before creating spouse or
            partner relationships.
          </p>
        </div>
      )}
    </section>
  );
}

export type {
  PublicFamilySettingsData,
};
