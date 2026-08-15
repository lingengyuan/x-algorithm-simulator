// Phoenix Scores - behavior predictions plus continuous engagement values.
export interface PhoenixScores {
  // Positive behaviors
  favoriteScore: number;        // Like probability
  replyScore: number;           // Reply probability
  retweetScore: number;         // Retweet probability
  photoExpandScore: number;     // Photo expand probability
  videoOpenScore: number;       // Video open probability
  clickScore: number;           // Click probability
  openLinkScore: number;        // External link open probability
  profileClickScore: number;    // Profile click probability
  vqvScore: number;             // Video quality view score
  shareScore: number;           // Share probability
  shareViaDmScore: number;      // Share via DM probability
  shareViaCopyLinkScore: number;// Copy link probability
  dwellScore: number;           // Dwell time score
  quoteScore: number;           // Quote tweet probability
  quotedClickScore: number;     // Click quoted content probability
  quotedVqvScore: number;       // Video quality view on quoted content
  followAuthorScore: number;    // Follow author probability
  postUnexploredScore: number;  // Probability that the post is under-explored

  // Negative behaviors
  notInterestedScore: number;   // Not interested probability
  blockAuthorScore: number;     // Block author probability
  muteAuthorScore: number;      // Mute author probability
  reportScore: number;          // Report probability
  notDwelledScore: number;      // Not dwelled probability

  // Continuous values
  dwellTime: number;            // Predicted continuous dwell value in seconds
  clickDwellTime: number;       // Predicted continuous click-dwell value in seconds
  activeSecs5mResidualNorm: number;
}

export type VisibilityAction = 'allow' | 'drop' | 'interstitial';

export type CandidateSourceType =
  | 'thunder'
  | 'tweet_mixer'
  | 'simclusters'
  | 'phoenix'
  | 'phoenix_topics'
  | 'phoenix_moe'
  | 'cached_posts';

export type ServedType =
  | 'ranked_following'
  | 'for_you_in_network'
  | 'for_you_tweet_mixer'
  | 'for_you_simclusters'
  | 'for_you_phoenix_retrieval'
  | 'for_you_phoenix_retrieval_moe';

export interface VisibilityFeatures {
  authorState?: 'active' | 'suspended' | 'deactivated' | 'erased' | 'offboarded';
  authorProtected?: boolean;
  authorNsfwUser?: boolean;
  authorNsfwAdmin?: boolean;
  authorSafetyLabels?: string[];
  viewerMutesRetweetsFromAuthor?: boolean;
  nullcasted?: boolean;
  communityTweet?: boolean;
  stale?: boolean;
  hasSourceTweet?: boolean;
  legalTakedownCountries?: string[];
  localLawTakedownCountries?: string[];
  exclusiveContent?: boolean;
  viewerCanSeeExclusiveContent?: boolean;
  dmcaMedia?: boolean;
  geoAllowCountries?: string[];
  geoDenyCountries?: string[];
  tweetNsfwUser?: boolean;
  tweetNsfwAdmin?: boolean;
}

export interface RelatedPostFixture {
  id: string;
  authorId: string;
  hasImage: boolean;
  hasVideo: boolean;
  isRetweet: boolean;
  safetyLabels?: string[];
  nsfwAuthor?: boolean;
  visibilityFeatures?: VisibilityFeatures;
  brandSafetyLookupFailed?: boolean;
}

export interface SlateContext {
  k: number;
  poolRank: number;
  poolRankGap?: number;
  fatigue: number;
  preDiversityScore: number;
}

export type ViewerAge =
  | { status: 'known'; age: number }
  | { status: 'not_stated' }
  | { status: 'unknown' };

export interface AdFixture {
  id: string;
  insertPosition: number;
  brandSafetyRisk: 'unknown' | 'low' | 'ias' | 'high';
  handles: string[];
  keywords: string[];
}

// Tweet input for analysis
export interface TweetInput {
  content: string;
  hasMedia: 'none' | 'image' | 'video';
  videoDurationMs?: number;
  authorType: 'normal' | 'verified' | 'influencer';
  followerCount: number;
}

// Tweet candidate for ranking
export interface TweetCandidate {
  id: string;
  content: string;
  authorId: string;
  authorName: string;
  authorFollowers?: number;
  authorVerified: boolean;
  authorAvatar?: string;

  // Media
  hasImage: boolean;
  hasVideo: boolean;
  videoDurationMs?: number;

  // Metadata
  createdAt: number;  // Snowflake timestamp
  inNetwork?: boolean;
  servedType?: ServedType;
  sourceType?: CandidateSourceType;
  conversationId?: string;
  ancestors?: string[];
  tombstoneAncestorIds?: string[];
  ancestorUserIds?: string[];
  inReplyToTweetId?: string;
  isRetweet: boolean;
  originalTweetId?: string;
  retweetedAuthorId?: string;
  quotedTweetId?: string;
  quotedAuthorId?: string;
  subscriptionAuthorId?: string;
  visibilityAction?: VisibilityAction;
  visibilityReason?: string;
  visibilityDecidedBy?: string;
  dropAncillaryPosts?: boolean;
  authorBlocksViewer?: boolean;
  quotedAuthorBlocksViewer?: boolean;

  // Hydrated candidate features from the 2026 X algorithm release
  filteredTopicIds?: string[];
  unfilteredTopicIds?: string[];
  followingRepliedUserIds?: string[];
  languageCode?: string;
  favoriteCount?: number;
  replyCount?: number;
  repostCount?: number;
  quoteCount?: number;
  viewCount?: number;
  bookmarkCount?: number;
  mutualFollowJaccard?: number;
  isMutualFollowAuthor?: boolean;
  authorFollowsViewer?: boolean;
  nsfwAuthor?: boolean;
  brandSafetyVerdict?: 'unspecified' | 'safe' | 'low_risk' | 'medium_risk';
  safetyLabels?: string[];
  visibilityFeatures?: VisibilityFeatures;
  semanticIds?: string[];
  embedding?: number[];
  topicFeedbackTopic?: string;
  topicFeedbackTopicId?: string;
  quotedVideoDurationMs?: number;
  relatedPosts?: Record<string, RelatedPostFixture>;
  nsfwAuthorAds?: boolean;
  brandSafetyLookupFailed?: boolean;
  tweetTypeMetrics?: number[];

  // Phoenix predicted scores
  phoenixScores: PhoenixScores;

  // Computed scores
  rawWeightedScore?: number;
  weightedScore?: number;
  coldStartAdjustedScore?: number;
  diversityAdjustedScore?: number;
  finalScore?: number;
  coldStartBoosted?: boolean;
  vmRankerSelected?: boolean;
  slateContext?: SlateContext;

  // Filter status
  filtered: boolean;
  filteredBy?: string;
  filterReason?: string;
}

// Weight configuration
export interface WeightConfig {
  // Positive weights
  favoriteWeight: number;
  replyWeight: number;
  bidirectionalFollowReplyWeightBoost: number;
  bidirectionalFollowDwellWeightBoost: number;
  retweetWeight: number;
  photoExpandWeight: number;
  videoOpenWeight: number;
  clickWeight: number;
  openLinkWeight: number;
  profileClickWeight: number;
  vqvWeight: number;
  shareWeight: number;
  shareViaDmWeight: number;
  shareViaCopyLinkWeight: number;
  dwellWeight: number;
  quoteWeight: number;
  quotedClickWeight: number;
  followAuthorWeight: number;
  postUnexploredWeight: number;

  // Negative weights
  notInterestedWeight: number;
  blockAuthorWeight: number;
  muteAuthorWeight: number;
  reportWeight: number;
  quotedVqvWeight: number;
  notDwelledWeight: number;
  dwellTimeWeight: number;
  clickDwellTimeWeight: number;
  activeSecs5mResidualNormWeight: number;

  // Weighted scorer controls
  minVideoDurationMs: number;
  enableQuotedVqvDurationCheck: boolean;
  negativeScoresOffset: number;
  enableMultiplicativePostUnexplored: boolean;
  multiplicativePostUnexploredAlpha: number;
  postUnexploredInNetworkOnly: boolean;
  enableClickDwellLowFavRatePenalty: boolean;
  clickDwellLowFavRatePenaltyBaseline: number;
  clickDwellLowFavRatePenaltyAlpha: number;
  clickDwellLowFavRatePenaltyFloor: number;
  clickDwellLowFavRatePenaltyCap: number;

  // Diversity parameters
  enableAuthorDiversity: boolean;
  authorDiversityDecay: number;
  authorDiversityFloor: number;

  // In/Out network balance
  oonWeightFactor: number;
  topicOonWeightFactor: number;
  newUserOonWeightFactor: number;
  newUserAgeThresholdSecs: number;
  newUserMinFollowing: number;
  enableOonRescoreForInNetworkRepliesRetweets: boolean;

  // Author cold-start boost
  enableAuthorColdStart: boolean;
  coldStartImpressionThreshold: number;
  coldStartSlotMin: number;
  coldStartSlotMax: number;
  coldStartFollowerCap: number;
  coldStartMaxPostAgeSecs: number;
  lowImpressionsMaxPositionRatio: number;

  // DPP reranking
  enableVMRanker: boolean;
  vmRankerTheta: number;
  vmRankerTopK: number;
  vmRankerMaxSelectedRank: number;
}

// Filter context
export interface FilterContext {
  currentUserId: string;
  blockedUsers: string[];
  mutedUsers: string[];
  mutedKeywords: string[];
  followedAuthorIds: string[];
  subscribedAuthorIds: string[];
  seenTweetIds: string[];
  servedTweetIds: string[];
  bloomSeenTweetIds: string[];
  cachedPostIds: string[];
  inNetworkOnly: boolean;
  isBottomRequest: boolean;
  hasPostEngagementSignals: boolean;
  currentTime: number;
  maxTweetAgeHours: number;
  impressedTweetIds: string[];
  topicIds: string[];
  excludedTopicIds: string[];
  isBulkTopicRequest: boolean;
  excludeVideos: boolean;
  userAccountAgeSeconds: number;
  resurrectionAgeSeconds?: number;
  followedCount: number;
  viewerFollowerCount: number;
  enableServedFilterAllRequests: boolean;
  enableNewUserMinEngagementFilter: boolean;
  newUserMinEngagementMetric: 'fav' | 'engagement' | 'view';
  newUserMinEngagementUseRatio: boolean;
  newUserMinEngagementThreshold: number;
  newUserMinEngagementMaxAccountAgeSecs: number;
  newUserMinEngagementMaxResurrectionAgeSecs: number;
  enableInventoryHoldout: boolean;
  inventoryHoldoutOriginalsPercent: number;
  inventoryHoldoutRepliesPercent: number;
  inventoryHoldoutRetweetsPercent: number;
  engagedSemanticIds: string[];
  whoToFollowEligible: boolean;
  feedSurveyEligible: boolean;
  pushToHomeTweetId?: string;
  adFixtures: AdFixture[];
  promptCount: number;
  jetfuelFrameCount: number;
  viewerLoggedOut: boolean;
  viewerAge: ViewerAge;
  viewerAccountCountryCode?: string;
  viewerCountryCode?: string;
  ipAddress?: string;
  viewerAllowsSensitiveMedia: boolean;
}

// Filter configuration
export interface FilterConfig {
  id: string;
  name: string;
  nameZh: string;
  description: string;
  descriptionZh: string;
  enabled: boolean;
}

// Filter result
export interface FilterResult {
  filterId: string;
  filterName: string;
  inputCount: number;
  outputCount: number;
  filteredCandidates: TweetCandidate[];
  passedCandidates: TweetCandidate[];
}

// Pipeline step
export interface PipelineStep {
  id: string;
  name: string;
  nameZh: string;
  description: string;
  descriptionZh: string;
  type:
    | 'query_hydrator'
    | 'source'
    | 'hydrator'
    | 'filter'
    | 'scorer'
    | 'selector'
    | 'blender'
    | 'side_effect'
    | 'ranker';
  inputCount: number;
  outputCount: number;
  details?: FilterResult | ScorerResult | FeedBlendResult | SideEffectResult;
}

// Scorer result
export interface ScorerResult {
  scorerId: string;
  scorerName: string;
  summary?: Record<string, number | string | boolean>;
  candidateScores: {
    candidateId: string;
    scores: Record<string, number>;
    finalScore: number;
  }[];
}

export interface SideEffectResult {
  sideEffectId: string;
  sideEffectName: string;
  execution: 'registered_only';
  actions: {
    name: string;
    nameZh: string;
    status: 'registered_only';
    description: string;
    descriptionZh: string;
  }[];
}

export type FeedItemType =
  | 'post'
  | 'ad'
  | 'who_to_follow'
  | 'prompt'
  | 'push_to_home'
  | 'frame'
  | 'feed_survey';

export interface FeedItem {
  id: string;
  type: FeedItemType;
  rank: number;
  tweet?: TweetCandidate;
  score?: number;
  label: string;
  labelZh: string;
  title: string;
  titleZh: string;
  description: string;
  descriptionZh: string;
  source: string;
  sourceZh?: string;
}

export interface FeedBlendResult {
  blenderId: string;
  blenderName: string;
  postCount: number;
  adCount: number;
  whoToFollowCount: number;
  promptCount: number;
  pushToHomeCount: number;
  frameCount: number;
  feedSurveyCount: number;
  feedItems: FeedItem[];
}

// Analysis result
export interface AnalysisResult {
  phoenixScores: PhoenixScores;
  heatScore: number;
  suggestions: Suggestion[];
  filterRisks: FilterRisk[];
}

// Suggestion
export interface Suggestion {
  type: 'positive' | 'negative' | 'neutral';
  message: string;
  messageZh: string;
  impact: 'low' | 'medium' | 'high';
}

// Filter risk
export interface FilterRisk {
  filterId: string;
  filterName: string;
  risk: 'low' | 'medium' | 'high';
  reason: string;
  reasonZh: string;
}

// Analysis history
export interface AnalysisHistory {
  id: string;
  timestamp: number;
  type: 'single' | 'compare' | 'ranking';
  input: TweetInput | TweetInput[];
  result: AnalysisResult | AnalysisResult[];
  weights?: WeightConfig;
}

// Scenario for ranking simulator
export interface RankingScenario {
  id: string;
  name: string;
  nameZh: string;
  description: string;
  descriptionZh: string;
  candidateCount: number;
  inNetworkRatio: number;
}
