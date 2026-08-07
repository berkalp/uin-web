export type JoinMessageMode =
  | "none"
  | "optional"
  | "required";

export const DEFAULT_JOIN_MESSAGE_PROMPT =
  "Why would you like to join this Intent?";

export const JOIN_MESSAGE_MODE_OPTIONS: {
  value: JoinMessageMode;
  label: string;
  description: string;
}[] = [
  {
    value: "none",
    label: "Do not ask for a message",
    description:
      "Participants send the request without writing anything.",
  },
  {
    value: "optional",
    label: "Ask for an optional answer",
    description:
      "Participants see your question but may send the request without answering.",
  },
  {
    value: "required",
    label: "Require an answer",
    description:
      "Participants must answer your question before sending the request.",
  },
];

export function normalizeJoinMessageMode(
  value: unknown
): JoinMessageMode {
  return value === "none" ||
    value === "required"
    ? value
    : "optional";
}

export function normalizeJoinMessagePrompt(
  mode: JoinMessageMode,
  value: unknown
) {
  if (mode === "none") {
    return "";
  }

  if (typeof value !== "string") {
    return DEFAULT_JOIN_MESSAGE_PROMPT;
  }

  const normalized = value.trim();

  return normalized ||
    DEFAULT_JOIN_MESSAGE_PROMPT;
}

export function isJoinMessageSettingsValid(
  mode: JoinMessageMode,
  prompt: string
) {
  if (mode === "none") {
    return true;
  }

  const normalized = prompt.trim();

  return (
    normalized.length > 0 &&
    normalized.length <= 300
  );
}
