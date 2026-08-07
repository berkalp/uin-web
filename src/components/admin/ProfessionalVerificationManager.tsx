"use client";

import {
  useMemo,
  useState,
} from "react";

import VerificationMark from "@/components/professionals/VerificationMark";
import {
  getCredentialStatusClasses,
  getIdentityLabel,
  slugifyProfessionalRole,
  type AdminProfessionalCatalogue,
  type AdminProfessionalPerson,
  type AdminProfessionalRole,
  type ProfessionalRoleScope,
} from "@/utils/professionals";
import { supabase } from "@/utils/supabase/client";

type ProfessionalVerificationManagerProps = {
  initialCatalogue: AdminProfessionalCatalogue;
};

type RoleDraft = {
  id: string | null;
  name: string;
  slug: string;
  description: string;
  scopeType: ProfessionalRoleScope;
  categoryId: string;
  activityId: string;
  requiresIdentityVerification: boolean;
  sortOrder: string;
};

const EMPTY_ROLE: RoleDraft = {
  id: null,
  name: "",
  slug: "",
  description: "",
  scopeType: "activity",
  categoryId: "",
  activityId: "",
  requiresIdentityVerification: true,
  sortOrder: "100",
};

function formatDateTime(
  value: string | null
) {
  if (!value) {
    return "Not set";
  }

  const date = new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return value;
  }

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }
  ).format(date);
}

export default function ProfessionalVerificationManager({
  initialCatalogue,
}: ProfessionalVerificationManagerProps) {
  const [
    catalogue,
    setCatalogue,
  ] = useState(
    initialCatalogue
  );

  const [
    roleDraft,
    setRoleDraft,
  ] = useState<RoleDraft>(
    EMPTY_ROLE
  );

  const [
    personQuery,
    setPersonQuery,
  ] = useState("");

  const [
    people,
    setPeople,
  ] = useState<
    AdminProfessionalPerson[]
  >([]);

  const [
    isSearching,
    setIsSearching,
  ] = useState(false);

  const [
    busyKey,
    setBusyKey,
  ] = useState<string | null>(
    null
  );

  const [
    message,
    setMessage,
  ] = useState("");

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const filteredActivities =
    useMemo(
      () =>
        catalogue.activities.filter(
          (activity) =>
            !roleDraft.categoryId ||
            activity.category_id ===
              roleDraft.categoryId
        ),
      [
        catalogue.activities,
        roleDraft.categoryId,
      ]
    );

  const pendingCredentials =
    catalogue.credentials.filter(
      (credential) =>
        credential.status ===
        "pending"
    );

  async function reloadCatalogue() {
    const {
      data,
      error,
    } = await supabase.rpc(
      "get_admin_professional_catalogue"
    );

    if (error) {
      throw new Error(
        error.message ||
          "Professional administration data could not be refreshed."
      );
    }

    setCatalogue(
      data as AdminProfessionalCatalogue
    );
  }

  function clearMessages() {
    setMessage("");
    setErrorMessage("");
  }

  function editRole(
    role: AdminProfessionalRole
  ) {
    clearMessages();

    setRoleDraft({
      id: role.id,
      name: role.name,
      slug: role.slug,
      description:
        role.description || "",
      scopeType:
        role.scope_type,
      categoryId:
        role.category_id,
      activityId:
        role.activity_id || "",
      requiresIdentityVerification:
        role.requires_identity_verification,
      sortOrder:
        String(role.sort_order),
    });

    document
      .getElementById(
        "professional-role-editor"
      )
      ?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
  }

  async function saveRole() {
    clearMessages();

    const name =
      roleDraft.name.trim();

    const slug =
      roleDraft.slug.trim() ||
      slugifyProfessionalRole(
        name
      );

    if (
      name.length < 2 ||
      !slug ||
      !roleDraft.categoryId
    ) {
      setErrorMessage(
        "Role name, slug and category are required."
      );
      return;
    }

    if (
      roleDraft.scopeType ===
        "activity" &&
      !roleDraft.activityId
    ) {
      setErrorMessage(
        "Select an Activity for an Activity-specific professional role."
      );
      return;
    }

    setBusyKey(
      roleDraft.id ||
        "new-role"
    );

    try {
      const args = {
        p_name: name,
        p_slug: slug,
        p_description:
          roleDraft.description.trim() ||
          null,
        p_scope_type:
          roleDraft.scopeType,
        p_category_id:
          roleDraft.categoryId,
        p_activity_id:
          roleDraft.scopeType ===
          "activity"
            ? roleDraft.activityId
            : null,
        p_requires_identity_verification:
          roleDraft.requiresIdentityVerification,
        p_sort_order:
          Number(
            roleDraft.sortOrder ||
              "100"
          ),
      };

      const result =
        roleDraft.id
          ? await supabase.rpc(
              "admin_update_professional_role",
              {
                p_role_id:
                  roleDraft.id,
                ...args,
              }
            )
          : await supabase.rpc(
              "admin_create_professional_role",
              args
            );

      if (result.error) {
        throw new Error(
          result.error.message ||
            "Professional role could not be saved."
        );
      }

      await reloadCatalogue();
      setRoleDraft(
        EMPTY_ROLE
      );
      setMessage(
        roleDraft.id
          ? "Professional role updated."
          : "Professional role created."
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Professional role could not be saved."
      );
    } finally {
      setBusyKey(null);
    }
  }

  async function setRoleActive(
    role: AdminProfessionalRole
  ) {
    clearMessages();
    setBusyKey(
      `role-${role.id}`
    );

    try {
      const {
        error,
      } = await supabase.rpc(
        "admin_set_professional_role_active",
        {
          p_role_id:
            role.id,
          p_is_active:
            !role.is_active,
        }
      );

      if (error) {
        throw new Error(
          error.message ||
            "Professional role status could not be changed."
        );
      }

      await reloadCatalogue();
      setMessage(
        role.is_active
          ? "Professional role deactivated."
          : "Professional role restored."
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Professional role status could not be changed."
      );
    } finally {
      setBusyKey(null);
    }
  }

  async function searchPeople() {
    clearMessages();

    if (
      personQuery.trim().length <
      2
    ) {
      setErrorMessage(
        "Enter at least two characters to search."
      );
      return;
    }

    setIsSearching(true);

    try {
      const {
        data,
        error,
      } = await supabase.rpc(
        "admin_search_professional_people",
        {
          p_query:
            personQuery.trim(),
        }
      );

      if (error) {
        throw new Error(
          error.message ||
            "People search failed."
        );
      }

      setPeople(
        (
          data ?? []
        ) as AdminProfessionalPerson[]
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "People search failed."
      );
    } finally {
      setIsSearching(false);
    }
  }

  async function updateIdentity(
    person: AdminProfessionalPerson,
    status:
      | "approved"
      | "rejected"
      | "revoked"
      | "unverified"
  ) {
    clearMessages();

    const method =
      status === "approved"
        ? window.prompt(
            "Verification method:",
            "Admin document review"
          ) ||
          "Admin document review"
        : "";

    const internalNote =
      window.prompt(
        "Internal note, optional:",
        ""
      ) || "";

    let expiresAt: string | null =
      null;

    if (status === "approved") {
      const expiry =
        window.prompt(
          "Optional expiry date (YYYY-MM-DD):",
          ""
        );

      expiresAt = expiry
        ? `${expiry}T23:59:59.000Z`
        : null;
    }

    setBusyKey(
      `identity-${person.user_id}`
    );

    try {
      const {
        error,
      } = await supabase.rpc(
        "admin_set_identity_verification",
        {
          p_user_id:
            person.user_id,
          p_status:
            status,
          p_verification_method:
            method || null,
          p_expires_at:
            expiresAt,
          p_internal_note:
            internalNote || null,
        }
      );

      if (error) {
        throw new Error(
          error.message ||
            "Identity status could not be changed."
        );
      }

      await searchPeople();
      setMessage(
        `Identity status updated to ${status}.`
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Identity status could not be changed."
      );
    } finally {
      setBusyKey(null);
    }
  }

  async function openEvidence(
    path: string
  ) {
    clearMessages();

    const {
      data,
      error,
    } = await supabase.storage
      .from(
        "professional-credentials"
      )
      .createSignedUrl(
        path,
        120
      );

    if (
      error ||
      !data?.signedUrl
    ) {
      setErrorMessage(
        error?.message ||
          "Evidence file could not be opened."
      );
      return;
    }

    window.open(
      data.signedUrl,
      "_blank",
      "noopener,noreferrer"
    );
  }

  async function reviewCredential(
    credentialId: string,
    decision:
      | "approved"
      | "rejected"
      | "revoked"
  ) {
    clearMessages();

    const note =
      window.prompt(
        "Review note, optional:",
        ""
      ) || "";

    let expiry: string | null =
      null;

    if (decision === "approved") {
      expiry =
        window.prompt(
          "Optional approved expiry date (YYYY-MM-DD). Leave blank to keep the submitted date:",
          ""
        ) || null;
    }

    setBusyKey(
      `credential-${credentialId}`
    );

    try {
      const {
        error,
      } = await supabase.rpc(
        "admin_review_professional_credential",
        {
          p_credential_id:
            credentialId,
          p_decision:
            decision,
          p_review_note:
            note || null,
          p_expires_at:
            expiry,
        }
      );

      if (error) {
        throw new Error(
          error.message ||
            "Credential review could not be saved."
        );
      }

      await reloadCatalogue();
      setMessage(
        `Credential ${decision}.`
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Credential review could not be saved."
      );
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <div className="space-y-8">
      {(message || errorMessage) && (
        <div
          className={`rounded-2xl border p-4 text-sm font-semibold ${
            errorMessage
              ? "border-red-200 bg-red-50 text-red-800"
              : "border-green-200 bg-green-50 text-green-800"
          }`}
        >
          {errorMessage || message}
        </div>
      )}

      <section
        id="professional-role-editor"
        className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm md:p-8"
      >
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
              Professional taxonomy
            </p>

            <h2 className="mt-2 text-2xl font-bold text-gray-950">
              {roleDraft.id
                ? "Edit professional role"
                : "Create professional role"}
            </h2>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-500">
              Roles belong to a category or exact Activity. A Basketball Coach is not automatically a Football Coach merely because both involve spherical objects and human optimism.
            </p>
          </div>

          {roleDraft.id && (
            <button
              type="button"
              onClick={() =>
                setRoleDraft(
                  EMPTY_ROLE
                )
              }
              className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700"
            >
              New role
            </button>
          )}
        </div>

        <div className="mt-6 grid gap-5 md:grid-cols-2">
          <label className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-gray-700">
              Role name
            </span>

            <input
              value={roleDraft.name}
              onChange={(event) => {
                const name =
                  event.target.value;

                setRoleDraft(
                  (current) => ({
                    ...current,
                    name,
                    slug:
                      current.id ||
                      current.slug
                        ? current.slug
                        : slugifyProfessionalRole(
                            name
                          ),
                  })
                );
              }}
              placeholder="Basketball Coach"
              className="rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-blue-500"
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-gray-700">
              Slug
            </span>

            <input
              value={roleDraft.slug}
              onChange={(event) =>
                setRoleDraft(
                  (current) => ({
                    ...current,
                    slug:
                      slugifyProfessionalRole(
                        event.target.value
                      ),
                  })
                )
              }
              placeholder="basketball-coach"
              className="rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-blue-500"
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-gray-700">
              Scope
            </span>

            <select
              value={roleDraft.scopeType}
              onChange={(event) =>
                setRoleDraft(
                  (current) => ({
                    ...current,
                    scopeType:
                      event.target.value as ProfessionalRoleScope,
                    activityId:
                      event.target.value ===
                      "category"
                        ? ""
                        : current.activityId,
                  })
                )
              }
              className="rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-blue-500"
            >
              <option value="activity">
                Exact Activity
              </option>
              <option value="category">
                Entire category
              </option>
            </select>
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-gray-700">
              Category
            </span>

            <select
              value={roleDraft.categoryId}
              onChange={(event) =>
                setRoleDraft(
                  (current) => ({
                    ...current,
                    categoryId:
                      event.target.value,
                    activityId: "",
                  })
                )
              }
              className="rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-blue-500"
            >
              <option value="">
                Select a category
              </option>
              {catalogue.categories.map(
                (category) => (
                  <option
                    key={category.id}
                    value={category.id}
                  >
                    {category.name}
                  </option>
                )
              )}
            </select>
          </label>

          {roleDraft.scopeType ===
            "activity" && (
            <label className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-gray-700">
                Activity
              </span>

              <select
                value={roleDraft.activityId}
                onChange={(event) =>
                  setRoleDraft(
                    (current) => ({
                      ...current,
                      activityId:
                        event.target.value,
                    })
                  )
                }
                disabled={!roleDraft.categoryId}
                className="rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-blue-500 disabled:bg-gray-100"
              >
                <option value="">
                  Select an Activity
                </option>
                {filteredActivities.map(
                  (activity) => (
                    <option
                      key={activity.id}
                      value={activity.id}
                    >
                      {activity.name}
                    </option>
                  )
                )}
              </select>
            </label>
          )}

          <label className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-gray-700">
              Sort order
            </span>

            <input
              type="number"
              value={roleDraft.sortOrder}
              onChange={(event) =>
                setRoleDraft(
                  (current) => ({
                    ...current,
                    sortOrder:
                      event.target.value,
                  })
                )
              }
              className="rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-blue-500"
            />
          </label>

          <label className="flex items-start gap-3 rounded-2xl border border-blue-100 bg-blue-50 p-4 md:col-span-2">
            <input
              type="checkbox"
              checked={roleDraft.requiresIdentityVerification}
              onChange={(event) =>
                setRoleDraft(
                  (current) => ({
                    ...current,
                    requiresIdentityVerification:
                      event.target.checked,
                  })
                )
              }
              className="mt-1 h-4 w-4"
            />

            <span>
              <span className="block text-sm font-semibold text-blue-950">
                Require identity verification
              </span>
              <span className="mt-1 block text-xs leading-5 text-blue-800">
                The credential cannot be approved until the person identity is verified.
              </span>
            </span>
          </label>

          <label className="flex flex-col gap-2 md:col-span-2">
            <span className="text-sm font-semibold text-gray-700">
              Description
            </span>

            <textarea
              value={roleDraft.description}
              onChange={(event) =>
                setRoleDraft(
                  (current) => ({
                    ...current,
                    description:
                      event.target.value,
                  })
                )
              }
              maxLength={1000}
              className="h-24 resize-none rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-blue-500"
            />
          </label>
        </div>

        <button
          type="button"
          onClick={saveRole}
          disabled={
            busyKey ===
              (roleDraft.id ||
                "new-role")
          }
          className="mt-6 rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:bg-gray-300"
        >
          {busyKey ===
          (roleDraft.id ||
            "new-role")
            ? "Saving..."
            : roleDraft.id
              ? "Update role"
              : "Create role"}
        </button>
      </section>

      <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-purple-700">
              Role catalogue
            </p>
            <h2 className="mt-2 text-2xl font-bold text-gray-950">
              Configured professional roles
            </h2>
          </div>

          <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
            {catalogue.roles.length} roles
          </span>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {catalogue.roles.map(
            (role) => (
              <article
                key={role.id}
                className={`rounded-2xl border p-5 ${
                  role.is_active
                    ? "border-gray-200 bg-white"
                    : "border-gray-200 bg-gray-50 opacity-65"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-gray-950">
                      {role.name}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-blue-700">
                      {role.activity_name || role.category_name}
                    </p>
                  </div>

                  <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-semibold capitalize text-gray-600">
                    {role.scope_type}
                  </span>
                </div>

                <p className="mt-3 text-sm leading-6 text-gray-500">
                  {role.description || "No description."}
                </p>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      editRole(role)
                    }
                    className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700"
                  >
                    Edit
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setRoleActive(role)
                    }
                    disabled={
                      busyKey ===
                      `role-${role.id}`
                    }
                    className={`rounded-xl border px-4 py-2 text-sm font-semibold ${
                      role.is_active
                        ? "border-red-200 bg-red-50 text-red-700"
                        : "border-green-200 bg-green-50 text-green-700"
                    }`}
                  >
                    {role.is_active
                      ? "Deactivate"
                      : "Restore"}
                  </button>
                </div>
              </article>
            )
          )}
        </div>
      </section>

      <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm md:p-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-green-700">
            Identity review
          </p>
          <h2 className="mt-2 text-2xl font-bold text-gray-950">
            Find and verify people
          </h2>
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <input
            value={personQuery}
            onChange={(event) =>
              setPersonQuery(
                event.target.value
              )
            }
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                searchPeople();
              }
            }}
            placeholder="Name, username or email"
            className="min-w-0 flex-1 rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-green-500"
          />

          <button
            type="button"
            onClick={searchPeople}
            disabled={isSearching}
            className="rounded-xl bg-gray-950 px-6 py-3 text-sm font-semibold text-white disabled:bg-gray-400"
          >
            {isSearching
              ? "Searching..."
              : "Search"}
          </button>
        </div>

        {people.length > 0 && (
          <div className="mt-6 space-y-3">
            {people.map(
              (person) => (
                <article
                  key={person.user_id}
                  className="rounded-2xl border border-gray-200 p-5"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex min-w-0 items-center gap-3">
                      {person.avatar_url ? (
                        <img
                          src={person.avatar_url}
                          alt={person.full_name || person.username}
                          className="h-12 w-12 rounded-xl object-cover"
                        />
                      ) : (
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100 font-bold text-gray-500">
                          {(person.full_name || person.username).charAt(0).toUpperCase()}
                        </div>
                      )}

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate font-bold text-gray-950">
                            {person.full_name || person.username}
                          </p>

                          {person.identity_status ===
                            "approved" && (
                            <VerificationMark compact />
                          )}
                        </div>

                        <p className="mt-1 truncate text-sm text-gray-500">
                          @{person.username}{person.email ? ` · ${person.email}` : ""}
                        </p>

                        <p className="mt-1 text-xs text-gray-400">
                          {getIdentityLabel(person.identity_status)} · {person.approved_credential_count} approved credential{person.approved_credential_count === 1 ? "" : "s"}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          updateIdentity(
                            person,
                            "approved"
                          )
                        }
                        disabled={busyKey === `identity-${person.user_id}`}
                        className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-800"
                      >
                        Verify identity
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          updateIdentity(
                            person,
                            "revoked"
                          )
                        }
                        disabled={busyKey === `identity-${person.user_id}`}
                        className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700"
                      >
                        Revoke
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          updateIdentity(
                            person,
                            "unverified"
                          )
                        }
                        disabled={busyKey === `identity-${person.user_id}`}
                        className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700"
                      >
                        Clear status
                      </button>
                    </div>
                  </div>
                </article>
              )
            )}
          </div>
        )}
      </section>

      <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">
              Credential review
            </p>
            <h2 className="mt-2 text-2xl font-bold text-gray-950">
              Professional applications
            </h2>
            <p className="mt-2 text-sm text-gray-500">
              {pendingCredentials.length} pending review{pendingCredentials.length === 1 ? "" : "s"}.
            </p>
          </div>
        </div>

        {catalogue.credentials.length ===
        0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-6 text-sm text-gray-500">
            No professional credential applications.
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            {catalogue.credentials.map(
              (credential) => (
                <article
                  key={credential.id}
                  className={`rounded-2xl border p-5 ${
                    credential.status ===
                    "pending"
                      ? "border-amber-200 bg-amber-50/40"
                      : "border-gray-200 bg-white"
                  }`}
                >
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-bold text-gray-950">
                          {credential.full_name || credential.username}
                        </h3>

                        <span className="text-sm text-gray-500">
                          @{credential.username}
                        </span>

                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-semibold capitalize ${getCredentialStatusClasses(
                            credential.status
                          )}`}
                        >
                          {credential.status}
                        </span>
                      </div>

                      <p className="mt-3 text-lg font-bold text-blue-950">
                        {credential.professional_title || credential.role_name}
                      </p>

                      {credential.professional_title && (
                        <p className="mt-1 text-sm font-semibold text-blue-700">
                          {credential.role_name}
                        </p>
                      )}

                      <div className="mt-3 grid gap-2 text-sm text-gray-600 md:grid-cols-2">
                        <p>
                          Context: {credential.activity_name || credential.category_name}
                        </p>
                        <p>
                          Type: {credential.credential_type}
                        </p>
                        <p>
                          Issuer: {credential.issuer}
                        </p>
                        <p>
                          Number: {credential.credential_number || "Not provided"}
                        </p>
                        <p>
                          Submitted: {formatDateTime(credential.created_at)}
                        </p>
                        <p>
                          Expiry: {credential.expires_at || "Not provided"}
                        </p>
                      </div>

                      {credential.application_note && (
                        <p className="mt-4 rounded-xl bg-white p-3 text-sm leading-6 text-gray-600">
                          Applicant note: {credential.application_note}
                        </p>
                      )}

                      {credential.review_note && (
                        <p className="mt-3 text-sm leading-6 text-gray-500">
                          Review note: {credential.review_note}
                        </p>
                      )}
                    </div>

                    <div className="flex shrink-0 flex-wrap gap-2">
                      {credential.evidence_path && (
                        <button
                          type="button"
                          onClick={() =>
                            openEvidence(
                              credential.evidence_path as string
                            )
                          }
                          className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700"
                        >
                          Open evidence
                        </button>
                      )}

                      {credential.status ===
                        "pending" && (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              reviewCredential(
                                credential.id,
                                "approved"
                              )
                            }
                            disabled={busyKey === `credential-${credential.id}`}
                            className="rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white"
                          >
                            Approve
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              reviewCredential(
                                credential.id,
                                "rejected"
                              )
                            }
                            disabled={busyKey === `credential-${credential.id}`}
                            className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700"
                          >
                            Reject
                          </button>
                        </>
                      )}

                      {credential.status ===
                        "approved" && (
                        <button
                          type="button"
                          onClick={() =>
                            reviewCredential(
                              credential.id,
                              "revoked"
                            )
                          }
                          disabled={busyKey === `credential-${credential.id}`}
                          className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700"
                        >
                          Revoke credential
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              )
            )}
          </div>
        )}
      </section>
    </div>
  );
}
