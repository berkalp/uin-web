import Link from "next/link";
import {
  notFound,
  redirect,
} from "next/navigation";

import AgeAndFamilyManager, {
  type FamilyCenterData,
} from "@/components/family/AgeAndFamilyManager";
import PublicFamilyManager, {
  type PublicFamilySettingsData,
} from "@/components/family/PublicFamilyManager";
import ProfilePresenceSettingsForm from "@/components/profile/ProfilePresenceSettingsForm";
import ProfileConnectionsFamilySettingsForm from "@/components/profile/ProfileConnectionsFamilySettingsForm";
import ProfileSettingsForm from "@/components/profile/ProfileSettingsForm";
import type {
  ProfileEmbed,
  ProfileLink,
} from "@/utils/profilePresence";
import { createClient } from "@/utils/supabase/server";
import type { ProfileConnectionsFamilySettings } from "@/utils/profileConnections";
import type { ProfileActivityVisibility } from "@/utils/profileActivityVisibility";
import type { PawVisibility } from "@/utils/intentReactions";

type ProfileRow = {
  id: string;
  full_name: string | null;
  username: string;
  bio: string | null;
  city: string | null;
  country: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  gender: "female" | "male" | "non_binary" | "prefer_not_to_say" | null;
  show_gender: boolean | null;
  participation_profile_visibility: ProfileActivityVisibility | null;
  paw_profile_visibility: PawVisibility | null;
  email: string | null;
  created_at: string;
};

type ProfilePresenceData = {
  links: ProfileLink[];
  embeds: ProfileEmbed[];
};

export default async function ProfileSettingsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  const [
    profileResult,
    presenceResult,
    connectionsFamilyResult,
    familyResponse,
    publicFamilyResponse,
  ] = await Promise.all([
    supabase
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
        gender,
        show_gender,
        participation_profile_visibility,
        paw_profile_visibility,
        email,
        created_at
      `)
      .eq("id", user.id)
      .maybeSingle(),

    supabase.rpc("get_my_profile_presence"),
    supabase.rpc("get_my_profile_connections_family_settings"),
    supabase.rpc("get_my_family_center"),
    supabase.rpc("get_my_public_family_settings"),
  ]);

  const {
    data: profileData,
    error: profileError,
  } = profileResult;

  if (profileError || !profileData) {
    if (profileError) {
      console.error("Profile settings query failed:", {
        message: profileError.message,
        code: profileError.code,
        details: profileError.details,
        hint: profileError.hint,
      });
    }

    notFound();
  }

  if (connectionsFamilyResult.error) {
    console.error(
      "Profile connection and family settings query failed:",
      connectionsFamilyResult.error
    );
  }

  if (presenceResult.error) {
    console.error(
      "Profile presence query failed:",
      presenceResult.error
    );
  }

  if (familyResponse.error) {
    console.error(
      "Age and family settings query failed:",
      familyResponse.error
    );
  }

  if (publicFamilyResponse.error) {
    console.error(
      "Public family settings query failed:",
      publicFamilyResponse.error
    );
  }

  const profile = profileData as ProfileRow;

  const presence = (
    presenceResult.data ?? {
      links: [],
      embeds: [],
    }
  ) as ProfilePresenceData;

  const connectionsFamily = (
    connectionsFamilyResult.data ?? {
      connection_visibility: {
        followers_count_visibility: "public",
        following_count_visibility: "public",
        friends_count_visibility: "public",
        mutual_friends_visibility: "public",
      },
      family: { children: [], relationships: [] },
      family_visibility: [],
    }
  ) as ProfileConnectionsFamilySettings;

  const familyData = familyResponse.data
    ? (familyResponse.data as FamilyCenterData)
    : null;

  const publicFamilyData = familyData
    ? ((publicFamilyResponse.data ?? {
        self: {
          user_id: familyData.self.user_id,
          full_name: familyData.self.full_name,
          username: familyData.self.username,
          age_state: familyData.self.age_state,
          can_invite_relationship: false,
        },
        managed_children: [],
        accepted_relationships: [],
        incoming_invitations: [],
        outgoing_invitations: [],
      }) as PublicFamilySettingsData)
    : null;

  const fallbackName =
    user.user_metadata?.full_name ??
    user.user_metadata?.name ??
    user.email?.split("@")[0] ??
    "UIN member";

  const fallbackAvatar =
    user.user_metadata?.avatar_url ??
    user.user_metadata?.picture ??
    "";

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8 md:px-6">
      <div className="mx-auto max-w-6xl">
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
              Manage your identity, public presence, connections, age and family settings in one place.
            </p>

            <nav
              aria-label="Profile settings sections"
              className="mt-6 flex flex-wrap gap-2"
            >
              <a
                href="#profile-details"
                className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:border-green-300 hover:text-green-700"
              >
                Profile
              </a>
              <a
                href="#links-media"
                className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:border-green-300 hover:text-green-700"
              >
                Links & Media
              </a>
              <a
                href="#connections-family"
                className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:border-green-300 hover:text-green-700"
              >
                Connections
              </a>
              <a
                href="#age-family"
                className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-800 transition hover:border-amber-400"
              >
                Age & Family
              </a>
            </nav>
          </div>

          <div className="mt-7 space-y-8">
            <section id="profile-details" className="scroll-mt-6">
              <ProfileSettingsForm
                profile={{
                  fullName: profile.full_name ?? fallbackName,
                  username: profile.username,
                  bio: profile.bio ?? "",
                  city: profile.city ?? "",
                  country: profile.country ?? "",
                  avatarUrl: profile.avatar_url ?? fallbackAvatar,
                  coverUrl: profile.cover_url ?? "",
                  gender: profile.gender ?? null,
                  showGender: Boolean(profile.show_gender),
                  participationProfileVisibility:
                    profile.participation_profile_visibility ?? "friends",
                  pawProfileVisibility:
                    profile.paw_profile_visibility ?? "friends",
                  email: profile.email ?? user.email ?? "",
                  createdAt: profile.created_at,
                }}
              />
            </section>

            <section id="links-media" className="scroll-mt-6">
              <ProfilePresenceSettingsForm
                initialLinks={presence.links}
                initialEmbeds={presence.embeds}
              />
            </section>

            <section id="connections-family" className="scroll-mt-6">
              <ProfileConnectionsFamilySettingsForm
                initialData={connectionsFamily}
              />
            </section>
          </div>
        </section>

        <section id="age-family" className="mt-8 scroll-mt-6 space-y-8">
          {familyData ? (
            <>
              <AgeAndFamilyManager initialData={familyData} />

              {!familyData.self.is_managed_minor && publicFamilyData && (
                <PublicFamilyManager initialData={publicFamilyData} />
              )}
            </>
          ) : (
            <div className="rounded-3xl border border-red-200 bg-white p-8 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-red-600">
                Age & Family
              </p>
              <h2 className="mt-2 text-2xl font-bold text-gray-950">
                Age and family settings could not be loaded
              </h2>
              <p className="mt-3 text-sm text-red-700">
                {familyResponse.error?.message ?? "Please refresh the page and try again."}
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
