import Link from "next/link";

import EyeIcon from "@/components/ui/EyeIcon";
import CompactIntentReactionBar from "@/components/reactions/CompactIntentReactionBar";
import type { IntentReactionContext } from "@/utils/intentReactions";
import TimelineIntentPresentation from "@/components/timeline/TimelineIntentPresentation";
import TimelineShareButton from "@/components/timeline/TimelineShareButton";

import type {
  ProfileIntentReactionItem,
} from "@/components/profile/ProfileIntentReactions";

type LifecycleStatus =
  | "open"
  | "future"
  | "forming"
  | "planned"
  | "closed"
  | "completed"
  | "cancelled"
  | "expired";

function normalizeLifecycleStatus(
  value: string | null | undefined
): LifecycleStatus {
  switch (value) {
    case "open":
    case "future":
    case "forming":
    case "planned":
    case "closed":
    case "completed":
    case "cancelled":
    case "expired":
      return value;

    case "active":
    case "full":
    default:
      return "open";
  }
}

function getStatusLabel(status: LifecycleStatus) {
  switch (status) {
    case "future":
      return "Gelecek";
    case "forming":
      return "Şekilleniyor";
    case "planned":
      return "Planlandı";
    case "closed":
      return "Kapalı";
    case "completed":
      return "Tamamlandı";
    case "cancelled":
      return "İptal edildi";
    case "expired":
      return "Süresi doldu";
    default:
      return "Açık";
  }
}

function getStatusClasses(status: LifecycleStatus) {
  switch (status) {
    case "future":
      return "bg-blue-100 text-blue-800";
    case "forming":
      return "bg-violet-100 text-violet-800";
    case "planned":
      return "bg-purple-100 text-purple-800";
    case "completed":
      return "bg-green-100 text-green-800";
    case "cancelled":
      return "bg-red-100 text-red-800";
    case "expired":
      return "bg-amber-100 text-amber-800";
    case "closed":
      return "bg-gray-200 text-gray-700";
    default:
      return "bg-green-100 text-green-800";
  }
}

export default function TimelineFeaturedIntentCard({
  item,
  currentUserId,
  initialContext,
}: {
  item: ProfileIntentReactionItem;
  currentUserId: string;
  initialContext: IntentReactionContext | null;
}) {
  const lifecycleStatus =
    normalizeLifecycleStatus(item.lifecycleStatus);

  const title =
    item.displayTitle?.trim() ||
    item.activityName ||
    "Sosyal Niyet";

  const ownerName =
    item.ownerFullName ||
    item.ownerUsername ||
    "UIN kullanıcısı";

  const detailToggleId =
    `featured-intent-details-${item.reactionId}`;

  const resourceId =
    item.resourceId ||
    item.planId ||
    item.intentId;

  const detailHref =
    `/activities/${encodeURIComponent(resourceId)}`;

  const isOwner =
    item.ownerUserId === currentUserId;

  return (
    <article
      className="relative flex h-[400px] min-w-0 flex-col overflow-visible rounded-3xl border border-gray-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <input
        id={detailToggleId}
        type="checkbox"
        className="peer sr-only"
        aria-label={`Toggle details for ${title}`}
      />

      <TimelineIntentPresentation
        detailToggleId={detailToggleId}
        intentId={item.intentId}
        title={title}
        categoryName={item.categoryName || "Sosyal Niyet"}
        activityCoverUrl={
          item.contextCoverUrl ||
          item.activityCoverUrl ||
          null
        }
        categoryCoverUrl={item.categoryCoverUrl}
        countryName={null}
        locationScope={null}
        city={item.city}
        district={item.district}
        startDate={item.startDate}
        endDate={item.endDate}
        lifecycleStatus={lifecycleStatus}
        expiredAt={
          lifecycleStatus === "expired"
            ? item.endDate
            : null
        }
        intentType="social"
        statusLabel={getStatusLabel(lifecycleStatus)}
        statusClasses={getStatusClasses(lifecycleStatus)}
        recruitmentStatus={
          lifecycleStatus === "open" ||
          lifecycleStatus === "future" ||
          lifecycleStatus === "forming"
            ? "open"
            : "closed"
        }
        matchingStatus={
          lifecycleStatus === "open" ||
          lifecycleStatus === "future" ||
          lifecycleStatus === "forming"
            ? "open"
            : "closed"
        }
        requestCount={0}
        participantLimit="Unlimited"
        budget={null}
        visibilityLabel="Herkes"
        people="anyone"
        recurrence="one_time"
        relatedLinks={[]}
        communities={item.communities}
        sportName={item.sportName}
        journeySummary={null}
        ownerName={ownerName}
        ownerAvatarUrl={item.ownerAvatarUrl}
        notes={null}
        createdAt={item.reactedAt}
        copiedFromIntentId={null}
      />

      <div className="flex h-[34px] shrink-0 items-center gap-1 border-t border-black/5 bg-white/95 px-1.5">
        <CompactIntentReactionBar
          intentId={item.intentId}
          initialContext={initialContext}
          isAuthenticated
          isOwner={isOwner}
        />

        <Link
          href={detailHref}
          title="Görüntüle"
          aria-label={`Görüntüle ${title}`}
          className="flex h-6 w-7 shrink-0 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-600 transition hover:border-green-300 hover:text-green-700"
        >
          <EyeIcon />
        </Link>

        <TimelineShareButton
          title={`${title} Intent`}
          text={`UIN'deki ${title} Sosyal Niyetine göz at.`}
          url={detailHref}
          className="!h-6 !min-h-0 !w-auto !min-w-[54px] !rounded-md !px-2 !text-[9.5px] !leading-none"
        />

        <label
          htmlFor={detailToggleId}
          className="ml-auto flex h-6 w-[56px] cursor-pointer items-center justify-center rounded-md border border-gray-200 bg-white px-2 text-[9.5px] font-semibold text-gray-700 transition hover:border-blue-300 hover:text-blue-700 after:ml-1 after:content-['▾'] peer-checked:after:content-['▴']"
        >
          Detaylar
        </label>
      </div>
    </article>
  );
}