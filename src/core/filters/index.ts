import type { FilterConfig, FilterContext, FilterResult, TweetCandidate } from '@/core/types';
import {
  ALL_PRODUCTION_TOPIC_IDS,
  BRAZIL_2026_ELECTION_USER_IDS,
  TOPIC_CATEGORY_MAP,
  expandSupertopic,
  expandTopicIds,
} from '@/data/upstreamPolicyData';
import { extractTimestampFromSnowflake } from '@/utils/snowflake';
import { containsKeywordSequence, tokenizePostText } from '@/utils/textTokens';

export const PRE_SCORING_FILTERS: FilterConfig[] = [
  ['drop_duplicates', 'DropDuplicatesFilter', '重复帖子过滤器'],
  ['core_data_hydration', 'CoreDataHydrationFilter', '核心数据补全过滤器'],
  ['age', 'AgeFilter', '时效过滤器'],
  ['self_tweet', 'SelfTweetFilter', '自己帖子过滤器'],
  ['oon_retweet_reply', 'OONRetweetReplyFilter', '关注外转帖回复过滤器'],
  ['oon_nsfw_simclusters', 'OONNsfwSimclustersFilter', 'SimClusters 敏感内容过滤器'],
  ['retweet_deduplication', 'RetweetDeduplicationFilter', '转帖去重过滤器'],
  ['ineligible_subscription', 'IneligibleSubscriptionFilter', '订阅资格过滤器'],
  ['previously_seen_posts', 'PreviouslySeenPostsFilter', '已看内容过滤器'],
  ['previously_seen_posts_backup', 'PreviouslySeenPostsBackupFilter', '已曝光内容备用过滤器'],
  ['previously_served_posts', 'PreviouslyServedPostsFilter', '已下发内容过滤器'],
  ['muted_keyword', 'MutedKeywordFilter', '静音关键词过滤器'],
  ['author_socialgraph', 'AuthorSocialgraphFilter', '作者社交图过滤器'],
  ['brazil_2026_election', 'Brazil2026ElectionFilter', '巴西 2026 选举过滤器'],
  ['video', 'VideoFilter', '视频过滤器'],
  ['topic_ids', 'TopicIdsFilter', '话题过滤器'],
  ['new_user_min_engagement', 'NewUserMinEngagementFilter', '新用户最低互动过滤器'],
  ['inventory_holdout', 'InventoryHoldoutFilter', '库存留出过滤器'],
].map(([id, name, nameZh]) => ({
  id,
  name,
  nameZh,
  description: `Apply ${name}`,
  descriptionZh: `执行 ${nameZh}`,
  enabled: true,
}));

export const POST_SELECTION_FILTERS: FilterConfig[] = [
  ['vf', 'VFFilter', '可见性过滤器'],
  ['ancillary_vf', 'AncillaryVFFilter', '附属内容可见性过滤器'],
  ['dedup_conversation', 'DedupConversationFilter', '对话去重过滤器'],
].map(([id, name, nameZh]) => ({
  id,
  name,
  nameZh,
  description: `Apply ${name}`,
  descriptionZh: `执行 ${nameZh}`,
  enabled: true,
}));

export const FILTERS = [...PRE_SCORING_FILTERS, ...POST_SELECTION_FILTERS];

function getFilterConfig(filterId: string): FilterConfig | undefined {
  return FILTERS.find((filter) => filter.id === filterId);
}

function unchanged(filter: FilterConfig, candidates: TweetCandidate[]): FilterResult {
  return {
    filterId: filter.id,
    filterName: filter.name,
    inputCount: candidates.length,
    outputCount: candidates.length,
    filteredCandidates: [],
    passedCandidates: candidates,
  };
}

function markFiltered(candidate: TweetCandidate, filter: FilterConfig): TweetCandidate {
  return {
    ...candidate,
    filtered: true,
    filteredBy: filter.id,
    filterReason: filter.description,
  };
}

function runPredicateFilter(
  candidates: TweetCandidate[],
  filter: FilterConfig,
  keep: (candidate: TweetCandidate) => boolean
): FilterResult {
  const passedCandidates: TweetCandidate[] = [];
  const filteredCandidates: TweetCandidate[] = [];
  for (const candidate of candidates) {
    if (keep(candidate)) passedCandidates.push(candidate);
    else filteredCandidates.push(markFiltered(candidate, filter));
  }
  return {
    filterId: filter.id,
    filterName: filter.name,
    inputCount: candidates.length,
    outputCount: passedCandidates.length,
    filteredCandidates,
    passedCandidates,
  };
}

function relatedPostIds(candidate: TweetCandidate): string[] {
  return [candidate.id, candidate.originalTweetId, candidate.inReplyToTweetId]
    .filter((id): id is string => Boolean(id));
}

function originalPostId(candidate: TweetCandidate): string {
  return candidate.originalTweetId || candidate.id;
}

function scoreOf(candidate: TweetCandidate): number {
  return candidate.finalScore ?? candidate.diversityAdjustedScore ?? candidate.weightedScore ?? 0;
}

function compareIds(left: string, right: string): number {
  try {
    const leftId = BigInt(left);
    const rightId = BigInt(right);
    return leftId < rightId ? -1 : leftId > rightId ? 1 : 0;
  } catch {
    return left.localeCompare(right);
  }
}

function conversationKey(candidate: TweetCandidate): string {
  if (candidate.ancestors?.length) {
    return [...candidate.ancestors].sort(compareIds)[0];
  }
  return originalPostId(candidate);
}

function intersects(left: readonly string[] = [], right: readonly string[] = []): boolean {
  if (!left.length || !right.length) return false;
  const values = new Set(right);
  return left.some((value) => values.has(value));
}

function runTopicFilter(
  candidates: TweetCandidate[],
  filter: FilterConfig,
  context: FilterContext
): FilterResult {
  if (!context.topicIds.length && !context.excludedTopicIds.length) return unchanged(filter, candidates);

  let current = candidates;
  const removed: TweetCandidate[] = [];
  if (context.topicIds.length) {
    if (context.isBulkTopicRequest) {
      const expandedRequested = expandTopicIds(context.topicIds);
      const excluded = new Set(
        ALL_PRODUCTION_TOPIC_IDS.filter((topicId) => !expandedRequested.has(topicId))
      );
      const result = runPredicateFilter(current, filter, (candidate) => {
        const filtered = candidate.filteredTopicIds || [];
        return !filtered.length || !filtered.every((topicId) => excluded.has(topicId));
      });
      current = result.passedCandidates;
      removed.push(...result.filteredCandidates);
    } else {
      const result = runPredicateFilter(current, filter, (candidate) => {
        const filtered = candidate.filteredTopicIds || [];
        const unfiltered = candidate.unfilteredTopicIds || [];
        return context.topicIds.some((topicId) => {
          const categories = TOPIC_CATEGORY_MAP[topicId] || [topicId];
          if (intersects(filtered, categories)) return true;
          const supertopics = [...expandSupertopic(topicId)];
          return intersects(unfiltered, categories) && intersects(filtered, supertopics);
        });
      });
      current = result.passedCandidates;
      removed.push(...result.filteredCandidates);
    }
  }

  if (context.excludedTopicIds.length) {
    const excluded = expandTopicIds(context.excludedTopicIds);
    context.excludedTopicIds.forEach((topicId) => excluded.add(topicId));
    const result = runPredicateFilter(current, filter, (candidate) => {
      const filtered = candidate.filteredTopicIds || [];
      return filtered.length > 0 && !filtered.some((topicId) => excluded.has(topicId));
    });
    current = result.passedCandidates;
    removed.push(...result.filteredCandidates);
  }

  return {
    filterId: filter.id,
    filterName: filter.name,
    inputCount: candidates.length,
    outputCount: current.length,
    filteredCandidates: removed,
    passedCandidates: current,
  };
}

function engagementMetric(candidate: TweetCandidate, context: FilterContext): number | undefined {
  const metric = context.newUserMinEngagementMetric;
  let numerator: number | undefined;
  if (metric === 'fav') numerator = candidate.favoriteCount;
  else if (metric === 'view') return candidate.viewCount;
  else if (candidate.favoriteCount !== undefined) {
    numerator = candidate.favoriteCount +
      (candidate.replyCount || 0) +
      (candidate.repostCount || 0) +
      (candidate.quoteCount || 0);
  }
  if (numerator === undefined) return undefined;
  if (!context.newUserMinEngagementUseRatio) return numerator;
  return candidate.viewCount && candidate.viewCount > 0
    ? numerator / candidate.viewCount
    : undefined;
}

const U64_MASK = (1n << 64n) - 1n;
const wrapU64 = (value: bigint) => value & U64_MASK;

function rotateLeft32(value: bigint): bigint {
  return wrapU64((value << 32n) | (value >> 32n));
}

function holdoutBucket(postId: string, viewerId: string): number {
  let post: bigint;
  let viewer: bigint;
  try {
    post = BigInt(postId);
    viewer = BigInt(viewerId);
  } catch {
    // The production contract is u64. Non-numeric fixture IDs never participate in holdout.
    return 100;
  }
  let value = wrapU64(
    wrapU64(post * 0x9E37_79B9_7F4A_7C15n) +
    wrapU64(rotateLeft32(viewer) * 0xD1B5_4A32_D192_ED03n) +
    0x9E37_79B9_7F4A_7C15n
  );
  value = wrapU64((value ^ (value >> 30n)) * 0xBF58_476D_1CE4_E5B9n);
  value = wrapU64((value ^ (value >> 27n)) * 0x94D0_49BB_1331_11EBn);
  value ^= value >> 31n;
  return Number(value % 100n);
}

function runConversationDedup(
  candidates: TweetCandidate[],
  filter: FilterConfig
): FilterResult {
  const passedCandidates: TweetCandidate[] = [];
  const filteredCandidates: TweetCandidate[] = [];
  const bestByConversation = new Map<string, { index: number; score: number }>();

  for (const candidate of candidates) {
    const key = conversationKey(candidate);
    const score = scoreOf(candidate);
    const best = bestByConversation.get(key);
    if (!best) {
      bestByConversation.set(key, { index: passedCandidates.length, score });
      passedCandidates.push(candidate);
    } else if (score > best.score) {
      filteredCandidates.push(markFiltered(passedCandidates[best.index], filter));
      passedCandidates[best.index] = candidate;
      bestByConversation.set(key, { index: best.index, score });
    } else {
      filteredCandidates.push(markFiltered(candidate, filter));
    }
  }

  return {
    filterId: filter.id,
    filterName: filter.name,
    inputCount: candidates.length,
    outputCount: passedCandidates.length,
    filteredCandidates,
    passedCandidates,
  };
}

export function runFilter(
  filterId: string,
  candidates: TweetCandidate[],
  context: FilterContext
): FilterResult {
  const filter = getFilterConfig(filterId);
  if (!filter?.enabled) {
    const fallback: FilterConfig = filter || {
      id: filterId,
      name: filterId,
      nameZh: filterId,
      description: filterId,
      descriptionZh: filterId,
      enabled: false,
    };
    return unchanged(fallback, candidates);
  }

  if (filterId === 'dedup_conversation') return runConversationDedup(candidates, filter);
  const mutedTokenSequences = context.mutedKeywords
    .map(tokenizePostText)
    .filter((tokens) => tokens.length > 0);
  const seenIds = new Set([...context.seenTweetIds, ...context.bloomSeenTweetIds]);
  const impressedIds = new Set(context.impressedTweetIds);
  const servedIds = new Set(context.servedTweetIds);

  switch (filterId) {
    case 'drop_duplicates': {
      const seen = new Set<string>();
      return runPredicateFilter(candidates, filter, (candidate) => {
        if (seen.has(candidate.id)) return false;
        seen.add(candidate.id);
        return true;
      });
    }
    case 'core_data_hydration':
      return runPredicateFilter(candidates, filter, (candidate) =>
        Boolean(candidate.authorId.trim()) && candidate.authorId !== '0'
      );
    case 'age':
      return runPredicateFilter(candidates, filter, (candidate) => {
        try {
          const ageHours = (context.currentTime - extractTimestampFromSnowflake(candidate.id)) / 3_600_000;
          return ageHours >= 0 && ageHours <= context.maxTweetAgeHours;
        } catch {
          return false;
        }
      });
    case 'self_tweet':
      return runPredicateFilter(candidates, filter, (candidate) => candidate.authorId !== context.currentUserId);
    case 'oon_retweet_reply':
      return runPredicateFilter(candidates, filter, (candidate) => {
        const isReply = Boolean(candidate.inReplyToTweetId);
        const isRetweet = Boolean(candidate.originalTweetId);
        return !(
          (candidate.inNetwork === false && (isReply || isRetweet)) ||
          (isReply && !candidate.ancestors?.length)
        );
      });
    case 'oon_nsfw_simclusters':
      return runPredicateFilter(candidates, filter, (candidate) => !(
        candidate.servedType === 'for_you_simclusters' &&
        candidate.inNetwork === false &&
        candidate.nsfwAuthor === true
      ));
    case 'retweet_deduplication': {
      const seen = new Set<string>();
      return runPredicateFilter(candidates, filter, (candidate) => {
        const id = originalPostId(candidate);
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
      });
    }
    case 'ineligible_subscription':
      return runPredicateFilter(candidates, filter, (candidate) =>
        !candidate.subscriptionAuthorId || context.subscribedAuthorIds.includes(candidate.subscriptionAuthorId)
      );
    case 'previously_seen_posts':
      return runPredicateFilter(candidates, filter, (candidate) =>
        !relatedPostIds(candidate).some((id) => seenIds.has(id))
      );
    case 'previously_seen_posts_backup':
      if (!impressedIds.size) return unchanged(filter, candidates);
      return runPredicateFilter(candidates, filter, (candidate) =>
        !relatedPostIds(candidate).some((id) => impressedIds.has(id))
      );
    case 'previously_served_posts':
      if (!context.enableServedFilterAllRequests && !context.isBottomRequest) {
        return unchanged(filter, candidates);
      }
      return runPredicateFilter(candidates, filter, (candidate) =>
        !relatedPostIds(candidate).some((id) => servedIds.has(id))
      );
    case 'muted_keyword':
      if (!mutedTokenSequences.length) return unchanged(filter, candidates);
      return runPredicateFilter(candidates, filter, (candidate) => {
        const contentTokens = tokenizePostText(candidate.content);
        return !mutedTokenSequences.some((mutedTokens) =>
          containsKeywordSequence(contentTokens, mutedTokens)
        );
      });
    case 'author_socialgraph':
      return runPredicateFilter(candidates, filter, (candidate) =>
        !context.blockedUsers.includes(candidate.authorId) &&
        !context.mutedUsers.includes(candidate.authorId) &&
        !(candidate.quotedAuthorId && context.blockedUsers.includes(candidate.quotedAuthorId)) &&
        !(candidate.retweetedAuthorId && context.blockedUsers.includes(candidate.retweetedAuthorId)) &&
        !candidate.authorBlocksViewer &&
        !candidate.quotedAuthorBlocksViewer
      );
    case 'brazil_2026_election': {
      const isExcluded = (authorId: string | undefined) => Boolean(
        authorId &&
        BRAZIL_2026_ELECTION_USER_IDS.has(authorId) &&
        !context.followedAuthorIds.includes(authorId)
      );
      return runPredicateFilter(candidates, filter, (candidate) => !(
        isExcluded(candidate.authorId) ||
        isExcluded(candidate.retweetedAuthorId) ||
        isExcluded(candidate.quotedAuthorId) ||
        candidate.ancestorUserIds?.some(isExcluded)
      ));
    }
    case 'video':
      if (!context.excludeVideos) return unchanged(filter, candidates);
      return runPredicateFilter(candidates, filter, (candidate) => candidate.videoDurationMs === undefined);
    case 'topic_ids':
      return runTopicFilter(candidates, filter, context);
    case 'new_user_min_engagement': {
      const inAgeWindow = context.userAccountAgeSeconds < context.newUserMinEngagementMaxAccountAgeSecs;
      const inResurrectionWindow = context.resurrectionAgeSeconds !== undefined &&
        context.resurrectionAgeSeconds >= 0 &&
        context.resurrectionAgeSeconds < context.newUserMinEngagementMaxResurrectionAgeSecs;
      if (!context.enableNewUserMinEngagementFilter || (!inAgeWindow && !inResurrectionWindow)) {
        return unchanged(filter, candidates);
      }
      const values = candidates.map((candidate) => engagementMetric(candidate, context));
      if (values.every((value) => value === undefined)) return unchanged(filter, candidates);
      return runPredicateFilter(candidates, filter, (candidate) => {
        if (candidate.inNetwork !== false) return true;
        const value = engagementMetric(candidate, context);
        return value === undefined || value >= context.newUserMinEngagementThreshold;
      });
    }
    case 'inventory_holdout': {
      const hasPercentage =
        context.inventoryHoldoutOriginalsPercent > 0 ||
        context.inventoryHoldoutRepliesPercent > 0 ||
        context.inventoryHoldoutRetweetsPercent > 0;
      if (!context.enableInventoryHoldout || !hasPercentage) return unchanged(filter, candidates);
      return runPredicateFilter(candidates, filter, (candidate) => {
        const percentage = Math.min(100, candidate.originalTweetId
          ? context.inventoryHoldoutRetweetsPercent
          : candidate.inReplyToTweetId
            ? context.inventoryHoldoutRepliesPercent
            : context.inventoryHoldoutOriginalsPercent
        );
        return holdoutBucket(originalPostId(candidate), context.currentUserId) >= percentage;
      });
    }
    case 'vf':
      return runPredicateFilter(candidates, filter, (candidate) => candidate.visibilityAction !== 'drop');
    case 'ancillary_vf':
      return runPredicateFilter(candidates, filter, (candidate) => !candidate.dropAncillaryPosts);
    default:
      return unchanged(filter, candidates);
  }
}

function runFilterList(
  candidates: TweetCandidate[],
  context: FilterContext,
  filters: FilterConfig[],
  enabledFilterIds?: string[]
): { results: FilterResult[]; finalCandidates: TweetCandidate[]; filteredCandidates: TweetCandidate[] } {
  const results: FilterResult[] = [];
  const filteredCandidates: TweetCandidate[] = [];
  let currentCandidates = [...candidates];
  for (const filter of filters) {
    if (enabledFilterIds && !enabledFilterIds.includes(filter.id)) continue;
    const result = runFilter(filter.id, currentCandidates, context);
    results.push(result);
    filteredCandidates.push(...result.filteredCandidates);
    currentCandidates = result.passedCandidates;
  }
  return { results, finalCandidates: currentCandidates, filteredCandidates };
}

export function runAllFilters(
  candidates: TweetCandidate[],
  context: FilterContext,
  enabledFilterIds?: string[]
) {
  return runFilterList(candidates, context, PRE_SCORING_FILTERS, enabledFilterIds);
}

export function runPostSelectionFilters(
  candidates: TweetCandidate[],
  context: FilterContext,
  enabledFilterIds?: string[]
) {
  return runFilterList(candidates, context, POST_SELECTION_FILTERS, enabledFilterIds);
}

export function getFilterById(id: string): FilterConfig | undefined {
  return FILTERS.find((filter) => filter.id === id);
}
