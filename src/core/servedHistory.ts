import type { FilterContext } from '@/core/types';
import { FILTER_DEFAULTS } from '@/data/upstreamSnapshot';

export function hydrateServedTweetIds(context: FilterContext): string[] {
  if (context.servedHistory.length === 0) return context.servedTweetIds;

  const cutoff = context.currentTime -
    FILTER_DEFAULTS.servedHistory.durationMinutes * 60_000;
  const ids: string[] = [];

  for (const entry of context.servedHistory) {
    if (entry.servedAt < cutoff || entry.entityType === 'video_carousel_module') continue;
    for (const item of entry.items) {
      ids.push(item.tweetId);
      if (item.sourceTweetId) ids.push(item.sourceTweetId);
      if (ids.length >= FILTER_DEFAULTS.servedHistory.maxItems) {
        return ids.slice(0, FILTER_DEFAULTS.servedHistory.maxItems);
      }
    }
  }

  return ids.slice(0, FILTER_DEFAULTS.servedHistory.maxItems);
}
