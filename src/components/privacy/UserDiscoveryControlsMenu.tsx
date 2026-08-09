"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useState,
} from "react";

import { supabase } from "@/utils/supabase/client";

type UserDiscoveryControlsMenuProps = {
  targetUserId: string;
  targetDisplayName?: string | null;
  compact?: boolean;
};

export default function UserDiscoveryControlsMenu({
  targetUserId,
  targetDisplayName = null,
  compact = false,
}: UserDiscoveryControlsMenuProps) {
  const router = useRouter();

  const [
    menuOpen,
    setMenuOpen,
  ] = useState(false);

  const [
    blockModalOpen,
    setBlockModalOpen,
  ] = useState(false);

  const [
    workingAction,
    setWorkingAction,
  ] = useState<
    "ignore" | "block" | null
  >(null);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  useEffect(() => {
    if (
      !menuOpen &&
      !blockModalOpen
    ) {
      return;
    }

    const onKeyDown = (
      event: KeyboardEvent
    ) => {
      if (event.key !== "Escape") {
        return;
      }

      if (!workingAction) {
        setMenuOpen(false);
        setBlockModalOpen(false);
        setErrorMessage("");
      }
    };

    window.addEventListener(
      "keydown",
      onKeyDown
    );

    return () => {
      window.removeEventListener(
        "keydown",
        onKeyDown
      );
    };
  }, [
    menuOpen,
    blockModalOpen,
    workingAction,
  ]);

  async function applyControl(
    controlType:
      | "ignore"
      | "block"
  ) {
    if (workingAction) {
      return;
    }

    setWorkingAction(
      controlType
    );
    setErrorMessage("");

    const {
      error,
    } = await supabase.rpc(
      "set_my_user_discovery_control",
      {
        p_target_user_id:
          targetUserId,
        p_control_type:
          controlType,
      }
    );

    if (error) {
      setWorkingAction(null);
      setErrorMessage(
        error.message ||
          "Privacy preference could not be updated."
      );
      return;
    }

    setMenuOpen(false);
    setBlockModalOpen(false);
    setWorkingAction(null);
    router.refresh();
  }

  const displayName =
    targetDisplayName?.trim() ||
    "this person";

  return (
    <>
      <button
        type="button"
        title="Person options"
        aria-label="Person options"
        aria-haspopup="dialog"
        aria-expanded={
          menuOpen ||
          blockModalOpen
        }
        onClick={() => {
          if (!workingAction) {
            setErrorMessage("");
            setMenuOpen(true);
          }
        }}
        className={`flex shrink-0 items-center justify-center rounded-full border border-white/25 bg-gray-950/75 font-black text-white shadow-sm backdrop-blur transition hover:bg-gray-950 ${
          compact
            ? "h-9 w-9 text-base"
            : "h-8 w-8 text-sm"
        }`}
      >
        <span aria-hidden="true">
          •••
        </span>
      </button>

      {menuOpen && (
        <div
          className="fixed inset-0 z-[190] flex items-end justify-center bg-gray-950/35 p-3 backdrop-blur-[2px] sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label="Person options"
          onMouseDown={(
            event
          ) => {
            if (
              event.target ===
                event.currentTarget &&
              !workingAction
            ) {
              setMenuOpen(false);
              setErrorMessage("");
            }
          }}
        >
          <div className="w-full max-w-md overflow-hidden rounded-3xl border border-gray-200 bg-white text-left shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-gray-400">
                  Person options
                </p>

                <p className="mt-1 truncate font-black text-gray-950">
                  {displayName}
                </p>
              </div>

              <button
                type="button"
                disabled={
                  workingAction !==
                  null
                }
                onClick={() =>
                  setMenuOpen(false)
                }
                className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-lg font-bold text-gray-500 transition hover:bg-gray-200 disabled:opacity-50"
                aria-label="Cancel"
              >
                ×
              </button>
            </div>

            <div className="p-2">
              <button
                type="button"
                disabled={
                  workingAction !==
                  null
                }
                onClick={() =>
                  void applyControl(
                    "ignore"
                  )
                }
                className="block w-full rounded-2xl px-4 py-3.5 text-left transition hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span className="block text-sm font-black text-gray-950">
                  {workingAction ===
                  "ignore"
                    ? "Ignoring…"
                    : "Ignore this person"}
                </span>

                <span className="mt-1 block text-xs leading-5 text-gray-500">
                  Hide their Intents and Seeds from your Discover and Matches. They can still see you.
                </span>
              </button>

              <button
                type="button"
                disabled={
                  workingAction !==
                  null
                }
                onClick={() => {
                  setMenuOpen(false);
                  setBlockModalOpen(
                    true
                  );
                  setErrorMessage("");
                }}
                className="mt-1 block w-full rounded-2xl px-4 py-3.5 text-left transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span className="block text-sm font-black text-red-700">
                  Block this person
                </span>

                <span className="mt-1 block text-xs leading-5 text-gray-500">
                  Hide each other across Discover, Matches, Intents and Seeds.
                </span>
              </button>
            </div>

            <div className="border-t border-gray-100 p-2">
              <Link
                href="/settings/privacy"
                onClick={() =>
                  setMenuOpen(false)
                }
                className="block rounded-2xl px-4 py-3 text-sm font-bold text-gray-600 transition hover:bg-gray-50 hover:text-green-700"
              >
                Privacy settings
              </Link>
            </div>

            {errorMessage && (
              <p
                role="alert"
                className="border-t border-red-100 bg-red-50 px-5 py-3 text-xs font-semibold leading-5 text-red-700"
              >
                {errorMessage}
              </p>
            )}
          </div>
        </div>
      )}

      {blockModalOpen && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-gray-950/55 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby={`block-person-title-${targetUserId}`}
          onMouseDown={(
            event
          ) => {
            if (
              event.target ===
                event.currentTarget &&
              !workingAction
            ) {
              setBlockModalOpen(
                false
              );
              setErrorMessage("");
            }
          }}
        >
          <div className="w-full max-w-md overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-2xl">
            <div className="p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-xl">
                ⛔
              </div>

              <h2
                id={`block-person-title-${targetUserId}`}
                className="mt-4 text-2xl font-black text-gray-950"
              >
                Block this person?
              </h2>

              <p className="mt-3 text-sm leading-6 text-gray-600">
                You and {displayName} will stop seeing each other in discovery. Friendship, follows and pending requests between you will be removed. Existing shared Activities stay in your history.
              </p>

              {errorMessage && (
                <p
                  role="alert"
                  className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700"
                >
                  {errorMessage}
                </p>
              )}

              <div className="mt-6 flex flex-wrap justify-end gap-3">
                <button
                  type="button"
                  disabled={
                    workingAction !==
                    null
                  }
                  onClick={() => {
                    setBlockModalOpen(
                      false
                    );
                    setErrorMessage("");
                  }}
                  className="rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-bold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  disabled={
                    workingAction !==
                    null
                  }
                  onClick={() =>
                    void applyControl(
                      "block"
                    )
                  }
                  className="rounded-xl bg-red-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {workingAction ===
                  "block"
                    ? "Blocking…"
                    : "Block"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
