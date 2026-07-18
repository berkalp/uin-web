"use client";

import {
  FormEvent,
  useState,
} from "react";
import {
  useRouter,
} from "next/navigation";

import { supabase } from "@/utils/supabase/client";

type RestrictionActionsProps = {
  restrictionId: string;
  canManage: boolean;
  effectiveStatus: string;
};

function getErrorMessage(
  error: unknown
) {
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  return "The restriction could not be revoked.";
}

export default function RestrictionActions({
  restrictionId,
  canManage,
  effectiveStatus,
}: RestrictionActionsProps) {
  const router =
    useRouter();

  const [
    revocationReason,
    setRevocationReason,
  ] = useState("");

  const [
    isSubmitting,
    setIsSubmitting,
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const [
    successMessage,
    setSuccessMessage,
  ] = useState("");

  if (
    effectiveStatus !== "active"
  ) {
    return null;
  }

  if (!canManage) {
    return (
      <div className="mt-5 rounded-2xl border border-gray-200 bg-gray-50 p-4">
        <p className="text-sm font-semibold text-gray-700">
          Read-only access
        </p>

        <p className="mt-1 text-xs leading-5 text-gray-500">
          Your administrator role cannot
          revoke user restrictions.
        </p>
      </div>
    );
  }

  async function revokeRestriction(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const cleanedReason =
      revocationReason.trim();

    if (
      cleanedReason.length < 5
    ) {
      setErrorMessage(
        "Enter a revocation reason of at least 5 characters."
      );

      return;
    }

    if (
      cleanedReason.length > 2000
    ) {
      setErrorMessage(
        "The revocation reason cannot exceed 2000 characters."
      );

      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const {
        error,
      } = await supabase.rpc(
        "revoke_user_restriction",
        {
          p_restriction_id:
            restrictionId,
          p_revocation_reason:
            cleanedReason,
        }
      );

      if (error) {
        throw error;
      }

      setSuccessMessage(
        "The restriction was revoked."
      );

      setRevocationReason("");

      router.refresh();
    } catch (error) {
      setErrorMessage(
        getErrorMessage(error)
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={
        revokeRestriction
      }
      className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4"
    >
      <p className="text-sm font-bold text-red-900">
        Revoke Restriction
      </p>

      <p className="mt-1 text-xs leading-5 text-red-700">
        Revoking this restriction restores
        the affected account capability
        immediately.
      </p>

      <label
        htmlFor={`revocation-reason-${restrictionId}`}
        className="mt-4 block text-xs font-semibold uppercase tracking-wide text-red-800"
      >
        Revocation Reason
      </label>

      <textarea
        id={`revocation-reason-${restrictionId}`}
        value={
          revocationReason
        }
        onChange={(event) =>
          setRevocationReason(
            event.target.value
          )
        }
        disabled={
          isSubmitting
        }
        maxLength={2000}
        rows={3}
        placeholder="Explain why this restriction is being revoked."
        className="mt-2 w-full resize-y rounded-xl border border-red-200 bg-white px-4 py-3 text-sm leading-6 text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-red-500 focus:ring-2 focus:ring-red-100 disabled:cursor-not-allowed disabled:bg-gray-100"
      />

      <div className="mt-2 flex justify-end">
        <p className="text-xs text-red-700">
          {
            revocationReason.length
          }
          /2000
        </p>
      </div>

      {errorMessage && (
        <div className="mt-3 rounded-xl border border-red-300 bg-white p-3">
          <p className="text-sm font-semibold text-red-800">
            {errorMessage}
          </p>
        </div>
      )}

      {successMessage && (
        <div className="mt-3 rounded-xl border border-green-200 bg-green-50 p-3">
          <p className="text-sm font-semibold text-green-800">
            {successMessage}
          </p>
        </div>
      )}

      <button
        type="submit"
        disabled={
          isSubmitting
        }
        className="mt-4 rounded-xl bg-red-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSubmitting
          ? "Revoking..."
          : "Revoke Restriction"}
      </button>
    </form>
  );
}