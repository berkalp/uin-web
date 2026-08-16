import Link from "next/link";

import type { PlanOriginView } from "@/utils/planOrigins";

function ownerName(origin: PlanOriginView) {
  return origin.ownerFullName || origin.ownerUsername || "UIN üyesi";
}

export default function ActivityCompactOrigins({
  origins,
  resultTitle,
}: {
  origins: PlanOriginView[];
  resultTitle: string;
}) {
  if (origins.length === 0) return null;

  const sourceCount = origins.reduce(
    (highest, origin) => Math.max(highest, origin.sourceCount),
    origins.length
  );

  return (
    <section
      id="activity-origins"
      className="scroll-mt-24 rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-white text-sm shadow-sm">
            🌱
          </span>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-700">
              Origins
            </p>
            <p className="text-sm font-bold text-gray-800">
              Bu Aktivite {sourceCount} Niyetten doğdu.
            </p>
          </div>
        </div>
        <span className="rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-[10px] font-black text-emerald-800">
          {sourceCount} Niyet → 1 Aktivite
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {origins.map((origin, index) => {
          const label =
            origin.isVisible && origin.activityName
              ? `${origin.activityName} · ${ownerName(origin)}`
              : "Gizli eşleşen Niyet";

          const chip = (
            <span className="inline-flex items-center gap-2 rounded-xl border border-emerald-100 bg-white px-3 py-2 text-xs font-semibold text-gray-700 shadow-sm">
              {origin.ownerAvatarUrl ? (
                <img
                  src={origin.ownerAvatarUrl}
                  alt=""
                  className="h-6 w-6 rounded-full object-cover"
                />
              ) : (
                <span className="grid h-6 w-6 place-items-center rounded-full bg-gray-100 text-[10px]">
                  {origin.isVisible ? "↗" : "🔒"}
                </span>
              )}
              {label}
            </span>
          );

          return origin.isVisible && origin.intentId ? (
            <Link
              key={`${origin.planId}-${origin.intentId}-${index}`}
              href={`/activities/${encodeURIComponent(origin.intentId)}`}
            >
              {chip}
            </Link>
          ) : (
            <span key={`${origin.planId}-origin-${index}`}>{chip}</span>
          );
        })}
      </div>

      <p className="mt-3 text-[11px] text-gray-500">
        Ortaya çıkan Aktivite: <strong>{resultTitle}</strong>
      </p>
    </section>
  );
}
