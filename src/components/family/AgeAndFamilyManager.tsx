"use client";

import {
  FormEvent,
  useState,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { supabase } from "@/utils/supabase/client";

type AgeState =
  | "age_unverified"
  | "adult"
  | "managed_minor"
  | "transition_pending";

type FamilySelf = {
  user_id: string;
  full_name: string | null;
  username: string;
  avatar_url: string | null;
  has_date_of_birth: boolean;
  date_of_birth: string | null;
  age_state: AgeState;
  is_managed_minor: boolean;
  can_complete_adult_transition: boolean;
  can_bootstrap_guardian: boolean;
};

type GuardianRow = {
  guardian_link_id: string;
  guardian_user_id: string;
  full_name: string | null;
  username: string;
  avatar_url: string | null;
  relationship:
    | "parent"
    | "legal_guardian";
  guardian_role:
    | "primary_guardian"
    | "guardian";
  status:
    | "pending"
    | "accepted";
  can_manage_profile: boolean;
  can_manage_activities: boolean;
  can_manage_guardians: boolean;
};

type ManagedChildRow = {
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
  can_manage_profile: boolean;
  can_manage_activities: boolean;
  can_manage_guardians: boolean;
};

type IncomingInvitation = {
  guardian_link_id: string;
  child_user_id: string;
  child_full_name: string | null;
  child_username: string;
  child_avatar_url: string | null;
  relationship:
    | "parent"
    | "legal_guardian";
  guardian_role:
    | "primary_guardian"
    | "guardian";
  invited_by_full_name: string | null;
  invited_by_username: string | null;
  created_at: string;
};

type OutgoingInvitation = {
  guardian_link_id: string;
  child_user_id: string;
  child_full_name: string | null;
  child_username: string;
  guardian_user_id: string;
  guardian_full_name: string | null;
  guardian_username: string;
  relationship:
    | "parent"
    | "legal_guardian";
  guardian_role:
    | "primary_guardian"
    | "guardian";
  created_at: string;
};

export type FamilyCenterData = {
  self: FamilySelf;
  guardians: GuardianRow[];
  managed_children: ManagedChildRow[];
  incoming_invitations: IncomingInvitation[];
  outgoing_invitations: OutgoingInvitation[];
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

function PersonAvatar({
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

function InviteGuardianForm({
  childUserId,
  primaryBootstrap = false,
}: {
  childUserId: string;
  primaryBootstrap?: boolean;
}) {
  const router = useRouter();

  const [
    username,
    setUsername,
  ] = useState("");

  const [
    relationship,
    setRelationship,
  ] = useState<
    "parent" |
    "legal_guardian"
  >("parent");

  const [
    isWorking,
    setIsWorking,
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const [
    successMessage,
    setSuccessMessage,
  ] = useState("");

  async function submit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setIsWorking(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const {
        error,
      } = await supabase.rpc(
        "invite_profile_guardian",
        {
          p_child_user_id:
            childUserId,

          p_guardian_username:
            username.trim(),

          p_relationship:
            relationship,

          p_guardian_role:
            primaryBootstrap
              ? "primary_guardian"
              : "guardian",
        }
      );

      if (error) {
        throw error;
      }

      setUsername("");

      setSuccessMessage(
        primaryBootstrap
          ? "Primary Guardian invitation sent."
          : "Guardian invitation sent."
      );

      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Guardian invitation could not be sent."
      );
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-2xl border border-blue-200 bg-blue-50 p-5"
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
        {primaryBootstrap
          ? "Primary Guardian"
          : "Add Guardian"}
      </p>

      <p className="mt-2 text-sm leading-6 text-blue-900">
        Enter the exact UIN username.
        The adult must record a date of
        birth proving they are at least
        18 before accepting.
      </p>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_180px]">
        <input
          value={username}
          required
          disabled={isWorking}
          placeholder="UIN username"
          onChange={(event) => {
            setUsername(
              event.target.value
            );
            setErrorMessage("");
            setSuccessMessage("");
          }}
          className="rounded-xl border border-blue-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-500"
        />

        <select
          value={relationship}
          disabled={isWorking}
          onChange={(event) =>
            setRelationship(
              event.target.value as
                | "parent"
                | "legal_guardian"
            )
          }
          className="rounded-xl border border-blue-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-500"
        >
          <option value="parent">
            Parent
          </option>

          <option value="legal_guardian">
            Legal Guardian
          </option>
        </select>
      </div>

      {errorMessage && (
        <p className="mt-3 text-sm font-semibold text-red-700">
          {errorMessage}
        </p>
      )}

      {successMessage && (
        <p className="mt-3 text-sm font-semibold text-green-700">
          {successMessage}
        </p>
      )}

      <button
        type="submit"
        disabled={
          isWorking ||
          !username.trim()
        }
        className="mt-4 w-full rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
      >
        {isWorking
          ? "Sending..."
          : "Send Guardian Invitation"}
      </button>
    </form>
  );
}

function GuardianInvitationActions({
  linkId,
}: {
  linkId: string;
}) {
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
        "respond_profile_guardian_invitation",
        {
          p_guardian_link_id:
            linkId,

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
          : "Guardian invitation could not be updated."
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
          className="rounded-xl bg-green-600 px-4 py-3 text-sm font-semibold text-white"
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

function RevokeGuardianButton({
  linkId,
}: {
  linkId: string;
}) {
  const router = useRouter();

  const [
    isWorking,
    setIsWorking,
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  async function revoke() {
    const confirmed =
      window.confirm(
        "Revoke this guardian relationship?"
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
        "revoke_profile_guardian",
        {
          p_guardian_link_id:
            linkId,
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
          : "Guardian relationship could not be revoked."
      );
      setIsWorking(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        disabled={isWorking}
        onClick={revoke}
        className="rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-50"
      >
        {isWorking
          ? "Revoking..."
          : "Revoke"}
      </button>

      {errorMessage && (
        <p className="mt-2 text-xs font-semibold text-red-700">
          {errorMessage}
        </p>
      )}
    </div>
  );
}

export default function AgeAndFamilyManager({
  initialData,
}: {
  initialData: FamilyCenterData;
}) {
  const router = useRouter();

  const [
    dateOfBirth,
    setDateOfBirth,
  ] = useState("");

  const [
    isWorking,
    setIsWorking,
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const [
    successMessage,
    setSuccessMessage,
  ] = useState("");

  const self =
    initialData.self;

  async function saveDateOfBirth(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setIsWorking(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const {
        data,
        error,
      } = await supabase.rpc(
        "set_my_date_of_birth",
        {
          p_date_of_birth:
            dateOfBirth,
        }
      );

      if (error) {
        throw error;
      }

      setSuccessMessage(
        data === "managed_minor"
          ? "Date of birth recorded. This profile is now a Managed Child Profile."
          : "Date of birth recorded. Adult status verified."
      );

      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Date of birth could not be recorded."
      );
    } finally {
      setIsWorking(false);
    }
  }

  async function completeTransition() {
    const confirmed =
      window.confirm(
        "Convert this managed profile into an adult account? Guardian control will end."
      );

    if (!confirmed) {
      return;
    }

    setIsWorking(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const {
        error,
      } = await supabase.rpc(
        "complete_adult_transition"
      );

      if (error) {
        throw error;
      }

      setSuccessMessage(
        "Adult account transition completed."
      );

      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Adult transition could not be completed."
      );
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <div className="space-y-8">
      <section className="rounded-[32px] border border-gray-200 bg-white p-6 shadow-sm md:p-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-green-700">
          Age Classification
        </p>

        <h1 className="mt-3 text-3xl font-bold text-gray-950">
          Age & Family Safety
        </h1>

        <p className="mt-3 max-w-3xl text-sm leading-7 text-gray-500">
          Date of birth is private and is
          used only to apply the correct
          account protections. It is never
          returned by public profile
          functions.
        </p>

        {!self.has_date_of_birth ? (
          <form
            onSubmit={
              saveDateOfBirth
            }
            className="mt-6 rounded-3xl border border-amber-200 bg-amber-50 p-6"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
              Required Setup
            </p>

            <h2 className="mt-2 text-xl font-bold text-amber-950">
              Record your date of birth
            </h2>

            <p className="mt-3 text-sm leading-6 text-amber-900">
              This value can be recorded
              once. Corrections require
              support review because age
              controls cannot be casually
              switched on and off.
            </p>

            <input
              type="date"
              value={dateOfBirth}
              required
              disabled={isWorking}
              max={
                new Date()
                  .toISOString()
                  .slice(0, 10)
              }
              min="1900-01-01"
              onChange={(event) => {
                setDateOfBirth(
                  event.target.value
                );
                setErrorMessage("");
                setSuccessMessage("");
              }}
              className="mt-5 w-full rounded-xl border border-amber-200 bg-white px-4 py-3 outline-none focus:border-amber-500"
            />

            <button
              type="submit"
              disabled={
                isWorking ||
                !dateOfBirth
              }
              className="mt-4 w-full rounded-xl bg-gray-950 px-5 py-3 font-semibold text-white disabled:opacity-50"
            >
              {isWorking
                ? "Recording..."
                : "Record Date of Birth"}
            </button>
          </form>
        ) : (
          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-2xl bg-gray-50 p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                Date of Birth
              </p>

              <p className="mt-3 font-bold text-gray-950">
                {
                  self.date_of_birth
                }
              </p>

              <p className="mt-2 text-xs text-gray-500">
                Private
              </p>
            </div>

            <div className="rounded-2xl bg-gray-50 p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                Account State
              </p>

              <p className="mt-3 font-bold capitalize text-gray-950">
                {self.age_state.replaceAll(
                  "_",
                  " "
                )}
              </p>
            </div>

            <div className="rounded-2xl bg-gray-50 p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                Age Boundary
              </p>

              <p className="mt-3 font-bold text-gray-950">
                18 years
              </p>
            </div>
          </div>
        )}

        {self.can_complete_adult_transition && (
          <div className="mt-6 rounded-3xl border border-blue-200 bg-blue-50 p-6">
            <h2 className="text-xl font-bold text-blue-950">
              Adult transition available
            </h2>

            <p className="mt-3 text-sm leading-6 text-blue-900">
              Review privacy and account
              settings before ending
              guardian control.
            </p>

            <button
              type="button"
              disabled={isWorking}
              onClick={
                completeTransition
              }
              className="mt-5 rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white disabled:opacity-50"
            >
              Complete Adult Transition
            </button>
          </div>
        )}

        {errorMessage && (
          <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-semibold text-red-800">
              {errorMessage}
            </p>
          </div>
        )}

        {successMessage && (
          <div className="mt-5 rounded-xl border border-green-200 bg-green-50 p-4">
            <p className="text-sm font-semibold text-green-800">
              {successMessage}
            </p>
          </div>
        )}
      </section>

      {initialData.incoming_invitations.length >
        0 && (
        <section>
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
            Action Required
          </p>

          <h2 className="mt-2 text-2xl font-bold text-gray-950">
            Guardian Invitations
          </h2>

          <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
            {initialData.incoming_invitations.map(
              (invitation) => {
                const childName =
                  invitation.child_full_name ||
                  invitation.child_username;

                return (
                  <article
                    key={
                      invitation.guardian_link_id
                    }
                    className="rounded-3xl border border-amber-200 bg-white p-6 shadow-sm"
                  >
                    <div className="flex items-start gap-4">
                      <PersonAvatar
                        url={
                          invitation.child_avatar_url
                        }
                        name={
                          childName
                        }
                      />

                      <div className="min-w-0 flex-1">
                        <h3 className="font-bold text-gray-950">
                          {childName}
                        </h3>

                        <p className="mt-1 text-sm text-gray-500">
                          @
                          {
                            invitation.child_username
                          }
                        </p>

                        <p className="mt-3 text-sm leading-6 text-gray-600">
                          Invited as{" "}
                          <span className="font-semibold capitalize">
                            {invitation.relationship.replaceAll(
                              "_",
                              " "
                            )}
                          </span>
                          .
                        </p>

                        <GuardianInvitationActions
                          linkId={
                            invitation.guardian_link_id
                          }
                        />
                      </div>
                    </div>
                  </article>
                );
              }
            )}
          </div>
        </section>
      )}

      {self.is_managed_minor && (
        <section>
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
            Managed Child Profile
          </p>

          <h2 className="mt-2 text-2xl font-bold text-gray-950">
            Parents & Guardians
          </h2>

          <p className="mt-2 text-sm leading-6 text-gray-500">
            Social actions, public
            participation requests and
            independent Intent creation are
            disabled.
          </p>

          {initialData.guardians.length >
          0 ? (
            <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
              {initialData.guardians.map(
                (guardian) => {
                  const guardianName =
                    guardian.full_name ||
                    guardian.username;

                  return (
                    <article
                      key={
                        guardian.guardian_link_id
                      }
                      className="rounded-3xl border border-blue-200 bg-white p-6 shadow-sm"
                    >
                      <div className="flex items-start gap-4">
                        <PersonAvatar
                          url={
                            guardian.avatar_url
                          }
                          name={
                            guardianName
                          }
                        />

                        <div className="min-w-0 flex-1">
                          <h3 className="font-bold text-gray-950">
                            {
                              guardianName
                            }
                          </h3>

                          <p className="mt-1 text-sm text-gray-500">
                            @
                            {
                              guardian.username
                            }
                          </p>

                          <div className="mt-3 flex flex-wrap gap-2">
                            <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold capitalize text-green-700">
                              {guardian.relationship.replaceAll(
                                "_",
                                " "
                              )}
                            </span>

                            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold capitalize text-blue-700">
                              {guardian.guardian_role.replaceAll(
                                "_",
                                " "
                              )}
                            </span>

                            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold capitalize text-gray-600">
                              {
                                guardian.status
                              }
                            </span>
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                }
              )}
            </div>
          ) : (
            <div className="mt-5 rounded-3xl border border-amber-200 bg-amber-50 p-6">
              <h3 className="font-bold text-amber-950">
                No accepted guardian yet
              </h3>
            </div>
          )}

          {self.can_bootstrap_guardian && (
            <div className="mt-5">
              <InviteGuardianForm
                childUserId={
                  self.user_id
                }
                primaryBootstrap
              />
            </div>
          )}
        </section>
      )}

      {initialData.managed_children.length >
        0 && (
        <section>
          <p className="text-xs font-semibold uppercase tracking-wide text-green-700">
            Guardian Workspace
          </p>

          <h2 className="mt-2 text-2xl font-bold text-gray-950">
            Managed Child Profiles
          </h2>

          <div className="mt-5 space-y-5">
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
                    className="rounded-3xl border border-green-200 bg-white p-6 shadow-sm"
                  >
                    <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                      <div className="flex items-start gap-4">
                        <PersonAvatar
                          url={
                            child.avatar_url
                          }
                          name={
                            childName
                          }
                        />

                        <div>
                          <h3 className="text-xl font-bold text-gray-950">
                            {childName}
                          </h3>

                          <p className="mt-1 text-sm text-gray-500">
                            @
                            {
                              child.username
                            }
                          </p>

                          <div className="mt-3 flex flex-wrap gap-2">
                            <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold capitalize text-green-700">
                              {child.relationship.replaceAll(
                                "_",
                                " "
                              )}
                            </span>

                            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold capitalize text-blue-700">
                              {child.guardian_role.replaceAll(
                                "_",
                                " "
                              )}
                            </span>
                          </div>

                          <div className="mt-5 flex flex-wrap gap-3">
                            <Link
                              href={`/u/${encodeURIComponent(
                                child.username
                              )}`}
                              className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700"
                            >
                              View Profile
                            </Link>

                            {child.can_manage_profile && (
                              <Link
                                href={`/settings/family/${encodeURIComponent(
                                  child.child_user_id
                                )}/profile`}
                                className="rounded-xl bg-green-600 px-4 py-2.5 text-sm font-semibold text-white"
                              >
                                Manage Profile
                              </Link>
                            )}

                            <RevokeGuardianButton
                              linkId={
                                child.guardian_link_id
                              }
                            />
                          </div>
                        </div>
                      </div>

                      {child.can_manage_guardians && (
                        <div className="w-full lg:max-w-md">
                          <InviteGuardianForm
                            childUserId={
                              child.child_user_id
                            }
                          />
                        </div>
                      )}
                    </div>
                  </article>
                );
              }
            )}
          </div>
        </section>
      )}

      {initialData.outgoing_invitations.length >
        0 && (
        <section>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
            Pending
          </p>

          <h2 className="mt-2 text-2xl font-bold text-gray-950">
            Sent Guardian Invitations
          </h2>

          <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
            {initialData.outgoing_invitations.map(
              (invitation) => (
                <article
                  key={
                    invitation.guardian_link_id
                  }
                  className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm"
                >
                  <p className="font-bold text-gray-950">
                    {invitation.guardian_full_name ||
                      invitation.guardian_username}
                  </p>

                  <p className="mt-1 text-sm text-gray-500">
                    @
                    {
                      invitation.guardian_username
                    }
                  </p>

                  <p className="mt-3 text-sm text-gray-600">
                    For{" "}
                    {invitation.child_full_name ||
                      invitation.child_username}
                  </p>
                </article>
              )
            )}
          </div>
        </section>
      )}
    </div>
  );
}
