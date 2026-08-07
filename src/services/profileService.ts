import { supabase } from "@/utils/supabase/client";
import type { ProfileGender } from "@/utils/participationEligibility";
import type { ProfileActivityVisibility } from "@/utils/profileActivityVisibility";

export type UpdateProfileInput = {
  fullName: string;
  username: string;
  bio: string | null;
  city: string | null;
  country: string | null;
  avatarUrl: string | null;
  coverUrl: string | null;
  gender: ProfileGender | null;
  showGender: boolean;
  participationProfileVisibility: ProfileActivityVisibility;
};

export function normalizeUsername(
  value: string
) {
  return value
    .toLocaleLowerCase("tr-TR")
    .replace(/ç/g, "c")
    .replace(/ğ/g, "g")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ş/g, "s")
    .replace(/ü/g, "u")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 30);
}

function cleanOptionalValue(
  value: string | null
) {
  return value?.trim() || null;
}

function validateImageUrl(
  value: string | null,
  label: string
) {
  if (!value) {
    return;
  }

  let parsedUrl: URL;

  try {
    parsedUrl = new URL(value);
  } catch {
    throw new Error(
      `Enter a valid ${label} URL.`
    );
  }

  if (
    parsedUrl.protocol !== "https:" &&
    parsedUrl.protocol !== "http:"
  ) {
    throw new Error(
      `${label} URL must use HTTP or HTTPS.`
    );
  }
}

export async function checkUsernameAvailability(
  username: string
) {
  const normalizedUsername =
    normalizeUsername(username);

  if (
    normalizedUsername.length < 3 ||
    normalizedUsername.length > 30
  ) {
    return false;
  }

  const { data, error } =
    await supabase.rpc(
      "is_username_available",
      {
        p_username:
          normalizedUsername,
      }
    );

  if (error) {
    throw new Error(
      error.message ||
        "Username availability could not be checked."
    );
  }

  return Boolean(data);
}

export async function updateMyProfile({
  fullName,
  username,
  bio,
  city,
  country,
  avatarUrl,
  coverUrl,
  gender,
  showGender,
  participationProfileVisibility,
}: UpdateProfileInput) {
  const normalizedUsername =
    normalizeUsername(username);

  const cleanedFullName =
    fullName.trim();

  const cleanedBio =
    cleanOptionalValue(bio);

  const cleanedCity =
    cleanOptionalValue(city);

  const cleanedCountry =
    cleanOptionalValue(country);

  const cleanedAvatarUrl =
    cleanOptionalValue(avatarUrl);

  const cleanedCoverUrl =
    cleanOptionalValue(coverUrl);

  if (!cleanedFullName) {
    throw new Error(
      "Display name is required."
    );
  }

  if (
    cleanedFullName.length > 80
  ) {
    throw new Error(
      "Display name cannot exceed 80 characters."
    );
  }

  if (
    normalizedUsername.length < 3 ||
    normalizedUsername.length > 30
  ) {
    throw new Error(
      "Username must contain between 3 and 30 characters."
    );
  }

  if (
    !/^[a-z0-9_]+$/.test(
      normalizedUsername
    )
  ) {
    throw new Error(
      "Username may only contain lowercase letters, numbers, and underscores."
    );
  }

  if (
    cleanedBio &&
    cleanedBio.length > 300
  ) {
    throw new Error(
      "Bio cannot exceed 300 characters."
    );
  }

  if (
    cleanedCity &&
    cleanedCity.length > 80
  ) {
    throw new Error(
      "City cannot exceed 80 characters."
    );
  }

  if (
    cleanedCountry &&
    cleanedCountry.length > 80
  ) {
    throw new Error(
      "Country cannot exceed 80 characters."
    );
  }

  validateImageUrl(
    cleanedAvatarUrl,
    "profile image"
  );

  validateImageUrl(
    cleanedCoverUrl,
    "cover image"
  );

  const { data, error } =
    await supabase.rpc(
      "update_my_profile_with_gender_and_participation_visibility",
      {
        p_full_name:
          cleanedFullName,
        p_username:
          normalizedUsername,
        p_bio: cleanedBio,
        p_city: cleanedCity,
        p_country:
          cleanedCountry,
        p_avatar_url:
          cleanedAvatarUrl,
        p_cover_url:
          cleanedCoverUrl,
        p_gender: gender,
        p_show_gender:
          Boolean(showGender) &&
          gender !== null &&
          gender !== "prefer_not_to_say",
        p_participation_profile_visibility:
          participationProfileVisibility,
      }
    );

  if (error) {
    throw new Error(
      error.message ||
        "The profile could not be updated."
    );
  }

  return data as string;
}