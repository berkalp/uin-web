import Link from "next/link";

import type { PlanOriginView } from "@/utils/planOrigins";

type PlanOriginsPanelProps = {
  origins: PlanOriginView[];
  resultTitle: string;
  context?: "activity" | "planning" | "completed";
  className?: string;
  id?: string;
};

function getInitial(origin: PlanOriginView) {
  return (
    origin.ownerFullName?.trim().charAt(0).toUpperCase() ||
    origin.ownerUsername?.trim().charAt(0).toUpperCase() ||
    "?"
  );
}

function getOwnerName(origin: PlanOriginView) {
  return origin.ownerFullName || origin.ownerUsername || "UIN member";
}

function getSourceLabel(origin: PlanOriginView) {
  if (origin.viewerIsOwner) return "Your Intent";
  if (origin.memberRole === "host" || origin.relationship === "host_source") {
    return "Host Intent";
  }
  if (origin.memberRole === "co_host") return "Co-host Intent";
  return "Matching Intent";
}

function getHeading(context: PlanOriginsPanelProps["context"], sourceCount: number) {
  if (context === "planning") return "How this Plan came together";
  if (context === "completed") return "How it started";
  return sourceCount > 1 ? "How this Activity formed" : "How this Activity started";
}

function getDescription(context: PlanOriginsPanelProps["context"], sourceCount: number) {
  if (sourceCount > 1) {
    if (context === "planning") {
      return `${sourceCount} compatible Intents matched and created this Shared Plan.`;
    }
    return `${sourceCount} compatible Intents came together and became this Activity.`;
  }

  return context === "planning"
    ? "This Shared Plan grew directly from one Intent."
    : "This Activity grew directly from one Intent.";
}

function OriginAvatar({ origin }: { origin: PlanOriginView }) {
  if (origin.ownerAvatarUrl) {
    return (
      <img
        src={origin.ownerAvatarUrl}
        alt={getOwnerName(origin)}
        className="h-10 w-10 shrink-0 rounded-full border-2 border-white object-cover shadow-sm"
      />
    );
  }

  return (
    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border-2 border-white bg-gray-100 text-xs font-black text-gray-700 shadow-sm">
      {getInitial(origin)}
    </span>
  );
}

export default function PlanOriginsPanel({
  origins,
  resultTitle,
  context = "activity",
  className = "",
  id = "activity-origins",
}: PlanOriginsPanelProps) {
  if (origins.length === 0) return null;

  const sourceCount = origins.reduce(
    (highest, origin) => Math.max(highest, origin.sourceCount),
    origins.length
  );
  const heading = getHeading(context, sourceCount);
  const description = getDescription(context, sourceCount);

  return (
    <section
      id={id}
      className={`scroll-mt-24 rounded-3xl border border-emerald-200 bg-gradient-to-br from-white via-emerald-50/60 to-lime-50/70 p-5 shadow-sm md:p-6 ${className}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">
            Origins
          </p>
          <h2 className="mt-2 text-xl font-black text-gray-950">{heading}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600">{description}</p>
        </div>

        <span className="rounded-full border border-emerald-200 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-800 shadow-sm">
          {sourceCount} {sourceCount === 1 ? "Intent" : "Intents"} → 1 Activity
        </span>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {origins.map((origin, index) => {
          const sourceLabel = getSourceLabel(origin);
          const ownerName = getOwnerName(origin);
          const profileHref = origin.ownerUsername
            ? `/u/${encodeURIComponent(origin.ownerUsername)}`
            : null;
          const intentHref = origin.intentId
            ? `/activities/${encodeURIComponent(origin.intentId)}`
            : null;

          if (!origin.isVisible || !origin.activityName) {
            return (
              <article
                key={`${origin.planId}-hidden-${index}`}
                className="rounded-2xl border border-gray-200 bg-white/90 p-4 shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gray-100 text-sm" aria-hidden="true">
                    🔒
                  </span>
                  <div className="min-w-0">
                    <p className="text-[9px] font-black uppercase tracking-[0.14em] text-gray-400">
                      Matching Intent
                    </p>
                    <p className="mt-1 text-sm font-black text-gray-900">Another matching Intent</p>
                    <p className="mt-1 text-xs text-gray-500">Its details are outside your visibility.</p>
                  </div>
                </div>
              </article>
            );
          }

          const card = (
            <article className={`h-full rounded-2xl border bg-white/95 p-4 shadow-sm transition ${
              origin.viewerIsOwner
                ? "border-emerald-300 ring-2 ring-emerald-100 hover:border-emerald-400"
                : "border-gray-200 hover:border-emerald-200"
            }`}>
              <div className="flex items-start gap-3">
                <OriginAvatar origin={origin} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2 py-1 text-[8px] font-black uppercase tracking-[0.12em] ${
                      origin.viewerIsOwner
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-gray-100 text-gray-600"
                    }`}>
                      {sourceLabel}
                    </span>
                    {origin.memberRole && (
                      <span className="text-[8px] font-black uppercase tracking-[0.12em] text-gray-400">
                        {origin.memberRole.replace("_", "-")}
                      </span>
                    )}
                  </div>

                  <p className="mt-2 truncate text-sm font-black text-gray-950">{origin.activityName}</p>
                  <p className="mt-1 truncate text-xs font-semibold text-gray-500">{ownerName}</p>
                </div>
                {intentHref && (
                  <span className="text-xs font-black text-emerald-700" aria-hidden="true">↗</span>
                )}
              </div>
            </article>
          );

          return intentHref ? (
            <Link key={`${origin.planId}-${origin.intentId ?? index}`} href={intentHref} className="block">
              {card}
            </Link>
          ) : profileHref ? (
            <Link key={`${origin.planId}-${origin.ownerUserId ?? index}`} href={profileHref} className="block">
              {card}
            </Link>
          ) : (
            <div key={`${origin.planId}-origin-${index}`}>{card}</div>
          );
        })}
      </div>

      <div className="mt-4 flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-950 px-4 py-3 text-white shadow-sm">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/10 text-lg" aria-hidden="true">↓</span>
        <div className="min-w-0">
          <p className="text-[9px] font-black uppercase tracking-[0.14em] text-emerald-200">
            Resulting Activity
          </p>
          <p className="mt-0.5 truncate text-sm font-black">{resultTitle}</p>
        </div>
      </div>
    </section>
  );
}
