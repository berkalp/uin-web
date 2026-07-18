"use client";

import {
  FormEvent,
  useState,
} from "react";
import { useRouter } from "next/navigation";

import { supabase } from "@/utils/supabase/client";

type ManagedMinorProfileFormProps = {
  childUserId: string;
  username: string;
  initialFullName: string;
  initialBio: string;
  initialAvatarUrl: string;
  initialCoverUrl: string;
  initialCity: string;
  initialCountry: string;
};

export default function ManagedMinorProfileForm({
  childUserId,
  username,
  initialFullName,
  initialBio,
  initialAvatarUrl,
  initialCoverUrl,
  initialCity,
  initialCountry,
}: ManagedMinorProfileFormProps) {
  const router = useRouter();

  const [
    fullName,
    setFullName,
  ] = useState(
    initialFullName
  );

  const [
    bio,
    setBio,
  ] = useState(
    initialBio
  );

  const [
    avatarUrl,
    setAvatarUrl,
  ] = useState(
    initialAvatarUrl
  );

  const [
    coverUrl,
    setCoverUrl,
  ] = useState(
    initialCoverUrl
  );

  const [
    city,
    setCity,
  ] = useState(
    initialCity
  );

  const [
    country,
    setCountry,
  ] = useState(
    initialCountry
  );

  const [
    isWorking,
    setIsWorking,
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const [
    successMessage,
    setSuccessMessage,
  ] = useState("");

  async function submit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setIsWorking(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const {
        error,
      } = await supabase.rpc(
        "update_managed_minor_profile",
        {
          p_child_user_id:
            childUserId,

          p_full_name:
            fullName,

          p_bio:
            bio || null,

          p_avatar_url:
            avatarUrl || null,

          p_cover_url:
            coverUrl || null,

          p_city:
            city || null,

          p_country:
            country || null,
        }
      );

      if (error) {
        throw error;
      }

      setSuccessMessage(
        "Managed child profile updated."
      );

      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Managed child profile could not be updated."
      );
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-[32px] border border-gray-200 bg-white p-6 shadow-sm md:p-8"
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-green-700">
        Managed Child Profile
      </p>

      <h1 className="mt-3 text-3xl font-bold text-gray-950">
        Edit @{username}
      </h1>

      <p className="mt-3 text-sm leading-7 text-gray-500">
        The public child profile hides
        location and live Activity details.
        These fields remain available for
        private family use.
      </p>

      <div className="mt-7 grid grid-cols-1 gap-5 md:grid-cols-2">
        <label className="md:col-span-2">
          <span className="text-sm font-semibold text-gray-700">
            Full name
          </span>

          <input
            value={fullName}
            required
            maxLength={120}
            disabled={isWorking}
            onChange={(event) =>
              setFullName(
                event.target.value
              )
            }
            className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-green-500"
          />
        </label>

        <label className="md:col-span-2">
          <span className="text-sm font-semibold text-gray-700">
            Guardian-approved bio
          </span>

          <textarea
            value={bio}
            rows={5}
            maxLength={500}
            disabled={isWorking}
            onChange={(event) =>
              setBio(
                event.target.value
              )
            }
            className="mt-2 w-full resize-y rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-green-500"
          />

          <p className="mt-2 text-right text-xs text-gray-400">
            {bio.length}/500
          </p>
        </label>

        <label>
          <span className="text-sm font-semibold text-gray-700">
            Avatar URL
          </span>

          <input
            type="url"
            value={avatarUrl}
            disabled={isWorking}
            placeholder="https://"
            onChange={(event) =>
              setAvatarUrl(
                event.target.value
              )
            }
            className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-green-500"
          />
        </label>

        <label>
          <span className="text-sm font-semibold text-gray-700">
            Cover URL
          </span>

          <input
            type="url"
            value={coverUrl}
            disabled={isWorking}
            placeholder="https://"
            onChange={(event) =>
              setCoverUrl(
                event.target.value
              )
            }
            className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-green-500"
          />
        </label>

        <label>
          <span className="text-sm font-semibold text-gray-700">
            Private city
          </span>

          <input
            value={city}
            disabled={isWorking}
            onChange={(event) =>
              setCity(
                event.target.value
              )
            }
            className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-green-500"
          />
        </label>

        <label>
          <span className="text-sm font-semibold text-gray-700">
            Private country
          </span>

          <input
            value={country}
            disabled={isWorking}
            onChange={(event) =>
              setCountry(
                event.target.value
              )
            }
            className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-green-500"
          />
        </label>
      </div>

      {errorMessage && (
        <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-semibold text-red-800">
            {errorMessage}
          </p>
        </div>
      )}

      {successMessage && (
        <div className="mt-5 rounded-xl border border-green-200 bg-green-50 p-4">
          <p className="text-sm font-semibold text-green-800">
            {successMessage}
          </p>
        </div>
      )}

      <button
        type="submit"
        disabled={isWorking}
        className="mt-6 w-full rounded-xl bg-green-600 px-5 py-3 font-semibold text-white transition hover:bg-green-700 disabled:opacity-50"
      >
        {isWorking
          ? "Saving..."
          : "Save Managed Profile"}
      </button>
    </form>
  );
}
