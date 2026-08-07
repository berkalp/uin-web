"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { supabase } from "@/utils/supabase/client";

type TitleModerationActionsProps = {
  reportId: string;
};

export default function TitleModerationActions({
  reportId,
}: TitleModerationActionsProps) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [isWorking, setIsWorking] = useState(false);
  const [message, setMessage] = useState("");

  async function resolve(decision: "restore" | "remove") {
    if (isWorking) return;

    setIsWorking(true);
    setMessage("");

    try {
      const { error } = await supabase.rpc(
        "resolve_admin_plan_title_report",
        {
          p_report_id: reportId,
          p_decision: decision,
          p_note: note.trim() || null,
        }
      );

      if (error) throw error;

      setMessage(
        decision === "restore"
          ? "Report dismissed and the custom title restored."
          : "Custom title removed. The original Activity name remains."
      );
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "The moderation decision could not be saved."
      );
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <div className="mt-5 border-t border-gray-100 pt-5">
      <label className="block">
        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-500">
          Resolution note
        </span>
        <textarea
          value={note}
          disabled={isWorking}
          maxLength={1000}
          rows={3}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Optional internal note"
          className="mt-2 w-full resize-y rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-gray-400"
        />
      </label>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          disabled={isWorking}
          onClick={() => void resolve("restore")}
          className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-800 transition hover:bg-green-100 disabled:cursor-wait disabled:opacity-50"
        >
          Restore custom title
        </button>
        <button
          type="button"
          disabled={isWorking}
          onClick={() => void resolve("remove")}
          className="rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-wait disabled:opacity-50"
        >
          Remove custom title
        </button>
      </div>

      {message && (
        <p className="mt-3 text-xs font-semibold text-gray-700">{message}</p>
      )}
    </div>
  );
}
