"use client";

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
    if (host !== "vimeo.com" && host !== "player.vimeo.com") return null;

    return (
      url.pathname
        .split("/")
        .filter(Boolean)
        .find((part) => /^\d+$/.test(part)) ?? null
    );
  } catch {
    return null;
  }
}

function getSafeEmbedUrl(value: string) {
  const youtubeId = getYouTubeId(value);
  if (youtubeId) return `https://www.youtube-nocookie.com/embed/${youtubeId}`;

  const vimeoId = getVimeoId(value);
  if (vimeoId) return `https://player.vimeo.com/video/${vimeoId}`;

  return null;
}

const LINK_META: Record<
  string,
  { label: string; icon: string; accent: string }
> = {
  official_event: {
    label: "Resmî site",
    icon: "🌐",
    accent: "text-emerald-700",
  },
  ticket: {
    label: "Bilet",
    icon: "🎟️",
    accent: "text-violet-700",
  },
  organizer: {
    label: "Organizatör",
    icon: "👥",
    accent: "text-cyan-700",
  },
  venue: {
    label: "Mekân",
    icon: "📍",
    accent: "text-rose-700",
  },
  reference: {
    label: "Kaynak",
    icon: "📖",
    accent: "text-blue-700",
  },
  other: {
    label: "Bağlantı",
    icon: "🔗",
    accent: "text-gray-700",
  },
};

export default function IntentRelatedResourcesDisplay({
  links,
}: {
  links: IntentLinkView[];
}) {
  const videoLinks = links.filter((link) => link.linkType === "video");
  const regularLinks = links.filter((link) => link.linkType !== "video");

  return (
    <div className="space-y-4">
      {videoLinks.length > 0 && (
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span className="text-sm">🎬</span>
            <p className="text-sm font-black text-gray-950">Videolar</p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {videoLinks.map((link) => {
              const embedUrl = getSafeEmbedUrl(link.url);

              return (
                <div
                  key={`${link.url}-${link.sortOrder}`}
                  className="overflow-hidden rounded-2xl border border-gray-200 bg-white"
                >
                  {embedUrl ? (
                    <div className="aspect-video bg-gray-950">
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
                  ) : (
                    <div className="grid aspect-video place-items-center bg-gray-950 text-4xl">
                      ▶
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-3 p-3">
                    <p className="min-w-0 truncate text-xs font-bold text-gray-900">
                      {link.label || "Video"}
                    </p>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noreferrer"
                      className="shrink-0 text-[11px] font-black text-violet-700 hover:underline"
                    >
                      Aç ↗
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {regularLinks.length > 0 && (
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span className="text-sm">🔗</span>
            <p className="text-sm font-black text-gray-950">
              İlgili bağlantılar
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {regularLinks.map((link) => {
              const meta = LINK_META[link.linkType] ?? LINK_META.other;
              return (
                <a
                  key={`${link.url}-${link.sortOrder}`}
                  href={link.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-w-0 items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-800 shadow-sm transition hover:border-green-200 hover:bg-green-50"
                >
                  <span aria-hidden="true">{meta.icon}</span>
                  <span className={meta.accent}>
                    {link.label?.trim() || meta.label}
                  </span>
                  <span className="text-gray-400" aria-hidden="true">
                    ↗
                  </span>
                </a>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
