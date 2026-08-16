"use client";

import {
  useEffect,
  useState,
} from "react";

import {
  getExperienceProviderLabel,
  type ExperienceMediaItem,
} from "@/utils/experience";

type PreviewResponse = {
  imageUrl?: string | null;
  title?: string | null;
};

function looksLikeDirectImage(
  value: string
) {
  try {
    const url = new URL(value);
    const pathname =
      url.pathname.toLowerCase();

    return /\.(avif|gif|jpe?g|png|webp)$/.test(
      pathname
    );
  } catch {
    return false;
  }
}

export default function ExternalMediaPreview({
  media,
  className,
}: {
  media: ExperienceMediaItem;
  className: string;
}) {
  const externalUrl =
    media.externalUrl?.trim() || "";

  const directImage =
    media.provider === "direct" &&
    Boolean(externalUrl) &&
    looksLikeDirectImage(externalUrl);

  const [imageUrl, setImageUrl] =
    useState<string | null>(
      directImage ? externalUrl : null
    );
  const [resolvedTitle, setResolvedTitle] =
    useState<string | null>(null);
  const [loading, setLoading] =
    useState(!directImage);

  useEffect(() => {
    if (
      !externalUrl ||
      directImage
    ) {
      return;
    }

    let active = true;
    const controller =
      new AbortController();

    setLoading(true);
    setImageUrl(null);
    setResolvedTitle(null);

    void fetch(
      `/api/media-preview?url=${encodeURIComponent(
        externalUrl
      )}`,
      {
        signal: controller.signal,
        headers: {
          accept: "application/json",
        },
      }
    )
      .then(async (response) => {
        if (!response.ok) {
          return null;
        }

        return (await response.json()) as PreviewResponse;
      })
      .then((payload) => {
        if (!active || !payload) {
          return;
        }

        setImageUrl(
          payload.imageUrl || null
        );
        setResolvedTitle(
          payload.title || null
        );
      })
      .catch((error) => {
        if (
          error instanceof DOMException &&
          error.name === "AbortError"
        ) {
          return;
        }

        console.warn(
          "External media preview failed:",
          error
        );
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [directImage, externalUrl]);

  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={
          media.caption ||
          media.label ||
          resolvedTitle ||
          "Bağlı Aktivite fotoğrafı"
        }
        className={className}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() =>
          setImageUrl(null)
        }
      />
    );
  }

  return (
    <div
      className={`${className} flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 p-6 text-center text-white`}
    >
      <div>
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white/15 text-xl">
          {loading ? "…" : "↗"}
        </div>
        <p className="mt-3 line-clamp-2 text-sm font-bold">
          {media.label ||
            resolvedTitle ||
            getExperienceProviderLabel(
              media.provider
            )}
        </p>
        <p className="mt-1 text-xs text-white/65">
          {loading
            ? "Önizleme hazırlanıyor"
            : "Orijinal medyayı aç"}
        </p>
      </div>
    </div>
  );
}
