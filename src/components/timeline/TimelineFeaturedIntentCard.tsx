import Link from "next/link";

import CompactIntentReactionBar from "@/components/reactions/CompactIntentReactionBar";
import type {
  ProfileIntentReactionItem,
} from "@/components/profile/ProfileIntentReactions";

function formatDate(value: string | null | undefined) {
  if (!value) return "Tarih yok";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Tarih yok";
  }

  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function getInitial(value: string) {
  return value.trim().charAt(0).toUpperCase() || "?";
}

function getStatusLabel(status: string | null | undefined) {
  switch (status) {
    case "completed":
      return "YAŞANDI";

    case "planned":
      return "PLANLANDI";

    case "forming":
    case "active":
    case "open":
    case "full":
    case "future":
      return "ŞEKİLLENİYOR";

    case "cancelled":
      return "İPTAL EDİLDİ";

    case "expired":
      return "SÜRESİ DOLDU";

    default:
      return "SOSYAL";
  }
}

export default function TimelineFeaturedIntentCard({
  item,
  currentUserId,
  initialContext,
}: {
  item: ProfileIntentReactionItem;
  currentUserId: string;
  initialContext: unknown;
}) {
  const coverUrl =
    item.contextCoverUrl ||
    item.activityCoverUrl ||
    item.categoryCoverUrl ||
    null;

  const title =
    item.displayTitle ||
    item.activityName ||
    "Sosyal Niyet";

  const ownerName =
    item.ownerFullName ||
    item.ownerUsername ||
    "UIN kullanıcısı";

  const ownerProfileHref =
    item.ownerUsername
      ? `/u/${encodeURIComponent(item.ownerUsername)}`
      : null;

  const location =
    [item.district, item.city]
      .filter(Boolean)
      .join(", ") || "Konum belirtilmedi";

  const dateLabel = formatDate(
    item.scheduledStart ||
      item.startDate ||
      item.reactedAt
  );

  const resourceId =
    item.resourceId ||
    item.planId ||
    item.intentId;

  const detailHref =
    `/activities/${encodeURIComponent(resourceId)}`;

  const isOwner =
    item.ownerUserId === currentUserId;

  return (
    <article className="relative flex h-[400px] min-w-0 flex-col overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm transition hover:shadow-md">
      <div className="relative h-[128px] shrink-0 overflow-hidden bg-gray-950">
        {coverUrl ? (
          <img
            src={coverUrl}
            alt={`${title} cover`}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="grid h-full place-items-center bg-gradient-to-br from-violet-100 via-white to-green-100 text-5xl">
            ✨
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-black/45" />

        <div className="absolute left-3 top-3">
          <span className="inline-flex h-5 items-center rounded-full bg-white/95 px-2 text-[8.5px] font-bold uppercase tracking-[0.04em] text-gray-900 shadow-sm">
            {getStatusLabel(item.lifecycleStatus)}
          </span>
        </div>

        <div className="absolute inset-x-0 bottom-0 px-3 pb-3">
          <p className="h-3 truncate text-[9px] font-bold uppercase tracking-[0.11em] text-green-300">
            {item.categoryName || "Sosyal Niyet"}
          </p>

          <h2 className="mt-1 line-clamp-2 text-[17px] font-bold leading-[1.12] text-white">
            {title}
          </h2>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="grid grid-cols-2 gap-2 border-b border-gray-100 px-3 py-3">
          <div className="min-w-0 rounded-xl bg-gray-50 px-3 py-2">
            <p className="text-[9px] font-bold uppercase tracking-wide text-gray-400">
              Tarih
            </p>
            <p className="mt-1 truncate text-[11px] font-bold text-gray-900">
              {dateLabel}
            </p>
          </div>

          <div className="min-w-0 rounded-xl bg-gray-50 px-3 py-2">
            <p className="text-[9px] font-bold uppercase tracking-wide text-gray-400">
              Konum
            </p>
            <p className="mt-1 truncate text-[11px] font-bold text-gray-900">
              {location}
            </p>
          </div>
        </div>

        <div className="px-3 py-3">
          <p className="text-[9px] font-bold uppercase tracking-wide text-gray-400">
            Öne çıkardığın sosyal niyet
          </p>

          <p className="mt-2 text-xs leading-5 text-gray-600">
            Bu niyeti daha görünür kılmak için öne çıkardın.
          </p>
        </div>

        <div className="mt-auto border-t border-gray-100 px-3 py-2.5">
          <div className="flex min-w-0 items-center gap-2">
            {item.ownerAvatarUrl ? (
              <img
                src={item.ownerAvatarUrl}
                alt={ownerName}
                className="h-7 w-7 shrink-0 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-green-50 text-[10px] font-semibold text-green-700">
                {getInitial(ownerName)}
              </div>
            )}

            <div className="min-w-0">
              {ownerProfileHref && !isOwner ? (
                <Link
                  href={ownerProfileHref}
                  className="block truncate text-[12px] font-semibold leading-tight text-gray-950 transition hover:text-green-700"
                >
                  {ownerName}
                </Link>
              ) : (
                <p className="truncate text-[12px] font-semibold leading-tight text-gray-950">
                  {ownerName}
                </p>
              )}

              {item.ownerUsername ? (
                <p className="mt-0.5 truncate text-[9px] font-medium text-gray-400">
                  @{item.ownerUsername}
                </p>
              ) : (
                <p className="mt-0.5 text-[9px] font-medium text-gray-400">
                  Host
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex h-[34px] shrink-0 items-center gap-1 border-t border-black/5 bg-white/95 px-1.5">
        <Link
          href={detailHref}
          title="Görüntüle"
          aria-label={`Görüntüle ${title}`}
          className="flex h-6 min-w-[62px] shrink-0 items-center justify-center rounded-md border border-gray-200 bg-white px-2 text-[9.5px] font-semibold text-gray-600 transition hover:border-green-300 hover:text-green-700"
        >
          Görüntüle
        </Link>

        <div className="ml-auto shrink-0">
          <CompactIntentReactionBar
            intentId={item.intentId}
            initialContext={initialContext}
            isAuthenticated
            isOwner={isOwner}
          />
        </div>
      </div>
    </article>
  );
}