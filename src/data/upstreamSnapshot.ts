import type { WeightConfig } from '@/core/types';

/**
 * Published primary defaults from xai-org/x-algorithm at the pinned commit.
 * Experiments may override these values in production.
 */
export const UPSTREAM_SNAPSHOT = {
  repository: 'https://github.com/xai-org/x-algorithm',
  commit: 'c65aa179db7bdd61e2c2821eac87f208a105c053',
  shortCommit: 'c65aa17',
  releasedAt: '2026-08-14',
  paramsSyncedAt: '2026-08-12T04:09:22Z',
} as const;

export const SOURCE_DEFAULTS = {
  thunder: { enabled: true, maxResults: 1200 },
  tweetMixer: { enabled: false, maxResults: 800 },
  simclusters: { enabled: true, maxResults: 800 },
  phoenix: { enabled: true, maxResults: 1000 },
  phoenixTopics: { enabled: true, maxResults: 1000 },
  phoenixMoe: { enabled: false, maxResults: 200 },
  cachedPosts: { enabled: true, maxResults: 750 },
} as const;

/** CachedPostsQueryHydrator only switches to the cached path at this size. */
export const CACHED_POSTS_MIN_COUNT = 500;

export const HYDRATOR_DEFAULTS = {
  scoringSequence: true,
  retrievalSequence: true,
  contextFeatures: true,
  ipFeature: true,
  installedApps: true,
  explicitEngagementSignals: true,
  implicitEngagementSignals: true,
  inferredGender: true,
  bidirectionalFollow: true,
  allAuthorFollow: true,
  engagementCounts: true,
  semanticIds: true,
  followingRepliedUsers: false,
  mutualFollowJaccard: false,
  topicFeedbackContext: false,
} as const;

export const FILTER_DEFAULTS = {
  maxPostAgeHours: 48,
  enableServedFilterAllRequests: true,
  newUserMinEngagement: {
    enabled: false,
    metric: 'fav' as const,
    useRatio: false,
    threshold: 0,
    maxAccountAgeSecs: 1800,
    maxResurrectionAgeSecs: 1800,
  },
  inventoryHoldout: {
    enabled: false,
    originalsPercent: 0,
    repliesPercent: 0,
    retweetsPercent: 0,
  },
} as const;

export const BLENDING_DEFAULTS = {
  resultSize: 35,
  feedModuleSlots: 4,
  maxJetfuelFramesPerResponse: 8,
  topKPosts: 50,
  whoToFollowPosition: 6,
  promptsPosition: 0,
  feedSurveyPosition: 12,
  enableAds: true,
  adsBlender: 'partition_organic_low_risk',
  enableWhoToFollow: true,
  enablePrompts: true,
  enableJetfuelFrames: false,
  enableFeedSurvey: false,
  enableAdAdjacentServedFilter: false,
} as const;

export const UPSTREAM_DEFAULT_WEIGHTS: WeightConfig = {
  favoriteWeight: 0.5,
  replyWeight: 5,
  bidirectionalFollowReplyWeightBoost: 15,
  bidirectionalFollowDwellWeightBoost: 0,
  retweetWeight: 1,
  photoExpandWeight: 0.05,
  videoOpenWeight: 0.05,
  clickWeight: 0.4,
  openLinkWeight: 0.2,
  profileClickWeight: 0,
  vqvWeight: 0.05,
  shareWeight: 2,
  shareViaDmWeight: 5,
  shareViaCopyLinkWeight: 20,
  dwellWeight: 0,
  quoteWeight: 5,
  quotedClickWeight: 0.05,
  quotedVqvWeight: 0,
  followAuthorWeight: 4,
  postUnexploredWeight: 0.02,

  notInterestedWeight: -43.2,
  blockAuthorWeight: -31.2,
  muteAuthorWeight: -58.8,
  reportWeight: -234,
  notDwelledWeight: -0.02,
  dwellTimeWeight: 0.004,
  clickDwellTimeWeight: 0,
  activeSecs5mResidualNormWeight: 0,

  minVideoDurationMs: 10_000,
  enableQuotedVqvDurationCheck: false,
  negativeScoresOffset: 0.001,
  enableMultiplicativePostUnexplored: false,
  multiplicativePostUnexploredAlpha: 0,
  postUnexploredInNetworkOnly: true,
  enableClickDwellLowFavRatePenalty: false,
  clickDwellLowFavRatePenaltyBaseline: 0.01,
  clickDwellLowFavRatePenaltyAlpha: 0.5,
  clickDwellLowFavRatePenaltyFloor: 0.01,
  clickDwellLowFavRatePenaltyCap: 1,

  enableAuthorDiversity: true,
  authorDiversityDecay: 0.5,
  authorDiversityFloor: 0.25,

  oonWeightFactor: 0.75,
  topicOonWeightFactor: 0.5,
  newUserOonWeightFactor: 0.00001,
  newUserAgeThresholdSecs: 0,
  newUserMinFollowing: 5,
  enableOonRescoreForInNetworkRepliesRetweets: true,

  enableAuthorColdStart: true,
  coldStartImpressionThreshold: 1000,
  coldStartSlotMin: 15,
  coldStartSlotMax: 16,
  coldStartFollowerCap: 1000,
  coldStartMaxPostAgeSecs: 86_400,
  lowImpressionsMaxPositionRatio: 0.85,

  enableVMRanker: true,
  vmRankerTheta: 0.65,
  vmRankerTopK: 50,
  vmRankerMaxSelectedRank: 150,
};

export const RANKING_CONSTANTS = {
  maxViewerFollowersForVqv: 10_000,
  vmRankerEmbeddingDimension: 1_024,
} as const;
