"use client";

import {
  FormEvent,
  KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";

import { sendPlanMessage } from "@/services/planMessageService";

type PlanMessageComposerProps = {
  planId: string;
};

export default function PlanMessageComposer({
  planId,
}: PlanMessageComposerProps) {
  const router = useRouter();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [body, setBody] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const conversationBottom = document.getElementById("plan-conversation-bottom");

    conversationBottom?.scrollIntoView({
      behavior: "instant",
      block: "end",
    });
  }, []);

  function resizeTextarea() {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 132)}px`;
  }

  async function submitMessage() {
    const cleanedBody = body.trim();

    if (!cleanedBody || isSending) return;

    setErrorMessage(null);

    try {
      setIsSending(true);

      await sendPlanMessage({
        planId,
        body: cleanedBody,
      });

      setBody("");
      if (textareaRef.current) textareaRef.current.style.height = "auto";

      router.refresh();

      window.setTimeout(() => {
        const conversationBottom = document.getElementById("plan-conversation-bottom");

        conversationBottom?.scrollIntoView({
          behavior: "smooth",
          block: "end",
        });

        textareaRef.current?.focus();
      }, 150);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Mesaj gönderilemedi."
      );
    } finally {
      setIsSending(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submitMessage();
  }

  async function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      await submitMessage();
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="shrink-0 border-t border-gray-200 bg-white px-4 py-3.5"
    >
      {errorMessage && (
        <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {errorMessage}
        </div>
      )}

      <div className="flex items-end gap-2.5">
        <div className="min-w-0 flex-1 rounded-[24px] bg-gray-100 px-1.5 py-1.5 transition focus-within:bg-white focus-within:ring-2 focus-within:ring-green-100">
          <textarea
            ref={textareaRef}
            value={body}
            onChange={(event) => {
              setBody(event.target.value);
              window.requestAnimationFrame(resizeTextarea);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Mesaj yaz..."
            rows={1}
            maxLength={2000}
            disabled={isSending}
            className="max-h-[132px] min-h-[46px] w-full resize-none overflow-y-auto border-0 bg-transparent px-3.5 py-2.5 text-[15px] leading-6 text-gray-900 outline-none placeholder:text-gray-400 disabled:cursor-not-allowed disabled:opacity-60"
          />
        </div>

        <button
          type="submit"
          disabled={isSending || !body.trim()}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-green-600 text-xl font-black text-white shadow-sm transition hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400"
          aria-label={isSending ? "Mesaj gönderiliyor" : "Mesaj gönder"}
          title={isSending ? "Gönderiliyor..." : "Gönder"}
        >
          {isSending ? "…" : "↑"}
        </button>
      </div>

      <div className="mt-1.5 flex items-center justify-between px-3 text-[11px] font-semibold text-gray-400">
        <span>Enter gönderir · Shift + Enter yeni satır</span>
        {body.length > 1700 && <span>{body.length}/2000</span>}
      </div>
    </form>
  );
}
