import {
  FeedItem,
  TweetCandidate,
  WeightConfig,
  FilterContext,
  PipelineStep,
  SideEffectResult,
} from './types';
import {
  FILTERS,
  PRE_SCORING_FILTERS,
  POST_SELECTION_FILTERS,
  runAllFilters,
  runPostSelectionFilters,
  runFilter,
} from './filters';
import {
  SCORERS,
  runAllScorers,
  runPhoenixScorer,
  runRankingScorer,
  runVMRanker,
} from './scorers';
import { buildForYouFeed } from './feed';

export interface PipelineConfig {
  enabledFilters: string[];
  weights: WeightConfig;
  topK: number;
}

export interface PipelineResult {
  steps: PipelineStep[];
  initialCount: number;
  afterFilterCount: number;
  finalCount: number;
  finalCandidates: TweetCandidate[];
  finalFeedItems: FeedItem[];
  allCandidates: TweetCandidate[];
}

type StepTemplate = Pick<PipelineStep, 'id' | 'name' | 'nameZh' | 'description' | 'descriptionZh' | 'type'>;

const QUERY_HYDRATOR_STEPS: StepTemplate[] = [
  {
    id: 'query_hydrator_scoring_sequence',
    name: 'ScoringSequenceQueryHydrator',
    nameZh: '排序行为序列补全器',
    description: 'Hydrate history used by the ranking model',
    descriptionZh: '补全排序模型使用的历史行为',
    type: 'query_hydrator',
  },
  {
    id: 'query_hydrator_retrieval_sequence',
    name: 'RetrievalSequenceQueryHydrator',
    nameZh: '召回行为序列补全器',
    description: 'Hydrate history used by retrieval',
    descriptionZh: '补全召回使用的历史行为',
    type: 'query_hydrator',
  },
  {
    id: 'query_hydrator_socialgraph',
    name: 'BlockedUserIdsQueryHydrator',
    nameZh: '屏蔽用户补全器',
    description: 'Hydrate blocked user IDs',
    descriptionZh: '补全屏蔽用户列表',
    type: 'query_hydrator',
  },
  {
    id: 'query_hydrator_muted_users',
    name: 'MutedUserIdsQueryHydrator',
    nameZh: '静音用户补全器',
    description: 'Hydrate muted user IDs',
    descriptionZh: '补全静音用户列表',
    type: 'query_hydrator',
  },
  {
    id: 'query_hydrator_followed_users',
    name: 'FollowedUserIdsQueryHydrator',
    nameZh: '关注用户补全器',
    description: 'Hydrate followed user IDs',
    descriptionZh: '补全关注用户列表',
    type: 'query_hydrator',
  },
  {
    id: 'query_hydrator_subscribed_users',
    name: 'SubscribedUserIdsQueryHydrator',
    nameZh: '订阅用户补全器',
    description: 'Hydrate subscribed author IDs',
    descriptionZh: '补全订阅作者列表',
    type: 'query_hydrator',
  },
  {
    id: 'query_hydrator_cached_posts',
    name: 'CachedPostsQueryHydrator',
    nameZh: '缓存内容补全器',
    description: 'Hydrate cached posts for reuse',
    descriptionZh: '补全可复用的缓存内容',
    type: 'query_hydrator',
  },
  {
    id: 'query_hydrator_mutual_follow',
    name: 'MutualFollowQueryHydrator',
    nameZh: '共同关注补全器',
    description: 'Hydrate mutual-follow graph context',
    descriptionZh: '补全共同关注关系上下文',
    type: 'query_hydrator',
  },
  {
    id: 'query_hydrator_demographics',
    name: 'UserDemographicsQueryHydrator',
    nameZh: '用户画像补全器',
    description: 'Hydrate demographic context',
    descriptionZh: '补全用户画像上下文',
    type: 'query_hydrator',
  },
  {
    id: 'query_hydrator_followed_grok_topics',
    name: 'FollowedGrokTopicsQueryHydrator',
    nameZh: '关注 Grok 话题补全器',
    description: 'Hydrate followed Grok topics',
    descriptionZh: '补全已关注的 Grok 话题',
    type: 'query_hydrator',
  },
  {
    id: 'query_hydrator_followed_starter_packs',
    name: 'FollowedStarterPacksQueryHydrator',
    nameZh: '关注 starter pack 补全器',
    description: 'Hydrate followed starter packs',
    descriptionZh: '补全已关注的 starter pack',
    type: 'query_hydrator',
  },
  {
    id: 'query_hydrator_inferred_grok_topics',
    name: 'InferredGrokTopicsQueryHydrator',
    nameZh: '推断 Grok 话题补全器',
    description: 'Hydrate inferred Grok topics',
    descriptionZh: '补全推断出的 Grok 话题',
    type: 'query_hydrator',
  },
  {
    id: 'query_hydrator_impression_bloom',
    name: 'ImpressionBloomFilterQueryHydrator',
    nameZh: '曝光布隆过滤器补全器',
    description: 'Hydrate impression history backup',
    descriptionZh: '补全曝光历史备用记录',
    type: 'query_hydrator',
  },
  {
    id: 'query_hydrator_ip',
    name: 'IpQueryHydrator',
    nameZh: 'IP 上下文补全器',
    description: 'Hydrate IP-derived context',
    descriptionZh: '补全 IP 派生上下文',
    type: 'query_hydrator',
  },
  {
    id: 'query_hydrator_inferred_gender',
    name: 'UserInferredGenderQueryHydrator',
    nameZh: '推断性别补全器',
    description: 'Hydrate inferred gender context',
    descriptionZh: '补全推断性别上下文',
    type: 'query_hydrator',
  },
];

function createStep(template: StepTemplate, inputCount: number, outputCount: number): PipelineStep {
  return {
    ...template,
    inputCount,
    outputCount,
  };
}

function dedupeById(candidates: TweetCandidate[]): TweetCandidate[] {
  const seenIds = new Set<string>();
  const merged: TweetCandidate[] = [];

  for (const candidate of candidates) {
    if (seenIds.has(candidate.id)) {
      continue;
    }
    seenIds.add(candidate.id);
    merged.push(candidate);
  }

  return merged;
}

function sourceThunder(candidates: TweetCandidate[], context: FilterContext): TweetCandidate[] {
  return candidates
    .filter(
      (candidate) =>
        candidate.inNetwork ||
        candidate.authorId === context.currentUserId ||
        context.followedAuthorIds.includes(candidate.authorId)
    )
    .map((candidate) => ({
      ...candidate,
      inNetwork: true,
      servedType: 'for_you_in_network',
      sourceType: 'thunder',
      filtered: false,
      filteredBy: undefined,
      filterReason: undefined,
    }));
}

function sourceTweetMixer(candidates: TweetCandidate[], context: FilterContext): TweetCandidate[] {
  if (context.inNetworkOnly) {
    return [];
  }

  return candidates
    .filter((candidate, index) => !candidate.inNetwork && (candidate.conversationId || index % 5 === 0))
    .map((candidate) => ({
      ...candidate,
      sourceType: 'tweet_mixer',
      filtered: false,
      filteredBy: undefined,
      filterReason: undefined,
    }));
}

function sourcePhoenix(candidates: TweetCandidate[], context: FilterContext): TweetCandidate[] {
  if (context.inNetworkOnly) {
    return [];
  }

  return candidates
    .filter((candidate) => !candidate.inNetwork)
    .map((candidate) => ({
      ...candidate,
      servedType: 'for_you_phoenix_retrieval',
      sourceType: 'phoenix',
      filtered: false,
      filteredBy: undefined,
      filterReason: undefined,
    }));
}

function sourcePhoenixTopics(candidates: TweetCandidate[], context: FilterContext): TweetCandidate[] {
  if (!context.topicIds.length && !context.newUserTopicIds.length) {
    return [];
  }

  const targetTopics = context.topicIds.length ? context.topicIds : context.newUserTopicIds;
  return candidates
    .filter((candidate) => {
      const topics = new Set([...(candidate.filteredTopicIds || []), ...(candidate.unfilteredTopicIds || [])]);
      return targetTopics.some((topicId) => topics.has(topicId));
    })
    .map((candidate) => ({
      ...candidate,
      sourceType: 'phoenix_topics',
      servedType: 'for_you_phoenix_retrieval',
      filtered: false,
      filteredBy: undefined,
      filterReason: undefined,
    }));
}

function sourcePhoenixMoe(candidates: TweetCandidate[], context: FilterContext): TweetCandidate[] {
  if (context.inNetworkOnly) {
    return [];
  }

  return candidates
    .filter((candidate) => !candidate.inNetwork && candidate.phoenixScores.followAuthorScore > 0.12)
    .map((candidate) => ({
      ...candidate,
      sourceType: 'phoenix_moe',
      servedType: 'for_you_phoenix_retrieval',
      filtered: false,
      filteredBy: undefined,
      filterReason: undefined,
    }));
}

function sourceCachedPosts(candidates: TweetCandidate[], context: FilterContext): TweetCandidate[] {
  if (!context.servedTweetIds.length && !context.impressedTweetIds.length) {
    return [];
  }

  const cachedIds = new Set([...context.servedTweetIds, ...context.impressedTweetIds]);
  return candidates
    .filter((candidate) => cachedIds.has(candidate.id))
    .map((candidate) => ({
      ...candidate,
      sourceType: 'cached_posts',
      filtered: false,
      filteredBy: undefined,
      filterReason: undefined,
    }));
}

function hydrateInNetwork(candidates: TweetCandidate[], context: FilterContext): TweetCandidate[] {
  return candidates.map((candidate) => ({
    ...candidate,
    inNetwork:
      candidate.authorId === context.currentUserId ||
      context.followedAuthorIds.includes(candidate.authorId) ||
      candidate.servedType === 'for_you_in_network',
  }));
}

function hydrateCoreData(candidates: TweetCandidate[]): TweetCandidate[] {
  return candidates.map((candidate) => ({
    ...candidate,
    content: candidate.content || '',
    authorId: candidate.authorId || '',
  }));
}

function hydrateQuote(candidates: TweetCandidate[]): TweetCandidate[] {
  return candidates.map((candidate) => {
    if (candidate.quotedTweetId || !candidate.content.toLowerCase().includes('thread')) {
      return candidate;
    }

    return {
      ...candidate,
      quotedTweetId: `${candidate.id}_quote`,
      quotedVideoDurationMs: candidate.hasVideo ? candidate.videoDurationMs : undefined,
    };
  });
}

function hydrateVideoDuration(candidates: TweetCandidate[]): TweetCandidate[] {
  return candidates.map((candidate) => {
    if (!candidate.hasVideo) {
      return candidate;
    }

    if (candidate.videoDurationMs && candidate.videoDurationMs > 0) {
      return candidate;
    }

    return {
      ...candidate,
      videoDurationMs: 15000,
    };
  });
}

function hydrateHasMedia(candidates: TweetCandidate[]): TweetCandidate[] {
  return candidates.map((candidate) => ({
    ...candidate,
    hasImage: candidate.hasImage || false,
    hasVideo: candidate.hasVideo || false,
  }));
}

function hydrateSubscription(candidates: TweetCandidate[]): TweetCandidate[] {
  return candidates.map((candidate, index) => {
    if (candidate.subscriptionAuthorId) {
      return candidate;
    }

    // Mark a small deterministic subset as subscription-only.
    if (index % 11 === 0) {
      return {
        ...candidate,
        subscriptionAuthorId: candidate.authorId,
      };
    }

    return candidate;
  });
}

function hydrateGizmoduck(candidates: TweetCandidate[]): TweetCandidate[] {
  return candidates.map((candidate) => ({
    ...candidate,
    authorFollowers: Math.max(candidate.authorFollowers, 0),
    authorVerified: Boolean(candidate.authorVerified),
  }));
}

function hydrateBlockedBy(candidates: TweetCandidate[], context: FilterContext): TweetCandidate[] {
  return candidates.map((candidate) => ({
    ...candidate,
    authorBlocksViewer: candidate.authorBlocksViewer || false,
    viewerBlocksQuotedAuthor:
      candidate.viewerBlocksQuotedAuthor ||
      Boolean(candidate.quotedAuthorId && context.blockedUsers.includes(candidate.quotedAuthorId)),
    viewerBlocksRetweetedAuthor:
      candidate.viewerBlocksRetweetedAuthor ||
      Boolean(candidate.retweetedAuthorId && context.blockedUsers.includes(candidate.retweetedAuthorId)),
  }));
}

function hydrateFilteredTopics(candidates: TweetCandidate[]): TweetCandidate[] {
  return candidates.map((candidate, index) => ({
    ...candidate,
    filteredTopicIds: candidate.filteredTopicIds?.length ? candidate.filteredTopicIds : [1000 + (index % 8)],
    unfilteredTopicIds: candidate.unfilteredTopicIds?.length ? candidate.unfilteredTopicIds : [1000 + (index % 12)],
  }));
}

function hydrateLanguageCode(candidates: TweetCandidate[]): TweetCandidate[] {
  return candidates.map((candidate) => ({
    ...candidate,
    languageCode: candidate.languageCode || 'en',
  }));
}

function hydrateVisibility(candidates: TweetCandidate[]): TweetCandidate[] {
  const blockedTerms = ['gore', 'violence', 'graphic', 'explicit scam'];

  return candidates.map((candidate) => {
    const content = candidate.content.toLowerCase();
    const flaggedByText = blockedTerms.some((term) => content.includes(term));

    return {
      ...candidate,
      visibilityFiltered: candidate.visibilityFiltered || flaggedByText,
    };
  });
}

function hydrateAdsBrandSafety(candidates: TweetCandidate[]): TweetCandidate[] {
  return candidates.map((candidate) => ({
    ...candidate,
    brandSafetyRisk: candidate.brandSafetyRisk || (candidate.visibilityFiltered ? 'high' : 'low'),
  }));
}

function hydrateAdsBrandSafetyVf(candidates: TweetCandidate[]): TweetCandidate[] {
  return candidates.map((candidate) => ({
    ...candidate,
    dropAncillaryPosts: candidate.dropAncillaryPosts || false,
  }));
}

function hydrateTweetTypeMetrics(candidates: TweetCandidate[]): TweetCandidate[] {
  return candidates.map((candidate) => ({
    ...candidate,
    favoriteCount: candidate.favoriteCount ?? Math.round(candidate.phoenixScores.favoriteScore * 10000),
    replyCount: candidate.replyCount ?? Math.round(candidate.phoenixScores.replyScore * 1500),
    repostCount: candidate.repostCount ?? Math.round(candidate.phoenixScores.retweetScore * 2500),
    quoteCount: candidate.quoteCount ?? Math.round(candidate.phoenixScores.quoteScore * 900),
  }));
}

function hydrateFollowingRepliedUsers(candidates: TweetCandidate[], context: FilterContext): TweetCandidate[] {
  return candidates.map((candidate) => {
    if (candidate.followingRepliedUserIds?.length || !candidate.conversationId) {
      return candidate;
    }

    return {
      ...candidate,
      followingRepliedUserIds: context.followedAuthorIds.slice(0, 1),
    };
  });
}

function hydrateMutualFollowJaccard(candidates: TweetCandidate[]): TweetCandidate[] {
  return candidates.map((candidate) => ({
    ...candidate,
    mutualFollowJaccard: candidate.mutualFollowJaccard ?? (candidate.inNetwork ? 0.45 : 0.08),
  }));
}

function sortByFinalScore(candidates: TweetCandidate[]): TweetCandidate[] {
  return [...candidates].sort((a, b) => (b.finalScore || 0) - (a.finalScore || 0));
}

function summarizeScoredPostsSideEffects(
  selectedCandidates: TweetCandidate[],
  nonSelectedCandidates: TweetCandidate[],
  context: FilterContext
): SideEffectResult {
  return {
    sideEffectId: 'scored_posts_side_effects',
    sideEffectName: 'Scored Posts Side Effects',
    actions: [
      {
        name: 'PhoenixExperimentsSideEffect',
        nameZh: 'Phoenix 实验记录',
        count: selectedCandidates.length,
        description: 'Record scored post candidates and experiment metadata',
        descriptionZh: '记录已评分帖子和实验元数据',
      },
      {
        name: 'RerankingKafkaSideEffect',
        nameZh: '重排结果记录',
        count: selectedCandidates.length,
        description: 'Publish reranking candidates for downstream inspection',
        descriptionZh: '发布重排候选，供后续检查使用',
      },
      {
        name: 'RedisPostCandidateCacheSideEffect',
        nameZh: '候选缓存记录',
        count: selectedCandidates.length + nonSelectedCandidates.length,
        description: 'Cache selected and non-selected post candidates',
        descriptionZh: '缓存已选择和未选择的帖子候选',
      },
      {
        name: 'ScoredStatsSideEffect',
        nameZh: '评分统计记录',
        count: selectedCandidates.length,
        description: 'Record scored-post response statistics',
        descriptionZh: '记录帖子排序响应统计',
      },
      {
        name: 'PhoenixRequestCacheSideEffect',
        nameZh: 'Phoenix 请求缓存',
        count: context.isBottomRequest ? 1 : 0,
        description: 'Cache request data for bottom requests when applicable',
        descriptionZh: '在适用时缓存下拉请求数据',
      },
    ],
  };
}

function countFeedItems(feedItems: FeedItem[], type: FeedItem['type']): number {
  return feedItems.filter((item) => item.type === type).length;
}

function summarizeForYouSideEffects(
  feedItems: FeedItem[],
  context: FilterContext
): SideEffectResult {
  const postCount = countFeedItems(feedItems, 'post');
  const adCount = countFeedItems(feedItems, 'ad');
  const moduleCount = feedItems.length - postCount;
  const servedHistoryEntryCount = feedItems.reduce((count, item) => {
    if (item.type === 'post' && item.tweet) {
      return count + Math.max(1, (item.tweet.ancestors || []).length + 1);
    }
    if (item.type === 'push_to_home') {
      return count + 2;
    }
    return count + 1;
  }, 0);

  return {
    sideEffectId: 'for_you_side_effects',
    sideEffectName: 'For You Side Effects',
    actions: [
      {
        name: 'AdsInjectionLoggingSideEffect',
        nameZh: '广告插入记录',
        count: adCount,
        description: 'Record ad insertion and safe-gap placement',
        descriptionZh: '记录广告插入和安全间隔位置',
      },
      {
        name: 'PublishSeenIdsToKafkaSideEffect',
        nameZh: '已看内容发布',
        count: context.seenTweetIds.length + context.bloomSeenTweetIds.length,
        description: 'Publish seen IDs for impression tracking',
        descriptionZh: '发布已看内容 ID，用于曝光跟踪',
      },
      {
        name: 'ServedCandidatesKafkaSideEffect',
        nameZh: '已下发候选记录',
        count: feedItems.length,
        description: 'Record served timeline candidates',
        descriptionZh: '记录已下发的首页流候选',
      },
      {
        name: 'ForYouResponseStatsSideEffect',
        nameZh: 'For You 响应统计',
        count: postCount + adCount + moduleCount,
        description: 'Record response counts for posts, ads, and modules',
        descriptionZh: '记录帖子、广告和模块的响应数量',
      },
      {
        name: 'UpdateServedHistorySideEffect',
        nameZh: '已服务历史更新',
        count: servedHistoryEntryCount,
        description: 'Write feed items into served history',
        descriptionZh: '把首页流元素写入已服务历史',
      },
      {
        name: 'TruncateServedHistorySideEffect',
        nameZh: '已服务历史裁剪',
        count: 1,
        description: 'Keep served history bounded after the response',
        descriptionZh: '响应后控制已服务历史长度',
      },
    ],
  };
}

function createSideEffectStep(
  id: string,
  name: string,
  nameZh: string,
  description: string,
  descriptionZh: string,
  inputCount: number,
  details: SideEffectResult
): PipelineStep {
  const outputCount = details.actions.reduce((total, action) => total + action.count, 0);

  return {
    id,
    name,
    nameZh,
    description,
    descriptionZh,
    type: 'side_effect',
    inputCount,
    outputCount,
    details,
  };
}

// Run the complete ranking pipeline
export function runPipeline(
  rawCandidates: TweetCandidate[],
  context: FilterContext,
  config: PipelineConfig
): PipelineResult {
  const steps: PipelineStep[] = [];
  const initialCount = rawCandidates.length;

  steps.push({
    id: 'candidate_pool',
    name: 'Candidate Pool',
    nameZh: '候选池',
    description: 'Initial raw candidate corpus',
    descriptionZh: '初始原始候选集合',
    type: 'source',
    inputCount: initialCount,
    outputCount: initialCount,
  });

  for (const template of QUERY_HYDRATOR_STEPS) {
    steps.push(createStep(template, initialCount, initialCount));
  }

  const thunderCandidates = sourceThunder(rawCandidates, context);
  const tweetMixerCandidates = sourceTweetMixer(rawCandidates, context);
  const phoenixCandidates = sourcePhoenix(rawCandidates, context);
  const phoenixTopicsCandidates = sourcePhoenixTopics(rawCandidates, context);
  const phoenixMoeCandidates = sourcePhoenixMoe(rawCandidates, context);
  const cachedPostCandidates = sourceCachedPosts(rawCandidates, context);
  let candidates = dedupeById([
    ...thunderCandidates,
    ...tweetMixerCandidates,
    ...phoenixCandidates,
    ...phoenixTopicsCandidates,
    ...phoenixMoeCandidates,
    ...cachedPostCandidates,
  ]);

  steps.push({
    id: 'source_thunder',
    name: 'ThunderSource',
    nameZh: 'Thunder 内网源',
    description: 'Retrieve in-network posts',
    descriptionZh: '召回内网（关注网络）内容',
    type: 'source',
    inputCount: initialCount,
    outputCount: thunderCandidates.length,
  });

  steps.push({
    id: 'source_tweet_mixer',
    name: 'TweetMixerSource',
    nameZh: 'TweetMixer 召回源',
    description: 'Retrieve conversational and mixer candidates',
    descriptionZh: '召回对话和混合候选内容',
    type: 'source',
    inputCount: initialCount,
    outputCount: tweetMixerCandidates.length,
  });

  steps.push({
    id: 'source_phoenix',
    name: 'PhoenixSource',
    nameZh: 'Phoenix 外网源',
    description: 'Retrieve out-of-network posts',
    descriptionZh: '召回外网探索内容',
    type: 'source',
    inputCount: initialCount,
    outputCount: phoenixCandidates.length,
  });

  steps.push({
    id: 'source_phoenix_topics',
    name: 'PhoenixTopicsSource',
    nameZh: 'Phoenix 话题召回源',
    description: 'Retrieve candidates tied to requested or inferred topics',
    descriptionZh: '召回匹配请求或推断话题的内容',
    type: 'source',
    inputCount: initialCount,
    outputCount: phoenixTopicsCandidates.length,
  });

  steps.push({
    id: 'source_phoenix_moe',
    name: 'PhoenixMOESource',
    nameZh: 'Phoenix MoE 召回源',
    description: 'Retrieve candidates from Phoenix MoE retrieval',
    descriptionZh: '从 Phoenix MoE 召回候选内容',
    type: 'source',
    inputCount: initialCount,
    outputCount: phoenixMoeCandidates.length,
  });

  steps.push({
    id: 'source_cached_posts',
    name: 'CachedPostsSource',
    nameZh: '缓存内容召回源',
    description: 'Reuse cached post candidates when available',
    descriptionZh: '复用可用的缓存候选内容',
    type: 'source',
    inputCount: initialCount,
    outputCount: cachedPostCandidates.length,
  });

  steps.push({
    id: 'source_merge',
    name: 'Source Merge',
    nameZh: '召回源合并',
    description: 'Merge source outputs and deduplicate IDs',
    descriptionZh: '合并召回结果并按 ID 去重',
    type: 'source',
    inputCount:
      thunderCandidates.length +
      tweetMixerCandidates.length +
      phoenixCandidates.length +
      phoenixTopicsCandidates.length +
      phoenixMoeCandidates.length +
      cachedPostCandidates.length,
    outputCount: candidates.length,
  });

  candidates = hydrateInNetwork(candidates, context);
  steps.push({
    id: 'hydrator_in_network',
    name: 'InNetworkCandidateHydrator',
    nameZh: '内外网标注补全器',
    description: 'Hydrate in-network flag per candidate',
    descriptionZh: '补全候选的内外网标记',
    type: 'hydrator',
    inputCount: candidates.length,
    outputCount: candidates.length,
  });

  candidates = hydrateCoreData(candidates);
  steps.push({
    id: 'hydrator_core_data',
    name: 'CoreDataCandidateHydrator',
    nameZh: '核心数据补全器',
    description: 'Hydrate core tweet metadata',
    descriptionZh: '补全推文核心元数据',
    type: 'hydrator',
    inputCount: candidates.length,
    outputCount: candidates.length,
  });

  candidates = hydrateQuote(candidates);
  steps.push({
    id: 'hydrator_quote',
    name: 'QuoteHydrator',
    nameZh: '引用内容补全器',
    description: 'Hydrate quoted post metadata',
    descriptionZh: '补全引用内容元数据',
    type: 'hydrator',
    inputCount: candidates.length,
    outputCount: candidates.length,
  });

  candidates = hydrateVideoDuration(candidates);
  steps.push({
    id: 'hydrator_video_duration',
    name: 'VideoDurationCandidateHydrator',
    nameZh: '视频时长补全器',
    description: 'Hydrate video duration for VQV gating',
    descriptionZh: '补全视频时长用于 VQV 权重控制',
    type: 'hydrator',
    inputCount: candidates.length,
    outputCount: candidates.length,
  });

  candidates = hydrateHasMedia(candidates);
  steps.push({
    id: 'hydrator_has_media',
    name: 'HasMediaHydrator',
    nameZh: '媒体标记补全器',
    description: 'Hydrate media existence flags',
    descriptionZh: '补全是否包含媒体的标记',
    type: 'hydrator',
    inputCount: candidates.length,
    outputCount: candidates.length,
  });

  candidates = hydrateSubscription(candidates);
  steps.push({
    id: 'hydrator_subscription',
    name: 'SubscriptionHydrator',
    nameZh: '订阅关系补全器',
    description: 'Hydrate subscription-only author metadata',
    descriptionZh: '补全订阅内容作者信息',
    type: 'hydrator',
    inputCount: candidates.length,
    outputCount: candidates.length,
  });

  candidates = hydrateGizmoduck(candidates);
  steps.push({
    id: 'hydrator_gizmoduck',
    name: 'GizmoduckCandidateHydrator',
    nameZh: '作者资料补全器',
    description: 'Hydrate author profile and count metadata',
    descriptionZh: '补全作者资料和计数信息',
    type: 'hydrator',
    inputCount: candidates.length,
    outputCount: candidates.length,
  });

  candidates = hydrateBlockedBy(candidates, context);
  steps.push({
    id: 'hydrator_blocked_by',
    name: 'BlockedByHydrator',
    nameZh: '被作者屏蔽补全器',
    description: 'Hydrate whether the author blocks the viewer',
    descriptionZh: '补全作者是否屏蔽当前用户',
    type: 'hydrator',
    inputCount: candidates.length,
    outputCount: candidates.length,
  });

  candidates = hydrateFilteredTopics(candidates);
  steps.push({
    id: 'hydrator_filtered_topics',
    name: 'FilteredTopicsHydrator',
    nameZh: '话题标记补全器',
    description: 'Hydrate filtered and unfiltered topic IDs',
    descriptionZh: '补全过滤后和未过滤的话题标记',
    type: 'hydrator',
    inputCount: candidates.length,
    outputCount: candidates.length,
  });

  candidates = hydrateLanguageCode(candidates);
  steps.push({
    id: 'hydrator_language_code',
    name: 'LanguageCodeHydrator',
    nameZh: '语言补全器',
    description: 'Hydrate candidate language code',
    descriptionZh: '补全候选内容语言',
    type: 'hydrator',
    inputCount: candidates.length,
    outputCount: candidates.length,
  });

  const { results: preFilterResults, finalCandidates: preFilteredCandidates, filteredCandidates: preFilteredOut } =
    runAllFilters(candidates, context, config.enabledFilters);

  for (const result of preFilterResults) {
    const filter = FILTERS.find((item) => item.id === result.filterId);
    steps.push({
      id: result.filterId,
      name: filter?.name || result.filterName,
      nameZh: filter?.nameZh || result.filterName,
      description: filter?.description || '',
      descriptionZh: filter?.descriptionZh || '',
      type: 'filter',
      inputCount: result.inputCount,
      outputCount: result.outputCount,
      details: result,
    });
  }

  const afterFilterCount = preFilteredCandidates.length;

  const { results: scorerResults, finalCandidates: scoredCandidates } = runAllScorers(
    preFilteredCandidates,
    config.weights,
    context
  );

  for (const result of scorerResults) {
    const scorer = SCORERS.find((item) => item.id === result.scorerId);
    steps.push({
      id: result.scorerId,
      name: scorer?.name || result.scorerName,
      nameZh: scorer?.nameZh || result.scorerName,
      description: scorer?.description || '',
      descriptionZh: scorer?.descriptionZh || '',
      type: 'scorer',
      inputCount: afterFilterCount,
      outputCount: afterFilterCount,
      details: result,
    });
  }

  let selectedCandidates = sortByFinalScore(scoredCandidates).slice(0, config.topK);
  steps.push({
    id: 'selector_top_k',
    name: 'TopKScoreSelector',
    nameZh: 'TopK 选择器',
    description: `Select top ${config.topK} by final score`,
    descriptionZh: `按最终分数选择 Top ${config.topK}`,
    type: 'selector',
    inputCount: scoredCandidates.length,
    outputCount: selectedCandidates.length,
  });

  selectedCandidates = hydrateVisibility(selectedCandidates);
  steps.push({
    id: 'post_hydrator_vf',
    name: 'VFCandidateHydrator',
    nameZh: '可见性补全器',
    description: 'Hydrate visibility filtering hints after selection',
    descriptionZh: '选择后补全可见性过滤信号',
    type: 'hydrator',
    inputCount: selectedCandidates.length,
    outputCount: selectedCandidates.length,
  });

  selectedCandidates = hydrateAdsBrandSafety(selectedCandidates);
  steps.push({
    id: 'post_hydrator_ads_brand_safety',
    name: 'AdsBrandSafetyHydrator',
    nameZh: '广告品牌安全补全器',
    description: 'Hydrate brand-safety signals used by feed blending',
    descriptionZh: '补全信息流混排使用的品牌安全信号',
    type: 'hydrator',
    inputCount: selectedCandidates.length,
    outputCount: selectedCandidates.length,
  });

  selectedCandidates = hydrateAdsBrandSafetyVf(selectedCandidates);
  steps.push({
    id: 'post_hydrator_ads_brand_safety_vf',
    name: 'AdsBrandSafetyVfHydrator',
    nameZh: '广告品牌安全可见性补全器',
    description: 'Hydrate brand-safety visibility decisions',
    descriptionZh: '补全品牌安全可见性判断',
    type: 'hydrator',
    inputCount: selectedCandidates.length,
    outputCount: selectedCandidates.length,
  });

  selectedCandidates = hydrateTweetTypeMetrics(selectedCandidates);
  steps.push({
    id: 'post_hydrator_tweet_type_metrics',
    name: 'TweetTypeMetricsHydrator',
    nameZh: '互动计数补全器',
    description: 'Hydrate favorite, reply, repost, and quote counts',
    descriptionZh: '补全点赞、回复、转发和引用计数',
    type: 'hydrator',
    inputCount: selectedCandidates.length,
    outputCount: selectedCandidates.length,
  });

  selectedCandidates = hydrateFollowingRepliedUsers(selectedCandidates, context);
  steps.push({
    id: 'post_hydrator_following_replied_users',
    name: 'FollowingRepliedUsersHydrator',
    nameZh: '关注用户回复补全器',
    description: 'Hydrate followed users who replied in the conversation',
    descriptionZh: '补全对话中已关注用户的回复信息',
    type: 'hydrator',
    inputCount: selectedCandidates.length,
    outputCount: selectedCandidates.length,
  });

  selectedCandidates = hydrateMutualFollowJaccard(selectedCandidates);
  steps.push({
    id: 'post_hydrator_mutual_follow_jaccard',
    name: 'MutualFollowJaccardHydrator',
    nameZh: '共同关注相似度补全器',
    description: 'Hydrate mutual-follow similarity used by reranking',
    descriptionZh: '补全重排使用的共同关注相似度',
    type: 'hydrator',
    inputCount: selectedCandidates.length,
    outputCount: selectedCandidates.length,
  });

  const {
    results: postFilterResults,
    finalCandidates: postFilteredCandidates,
    filteredCandidates: postFilteredOut,
  } = runPostSelectionFilters(selectedCandidates, context, config.enabledFilters);

  for (const result of postFilterResults) {
    const filter = FILTERS.find((item) => item.id === result.filterId);
    steps.push({
      id: result.filterId,
      name: filter?.name || result.filterName,
      nameZh: filter?.nameZh || result.filterName,
      description: filter?.description || '',
      descriptionZh: filter?.descriptionZh || '',
      type: 'filter',
      inputCount: result.inputCount,
      outputCount: result.outputCount,
      details: result,
    });
  }

  const finalCandidates = sortByFinalScore(postFilteredCandidates);
  const scoredSideEffects = summarizeScoredPostsSideEffects(
    finalCandidates,
    scoredCandidates.filter(
      (candidate) => !selectedCandidates.some((selected) => selected.id === candidate.id)
    ),
    context
  );
  steps.push(createSideEffectStep(
    'scored_posts_side_effects',
    'Scored Posts Side Effects',
    '帖子排序副作用',
    'Record scored-post cache, stats, and reranking outputs',
    '记录帖子排序的缓存、统计和重排输出',
    finalCandidates.length,
    scoredSideEffects
  ));

  const feedBlendResult = buildForYouFeed(finalCandidates, context, config.topK);
  steps.push({
    id: 'for_you_blender',
    name: 'BlenderSelector',
    nameZh: '最终混排选择器',
    description: 'Blend scored posts with safe-gap ads, prompts, who-to-follow, and push-to-home modules',
    descriptionZh: '将已排序帖子与安全间隔广告、提示、推荐关注、置顶回流模块混排',
    type: 'blender',
    inputCount: finalCandidates.length,
    outputCount: feedBlendResult.feedItems.length,
    details: feedBlendResult,
  });

  const forYouSideEffects = summarizeForYouSideEffects(feedBlendResult.feedItems, context);
  steps.push(createSideEffectStep(
    'for_you_side_effects',
    'For You Side Effects',
    'For You 副作用',
    'Record impressions, served history, and response stats after blending',
    '混排后记录曝光、已服务历史和响应统计',
    feedBlendResult.feedItems.length,
    forYouSideEffects
  ));

  steps.push({
    id: 'final_ranking',
    name: 'Final Timeline',
    nameZh: '最终首页流',
    description: 'Final timeline after post ranking and For You blending',
    descriptionZh: '帖子排序和 For You 混排后的最终首页流',
    type: 'ranker',
    inputCount: feedBlendResult.feedItems.length,
    outputCount: feedBlendResult.feedItems.length,
    details: feedBlendResult,
  });

  const allCandidates = [
    ...finalCandidates,
    ...postFilteredOut,
    ...preFilteredOut,
    ...scoredCandidates.filter(
      (candidate) => !selectedCandidates.some((selected) => selected.id === candidate.id)
    ),
  ];

  return {
    steps,
    initialCount,
    afterFilterCount,
    finalCount: feedBlendResult.feedItems.length,
    finalCandidates,
    finalFeedItems: feedBlendResult.feedItems,
    allCandidates,
  };
}

// Run pipeline step by step for animation
export function* runPipelineStepByStep(
  rawCandidates: TweetCandidate[],
  context: FilterContext,
  config: PipelineConfig
): Generator<{ step: PipelineStep; candidates: TweetCandidate[]; feedItems?: FeedItem[] }> {
  let currentCandidates = [...rawCandidates];
  const initialCount = currentCandidates.length;

  yield {
    step: {
      id: 'candidate_pool',
      name: 'Candidate Pool',
      nameZh: '候选池',
      description: 'Initial raw candidate corpus',
      descriptionZh: '初始原始候选集合',
      type: 'source',
      inputCount: currentCandidates.length,
      outputCount: currentCandidates.length,
    },
    candidates: currentCandidates,
  };

  for (const template of QUERY_HYDRATOR_STEPS) {
    yield {
      step: createStep(template, initialCount, initialCount),
      candidates: currentCandidates,
    };
  }

  const thunderCandidates = sourceThunder(currentCandidates, context);
  yield {
    step: {
      id: 'source_thunder',
      name: 'ThunderSource',
      nameZh: 'Thunder 内网源',
      description: 'Retrieve in-network posts',
      descriptionZh: '召回内网（关注网络）内容',
      type: 'source',
      inputCount: currentCandidates.length,
      outputCount: thunderCandidates.length,
    },
    candidates: thunderCandidates,
  };

  const tweetMixerCandidates = sourceTweetMixer(currentCandidates, context);
  yield {
    step: {
      id: 'source_tweet_mixer',
      name: 'TweetMixerSource',
      nameZh: 'TweetMixer 召回源',
      description: 'Retrieve conversational and mixer candidates',
      descriptionZh: '召回对话和混合候选内容',
      type: 'source',
      inputCount: currentCandidates.length,
      outputCount: tweetMixerCandidates.length,
    },
    candidates: tweetMixerCandidates,
  };

  const phoenixCandidates = sourcePhoenix(currentCandidates, context);
  yield {
    step: {
      id: 'source_phoenix',
      name: 'PhoenixSource',
      nameZh: 'Phoenix 外网源',
      description: 'Retrieve out-of-network posts',
      descriptionZh: '召回外网探索内容',
      type: 'source',
      inputCount: currentCandidates.length,
      outputCount: phoenixCandidates.length,
    },
    candidates: phoenixCandidates,
  };

  const phoenixTopicsCandidates = sourcePhoenixTopics(currentCandidates, context);
  yield {
    step: {
      id: 'source_phoenix_topics',
      name: 'PhoenixTopicsSource',
      nameZh: 'Phoenix 话题召回源',
      description: 'Retrieve candidates tied to requested or inferred topics',
      descriptionZh: '召回匹配请求或推断话题的内容',
      type: 'source',
      inputCount: currentCandidates.length,
      outputCount: phoenixTopicsCandidates.length,
    },
    candidates: phoenixTopicsCandidates,
  };

  const phoenixMoeCandidates = sourcePhoenixMoe(currentCandidates, context);
  yield {
    step: {
      id: 'source_phoenix_moe',
      name: 'PhoenixMOESource',
      nameZh: 'Phoenix MoE 召回源',
      description: 'Retrieve candidates from Phoenix MoE retrieval',
      descriptionZh: '从 Phoenix MoE 召回候选内容',
      type: 'source',
      inputCount: currentCandidates.length,
      outputCount: phoenixMoeCandidates.length,
    },
    candidates: phoenixMoeCandidates,
  };

  const cachedPostCandidates = sourceCachedPosts(currentCandidates, context);
  yield {
    step: {
      id: 'source_cached_posts',
      name: 'CachedPostsSource',
      nameZh: '缓存内容召回源',
      description: 'Reuse cached post candidates when available',
      descriptionZh: '复用可用的缓存候选内容',
      type: 'source',
      inputCount: currentCandidates.length,
      outputCount: cachedPostCandidates.length,
    },
    candidates: cachedPostCandidates,
  };

  currentCandidates = dedupeById([
    ...thunderCandidates,
    ...tweetMixerCandidates,
    ...phoenixCandidates,
    ...phoenixTopicsCandidates,
    ...phoenixMoeCandidates,
    ...cachedPostCandidates,
  ]);
  yield {
    step: {
      id: 'source_merge',
      name: 'Source Merge',
      nameZh: '召回源合并',
      description: 'Merge source outputs and deduplicate IDs',
      descriptionZh: '合并召回结果并按 ID 去重',
      type: 'source',
      inputCount:
        thunderCandidates.length +
        tweetMixerCandidates.length +
        phoenixCandidates.length +
        phoenixTopicsCandidates.length +
        phoenixMoeCandidates.length +
        cachedPostCandidates.length,
      outputCount: currentCandidates.length,
    },
    candidates: currentCandidates,
  };

  currentCandidates = hydrateInNetwork(currentCandidates, context);
  yield {
    step: {
      id: 'hydrator_in_network',
      name: 'InNetworkCandidateHydrator',
      nameZh: '内外网标注补全器',
      description: 'Hydrate in-network flag per candidate',
      descriptionZh: '补全候选的内外网标记',
      type: 'hydrator',
      inputCount: currentCandidates.length,
      outputCount: currentCandidates.length,
    },
    candidates: currentCandidates,
  };

  currentCandidates = hydrateCoreData(currentCandidates);
  yield {
    step: {
      id: 'hydrator_core_data',
      name: 'CoreDataCandidateHydrator',
      nameZh: '核心数据补全器',
      description: 'Hydrate core tweet metadata',
      descriptionZh: '补全推文核心元数据',
      type: 'hydrator',
      inputCount: currentCandidates.length,
      outputCount: currentCandidates.length,
    },
    candidates: currentCandidates,
  };

  const preFilterHydrators: Array<{
    template: StepTemplate;
    run: (candidates: TweetCandidate[]) => TweetCandidate[];
  }> = [
    {
      template: {
        id: 'hydrator_quote',
        name: 'QuoteHydrator',
        nameZh: '引用内容补全器',
        description: 'Hydrate quoted post metadata',
        descriptionZh: '补全引用内容元数据',
        type: 'hydrator',
      },
      run: hydrateQuote,
    },
    {
      template: {
      id: 'hydrator_video_duration',
      name: 'VideoDurationCandidateHydrator',
      nameZh: '视频时长补全器',
      description: 'Hydrate video duration for VQV gating',
      descriptionZh: '补全视频时长用于 VQV 权重控制',
      type: 'hydrator',
    },
      run: hydrateVideoDuration,
    },
    {
      template: {
        id: 'hydrator_has_media',
        name: 'HasMediaHydrator',
        nameZh: '媒体标记补全器',
        description: 'Hydrate media existence flags',
        descriptionZh: '补全是否包含媒体的标记',
        type: 'hydrator',
      },
      run: hydrateHasMedia,
    },
    {
      template: {
      id: 'hydrator_subscription',
      name: 'SubscriptionHydrator',
      nameZh: '订阅关系补全器',
      description: 'Hydrate subscription-only author metadata',
      descriptionZh: '补全订阅内容作者信息',
      type: 'hydrator',
    },
      run: hydrateSubscription,
    },
    {
      template: {
        id: 'hydrator_gizmoduck',
        name: 'GizmoduckCandidateHydrator',
        nameZh: '作者资料补全器',
        description: 'Hydrate author profile and count metadata',
        descriptionZh: '补全作者资料和计数信息',
        type: 'hydrator',
      },
      run: hydrateGizmoduck,
    },
    {
      template: {
        id: 'hydrator_blocked_by',
        name: 'BlockedByHydrator',
        nameZh: '被作者屏蔽补全器',
        description: 'Hydrate whether the author blocks the viewer',
        descriptionZh: '补全作者是否屏蔽当前用户',
        type: 'hydrator',
      },
      run: (candidates) => hydrateBlockedBy(candidates, context),
    },
    {
      template: {
        id: 'hydrator_filtered_topics',
        name: 'FilteredTopicsHydrator',
        nameZh: '话题标记补全器',
        description: 'Hydrate filtered and unfiltered topic IDs',
        descriptionZh: '补全过滤后和未过滤的话题标记',
        type: 'hydrator',
      },
      run: hydrateFilteredTopics,
    },
    {
      template: {
        id: 'hydrator_language_code',
        name: 'LanguageCodeHydrator',
        nameZh: '语言补全器',
        description: 'Hydrate candidate language code',
        descriptionZh: '补全候选内容语言',
        type: 'hydrator',
      },
      run: hydrateLanguageCode,
    },
  ];

  for (const hydrator of preFilterHydrators) {
    const inputCount = currentCandidates.length;
    currentCandidates = hydrator.run(currentCandidates);
    yield {
      step: createStep(hydrator.template, inputCount, currentCandidates.length),
      candidates: currentCandidates,
    };
  };

  for (const filter of PRE_SCORING_FILTERS) {
    if (!config.enabledFilters.includes(filter.id)) {
      continue;
    }

    const result = runFilter(filter.id, currentCandidates, context);
    currentCandidates = result.passedCandidates;

    yield {
      step: {
        id: filter.id,
        name: filter.name,
        nameZh: filter.nameZh,
        description: filter.description,
        descriptionZh: filter.descriptionZh,
        type: 'filter',
        inputCount: result.inputCount,
        outputCount: result.outputCount,
        details: result,
      },
      candidates: currentCandidates,
    };
  }

  const phoenixResult = runPhoenixScorer(currentCandidates);
  yield {
    step: {
      id: 'phoenix',
      name: 'Phoenix Scorer Approximation',
      nameZh: 'Phoenix 评分近似模拟',
      description: 'Uses local behavior predictions in place of the Phoenix model runtime',
      descriptionZh: '用本地行为预测近似替代 Phoenix 模型运行结果',
      type: 'scorer',
      inputCount: currentCandidates.length,
      outputCount: currentCandidates.length,
      details: phoenixResult,
    },
    candidates: currentCandidates,
  };

  const { result: rankingResult, updatedCandidates: rankingCandidates } = runRankingScorer(
    currentCandidates,
    config.weights,
    context
  );
  currentCandidates = rankingCandidates;

  yield {
    step: {
      id: 'ranking',
      name: 'RankingScorer',
      nameZh: '排序评分器',
      description: 'Combines weights, author diversity, and OON balance',
      descriptionZh: '融合权重、作者多样性和关注外平衡',
      type: 'scorer',
      inputCount: currentCandidates.length,
      outputCount: currentCandidates.length,
      details: rankingResult,
    },
    candidates: currentCandidates,
  };

  if (config.weights.enableVMRanker && config.weights.vmRankerBlendFactor > 0) {
    const { result: vmResult, updatedCandidates: vmCandidates } = runVMRanker(
      currentCandidates,
      config.weights
    );
    currentCandidates = vmCandidates;

    yield {
      step: {
        id: 'vm_ranker',
        name: 'VMRanker Approximation',
        nameZh: 'VM 重排近似模拟',
        description: 'Show where optional VMRanker reranking occurs with a local approximation',
        descriptionZh: '用本地近似规则展示可选 VMRanker 重排所处位置',
        type: 'scorer',
        inputCount: currentCandidates.length,
        outputCount: currentCandidates.length,
        details: vmResult,
      },
      candidates: currentCandidates,
    };
  }

  let selectedCandidates = sortByFinalScore(currentCandidates).slice(0, config.topK);
  yield {
    step: {
      id: 'selector_top_k',
      name: 'TopKScoreSelector',
      nameZh: 'TopK 选择器',
      description: `Select top ${config.topK} by final score`,
      descriptionZh: `按最终分数选择 Top ${config.topK}`,
      type: 'selector',
      inputCount: currentCandidates.length,
      outputCount: selectedCandidates.length,
    },
    candidates: selectedCandidates,
  };

  currentCandidates = selectedCandidates;

  const postSelectionHydrators: Array<{
    template: StepTemplate;
    run: (candidates: TweetCandidate[]) => TweetCandidate[];
  }> = [
    {
      template: {
        id: 'post_hydrator_vf',
        name: 'VFCandidateHydrator',
        nameZh: '可见性补全器',
        description: 'Hydrate visibility filtering hints after selection',
        descriptionZh: '选择后补全可见性过滤信号',
        type: 'hydrator',
      },
      run: hydrateVisibility,
    },
    {
      template: {
        id: 'post_hydrator_ads_brand_safety',
        name: 'AdsBrandSafetyHydrator',
        nameZh: '广告品牌安全补全器',
        description: 'Hydrate brand-safety signals used by feed blending',
        descriptionZh: '补全信息流混排使用的品牌安全信号',
        type: 'hydrator',
      },
      run: hydrateAdsBrandSafety,
    },
    {
      template: {
        id: 'post_hydrator_ads_brand_safety_vf',
        name: 'AdsBrandSafetyVfHydrator',
        nameZh: '广告品牌安全可见性补全器',
        description: 'Hydrate brand-safety visibility decisions',
        descriptionZh: '补全品牌安全可见性判断',
        type: 'hydrator',
      },
      run: hydrateAdsBrandSafetyVf,
    },
    {
      template: {
        id: 'post_hydrator_tweet_type_metrics',
        name: 'TweetTypeMetricsHydrator',
        nameZh: '互动计数补全器',
        description: 'Hydrate favorite, reply, repost, and quote counts',
        descriptionZh: '补全点赞、回复、转发和引用计数',
        type: 'hydrator',
      },
      run: hydrateTweetTypeMetrics,
    },
    {
      template: {
        id: 'post_hydrator_following_replied_users',
        name: 'FollowingRepliedUsersHydrator',
        nameZh: '关注用户回复补全器',
        description: 'Hydrate followed users who replied in the conversation',
        descriptionZh: '补全对话中已关注用户的回复信息',
        type: 'hydrator',
      },
      run: (candidates) => hydrateFollowingRepliedUsers(candidates, context),
    },
    {
      template: {
        id: 'post_hydrator_mutual_follow_jaccard',
        name: 'MutualFollowJaccardHydrator',
        nameZh: '共同关注相似度补全器',
        description: 'Hydrate mutual-follow similarity used by reranking',
        descriptionZh: '补全重排使用的共同关注相似度',
        type: 'hydrator',
      },
      run: hydrateMutualFollowJaccard,
    },
  ];

  for (const hydrator of postSelectionHydrators) {
    const inputCount = currentCandidates.length;
    currentCandidates = hydrator.run(currentCandidates);
    selectedCandidates = currentCandidates;
    yield {
      step: createStep(hydrator.template, inputCount, currentCandidates.length),
      candidates: currentCandidates,
    };
  }

  for (const filter of POST_SELECTION_FILTERS) {
    if (!config.enabledFilters.includes(filter.id)) {
      continue;
    }

    const result = runFilter(filter.id, currentCandidates, context);
    currentCandidates = result.passedCandidates;

    yield {
      step: {
        id: filter.id,
        name: filter.name,
        nameZh: filter.nameZh,
        description: filter.description,
        descriptionZh: filter.descriptionZh,
        type: 'filter',
        inputCount: result.inputCount,
        outputCount: result.outputCount,
        details: result,
      },
      candidates: currentCandidates,
    };
  }

  currentCandidates = sortByFinalScore(currentCandidates);
  const scoredSideEffects = summarizeScoredPostsSideEffects(
    currentCandidates,
    [],
    context
  );
  yield {
    step: createSideEffectStep(
      'scored_posts_side_effects',
      'Scored Posts Side Effects',
      '帖子排序副作用',
      'Record scored-post cache, stats, and reranking outputs',
      '记录帖子排序的缓存、统计和重排输出',
      currentCandidates.length,
      scoredSideEffects
    ),
    candidates: currentCandidates,
  };

  const feedBlendResult = buildForYouFeed(currentCandidates, context, config.topK);

  yield {
    step: {
      id: 'for_you_blender',
      name: 'BlenderSelector',
      nameZh: '最终混排选择器',
      description: 'Blend scored posts with safe-gap ads, prompts, who-to-follow, and push-to-home modules',
      descriptionZh: '将已排序帖子与安全间隔广告、提示、推荐关注、置顶回流模块混排',
      type: 'blender',
      inputCount: currentCandidates.length,
      outputCount: feedBlendResult.feedItems.length,
      details: feedBlendResult,
    },
    candidates: currentCandidates,
    feedItems: feedBlendResult.feedItems,
  };

  const forYouSideEffects = summarizeForYouSideEffects(feedBlendResult.feedItems, context);
  yield {
    step: createSideEffectStep(
      'for_you_side_effects',
      'For You Side Effects',
      'For You 副作用',
      'Record impressions, served history, and response stats after blending',
      '混排后记录曝光、已服务历史和响应统计',
      feedBlendResult.feedItems.length,
      forYouSideEffects
    ),
    candidates: currentCandidates,
    feedItems: feedBlendResult.feedItems,
  };

  yield {
    step: {
      id: 'final_ranking',
      name: 'Final Timeline',
      nameZh: '最终首页流',
      description: 'Final timeline after post ranking and For You blending',
      descriptionZh: '帖子排序和 For You 混排后的最终首页流',
      type: 'ranker',
      inputCount: feedBlendResult.feedItems.length,
      outputCount: feedBlendResult.feedItems.length,
      details: feedBlendResult,
    },
    candidates: currentCandidates,
    feedItems: feedBlendResult.feedItems,
  };
}
