"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { supabase } from "@/utils/supabase/client";

type ReportReason =
  | "offensive_abusive"
  | "hate_harassment"
  | "sexual_content"
  | "spam_advertising"
  | "misleading"
  | "other";

type ReportCustomActivityTitleButtonProps = {
  planId: string;
  customTitle: string;
  canonicalTitle: string;
  compact?: boolean;
};

const REASONS: ReadonlyArray<{
  value: ReportReason;
  label: string;
}> = [
  { value: "offensive_abusive", label: "Offensive or abusive" },
  { value: "hate_harassment", label: "Hate or harassment" },
  { value: "sexual_content", label: "Sexual content" },
  { value: "spam_advertising", label: "Spam or advertising" },
  { value: "misleading", label: "Misleading" },
  { value: "other", label: "Other" },
];

export default function ReportCustomActivityTitleButton({
  planId,
  customTitle,
  canonicalTitle,
  compact = false,
}: ReportCustomActivityTitleButtonProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason>("offensive_abusive");
  const [details, setDetails] = useState("");
  const [isWorking, setIsWorking] = useState(false);
  const [message, setMessage] = useState("");

  async function submitReport() {
    if (isWorking) return;

    setIsWorking(true);
    setMessage("");

    try {
      const { error } = await supabase.rpc("report_shared_activity_title", {
        p_plan_id: planId,
        p_reason: reason,
        p_details: details.trim() || null,
      });

      if (error) throw error;

      setMessage(
        "Reported. The original Activity name is shown immediately while the title is reviewed."
      );
      setIsOpen(false);
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "The custom title could not be reported."
      );
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <div className={compact ? "inline-flex flex-col" : "mt-3"}>
      <button
        type="button"
        onClick={() => {
          setMessage("");
          setIsOpen((value) => !value);
        }}
        className={
          compact
            ? "text-[11px] font-semibold text-white/70 underline decoration-white/30 underline-offset-4 transition hover:text-white"
            : "rounded-xl border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-50"
        }
      >
        Report custom title
      </button>

      {isOpen && (
        <div className="mt-3 w-full max-w-xl rounded-2xl border border-red-200 bg-white p-4 text-left text-gray-900 shadow-xl">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-red-700">
            Report custom Activity title
          </p>
          <p className="mt-2 text-sm font-bold text-gray-950">“{customTitle}”</p>
          <p className="mt-1 text-xs text-gray-500">
            Activity type · {canonicalTitle}
          </p>
          <p className="mt-3 text-xs leading-5 text-gray-500">
            Reporting hides the custom title immediately and falls back to the
            original Activity name. The Activity itself is not cancelled and
            reputation is not affected by the report alone.
          </p>

          <label className="mt-4 block">
            <span className="text-xs font-semibold text-gray-700">Reason</span>
            <select
              value={reason}
              disabled={isWorking}
              onChange={(event) => setReason(event.target.value as ReportReason)}
              className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-red-400"
            >
              {REASONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          <label className="mt-3 block">
            <span className="text-xs font-semibold text-gray-700">
              Details <span className="font-normal text-gray-400">optional</span>
            </span>
            <textarea
              value={details}
              disabled={isWorking}
              maxLength={1000}
              rows={3}
              onChange={(event) => setDetails(event.target.value)}
              className="mt-2 w-full resize-y rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-red-400"
              placeholder="Add context for the moderation team."
            />
            <span className="mt-1 block text-right text-[10px] text-gray-400">
              {details.length}/1000
            </span>
          </label>

          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              disabled={isWorking}
              onClick={() => setIsOpen(false)}
              className="rounded-xl border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-600"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isWorking}
              onClick={() => void submitReport()}
              className="rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white disabled:cursor-wait disabled:opacity-60"
            >
              {isWorking ? "Reporting..." : "Report title"}
            </button>
          </div>
        </div>
      )}

      {message && !isOpen && (
        <p className={`${compact ? "mt-2 text-white/80" : "mt-2 text-red-700"} text-xs font-semibold`}>
          {message}
        </p>
      )}
    </div>
  );
}
