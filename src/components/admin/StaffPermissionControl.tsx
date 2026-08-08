"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import {
  type StaffCapability,
  setStaffCapability,
} from "@/services/directMessageService";

type StaffPermissionControlProps = {
  userId: string;
  initial: Record<StaffCapability, boolean>;
};

const PERMISSIONS: Array<{
  key: StaffCapability;
  title: string;
  description: string;
}> = [
  {
    key: "staff_messaging",
    title: "Staff messaging",
    description: "May start direct conversations with other staff accounts that have messaging identity.",
  },
  {
    key: "member_messaging",
    title: "Member messaging",
    description: "May open direct conversations with members and decide how long they can reply/send.",
  },
  {
    key: "edit_profiles",
    title: "Edit user profiles",
    description: "May correct public profile fields. Every change is stored in the staff operations audit trail.",
  },
];

export default function StaffPermissionControl({
  userId,
  initial,
}: StaffPermissionControlProps) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [busy, setBusy] = useState<StaffCapability | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function toggle(capability: StaffCapability) {
    const next = !values[capability];
    setErrorMessage(null);
    setBusy(capability);

    try {
      await setStaffCapability({
        targetUserId: userId,
        capability,
        enabled: next,
      });
      setValues((current) => ({ ...current, [capability]: next }));
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Permission could not be changed."
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3">
      {PERMISSIONS.map((permission) => (
        <div
          key={permission.key}
          className="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="min-w-0">
            <p className="font-bold text-gray-950">{permission.title}</p>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-gray-500">
              {permission.description}
            </p>
          </div>

          <button
            type="button"
            disabled={busy !== null}
            onClick={() => toggle(permission.key)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${
              values[permission.key]
                ? "bg-green-600 text-white hover:bg-green-700"
                : "border border-gray-200 bg-gray-50 text-gray-600 hover:border-green-300 hover:text-green-700"
            }`}
          >
            {busy === permission.key
              ? "Saving..."
              : values[permission.key]
                ? "Enabled"
                : "Disabled"}
          </button>
        </div>
      ))}

      {errorMessage && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
