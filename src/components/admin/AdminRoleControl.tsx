"use client";

import {
  FormEvent,
  useEffect,
  useState,
} from "react";
import { useRouter } from "next/navigation";

import { supabase } from "@/utils/supabase/client";

type AdminRole =
  | "owner"
  | "admin"
  | "moderator"
  | "support";

type RoleValue =
  | AdminRole
  | "member";

type AdminRoleControlProps = {
  userId: string;
  currentRole: AdminRole | null;
};

function getRoleLabel(
  role: RoleValue
) {
  if (role === "owner") {
    return "Owner";
  }

  if (role === "admin") {
    return "Administrator";
  }

  if (role === "moderator") {
    return "Moderator";
  }

  if (role === "support") {
    return "Support";
  }

  return "Member";
}

export default function AdminRoleControl({
  userId,
  currentRole,
}: AdminRoleControlProps) {
  const router = useRouter();

  const originalRole: RoleValue =
    currentRole ?? "member";

  const [
    selectedRole,
    setSelectedRole,
  ] = useState<RoleValue>(
    originalRole
  );

  const [
    isSubmitting,
    setIsSubmitting,
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState<string | null>(
    null
  );

  const [
    successMessage,
    setSuccessMessage,
  ] = useState<string | null>(
    null
  );

  useEffect(() => {
    setSelectedRole(
      currentRole ?? "member"
    );
  }, [currentRole]);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setErrorMessage(null);
    setSuccessMessage(null);

    if (
      selectedRole ===
      originalRole
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        `Change this user's role from ${getRoleLabel(
          originalRole
        )} to ${getRoleLabel(
          selectedRole
        )}?`
      );

    if (!confirmed) {
      return;
    }

    try {
      setIsSubmitting(true);

      const {
        error,
      } = await supabase.rpc(
        "set_admin_user_role",
        {
          p_target_user_id:
            userId,
          p_role:
            selectedRole,
        }
      );

      if (error) {
        throw error;
      }

      setSuccessMessage(
        `Role changed to ${getRoleLabel(
          selectedRole
        )}.`
      );

      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "The role could not be changed."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="min-w-48"
    >
      <div className="flex items-center gap-2">
        <select
          value={selectedRole}
          onChange={(event) => {
            setSelectedRole(
              event.target
                .value as RoleValue
            );

            setErrorMessage(null);
            setSuccessMessage(null);
          }}
          disabled={isSubmitting}
          className="min-w-36 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="member">
            Member
          </option>

          <option value="support">
            Support
          </option>

          <option value="moderator">
            Moderator
          </option>

          <option value="admin">
            Administrator
          </option>

          <option value="owner">
            Owner
          </option>
        </select>

        <button
          type="submit"
          disabled={
            isSubmitting ||
            selectedRole ===
              originalRole
          }
          className="rounded-lg bg-gray-950 px-3 py-2 text-xs font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isSubmitting
            ? "Saving..."
            : "Apply"}
        </button>
      </div>

      {errorMessage && (
        <p className="mt-2 max-w-56 text-xs font-semibold text-red-700">
          {errorMessage}
        </p>
      )}

      {successMessage && (
        <p className="mt-2 max-w-56 text-xs font-semibold text-green-700">
          {successMessage}
        </p>
      )}
    </form>
  );
}