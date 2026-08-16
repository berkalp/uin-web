"use client";

import IntentLinksDisplay from "@/components/intents/IntentLinksDisplay";
import type { IntentLinkView } from "@/utils/intentLinks";

function getYouTubeId(value: string) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");

    if (host === "youtu.be") {
      const id = url.pathname.split("/").filter(Boolean)[0];
      return id && /^[A-Za-z0-9_-]{6,20}$/.test(id) ? id : null;
    }

    if (
      host === "youtube.com" ||
      host === "m.youtube.com" ||
      host === "music.youtube.com"
    ) {
      if (url.pathname === "/watch") {
        const id = url.searchParams.get("v");
        return id && /^[A-Za-z0-9_-]{6,20}$/.test(id) ? id : null;
      }

      const parts = url.pathname.split("/").filter(Boolean);
      if (
        (parts[0] === "shorts" || parts[0] === "embed") &&
        parts[1] &&
        /^[A-Za-z0-9_-]{6,20}$/.test(parts[1])
      ) {
        return parts[1];
      }
    }
  } catch {
    return null;
  }

  return null;
}

function getVimeoId(value: string) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");

    if (host !== "vimeo.com" && host !== "player.vimeo.com") {
      return null;
    }

    const id = url.pathname
      .split("/")
      .filter(Boolean)
      .find((part) => /^\d+$/.test(part));

    return id ?? null;
  } catch {
    return null;
  }
}

function getSafeEmbedUrl(value: string) {
  const youtubeId = getYouTubeId(value);
  if (youtubeId) {
    return `https://www.youtube-nocookie.com/embed/${youtubeId}`;
  }

  const vimeoId = getVimeoId(value);
  if (vimeoId) {
    return `https://player.vimeo.com/video/${vimeoId}`;
  }

  return null;
}

export default function IntentRelatedResourcesDisplay({
  links,
}: {
  links: IntentLinkView[];
}) {
  const videoLinks = links.filter((link) => link.linkType === "video");
  const regularLinks = links.filter((link) => link.linkType !== "video");

  return (
    <div className="space-y-4">
      {videoLinks.map((link) => {
        const embedUrl = getSafeEmbedUrl(link.url);

        if (!embedUrl) {
          return (
            <a
              key={`${link.url}-${link.sortOrder}`}
              href={link.url}
              target="_blank"
              rel="noreferrer"
              className="block rounded-2xl border border-gray-200 bg-white p-4 transition hover:border-green-300 hover:bg-green-50/30"
            >
              <p className="text-xs font-bold uppercase tracking-wide text-green-700">
                Video
              </p>
              <p className="mt-1 text-sm font-bold text-gray-950">
                {link.label || "Videoyu aç"}
              </p>
              <p className="mt-1 truncate text-xs text-gray-500">
                {link.url}
              </p>
            </a>
          );
        }

        return (
          <div
            key={`${link.url}-${link.sortOrder}`}
            className="overflow-hidden rounded-2xl border border-gray-200 bg-gray-950"
          >
            <div className="aspect-video">
              <iframe
                src={embedUrl}
                title={link.label || "UIN video"}
                className="h-full w-full"
                loading="lazy"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
              />
            </div>
            {link.label && (
              <div className="bg-white px-4 py-3 text-sm font-bold text-gray-950">
                {link.label}
              </div>
            )}
          </div>
        );
      })}

      {regularLinks.length > 0 && (
        <IntentLinksDisplay links={regularLinks} />
      )}
    </div>
  );
}
