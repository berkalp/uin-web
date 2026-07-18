"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { supabase } from "@/utils/supabase/client";

export default function AccountMenuSignOutButton() {
  const router = useRouter();

  const [
    isSigningOut,
    setIsSigningOut,
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  async function signOut() {
    setIsSigningOut(true);
    setErrorMessage("");

    try {
      const {
        error,
      } =
        await supabase.auth.signOut();

      if (error) {
        throw error;
      }

      router.replace("/");
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Sign out failed."
      );

      setIsSigningOut(false);
    }
  }

  return (
    <div className="border-t border-gray-100 p-2">
      <button
        type="button"
        disabled={isSigningOut}
        onClick={signOut}
        className="w-full rounded-xl px-4 py-3 text-left text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-50"
      >
        {isSigningOut
          ? "Signing Out..."
          : "Sign Out"}
      </button>

      {errorMessage && (
        <p className="px-4 pb-2 text-xs font-semibold text-red-700">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
