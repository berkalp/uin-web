"use client";

import {
  FormEvent,
  KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";

import {
  sendPlanMessage,
} from "@/services/planMessageService";

type PlanMessageComposerProps = {
  planId: string;
};

export default function PlanMessageComposer({
  planId,
}: PlanMessageComposerProps) {
  const router = useRouter();

  const textareaRef =
    useRef<HTMLTextAreaElement | null>(
      null
    );

  const [body, setBody] =
    useState("");

  const [isSending, setIsSending] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);

  useEffect(() => {
    const conversationBottom =
      document.getElementById(
        "plan-conversation-bottom"
      );

    conversationBottom?.scrollIntoView({
      behavior: "instant",
      block: "end",
    });
  }, []);

  async function submitMessage() {
    const cleanedBody = body.trim();

    if (!cleanedBody || isSending) {
      return;
    }

    setErrorMessage(null);

    try {
      setIsSending(true);

      await sendPlanMessage({
        planId,
        body: cleanedBody,
      });

      setBody("");

      router.refresh();

      window.setTimeout(() => {
        const conversationBottom =
          document.getElementById(
            "plan-conversation-bottom"
          );

        conversationBottom?.scrollIntoView({
          behavior: "smooth",
          block: "end",
        });

        textareaRef.current?.focus();
      }, 150);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "The message could not be sent."
      );
    } finally {
      setIsSending(false);
    }
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    await submitMessage();
  }

  async function handleKeyDown(
    event: KeyboardEvent<HTMLTextAreaElement>
  ) {
    if (
      event.key === "Enter" &&
      !event.shiftKey
    ) {
      event.preventDefault();
      await submitMessage();
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="border-t border-gray-200 bg-white p-4"
    >
      {errorMessage && (
        <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {errorMessage}
        </div>
      )}

      <div className="flex items-end gap-3">
        <div className="min-w-0 flex-1">
          <textarea
            ref={textareaRef}
            value={body}
            onChange={(event) =>
              setBody(
                event.target.value
              )
            }
            onKeyDown={handleKeyDown}
            placeholder="Write a message..."
            rows={2}
            maxLength={2000}
            disabled={isSending}
            className="w-full resize-none rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-green-500 focus:bg-white focus:ring-2 focus:ring-green-100 disabled:cursor-not-allowed disabled:opacity-60"
          />

          <div className="mt-1 flex items-center justify-between px-1">
            <p className="text-xs text-gray-400">
              Press Enter to send. Use
              Shift + Enter for a new line.
            </p>

            <p className="text-xs text-gray-400">
              {body.length}/2000
            </p>
          </div>
        </div>

        <button
          type="submit"
          disabled={
            isSending ||
            !body.trim()
          }
          className="rounded-2xl bg-green-600 px-5 py-3 font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSending
            ? "Sending..."
            : "Send"}
        </button>
      </div>
    </form>
  );
}