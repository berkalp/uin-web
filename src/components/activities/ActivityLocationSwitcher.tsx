"use client";

import { useMemo, useState } from "react";

type LocationKind = "activity" | "meeting";

function makeEmbedUrl(query: string) {
  return `https://www.google.com/maps?q=${encodeURIComponent(
    query
  )}&z=12&output=embed`;
}

function makeOpenUrl(query: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    query
  )}`;
}

export default function ActivityLocationSwitcher({
  title,
  activityLocation,
  meetingPoint,
}: {
  title: string;
  activityLocation: string | null;
  meetingPoint: string | null;
}) {
  const firstKind: LocationKind = activityLocation ? "activity" : "meeting";
  const [activeKind, setActiveKind] = useState<LocationKind>(firstKind);

  const activeQuery =
    activeKind === "meeting"
      ? meetingPoint || activityLocation
      : activityLocation || meetingPoint;

  const embedUrl = useMemo(
    () => (activeQuery ? makeEmbedUrl(activeQuery) : null),
    [activeQuery]
  );
  const openUrl = useMemo(
    () => (activeQuery ? makeOpenUrl(activeQuery) : null),
    [activeQuery]
  );

  const hasTwoLocations = Boolean(activityLocation && meetingPoint);

  return (
    <div className="flex h-full min-h-[390px] flex-col bg-white">
      <div className="relative min-h-[270px] flex-1 overflow-hidden bg-gray-100">
        {embedUrl ? (
          <iframe
            key={embedUrl}
            title={`${title} ${
              activeKind === "meeting" ? "buluşma noktası" : "aktivite yeri"
            }`}
            src={embedUrl}
            className="absolute inset-0 h-full w-full border-0"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        ) : (
          <div className="flex h-full min-h-[270px] items-center justify-center px-6 text-center text-sm text-gray-500">
            Haritada gösterilebilecek bir konum henüz yok.
          </div>
        )}

        {hasTwoLocations && (
          <div className="absolute left-3 top-3 flex rounded-xl border border-white/70 bg-white/95 p-1 shadow-lg backdrop-blur">
            <button
              type="button"
              onClick={() => setActiveKind("activity")}
              className={`rounded-lg px-3 py-2 text-[11px] font-black transition ${
                activeKind === "activity"
                  ? "bg-gray-950 text-white"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              Aktivite yeri
            </button>
            <button
              type="button"
              onClick={() => setActiveKind("meeting")}
              className={`rounded-lg px-3 py-2 text-[11px] font-black transition ${
                activeKind === "meeting"
                  ? "bg-gray-950 text-white"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              Buluşma noktası
            </button>
          </div>
        )}

        {openUrl && (
          <a
            href={openUrl}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="absolute bottom-3 right-3 rounded-xl bg-white px-4 py-2.5 text-xs font-black text-blue-700 shadow-lg transition hover:bg-blue-50"
          >
            Haritada aç ↗
          </a>
        )}
      </div>

      <div className="grid gap-2 border-t border-gray-100 bg-white p-3">
        {activityLocation && (
          <button
            type="button"
            onClick={() => setActiveKind("activity")}
            className={`flex w-full items-start gap-3 rounded-2xl border p-3 text-left transition ${
              activeKind === "activity"
                ? "border-violet-200 bg-violet-50"
                : "border-gray-100 bg-gray-50 hover:border-gray-200"
            }`}
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-base shadow-sm">
              🌐
            </span>
            <span className="min-w-0">
              <span className="block text-[10px] font-black uppercase tracking-[0.14em] text-violet-700">
                Aktivite yeri
              </span>
              <span className="mt-1 block text-sm font-black text-gray-950">
                {activityLocation}
              </span>
            </span>
          </button>
        )}

        {meetingPoint && (
          <button
            type="button"
            onClick={() => setActiveKind("meeting")}
            className={`flex w-full items-start gap-3 rounded-2xl border p-3 text-left transition ${
              activeKind === "meeting"
                ? "border-rose-200 bg-rose-50"
                : "border-gray-100 bg-gray-50 hover:border-gray-200"
            }`}
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-base shadow-sm">
              📍
            </span>
            <span className="min-w-0">
              <span className="block text-[10px] font-black uppercase tracking-[0.14em] text-rose-700">
                Buluşma noktası
              </span>
              <span className="mt-1 block text-sm font-black text-gray-950">
                {meetingPoint}
              </span>
              <span className="mt-1 block text-[10px] font-semibold text-gray-500">
                Görünürlük ayarına göre gösterilir
              </span>
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
