"use client";

import { useEffect, useMemo, useState } from "react";

import {
  getPlanToolkitFiles,
  type PlanToolkitFile,
} from "@/services/planToolkitService";

const IMAGE_EXTENSIONS = [
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
  ".avif",
];

function hasImageExtension(value: string | null | undefined) {
  const normalized = (value ?? "")
    .split("?")[0]
    .split("#")[0]
    .toLowerCase();

  return IMAGE_EXTENSIONS.some((extension) =>
    normalized.endsWith(extension)
  );
}

function getPreviewUrl(file: PlanToolkitFile) {
  if (file.kind === "file" && file.signedUrl) {
    return file.signedUrl;
  }

  if (
    file.kind === "link" &&
    file.externalUrl &&
    hasImageExtension(file.externalUrl)
  ) {
    return file.externalUrl;
  }

  return null;
}

function isImage(file: PlanToolkitFile) {
  const previewUrl = getPreviewUrl(file);

  if (!previewUrl) {
    return false;
  }

  if (file.mimeType?.toLowerCase().startsWith("image/")) {
    return true;
  }

  if (hasImageExtension(file.fileName)) {
    return true;
  }

  return hasImageExtension(previewUrl);
}

export default function PlanArchiveMemoryPhotos({
  planId,
}: {
  planId: string;
}) {
  const [files, setFiles] = useState<PlanToolkitFile[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    setLoaded(false);
    setLoadError(null);

    void getPlanToolkitFiles(planId)
      .then((nextFiles) => {
        if (!active) return;
        setFiles(nextFiles);
      })
      .catch((error) => {
        if (!active) return;

        const message =
          error instanceof Error
            ? error.message
            : "Plan arşivindeki fotoğraflar yüklenemedi.";

        console.warn(
          "Memory Plan archive photo lookup failed:",
          message
        );
        setLoadError(message);
      })
      .finally(() => {
        if (active) setLoaded(true);
      });

    return () => {
      active = false;
    };
  }, [planId]);

  const photos = useMemo(
    () => files.filter(isImage),
    [files]
  );

  if (!loaded) {
    return (
      <div className="mt-5 rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3 text-xs font-semibold text-gray-500">
        Plan arşivindeki fotoğraflar yükleniyor…
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
        <p className="text-xs font-black text-amber-900">
          Plan arşivi fotoğrafları yüklenemedi.
        </p>
        <p className="mt-1 text-[11px] leading-5 text-amber-800">
          {loadError}
        </p>
      </div>
    );
  }

  if (photos.length === 0) {
    return null;
  }

  return (
    <section className="mt-5 rounded-2xl border border-emerald-100 bg-emerald-50/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-700">
            Plan arşivinden
          </p>
          <h4 className="mt-1 text-sm font-black text-gray-950">
            Aktivite sırasında eklenen fotoğraflar
          </h4>
        </div>

        <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-black text-emerald-700 shadow-sm">
          {photos.length} fotoğraf
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {photos.map((photo) => {
          const previewUrl = getPreviewUrl(photo);

          if (!previewUrl) return null;

          return (
            <a
              key={photo.id}
              href={previewUrl}
              target="_blank"
              rel="noreferrer"
              className="group overflow-hidden rounded-xl border border-white bg-white shadow-sm"
            >
              <div className="aspect-square overflow-hidden bg-gray-100">
                <img
                  src={previewUrl}
                  alt={
                    photo.description ||
                    photo.fileName ||
                    "Aktivite fotoğrafı"
                  }
                  className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                />
              </div>

              <div className="p-2">
                <p className="truncate text-[10px] font-bold text-gray-800">
                  {photo.description ||
                    photo.fileName ||
                    "Aktivite fotoğrafı"}
                </p>
                <p className="mt-0.5 truncate text-[9px] text-gray-400">
                  {photo.uploaderFullName ||
                    photo.uploaderUsername ||
                    "UIN üyesi"}
                </p>
              </div>
            </a>
          );
        })}
      </div>
    </section>
  );
}
