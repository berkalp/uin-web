"use client";

import {
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";

import VerificationMark from "@/components/professionals/VerificationMark";
import {
  getCredentialStatusClasses,
  getIdentityLabel,
  type MyProfessionalProfile,
} from "@/utils/professionals";
import { supabase } from "@/utils/supabase/client";

type ProfessionalSettingsClientProps = {
  initialProfile: MyProfessionalProfile;
};

function getFileExtension(
  fileName: string
) {
  const parts =
    fileName.split(".");

  if (parts.length < 2) {
    return "bin";
  }

  return (
    parts.at(-1) || "bin"
  )
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "") ||
    "bin";
}

function formatDate(
  value: string | null
) {
  if (!value) {
    return "No expiry";
  }

  const date =
    new Date(`${value}T00:00:00`);

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
    }
  ).format(date);
}

export default function ProfessionalSettingsClient({
  initialProfile,
}: ProfessionalSettingsClientProps) {
  const router =
    useRouter();

  const [
    profile,
    setProfile,
  ] = useState(
    initialProfile
  );

  const [
    professionalRoleId,
    setProfessionalRoleId,
  ] = useState("");

  const [
    professionalTitle,
    setProfessionalTitle,
  ] = useState("");

  const [
    credentialType,
    setCredentialType,
  ] = useState("");

  const [
    issuer,
    setIssuer,
  ] = useState("");

  const [
    credentialNumber,
    setCredentialNumber,
  ] = useState("");

  const [
    issuedAt,
    setIssuedAt,
  ] = useState("");

  const [
    expiresAt,
    setExpiresAt,
  ] = useState("");

  const [
    applicationNote,
    setApplicationNote,
  ] = useState("");

  const [
    evidenceFile,
    setEvidenceFile,
  ] = useState<File | null>(
    null
  );

  const [
    isSaving,
    setIsSaving,
  ] = useState(false);

  const [
    actionId,
    setActionId,
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

  const selectedRole =
    useMemo(
      () =>
        profile.roles.find(
          (role) =>
            role.id ===
            professionalRoleId
        ) ?? null,
      [
        profile.roles,
        professionalRoleId,
      ]
    );

  async function reloadProfile() {
    const {
      data,
      error,
    } = await supabase.rpc(
      "get_my_professional_profile"
    );

    if (error) {
      throw new Error(
        error.message ||
          "Professional profile could not be refreshed."
      );
    }

    setProfile(
      data as MyProfessionalProfile
    );

    router.refresh();
  }

  function resetForm() {
    setProfessionalRoleId("");
    setProfessionalTitle("");
    setCredentialType("");
    setIssuer("");
    setCredentialNumber("");
    setIssuedAt("");
    setExpiresAt("");
    setApplicationNote("");
    setEvidenceFile(null);
  }

  async function handleSubmit() {
    setMessage("");
    setErrorMessage("");

    if (
      !professionalRoleId ||
      credentialType.trim().length < 2 ||
      issuer.trim().length < 2
    ) {
      setErrorMessage(
        "Select a professional role and enter the credential type and issuer."
      );
      return;
    }

    if (
      expiresAt &&
      issuedAt &&
      expiresAt <= issuedAt
    ) {
      setErrorMessage(
        "Expiry date must be after the issue date."
      );
      return;
    }

    if (
      evidenceFile &&
      evidenceFile.size >
        10 * 1024 * 1024
    ) {
      setErrorMessage(
        "Evidence files may be at most 10 MB."
      );
      return;
    }

    setIsSaving(true);

    let evidencePath = "";

    try {
      const {
        data: authData,
        error: authError,
      } = await supabase.auth.getUser();

      if (
        authError ||
        !authData.user
      ) {
        throw new Error(
          "You must be signed in to submit a credential."
        );
      }

      if (evidenceFile) {
        const extension =
          getFileExtension(
            evidenceFile.name
          );

        evidencePath = `${authData.user.id}/${crypto.randomUUID()}.${extension}`;

        const {
          error: uploadError,
        } = await supabase.storage
          .from(
            "professional-credentials"
          )
          .upload(
            evidencePath,
            evidenceFile,
            {
              cacheControl: "3600",
              upsert: false,
              contentType:
                evidenceFile.type ||
                undefined,
            }
          );

        if (uploadError) {
          throw new Error(
            uploadError.message ||
              "Credential evidence could not be uploaded."
          );
        }
      }

      const {
        error,
      } = await supabase.rpc(
        "submit_professional_credential_application",
        {
          p_professional_role_id:
            professionalRoleId,
          p_professional_title:
            professionalTitle.trim() ||
            null,
          p_credential_type:
            credentialType.trim(),
          p_issuer:
            issuer.trim(),
          p_credential_number:
            credentialNumber.trim() ||
            null,
          p_issued_at:
            issuedAt || null,
          p_expires_at:
            expiresAt || null,
          p_evidence_path:
            evidencePath || null,
          p_application_note:
            applicationNote.trim() ||
            null,
        }
      );

      if (error) {
        throw new Error(
          error.message ||
            "Credential application could not be submitted."
        );
      }

      resetForm();
      await reloadProfile();
      setMessage(
        "Professional credential submitted for review."
      );
    } catch (error) {
      if (evidencePath) {
        await supabase.storage
          .from(
            "professional-credentials"
          )
          .remove([
            evidencePath,
          ]);
      }

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Credential application could not be submitted."
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function openEvidence(
    path: string
  ) {
    setErrorMessage("");

    const {
      data,
      error,
    } = await supabase.storage
      .from(
        "professional-credentials"
      )
      .createSignedUrl(
        path,
        60
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

  async function withdrawApplication(
    credentialId: string
  ) {
    setMessage("");
    setErrorMessage("");
    setActionId(
      credentialId
    );

    try {
      const {
        error,
      } = await supabase.rpc(
        "withdraw_my_professional_credential",
        {
          p_credential_id:
            credentialId,
        }
      );

      if (error) {
        throw new Error(
          error.message ||
            "Application could not be withdrawn."
        );
      }

      await reloadProfile();
      setMessage(
        "Credential application withdrawn."
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Application could not be withdrawn."
      );
    } finally {
      setActionId(null);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm md:p-8">
        <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
              Identity verification
            </p>

            <h2 className="mt-2 text-2xl font-bold text-gray-950">
              {getIdentityLabel(
                profile.identity.status
              )}
            </h2>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-500">
              Identity verification confirms that the profile belongs to a real person. It does not certify professional ability and it is not a decorative badge.
            </p>
          </div>

          <div
            className={`inline-flex items-center gap-2 self-start rounded-full border px-4 py-2 text-sm font-semibold ${
              profile.identity.status ===
              "approved"
                ? "border-blue-200 bg-blue-50 text-blue-800"
                : "border-gray-200 bg-gray-100 text-gray-700"
            }`}
          >
            {profile.identity.status ===
              "approved" && (
              <VerificationMark compact />
            )}

            {profile.identity.status ===
              "approved"
              ? "Verified by UIN"
              : "Not publicly verified"}
          </div>
        </div>

        {profile.identity.status !==
          "approved" && (
          <div className="mt-5 rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
            Identity reviews are currently handled by an administrator. Professional applications may still be submitted, but roles that require identity verification cannot be approved first.
          </div>
        )}
      </section>

      <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm md:p-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-green-700">
            Credential application
          </p>

          <h2 className="mt-2 text-2xl font-bold text-gray-950">
            Add a professional qualification
          </h2>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-500">
            Select the exact category or Activity role. A Basketball Coach credential will not mysteriously turn into a general Sport wizard certificate.
          </p>
        </div>

        <div className="mt-6 grid gap-5 md:grid-cols-2">
          <label className="flex flex-col gap-2 md:col-span-2">
            <span className="text-sm font-semibold text-gray-700">
              Professional role
            </span>

            <select
              value={professionalRoleId}
              onChange={(event) =>
                setProfessionalRoleId(
                  event.target.value
                )
              }
              className="rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-blue-500"
            >
              <option value="">
                Select a verified professional role
              </option>

              {profile.roles.map(
                (role) => (
                  <option
                    key={role.id}
                    value={role.id}
                  >
                    {role.name} · {role.activity_name || role.category_name}
                  </option>
                )
              )}
            </select>

            {selectedRole?.description && (
              <span className="text-xs leading-5 text-gray-500">
                {selectedRole.description}
              </span>
            )}
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-gray-700">
              Professional title, optional
            </span>

            <input
              value={professionalTitle}
              onChange={(event) =>
                setProfessionalTitle(
                  event.target.value
                )
              }
              placeholder="e.g. Level 2 Basketball Coach"
              maxLength={160}
              className="rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-blue-500"
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-gray-700">
              Credential type
            </span>

            <input
              value={credentialType}
              onChange={(event) =>
                setCredentialType(
                  event.target.value
                )
              }
              placeholder="Certificate, licence, diploma..."
              maxLength={160}
              className="rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-blue-500"
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-gray-700">
              Issuer
            </span>

            <input
              value={issuer}
              onChange={(event) =>
                setIssuer(
                  event.target.value
                )
              }
              placeholder="Institution or authority"
              maxLength={200}
              className="rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-blue-500"
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-gray-700">
              Credential number, optional
            </span>

            <input
              value={credentialNumber}
              onChange={(event) =>
                setCredentialNumber(
                  event.target.value
                )
              }
              maxLength={200}
              className="rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-blue-500"
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-gray-700">
              Issue date, optional
            </span>

            <input
              type="date"
              value={issuedAt}
              onChange={(event) =>
                setIssuedAt(
                  event.target.value
                )
              }
              className="rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-blue-500"
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-gray-700">
              Expiry date, optional
            </span>

            <input
              type="date"
              min={issuedAt || undefined}
              value={expiresAt}
              onChange={(event) =>
                setExpiresAt(
                  event.target.value
                )
              }
              className="rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-blue-500"
            />
          </label>

          <label className="flex flex-col gap-2 md:col-span-2">
            <span className="text-sm font-semibold text-gray-700">
              Supporting evidence, optional
            </span>

            <input
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp"
              onChange={(event) =>
                setEvidenceFile(
                  event.target.files?.[0] ??
                    null
                )
              }
              className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-600 file:mr-4 file:rounded-lg file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:font-semibold file:text-blue-800"
            />

            <span className="text-xs leading-5 text-gray-500">
              PDF, JPG, PNG or WebP. Maximum 10 MB. Evidence remains private to you and authorised administrators.
            </span>
          </label>

          <label className="flex flex-col gap-2 md:col-span-2">
            <span className="text-sm font-semibold text-gray-700">
              Application note, optional
            </span>

            <textarea
              value={applicationNote}
              onChange={(event) =>
                setApplicationNote(
                  event.target.value
                )
              }
              maxLength={2000}
              placeholder="Explain anything the reviewer should know."
              className="h-28 resize-none rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-blue-500"
            />
          </label>
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSaving}
          className="mt-6 rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          {isSaving
            ? "Submitting..."
            : "Submit for verification"}
        </button>
      </section>

      {(message || errorMessage) && (
        <section
          className={`rounded-2xl border p-4 text-sm font-semibold ${
            errorMessage
              ? "border-red-200 bg-red-50 text-red-800"
              : "border-green-200 bg-green-50 text-green-800"
          }`}
        >
          {errorMessage || message}
        </section>
      )}

      <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-purple-700">
              Applications
            </p>

            <h2 className="mt-2 text-2xl font-bold text-gray-950">
              Your professional credentials
            </h2>
          </div>

          <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
            {profile.credentials.length} record{profile.credentials.length === 1 ? "" : "s"}
          </span>
        </div>

        {profile.credentials.length ===
        0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-6 text-sm leading-6 text-gray-500">
            No professional credential applications yet.
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            {profile.credentials.map(
              (credential) => (
                <article
                  key={credential.id}
                  className="rounded-2xl border border-gray-200 p-5"
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-bold text-gray-950">
                          {credential.professional_title || credential.role_name}
                        </h3>

                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-semibold capitalize ${getCredentialStatusClasses(
                            credential.status
                          )}`}
                        >
                          {credential.status}
                        </span>
                      </div>

                      {credential.professional_title && (
                        <p className="mt-1 text-sm font-semibold text-blue-700">
                          {credential.role_name}
                        </p>
                      )}

                      <p className="mt-2 text-sm text-gray-500">
                        {credential.activity_name || credential.category_name} · {credential.credential_type} · {credential.issuer}
                      </p>

                      <p className="mt-2 text-xs text-gray-400">
                        Validity: {formatDate(credential.expires_at)}
                      </p>

                      {credential.review_note && (
                        <p className="mt-3 rounded-xl bg-gray-50 p-3 text-sm leading-6 text-gray-600">
                          Review note: {credential.review_note}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {credential.evidence_path && (
                        <button
                          type="button"
                          onClick={() =>
                            openEvidence(
                              credential.evidence_path as string
                            )
                          }
                          className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:border-blue-300 hover:text-blue-700"
                        >
                          View evidence
                        </button>
                      )}

                      {credential.status ===
                        "pending" && (
                        <button
                          type="button"
                          onClick={() =>
                            withdrawApplication(
                              credential.id
                            )
                          }
                          disabled={
                            actionId ===
                            credential.id
                          }
                          className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:opacity-50"
                        >
                          {actionId ===
                          credential.id
                            ? "Withdrawing..."
                            : "Withdraw"}
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
