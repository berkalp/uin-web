import Link from "next/link";

import type {
  ProfileIntentReactionItem,
} from "@/components/profile/ProfileIntentReactions";

function formatDate(value: string | null) {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function getStatusLabel(status: string | null) {
  switch (status) {
    case "completed":
      return "YAŞANDI";
    case "planned":
      return "PLANLANDI";
    case "forming":
    case "active":
    case "open":
    case "full":
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
}: {
  item: ProfileIntentReactionItem;
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

  const owner =
    item.ownerFullName ||
    item.ownerUsername ||
    "UIN kullanıcısı";

  const location = [
    item.district,
    item.city,
  ]
    .filter(Boolean)
    .join(", ");

  const dateLabel = formatDate(
    item.scheduledStart ||
      item.startDate ||
      item.reactedAt
  );

  const resourceId =
    item.planId ||
    item.intentId;

  return (
    <article className="group flex min-w-0 flex-col overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <Link
        href={`/activities/${encodeURIComponent(resourceId)}`}
        className="relative block aspect-[16/10] overflow-hidden bg-gray-950"
      >
        {coverUrl ? (
          <img
            src={coverUrl}
            alt=""
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-gradient-to-br from-emerald-50 to-green-100 text-4xl">
            ✨
          </div>
        )}

        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-4 pb-4 pt-14">
          <p className="truncate text-xl font-black text-white">
            {title}
          </p>
        </div>

        <span className="absolute left-3 top-3 rounded-full bg-white/95 px-3 py-1.5 text-[10px] font-black text-gray-900 shadow-sm">
          {getStatusLabel(item.lifecycleStatus)}
        </span>
      </Link>

      <div className="flex flex-1 flex-col p-4">
        <p className="truncate text-sm font-black text-gray-950">
          {owner}
        </p>

        {location && (
          <p className="mt-1 truncate text-xs font-semibold text-gray-500">
            {location}
          </p>
        )}

        <div className="mt-auto flex items-center justify-between gap-3 pt-4">
          <p className="text-xs font-bold text-gray-500">
            {dateLabel || "Tarih yok"}
          </p>

          <Link
            href={`/activities/${encodeURIComponent(resourceId)}`}
            className="text-xs font-black text-green-700 transition hover:text-green-800"
          >
            Görüntüle →
          </Link>
        </div>
      </div>
    </article>
  );
}