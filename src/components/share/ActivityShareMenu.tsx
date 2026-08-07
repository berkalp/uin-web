"use client";

import {
  useState,
} from "react";

type ActivityShareMenuProps = {
  title: string;
  text: string;
  url: string;
  isPublic: boolean;
};

function ShareIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      className="h-4 w-4"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle
        cx="18"
        cy="5"
        r="3"
      />
      <circle
        cx="6"
        cy="12"
        r="3"
      />
      <circle
        cx="18"
        cy="19"
        r="3"
      />
      <path d="m8.6 10.7 6.8-4.1" />
      <path d="m8.6 13.3 6.8 4.1" />
    </svg>
  );
}

export default function ActivityShareMenu({
  title,
  text,
  url,
  isPublic,
}: ActivityShareMenuProps) {
  const [
    copied,
    setCopied,
  ] = useState(
    false
  );

  const encodedUrl =
    encodeURIComponent(
      url
    );

  const encodedText =
    encodeURIComponent(
      `${text}\n${url}`
    );

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(
        url
      );

      setCopied(
        true
      );

      window.setTimeout(
        () =>
          setCopied(
            false
          ),
        1800
      );
    } catch {
      window.prompt(
        "Copy this link:",
        url
      );
    }
  }

  async function shareViaDevice() {
    if (
      typeof navigator.share !==
      "function"
    ) {
      await copyLink();
      return;
    }

    try {
      await navigator.share({
        title,
        text,
        url,
      });
    } catch (
      error
    ) {
      if (
        error instanceof
          DOMException &&
        error.name ===
          "AbortError"
      ) {
        return;
      }

      console.error(
        "Activity share failed:",
        error
      );
    }
  }

  return (
    <details className="group relative z-50">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-gray-700 shadow-sm transition hover:border-green-300 hover:text-green-700 [&::-webkit-details-marker]:hidden">
        <ShareIcon />
        Share

        <span className="text-[10px] text-gray-400 transition group-open:rotate-180">
          ▼
        </span>
      </summary>

      <div className="absolute right-0 top-full mt-2 w-80 overflow-hidden rounded-2xl border border-gray-200 bg-white p-2 text-left shadow-2xl">
        <div className="mb-1 rounded-xl border border-green-100 bg-green-50/70 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-green-700">
            Intent share preview
          </p>

          <p className="mt-1 text-sm font-bold text-gray-950">
            {title}
          </p>

          <p className="mt-1 text-xs leading-5 text-gray-600">
            {text}
          </p>
        </div>

        <button
          type="button"
          onClick={
            shareViaDevice
          }
          className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-gray-800 transition hover:bg-gray-50"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-950 text-xs font-bold text-white">
            ↗
          </span>
          Share via device
        </button>

        <a
          href={`https://wa.me/?text=${encodedText}`}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-gray-800 transition hover:bg-green-50 hover:text-green-800"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-green-600 text-xs font-bold text-white">
            WA
          </span>
          WhatsApp
        </a>

        <a
          href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(
            text
          )}&url=${encodedUrl}`}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-gray-800 transition hover:bg-gray-100"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-950 text-xs font-bold text-white">
            X
          </span>
          X
        </a>

        <a
          href={`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-gray-800 transition hover:bg-blue-50 hover:text-blue-800"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
            f
          </span>
          Facebook
        </a>

        <a
          href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-gray-800 transition hover:bg-sky-50 hover:text-sky-800"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-700 text-xs font-bold text-white">
            in
          </span>
          LinkedIn
        </a>

        <button
          type="button"
          onClick={
            copyLink
          }
          className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-gray-800 transition hover:bg-amber-50 hover:text-amber-900"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 text-sm font-bold text-amber-800">
            ⧉
          </span>
          {copied
            ? "Link copied"
            : "Copy link"}
        </button>

        <div className="mx-2 mt-1 border-t border-gray-100 px-1 py-3">
          <p className="text-xs leading-5 text-gray-500">
            {isPublic
              ? "Public preview enabled. The cover, title and approximate details can appear in supported apps."
              : "This link follows the selected visibility. Social crawlers receive a generic UIN preview."}
          </p>
        </div>
      </div>
    </details>
  );
}
