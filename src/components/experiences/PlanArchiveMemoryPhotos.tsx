"use client";

import { useEffect, useState } from "react";

import {
  getPlanToolkitFiles,
  type PlanToolkitFile,
} from "@/services/planToolkitService";

function isImage(file: PlanToolkitFile) {
  return (
    file.kind === "file" &&
    Boolean(file.signedUrl) &&
    Boolean(file.mimeType?.startsWith("image/"))
  );
}

export default function PlanArchiveMemoryPhotos({
  planId,
}: {
  planId: string;
}) {
  const [photos, setPhotos] = useState<PlanToolkitFile[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;

    void getPlanToolkitFiles(planId)
      .then((files) => {
        if (!active) return;
        setPhotos(files.filter(isImage));
      })
      .catch((error) => {
        console.warn(
          "Memory Plan archive photo lookup failed:",
          error instanceof Error ? error.message : error
        );
      })
      .finally(() => {
        if (active) setLoaded(true);
      });

    return () => {
      active = false;
    };
  }, [planId]);

  if (!loaded || photos.length === 0) {
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
        {photos.map((photo) => (
          <a
            key={photo.id}
            href={photo.signedUrl || "#"}
            target="_blank"
            rel="noreferrer"
            className="group overflow-hidden rounded-xl border border-white bg-white shadow-sm"
          >
            <div className="aspect-square overflow-hidden bg-gray-100">
              <img
                src={photo.signedUrl || ""}
                alt={photo.description || photo.fileName}
                className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
              />
            </div>
            <div className="p-2">
              <p className="truncate text-[10px] font-bold text-gray-800">
                {photo.description || photo.fileName}
              </p>
              <p className="mt-0.5 truncate text-[9px] text-gray-400">
                {photo.uploaderFullName ||
                  photo.uploaderUsername ||
                  "UIN üyesi"}
              </p>
            </div>
          </a>
        ))}
      </div>

      <p className="mt-3 text-[10px] leading-4 text-gray-500">
        Bunlar Plan arşivindeki mevcut görünürlük kurallarıyla gösterilir.
        Memory kapağı yapmak veya etiketlemek için ayrıca Memory galerisine
        eklenebilir.
      </p>
    </section>
  );
}
