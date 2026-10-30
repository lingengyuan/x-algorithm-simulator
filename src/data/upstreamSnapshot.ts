import type { WeightConfig } from '@/core/types';

/**
 * Published primary defaults from xai-org/x-algorithm at the pinned commit.
 * Experiments may override these values in production.
 */
export const UPSTREAM_SNAPSHOT = {
  repository: 'https://github.com/xai-org/x-algorithm',
  commit: '7fef3ba19d82d1f76dec65f31b981ca817a2ea06',
  shortCommit: '7fef3ba',
  releasedAt: '2026-10-30',
  paramsSyncedAt: '2026-10-28T16:00:35Z',
} as const;

export const SOURCE_DEFAULTS = {
  thunder: { enabled: true, maxResults: 1200 },
  popularPosts: { enabled: true, maxResults: 500 },
  tweetMixer: { enabled: false, maxResults: 800 },
  simclusters: { enabled: true, maxResults: 800 },
  phoenix: { enabled: true, maxResults: 1000 },
  phoenixTopics: { enabled: true, maxResults: 1000 },
  phoenixMoe: { enabled: false, maxResults: 0 },
  sid: { enabled: false, maxResults: 800 },
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
  immersiveScoringSequence: false,
  recentSearchQueries: false,
  postEngagers: false,
  phoenixReplyAncestors: false,
  newUserSoftNsfw: false,
  bidirectionalFollow: true,
  allAuthorFollow: true,
  engagementCounts: true,
  semanticIds: true,
  followingRepliedUsers: false,
  mutualFollowJaccard: false,
  topicFeedbackContext: false,
  aiTrendFeedbackContext: false,
} as const;

export const FILTER_DEFAULTS = {
  maxPostAgeHours: 48,
  enableServedFilterAllRequests: true,
  servedHistory: { durationMinutes: 10, maxItems: 100 },
  fairShareRanking: { enabled: true, budget: 2800 },
  zeroFavCodivert: false,
  favHoldout: false,
  newUserSoftNsfw: false,
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
  feedModuleSlots: 5,
  maxJetfuelFramesPerResponse: 8,
  topKPosts: 50,
  whoToFollowPosition: 6,
  promptsPosition: 0,
  feedSurveyPosition: 12,
  enableAds: true,
  adsBlender: 'multi_risk',
  enableWhoToFollow: true,
  enablePrompts: true,
  enableJetfuelFrames: false,
  enableFeedSurvey: false,
  enableAdAdjacentServedFilter: false,
} as const;

export const ADS_DEFAULTS = {
  enablePageLogging: true,
  brandSafetyVerdictV2: false,
} as const;

export const VIDEO_CAROUSEL_DEFAULTS = {
  enabled: false,
  fatigueMinutes: 60,
  position: 6,
  immersiveVqvWeight: 0,
  openTimesImmersiveDwellWeight: 0,
  weightedScoreWeight: 0,
  extraCandidates: 30,
} as const;

export const UPSTREAM_DEFAULT_WEIGHTS: WeightConfig = {
  favoriteWeight: 0.66,
  replyWeight: 5,
  bidirectionalFollowReplyWeightBoost: 15,
  bidirectionalFollowDwellWeightBoost: 0,
  retweetWeight: 1,
  photoExpandWeight: 0.05,
  videoOpenWeight: 0.02,
  clickWeight: 0.3,
  openLinkWeight: 0.2,
  profileClickWeight: 0,
  vqvWeight: 0,
  shareWeight: 2,
  shareViaDmWeight: 5,
  shareViaCopyLinkWeight: 20,
  dwellWeight: 0.05,
  quoteWeight: 5,
  quotedClickWeight: 0.05,
  quotedVqvWeight: 0,
  followAuthorWeight: 4,
  postUnexploredWeight: 0.015,
  postVideoWeight: 0,

  notInterestedWeight: -52.272,
  blockAuthorWeight: -31.2,
  muteAuthorWeight: -58.8,
  reportWeight: -234,
  notDwelledWeight: -0.02,
  dwellTimeWeight: 0.006,
  clickDwellTimeWeight: 0.4,

  minVideoDurationMs: 10_000,
  enableQuotedVqvDurationCheck: false,
  negativeScoresOffset: 0.001,
  postUnexploredInNetworkOnly: true,

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
  coldStartImpressionThreshold: 200,
  coldStartSlotMin: 15,
  coldStartSlotMax: 16,
  coldStartFollowerCap: 50000,
  coldStartMaxPostAgeSecs: 7200,
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

export const RANKING_DEFAULTS = {
  topicDppEnabled: false,
  pageDecodeRerank: false,
  pageRlExploration: false,
  homeExcursionScores: false,
  videoCarousel: VIDEO_CAROUSEL_DEFAULTS.enabled,
  coldStartThompsonSampling: true,
  coldStartBetaAlpha: 0.75,
  coldStartBetaBeta: 49.25,
  coldStartThompsonTopK: 2,
} as const;
