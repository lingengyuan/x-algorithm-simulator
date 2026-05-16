import { TweetCandidate, FilterContext, FilterConfig, FilterResult } from '@/core/types';
import { getAgeInHours } from '@/utils/snowflake';

export const PRE_SCORING_FILTERS: FilterConfig[] = [
  {
    id: 'drop_duplicates',
    name: 'DropDuplicatesFilter',
    nameZh: '重复推文过滤器',
    description: 'Remove duplicate post IDs',
    descriptionZh: '移除重复推文 ID',
    enabled: true,
  },
  {
    id: 'core_data_hydration',
    name: 'CoreDataHydrationFilter',
    nameZh: '核心数据补全过滤器',
    description: 'Remove candidates missing core metadata',
    descriptionZh: '移除缺失核心元数据的候选',
    enabled: true,
  },
  {
    id: 'age',
    name: 'AgeFilter',
    nameZh: '时效过滤器',
    description: 'Filter tweets older than configured threshold',
    descriptionZh: '过滤超过时效阈值的推文',
    enabled: true,
  },
  {
    id: 'self_tweet',
    name: 'SelfTweetFilter',
    nameZh: '自己推文过滤器',
    description: 'Remove user\'s own tweets',
    descriptionZh: '移除用户自己的推文',
    enabled: true,
  },
  {
    id: 'retweet_deduplication',
    name: 'RetweetDeduplicationFilter',
    nameZh: '转推去重过滤器',
    description: 'Deduplicate reposts of the same content',
    descriptionZh: '对同一原文的转推进行去重',
    enabled: true,
  },
  {
    id: 'ineligible_subscription',
    name: 'IneligibleSubscriptionFilter',
    nameZh: '订阅资格过滤器',
    description: 'Remove subscription-only posts user cannot access',
    descriptionZh: '移除用户无订阅资格的内容',
    enabled: true,
  },
  {
    id: 'previously_seen_posts',
    name: 'PreviouslySeenPostsFilter',
    nameZh: '已看内容过滤器',
    description: 'Remove posts previously seen by user',
    descriptionZh: '移除用户看过的内容',
    enabled: true,
  },
  {
    id: 'previously_seen_posts_backup',
    name: 'PreviouslySeenPostsBackupFilter',
    nameZh: '已曝光内容备用过滤器',
    description: 'Remove posts from impressed history backup',
    descriptionZh: '移除备用曝光历史中的内容',
    enabled: true,
  },
  {
    id: 'previously_served_posts',
    name: 'PreviouslyServedPostsFilter',
    nameZh: '已下发内容过滤器',
    description: 'Remove posts already served in this session',
    descriptionZh: '移除会话中已下发过的内容',
    enabled: true,
  },
  {
    id: 'muted_keyword',
    name: 'MutedKeywordFilter',
    nameZh: '静音关键词过滤器',
    description: 'Remove posts containing muted keywords',
    descriptionZh: '移除包含静音关键词的内容',
    enabled: true,
  },
  {
    id: 'author_socialgraph',
    name: 'AuthorSocialgraphFilter',
    nameZh: '作者社交图过滤器',
    description: 'Remove posts from blocked/muted authors',
    descriptionZh: '移除来自屏蔽/静音作者的内容',
    enabled: true,
  },
  {
    id: 'video',
    name: 'VideoFilter',
    nameZh: '视频过滤器',
    description: 'Remove videos when request excludes video content',
    descriptionZh: '请求排除视频时移除视频内容',
    enabled: true,
  },
  {
    id: 'topic_ids',
    name: 'TopicIdsFilter',
    nameZh: '话题过滤器',
    description: 'Keep requested topics and remove excluded topics',
    descriptionZh: '保留请求话题并移除排除话题',
    enabled: true,
  },
  {
    id: 'new_user_topic_ids',
    name: 'NewUserTopicIdsFilter',
    nameZh: '新用户话题过滤器',
    description: 'For new users, keep OON posts tied to inferred topics',
    descriptionZh: '新用户场景保留匹配推断话题的关注外内容',
    enabled: true,
  },
];

export const POST_SELECTION_FILTERS: FilterConfig[] = [
  {
    id: 'vf',
    name: 'VFFilter',
    nameZh: '可见性过滤器',
    description: 'Drop posts failed by visibility filtering',
    descriptionZh: '移除未通过可见性过滤的内容',
    enabled: true,
  },
  {
    id: 'ancillary_vf',
    name: 'AncillaryVFFilter',
    nameZh: '附属内容可见性过滤器',
    description: 'Drop ancillary posts marked by visibility checks',
    descriptionZh: '移除可见性检查标记的附属内容',
    enabled: true,
  },
  {
    id: 'dedup_conversation',
    name: 'DedupConversationFilter',
    nameZh: '对话去重过滤器',
    description: 'Keep highest-scored candidate per conversation',
    descriptionZh: '每个对话只保留最高分候选',
    enabled: true,
  },
];

export const FILTERS: FilterConfig[] = [
  ...PRE_SCORING_FILTERS,
  ...POST_SELECTION_FILTERS,
];

function getFilterConfig(filterId: string): FilterConfig | undefined {
  return FILTERS.find((filter) => filter.id === filterId);
}

function normalizeText(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim();
}

function getRelatedTweetIds(candidate: TweetCandidate): string[] {
  const ids = new Set<string>([candidate.id]);

  if (candidate.originalTweetId) {
    ids.add(candidate.originalTweetId);
  }

  if (candidate.conversationId) {
    ids.add(candidate.conversationId);
  }

  for (const ancestor of candidate.ancestors || []) {
    ids.add(ancestor);
  }

  return [...ids];
}

function getConversationKey(candidate: TweetCandidate): string {
  const rootAncestor = candidate.ancestors?.[0];
  return rootAncestor || candidate.conversationId || candidate.id;
}

function getCandidateScore(candidate: TweetCandidate): number {
  return (
    candidate.finalScore ??
    candidate.diversityAdjustedScore ??
    candidate.weightedScore ??
    0
  );
}

function intersects(left: readonly number[] = [], right: readonly number[] = []): boolean {
  if (!left.length || !right.length) {
    return false;
  }

  const rightSet = new Set(right);
  return left.some((value) => rightSet.has(value));
}

function expandTopicIds(topicIds: readonly number[], context: FilterContext): number[] {
  const expanded = new Set<number>();

  for (const topicId of topicIds) {
    expanded.add(topicId);
    for (const relatedTopicId of context.topicExpansionMap[topicId] || []) {
      expanded.add(relatedTopicId);
    }
  }

  return [...expanded];
}

function collectCandidateTopicIds(candidate: TweetCandidate): number[] {
  return [
    ...(candidate.filteredTopicIds || []),
    ...(candidate.unfilteredTopicIds || []),
  ];
}

function markFiltered(candidate: TweetCandidate, filter: FilterConfig): TweetCandidate {
  return {
    ...candidate,
    filtered: true,
    filteredBy: filter.id,
    filterReason: filter.description,
  };
}

function runBasicFilter(
  candidates: TweetCandidate[],
  filter: FilterConfig,
  keepPredicate: (candidate: TweetCandidate) => boolean
): FilterResult {
  const passedCandidates: TweetCandidate[] = [];
  const filteredCandidates: TweetCandidate[] = [];

  for (const candidate of candidates) {
    if (keepPredicate(candidate)) {
      passedCandidates.push(candidate);
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

function runDedupConversationFilter(
  candidates: TweetCandidate[],
  filter: FilterConfig
): FilterResult {
  const passedCandidates: TweetCandidate[] = [];
  const filteredCandidates: TweetCandidate[] = [];
  const bestByConversation = new Map<string, { index: number; score: number }>();

  for (const candidate of candidates) {
    const conversationKey = getConversationKey(candidate);
    const score = getCandidateScore(candidate);
    const existing = bestByConversation.get(conversationKey);

    if (!existing) {
      bestByConversation.set(conversationKey, {
        index: passedCandidates.length,
        score,
      });
      passedCandidates.push(candidate);
      continue;
    }

    if (score > existing.score) {
      const replaced = passedCandidates[existing.index];
      filteredCandidates.push(markFiltered(replaced, filter));
      passedCandidates[existing.index] = candidate;
      bestByConversation.set(conversationKey, {
        index: existing.index,
        score,
      });
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

// Run a single filter
export function runFilter(
  filterId: string,
  candidates: TweetCandidate[],
  context: FilterContext
): FilterResult {
  const filter = getFilterConfig(filterId);
  if (!filter || !filter.enabled) {
    return {
      filterId,
      filterName: filter?.name || filterId,
      inputCount: candidates.length,
      outputCount: candidates.length,
      filteredCandidates: [],
      passedCandidates: candidates,
    };
  }

  if (filterId === 'dedup_conversation') {
    return runDedupConversationFilter(candidates, filter);
  }

  const normalizedMutedKeywords = context.mutedKeywords.map(normalizeText);
  const seenIds = new Set<string>([...context.seenTweetIds, ...context.bloomSeenTweetIds]);
  const impressedIds = new Set<string>(context.impressedTweetIds);
  const servedIds = new Set<string>(context.servedTweetIds);

  switch (filterId) {
    case 'drop_duplicates': {
      const seenPostIds = new Set<string>();
      return runBasicFilter(candidates, filter, (candidate) => {
        if (seenPostIds.has(candidate.id)) {
          return false;
        }
        seenPostIds.add(candidate.id);
        return true;
      });
    }

    case 'core_data_hydration':
      return runBasicFilter(
        candidates,
        filter,
        (candidate) => Boolean(candidate.id.trim()) && Boolean(candidate.authorId.trim())
      );

    case 'age':
      return runBasicFilter(candidates, filter, (candidate) => {
        const ageHours = getAgeInHours(candidate.id);
        return ageHours <= context.maxTweetAgeHours;
      });

    case 'self_tweet':
      return runBasicFilter(candidates, filter, (candidate) => candidate.authorId !== context.currentUserId);

    case 'retweet_deduplication': {
      const seenPostIds = new Set<string>();
      return runBasicFilter(candidates, filter, (candidate) => {
        const dedupKey = candidate.originalTweetId || candidate.id;
        if (seenPostIds.has(dedupKey)) {
          return false;
        }
        seenPostIds.add(dedupKey);
        return true;
      });
    }

    case 'ineligible_subscription':
      return runBasicFilter(candidates, filter, (candidate) => {
        if (!candidate.subscriptionAuthorId) {
          return true;
        }
        return context.subscribedAuthorIds.includes(candidate.subscriptionAuthorId);
      });

    case 'previously_seen_posts':
      return runBasicFilter(candidates, filter, (candidate) => {
        const relatedIds = getRelatedTweetIds(candidate);
        return !relatedIds.some((id) => seenIds.has(id));
      });

    case 'previously_seen_posts_backup':
      if (!impressedIds.size) {
        return {
          filterId,
          filterName: filter.name,
          inputCount: candidates.length,
          outputCount: candidates.length,
          filteredCandidates: [],
          passedCandidates: candidates,
        };
      }
      return runBasicFilter(candidates, filter, (candidate) => {
        const relatedIds = getRelatedTweetIds(candidate);
        return !relatedIds.some((id) => impressedIds.has(id));
      });

    case 'previously_served_posts':
      if (!context.isBottomRequest) {
        return {
          filterId,
          filterName: filter.name,
          inputCount: candidates.length,
          outputCount: candidates.length,
          filteredCandidates: [],
          passedCandidates: candidates,
        };
      }
      return runBasicFilter(candidates, filter, (candidate) => {
        const relatedIds = getRelatedTweetIds(candidate);
        return !relatedIds.some((id) => servedIds.has(id));
      });

    case 'muted_keyword':
      if (!normalizedMutedKeywords.length) {
        return {
          filterId,
          filterName: filter.name,
          inputCount: candidates.length,
          outputCount: candidates.length,
          filteredCandidates: [],
          passedCandidates: candidates,
        };
      }
      return runBasicFilter(candidates, filter, (candidate) => {
        const normalizedContent = normalizeText(candidate.content);
        return !normalizedMutedKeywords.some((keyword) => normalizedContent.includes(keyword));
      });

    case 'author_socialgraph':
      return runBasicFilter(candidates, filter, (candidate) => {
        return (
          !context.blockedUsers.includes(candidate.authorId) &&
          !context.mutedUsers.includes(candidate.authorId) &&
          !(candidate.quotedAuthorId && context.blockedUsers.includes(candidate.quotedAuthorId)) &&
          !(candidate.retweetedAuthorId && context.blockedUsers.includes(candidate.retweetedAuthorId)) &&
          !candidate.authorBlocksViewer &&
          !candidate.quotedAuthorBlocksViewer &&
          !candidate.viewerBlocksQuotedAuthor &&
          !candidate.viewerBlocksRetweetedAuthor
        );
      });

    case 'video':
      if (!context.excludeVideos) {
        return {
          filterId,
          filterName: filter.name,
          inputCount: candidates.length,
          outputCount: candidates.length,
          filteredCandidates: [],
          passedCandidates: candidates,
        };
      }
      return runBasicFilter(candidates, filter, (candidate) => !candidate.hasVideo && !candidate.videoDurationMs);

    case 'topic_ids': {
      if (!context.topicIds.length && !context.excludedTopicIds.length) {
        return {
          filterId,
          filterName: filter.name,
          inputCount: candidates.length,
          outputCount: candidates.length,
          filteredCandidates: [],
          passedCandidates: candidates,
        };
      }

      const expandedTopicIds = expandTopicIds(context.topicIds, context);
      const expandedExcludedTopicIds = expandTopicIds(context.excludedTopicIds, context);

      return runBasicFilter(candidates, filter, (candidate) => {
        const candidateTopics = collectCandidateTopicIds(candidate);

        if (expandedExcludedTopicIds.length && !candidateTopics.length) {
          return false;
        }

        if (expandedExcludedTopicIds.length && intersects(candidateTopics, expandedExcludedTopicIds)) {
          return false;
        }

        if (!expandedTopicIds.length) {
          return true;
        }

        return intersects(candidateTopics, expandedTopicIds);
      });
    }

    case 'new_user_topic_ids': {
      if (!context.isNewUser || !context.newUserTopicIds.length || context.topicIds.length) {
        return {
          filterId,
          filterName: filter.name,
          inputCount: candidates.length,
          outputCount: candidates.length,
          filteredCandidates: [],
          passedCandidates: candidates,
        };
      }
      const expandedNewUserTopics = expandTopicIds(context.newUserTopicIds, context);
      return runBasicFilter(candidates, filter, (candidate) => {
        if (candidate.inNetwork) {
          return true;
        }

        return intersects(collectCandidateTopicIds(candidate), expandedNewUserTopics);
      });
    }

    case 'vf':
      return runBasicFilter(candidates, filter, (candidate) => !candidate.visibilityFiltered);

    case 'ancillary_vf':
      return runBasicFilter(candidates, filter, (candidate) => !candidate.dropAncillaryPosts);

    default:
      return {
        filterId,
        filterName: filter.name,
        inputCount: candidates.length,
        outputCount: candidates.length,
        filteredCandidates: [],
        passedCandidates: candidates,
      };
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
    if (enabledFilterIds && !enabledFilterIds.includes(filter.id)) {
      continue;
    }

    const result = runFilter(filter.id, currentCandidates, context);
    results.push(result);
    filteredCandidates.push(...result.filteredCandidates);
    currentCandidates = result.passedCandidates;
  }

  return {
    results,
    finalCandidates: currentCandidates,
    filteredCandidates,
  };
}

// Run all pre-scoring filters in sequence
export function runAllFilters(
  candidates: TweetCandidate[],
  context: FilterContext,
  enabledFilterIds?: string[]
): { results: FilterResult[]; finalCandidates: TweetCandidate[]; filteredCandidates: TweetCandidate[] } {
  return runFilterList(candidates, context, PRE_SCORING_FILTERS, enabledFilterIds);
}

export function runPostSelectionFilters(
  candidates: TweetCandidate[],
  context: FilterContext,
  enabledFilterIds?: string[]
): { results: FilterResult[]; finalCandidates: TweetCandidate[]; filteredCandidates: TweetCandidate[] } {
  return runFilterList(candidates, context, POST_SELECTION_FILTERS, enabledFilterIds);
}

// Get filter by ID
export function getFilterById(id: string): FilterConfig | undefined {
  return FILTERS.find((filter) => filter.id === id);
}
