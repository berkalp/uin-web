import Link from "next/link";
import {
  notFound,
  redirect,
} from "next/navigation";

import ProfileSettingsForm from "@/components/profile/ProfileSettingsForm";
import { createClient } from "@/utils/supabase/server";

type ProfileRow = {
  id: string;
  full_name: string | null;
  username: string;
  bio: string | null;
  city: string | null;
  country: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  email: string | null;
  created_at: string;
};

export default async function ProfileSettingsPage() {
  const supabase =
    await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  const {
    data: profileData,
    error: profileError,
  } = await supabase
    .from("profiles")
    .select(`
      id,
      full_name,
      username,
      bio,
      city,
      country,
      avatar_url,
      cover_url,
      email,
      created_at
    `)
    .eq("id", user.id)
    .maybeSingle();

  if (
    profileError ||
    !profileData
  ) {
    if (profileError) {
      console.error(
        "Profile settings query failed:",
        {
          message:
            profileError.message,
          code:
            profileError.code,
          details:
            profileError.details,
          hint:
            profileError.hint,
        }
      );
    }

    notFound();
  }

  const profile =
    profileData as ProfileRow;

  const fallbackName =
    user.user_metadata
      ?.full_name ??
    user.user_metadata?.name ??
    user.email?.split("@")[0] ??
    "UIN member";

  const fallbackAvatar =
    user.user_metadata
      ?.avatar_url ??
    user.user_metadata?.picture ??
    "";

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8 md:px-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6">
          <Link
            href={`/u/${profile.username}`}
            className="inline-flex rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700 transition hover:border-green-500 hover:text-green-700"
          >
            ← Back to Profile
          </Link>
        </div>

        <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm md:p-8">
          <div className="border-b border-gray-100 pb-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-green-600">
              Profile Settings
            </p>

            <h1 className="mt-2 text-3xl font-bold text-gray-900">
              Edit your profile
            </h1>

            <p className="mt-3 text-gray-500">
              This information will appear
              across Matches, Planning Rooms,
              Activity Rooms, and your public
              profile.
            </p>
          </div>

          <div className="mt-7">
            <ProfileSettingsForm
              profile={{
                fullName:
                  profile.full_name ??
                  fallbackName,
                username:
                  profile.username,
                bio:
                  profile.bio ?? "",
                city:
                  profile.city ?? "",
                country:
                  profile.country ??
                  "",
                avatarUrl:
                  profile.avatar_url ??
                  fallbackAvatar,
                coverUrl:
                  profile.cover_url ??
                  "",
                email:
                  profile.email ??
                  user.email ??
                  "",
                createdAt:
                  profile.created_at,
              }}
            />
          </div>
        </section>
      </div>
    </main>
  );
}