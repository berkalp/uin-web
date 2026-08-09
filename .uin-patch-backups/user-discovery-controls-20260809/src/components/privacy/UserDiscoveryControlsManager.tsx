"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { supabase } from "@/utils/supabase/client";

export type UserDiscoveryControlRow = {
  target_user_id: string;
  target_full_name: string | null;
  target_username: string | null;
  target_avatar_url: string | null;
  control_type: "ignore" | "block";
  created_at: string;
  updated_at: string;
};

function getInitial(
  value: string
) {
  return (
    value
      .trim()
      .charAt(0)
      .toUpperCase() ||
    "?"
  );
}

export default function UserDiscoveryControlsManager({
  controls,
}: {
  controls:
    UserDiscoveryControlRow[];
}) {
  const router =
    useRouter();

  const [
    workingUserId,
    setWorkingUserId,
  ] = useState<
    string | null
  >(null);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  async function removeControl(
    targetUserId: string
  ) {
    if (workingUserId) {
      return;
    }

    setWorkingUserId(
      targetUserId
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
          "none",
      }
    );

    if (error) {
      setWorkingUserId(null);
      setErrorMessage(
        error.message ||
          "Privacy preference could not be updated."
      );
      return;
    }

    setWorkingUserId(null);
    router.refresh();
  }

  if (controls.length === 0) {
    return (
      <div className="rounded-3xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <p className="font-bold text-gray-950">
          No ignored or blocked people.
        </p>

        <p className="mt-2 text-sm leading-6 text-gray-500">
          People you hide from Discover or Matches will appear here.
        </p>
      </div>
    );
  }

  return (
    <div>
      {errorMessage && (
        <p
          role="alert"
          className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700"
        >
          {errorMessage}
        </p>
      )}

      <div className="space-y-3">
        {controls.map(
          (control) => {
            const name =
              control.target_full_name ||
              control.target_username ||
              "UIN member";

            const isBlocked =
              control.control_type ===
              "block";

            const isWorking =
              workingUserId ===
              control.target_user_id;

            return (
              <article
                key={
                  control.target_user_id
                }
                className="flex flex-col gap-4 rounded-3xl border border-gray-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center"
              >
                {control.target_avatar_url ? (
                  <img
                    src={
                      control.target_avatar_url
                    }
                    alt={name}
                    className="h-14 w-14 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gray-100 text-lg font-black text-gray-500">
                    {getInitial(name)}
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-black text-gray-950">
                      {name}
                    </p>

                    <span
                      className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${
                        isBlocked
                          ? "bg-red-50 text-red-700"
                          : "bg-amber-50 text-amber-700"
                      }`}
                    >
                      {isBlocked
                        ? "Blocked"
                        : "Ignored"}
                    </span>
                  </div>

                  {control.target_username && (
                    <p className="mt-1 truncate text-sm text-gray-500">
                      @
                      {
                        control.target_username
                      }
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  disabled={
                    workingUserId !==
                    null
                  }
                  onClick={() =>
                    void removeControl(
                      control.target_user_id
                    )
                  }
                  className={`shrink-0 rounded-xl border px-4 py-2.5 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                    isBlocked
                      ? "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                      : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {isWorking
                    ? "Updating…"
                    : isBlocked
                      ? "Unblock"
                      : "Stop ignoring"}
                </button>
              </article>
            );
          }
        )}
      </div>

      <p className="mt-5 rounded-2xl bg-gray-100 px-4 py-3 text-xs leading-5 text-gray-600">
        Unblocking does not restore a previous friendship, follow or request automatically.
      </p>
    </div>
  );
}
