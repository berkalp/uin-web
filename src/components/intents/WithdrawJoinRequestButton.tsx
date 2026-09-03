"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { supabase } from "@/utils/supabase/client";

type WithdrawJoinRequestButtonProps = {
  requestId: string;
};

export default function WithdrawJoinRequestButton({
  requestId,
}: WithdrawJoinRequestButtonProps) {
  const router = useRouter();
  const [isWorking, setIsWorking] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function withdraw() {
    if (isWorking) return;

    setIsWorking(true);
    setErrorMessage("");

    try {
      const { error } = await supabase.rpc(
        "withdraw_intent_join_request",
        {
          p_request_id: requestId,
        }
      );

      if (error) throw error;

      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Katılım isteği geri çekilemedi."
      );
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        disabled={isWorking}
        onClick={() => void withdraw()}
        className="rounded-xl border border-red-200 bg-white px-4 py-2.5 text-xs font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-wait disabled:opacity-50"
      >
        {isWorking ? "Geri çekiliyor..." : "İsteği Geri Çek"}
      </button>

      {errorMessage && (
        <p className="mt-2 text-xs font-semibold text-red-700">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
