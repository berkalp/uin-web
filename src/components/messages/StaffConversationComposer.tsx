"use client";

import {
  FormEvent,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";

import { openStaffConversation } from "@/services/directMessageService";

type StaffConversationComposerProps = {
  target: {
    userId: string;
    fullName: string;
    username: string | null;
    avatarUrl: string | null;
    isStaffTarget: boolean;
  };
};

type AccessPreset =
  | "1d"
  | "7d"
  | "30d"
  | "1y"
  | "20y"
  | "custom";

function getInitial(value: string) {
  return value.trim().charAt(0).toUpperCase() || "?";
}

function toLocalDateTimeInput(date: Date) {
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
}

function addPreset(now: Date, preset: AccessPreset) {
  const result = new Date(now);

  if (preset === "1d") {
    result.setDate(result.getDate() + 1);
  } else if (preset === "7d") {
    result.setDate(result.getDate() + 7);
  } else if (preset === "30d") {
    result.setDate(result.getDate() + 30);
  } else if (preset === "1y") {
    result.setFullYear(result.getFullYear() + 1);
  } else if (preset === "20y") {
    result.setFullYear(result.getFullYear() + 20);
  }

  return result;
}

export default function StaffConversationComposer({
  target,
}: StaffConversationComposerProps) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [preset, setPreset] = useState<AccessPreset>("1d");
  const [customExpiry, setCustomExpiry] = useState(() =>
    toLocalDateTimeInput(addPreset(new Date(), "1d"))
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const accessText = useMemo(() => {
    if (target.isStaffTarget) {
      return "Staff-to-staff access stays open while both accounts keep messaging permission.";
    }

    if (preset === "1d") return "Reply/send access for 1 day";
    if (preset === "7d") return "Reply/send access for 7 days";
    if (preset === "30d") return "Reply/send access for 30 days";
    if (preset === "1y") return "Reply/send access for 1 year";
    if (preset === "20y") return "Reply/send access for 20 years";
    return "Custom reply/send access";
  }, [preset, target.isStaffTarget]);

  function resolveExpiry() {
    if (target.isStaffTarget) {
      return null;
    }

    if (preset === "custom") {
      const parsed = new Date(customExpiry);
      if (!Number.isFinite(parsed.getTime())) {
        throw new Error("Choose a valid access expiry.");
      }
      return parsed.toISOString();
    }

    return addPreset(new Date(), preset).toISOString();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    const cleanBody = body.trim();
    if (!cleanBody) {
      setErrorMessage("Write a message first.");
      return;
    }

    try {
      setIsSubmitting(true);
      const conversationId = await openStaffConversation({
        targetUserId: target.userId,
        body: cleanBody,
        memberAccessExpiresAt: resolveExpiry(),
      });

      router.push(`/messages/${encodeURIComponent(conversationId)}`);
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "The conversation could not be opened."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-4">
          {target.avatarUrl ? (
            <img
              src={target.avatarUrl}
              alt={target.fullName}
              className="h-16 w-16 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-50 text-xl font-bold text-green-700">
              {getInitial(target.fullName)}
            </div>
          )}

          <div className="min-w-0">
            <p className="font-bold text-gray-950">{target.fullName}</p>
            {target.username && (
              <p className="mt-1 text-sm text-gray-500">@{target.username}</p>
            )}
            <span className="mt-2 inline-flex rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
              {target.isStaffTarget ? "Staff conversation" : "Member conversation"}
            </span>
          </div>
        </div>
      </section>

      {!target.isStaffTarget && (
        <section className="rounded-3xl border border-amber-200 bg-amber-50/50 p-6">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-700">
            Messaging access
          </p>
          <h2 className="mt-2 text-xl font-bold text-gray-950">
            How long may this member reply and message you?
          </h2>
          <p className="mt-2 text-sm leading-6 text-gray-600">
            The conversation remains readable after the deadline. Only sending is locked.
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            {([
              ["1d", "1 day"],
              ["7d", "7 days"],
              ["30d", "30 days"],
              ["1y", "1 year"],
              ["20y", "20 years"],
              ["custom", "Custom"],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setPreset(value);
                  if (value !== "custom") {
                    setCustomExpiry(toLocalDateTimeInput(addPreset(new Date(), value)));
                  }
                }}
                className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                  preset === value
                    ? "border-amber-500 bg-amber-500 text-white"
                    : "border-amber-200 bg-white text-amber-800 hover:border-amber-400"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {preset === "custom" && (
            <div className="mt-4 max-w-sm">
              <label htmlFor="message-access-expiry" className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Access expires
              </label>
              <input
                id="message-access-expiry"
                type="datetime-local"
                value={customExpiry}
                onChange={(event) => setCustomExpiry(event.target.value)}
                className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
              />
            </div>
          )}

          <p className="mt-4 text-sm font-semibold text-amber-900">{accessText}</p>
        </section>
      )}

      {target.isStaffTarget && (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5 text-sm leading-6 text-blue-900">
          {accessText}
        </div>
      )}

      <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
        <label htmlFor="staff-message-body" className="text-xs font-bold uppercase tracking-[0.16em] text-green-700">
          Message
        </label>
        <textarea
          id="staff-message-body"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          maxLength={5000}
          rows={7}
          placeholder={`Write to ${target.fullName}...`}
          className="mt-3 w-full resize-y rounded-2xl border border-gray-200 px-4 py-4 leading-7 text-gray-900 outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-100"
        />
        <div className="mt-2 flex justify-between gap-3 text-xs text-gray-400">
          <span>This is a real two-way conversation, not a moderation notice.</span>
          <span>{body.length}/5000</span>
        </div>

        {errorMessage && (
          <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {errorMessage}
          </p>
        )}

        <div className="mt-5 flex justify-end">
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-xl bg-green-600 px-6 py-3 font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? "Sending..." : "Send & open conversation"}
          </button>
        </div>
      </section>
    </form>
  );
}
