"use client";

import { supabase } from "@/utils/supabase/client";

export default function Home() {
  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      console.error(error);
    }
  };

  return (
    <main className="min-h-screen bg-white flex items-center justify-center">
      <div className="w-full max-w-md px-8 text-center">
        <img
          src="/uin-logo.png"
          alt="uin? logo"
          className="mx-auto h-24 w-auto"
        />

        <h1 className="mt-4 text-2xl font-bold text-gray-900">
          Are you in?
        </h1>

        <p className="mt-6 text-gray-500 leading-7">
          UIN helps people turn Intent
          <br />
          into real-world Activity.
        </p>

        <button
          onClick={signInWithGoogle}
          className="mt-12 w-full rounded-xl bg-green-600 py-4 text-lg font-semibold text-white transition hover:bg-green-700"
        >
          Continue with Google
        </button>

        <p className="mt-8 text-sm text-gray-400 leading-6">
          Build your Intent timeline.
          <br />
          Live with direction.
        </p>
      </div>
    </main>
  );
}