"use client";

import { useState } from "react";
import { createIntentRequest } from "@/services/intentRequestService";

type ImInButtonProps = {
  requesterId: string;
  receiverId: string;
  ownIntentId: string;
  targetIntentId: string;
};

export default function ImInButton({
  requesterId,
  receiverId,
  ownIntentId,
  targetIntentId,
}: ImInButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "sent" | "error">("idle");

  const handleClick = async () => {
    setIsLoading(true);
    setStatus("idle");

    try {
      await createIntentRequest({
        requesterId,
        receiverId,
        ownIntentId,
        targetIntentId,
      });

      setStatus("sent");
    } catch (error) {
      console.error(error);
      setStatus("error");
    } finally {
      setIsLoading(false);
    }
  };

  if (status === "sent") {
    return (
      <button
        disabled
        className="rounded-xl bg-gray-200 px-5 py-3 font-semibold text-gray-500"
      >
        Request Sent
      </button>
    );
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        onClick={handleClick}
        disabled={isLoading}
        className="rounded-xl bg-green-600 px-5 py-3 font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-gray-300"
      >
        {isLoading ? "Sending..." : "I'm in"}
      </button>

      {status === "error" && (
        <p className="text-sm text-red-600">
          Request could not be sent. It may already exist.
        </p>
      )}
    </div>
  );
}