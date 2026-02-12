// Phoenix Scores - 18 behavior predictions
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
  followAuthorScore: number;    // Follow author probability

  // Negative behaviors
  notInterestedScore: number;   // Not interested probability
  blockAuthorScore: number;     // Block author probability
  muteAuthorScore: number;      // Mute author probability
  reportScore: number;          // Report probability

  // Continuous value
  dwellTime: number;            // Expected dwell time in ms
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
  conversationId?: string;
  ancestors?: string[];
  isRetweet: boolean;
  originalTweetId?: string;
  subscriptionAuthorId?: string;
  visibilityFiltered?: boolean;

  // Phoenix predicted scores
  phoenixScores: PhoenixScores;

  // Computed scores
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
  dwellTimeWeight: number;

  // Weighted scorer controls
  minVideoDurationMs: number;
  negativeScoresOffset: number;

  // Diversity parameters
  authorDiversityDecay: number;
  authorDiversityFloor: number;

  // In/Out network balance
  oonWeightFactor: number;
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
  type: 'query_hydrator' | 'source' | 'hydrator' | 'filter' | 'scorer' | 'selector' | 'ranker';
  inputCount: number;
  outputCount: number;
  details?: FilterResult | ScorerResult;
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
