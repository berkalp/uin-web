"use client";

import {
  type FormEvent,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";

import { saveMyProfileConnectionsFamily } from "@/services/profileConnectionsService";
import {
  getNormalizedFamilyMembers,
  type ProfileConnectionsFamilySettings,
  type ProfileSectionVisibility,
} from "@/utils/profileConnections";

type Props = {
  initialData: ProfileConnectionsFamilySettings;
};

const VISIBILITY_OPTIONS: Array<{
  value: ProfileSectionVisibility;
  label: string;
}> = [
  { value: "public", label: "Anyone" },
  { value: "friends", label: "Friends" },
  { value: "private", label: "Only me" },
];

function VisibilitySelect({
  value,
  onChange,
}: {
  value: ProfileSectionVisibility;
  onChange: (value: ProfileSectionVisibility) => void;
}) {
  return (
    <select
      value={value}
      onChange={(event) =>
        onChange(event.target.value as ProfileSectionVisibility)
      }
      className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-semibold text-gray-700 outline-none focus:border-green-500"
    >
      {VISIBILITY_OPTIONS.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

function getInitial(value: string) {
  return value.trim().charAt(0).toUpperCase() || "?";
}

export default function ProfileConnectionsFamilySettingsForm({
  initialData,
}: Props) {
  const router = useRouter();
  const familyMembers = useMemo(
    () => getNormalizedFamilyMembers(initialData.family),
    [initialData.family]
  );

  const initialVisibility = new Map(
    initialData.family_visibility.map((item) => [
      item.family_key,
      item.visibility,
    ])
  );

  const [followersVisibility, setFollowersVisibility] =
    useState<ProfileSectionVisibility>(
      initialData.connection_visibility.followers_count_visibility
    );
  const [followingVisibility, setFollowingVisibility] =
    useState<ProfileSectionVisibility>(
      initialData.connection_visibility.following_count_visibility
    );
  const [friendsVisibility, setFriendsVisibility] =
    useState<ProfileSectionVisibility>(
      initialData.connection_visibility.friends_count_visibility
    );
  const [mutualVisibility, setMutualVisibility] =
    useState<ProfileSectionVisibility>(
      initialData.connection_visibility.mutual_friends_visibility
    );

  const [familyVisibility, setFamilyVisibility] = useState<
    Record<string, ProfileSectionVisibility>
  >(() =>
    Object.fromEntries(
      familyMembers.map((member) => [
        member.key,
        initialVisibility.get(member.key) ??
          "private",
      ])
    )
  );

  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setIsError(false);

    try {
      setIsSaving(true);
      await saveMyProfileConnectionsFamily({
        connectionVisibility: {
          followers_count_visibility: followersVisibility,
          following_count_visibility: followingVisibility,
          friends_count_visibility: friendsVisibility,
          mutual_friends_visibility: mutualVisibility,
        },
        familyVisibility: familyMembers.map((member) => ({
          family_key: member.key,
          visibility:
            familyVisibility[member.key] ??
            "private",
        })),
      });

      setMessage("Connection and family visibility settings were saved.");
      router.refresh();
    } catch (error) {
      setIsError(true);
      setMessage(
        error instanceof Error
          ? error.message
          : "Visibility settings could not be saved."
      );
    } finally {
      setIsSaving(false);
    }
  }

  const connectionRows = [
    {
      label: "Follower count",
      description: "Shows only the number. The follower list is never public.",
      value: followersVisibility,
      setValue: setFollowersVisibility,
    },
    {
      label: "Following count",
      description: "Shows only the number. The following list is never public.",
      value: followingVisibility,
      setValue: setFollowingVisibility,
    },
    {
      label: "Friend count",
      description: "Shows only the number. The complete friend list stays private.",
      value: friendsVisibility,
      setValue: setFriendsVisibility,
    },
    {
      label: "Mutual friends",
      description: "Shows at most three mutual friends and a total count.",
      value: mutualVisibility,
      setValue: setMutualVisibility,
    },
  ];

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-6">
      <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="border-b border-gray-100 pb-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
            Connections
          </p>
          <h2 className="mt-1 text-xl font-bold text-gray-950">
            Counts and mutual friends
          </h2>
          <p className="mt-2 text-sm leading-6 text-gray-500">
            UIN never exposes your complete friend, follower or following lists on your public profile.
          </p>
        </div>

        <div className="mt-5 divide-y divide-gray-100">
          {connectionRows.map((row) => (
            <div
              key={row.label}
              className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-bold text-gray-950">{row.label}</p>
                <p className="mt-1 text-sm text-gray-500">{row.description}</p>
              </div>
              <VisibilitySelect value={row.value} onChange={row.setValue} />
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="border-b border-gray-100 pb-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-purple-700">
            Family
          </p>
          <h2 className="mt-1 text-xl font-bold text-gray-950">
            Choose who appears on your profile
          </h2>
          <p className="mt-2 text-sm leading-6 text-gray-500">
            Children default to Only me. Each family member has an independent visibility setting.
          </p>
        </div>

        {familyMembers.length > 0 ? (
          <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
            {familyMembers.map((member) => (
              <article
                key={member.key}
                className="flex flex-col gap-4 rounded-2xl border border-gray-200 p-4 sm:flex-row sm:items-center"
              >
                {member.avatarUrl ? (
                  <img
                    src={member.avatarUrl}
                    alt={member.fullName}
                    className="h-16 w-16 shrink-0 rounded-2xl object-cover"
                  />
                ) : (
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-purple-100 text-xl font-bold text-purple-700">
                    {getInitial(member.fullName)}
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-gray-950">
                    {member.fullName}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-purple-700">
                    {member.relationship}
                  </p>
                  {member.username && (
                    <p className="mt-1 truncate text-xs text-gray-400">
                      @{member.username}
                    </p>
                  )}
                </div>

                <VisibilitySelect
                  value={
                    familyVisibility[member.key] ??
                    "private"
                  }
                  onChange={(visibility) =>
                    setFamilyVisibility((current) => ({
                      ...current,
                      [member.key]: visibility,
                    }))
                  }
                />
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-dashed border-gray-300 p-6 text-center">
            <p className="text-sm text-gray-500">
              No accepted family relationships are available yet.
            </p>
            <a
              href="#age-family"
              className="mt-3 inline-flex text-sm font-semibold text-green-700"
            >
              Open Age & Family below →
            </a>
          </div>
        )}
      </section>

      {message && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm font-semibold ${
            isError
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-green-200 bg-green-50 text-green-700"
          }`}
        >
          {message}
        </div>
      )}

      <button
        type="submit"
        disabled={isSaving}
        className="w-full rounded-xl bg-gray-950 px-5 py-4 font-semibold text-white transition hover:bg-gray-800 disabled:opacity-50"
      >
        {isSaving ? "Saving visibility..." : "Save connection and family visibility"}
      </button>
    </form>
  );
}
