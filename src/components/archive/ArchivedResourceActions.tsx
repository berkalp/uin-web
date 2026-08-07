"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  deleteArchivedIntent,
  restoreArchivedResource,
  type ArchiveResourceType,
} from "@/services/resourceArchiveService";

type ArchivedResourceActionsProps = {
  resourceType: ArchiveResourceType;
  resourceId: string;
  canDeletePermanently: boolean;
};

export default function ArchivedResourceActions({
  resourceType,
  resourceId,
  canDeletePermanently,
}: ArchivedResourceActionsProps) {
  const router = useRouter();
  const [workingAction, setWorkingAction] = useState<"restore" | "delete" | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleRestore() {
    setErrorMessage("");
    setWorkingAction("restore");

    try {
      await restoreArchivedResource(resourceType, resourceId);
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "The record could not be restored."
      );
    } finally {
      setWorkingAction(null);
    }
  }

  async function handleDelete() {
    if (resourceType !== "intent" || !canDeletePermanently) return;

    const confirmed = window.confirm(
      "Delete this Intent permanently? This cannot be undone."
    );

    if (!confirmed) return;

    setErrorMessage("");
    setWorkingAction("delete");

    try {
      await deleteArchivedIntent(resourceId);
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "The Intent could not be deleted."
      );
    } finally {
      setWorkingAction(null);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={workingAction !== null}
          onClick={handleRestore}
          className="rounded-xl bg-green-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-green-700 disabled:cursor-wait disabled:opacity-50"
        >
          {workingAction === "restore" ? "Restoring…" : "Restore"}
        </button>

        {resourceType === "intent" && canDeletePermanently && (
          <button
            type="button"
            disabled={workingAction !== null}
            onClick={handleDelete}
            className="rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-wait disabled:opacity-50"
          >
            {workingAction === "delete" ? "Deleting…" : "Delete permanently"}
          </button>
        )}
      </div>

      {resourceType === "intent" && !canDeletePermanently && (
        <p className="mt-3 text-xs leading-5 text-gray-500">
          This Intent has shared or interaction history, so it can stay archived but cannot be deleted permanently.
        </p>
      )}

      {errorMessage && (
        <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
