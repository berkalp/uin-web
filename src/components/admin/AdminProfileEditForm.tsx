"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { adminUpdateUserProfile } from "@/services/directMessageService";
import { normalizeUsername } from "@/services/profileService";

type AdminProfileEditFormProps = {
  profile: {
    userId: string;
    fullName: string;
    username: string;
    bio: string;
    city: string;
    country: string;
    avatarUrl: string;
    coverUrl: string;
  };
};

export default function AdminProfileEditForm({ profile }: AdminProfileEditFormProps) {
  const router = useRouter();
  const [fullName, setFullName] = useState(profile.fullName);
  const [username, setUsername] = useState(profile.username);
  const [bio, setBio] = useState(profile.bio);
  const [city, setCity] = useState(profile.city);
  const [country, setCountry] = useState(profile.country);
  const [avatarUrl, setAvatarUrl] = useState(profile.avatarUrl);
  const [coverUrl, setCoverUrl] = useState(profile.coverUrl);
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      setIsSubmitting(true);
      await adminUpdateUserProfile({
        userId: profile.userId,
        fullName,
        username: normalizeUsername(username),
        bio: bio.trim() || null,
        city: city.trim() || null,
        country: country.trim() || null,
        avatarUrl: avatarUrl.trim() || null,
        coverUrl: coverUrl.trim() || null,
        reason: reason.trim() || null,
      });
      setUsername(normalizeUsername(username));
      setSuccessMessage("Profile updated and recorded in the staff audit trail.");
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
    <form onSubmit={handleSubmit} className="space-y-6">
      <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm md:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-green-700">
          Public profile fields
        </p>
        <h1 className="mt-3 text-3xl font-bold text-gray-950">Edit user profile</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-gray-500">
          Correct public profile metadata here. Authentication email, password and provider identity are deliberately outside this form.
        </p>

        <div className="mt-7 grid gap-5 md:grid-cols-2">
          <label className="text-sm font-semibold text-gray-700">
            Display name
            <input
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              maxLength={80}
              className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 font-normal text-gray-900 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
            />
          </label>

          <label className="text-sm font-semibold text-gray-700">
            Username
            <input
              value={username}
              onChange={(event) => setUsername(normalizeUsername(event.target.value))}
              maxLength={30}
              className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 font-normal text-gray-900 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
            />
          </label>

          <label className="text-sm font-semibold text-gray-700">
            City
            <input
              value={city}
              onChange={(event) => setCity(event.target.value)}
              maxLength={80}
              className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 font-normal text-gray-900 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
            />
          </label>

          <label className="text-sm font-semibold text-gray-700">
            Country
            <input
              value={country}
              onChange={(event) => setCountry(event.target.value)}
              maxLength={80}
              className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 font-normal text-gray-900 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
            />
          </label>

          <label className="text-sm font-semibold text-gray-700 md:col-span-2">
            Bio
            <textarea
              value={bio}
              onChange={(event) => setBio(event.target.value)}
              maxLength={300}
              rows={5}
              className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 font-normal leading-6 text-gray-900 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
            />
          </label>

          <label className="text-sm font-semibold text-gray-700 md:col-span-2">
            Profile image URL
            <input
              value={avatarUrl}
              onChange={(event) => setAvatarUrl(event.target.value)}
              className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 font-normal text-gray-900 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
            />
          </label>

          <label className="text-sm font-semibold text-gray-700 md:col-span-2">
            Cover image URL
            <input
              value={coverUrl}
              onChange={(event) => setCoverUrl(event.target.value)}
              className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 font-normal text-gray-900 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
            />
          </label>
        </div>
      </section>

      <section className="rounded-3xl border border-amber-200 bg-amber-50/50 p-6">
        <label className="text-sm font-semibold text-amber-900">
          Reason for change <span className="font-normal text-amber-700">(optional, stored in audit)</span>
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={3}
            maxLength={500}
            placeholder="Example: corrected display-name typo at the user's request"
            className="mt-2 w-full rounded-xl border border-amber-200 bg-white px-4 py-3 font-normal text-gray-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
          />
        </label>
      </section>

      {errorMessage && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {errorMessage}
        </p>
      )}

      {successMessage && (
        <p className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-700">
          {successMessage}
        </p>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-xl bg-gray-950 px-6 py-3 font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting ? "Saving..." : "Save profile changes"}
        </button>
      </div>
    </form>
  );
}
