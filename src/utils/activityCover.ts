import { categoryCover, coverCategory, type CoverContext } from '@/utils/coverPolicy';

export function getSystemActivityCover(categoryName?: string | null, activityName?: string | null, cardType?: string | null) {
  return categoryCover(coverCategory({categoryName, activityName, cardType}));
}
export function getReliableSystemCoverFallback(context: CoverContext = {}) {
  return categoryCover(coverCategory(context));
}
export function resolveActivityCover({planCoverUrl, activityCoverUrl, categoryCoverUrl, categoryName, activityName, cardType}: CoverContext & {
  planCoverUrl?: string | null; activityCoverUrl?: string | null; categoryCoverUrl?: string | null;
}) {
  return planCoverUrl?.trim() || activityCoverUrl?.trim() || categoryCoverUrl?.trim() || getSystemActivityCover(categoryName, activityName, cardType);
}
