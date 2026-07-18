"use client";

import Link from "next/link";
import {
  useEffect,
  useState,
} from "react";
import { useRouter } from "next/navigation";

import { supabase } from "@/utils/supabase/client";

export default function SignOutButton() {
  const router = useRouter();

  const [
    username,
    setUsername,
  ] = useState<string | null>(
    null
  );

  const [
    isAdmin,
    setIsAdmin,
  ] = useState(false);

  const [
    isLoadingNavigation,
    setIsLoadingNavigation,
  ] = useState(true);

  const [
    isSigningOut,
    setIsSigningOut,
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState<string | null>(
    null
  );

  useEffect(() => {
    let isMounted = true;

    async function loadNavigation() {
      try {
        const {
          data: { user },
          error: userError,
        } =
          await supabase.auth.getUser();

        if (userError) {
          throw userError;
        }

        if (!user) {
          return;
        }

        const [
          profileResult,
          adminResult,
        ] = await Promise.all([
          supabase
            .from("profiles")
            .select("username")
            .eq("id", user.id)
            .maybeSingle(),

          supabase.rpc(
            "is_admin"
          ),
        ]);

        if (
          profileResult.error
        ) {
          console.error(
            "Profile navigation query failed:",
            profileResult.error
          );
        }

        if (
          adminResult.error
        ) {
          console.error(
            "Admin access query failed:",
            adminResult.error
          );
        }

        if (!isMounted) {
          return;
        }

        setUsername(
          profileResult.data
            ?.username ?? null
        );

        setIsAdmin(
          Boolean(
            adminResult.data
          )
        );
      } catch (error) {
        console.error(
          "Navigation loading failed:",
          error
        );
      } finally {
        if (isMounted) {
          setIsLoadingNavigation(
            false
          );
        }
      }
    }

    loadNavigation();

    return () => {
      isMounted = false;
    };
  }, []);

  async function handleSignOut() {
    if (isSigningOut) {
      return;
    }

    setErrorMessage(null);

    try {
      setIsSigningOut(true);

      const { error } =
        await supabase.auth.signOut();

      if (error) {
        throw error;
      }

      router.push("/");
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Sign out failed."
      );
    } finally {
      setIsSigningOut(false);
    }
  }

  return (
    <>
      {!isLoadingNavigation &&
        isAdmin && (
          <Link
            href="/admin"
            className="rounded-xl bg-gray-950 px-5 py-3 font-semibold text-white transition hover:bg-gray-800"
          >
            Admin Dashboard
          </Link>
        )}

      {!isLoadingNavigation &&
        username && (
          <Link
            href={`/u/${encodeURIComponent(
              username
            )}`}
            className="rounded-xl border border-gray-200 bg-white px-5 py-3 font-semibold text-gray-700 transition hover:border-green-500 hover:text-green-700"
          >
            My Profile
          </Link>
        )}

      <button
        type="button"
        onClick={handleSignOut}
        disabled={isSigningOut}
        className="rounded-xl border border-gray-200 bg-white px-5 py-3 font-semibold text-gray-700 transition hover:border-red-300 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSigningOut
          ? "Signing Out..."
          : "Sign Out"}
      </button>

      {errorMessage && (
        <p className="w-full text-center text-sm font-semibold text-red-700">
          {errorMessage}
        </p>
      )}
    </>
  );
}