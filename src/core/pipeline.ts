import type {
  FeedItem,
  FilterContext,
  FilterResult,
  PipelineStep,
  SideEffectResult,
  TweetCandidate,
  WeightConfig,
} from './types';
import { FILTERS, POST_SELECTION_FILTERS, PRE_SCORING_FILTERS, runFilter } from './filters';
import { buildForYouFeed, hydrateBrandSafety } from './feed';
import { runPhoenixScorer, runRankingScorer, runVMRanker } from './scorers';
import { createTweetTypeMetrics } from './tweetTypeMetrics';
import { hydrateVisibility } from './visibility';
import {
  BLENDING_DEFAULTS,
  CACHED_POSTS_MIN_COUNT,
  HYDRATOR_DEFAULTS,
  SOURCE_DEFAULTS,
} from '@/data/upstreamSnapshot';

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

export interface PipelineFrame {
  step: PipelineStep;
  candidates: TweetCandidate[];
  feedItems?: FeedItem[];
}

type StepTemplate = Pick<
  PipelineStep,
  'id' | 'name' | 'nameZh' | 'description' | 'descriptionZh' | 'type'
>;

const QUERY_HYDRATOR_NAMES = [
  'ScoringSequenceQueryHydrator',
  'RetrievalSequenceQueryHydrator',
  'BlockedUserIdsQueryHydrator',
  'MutedUserIdsQueryHydrator',
  'FollowedUserIdsQueryHydrator',
  'SubscribedUserIdsQueryHydrator',
  'CachedPostsQueryHydrator',
  'MutualFollowQueryHydrator',
  'UserDemographicsQueryHydrator',
  'FollowedGrokTopicsQueryHydrator',
  'FollowedStarterPacksQueryHydrator',
  'UserInstalledAppsQueryHydrator',
  'ExplicitEngagementSignalsQueryHydrator',
  'ImplicitEngagementSignalsQueryHydrator',
  'ImpressionBloomFilterQueryHydrator',
  'IpQueryHydrator',
  'UserInferredGenderQueryHydrator',
] as const;

const CANDIDATE_HYDRATORS = [
  'InNetworkCandidateHydrator',
  'BidirectionalFollowHydrator',
  'CoreDataCandidateHydrator',
  'QuoteHydrator',
  'MediaInfoHydrator',
  'SubscriptionHydrator',
  'GizmoduckCandidateHydrator',
  'BlockedByHydrator',
  'FilteredTopicsHydrator',
  'LanguageCodeHydrator',
  'EngagementCountsHydrator',
  'SemanticIdHydrator',
] as const;

const POST_SELECTION_HYDRATORS = [
  'VFCandidateHydrator',
  'AdsBrandSafetyVfHydrator',
  'TweetTypeMetricsHydrator',
  'FollowingRepliedUsersHydrator',
  'MutualFollowJaccardHydrator',
  'TopicFeedbackContextHydrator',
] as const;

const SCORED_POSTS_SIDE_EFFECTS = [
  'PhoenixExperimentsSideEffect',
  'RerankingKafkaSideEffect',
  'RedisPostCandidateCacheSideEffect',
  'ScoredStatsSideEffect',
  'AuthorServedMetricsSideEffect',
  'MutualFollowStatsSideEffect',
  'DebugSideEffect',
  'PhoenixRequestCacheSideEffect',
] as const;

const FOR_YOU_SIDE_EFFECTS = [
  'AdsInjectionLoggingSideEffect',
  'ServedAdHistoryCacheSideEffect',
  'PublishSeenIdsToKafkaSideEffect',
  'ServedCandidatesKafkaSideEffect',
  'ClientEventsKafkaSideEffect',
  'ResponseStatsSideEffect',
  'UpdatePastRequestTimestampsSideEffect',
  'UpdateServedHistorySideEffect',
  'TruncateServedHistorySideEffect',
] as const;

function slug(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/QueryHydrator$|CandidateHydrator$|Hydrator$|SideEffect$/g, '')
    .toLowerCase();
}

function template(
  id: string,
  name: string,
  nameZh: string,
  type: PipelineStep['type'],
  description?: string,
  descriptionZh?: string
): StepTemplate {
  return {
    id,
    name,
    nameZh,
    type,
    description: description || name,
    descriptionZh: descriptionZh || nameZh,
  };
}

function step(
  item: StepTemplate,
  inputCount: number,
  outputCount: number,
  details?: PipelineStep['details']
): PipelineStep {
  return { ...item, inputCount, outputCount, details };
}

function resetForSource(
  candidate: TweetCandidate,
  sourceType: TweetCandidate['sourceType'],
  servedType: TweetCandidate['servedType']
): TweetCandidate {
  return {
    ...candidate,
    sourceType,
    servedType,
    filtered: false,
    filteredBy: undefined,
    filterReason: undefined,
  };
}

function sourceCandidates(
  raw: TweetCandidate[],
  context: FilterContext
): Array<{ template: StepTemplate; candidates: TweetCandidate[] }> {
  const topicSet = new Set(context.topicIds);
  const isNormalTopicRequest = topicSet.size > 0 && !context.isBulkTopicRequest;
  const hasCachedPosts = context.cachedPostIds.length >= CACHED_POSTS_MIN_COUNT;
  const noRemoteSources = context.inNetworkOnly || hasCachedPosts;

  const thunder = SOURCE_DEFAULTS.thunder.enabled && !hasCachedPosts
    ? raw.filter((candidate) => context.followedAuthorIds.includes(candidate.authorId))
        .slice(0, SOURCE_DEFAULTS.thunder.maxResults)
        .map((candidate) => resetForSource(
          candidate,
          'thunder',
          context.inNetworkOnly ? 'ranked_following' : 'for_you_in_network'
        ))
    : [];
  // These sources are registered upstream but disabled by the pinned defaults. Their retrieval
  // behavior is intentionally not fabricated from the local fixture corpus.
  const tweetMixer: TweetCandidate[] = [];
  const simclusters = SOURCE_DEFAULTS.simclusters.enabled &&
    context.hasPostEngagementSignals &&
    !noRemoteSources
    ? raw.filter((_, index) => index % 3 === 0)
        .slice(0, SOURCE_DEFAULTS.simclusters.maxResults)
        .map((candidate) => resetForSource(candidate, 'simclusters', 'for_you_simclusters'))
    : [];
  const phoenix = SOURCE_DEFAULTS.phoenix.enabled &&
    !noRemoteSources &&
    (!isNormalTopicRequest || context.isBulkTopicRequest)
    ? raw.slice(0, SOURCE_DEFAULTS.phoenix.maxResults)
        .map((candidate) => resetForSource(candidate, 'phoenix', 'for_you_phoenix_retrieval'))
    : [];
  const phoenixTopics = SOURCE_DEFAULTS.phoenixTopics.enabled &&
    !noRemoteSources &&
    isNormalTopicRequest
    ? raw.filter((candidate) =>
        [...(candidate.filteredTopicIds || []), ...(candidate.unfilteredTopicIds || [])]
          .some((topicId) => topicSet.has(topicId))
      ).slice(0, SOURCE_DEFAULTS.phoenixTopics.maxResults)
        .map((candidate) => resetForSource(candidate, 'phoenix_topics', 'for_you_phoenix_retrieval'))
    : [];
  const phoenixMoe: TweetCandidate[] = [];
  const cachedIds = new Set(context.cachedPostIds);
  const cachedPosts = SOURCE_DEFAULTS.cachedPosts.enabled && hasCachedPosts
    ? raw.filter((candidate) => cachedIds.has(candidate.id))
        .slice(0, SOURCE_DEFAULTS.cachedPosts.maxResults)
        .map((candidate) => resetForSource(candidate, 'cached_posts', candidate.servedType))
    : [];

  return [
    { template: template('source_thunder', 'ThunderSource', 'Thunder 来源', 'source'), candidates: thunder },
    { template: template('source_tweet_mixer', 'TweetMixerSource', 'TweetMixer 来源（默认关闭）', 'source'), candidates: tweetMixer },
    { template: template('source_simclusters', 'SimclustersSource', 'Simclusters 来源', 'source'), candidates: simclusters },
    { template: template('source_phoenix', 'PhoenixSource', 'Phoenix 来源', 'source'), candidates: phoenix },
    { template: template('source_phoenix_topics', 'PhoenixTopicsSource', 'Phoenix 话题来源', 'source'), candidates: phoenixTopics },
    { template: template('source_phoenix_moe', 'PhoenixMOESource', 'Phoenix MOE 来源（默认关闭）', 'source'), candidates: phoenixMoe },
    { template: template('source_cached_posts', 'CachedPostsSource', '缓存帖子来源', 'source'), candidates: cachedPosts },
  ];
}

function hydrateCandidateStage(
  name: typeof CANDIDATE_HYDRATORS[number],
  candidates: TweetCandidate[],
  context: FilterContext
): TweetCandidate[] {
  switch (name) {
    case 'InNetworkCandidateHydrator':
      return candidates.map((candidate) => ({
        ...candidate,
        inNetwork: candidate.authorId === context.currentUserId ||
          context.followedAuthorIds.includes(candidate.authorId),
      }));
    case 'BidirectionalFollowHydrator':
      return candidates.map((candidate) => ({
        ...candidate,
        isMutualFollowAuthor: Boolean(
          candidate.authorFollowsViewer && context.followedAuthorIds.includes(candidate.authorId)
        ),
      }));
    default:
      // External service fields are explicit fixture data. Missing values remain missing.
      return candidates;
  }
}

function queryHydratorEnabled(
  name: typeof QUERY_HYDRATOR_NAMES[number],
  context: FilterContext
): boolean {
  switch (name) {
    case 'ScoringSequenceQueryHydrator':
      return HYDRATOR_DEFAULTS.scoringSequence;
    case 'RetrievalSequenceQueryHydrator':
      return HYDRATOR_DEFAULTS.retrievalSequence;
    case 'FollowedUserIdsQueryHydrator':
      return context.followedAuthorIds.length === 0;
    case 'CachedPostsQueryHydrator':
      return SOURCE_DEFAULTS.cachedPosts.enabled;
    case 'MutualFollowQueryHydrator':
      return HYDRATOR_DEFAULTS.mutualFollowJaccard;
    case 'UserDemographicsQueryHydrator':
    case 'FollowedGrokTopicsQueryHydrator':
    case 'FollowedStarterPacksQueryHydrator':
      return HYDRATOR_DEFAULTS.contextFeatures;
    case 'UserInstalledAppsQueryHydrator':
      return HYDRATOR_DEFAULTS.installedApps;
    case 'ExplicitEngagementSignalsQueryHydrator':
      return HYDRATOR_DEFAULTS.explicitEngagementSignals;
    case 'ImplicitEngagementSignalsQueryHydrator':
      return HYDRATOR_DEFAULTS.implicitEngagementSignals;
    case 'ImpressionBloomFilterQueryHydrator':
      return context.bloomSeenTweetIds.length === 0;
    case 'IpQueryHydrator':
      return HYDRATOR_DEFAULTS.ipFeature && Boolean(context.ipAddress?.trim());
    case 'UserInferredGenderQueryHydrator':
      return HYDRATOR_DEFAULTS.inferredGender;
    default:
      return true;
  }
}

function candidateHydratorEnabled(
  name: typeof CANDIDATE_HYDRATORS[number],
  context: FilterContext
): boolean {
  if (name === 'FilteredTopicsHydrator') {
    return context.topicIds.length > 0 || context.excludedTopicIds.length > 0;
  }
  if (context.cachedPostIds.length < CACHED_POSTS_MIN_COUNT) return true;
  return ![
    'InNetworkCandidateHydrator',
    'BidirectionalFollowHydrator',
    'CoreDataCandidateHydrator',
    'QuoteHydrator',
    'MediaInfoHydrator',
    'SubscriptionHydrator',
    'GizmoduckCandidateHydrator',
    'BlockedByHydrator',
    'LanguageCodeHydrator',
    'SemanticIdHydrator',
  ].includes(name);
}

function hydratePostSelectionStage(
  name: typeof POST_SELECTION_HYDRATORS[number],
  candidates: TweetCandidate[],
  context: FilterContext
): TweetCandidate[] {
  switch (name) {
    case 'VFCandidateHydrator':
      return hydrateVisibility(candidates, context);
    case 'AdsBrandSafetyVfHydrator':
      return candidates.map((candidate) => {
        const brandSafety = hydrateBrandSafety(candidate);
        return {
          ...candidate,
          brandSafetyVerdict: brandSafety.verdict,
          safetyLabels: brandSafety.safetyLabels,
          dropAncillaryPosts: Boolean(candidate.dropAncillaryPosts),
        };
      });
    case 'TweetTypeMetricsHydrator':
      return candidates.map((candidate) => ({
        ...candidate,
        tweetTypeMetrics: createTweetTypeMetrics(candidate, context),
      }));
    case 'FollowingRepliedUsersHydrator':
      return candidates.map((candidate) => ({
        ...candidate,
        followingRepliedUserIds: candidate.followingRepliedUserIds || [],
      }));
    case 'MutualFollowJaccardHydrator':
      return candidates.map((candidate) => ({
        ...candidate,
        mutualFollowJaccard: candidate.mutualFollowJaccard ?? 0,
      }));
    case 'TopicFeedbackContextHydrator':
      return candidates.map((candidate) => {
        const matched = candidate.semanticIds?.find((id) => context.engagedSemanticIds.includes(id));
        return matched ? { ...candidate, topicFeedbackTopicId: matched } : candidate;
      });
  }
}

function postSelectionHydratorEnabled(
  name: typeof POST_SELECTION_HYDRATORS[number]
): boolean {
  switch (name) {
    case 'FollowingRepliedUsersHydrator':
      return HYDRATOR_DEFAULTS.followingRepliedUsers;
    case 'MutualFollowJaccardHydrator':
      return HYDRATOR_DEFAULTS.mutualFollowJaccard;
    case 'TopicFeedbackContextHydrator':
      return HYDRATOR_DEFAULTS.topicFeedbackContext;
    default:
      return true;
  }
}

function sortByScore(candidates: TweetCandidate[]): TweetCandidate[] {
  return [...candidates].sort((left, right) => (right.finalScore ?? 0) - (left.finalScore ?? 0));
}

function sideEffects(
  id: string,
  name: string,
  nameZh: string,
  actionNames: readonly string[],
  candidates: TweetCandidate[],
  feedItems?: FeedItem[]
): { step: PipelineStep; details: SideEffectResult } {
  const itemCount = feedItems?.length ?? candidates.length;
  const details: SideEffectResult = {
    sideEffectId: id,
    sideEffectName: name,
    execution: 'registered_only',
    actions: actionNames.map((actionName) => ({
      name: actionName,
      nameZh: actionName,
      status: 'registered_only',
      description: 'Registered checkpoint; external side effect is not executed by the simulator',
      descriptionZh: '已登记检查点；模拟器不执行外部副作用',
    })),
  };
  return {
    details,
    step: step(
      template(
        id,
        name,
        nameZh,
        'side_effect',
        `Model ${actionNames.length} published side-effect checkpoints without external writes`,
        `模拟 ${actionNames.length} 个公开副作用检查点，不执行外部写入`
      ),
      itemCount,
      itemCount,
      details
    ),
  };
}

function filterStep(filterId: string, result: FilterResult): PipelineStep {
  const filter = FILTERS.find((item) => item.id === filterId);
  return step(
    template(
      filterId,
      filter?.name || result.filterName,
      filter?.nameZh || result.filterName,
      'filter',
      filter?.description,
      filter?.descriptionZh
    ),
    result.inputCount,
    result.outputCount,
    result
  );
}

function executePipeline(
  rawCandidates: TweetCandidate[],
  context: FilterContext,
  config: PipelineConfig
): { frames: PipelineFrame[]; result: PipelineResult } {
  const frames: PipelineFrame[] = [];
  const filteredCandidates: TweetCandidate[] = [];
  let candidates = [...rawCandidates];
  const add = (pipelineStep: PipelineStep, snapshot = candidates, items?: FeedItem[]) => {
    frames.push({ step: pipelineStep, candidates: [...snapshot], feedItems: items ? [...items] : undefined });
  };

  add(step(
    template('candidate_pool', 'Candidate Pool', '候选池', 'source', 'Input fixture corpus', '输入测试候选集'),
    candidates.length,
    candidates.length
  ));

  for (const name of QUERY_HYDRATOR_NAMES) {
    const enabled = queryHydratorEnabled(name, context);
    const disabledByDefault = name === 'MutualFollowQueryHydrator';
    const disabledDescription = disabledByDefault
      ? `${name} (disabled by published default)`
      : `${name} (disabled for this request)`;
    const disabledDescriptionZh = disabledByDefault
      ? `${name}（公开默认关闭）`
      : `${name}（当前请求未启用）`;
    add(step(
      template(
        `query_hydrator_${slug(name)}`,
        name,
        name,
        'query_hydrator',
        enabled ? name : disabledDescription,
        enabled ? name : disabledDescriptionZh
      ),
      candidates.length,
      candidates.length
    ));
  }

  const sources = sourceCandidates(rawCandidates, context);
  for (const source of sources) {
    add(step(source.template, rawCandidates.length, source.candidates.length), source.candidates);
  }
  candidates = sources.flatMap((source) => source.candidates);
  add(step(
    template('source_merge', 'Candidate source merge', '候选来源合并', 'source'),
    candidates.length,
    candidates.length
  ));

  for (const name of CANDIDATE_HYDRATORS) {
    const inputCount = candidates.length;
    const enabled = candidateHydratorEnabled(name, context);
    if (enabled) candidates = hydrateCandidateStage(name, candidates, context);
    add(step(
      template(
        `hydrator_${slug(name)}`,
        name,
        name,
        'hydrator',
        enabled ? name : `${name} (disabled for this request)`,
        enabled ? name : `${name}（当前请求未启用）`
      ),
      inputCount,
      candidates.length
    ));
  }

  for (const filter of PRE_SCORING_FILTERS) {
    if (!config.enabledFilters.includes(filter.id)) continue;
    const result = runFilter(filter.id, candidates, context);
    candidates = result.passedCandidates;
    filteredCandidates.push(...result.filteredCandidates);
    add(filterStep(filter.id, result));
  }
  const afterFilterCount = candidates.length;

  if (context.cachedPostIds.length < CACHED_POSTS_MIN_COUNT) {
    const phoenix = runPhoenixScorer(candidates);
    add(step(
      template('phoenix', 'PhoenixScorer (synthetic outputs)', 'Phoenix 评分器（模拟输出）', 'scorer'),
      candidates.length,
      candidates.length,
      phoenix
    ));
  }

  const ranking = runRankingScorer(candidates, config.weights, context);
  candidates = ranking.updatedCandidates;
  add(step(
    template('ranking', 'RankingScorer', '排序评分器', 'scorer'),
    candidates.length,
    candidates.length,
    ranking.result
  ));

  if (config.weights.enableVMRanker) {
    const vmRanker = runVMRanker(candidates, config.weights);
    candidates = vmRanker.updatedCandidates;
    add(step(
      template('vm_ranker', 'VMRanker DPP', 'VMRanker DPP 重排', 'scorer'),
      candidates.length,
      candidates.length,
      vmRanker.result
    ));
  }

  candidates = sortByScore(candidates).slice(0, config.topK);
  add(step(
    template(
      'selector_top_k',
      'TopKScoreSelector',
      'TopK 选择器',
      'selector',
      `Select the top ${config.topK} scored posts`,
      `选择评分最高的 ${config.topK} 个帖子`
    ),
    ranking.updatedCandidates.length,
    candidates.length
  ));

  for (const name of POST_SELECTION_HYDRATORS) {
    const inputCount = candidates.length;
    const enabled = postSelectionHydratorEnabled(name);
    if (enabled) {
      candidates = hydratePostSelectionStage(name, candidates, context);
    }
    add(step(
      template(
        `post_hydrator_${slug(name)}`,
        name,
        name,
        'hydrator',
        enabled ? name : `${name} (disabled by published default)`,
        enabled ? name : `${name}（公开默认关闭）`
      ),
      inputCount,
      candidates.length
    ));
  }

  for (const filter of POST_SELECTION_FILTERS) {
    if (!config.enabledFilters.includes(filter.id)) continue;
    const result = runFilter(filter.id, candidates, context);
    candidates = result.passedCandidates;
    filteredCandidates.push(...result.filteredCandidates);
    add(filterStep(filter.id, result));
  }
  candidates = sortByScore(candidates).slice(0, BLENDING_DEFAULTS.resultSize);

  const scoredEffects = sideEffects(
    'scored_posts_side_effects',
    'Scored Posts Side Effects',
    '帖子排序副作用',
    SCORED_POSTS_SIDE_EFFECTS,
    candidates
  );
  add(scoredEffects.step);

  for (const name of ['ServedHistoryQueryHydrator', 'PastRequestTimestampsQueryHydrator']) {
    add(step(
      template(`for_you_query_hydrator_${slug(name)}`, name, name, 'query_hydrator'),
      candidates.length,
      candidates.length
    ));
  }

  const forYouSources: Array<[string, string, number]> = [
    ['ScoredPostsSource', '帖子排序来源', candidates.length],
    ['AdsSource', '广告来源', BLENDING_DEFAULTS.enableAds ? context.adFixtures.length : 0],
    ['WhoToFollowSource', '推荐关注来源', BLENDING_DEFAULTS.enableWhoToFollow && context.whoToFollowEligible ? 1 : 0],
    ['PromptsSource', '提示来源', BLENDING_DEFAULTS.enablePrompts ? context.promptCount : 0],
    ['PushToHomeSource', '置顶回流来源', context.pushToHomeTweetId ? 1 : 0],
    ['JetfuelFrameSource', 'Jetfuel 框架来源', BLENDING_DEFAULTS.enableJetfuelFrames ? context.jetfuelFrameCount : 0],
    ['FeedSurveySource', '信息流问卷来源', BLENDING_DEFAULTS.enableFeedSurvey && context.feedSurveyEligible ? 1 : 0],
  ];
  for (const [name, nameZh, outputCount] of forYouSources) {
    add(step(
      template(`for_you_source_${slug(name)}`, name, nameZh, 'source'),
      candidates.length,
      outputCount
    ));
  }
  let forYouSourceCount = forYouSources.reduce((total, source) => total + source[2], 0);

  if (context.pushToHomeTweetId) {
    const inputCount = candidates.length;
    const removed = candidates.filter((candidate) =>
      candidate.id === context.pushToHomeTweetId || candidate.originalTweetId === context.pushToHomeTweetId
    );
    candidates = candidates.filter((candidate) => !removed.includes(candidate));
    forYouSourceCount -= removed.length;
    const result: FilterResult = {
      filterId: 'push_to_home_dedup',
      filterName: 'PushToHomeDedupFilter',
      inputCount,
      outputCount: candidates.length,
      filteredCandidates: removed,
      passedCandidates: candidates,
    };
    add(step(
      template('push_to_home_dedup', 'PushToHomeDedupFilter', '置顶回流去重过滤器', 'filter'),
      inputCount,
      candidates.length,
      result
    ));
  }

  const feed = buildForYouFeed(candidates, context);
  const feedItems = feed.feedItems;
  add(step(
    template(
      'for_you_blender',
      'BlenderSelector / PartitionOrganicAdsBlender',
      '最终混排 / PartitionOrganic 广告混排',
      'blender'
    ),
    forYouSourceCount,
    feedItems.length,
    feed
  ), candidates, feedItems);

  if (BLENDING_DEFAULTS.enableAdAdjacentServedFilter) {
    add(step(
      template('ad_adjacent_served', 'AdAdjacentServedFilter', '广告相邻已服务过滤器', 'filter'),
      feedItems.length,
      feedItems.length
    ), candidates, feedItems);
  }

  const forYouEffects = sideEffects(
    'for_you_side_effects',
    'For You Side Effects',
    'For You 副作用',
    FOR_YOU_SIDE_EFFECTS,
    candidates,
    feedItems
  );
  add(forYouEffects.step, candidates, feedItems);

  add(step(
    template('final_ranking', 'Final For You Timeline', '最终 For You 首页流', 'ranker'),
    feedItems.length,
    feedItems.length,
    feed
  ), candidates, feedItems);

  const result: PipelineResult = {
    steps: frames.map((frame) => frame.step),
    initialCount: rawCandidates.length,
    afterFilterCount,
    finalCount: feedItems.length,
    finalCandidates: candidates,
    finalFeedItems: feedItems,
    allCandidates: [...candidates, ...filteredCandidates],
  };
  return { frames, result };
}

export function runPipeline(
  rawCandidates: TweetCandidate[],
  context: FilterContext,
  config: PipelineConfig
): PipelineResult {
  return executePipeline(rawCandidates, context, config).result;
}

export function* runPipelineStepByStep(
  rawCandidates: TweetCandidate[],
  context: FilterContext,
  config: PipelineConfig
): Generator<PipelineFrame> {
  yield* executePipeline(rawCandidates, context, config).frames;
}
