// Phoenix Scores - behavior predictions plus continuous engagement values.
export interface PhoenixScores {
  // Positive behaviors
  favoriteScore: number;        // Like probability
  replyScore: number;           // Reply probability
  retweetScore: number;         // Retweet probability
  photoExpandScore: number;     // Photo expand probability
  clickScore: number;           // Click probability
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

  // Negative behaviors
  notInterestedScore: number;   // Not interested probability
  blockAuthorScore: number;     // Block author probability
  muteAuthorScore: number;      // Mute author probability
  reportScore: number;          // Report probability
  notDwelledScore: number;      // Not dwelled probability

  // Continuous values
  dwellTime: number;            // Expected dwell time in ms
  clickDwellTime: number;       // Expected dwell time after click in ms
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
  authorFollowers: number;
  authorVerified: boolean;
  authorAvatar?: string;

  // Media
  hasImage: boolean;
  hasVideo: boolean;
  videoDurationMs?: number;

  // Metadata
  createdAt: number;  // Snowflake timestamp
  inNetwork: boolean;
  servedType?: 'for_you_in_network' | 'for_you_phoenix_retrieval';
  sourceType?:
    | 'thunder'
    | 'tweet_mixer'
    | 'phoenix'
    | 'phoenix_topics'
    | 'phoenix_moe'
    | 'cached_posts';
  conversationId?: string;
  ancestors?: string[];
  isRetweet: boolean;
  originalTweetId?: string;
  retweetedAuthorId?: string;
  quotedTweetId?: string;
  quotedAuthorId?: string;
  subscriptionAuthorId?: string;
  visibilityFiltered?: boolean;
  dropAncillaryPosts?: boolean;
  authorBlocksViewer?: boolean;
  quotedAuthorBlocksViewer?: boolean;
  viewerBlocksQuotedAuthor?: boolean;
  viewerBlocksRetweetedAuthor?: boolean;

  // Hydrated candidate features from the 2026 X algorithm release
  filteredTopicIds?: number[];
  unfilteredTopicIds?: number[];
  followingRepliedUserIds?: string[];
  languageCode?: string;
  favoriteCount?: number;
  replyCount?: number;
  repostCount?: number;
  quoteCount?: number;
  mutualFollowJaccard?: number;
  brandSafetyRisk?: 'low' | 'medium' | 'high';
  safetyLabels?: string[];
  quotedVideoDurationMs?: number;

  // Phoenix predicted scores
  phoenixScores: PhoenixScores;

  // Computed scores
  rawWeightedScore?: number;
  weightedScore?: number;
  diversityAdjustedScore?: number;
  finalScore?: number;

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
  retweetWeight: number;
  photoExpandWeight: number;
  clickWeight: number;
  profileClickWeight: number;
  vqvWeight: number;
  shareWeight: number;
  shareViaDmWeight: number;
  shareViaCopyLinkWeight: number;
  dwellWeight: number;
  quoteWeight: number;
  quotedClickWeight: number;
  followAuthorWeight: number;

  // Negative weights
  notInterestedWeight: number;
  blockAuthorWeight: number;
  muteAuthorWeight: number;
  reportWeight: number;
  quotedVqvWeight: number;
  notDwelledWeight: number;
  dwellTimeWeight: number;
  clickDwellTimeWeight: number;

  // Weighted scorer controls
  minVideoDurationMs: number;
  enableQuotedVqvDurationCheck: boolean;
  negativeScoresOffset: number;

  // Diversity parameters
  authorDiversityDecay: number;
  authorDiversityFloor: number;

  // In/Out network balance
  oonWeightFactor: number;
  topicOonWeightFactor: number;
  newUserOonWeightFactor: number;

  // Optional value-model reranking simulation
  vmRankerBlendFactor: number;
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
  inNetworkOnly: boolean;
  isBottomRequest: boolean;
  currentTime: number;
  maxTweetAgeHours: number;
  impressedTweetIds: string[];
  topicIds: number[];
  excludedTopicIds: number[];
  newUserTopicIds: number[];
  excludeVideos: boolean;
  isNewUser: boolean;
  userAccountAgeDays: number;
  followedCount: number;
  topicExpansionMap: Record<number, number[]>;
  includeForYouModules: boolean;
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
  type: 'query_hydrator' | 'source' | 'hydrator' | 'filter' | 'scorer' | 'selector' | 'blender' | 'ranker';
  inputCount: number;
  outputCount: number;
  details?: FilterResult | ScorerResult | FeedBlendResult;
}

// Scorer result
export interface ScorerResult {
  scorerId: string;
  scorerName: string;
  candidateScores: {
    candidateId: string;
    scores: Record<string, number>;
    finalScore: number;
  }[];
}

export type FeedItemType = 'post' | 'ad' | 'who_to_follow' | 'prompt' | 'push_to_home';

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
}

export interface FeedBlendResult {
  blenderId: string;
  blenderName: string;
  postCount: number;
  adCount: number;
  whoToFollowCount: number;
  promptCount: number;
  pushToHomeCount: number;
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
