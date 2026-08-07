"use client";

import {
  useState,
} from "react";

type TimelineShareButtonProps = {
  title: string;
  text: string;
  url: string;
  className?: string;
};

export default function TimelineShareButton({
  title,
  text,
  url,
  className = "",
}: TimelineShareButtonProps) {
  const [
    copied,
    setCopied,
  ] = useState(false);

  async function handleShare() {
    const absoluteUrl =
      new URL(
        url,
        window.location.origin
      ).toString();

    try {
      if (
        typeof navigator.share ===
        "function"
      ) {
        await navigator.share({
          title,
          text,
          url: absoluteUrl,
        });

        return;
      }

      await navigator.clipboard.writeText(
        absoluteUrl
      );

      setCopied(true);

      window.setTimeout(
        () =>
          setCopied(false),
        1800
      );
    } catch (error) {
      if (
        error instanceof DOMException &&
        error.name ===
          "AbortError"
      ) {
        return;
      }

      console.error(
        "Profile Intent share failed:",
        error
      );
    }
  }

  return (
    <button
      type="button"
      onClick={
        handleShare
      }
      className={`flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-700 transition hover:border-green-300 hover:text-green-700 ${className}`}
    >
      <span aria-hidden="true">
        {copied
          ? "✓"
          : "↗"}
      </span>

      {copied
        ? "Copied"
        : "Share"}
    </button>
  );
}
