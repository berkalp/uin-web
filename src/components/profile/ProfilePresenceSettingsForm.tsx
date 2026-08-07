"use client";

import {
  FormEvent,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";

import { saveMyProfilePresence } from "@/services/profilePresenceService";
import {
  PROFILE_LINK_PLATFORMS,
  PROFILE_VISIBILITY_OPTIONS,
  buildSpotifyEmbedUrl,
  buildYouTubeEmbedUrl,
  isHttpUrl,
  type ProfileContentVisibility,
  type ProfileEmbed,
  type ProfileLink,
  type ProfileLinkPlatform,
} from "@/utils/profilePresence";

type EditableLink = ProfileLink & {
  clientId: string;
};

type Props = {
  initialLinks: ProfileLink[];
  initialEmbeds: ProfileEmbed[];
};

function createClientId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getInitialEmbed(
  embeds: ProfileEmbed[],
  provider: "spotify" | "youtube"
) {
  return embeds.find((item) => item.provider === provider) ?? null;
}

export default function ProfilePresenceSettingsForm({
  initialLinks,
  initialEmbeds,
}: Props) {
  const router = useRouter();

  const [links, setLinks] = useState<EditableLink[]>(
    initialLinks.map((link) => ({
      ...link,
      clientId: link.id ?? createClientId(),
    }))
  );

  const initialSpotify = getInitialEmbed(initialEmbeds, "spotify");
  const initialYoutube = getInitialEmbed(initialEmbeds, "youtube");

  const [spotifyUrl, setSpotifyUrl] = useState(
    initialSpotify?.source_url ?? ""
  );
  const [spotifyVisibility, setSpotifyVisibility] =
    useState<ProfileContentVisibility>(
      initialSpotify?.visibility ?? "public"
    );

  const [youtubeUrl, setYoutubeUrl] = useState(
    initialYoutube?.source_url ?? ""
  );
  const [youtubeVisibility, setYoutubeVisibility] =
    useState<ProfileContentVisibility>(
      initialYoutube?.visibility ?? "public"
    );

  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  const spotifyPreview = useMemo(
    () => buildSpotifyEmbedUrl(spotifyUrl),
    [spotifyUrl]
  );

  const youtubePreview = useMemo(
    () => buildYouTubeEmbedUrl(youtubeUrl),
    [youtubeUrl]
  );

  function addLink() {
    if (links.length >= 10) {
      return;
    }

    setLinks((current) => [
      ...current,
      {
        clientId: createClientId(),
        platform: "instagram",
        label: null,
        url: "",
        visibility: "public",
        sort_order: current.length,
      },
    ]);
  }

  function updateLink(
    clientId: string,
    patch: Partial<EditableLink>
  ) {
    setLinks((current) =>
      current.map((link) =>
        link.clientId === clientId ? { ...link, ...patch } : link
      )
    );
  }

  function removeLink(clientId: string) {
    setLinks((current) =>
      current.filter((link) => link.clientId !== clientId)
    );
  }

  function moveLink(clientId: string, direction: -1 | 1) {
    setLinks((current) => {
      const index = current.findIndex(
        (link) => link.clientId === clientId
      );
      const nextIndex = index + direction;

      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) {
        return current;
      }

      const copy = [...current];
      const [item] = copy.splice(index, 1);
      copy.splice(nextIndex, 0, item);
      return copy;
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setIsError(false);

    const populatedLinks = links.filter((link) => link.url.trim());

    if (populatedLinks.some((link) => !isHttpUrl(link.url))) {
      setIsError(true);
      setMessage("Every social link must use a valid HTTP or HTTPS URL.");
      return;
    }

    if (spotifyUrl.trim() && !spotifyPreview) {
      setIsError(true);
      setMessage("Enter a valid Spotify track, album, playlist, episode, or show URL.");
      return;
    }

    if (youtubeUrl.trim() && !youtubePreview) {
      setIsError(true);
      setMessage("Enter a valid YouTube video URL.");
      return;
    }

    try {
      setIsSaving(true);

      await saveMyProfilePresence({
        links: populatedLinks.map((link, index) => ({
          platform: link.platform,
          label: link.label?.trim() || null,
          url: link.url.trim(),
          visibility: link.visibility,
          sort_order: index,
        })),
        spotifyUrl,
        spotifyVisibility,
        youtubeUrl,
        youtubeVisibility,
      });

      setIsError(false);
      setMessage("Profile links and featured media were saved.");
      router.refresh();
    } catch (error) {
      setIsError(true);
      setMessage(
        error instanceof Error
          ? error.message
          : "Profile presence could not be saved."
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-6">
      <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-gray-100 pb-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-green-600">
              Social presence
            </p>
            <h2 className="mt-1 text-xl font-bold text-gray-950">
              Links people can follow
            </h2>
            <p className="mt-2 text-sm leading-6 text-gray-500">
              Add up to 10 links. Their order here is their order on your profile.
            </p>
          </div>

          <button
            type="button"
            disabled={links.length >= 10}
            onClick={addLink}
            className="rounded-xl border border-green-200 bg-green-50 px-4 py-2.5 text-sm font-semibold text-green-700 transition hover:bg-green-100 disabled:opacity-50"
          >
            Add link
          </button>
        </div>

        <div className="mt-5 space-y-4">
          {links.length === 0 && (
            <div className="rounded-2xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
              No social links yet.
            </div>
          )}

          {links.map((link, index) => (
            <div
              key={link.clientId}
              className="grid grid-cols-1 gap-3 rounded-2xl border border-gray-200 p-4 lg:grid-cols-[150px_minmax(0,1fr)_150px_auto]"
            >
              <select
                value={link.platform}
                onChange={(event) =>
                  updateLink(link.clientId, {
                    platform: event.target.value as ProfileLinkPlatform,
                  })
                }
                className="rounded-xl border border-gray-200 px-3 py-3 text-sm outline-none focus:border-green-500"
              >
                {PROFILE_LINK_PLATFORMS.map((platform) => (
                  <option key={platform.value} value={platform.value}>
                    {platform.label}
                  </option>
                ))}
              </select>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_180px]">
                <input
                  type="url"
                  value={link.url}
                  onChange={(event) =>
                    updateLink(link.clientId, { url: event.target.value })
                  }
                  placeholder="https://..."
                  className="rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-green-500"
                />

                <input
                  type="text"
                  value={link.label ?? ""}
                  maxLength={40}
                  onChange={(event) =>
                    updateLink(link.clientId, {
                      label: event.target.value || null,
                    })
                  }
                  placeholder="Optional label"
                  className="rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-green-500"
                />
              </div>

              <select
                value={link.visibility}
                onChange={(event) =>
                  updateLink(link.clientId, {
                    visibility: event.target.value as ProfileContentVisibility,
                  })
                }
                className="rounded-xl border border-gray-200 px-3 py-3 text-sm outline-none focus:border-green-500"
              >
                {PROFILE_VISIBILITY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  disabled={index === 0}
                  onClick={() => moveLink(link.clientId, -1)}
                  className="rounded-lg border border-gray-200 px-2.5 py-2 text-xs font-bold text-gray-600 disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  type="button"
                  disabled={index === links.length - 1}
                  onClick={() => moveLink(link.clientId, 1)}
                  className="rounded-lg border border-gray-200 px-2.5 py-2 text-xs font-bold text-gray-600 disabled:opacity-30"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => removeLink(link.clientId)}
                  className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="border-b border-gray-100 pb-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-purple-600">
            Featured media
          </p>
          <h2 className="mt-1 text-xl font-bold text-gray-950">
            One soundtrack and one video
          </h2>
          <p className="mt-2 text-sm leading-6 text-gray-500">
            Paste normal Spotify and YouTube links. UIN creates the safe embeds.
          </p>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-gray-200 p-4">
            <label className="text-sm font-semibold text-gray-700">
              Spotify URL
            </label>
            <input
              type="url"
              value={spotifyUrl}
              onChange={(event) => setSpotifyUrl(event.target.value)}
              placeholder="https://open.spotify.com/track/..."
              className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-green-500"
            />
            <select
              value={spotifyVisibility}
              onChange={(event) =>
                setSpotifyVisibility(
                  event.target.value as ProfileContentVisibility
                )
              }
              className="mt-3 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-green-500"
            >
              {PROFILE_VISIBILITY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            {spotifyPreview && (
              <iframe
                title="Spotify preview"
                src={spotifyPreview}
                width="100%"
                height="152"
                loading="lazy"
                allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                className="mt-4 rounded-xl border-0"
              />
            )}
          </div>

          <div className="rounded-2xl border border-gray-200 p-4">
            <label className="text-sm font-semibold text-gray-700">
              YouTube video URL
            </label>
            <input
              type="url"
              value={youtubeUrl}
              onChange={(event) => setYoutubeUrl(event.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-green-500"
            />
            <select
              value={youtubeVisibility}
              onChange={(event) =>
                setYoutubeVisibility(
                  event.target.value as ProfileContentVisibility
                )
              }
              className="mt-3 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-green-500"
            >
              {PROFILE_VISIBILITY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            {youtubePreview && (
              <div className="mt-4 aspect-video overflow-hidden rounded-xl bg-gray-950">
                <iframe
                  title="YouTube preview"
                  src={youtubePreview}
                  className="h-full w-full border-0"
                  loading="lazy"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              </div>
            )}
          </div>
        </div>
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
        {isSaving ? "Saving profile presence..." : "Save links and featured media"}
      </button>
    </form>
  );
}
