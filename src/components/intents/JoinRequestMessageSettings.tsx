"use client";

import {
  JOIN_MESSAGE_MODE_OPTIONS,
  type JoinMessageMode,
} from "@/utils/joinRequestMessage";

type JoinRequestMessageSettingsProps = {
  mode: JoinMessageMode;
  prompt: string;
  onModeChange: (
    mode: JoinMessageMode
  ) => void;
  onPromptChange: (
    prompt: string
  ) => void;
  disabled?: boolean;
  className?: string;
};

export default function JoinRequestMessageSettings({
  mode,
  prompt,
  onModeChange,
  onPromptChange,
  disabled = false,
  className = "",
}: JoinRequestMessageSettingsProps) {
  const selectedOption =
    JOIN_MESSAGE_MODE_OPTIONS.find(
      (option) =>
        option.value === mode
    ) ??
    JOIN_MESSAGE_MODE_OPTIONS[1];

  return (
    <section
      className={`rounded-2xl border border-green-100 bg-green-50/50 p-5 ${className}`.trim()}
    >
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-green-700">
        Join request
      </p>

      <h3 className="mt-2 text-lg font-bold text-gray-950">
        Decide what participants should answer
      </h3>

      <p className="mt-2 text-sm leading-6 text-gray-600">
        This setting applies when someone sends an I&apos;m in request. Direct invitations are not affected.
      </p>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-gray-700">
            Participant message
            <span
              aria-hidden="true"
              className="ml-1 text-red-600"
            >
              *
            </span>
          </span>

          <select
            value={mode}
            disabled={disabled}
            onChange={(event) =>
              onModeChange(
                event.target
                  .value as JoinMessageMode
              )
            }
            className="rounded-xl border border-gray-200 bg-white px-4 py-3 outline-none focus:border-green-500 disabled:bg-gray-100 disabled:text-gray-400"
          >
            {JOIN_MESSAGE_MODE_OPTIONS.map(
              (option) => (
                <option
                  key={option.value}
                  value={option.value}
                >
                  {option.label}
                </option>
              )
            )}
          </select>

          <span className="text-xs leading-5 text-gray-500">
            {selectedOption.description}
          </span>
        </label>

        {mode !== "none" && (
          <label className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-gray-700">
              What do you want to ask?
              <span
                aria-hidden="true"
                className="ml-1 text-red-600"
              >
                *
              </span>
            </span>

            <textarea
              value={prompt}
              disabled={disabled}
              required
              rows={4}
              maxLength={300}
              placeholder="For example: What interests you about this Activity?"
              onChange={(event) =>
                onPromptChange(
                  event.target.value
                )
              }
              className="resize-y rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm leading-6 outline-none focus:border-green-500 disabled:bg-gray-100 disabled:text-gray-400"
            />

            <span className="text-right text-xs text-gray-400">
              {prompt.length}/300
            </span>
          </label>
        )}
      </div>

      <p className="mt-4 text-xs leading-5 text-gray-500">
        Changing this later affects only new requests. Answers already sent remain unchanged.
      </p>
    </section>
  );
}
