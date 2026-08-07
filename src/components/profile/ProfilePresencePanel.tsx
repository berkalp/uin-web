import type {
  ProfileEmbed,
  ProfileLink,
} from "@/utils/profilePresence";
import {
  buildSpotifyEmbedUrl,
  getProfilePlatformLabel,
  getProfilePlatformMark,
} from "@/utils/profilePresence";

type ProfilePresencePanelProps = {
  links: ProfileLink[];
  embeds: ProfileEmbed[];
};

export default function ProfilePresencePanel({
  links,
  embeds,
}: ProfilePresencePanelProps) {
  const spotify = embeds.find(
    (embed) =>
      embed.provider ===
      "spotify"
  );

  const spotifyEmbedUrl =
    buildSpotifyEmbedUrl(
      spotify?.source_url
    );

  const spotifyHeight =
    spotify?.resource_type ===
      "track" ||
    spotify?.resource_type ===
      "episode"
      ? 80
      : 152;

  if (
    links.length === 0 &&
    !spotifyEmbedUrl
  ) {
    return null;
  }

  return (
    <div className="space-y-5">
      {links.length > 0 && (
        <div>
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-green-700">
            Links
          </p>

          <div className="flex flex-wrap gap-2">
          {links.map((link) => (
            <a
              key={
                link.id ??
                `${link.platform}-${link.url}`
              }
              href={link.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 shadow-sm transition hover:border-green-300 hover:text-green-700"
            >
              <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-gray-950 px-1.5 text-[10px] font-black text-white">
                {getProfilePlatformMark(
                  link.platform
                )}
              </span>

              <span>
                {link.label?.trim() ||
                  getProfilePlatformLabel(
                    link.platform
                  )}
              </span>
            </a>
          ))}
          </div>
        </div>
      )}

      {spotifyEmbedUrl && (
        <div className="max-w-xl">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-green-700">
            Featured soundtrack
          </p>

          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <iframe
              title="Featured Spotify media"
              src={spotifyEmbedUrl}
              width="100%"
              height={spotifyHeight}
              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
              loading="lazy"
              className="block border-0"
            />
          </div>
        </div>
      )}
    </div>
  );
}
