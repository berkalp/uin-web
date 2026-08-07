"use client";

import {
  FormEvent,
  useEffect,
  useState,
} from "react";
import { useRouter } from "next/navigation";

import {
  checkUsernameAvailability,
  normalizeUsername,
  updateMyProfile,
} from "@/services/profileService";

type UsernameStatus =
  | "idle"
  | "checking"
  | "available"
  | "unavailable"
  | "error";

type ProfileSettingsFormProps = {
  profile: {
    fullName: string;
    username: string;
    bio: string;
    city: string;
    country: string;
    avatarUrl: string;
    coverUrl: string;
    email: string;
    createdAt: string;
  };
};

function getInitial(
  fullName: string
) {
  return (
    fullName
      .trim()
      .charAt(0)
      .toUpperCase() || "?"
  );
}

function formatJoinedDate(
  createdAt: string
) {
  return new Intl.DateTimeFormat(
    "en-GB",
    {
      day: "numeric",
      month: "long",
      year: "numeric",
    }
  ).format(new Date(createdAt));
}

export default function ProfileSettingsForm({
  profile,
}: ProfileSettingsFormProps) {
  const router = useRouter();

  const [fullName, setFullName] =
    useState(profile.fullName);

  const [username, setUsername] =
    useState(profile.username);

  const [bio, setBio] =
    useState(profile.bio);

  const [city, setCity] =
    useState(profile.city);

  const [country, setCountry] =
    useState(profile.country);

  const [avatarUrl, setAvatarUrl] =
    useState(profile.avatarUrl);

  const [coverUrl, setCoverUrl] =
    useState(profile.coverUrl);

  const [
    usernameStatus,
    setUsernameStatus,
  ] = useState<UsernameStatus>(
    "idle"
  );

  const [
    isSubmitting,
    setIsSubmitting,
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState<string | null>(
    null
  );

  const [
    successMessage,
    setSuccessMessage,
  ] = useState<string | null>(
    null
  );

  useEffect(() => {
    const normalizedUsername =
      normalizeUsername(username);

    if (
      normalizedUsername.length < 3
    ) {
      setUsernameStatus("idle");
      return;
    }

    const timeoutId =
      window.setTimeout(
        async () => {
          try {
            setUsernameStatus(
              "checking"
            );

            const isAvailable =
              await checkUsernameAvailability(
                normalizedUsername
              );

            setUsernameStatus(
              isAvailable
                ? "available"
                : "unavailable"
            );
          } catch {
            setUsernameStatus(
              "error"
            );
          }
        },
        500
      );

    return () => {
      window.clearTimeout(
        timeoutId
      );
    };
  }, [username]);

  function clearMessages() {
    setSuccessMessage(null);
    setErrorMessage(null);
  }

  function handleUsernameChange(
    value: string
  ) {
    setUsername(
      normalizeUsername(value)
    );

    clearMessages();
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setErrorMessage(null);
    setSuccessMessage(null);

    const normalizedUsername =
      normalizeUsername(username);

    if (
      usernameStatus ===
      "unavailable"
    ) {
      setErrorMessage(
        "This username is already in use."
      );

      return;
    }

    try {
      setIsSubmitting(true);

      const isAvailable =
        await checkUsernameAvailability(
          normalizedUsername
        );

      if (!isAvailable) {
        setUsernameStatus(
          "unavailable"
        );

        setErrorMessage(
          "This username is already in use."
        );

        return;
      }

      await updateMyProfile({
        fullName,
        username:
          normalizedUsername,
        bio,
        city,
        country,
        avatarUrl,
        coverUrl,
      });

      setUsername(
        normalizedUsername
      );

      setUsernameStatus(
        "available"
      );

      setSuccessMessage(
        "Profile updated successfully."
      );

      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "The profile could not be updated."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6"
    >
      <section className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
        <div className="relative h-56 bg-gradient-to-r from-green-100 via-emerald-50 to-cyan-50">
          {coverUrl && (
            <img
              src={coverUrl}
              alt="Profile cover preview"
              className="absolute inset-0 h-full w-full object-cover"
            />
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent" />
        </div>

        <div className="grid grid-cols-1 gap-6 px-6 pb-7 md:grid-cols-[224px_minmax(0,1fr)]">
          <div className="relative z-10 -mt-20">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={fullName}
                className="h-44 w-44 rounded-full border-4 border-white bg-white object-cover shadow-lg md:h-56 md:w-56"
              />
            ) : (
              <div className="flex h-44 w-44 items-center justify-center rounded-full border-4 border-white bg-gray-100 text-5xl font-bold text-gray-500 shadow-lg md:h-56 md:w-56">
                {getInitial(fullName)}
              </div>
            )}
          </div>

          <div className="pt-6">
            <h2 className="text-3xl font-bold text-gray-900">
              {fullName ||
                "UIN member"}
            </h2>

            <p className="mt-2 text-lg text-gray-500">
              @{username ||
                "username"}
            </p>

            <p className="mt-4 text-sm text-gray-500">
              {profile.email}
            </p>

            <p className="mt-1 text-sm text-gray-500">
              Joined{" "}
              {formatJoinedDate(
                profile.createdAt
              )}
            </p>

            <div className="mt-5 border-t border-gray-100 pt-5">
              {bio ? (
                <p className="whitespace-pre-wrap text-sm leading-6 text-gray-700">
                  {bio}
                </p>
              ) : (
                <p className="text-sm text-gray-400">
                  Your bio preview will appear here.
                </p>
              )}

              {(city ||
                country) && (
                <p className="mt-4 text-sm font-semibold text-gray-600">
                  📍{" "}
                  {[city, country]
                    .filter(Boolean)
                    .join(", ")}
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="border-b border-gray-100 pb-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-green-600">
            Identity
          </p>

          <h3 className="mt-1 text-xl font-bold text-gray-900">
            Name and username
          </h3>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2">
          <div>
            <label
              htmlFor="full-name"
              className="text-sm font-semibold text-gray-700"
            >
              Display Name
            </label>

            <input
              id="full-name"
              type="text"
              value={fullName}
              onChange={(event) => {
                setFullName(
                  event.target.value
                );

                clearMessages();
              }}
              required
              maxLength={80}
              autoComplete="name"
              className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900 outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-100"
            />
          </div>

          <div>
            <label
              htmlFor="username"
              className="text-sm font-semibold text-gray-700"
            >
              Username
            </label>

            <div className="relative mt-2">
              <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-gray-400">
                @
              </span>

              <input
                id="username"
                type="text"
                value={username}
                onChange={(event) =>
                  handleUsernameChange(
                    event.target.value
                  )
                }
                required
                minLength={3}
                maxLength={30}
                autoComplete="username"
                className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-9 pr-4 text-gray-900 outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-100"
              />
            </div>

            <div className="mt-2 min-h-5 text-xs">
              {usernameStatus ===
                "checking" && (
                <p className="text-gray-500">
                  Checking username...
                </p>
              )}

              {usernameStatus ===
                "available" && (
                <p className="font-semibold text-green-700">
                  Username is available.
                </p>
              )}

              {usernameStatus ===
                "unavailable" && (
                <p className="font-semibold text-red-700">
                  Username is already in use.
                </p>
              )}

              {usernameStatus ===
                "error" && (
                <p className="text-amber-700">
                  Username availability could not be checked.
                </p>
              )}

              {usernameStatus ===
                "idle" && (
                <p className="text-gray-500">
                  Use 3–30 lowercase letters,
                  numbers, or underscores.
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="border-b border-gray-100 pb-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-green-600">
            About
          </p>

          <h3 className="mt-1 text-xl font-bold text-gray-900">
            Bio and location
          </h3>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2">
          <div>
            <label
              htmlFor="city"
              className="text-sm font-semibold text-gray-700"
            >
              City
            </label>

            <input
              id="city"
              type="text"
              value={city}
              onChange={(event) => {
                setCity(
                  event.target.value
                );

                clearMessages();
              }}
              maxLength={80}
              autoComplete="address-level2"
              placeholder="Istanbul"
              className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-green-500 focus:ring-2 focus:ring-green-100"
            />
          </div>

          <div>
            <label
              htmlFor="country"
              className="text-sm font-semibold text-gray-700"
            >
              Country
            </label>

            <input
              id="country"
              type="text"
              value={country}
              onChange={(event) => {
                setCountry(
                  event.target.value
                );

                clearMessages();
              }}
              maxLength={80}
              autoComplete="country-name"
              placeholder="Türkiye"
              className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-green-500 focus:ring-2 focus:ring-green-100"
            />
          </div>
        </div>

        <div className="mt-5">
          <div className="flex items-center justify-between gap-3">
            <label
              htmlFor="bio"
              className="text-sm font-semibold text-gray-700"
            >
              Bio
            </label>

            <span className="text-xs text-gray-400">
              {bio.length}/300
            </span>
          </div>

          <textarea
            id="bio"
            value={bio}
            onChange={(event) => {
              setBio(
                event.target.value
              );

              clearMessages();
            }}
            maxLength={300}
            rows={5}
            placeholder="Share a little about yourself, your interests, or the Activities you enjoy."
            className="mt-2 w-full resize-none rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-green-500 focus:ring-2 focus:ring-green-100"
          />
        </div>
      </section>

      <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="border-b border-gray-100 pb-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-green-600">
            Images
          </p>

          <h3 className="mt-1 text-xl font-bold text-gray-900">
            Profile appearance
          </h3>
        </div>

        <div className="mt-5 space-y-5">
          <div>
            <label
              htmlFor="cover-url"
              className="text-sm font-semibold text-gray-700"
            >
              Cover Image URL
            </label>

            <input
              id="cover-url"
              type="url"
              value={coverUrl}
              onChange={(event) => {
                setCoverUrl(
                  event.target.value
                );

                clearMessages();
              }}
              placeholder="https://images.unsplash.com/photo-..."
              className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-green-500 focus:ring-2 focus:ring-green-100"
            />

            <p className="mt-2 text-xs text-gray-500">
              Paste a direct image URL,
              such as an images.unsplash.com address.
            </p>
          </div>

          <div>
            <label
              htmlFor="avatar-url"
              className="text-sm font-semibold text-gray-700"
            >
              Profile Image URL
            </label>

            <input
              id="avatar-url"
              type="url"
              value={avatarUrl}
              onChange={(event) => {
                setAvatarUrl(
                  event.target.value
                );

                clearMessages();
              }}
              placeholder="https://example.com/profile.jpg"
              className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-green-500 focus:ring-2 focus:ring-green-100"
            />
          </div>
        </div>
      </section>

      {errorMessage && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {errorMessage}
        </div>
      )}

      {successMessage && (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-700">
          {successMessage}
        </div>
      )}

      <button
        type="submit"
        disabled={
          isSubmitting ||
          usernameStatus ===
            "checking"
        }
        className="w-full rounded-xl bg-green-600 px-5 py-4 font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSubmitting
          ? "Saving Profile..."
          : "Save Profile"}
      </button>
    </form>
  );
}