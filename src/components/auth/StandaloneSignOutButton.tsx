"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { supabase } from "@/utils/supabase/client";

export default function StandaloneSignOutButton() {
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
    <div className="relative">
      <button
        type="button"
        disabled={isSigningOut}
        onClick={signOut}
        className="rounded-xl border border-gray-200 bg-white px-5 py-3 font-semibold text-gray-700 transition hover:border-red-300 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSigningOut
          ? "Signing Out..."
          : "Sign Out"}
      </button>

      {errorMessage && (
        <div className="absolute right-0 top-full z-50 mt-2 w-72 rounded-xl border border-red-200 bg-red-50 p-3 shadow-lg">
          <p className="text-sm font-semibold text-red-700">
            {errorMessage}
          </p>
        </div>
      )}
    </div>
  );
}
