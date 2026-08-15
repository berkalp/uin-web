"use client";

import { useState, type ReactNode } from "react";

type TimelineProfileDetailsShellProps = {
  children: ReactNode;
};

export default function TimelineProfileDetailsShell({
  children,
}: TimelineProfileDetailsShellProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <section className="mt-8">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        aria-expanded={isOpen}
        aria-controls="timeline-profile-details"
        className="group flex min-h-12 w-full items-center justify-between rounded-2xl border border-gray-200 bg-white px-4 py-2.5 text-left shadow-sm transition hover:border-green-200 hover:bg-green-50/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 md:px-5"
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-50 text-green-700 transition group-hover:bg-green-100">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.9"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
              aria-hidden="true"
            >
              <path d="M20 21a8 8 0 0 0-16 0" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </span>
          <span className="truncate text-sm font-bold text-gray-900 md:text-[15px]">
            Profil detaylarım
          </span>
        </span>

        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`h-5 w-5 shrink-0 text-gray-400 transition-transform duration-200 group-hover:text-green-700 ${
            isOpen ? "rotate-180" : ""
          }`}
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      <div
        id="timeline-profile-details"
        className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out ${
          isOpen
            ? "grid-rows-[1fr] opacity-100"
            : "pointer-events-none grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          <div className="pt-3">{children}</div>
        </div>
      </div>
    </section>
  );
}
