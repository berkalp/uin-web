"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { deleteSeedJournalEntry } from "@/services/seedService";

type SeedJournalEntryActionsProps = {
  entryId: string;
};

export default function SeedJournalEntryActions({
  entryId,
}: SeedJournalEntryActionsProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function remove() {
    if (!window.confirm("Delete this Seed journal entry?")) {
      return;
    }

    setIsDeleting(true);
    setMessage(null);

    try {
      await deleteSeedJournalEntry(entryId);
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "The journal entry could not be deleted."
      );
      setIsDeleting(false);
    }
  }

  return (
    <div className="text-right">
      <button
        type="button"
        onClick={remove}
        disabled={isDeleting}
        className="text-xs font-bold text-red-600 hover:underline disabled:opacity-50"
      >
        {isDeleting ? "Deleting..." : "Delete"}
      </button>
      {message && (
        <p className="mt-1 max-w-xs text-xs font-semibold text-red-600">
          {message}
        </p>
      )}
    </div>
  );
}
